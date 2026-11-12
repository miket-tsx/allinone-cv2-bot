// Bot-side automod: checks every message against the server's filters, deletes what breaks
// the rules, hands out strikes, and escalates punishments as strikes pile up.
// Discord's own AutoMod rules (synced by `automodnative`) run on Discord's side and catch
// things before we ever see them, so the two work together rather than overlap.
const { PermissionFlagsBits: P } = require('discord.js');
const db = require('./db');
const { card, C, trunc } = require('./ui');
const { sendLog } = require('./log');
const { parseDur, fmtDur } = require('./util');

const FILTERS = {
  spam: 'Too many messages in a few seconds',
  duplicates: 'The same message over and over',
  mentions: 'Pinging lots of people in one message',
  links: 'Links to sites that are not on the allow list',
  invites: 'Discord invites to other servers',
  caps: 'MOSTLY CAPITAL LETTERS',
  emoji: 'Walls of emoji',
  badwords: 'Words on the server blocklist',
  newlines: 'Messages with tons of line breaks',
};

const recent = new Map(); // `${guild}:${user}` -> [{ at, content }]
const INVITE = /(discord\.(gg|io|me|li)|discord(app)?\.com\/invite)\/[\w-]+/i;
const URL_RE = /https?:\/\/([^\s/]+)/gi;
const EMOJI = /<a?:\w+:\d+>|\p{Extended_Pictographic}/gu;

function normalizeWord(s) {
  // Catch the usual dodges: b.a.d, b a d, b4d, BAD
  return s
    .toLowerCase()
    .replace(/[@4]/g, 'a')
    .replace(/3/g, 'e')
    .replace(/[1!|]/g, 'i')
    .replace(/0/g, 'o')
    .replace(/\$|5/g, 's')
    .replace(/[^a-z\s]/g, '');
}

function badWordHit(content, words) {
  if (!words.length) return null;
  const plain = normalizeWord(content);
  const squashed = plain.replace(/\s+/g, '');
  for (const w of words) {
    const word = normalizeWord(w).replace(/\s+/g, '');
    if (!word) continue;
    // short words only count as whole words so "class" doesn't trip on "ass"
    if (word.length <= 3 ? new RegExp(`\\b${word}\\b`).test(plain) : squashed.includes(word)) return w;
  }
  return null;
}

// Returns { filter, detail } for the first rule the message breaks, or null
function inspect(message, cfg) {
  const f = cfg.filters;
  const content = message.content || '';
  const key = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  const history = (recent.get(key) || []).filter((m) => now - m.at < 60_000);
  history.push({ at: now, content: content.toLowerCase() });
  recent.set(key, history.slice(-20));

  if (f.spam.on && history.filter((m) => now - m.at < f.spam.seconds * 1000).length > f.spam.count)
    return { filter: 'spam', detail: `${f.spam.count}+ messages in ${f.spam.seconds}s` };
  if (f.duplicates.on && content.length > 3) {
    const same = history.filter((m) => now - m.at < f.duplicates.seconds * 1000 && m.content === content.toLowerCase());
    if (same.length >= f.duplicates.count) return { filter: 'duplicates', detail: `sent the same thing ${same.length} times` };
  }
  const pings = message.mentions.users.size + message.mentions.roles.size + (message.mentions.everyone ? 5 : 0);
  if (f.mentions.on && pings > f.mentions.max) return { filter: 'mentions', detail: `${pings} mentions` };
  if (f.invites.on && INVITE.test(content)) return { filter: 'invites', detail: content.match(INVITE)[0] };
  if (f.links.on) {
    for (const [, host] of content.matchAll(URL_RE)) {
      const h = host.toLowerCase().replace(/^www\./, '');
      if (!f.links.allow.some((d) => h === d || h.endsWith(`.${d}`))) return { filter: 'links', detail: h };
    }
  }
  const word = f.badwords.on && badWordHit(content, f.badwords.words);
  if (word) return { filter: 'badwords', detail: `"${word}"` };
  const letters = content.replace(/[^a-zA-Z]/g, '');
  if (f.caps.on && letters.length >= f.caps.min) {
    const pct = (letters.replace(/[^A-Z]/g, '').length / letters.length) * 100;
    if (pct >= f.caps.percent) return { filter: 'caps', detail: `${Math.round(pct)}% caps` };
  }
  const emoji = content.match(EMOJI)?.length || 0;
  if (f.emoji.on && emoji > f.emoji.max) return { filter: 'emoji', detail: `${emoji} emoji` };
  if (f.newlines.on && content.split('\n').length > f.newlines.max) return { filter: 'newlines', detail: `${content.split('\n').length} lines` };
  return null;
}

function isExempt(message, cfg) {
  const m = message.member;
  if (!m || message.author.bot) return true;
  if (m.id === message.guild.ownerId || m.permissions.has(P.ManageMessages)) return true;
  if (cfg.exemptChannels.includes(message.channel.id) || cfg.exemptChannels.includes(message.channel.parentId)) return true;
  return m.roles.cache.some((r) => cfg.exemptRoles.includes(r.id));
}

function addStrike(cfg, userId, filter) {
  const cutoff = Date.now() - cfg.decayHours * 3600_000;
  const list = (cfg.strikes[userId] || []).filter((s) => s.at > cutoff);
  list.push({ at: Date.now(), filter });
  cfg.strikes[userId] = list;
  return list.length;
}

// Highest punishment step whose threshold was crossed by this exact strike
async function punish(member, cfg, count) {
  const step = cfg.punishments.filter((p) => p.strikes === count).at(-1);
  if (!step) return null;
  const reason = `Automod: reached ${count} strikes`;
  try {
    if (step.action === 'timeout') {
      const ms = Math.min(parseDur(step.duration || '10m') || 600_000, 28 * 86400_000);
      await member.timeout(ms, reason);
      return `timed out for ${fmtDur(ms)}`;
    }
    if (step.action === 'kick') {
      await member.kick(reason);
      return 'kicked';
    }
    if (step.action === 'ban') {
      await member.ban({ reason, deleteMessageSeconds: 3600 });
      return 'banned';
    }
  } catch {
    return `should have been ${step.action}ed, but my role is too low`;
  }
  return null;
}

// Called for every guild message. Returns true when the message was removed.
async function check(message) {
  if (!message.guild || !message.member) return false;
  const g = db.guild(message.guild.id);
  const cfg = g.automod;
  if (!cfg.enabled || isExempt(message, cfg)) return false;
  const hit = inspect(message, cfg);
  if (!hit) return false;

  await message.delete().catch(() => {});
  // Spam fires on every extra message; one strike per burst is plenty
  const key = `${message.guild.id}:${message.author.id}:${hit.filter}`;
  if (hit.filter === 'spam' && recent.get(key)?.[0]?.at > Date.now() - 10_000) return true;
  recent.set(key, [{ at: Date.now() }]);

  const count = addStrike(cfg, message.author.id, hit.filter);
  db.save();
  const outcome = await punish(message.member, cfg, count);

  const notice = await message.channel
    .send({
      ...card({
        description: `⚠️ <@${message.author.id}>, ${FILTERS[hit.filter].toLowerCase()} isn't allowed here. That's strike ${count}.${outcome ? ` You've been ${outcome}.` : ''}`,
        color: C.warn,
      }),
      allowedMentions: { users: [message.author.id] },
    })
    .catch(() => null);
  if (notice) setTimeout(() => notice.delete().catch(() => {}), 8000);

  sendLog(message.guild, {
    title: `Automod: ${hit.filter}`,
    color: C.mod,
    description: trunc(message.content || '*(no text)*', 800),
    fields: [
      ['Member', `<@${message.author.id}> (${message.author.username})`],
      ['Channel', `<#${message.channel.id}>`],
      ['Why', hit.detail],
      ['Strikes', String(count)],
      ['Action', outcome ? `Message deleted, ${outcome}` : 'Message deleted'],
    ],
  });
  return true;
}

// Pushes the blocklist and a mention limit into Discord's native AutoMod as well, so they're
// enforced even while the bot is offline.
async function syncNative(guild) {
  const g = db.guild(guild.id);
  const rules = await guild.autoModerationRules.fetch();
  const upsert = async (name, body) => {
    // Discord allows only one preset rule and one mention-spam rule per server, so reuse those by type
    const existing = rules.find((r) => r.name === name || ([4, 5].includes(body.triggerType) && r.triggerType === body.triggerType));
    return existing ? existing.edit(body) : guild.autoModerationRules.create({ name, eventType: 1, ...body });
  };
  const done = [];
  const words = g.automod.filters.badwords.words.slice(0, 1000);
  if (words.length) {
    await upsert('Slash: blocked words', {
      triggerType: 1,
      triggerMetadata: { keywordFilter: words.map((w) => `*${w}*`) },
      actions: [{ type: 1, metadata: { customMessage: 'That word is blocked in this server.' } }],
      enabled: true,
    });
    done.push(`blocked words (${words.length})`);
  }
  await upsert('Slash: common slurs and profanity', {
    triggerType: 4,
    triggerMetadata: { presets: [1, 2, 3] },
    actions: [{ type: 1 }],
    enabled: true,
  });
  done.push("Discord's profanity, sexual content and slur lists");
  await upsert('Slash: mention spam', {
    triggerType: 5,
    triggerMetadata: { mentionTotalLimit: Math.max(g.automod.filters.mentions.max + 1, 5), mentionRaidProtectionEnabled: true },
    actions: [{ type: 1 }],
    enabled: true,
  });
  done.push('mention spam with raid protection');
  return done;
}

module.exports = { check, inspect, syncNative, badWordHit, addStrike, FILTERS };
