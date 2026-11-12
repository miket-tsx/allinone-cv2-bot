const {
  PermissionFlagsBits: P,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  version: djsVersion,
  OAuth2Scopes,
} = require('discord.js');
const db = require('../lib/db');
const { card, ok, C } = require('../lib/ui');
const { assert, ts, fmtDur, parseDur, fmtNum, chunk } = require('../lib/util');

const optUser = { name: 'user', type: 'user', description: 'Who to look up (defaults to you)' };
const polls = new Map(); // messageId -> { question, options, votes: Map<userId, idx>, ends }

function renderPoll(id, p) {
  const total = p.votes.size;
  const counts = p.options.map((_, i) => [...p.votes.values()].filter((v) => v === i).length);
  const lines = p.options.map((o, i) => {
    const pct = total ? Math.round((counts[i] / total) * 100) : 0;
    return `**${i + 1}. ${o}**\n${'▰'.repeat(Math.round(pct / 10))}${'▱'.repeat(10 - Math.round(pct / 10))} ${pct}% (${counts[i]})`;
  });
  const row = new ActionRowBuilder().addComponents(
    p.options.map((o, i) =>
      new ButtonBuilder()
        .setCustomId(`poll:${id}:${i}`)
        .setLabel(`${i + 1}. ${o}`.slice(0, 80))
        .setStyle(ButtonStyle.Secondary),
    ),
  );
  return card({
    title: `📊 ${p.question}`,
    description: lines.join('\n'),
    footer: `${total} vote(s) · asked by ${p.author}`,
    rows: [row],
    color: C.info,
  });
}

function userinfoCard(user, member) {
  const fields = [
    ['ID', `\`${user.id}\``],
    ['Created', `${ts(user.createdAt)} (${ts(user.createdAt, 'R')})`],
  ];
  if (member) {
    fields.push(['Joined', `${ts(member.joinedAt)} (${ts(member.joinedAt, 'R')})`]);
    if (member.nickname) fields.push(['Nickname', member.nickname]);
    const roles = member.roles.cache
      .filter((r) => r.id !== member.guild.id)
      .sort((a, b) => b.position - a.position);
    fields.push([`Roles (${roles.size})`, roles.size ? roles.first(15).map(String).join(' ') : 'None']);
    if (member.premiumSince) fields.push(['Boosting since', ts(member.premiumSince, 'R')]);
    if (member.communicationDisabledUntilTimestamp > Date.now())
      fields.push(['Timed out until', ts(member.communicationDisabledUntilTimestamp)]);
  }
  fields.push(['Bot', user.bot ? 'Yes' : 'No']);
  return card({
    title: user.globalName ? `${user.globalName} (@${user.username})` : user.tag,
    thumbnail: user.displayAvatarURL({ size: 512 }),
    fields,
    color: member?.displayColor || C.primary,
  });
}

const imgCmd = (name, description, get, aliases = []) => ({
  name,
  description,
  aliases,
  options: [optUser],
  async run(ctx, a) {
    const user = a.user || ctx.user;
    const url = await get(ctx, user);
    assert(url, 'Nothing to show here. They probably haven’t set one.');
    return card({
      title: `${name[0].toUpperCase() + name.slice(1)} — ${user.username}`,
      image: url,
      description: `[Open original](${url})`,
    });
  },
});
const guildImg = (name, description, get) => ({
  name,
  description,
  guildOnly: true,
  async run(ctx) {
    const url = get(ctx.guild);
    assert(url, `No ${name.replace('server', '')} here. This server hasn’t set one.`);
    return card({
      title: `${ctx.guild.name} — ${name.replace('server', '')}`,
      image: url,
      description: `[Open original](${url})`,
    });
  },
});

module.exports = [
  {
    name: 'ping',
    description: 'Check how fast (or slow) I’m responding',
    aliases: ['latency'],
    async run(ctx) {
      const t = Date.now();
      return card({
        title: '🏓 Pong!',
        fields: [
          ['Websocket', `${ctx.client.ws.ping}ms`],
          ['Round trip', `${Math.max(0, t - ctx.createdAt.getTime())}ms`],
        ],
        color: C.success,
      });
    },
  },
  {
    name: 'uptime',
    description: 'How long I’ve been awake',
    async run(ctx) {
      return card({
        description: `⏱️ Awake for **${fmtDur(Date.now() - ctx.client.startedAt)}** (since ${ts(ctx.client.startedAt, 'R')}). No naps yet.`,
      });
    },
  },
  {
    name: 'botinfo',
    description: 'Nerdy stats about me',
    aliases: ['stats', 'about'],
    async run(ctx) {
      const c = ctx.client;
      return card({
        title: c.user.username,
        thumbnail: c.user.displayAvatarURL(),
        fields: [
          ['Servers', fmtNum(c.guilds.cache.size)],
          ['Users (cached)', fmtNum(c.guilds.cache.reduce((s, g) => s + g.memberCount, 0))],
          ['Commands', `${c.commands.size} prefix · 100 slash`],
          ['Uptime', fmtDur(Date.now() - c.startedAt)],
          ['Memory', `${(process.memoryUsage().heapUsed / 1048576).toFixed(1)} MB`],
          ['Library', `discord.js v${djsVersion} · Node ${process.version}`],
          ['UI', 'Components V2'],
        ],
      });
    },
  },
  {
    name: 'invite',
    description: 'Grab my invite link and take me to another server',
    async run(ctx) {
      const url = ctx.client.generateInvite({
        scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
        permissions: [P.Administrator],
      });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(url).setLabel('Add me!'),
      );
      return card({
        title: 'Want me in your server?',
        description: 'Flattered. Hit the button and I’ll move right in.',
        rows: [row],
      });
    },
  },
  {
    name: 'userinfo',
    description: 'Everything Discord will tell me about a user',
    aliases: ['whois', 'ui', 'user'],
    options: [optUser],
    async run(ctx, a) {
      const u = await (a.user || ctx.user).fetch();
      return userinfoCard(u, await ctx.getMember(u));
    },
  },
  {
    name: 'serverinfo',
    description: 'The vital stats of this server',
    guildOnly: true,
    aliases: ['si', 'guildinfo'],
    async run(ctx) {
      const g = ctx.guild;
      const owner = await g.fetchOwner().catch(() => null);
      const ch = g.channels.cache;
      return card({
        title: g.name,
        thumbnail: g.iconURL({ size: 256 }),
        description: g.description || null,
        fields: [
          ['ID', `\`${g.id}\``],
          ['Owner', owner ? `${owner.user}` : 'Unknown'],
          ['Created', `${ts(g.createdAt)} (${ts(g.createdAt, 'R')})`],
          ['Members', fmtNum(g.memberCount)],
          [
            'Channels',
            `${ch.filter((c) => c.type === ChannelType.GuildText).size} text · ${ch.filter((c) => c.isVoiceBased()).size} voice · ${ch.filter((c) => c.type === ChannelType.GuildCategory).size} categories`,
          ],
          ['Roles', String(g.roles.cache.size - 1)],
          ['Emojis', String(g.emojis.cache.size)],
          ['Boosts', `${g.premiumSubscriptionCount || 0} (tier ${g.premiumTier})`],
          ['Verification', String(g.verificationLevel)],
        ],
      });
    },
  },
  imgCmd('avatar', 'Show off a user’s avatar', (ctx, u) => u.displayAvatarURL({ size: 1024 }), ['av', 'pfp']),
  imgCmd(
    'serveravatar',
    'Show a user’s server-specific avatar',
    async (ctx, u) => (await ctx.getMember(u))?.displayAvatarURL({ size: 1024 }),
    ['sav'],
  ),
  imgCmd('banner', 'Show a user’s profile banner', async (ctx, u) =>
    (await u.fetch(true)).bannerURL({ size: 1024 }),
  ),
  guildImg('servericon', 'Show this server’s icon', (g) => g.iconURL({ size: 1024 })),
  guildImg('serverbanner', 'Show this server’s banner', (g) => g.bannerURL({ size: 1024 })),
  guildImg('serversplash', 'Show this server’s invite splash', (g) => g.splashURL({ size: 1024 })),
  {
    name: 'roleinfo',
    description: 'Dig into the details of a role',
    guildOnly: true,
    aliases: ['ri'],
    options: [{ name: 'role', type: 'role', required: true, description: 'The role to inspect' }],
    async run(ctx, a) {
      const r = a.role;
      // role.members only reflects cached members, so warm the cache first
      await ctx.guild.members.fetch().catch(() => {});
      const key = r.permissions.has(P.Administrator)
        ? 'Administrator (all)'
        : r.permissions.toArray().slice(0, 12).join(', ') || 'None';
      return card({
        title: r.name,
        color: r.color || C.primary,
        fields: [
          ['ID', `\`${r.id}\``],
          ['Color', r.hexColor],
          ['Members', String(r.members.size)],
          ['Position', String(r.position)],
          ['Hoisted', r.hoist ? 'Yes' : 'No'],
          ['Mentionable', r.mentionable ? 'Yes' : 'No'],
          ['Managed', r.managed ? 'Yes' : 'No'],
          ['Created', ts(r.createdAt, 'R')],
          ['Key permissions', key],
        ],
      });
    },
  },
  {
    name: 'channelinfo',
    description: 'Details on a channel',
    guildOnly: true,
    aliases: ['ci'],
    options: [{ name: 'channel', type: 'channel', description: 'Channel to inspect (defaults to this one)' }],
    async run(ctx, a) {
      const c = a.channel || ctx.channel;
      return card({
        title: `#${c.name}`,
        description: c.topic || null,
        fields: [
          ['ID', `\`${c.id}\``],
          ['Type', ChannelType[c.type]],
          ['Category', c.parent?.name || 'None'],
          ['Created', ts(c.createdAt, 'R')],
          ['NSFW', c.nsfw ? 'Yes' : 'No'],
          ['Slowmode', c.rateLimitPerUser ? `${c.rateLimitPerUser}s` : 'Off'],
        ],
      });
    },
  },
  {
    name: 'membercount',
    description: 'Humans vs. bots headcount',
    guildOnly: true,
    aliases: ['mc'],
    async run(ctx) {
      const all = await ctx.guild.members.fetch();
      const bots = all.filter((m) => m.user.bot).size;
      return card({
        title: ctx.guild.name,
        fields: [
          ['Total', fmtNum(all.size)],
          ['Humans', fmtNum(all.size - bots)],
          ['Bots', fmtNum(bots)],
        ],
      });
    },
  },
  {
    name: 'emojiinfo',
    description: 'Get the details on a custom emoji',
    aliases: ['ei'],
    options: [{ name: 'emoji', type: 'string', required: true, description: 'The custom emoji to look at' }],
    async run(ctx, a) {
      const m = a.emoji.match(/<(a?):(\w+):(\d+)>/);
      assert(m, 'That doesn’t look like a custom emoji. I need something like `<:name:id>`.');
      const url = `https://cdn.discordapp.com/emojis/${m[3]}.${m[1] ? 'gif' : 'png'}?size=256`;
      return card({
        title: `:${m[2]}:`,
        thumbnail: url,
        fields: [
          ['ID', `\`${m[3]}\``],
          ['Animated', m[1] ? 'Yes' : 'No'],
          ['URL', `[link](${url})`],
        ],
      });
    },
  },
  {
    name: 'enlarge',
    description: 'Blow a custom emoji up to full size',
    aliases: ['jumbo', 'bigemoji'],
    options: [{ name: 'emoji', type: 'string', required: true, description: 'The custom emoji to enlarge' }],
    async run(ctx, a) {
      const m = a.emoji.match(/<(a?):(\w+):(\d+)>/);
      assert(m, 'I need a custom emoji to work with.');
      const url = `https://cdn.discordapp.com/emojis/${m[3]}.${m[1] ? 'gif' : 'png'}?size=512`;
      return card({ image: url, footer: `:${m[2]}:` });
    },
  },
  {
    name: 'steal',
    description: 'Swipe a custom emoji from another server and add it here',
    guildOnly: true,
    perms: [P.ManageGuildExpressions],
    botPerms: [P.ManageGuildExpressions],
    aliases: ['addemoji'],
    options: [
      { name: 'emoji', type: 'string', required: true, description: 'The emoji to swipe', rest: false },
      { name: 'name', type: 'string', description: 'Rename it on the way in (optional)' },
    ],
    async run(ctx, a) {
      const m = a.emoji.match(/<(a?):(\w+):(\d+)>/);
      assert(m, 'I need a custom emoji to swipe.');
      const e = await ctx.guild.emojis.create({
        attachment: `https://cdn.discordapp.com/emojis/${m[3]}.${m[1] ? 'gif' : 'png'}`,
        // Discord only accepts word characters in emoji names
        name: (a.name || m[2]).replace(/\W/g, '_').slice(0, 32),
      });
      return ok(`Smooth. ${e} is now yours as \`:${e.name}:\``);
    },
  },
  {
    name: 'emojis',
    description: 'List this server’s custom emojis',
    guildOnly: true,
    async run(ctx) {
      const e = ctx.guild.emojis.cache;
      return card({
        title: `Emojis (${e.size})`,
        description: e.size
          ? e.map(String).join(' ').slice(0, 2500)
          : 'No custom emojis here. Very minimalist.',
      });
    },
  },
  {
    name: 'roles',
    description: 'List this server’s roles',
    guildOnly: true,
    async run(ctx) {
      const r = ctx.guild.roles.cache
        .filter((x) => x.id !== ctx.guild.id)
        .sort((a, b) => b.position - a.position);
      return card({
        title: `Roles (${r.size})`,
        description: r.map(String).join(' ').slice(0, 2500) || 'No roles. Everyone’s equal here.',
      });
    },
  },
  {
    name: 'channels',
    description: 'List this server’s channels, grouped by category',
    guildOnly: true,
    async run(ctx) {
      const cats = ctx.guild.channels.cache
        .filter((c) => c.type === ChannelType.GuildCategory)
        .sort((a, b) => a.position - b.position);
      const lines = [];
      const orphan = ctx.guild.channels.cache.filter(
        (c) => !c.parentId && c.type !== ChannelType.GuildCategory,
      );
      if (orphan.size) lines.push(orphan.map(String).join(' '));
      for (const cat of cats.values())
        lines.push(`**${cat.name}**\n${cat.children.cache.map(String).join(' ') || '—'}`);
      return card({
        title: `Channels (${ctx.guild.channels.cache.size})`,
        description: lines.join('\n').slice(0, 2500),
      });
    },
  },
  {
    name: 'boosts',
    description: 'How this server’s boosts are doing',
    guildOnly: true,
    async run(ctx) {
      const g = ctx.guild;
      const next = [2, 7, 14][g.premiumTier];
      return card({
        title: '💎 Boosts',
        fields: [
          ['Boosts', String(g.premiumSubscriptionCount || 0)],
          ['Tier', String(g.premiumTier)],
          ['Next tier at', next ? `${next} boosts` : 'Maxed out 🎉'],
        ],
        color: 0xf47fff,
      });
    },
  },
  {
    name: 'boosters',
    description: 'Give a shout-out to this server’s boosters',
    guildOnly: true,
    async run(ctx) {
      const all = await ctx.guild.members.fetch();
      const b = all.filter((m) => m.premiumSince);
      return card({
        title: `Boosters (${b.size})`,
        description: b.size
          ? b
              .map((m) => `${m} — ${ts(m.premiumSince, 'R')}`)
              .join('\n')
              .slice(0, 2500)
          : 'No boosters yet. Be the first?',
        color: 0xf47fff,
      });
    },
  },
  {
    name: 'bots',
    description: 'List the bots hanging around this server',
    guildOnly: true,
    async run(ctx) {
      const all = await ctx.guild.members.fetch();
      const b = all.filter((m) => m.user.bot);
      return card({
        title: `Bots (${b.size})`,
        description: b
          .map((m) => `${m.user}`)
          .join('\n')
          .slice(0, 2500),
      });
    },
  },
  {
    name: 'admins',
    description: 'List the humans with Administrator',
    guildOnly: true,
    aliases: ['staff'],
    async run(ctx) {
      const all = await ctx.guild.members.fetch();
      const a = all.filter((m) => !m.user.bot && m.permissions.has(P.Administrator));
      return card({
        title: `Administrators (${a.size})`,
        description:
          a
            .map((m) => `${m.user}`)
            .join('\n')
            .slice(0, 2500) || 'Nobody. Wild.',
      });
    },
  },
  {
    name: 'oldestmembers',
    description: 'The veterans: members with the oldest accounts',
    guildOnly: true,
    async run(ctx) {
      const all = await ctx.guild.members.fetch();
      const s = [...all.values()]
        .filter((m) => !m.user.bot)
        .sort((a, b) => a.user.createdTimestamp - b.user.createdTimestamp)
        .slice(0, 10);
      return card({
        title: 'Oldest accounts',
        description: s.map((m, i) => `**${i + 1}.** ${m.user} — ${ts(m.user.createdAt, 'D')}`).join('\n'),
      });
    },
  },
  {
    name: 'newestmembers',
    description: 'The fresh faces: most recently joined members',
    guildOnly: true,
    async run(ctx) {
      const all = await ctx.guild.members.fetch();
      const s = [...all.values()].sort((a, b) => b.joinedTimestamp - a.joinedTimestamp).slice(0, 10);
      return card({
        title: 'Newest members',
        description: s.map((m, i) => `**${i + 1}.** ${m.user} — ${ts(m.joinedAt, 'R')}`).join('\n'),
      });
    },
  },
  {
    name: 'firstmessage',
    description: 'Jump back to the very first message in this channel',
    guildOnly: true,
    async run(ctx) {
      // fetching "after" snowflake 0 returns the oldest messages
      const m = (await ctx.channel.messages.fetch({ after: '0', limit: 1 })).first();
      assert(m, 'This channel is empty. Nothing to dig up.');
      return card({
        title: 'First message',
        description: `${m.content?.slice(0, 500) || '*(no text)*'}\n\n[Jump to message](${m.url})`,
        footer: `by ${m.author.tag} · ${m.createdAt.toUTCString()}`,
      });
    },
  },
  {
    name: 'snipe',
    description: 'Catch the last deleted message in this channel',
    guildOnly: true,
    async run(ctx) {
      const s = ctx.client.snipes.get(ctx.channel.id);
      assert(s, 'Nothing to snipe. This channel is squeaky clean.');
      return card({
        title: s.tag,
        thumbnail: s.avatar,
        description: s.content || '*(no text)*',
        image: s.image,
        footer: `Caught deleting on ${new Date(s.at).toUTCString()}`,
      });
    },
  },
  {
    name: 'editsnipe',
    description: 'Catch the last edited message in this channel',
    guildOnly: true,
    aliases: ['esnipe'],
    async run(ctx) {
      const s = ctx.client.editSnipes.get(ctx.channel.id);
      assert(s, 'No sneaky edits to report here.');
      return card({
        title: s.tag,
        thumbnail: s.avatar,
        fields: [
          ['Before', s.before || '*(empty)*'],
          ['After', `${s.after || '*(empty)*'} · [jump](${s.url})`],
        ],
      });
    },
  },
  {
    name: 'afk',
    description: 'Go AFK; anyone who pings you gets told you’re away',
    options: [{ name: 'reason', type: 'string', description: 'Where are you off to?' }],
    async run(ctx, a) {
      db.user(ctx.user.id).afk = { reason: (a.reason || 'AFK').slice(0, 200), since: Date.now() };
      db.save();
      return ok(`Gone fishing. You’re AFK: ${a.reason || 'AFK'}`);
    },
  },
  {
    name: 'remind',
    description: 'Set a reminder, e.g. remind 2h stretch your legs',
    aliases: ['reminder', 'remindme'],
    options: [
      {
        name: 'time',
        type: 'string',
        required: true,
        description: 'How long from now: 10m, 2h, 1d12h',
        rest: false,
      },
      { name: 'text', type: 'string', required: true, description: 'What should I nudge you about?' },
    ],
    async run(ctx, a) {
      const ms = parseDur(a.time);
      assert(
        ms && ms >= 10000 && ms <= 365 * 86400000,
        'I can wait anywhere from 10s to 365d. Try something like `30m` or `1d2h`.',
      );
      assert(
        db.data.reminders.filter((r) => r.userId === ctx.user.id).length < 25,
        'That’s 25 reminders already. Clear a few before adding more.',
      );
      const r = {
        id: Math.random().toString(36).slice(2, 8),
        userId: ctx.user.id,
        channelId: ctx.channel.id,
        text: a.text.slice(0, 1000),
        at: Date.now() + ms,
        created: Date.now(),
      };
      db.data.reminders.push(r);
      db.save();
      return ok(`Noted! I’ll nudge you ${ts(r.at, 'R')} about **${r.text}** (id \`${r.id}\`)`);
    },
  },
  {
    name: 'reminders',
    description: 'See what’s on your reminder list',
    async run(ctx) {
      const l = db.data.reminders.filter((r) => r.userId === ctx.user.id).sort((a, b) => a.at - b.at);
      return card({
        title: '⏰ Your reminders',
        description: l.length
          ? l.map((r) => `\`${r.id}\` ${ts(r.at, 'R')} — ${r.text.slice(0, 80)}`).join('\n')
          : 'Nothing pending. Your future self is on their own.',
      });
    },
  },
  {
    name: 'cancelreminder',
    description: 'Scrap a reminder by its id',
    aliases: ['delreminder'],
    options: [
      { name: 'id', type: 'string', required: true, description: 'Reminder id (grab it from reminders)' },
    ],
    async run(ctx, a) {
      const before = db.data.reminders.length;
      db.data.reminders = db.data.reminders.filter((r) => !(r.userId === ctx.user.id && r.id === a.id));
      assert(db.data.reminders.length < before, 'Couldn’t find a reminder with that id.');
      db.save();
      return ok('Reminder scrapped.');
    },
  },
  {
    name: 'poll',
    description: 'Start a button poll: poll Question | Option 1 | Option 2 … (up to 5)',
    guildOnly: true,
    options: [
      {
        name: 'question',
        type: 'string',
        required: true,
        description: 'Question | opt1 | opt2 (no options = yes/no)',
      },
    ],
    async run(ctx, a) {
      const [q, ...opts] = a.question
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean);
      const options = opts.length >= 2 ? opts.slice(0, 5) : ['Yes', 'No'];
      const id = Math.random().toString(36).slice(2, 10);
      const p = { question: q, options, votes: new Map(), author: ctx.user.username };
      polls.set(id, p);
      // polls only live in memory, so don't hold on to them forever
      setTimeout(() => polls.delete(id), 7 * 86400000);
      return renderPoll(id, p);
    },
    async onComponent(i, [id, idx]) {
      const p = polls.get(id);
      // 64 = ephemeral
      if (!p)
        return i.reply({
          ...card({ description: 'This poll has wrapped up. Voting’s closed.' }),
          flags: card({}).flags | 64,
        });
      if (p.votes.get(i.user.id) === Number(idx)) p.votes.delete(i.user.id);
      else p.votes.set(i.user.id, Number(idx));
      return i.update(renderPoll(id, p));
    },
  },
  {
    name: 'timestamp',
    description: 'Turn a duration or date into Discord timestamps (e.g. 2h, 2026-12-25 18:00)',
    aliases: ['ts'],
    options: [
      { name: 'when', type: 'string', required: true, description: 'Like 2h, 3d, or 2026-12-25 18:00 (UTC)' },
    ],
    async run(ctx, a) {
      const ms = parseDur(a.when);
      // dates without a zone are read as UTC so results don't depend on the host's timezone
      const d = ms
        ? new Date(Date.now() + ms)
        : new Date(a.when.includes('T') || /z$/i.test(a.when) ? a.when : a.when + ' UTC');
      assert(!Number.isNaN(d.getTime()), 'I can’t make sense of that time. Try `2h` or `2026-12-25 18:00`.');
      const u = Math.floor(d.getTime() / 1000);
      return card({
        title: 'Timestamps',
        description: ['t', 'T', 'd', 'D', 'f', 'F', 'R']
          .map((s) => `\`<t:${u}:${s}>\` → <t:${u}:${s}>`)
          .join('\n'),
        footer: `Unix: ${u}`,
      });
    },
  },
  {
    name: 'say',
    description: 'Make me say something (I take no responsibility)',
    guildOnly: true,
    perms: [P.ManageMessages],
    aliases: ['echo'],
    options: [{ name: 'text', type: 'string', required: true, description: 'What should I say?' }],
    async run(ctx, a) {
      if (ctx.message) await ctx.message.delete().catch(() => {});
      await ctx.channel.send({ ...card({ description: a.text }), allowedMentions: { parse: [] } });
      if (ctx.isSlash) return { ...ok('Said it.'), ephemeral: true };
    },
  },
  {
    name: 'announce',
    description: 'Post an announcement card in a channel of your choice',
    guildOnly: true,
    perms: [P.ManageMessages],
    options: [
      { name: 'channel', type: 'channel', required: true, description: 'Where should it go?' },
      { name: 'text', type: 'string', required: true, description: 'Title | body (use | to split)' },
    ],
    async run(ctx, a) {
      assert(a.channel.isTextBased(), 'I can only post in text channels. Pick another one.');
      const [t, ...b] = a.text.split('|');
      const hasBody = b.length > 0;
      await a.channel.send({
        ...card({
          title: hasBody ? `📢 ${t.trim()}` : '📢 Announcement',
          description: hasBody ? b.join('|').trim() : t.trim(),
          footer: `Posted by ${ctx.user.username}`,
          color: C.warn,
        }),
        allowedMentions: { parse: [] },
      });
      return ok(`Announcement is out in ${a.channel}.`);
    },
  },
  {
    name: 'card',
    description: 'Post a custom Components V2 card: card #hex | title | body',
    guildOnly: true,
    perms: [P.ManageMessages],
    options: [{ name: 'content', type: 'string', required: true, description: '#hexcolor | title | body' }],
    async run(ctx, a) {
      const parts = a.content.split('|').map((s) => s.trim());
      let color = C.primary;
      if (/^#?[0-9a-f]{6}$/i.test(parts[0])) color = parseInt(parts.shift().replace('#', ''), 16);
      const [title, ...body] = parts;
      await ctx.channel.send({
        ...card({ title, description: body.join('\n') || null, color }),
        allowedMentions: { parse: [] },
      });
      if (ctx.message) ctx.message.delete().catch(() => {});
      else return { ...ok('Card delivered.'), ephemeral: true };
    },
  },
  {
    name: 'joinedat',
    description: 'Find out when someone joined this server',
    guildOnly: true,
    options: [optUser],
    async run(ctx, a) {
      const m = await ctx.getMember(a.user || ctx.user);
      assert(m, 'I can’t find that member in this server.');
      return card({
        description: `📥 **${m.user.username}** joined ${ts(m.joinedAt)} (${ts(m.joinedAt, 'R')}).`,
      });
    },
  },
  {
    name: 'createdat',
    description: 'Find out when a Discord account was born',
    options: [optUser],
    aliases: ['accountage'],
    async run(ctx, a) {
      const u = a.user || ctx.user;
      return card({
        description: `🎂 **${u.username}**’s account was born ${ts(u.createdAt)} (${ts(u.createdAt, 'R')}).`,
      });
    },
  },
  {
    name: 'id',
    description: 'Fish the ID out of a user, role, channel or emoji mention',
    options: [{ name: 'target', type: 'string', description: 'A mention or emoji (defaults to you)' }],
    async run(ctx, a) {
      if (!a.target) return card({ description: `Your ID: \`${ctx.user.id}\`` });
      const ids = a.target.match(/\d{17,20}/g);
      assert(ids, 'I couldn’t spot any mentions or IDs in that.');
      return card({ description: ids.map((i) => `\`${i}\``).join('\n') });
    },
  },
  {
    name: 'permissions',
    description: 'See what a member can do in this channel',
    guildOnly: true,
    aliases: ['perms'],
    options: [optUser],
    async run(ctx, a) {
      const m = await ctx.getMember(a.user || ctx.user);
      assert(m, 'I can’t find that member in this server.');
      const p = m.permissionsIn(ctx.channel).toArray();
      return card({
        title: `Permissions — ${m.user.username}`,
        description: p.includes('Administrator')
          ? '👑 Administrator. Can do anything.'
          : p.map((x) => `✅ ${x.replace(/([a-z])([A-Z])/g, '$1 $2')}`).join('\n') || 'None',
      });
    },
  },
  {
    name: 'inrole',
    description: 'See who’s wearing a role',
    guildOnly: true,
    options: [{ name: 'role', type: 'role', required: true, description: 'The role to list' }],
    async run(ctx, a) {
      await ctx.guild.members.fetch();
      const m = a.role.members;
      return card({
        title: `${a.role.name} (${m.size})`,
        color: a.role.color || C.primary,
        description: m.size
          ? m
              .first(60)
              .map((x) => `${x.user}`)
              .join(' ') + (m.size > 60 ? ` …and ${m.size - 60} more` : '')
          : 'Nobody’s wearing this role.',
      });
    },
  },
  {
    name: 'charinfo',
    description: 'Look up the Unicode code points of characters',
    options: [
      { name: 'text', type: 'string', required: true, description: 'Characters to look up (max 20)' },
    ],
    async run(ctx, a) {
      const chars = [...a.text].slice(0, 20);
      return card({
        title: 'Character info',
        description: chars
          .map((c) => `\`${c}\` → U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`)
          .join('\n'),
      });
    },
  },
  {
    name: 'todo',
    description: 'Add something to your personal to-do list',
    options: [{ name: 'item', type: 'string', required: true, description: 'What needs doing?' }],
    async run(ctx, a) {
      const u = db.user(ctx.user.id);
      assert(u.todos.length < 50, 'Your list is maxed out at 50. Finish something first!');
      u.todos.push(a.item.slice(0, 200));
      db.save();
      return ok(`On the list as #${u.todos.length}.`);
    },
  },
  {
    name: 'todos',
    description: 'Peek at your to-do list',
    aliases: ['todolist'],
    async run(ctx) {
      const t = db.user(ctx.user.id).todos;
      return card({
        title: '📝 To-do',
        description: t.length
          ? t.map((x, i) => `**${i + 1}.** ${x}`).join('\n')
          : 'Nothing here yet. Add something with `todo <item>`.',
      });
    },
  },
  {
    name: 'tododone',
    description: 'Tick an item off your to-do list',
    aliases: ['todoremove'],
    options: [{ name: 'number', type: 'integer', required: true, min: 1, description: 'Which item number?' }],
    async run(ctx, a) {
      const t = db.user(ctx.user.id).todos;
      assert(t[a.number - 1], 'There’s no item with that number.');
      const [x] = t.splice(a.number - 1, 1);
      db.save();
      return ok(`Crossed off: ~~${x}~~`);
    },
  },
  {
    name: 'todoclear',
    description: 'Wipe your to-do list clean',
    async run(ctx) {
      db.user(ctx.user.id).todos = [];
      db.save();
      return ok('Clean slate. To-do list wiped.');
    },
  },
  {
    name: 'tag',
    description: 'Pull up a server tag (a saved text snippet)',
    guildOnly: true,
    aliases: ['t'],
    options: [{ name: 'name', type: 'string', required: true, lower: true, description: 'Tag name' }],
    async run(ctx, a) {
      const t = db.guild(ctx.guild.id).tags[a.name];
      assert(t, `No tag called \`${a.name}\`. Check \`tags\` for the full list.`);
      t.uses = (t.uses || 0) + 1;
      db.save();
      return card({ description: t.content, footer: `Tag: ${a.name}` });
    },
  },
  {
    name: 'tagcreate',
    description: 'Create a new server tag',
    guildOnly: true,
    perms: [P.ManageMessages],
    aliases: ['addtag'],
    options: [
      { name: 'name', type: 'string', required: true, lower: true, description: 'Tag name', rest: false },
      { name: 'content', type: 'string', required: true, description: 'What the tag should say' },
    ],
    async run(ctx, a) {
      const tags = db.guild(ctx.guild.id).tags;
      assert(!tags[a.name], 'That tag already exists. Use tagedit to change it.');
      assert(Object.keys(tags).length < 200, 'Tag limit hit (200). Time for a spring clean.');
      tags[a.name] = { content: a.content.slice(0, 2000), owner: ctx.user.id, uses: 0 };
      db.save();
      return ok(`Tag \`${a.name}\` is live.`);
    },
  },
  {
    name: 'tagedit',
    description: 'Rewrite an existing server tag',
    guildOnly: true,
    perms: [P.ManageMessages],
    options: [
      { name: 'name', type: 'string', required: true, lower: true, description: 'Tag name', rest: false },
      { name: 'content', type: 'string', required: true, description: 'The new content' },
    ],
    async run(ctx, a) {
      const t = db.guild(ctx.guild.id).tags[a.name];
      assert(t, 'That tag doesn’t exist.');
      t.content = a.content.slice(0, 2000);
      db.save();
      return ok(`Tag \`${a.name}\` rewritten.`);
    },
  },
  {
    name: 'tagdelete',
    description: 'Delete a server tag for good',
    guildOnly: true,
    perms: [P.ManageMessages],
    aliases: ['deltag'],
    options: [{ name: 'name', type: 'string', required: true, lower: true, description: 'Tag name' }],
    async run(ctx, a) {
      const tags = db.guild(ctx.guild.id).tags;
      assert(tags[a.name], 'That tag doesn’t exist.');
      delete tags[a.name];
      db.save();
      return ok(`Tag \`${a.name}\` is gone.`);
    },
  },
  {
    name: 'tags',
    description: 'Browse this server’s tags',
    guildOnly: true,
    async run(ctx) {
      const t = Object.keys(db.guild(ctx.guild.id).tags).sort();
      return card({
        title: `Tags (${t.length})`,
        description: t.length
          ? t.map((x) => `\`${x}\``).join(' ')
          : 'No tags yet. Make one with `tagcreate`.',
      });
    },
  },
  {
    name: 'botperms',
    description: 'Check which permissions I have in this channel',
    guildOnly: true,
    async run(ctx) {
      const me = ctx.guild.members.me.permissionsIn(ctx.channel);
      const need = [
        'Administrator',
        'ManageGuild',
        'ManageRoles',
        'ManageChannels',
        'KickMembers',
        'BanMembers',
        'ModerateMembers',
        'ManageMessages',
        'ManageNicknames',
        'ManageGuildExpressions',
        'SendMessages',
        'EmbedLinks',
        'AttachFiles',
        'ReadMessageHistory',
        'MuteMembers',
        'MoveMembers',
      ];
      return card({
        title: 'What I can do here',
        description: chunk(need, 2)
          .map((r) => r.map((p) => `${me.has(p) ? '✅' : '❌'} ${p}`).join('  ·  '))
          .join('\n'),
      });
    },
  },
];
