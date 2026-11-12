const { PermissionFlagsBits: P, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const db = require('../lib/db');
const { card, ok, C } = require('../lib/ui');
const { assert, ts } = require('../lib/util');

const admin = { guildOnly: true, perms: [P.ManageGuild] };
const eph = (p) => ({ ...p, flags: (p.flags || 0) | MessageFlags.Ephemeral });
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const STATUS = { open: ['💡', C.primary, 'Open for votes'], approved: ['✅', C.success, 'Approved'], denied: ['❌', C.error, 'Denied'], considering: ['🤔', C.warn, 'Under consideration'] };

function suggestionCard(s) {
  const [icon, color, label] = STATUS[s.status];
  const up = s.up.length;
  const down = s.down.length;
  const total = up + down;
  const bar = total ? `${'🟩'.repeat(Math.round((up / total) * 10))}${'🟥'.repeat(10 - Math.round((up / total) * 10))}` : '';
  return card({
    title: `${icon} Suggestion #${s.n}`,
    description: s.text,
    color,
    fields: [
      ['From', `<@${s.author}>`],
      ['Votes', `👍 ${up} · 👎 ${down}${bar ? `\n${bar}` : ''}`],
      ['Status', label],
      ['Staff note', s.note],
    ],
    rows:
      s.status === 'open' || s.status === 'considering'
        ? [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId(`suggest:up:${s.n}`).setEmoji('👍').setStyle(ButtonStyle.Success),
              new ButtonBuilder().setCustomId(`suggest:down:${s.n}`).setEmoji('👎').setStyle(ButtonStyle.Danger),
            ),
          ]
        : [],
  });
}

async function setStatus(ctx, n, status, note) {
  const cfg = db.guild(ctx.guild.id).suggestions;
  const s = cfg.items[n];
  assert(s, `No suggestion #${n}.`);
  s.status = status;
  s.note = note || null;
  db.save();
  const msg = await ctx.guild.channels.cache.get(s.channelId)?.messages.fetch(s.messageId).catch(() => null);
  await msg?.edit(suggestionCard(s));
  const author = await ctx.client.users.fetch(s.author).catch(() => null);
  author?.send(card({ description: `Your suggestion #${n} in **${ctx.guild.name}** was marked **${STATUS[status][2].toLowerCase()}**.${note ? `\n> ${note}` : ''}` })).catch(() => {});
  return ok(`Suggestion #${n} is now ${STATUS[status][2].toLowerCase()}.`);
}

module.exports = [
  // ---- starboard ----
  {
    name: 'starboard',
    description: 'Set up the starboard: popular messages get reposted to a highlights channel',
    ...admin,
    options: [
      { name: 'channel', type: 'channel', description: 'Highlights channel (leave out to see settings)' },
      { name: 'threshold', type: 'integer', min: 1, max: 100, description: 'Reactions needed (default 3)' },
      { name: 'emoji', type: 'string', description: 'Emoji to count (default ⭐)' },
      { name: 'self_star', type: 'boolean', description: 'Can people star their own posts?' },
    ],
    run(ctx, a) {
      const cfg = db.guild(ctx.guild.id).starboard;
      if (a.channel) {
        assert(a.channel.isTextBased(), 'Pick a text channel.');
        cfg.channel = a.channel.id;
      }
      if (a.threshold) cfg.threshold = a.threshold;
      if (a.emoji) cfg.emoji = a.emoji.trim();
      if (a.self_star !== undefined) cfg.selfStar = a.self_star;
      db.save();
      return card({
        title: `${cfg.emoji} Starboard`,
        description: cfg.channel ? `Messages with ${cfg.threshold}+ ${cfg.emoji} get pinned to <#${cfg.channel}>.` : 'Not set up yet. Run `starboard #channel`.',
        fields: [['Self-stars count', cfg.selfStar ? 'Yes' : 'No']],
        color: C.eco,
      });
    },
  },
  {
    name: 'starboardoff',
    description: 'Turn the starboard off',
    ...admin,
    run(ctx) {
      db.guild(ctx.guild.id).starboard.channel = null;
      db.save();
      return ok('Starboard is off. Old highlights stay where they are.');
    },
  },
  // ---- suggestions ----
  {
    name: 'suggestchannel',
    description: 'Pick the channel where suggestions get posted',
    ...admin,
    options: [{ name: 'channel', type: 'channel', required: true, description: 'Suggestions channel' }],
    run(ctx, a) {
      assert(a.channel.isTextBased(), 'Pick a text channel.');
      db.guild(ctx.guild.id).suggestions.channel = a.channel.id;
      db.save();
      return ok(`Suggestions will show up in ${a.channel}. People can post with \`suggest\`.`);
    },
  },
  {
    name: 'suggest',
    description: 'Suggest something for the server',
    guildOnly: true,
    cooldown: 60,
    options: [{ name: 'idea', type: 'string', required: true, description: 'Your suggestion' }],
    async run(ctx, a) {
      const cfg = db.guild(ctx.guild.id).suggestions;
      const ch = ctx.guild.channels.cache.get(cfg.channel);
      assert(ch, "Suggestions aren't set up here yet. An admin can run `suggestchannel`.");
      const s = { n: ++cfg.counter, author: ctx.user.id, text: a.idea.slice(0, 2000), status: 'open', up: [], down: [], note: null, channelId: ch.id, at: Date.now() };
      const msg = await ch.send({ ...suggestionCard(s), allowedMentions: { parse: [] } });
      s.messageId = msg.id;
      cfg.items[s.n] = s;
      db.save();
      msg.startThread?.({ name: `Suggestion #${s.n}`.slice(0, 100) }).catch(() => {});
      return ok(`Posted as suggestion #${s.n} in ${ch}.`);
    },
    async onComponent(i, [dir, n]) {
      const s = db.guild(i.guild.id).suggestions.items[n];
      if (!s || !['open', 'considering'].includes(s.status)) return i.reply(eph(card({ description: 'Voting on this one is closed.', color: C.warn })));
      const [mine, other] = dir === 'up' ? [s.up, s.down] : [s.down, s.up];
      if (other.includes(i.user.id)) other.splice(other.indexOf(i.user.id), 1);
      if (mine.includes(i.user.id)) mine.splice(mine.indexOf(i.user.id), 1);
      else mine.push(i.user.id);
      db.save();
      return i.update(suggestionCard(s));
    },
  },
  ...['approve', 'deny', 'consider'].map((verb) => ({
    name: `suggestion${verb}`,
    description: `Mark a suggestion as ${verb === 'consider' ? 'under consideration' : verb === 'deny' ? 'denied' : 'approved'}`,
    guildOnly: true,
    perms: [P.ManageMessages],
    options: [
      { name: 'number', type: 'integer', required: true, min: 1, description: 'Suggestion number' },
      { name: 'note', type: 'string', description: 'Optional note for the author' },
    ],
    run: (ctx, a) => setStatus(ctx, a.number, { approve: 'approved', deny: 'denied', consider: 'considering' }[verb], a.note),
  })),
  // ---- counting ----
  {
    name: 'countingchannel',
    description: 'Make a channel the counting channel (1, 2, 3, ...)',
    ...admin,
    options: [
      { name: 'channel', type: 'channel', required: true, description: 'Counting channel' },
      { name: 'math', type: 'boolean', description: 'Allow math like 2*5 to count (default yes)' },
    ],
    run(ctx, a) {
      assert(a.channel.isTextBased(), 'Pick a text channel.');
      const cfg = db.guild(ctx.guild.id).counting;
      Object.assign(cfg, { channel: a.channel.id, current: 0, lastUser: null, math: a.math ?? true });
      db.save();
      return ok(`Counting starts in ${a.channel}. First number is **1**, and nobody can count twice in a row.`);
    },
  },
  {
    name: 'counting',
    description: 'See the counting stats',
    guildOnly: true,
    run(ctx) {
      const cfg = db.guild(ctx.guild.id).counting;
      assert(cfg.channel, 'There is no counting channel here.');
      return card({ title: '🔢 Counting', fields: [['Channel', `<#${cfg.channel}>`], ['Current', cfg.current], ['Next', cfg.current + 1], ['Best ever', cfg.best]] });
    },
  },
  {
    name: 'countingoff',
    description: 'Turn counting off',
    ...admin,
    run(ctx) {
      db.guild(ctx.guild.id).counting.channel = null;
      db.save();
      return ok('Counting is off.');
    },
  },
  {
    name: 'countingset',
    description: 'Set the current count by hand',
    ...admin,
    options: [{ name: 'number', type: 'integer', required: true, min: 0, description: 'Current number' }],
    run(ctx, a) {
      const cfg = db.guild(ctx.guild.id).counting;
      cfg.current = a.number;
      cfg.lastUser = null;
      db.save();
      return ok(`Count set to ${a.number}. Next up is ${a.number + 1}.`);
    },
  },
  // ---- birthdays ----
  {
    name: 'birthday',
    description: "Save your birthday (month and day) so the server can celebrate",
    aliases: ['bday'],
    options: [{ name: 'date', type: 'string', required: true, description: 'Like 14 March, March 14 or 03-14' }],
    run(ctx, a) {
      const s = a.date.trim().toLowerCase();
      let month;
      let day;
      const num = s.match(/^(\d{1,2})[-/.](\d{1,2})$/);
      if (num) [month, day] = [Number(num[1]), Number(num[2])];
      else {
        const m = MONTHS.findIndex((x) => s.includes(x.slice(0, 3).toLowerCase()));
        const d = s.match(/\d{1,2}/);
        if (m >= 0 && d) [month, day] = [m + 1, Number(d[0])];
      }
      const valid = month >= 1 && month <= 12 && day >= 1 && day <= new Date(2024, month, 0).getDate();
      assert(valid, "I couldn't read that date. Try something like `14 March` or `03-14` (month-day).");
      db.user(ctx.user.id).birthday = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      db.save();
      return ok(`Saved: **${day} ${MONTHS[month - 1]}**. 🎂 I don't store the year.`);
    },
  },
  {
    name: 'birthdayremove',
    description: 'Forget your birthday',
    run(ctx) {
      delete db.user(ctx.user.id).birthday;
      db.save();
      return ok("Done, I've forgotten it.");
    },
  },
  {
    name: 'birthdays',
    description: 'Upcoming birthdays in this server',
    guildOnly: true,
    defer: true,
    async run(ctx) {
      const members = await ctx.guild.members.fetch();
      const now = new Date();
      const list = members
        .map((m) => ({ m, b: db.data.users[m.id]?.birthday }))
        .filter((x) => x.b)
        .map((x) => {
          const [mo, d] = x.b.split('-').map(Number);
          let next = new Date(Date.UTC(now.getUTCFullYear(), mo - 1, d));
          if (next < new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))) next = new Date(Date.UTC(now.getUTCFullYear() + 1, mo - 1, d));
          return { ...x, next };
        })
        .sort((a, b) => a.next - b.next)
        .slice(0, 15);
      return card({
        title: '🎂 Upcoming birthdays',
        description: list.map((x) => `**${x.m.displayName}**: ${x.next.getUTCDate()} ${MONTHS[x.next.getUTCMonth()]} (${ts(x.next, 'R')})`).join('\n') || 'Nobody has saved a birthday yet. Use `birthday`!',
        color: C.fun,
      });
    },
  },
  {
    name: 'birthdaysetup',
    description: 'Where to announce birthdays, plus an optional birthday role for the day',
    ...admin,
    options: [
      { name: 'channel', type: 'channel', required: true, description: 'Announcement channel' },
      { name: 'role', type: 'role', description: 'Role to give for the day' },
      { name: 'message', type: 'string', description: 'Message. {user} is replaced with the mention' },
    ],
    run(ctx, a) {
      assert(a.channel.isTextBased(), 'Pick a text channel.');
      if (a.role) assert(a.role.editable, `I can't give out ${a.role.name}. Move my role above it.`);
      const cfg = db.guild(ctx.guild.id).birthdays;
      cfg.channel = a.channel.id;
      cfg.role = a.role?.id || null;
      if (a.message) cfg.message = a.message.slice(0, 1000);
      db.save();
      return ok(`Birthdays get announced in ${a.channel} around midnight UTC${a.role ? `, and the birthday person gets ${a.role} for the day` : ''}.`);
    },
  },
];

