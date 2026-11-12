// Scheduled messages and social feed alerts. The scheduler in events/scheduler.js does the posting.
const { PermissionFlagsBits: P } = require('discord.js');
const db = require('../lib/db');
const feeds = require('../lib/feeds');
const { card, ok, C, trunc } = require('../lib/ui');
const { assert, ts, parseDur, fmtDur } = require('../lib/util');

const admin = { guildOnly: true, perms: [P.ManageGuild] };
const MAX_SCHEDULES = 25;
const MAX_FEEDS = 15;
const newId = () => Math.random().toString(36).slice(2, 8);
const ICON = { youtube: '▶️', twitch: '🟣', reddit: '🟠', rss: '📰' };

module.exports = [
  {
    name: 'schedule',
    description: 'Post a message later, once or on repeat',
    ...admin,
    options: [
      { name: 'channel', type: 'channel', required: true, description: 'Where to post it' },
      { name: 'in', type: 'string', required: true, description: 'When the first one goes out, e.g. 30m, 2h, 1d' },
      { name: 'repeat', type: 'string', required: true, description: '"once", or how often to repeat, e.g. 1d or 1w' },
      { name: 'message', type: 'string', required: true, description: 'What to post' },
    ],
    run(ctx, a) {
      assert(a.channel.isTextBased(), 'Pick a text channel.');
      const delay = parseDur(a.in);
      assert(delay && delay >= 60_000, 'The first post needs to be at least 1 minute away. Try 30m, 2h or 1d.');
      const once = ['once', 'no', 'none', 'never', '0'].includes(a.repeat.toLowerCase());
      const every = once ? null : parseDur(a.repeat);
      assert(once || (every && every >= 600_000), 'Repeats need to be at least 10 minutes apart, or say "once".');
      const mine = db.data.schedules.filter((s) => s.guildId === ctx.guild.id);
      assert(mine.length < MAX_SCHEDULES, `This server already has ${MAX_SCHEDULES} scheduled messages.`);
      const s = { id: newId(), guildId: ctx.guild.id, channelId: a.channel.id, message: a.message.slice(0, 2000), next: Date.now() + delay, every, by: ctx.user.id };
      db.data.schedules.push(s);
      db.save();
      return ok(`Scheduled \`${s.id}\` for ${a.channel} ${ts(s.next, 'R')}${every ? `, then every ${fmtDur(every)}` : ''}.`);
    },
  },
  {
    name: 'schedules',
    description: 'List scheduled messages in this server',
    ...admin,
    run(ctx) {
      const list = db.data.schedules.filter((s) => s.guildId === ctx.guild.id);
      return card({
        title: `⏰ ${list.length} scheduled message${list.length === 1 ? '' : 's'}`,
        description:
          list.map((s) => `\`${s.id}\` <#${s.channelId}> next ${ts(s.next, 'R')}${s.every ? ` · every ${fmtDur(s.every)}` : ''}\n> ${trunc(s.message.replace(/\n/g, ' '), 80)}`).join('\n') ||
          'Nothing scheduled.',
      });
    },
  },
  {
    name: 'scheduleremove',
    description: 'Cancel a scheduled message',
    ...admin,
    options: [{ name: 'id', type: 'string', required: true, description: 'ID from schedules' }],
    run(ctx, a) {
      const before = db.data.schedules.length;
      db.data.schedules = db.data.schedules.filter((s) => !(s.guildId === ctx.guild.id && s.id === a.id));
      assert(db.data.schedules.length < before, 'No scheduled message with that ID.');
      db.save();
      return ok('Cancelled.');
    },
  },
  {
    name: 'feedadd',
    description: 'Post alerts for new YouTube videos, Twitch streams, Reddit posts or RSS items',
    ...admin,
    defer: true,
    options: [
      { name: 'type', type: 'string', required: true, lower: true, choices: feeds.TYPES, description: 'Kind of feed' },
      { name: 'source', type: 'string', required: true, description: 'Channel link or @handle, Twitch name, subreddit or RSS link' },
      { name: 'channel', type: 'channel', required: true, description: 'Where alerts go' },
      { name: 'message', type: 'string', description: 'Custom text. {title} and {url} work, {everyone} pings everyone' },
    ],
    async run(ctx, a) {
      assert(a.channel.isTextBased(), 'Pick a text channel.');
      const mine = db.data.feeds.filter((f) => f.guildId === ctx.guild.id);
      assert(mine.length < MAX_FEEDS, `This server already has ${MAX_FEEDS} feeds.`);
      const { target, label } = await feeds.resolve(a.type, a.source);
      assert(!mine.some((f) => f.type === a.type && f.target === target && f.channelId === a.channel.id), 'That feed already posts there.');
      // Remember what's out there right now, so we only announce things that are new from here on
      const seen = (await feeds.check({ type: a.type, target }).catch(() => [])).map((i) => i.id);
      const f = { id: newId(), guildId: ctx.guild.id, channelId: a.channel.id, type: a.type, target, label, message: a.message || null, seen, checked: Date.now() };
      db.data.feeds.push(f);
      db.save();
      return ok(`${ICON[a.type]} Following **${label}**. New ${a.type === 'twitch' ? 'streams' : 'posts'} go to ${a.channel}. I check every 5 minutes.`);
    },
  },
  {
    name: 'feeds',
    description: 'List the social feeds this server follows',
    ...admin,
    run(ctx) {
      const list = db.data.feeds.filter((f) => f.guildId === ctx.guild.id);
      return card({
        title: `📡 ${list.length} feed${list.length === 1 ? '' : 's'}`,
        description: list.map((f) => `\`${f.id}\` ${ICON[f.type]} **${f.label}** → <#${f.channelId}>${f.error ? ` · ⚠️ ${trunc(f.error, 60)}` : ''}`).join('\n') || 'None yet. Add one with `feedadd`.',
      });
    },
  },
  {
    name: 'feedremove',
    description: 'Stop following a feed',
    ...admin,
    options: [{ name: 'id', type: 'string', required: true, description: 'ID from feeds' }],
    run(ctx, a) {
      const before = db.data.feeds.length;
      db.data.feeds = db.data.feeds.filter((f) => !(f.guildId === ctx.guild.id && f.id === a.id));
      assert(db.data.feeds.length < before, 'No feed with that ID.');
      db.save();
      return ok('Unfollowed.');
    },
  },
  {
    name: 'feedtest',
    description: 'Post the latest item from a feed right now, to check it works',
    ...admin,
    defer: true,
    options: [{ name: 'id', type: 'string', required: true, description: 'ID from feeds' }],
    async run(ctx, a) {
      const f = db.data.feeds.find((x) => x.guildId === ctx.guild.id && x.id === a.id);
      assert(f, 'No feed with that ID.');
      const items = await feeds.check(f);
      assert(items.length, f.type === 'twitch' ? `${f.label} isn't live right now, so there's nothing to show.` : 'The feed loaded but had nothing in it.');
      const { alert } = require('../events/scheduler');
      await alert(ctx.client, f, items[0]);
      return ok(`Posted the latest one in <#${f.channelId}>.`);
    },
  },
];
