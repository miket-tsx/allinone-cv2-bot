const { PermissionFlagsBits: P, AuditLogEvent, GuildVerificationLevel: V } = require('discord.js');
const r = require('../resolve');
const { ts } = require('../../lib/util');

const setting = (name, description, params, apply) => ({
  name,
  description,
  params,
  perms: [P.ManageGuild],
  confirm: true,
  run: apply,
});

const LEVELS = { none: V.None, low: V.Low, medium: V.Medium, high: V.High, highest: V.VeryHigh };

module.exports = [
  {
    name: 'server_overview',
    description: 'Overview of the server: owner, size, boosts, channels, roles, settings',
    params: {},
    async run(env) {
      const g = env.guild;
      const owner = await g.fetchOwner().catch(() => null);
      return [
        `${g.name} (${g.id}), owned by ${owner?.user.username ?? 'unknown'}, created ${ts(g.createdAt, 'D')}`,
        `${g.memberCount} members, ${g.channels.cache.size} channels, ${g.roles.cache.size} roles, ${g.emojis.cache.size} emojis`,
        `boost tier ${g.premiumTier} with ${g.premiumSubscriptionCount} boosts`,
        `verification level ${g.verificationLevel}, features: ${g.features.join(', ') || 'none'}`,
        `system channel: ${g.systemChannel?.name ?? 'none'}, afk channel: ${g.afkChannel?.name ?? 'none'}`,
      ].join('\n');
    },
  },
  {
    name: 'audit_log',
    description: 'Show recent audit log entries, i.e. who changed what',
    params: { count: 'n How many, up to 25' },
    perms: [P.ViewAuditLog],
    async run(env, a) {
      const log = await env.guild.fetchAuditLogs({ limit: Math.min(25, a.count || 10) });
      return log.entries
        .map(
          (e) =>
            `${ts(e.createdAt, 'R')} ${e.executor?.username ?? '?'}: ${AuditLogEvent[e.action] ?? e.action} ${e.target?.name ?? e.target?.username ?? ''}${e.reason ? ` (${e.reason})` : ''}`,
        )
        .join('\n');
    },
  },
  setting('rename_server', 'Rename the server', { name: 's! New name' }, async (env, a) => {
    await env.guild.setName(a.name, env.reason);
    return `The server is now called ${a.name}.`;
  }),
  setting(
    'set_server_icon',
    "Change the server's icon from an image URL",
    { url: 's! Image URL' },
    async (env, a) => {
      await env.guild.setIcon(a.url, env.reason);
      return 'Updated the server icon.';
    },
  ),
  setting(
    'set_verification_level',
    'Set how strict new-member verification is',
    { level: 's! none, low, medium, high or highest' },
    async (env, a) => {
      const level = LEVELS[String(a.level).toLowerCase()];
      if (level === undefined) return 'Pick one of: none, low, medium, high, highest.';
      await env.guild.setVerificationLevel(level, env.reason);
      return `Verification level is now ${a.level}.`;
    },
  ),
  setting(
    'set_content_filter',
    'Set the explicit media filter',
    { filter: 's! off, no_roles or everyone' },
    async (env, a) => {
      const value = { off: 0, no_roles: 1, everyone: 2 }[a.filter];
      if (value === undefined) return 'Pick one of: off, no_roles, everyone.';
      await env.guild.setExplicitContentFilter(value, env.reason);
      return `Content filter set to ${a.filter}.`;
    },
  ),
  setting(
    'set_default_notifications',
    'Set whether new members get pinged for every message or only mentions',
    { mode: 's! all or mentions' },
    async (env, a) => {
      await env.guild.setDefaultMessageNotifications(a.mode === 'all' ? 0 : 1, env.reason);
      return `Default notifications: ${a.mode === 'all' ? 'all messages' : 'mentions only'}.`;
    },
  ),
  setting(
    'set_system_channel',
    'Choose where Discord posts join messages and boost notices',
    { channel: 's! Channel, or "none"' },
    async (env, a) => {
      const ch = /^none$/i.test(a.channel) ? null : r.channel(env, a.channel);
      await env.guild.setSystemChannel(ch, env.reason);
      return ch ? `System messages go to #${ch.name}.` : 'System messages are off.';
    },
  ),
  setting(
    'set_afk_channel',
    'Set the AFK voice channel and how long until people get moved there',
    { channel: 's! Voice channel, or "none"', minutes: 'n 1, 5, 15, 30 or 60' },
    async (env, a) => {
      const ch = /^none$/i.test(a.channel) ? null : r.channel(env, a.channel);
      await env.guild.setAFKChannel(ch, env.reason);
      if (a.minutes) await env.guild.setAFKTimeout(a.minutes * 60, env.reason);
      return ch ? `AFK channel is ${ch.name}.` : 'AFK channel removed.';
    },
  ),
  {
    name: 'prune_inactive_members',
    description: 'Kick members with no roles who have not been online for a number of days',
    params: { days: 'n! 1 to 30', dry_run: 'b Only count them, do not kick' },
    perms: [P.KickMembers, P.ManageGuild],
    confirm: true,
    danger: true,
    async run(env, a) {
      const days = Math.min(30, Math.max(1, a.days));
      if (a.dry_run) return `${await env.guild.members.prune({ days, dry: true })} members would be pruned.`;
      const n = await env.guild.members.prune({ days, reason: env.reason });
      return `Pruned ${n} inactive members.`;
    },
  },
];
