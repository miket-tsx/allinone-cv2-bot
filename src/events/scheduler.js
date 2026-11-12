// Background jobs: scheduled messages (every 30s), birthdays (once per UTC day) and
// social feeds (every 5 minutes, spread out so we don't hammer anyone at once).
const { Events } = require('discord.js');
const db = require('../lib/db');
const feeds = require('../lib/feeds');
const { isOn } = require('../lib/features');
const { card, C, trunc } = require('../lib/ui');

const FEED_EVERY = 5 * 60_000;
const ICON = { youtube: '▶️', twitch: '🟣', reddit: '🟠', rss: '📰' };

async function runSchedules(client) {
  const now = Date.now();
  const due = db.data.schedules.filter((s) => s.next <= now);
  if (!due.length) return;
  for (const s of due) {
    if (s.every) {
      // If the bot was offline for a while, skip ahead instead of posting a backlog
      while (s.next <= now) s.next += s.every;
    }
  }
  db.data.schedules = db.data.schedules.filter((s) => s.every || s.next > now);
  db.save();
  for (const s of due) {
    if (!isOn(s.guildId, 'schedules')) continue;
    const ch = await client.channels.fetch(s.channelId).catch(() => null);
    if (!ch?.isTextBased()) continue;
    await ch.send({ ...card({ description: s.message, color: C.info }), allowedMentions: { parse: ['users', 'roles'] } }).catch(() => {});
  }
}

async function alert(client, f, item) {
  const ch = await client.channels.fetch(f.channelId).catch(() => null);
  if (!ch?.isTextBased()) return;
  const text = f.message
    ? f.message.replaceAll('{title}', item.title).replaceAll('{url}', item.url).replaceAll('{everyone}', '@everyone')
    : item.live
      ? `**${f.label}** is live on Twitch!`
      : `New from **${f.label}**`;
  await ch.send({
    ...card({ description: `${ICON[f.type]} ${text}\n### [${trunc(item.title, 200)}](${item.url})`, color: f.type === 'twitch' ? 0x9146ff : C.info }),
    allowedMentions: { parse: f.message?.includes('{everyone}') ? ['everyone'] : [] },
  });
  // Components V2 has no link previews, so the bare link goes underneath for the video/stream embed
  await ch.send({ content: item.url, allowedMentions: { parse: [] } }).catch(() => {});
}

async function runFeeds(client) {
  const due = db.data.feeds.filter((f) => Date.now() - (f.checked || 0) >= FEED_EVERY);
  // A few per tick, oldest check first, so a big list doesn't fire 50 requests at once
  due.sort((a, b) => (a.checked || 0) - (b.checked || 0));
  for (const f of due.slice(0, 5)) {
    f.checked = Date.now();
    if (!isOn(f.guildId, 'feeds')) continue;
    try {
      const items = await feeds.check(f);
      const fresh = items.filter((i) => !f.seen.includes(i.id)).reverse();
      for (const item of fresh.slice(-3)) await alert(client, f, item);
      f.seen = [...new Set([...items.map((i) => i.id), ...f.seen])].slice(0, 50);
      f.error = null;
    } catch (e) {
      f.error = e.message;
    }
  }
  db.save();
}

const today = () => new Date().toISOString().slice(5, 10); // MM-DD in UTC

async function runBirthdays(client) {
  const day = new Date().toISOString().slice(0, 10);
  for (const guild of client.guilds.cache.values()) {
    const cfg = db.data.guilds[guild.id]?.birthdays;
    if (!cfg?.channel || cfg.lastRun === day || !isOn(guild.id, 'birthdays')) continue;
    cfg.lastRun = day;
    // Yesterday's birthday people lose the role
    for (const id of cfg.roleHolders) await guild.members.cache.get(id)?.roles.remove(cfg.role).catch(() => {});
    cfg.roleHolders = [];
    const members = await guild.members.fetch().catch(() => null);
    if (!members) continue;
    const ch = guild.channels.cache.get(cfg.channel);
    for (const m of members.values()) {
      if (m.user.bot || db.data.users[m.id]?.birthday !== today()) continue;
      await ch
        ?.send({
          ...card({ description: cfg.message.replaceAll('{user}', `<@${m.id}>`).replaceAll('{username}', m.user.username), color: C.fun }),
          allowedMentions: { users: [m.id] },
        })
        .catch(() => {});
      if (cfg.role && (await m.roles.add(cfg.role, 'Birthday!').then(() => true).catch(() => false))) cfg.roleHolders.push(m.id);
    }
  }
  db.save();
}

function safely(name, fn) {
  return (...a) => fn(...a).catch((e) => console.error(`[scheduler:${name}]`, e));
}

module.exports = [
  {
    event: Events.ClientReady,
    once: true,
    run(client) {
      setInterval(safely('schedules', runSchedules), 30_000, client);
      setInterval(safely('feeds', runFeeds), 60_000, client);
      setInterval(safely('birthdays', runBirthdays), 10 * 60_000, client);
      setTimeout(safely('birthdays', runBirthdays), 20_000, client);
    },
  },
];

module.exports.alert = alert;
module.exports.runSchedules = runSchedules;
module.exports.runBirthdays = runBirthdays;
