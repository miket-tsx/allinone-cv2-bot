const { PermissionFlagsBits: P, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const db = require('../lib/db');
const { card, ok, C } = require('../lib/ui');
const { assert, ts, shuffle, randInt } = require('../lib/util');
const { RAID_LENGTH } = require('../lib/security');

const admin = { guildOnly: true, perms: [P.ManageGuild] };
const LIMITS = ['channelDelete', 'channelCreate', 'roleDelete', 'roleCreate', 'ban', 'kick', 'webhookCreate'];
const pending = new Map(); // `${guild}:${user}` -> correct captcha answer

const eph = (p) => ({ ...p, flags: (p.flags || 0) | MessageFlags.Ephemeral });

function verifyPanel(guild) {
  const cfg = db.guild(guild.id).verify;
  return card({
    title: `Welcome to ${guild.name}`,
    description:
      cfg.mode === 'captcha'
        ? 'Press the button and solve a quick puzzle to get access to the rest of the server.'
        : 'Press the button below to confirm you are a human and get access to the server.',
    color: C.primary,
    rows: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('verify:start').setLabel('Verify me').setEmoji('✅').setStyle(ButtonStyle.Success),
      ),
    ],
  });
}

async function grant(i) {
  const cfg = db.guild(i.guild.id).verify;
  const role = i.guild.roles.cache.get(cfg.role);
  if (!role) return i.reply(eph(card({ description: "Verification isn't fully set up yet. Ping a mod!", color: C.error })));
  await i.member.roles.add(role, 'Passed verification');
  if (cfg.removeRole) await i.member.roles.remove(cfg.removeRole, 'Passed verification').catch(() => {});
  const p = eph(card({ description: `✅ You're in! Enjoy ${i.guild.name}.`, color: C.success }));
  return i.replied || i.deferred ? i.followUp(p) : i.reply(p);
}

function captcha() {
  const a = randInt(2, 12);
  const b = randInt(2, 12);
  const answer = a + b;
  const options = new Set([answer]);
  while (options.size < 4) options.add(answer + randInt(-6, 6) || answer + 7);
  return { question: `What is **${a} + ${b}**?`, answer, options: shuffle([...options]) };
}

module.exports = [
  {
    name: 'antiraid',
    description: 'See or change anti-raid protection',
    ...admin,
    options: [
      { name: 'enabled', type: 'boolean', description: 'Turn it on or off' },
      { name: 'joins', type: 'integer', min: 3, max: 100, description: 'Joins that count as a raid...' },
      { name: 'seconds', type: 'integer', min: 3, max: 300, description: '...within this many seconds' },
      { name: 'action', type: 'string', lower: true, choices: ['alert', 'timeout', 'kick', 'ban'], description: 'What happens to raiders' },
      { name: 'min_account_days', type: 'integer', min: 0, max: 365, description: 'Kick accounts younger than this (0 = off)' },
    ],
    run(ctx, a) {
      const cfg = db.guild(ctx.guild.id).antiraid;
      for (const k of ['enabled', 'joins', 'seconds', 'action']) if (a[k] !== undefined) cfg[k] = a[k];
      if (a.min_account_days !== undefined) cfg.minAccountDays = a.min_account_days;
      db.save();
      const raiding = cfg.raidUntil > Date.now();
      return card({
        title: `Anti-raid is ${cfg.enabled ? 'on' : 'off'}`,
        color: raiding ? C.error : cfg.enabled ? C.success : C.warn,
        fields: [
          ['Raid means', `${cfg.joins} joins in ${cfg.seconds}s`],
          ['Raiders get', cfg.action],
          ['Minimum account age', cfg.minAccountDays ? `${cfg.minAccountDays} days` : 'Off'],
          ['Raid mode', raiding ? `🚨 active until ${ts(cfg.raidUntil, 't')}` : 'Not active'],
        ],
        footer: 'Alerts go to the moderation log',
      });
    },
  },
  {
    name: 'raidmode',
    description: 'Start or end raid mode by hand',
    ...admin,
    options: [{ name: 'enabled', type: 'boolean', required: true, description: 'on or off' }],
    run(ctx, a) {
      const cfg = db.guild(ctx.guild.id).antiraid;
      cfg.raidUntil = a.enabled ? Date.now() + RAID_LENGTH : 0;
      db.save();
      return a.enabled
        ? ok(`Raid mode is on until ${ts(cfg.raidUntil, 't')}. New joins get: **${cfg.action}**.${cfg.enabled ? '' : ' (Anti-raid itself is off, so turn it on with `antiraid on` for this to do anything.)'}`)
        : ok('Raid mode is off. Back to normal.');
    },
  },
  {
    name: 'antinuke',
    description: 'See or change anti-nuke protection against rogue admins and bots',
    ...admin,
    perms: [P.Administrator],
    options: [
      { name: 'enabled', type: 'boolean', description: 'Turn it on or off' },
      { name: 'punishment', type: 'string', lower: true, choices: ['strip', 'kick', 'ban'], description: 'strip removes their admin roles' },
      { name: 'seconds', type: 'integer', min: 5, max: 600, description: 'Time window for the limits' },
    ],
    run(ctx, a) {
      const cfg = db.guild(ctx.guild.id).antinuke;
      for (const k of ['enabled', 'punishment', 'seconds']) if (a[k] !== undefined) cfg[k] = a[k];
      db.save();
      return card({
        title: `Anti-nuke is ${cfg.enabled ? 'on' : 'off'}`,
        color: cfg.enabled ? C.success : C.warn,
        description: `If anyone except the owner goes over a limit within ${cfg.seconds}s, I'll **${cfg.punishment === 'strip' ? 'strip their admin roles' : cfg.punishment + ' them'}**.`,
        fields: [
          ['Limits', LIMITS.map((k) => `${k}: ${cfg.limits[k]}`).join(', ')],
          ['Trusted', cfg.whitelist.map((id) => `<@${id}>`).join(' ') || 'Nobody yet'],
        ],
        footer: 'My role has to sit above the roles I might need to strip',
      });
    },
  },
  {
    name: 'antinukelimit',
    description: 'Change one anti-nuke limit',
    ...admin,
    perms: [P.Administrator],
    options: [
      { name: 'action', type: 'string', required: true, choices: LIMITS, description: 'Which action' },
      { name: 'limit', type: 'integer', required: true, min: 1, max: 50, description: 'How many before I step in' },
    ],
    run(ctx, a) {
      const key = LIMITS.find((k) => k.toLowerCase() === a.action.toLowerCase());
      db.guild(ctx.guild.id).antinuke.limits[key] = a.limit;
      db.save();
      return ok(`${key} limit is now ${a.limit}.`);
    },
  },
  {
    name: 'antinukewhitelist',
    description: 'Trust or untrust someone so anti-nuke leaves them alone',
    ...admin,
    perms: [P.Administrator],
    options: [{ name: 'user', type: 'user', required: true, description: 'Who' }],
    run(ctx, a) {
      const list = db.guild(ctx.guild.id).antinuke.whitelist;
      const had = list.includes(a.user.id);
      if (had) list.splice(list.indexOf(a.user.id), 1);
      else list.push(a.user.id);
      db.save();
      return ok(had ? `${a.user.username} is no longer trusted.` : `${a.user.username} is trusted. Anti-nuke won't touch them.`);
    },
  },
  {
    name: 'verifysetup',
    description: 'Set up verification: new members press a button to get a role',
    ...admin,
    botPerms: [P.ManageRoles],
    options: [
      { name: 'role', type: 'role', required: true, description: 'Role to give verified members' },
      { name: 'channel', type: 'channel', required: true, description: 'Where the verify button goes' },
      { name: 'mode', type: 'string', lower: true, choices: ['button', 'captcha'], description: 'Plain button, or a quick math captcha' },
      { name: 'remove_role', type: 'role', description: 'Optional "unverified" role to take away' },
    ],
    async run(ctx, a) {
      assert(a.channel.isTextBased(), 'Pick a text channel for the button.');
      assert(a.role.editable, `I can't hand out ${a.role.name}. Move my role above it first.`);
      const cfg = db.guild(ctx.guild.id).verify;
      Object.assign(cfg, { enabled: true, role: a.role.id, channel: a.channel.id, mode: a.mode || 'button', removeRole: a.remove_role?.id || null });
      db.save();
      await a.channel.send(verifyPanel(ctx.guild));
      return ok(
        `Verification is live in ${a.channel}. Passing gives ${a.role}.\n` +
          `To make it actually gate the server, take **View Channels** away from @everyone and give it to ${a.role}. ` +
          `Leave ${a.channel} visible to everyone. Ask me in plain English and I can do that for you.`,
      );
    },
  },
  {
    name: 'verify',
    description: 'Post the verification button again',
    ...admin,
    options: [{ name: 'channel', type: 'channel', description: 'Where to post it (defaults to the configured one)' }],
    async run(ctx, a) {
      const cfg = db.guild(ctx.guild.id).verify;
      assert(cfg.role, 'Run `verifysetup` first.');
      const ch = a.channel || ctx.guild.channels.cache.get(cfg.channel) || ctx.channel;
      await ch.send(verifyPanel(ctx.guild));
      return ok(`Posted it in ${ch}.`);
    },
    async onComponent(i, [step, value]) {
      const cfg = db.guild(i.guild.id).verify;
      if (!cfg.enabled) return i.reply(eph(card({ description: 'Verification is switched off right now.', color: C.warn })));
      if (i.member.roles.cache.has(cfg.role)) return i.reply(eph(card({ description: "You're already verified. 👍" })));
      const key = `${i.guild.id}:${i.user.id}`;
      if (step === 'start') {
        if (cfg.mode !== 'captcha') return grant(i);
        const c = captcha();
        pending.set(key, c.answer);
        const row = new ActionRowBuilder().addComponents(
          c.options.map((n) => new ButtonBuilder().setCustomId(`verify:answer:${n}`).setLabel(String(n)).setStyle(ButtonStyle.Secondary)),
        );
        return i.reply(eph(card({ title: 'Quick check', description: c.question, rows: [row] })));
      }
      if (step === 'answer') {
        const right = pending.get(key);
        pending.delete(key);
        if (right === undefined) return i.update(card({ description: 'That puzzle expired. Press **Verify me** again.', color: C.warn }));
        if (Number(value) !== right) return i.update(card({ description: '❌ Not quite. Press **Verify me** to get a new one.', color: C.error }));
        await i.update(card({ description: 'Correct!', color: C.success }));
        return grant(i);
      }
    },
  },
];
