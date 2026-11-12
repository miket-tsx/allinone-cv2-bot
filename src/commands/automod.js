const { PermissionFlagsBits: P } = require('discord.js');
const db = require('../lib/db');
const { card, ok, C } = require('../lib/ui');
const { assert, parseDur, fmtDur, ts } = require('../lib/util');
const { FILTERS, syncNative } = require('../lib/automod');

const admin = { guildOnly: true, perms: [P.ManageGuild] };
const cfgOf = (ctx) => db.guild(ctx.guild.id).automod;

// What each filter's number means, for the status card and the `value` option
const TUNABLE = {
  spam: ['count', 'messages allowed in the window'],
  duplicates: ['count', 'repeats allowed'],
  mentions: ['max', 'mentions per message'],
  caps: ['percent', '% capitals that counts as shouting'],
  emoji: ['max', 'emoji per message'],
  newlines: ['max', 'lines per message'],
};

function describe(name, f) {
  if (!f.on) return 'off';
  if (name === 'spam') return `${f.count} msgs / ${f.seconds}s`;
  if (name === 'duplicates') return `${f.count} repeats / ${f.seconds}s`;
  if (name === 'links') return `allowed: ${f.allow.join(', ') || 'nothing'}`;
  if (name === 'badwords') return `${f.words.length} words`;
  if (name === 'caps') return `${f.percent}%+ caps`;
  const t = TUNABLE[name];
  return t ? `max ${f[t[0]]}` : 'on';
}

module.exports = [
  {
    name: 'automod',
    description: 'See how automod is set up in this server',
    ...admin,
    aliases: ['am'],
    run(ctx) {
      const cfg = cfgOf(ctx);
      return card({
        title: `🛡️ Automod is ${cfg.enabled ? 'on' : 'off'}`,
        color: cfg.enabled ? C.success : C.warn,
        description: Object.entries(cfg.filters)
          .map(([k, f]) => `${f.on ? '🟢' : '⚫'} **${k}**: ${describe(k, f)}`)
          .join('\n'),
        fields: [
          ['Punishments', cfg.punishments.map((p) => `${p.strikes} strikes → ${p.action}${p.duration ? ` ${p.duration}` : ''}`).join(', ') || 'None, only deletes'],
          ['Strikes expire after', `${cfg.decayHours}h`],
          ['Ignored roles', cfg.exemptRoles.map((r) => `<@&${r}>`).join(' ') || 'None'],
          ['Ignored channels', cfg.exemptChannels.map((c) => `<#${c}>`).join(' ') || 'None'],
        ],
        footer: 'People with Manage Messages are never filtered',
      });
    },
  },
  {
    name: 'automodtoggle',
    description: 'Turn automod on or off',
    ...admin,
    options: [{ name: 'enabled', type: 'boolean', required: true, description: 'on or off' }],
    run(ctx, a) {
      cfgOf(ctx).enabled = a.enabled;
      db.save();
      return ok(a.enabled ? 'Automod is on. I\'ll keep an eye on things.' : 'Automod is off.');
    },
  },
  {
    name: 'automodfilter',
    description: 'Switch one automod filter on or off, and optionally tune its limit',
    ...admin,
    options: [
      { name: 'filter', type: 'string', required: true, lower: true, choices: Object.keys(FILTERS), description: 'Which filter' },
      { name: 'enabled', type: 'boolean', required: true, description: 'on or off' },
      { name: 'value', type: 'integer', min: 1, max: 100, description: 'New limit (see automod for what it means)' },
      { name: 'seconds', type: 'integer', min: 2, max: 120, description: 'Time window, for spam and duplicates' },
    ],
    run(ctx, a) {
      const f = cfgOf(ctx).filters[a.filter];
      f.on = a.enabled;
      if (a.value && TUNABLE[a.filter]) f[TUNABLE[a.filter][0]] = a.value;
      if (a.seconds && 'seconds' in f) f.seconds = a.seconds;
      db.save();
      return ok(`**${a.filter}** is ${f.on ? `on (${describe(a.filter, f)})` : 'off'}.`);
    },
  },
  {
    name: 'badword',
    description: 'Add words to the blocklist (comma separated)',
    ...admin,
    aliases: ['blockword'],
    options: [{ name: 'words', type: 'string', required: true, description: 'One or more words, comma separated' }],
    async run(ctx, a) {
      const list = cfgOf(ctx).filters.badwords.words;
      const fresh = a.words.split(',').map((w) => w.trim().toLowerCase()).filter((w) => w && !list.includes(w));
      assert(fresh.length, 'Those are all on the list already.');
      list.push(...fresh);
      db.save();
      // Don't echo slurs back into chat
      ctx.message?.delete().catch(() => {});
      return ok(`Added ${fresh.length} word${fresh.length === 1 ? '' : 's'} to the blocklist (${list.length} total).`);
    },
  },
  {
    name: 'badwordremove',
    description: 'Take words off the blocklist (comma separated)',
    ...admin,
    aliases: ['unblockword'],
    options: [{ name: 'words', type: 'string', required: true, description: 'Words to remove' }],
    run(ctx, a) {
      const f = cfgOf(ctx).filters.badwords;
      const drop = a.words.split(',').map((w) => w.trim().toLowerCase());
      const before = f.words.length;
      f.words = f.words.filter((w) => !drop.includes(w));
      db.save();
      return ok(`Removed ${before - f.words.length}. ${f.words.length} left on the list.`);
    },
  },
  {
    name: 'badwords',
    description: 'See the blocklist (sent privately)',
    ...admin,
    async run(ctx) {
      const words = cfgOf(ctx).filters.badwords.words;
      const body = card({ title: 'Blocked words', description: words.length ? `||${words.join(', ')}||` : 'The list is empty.' });
      if (ctx.isSlash) return { ...body, ephemeral: true };
      const sent = await ctx.user.send(body).catch(() => null);
      return sent ? ok('Sent you the list in DMs.') : card({ description: `${words.length} words on the list. Open your DMs if you want to see them.` });
    },
  },
  {
    name: 'automodallow',
    description: 'Allow links to a website when the links filter is on',
    ...admin,
    options: [{ name: 'domain', type: 'string', required: true, lower: true, description: 'e.g. youtube.com' }],
    run(ctx, a) {
      const allow = cfgOf(ctx).filters.links.allow;
      const d = a.domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      if (allow.includes(d)) {
        allow.splice(allow.indexOf(d), 1);
        db.save();
        return ok(`Links to **${d}** are blocked again.`);
      }
      allow.push(d);
      db.save();
      return ok(`Links to **${d}** are allowed. Run this again to take it back.`);
    },
  },
  {
    name: 'automodignore',
    description: 'Make automod ignore a role or channel (run again to undo)',
    ...admin,
    options: [
      { name: 'role', type: 'role', description: 'Role to ignore' },
      { name: 'channel', type: 'channel', description: 'Channel or category to ignore' },
    ],
    run(ctx, a) {
      const cfg = cfgOf(ctx);
      assert(a.role || a.channel, 'Give me a role or a channel.');
      const toggle = (list, id) => (list.includes(id) ? (list.splice(list.indexOf(id), 1), false) : (list.push(id), true));
      const lines = [];
      if (a.role) lines.push(`${a.role} is ${toggle(cfg.exemptRoles, a.role.id) ? 'now ignored' : 'filtered again'}.`);
      if (a.channel) lines.push(`${a.channel} is ${toggle(cfg.exemptChannels, a.channel.id) ? 'now ignored' : 'filtered again'}.`);
      db.save();
      return ok(lines.join('\n'));
    },
  },
  {
    name: 'automodpunish',
    description: 'Set what happens at a number of strikes (action "none" removes the step)',
    ...admin,
    options: [
      { name: 'strikes', type: 'integer', required: true, min: 1, max: 50, description: 'Strike count' },
      { name: 'action', type: 'string', required: true, lower: true, choices: ['timeout', 'kick', 'ban', 'none'], description: 'What to do' },
      { name: 'duration', type: 'string', description: 'For timeouts, e.g. 10m, 2h, 1d' },
    ],
    run(ctx, a) {
      const cfg = cfgOf(ctx);
      cfg.punishments = cfg.punishments.filter((p) => p.strikes !== a.strikes);
      if (a.action !== 'none') {
        if (a.action === 'timeout') assert(parseDur(a.duration || '10m'), "That duration doesn't look right. Try 10m, 2h or 1d.");
        cfg.punishments.push({ strikes: a.strikes, action: a.action, ...(a.action === 'timeout' ? { duration: a.duration || '10m' } : {}) });
        cfg.punishments.sort((x, y) => x.strikes - y.strikes);
      }
      db.save();
      return ok(a.action === 'none' ? `Nothing happens at ${a.strikes} strikes anymore.` : `At ${a.strikes} strikes: ${a.action}${a.action === 'timeout' ? ` for ${a.duration || '10m'}` : ''}.`);
    },
  },
  {
    name: 'automoddecay',
    description: 'How long strikes stick around before they expire',
    ...admin,
    options: [{ name: 'hours', type: 'integer', required: true, min: 1, max: 720, description: 'Hours' }],
    run(ctx, a) {
      cfgOf(ctx).decayHours = a.hours;
      db.save();
      return ok(`Strikes now expire after ${fmtDur(a.hours * 3600_000)}.`);
    },
  },
  {
    name: 'strikes',
    description: "Check someone's automod strikes",
    guildOnly: true,
    perms: [P.ModerateMembers],
    options: [{ name: 'user', type: 'user', required: true, description: 'Who' }],
    run(ctx, a) {
      const cfg = cfgOf(ctx);
      const cutoff = Date.now() - cfg.decayHours * 3600_000;
      const list = (cfg.strikes[a.user.id] || []).filter((s) => s.at > cutoff);
      return card({
        title: `${a.user.username}: ${list.length} active strike${list.length === 1 ? '' : 's'}`,
        description: list.map((s) => `${ts(s.at, 'R')}: ${s.filter}`).join('\n') || 'Clean record.',
        color: list.length ? C.warn : C.success,
      });
    },
  },
  {
    name: 'clearstrikes',
    description: "Wipe someone's automod strikes",
    guildOnly: true,
    perms: [P.ModerateMembers],
    options: [{ name: 'user', type: 'user', required: true, description: 'Who' }],
    run(ctx, a) {
      delete cfgOf(ctx).strikes[a.user.id];
      db.save();
      return ok(`${a.user.username} has a clean slate.`);
    },
  },
  {
    name: 'automodnative',
    description: "Copy the blocklist and spam limits into Discord's built-in AutoMod",
    ...admin,
    botPerms: [P.ManageGuild],
    defer: true,
    async run(ctx) {
      const done = await syncNative(ctx.guild);
      return ok(`Discord's own AutoMod now covers: ${done.join(', ')}. These keep working even when I'm offline.`);
    },
  },
  {
    name: 'automodsetup',
    description: 'Turn on automod with sensible defaults in one go',
    ...admin,
    defer: true,
    async run(ctx) {
      const cfg = cfgOf(ctx);
      const fresh = db.guildDefaults().automod;
      cfg.enabled = true;
      cfg.filters = { ...fresh.filters, badwords: cfg.filters.badwords, links: cfg.filters.links };
      if (!cfg.punishments.length) cfg.punishments = fresh.punishments;
      db.save();
      const native = await syncNative(ctx.guild).catch(() => null);
      return ok(
        `Automod is on with the defaults: spam, duplicates, mass mentions, invites, caps and emoji walls.\n` +
          (native ? `I also turned on Discord's built-in filters (${native.join(', ')}).` : "I couldn't set up Discord's built-in AutoMod; I need Manage Server for that.") +
          `\nAdd blocked words with \`badword\`, and check everything with \`automod\`.`,
      );
    },
  },
];
