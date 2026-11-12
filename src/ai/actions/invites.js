const { PermissionFlagsBits: P } = require('discord.js');
const r = require('../resolve');
const { ts } = require('../../lib/util');

module.exports = [
  {
    name: 'create_invite',
    description: 'Create an invite link',
    params: {
      channel: 's Channel the invite points to (defaults to the current one)',
      hours: 'n Hours until it expires, 0 for never',
      max_uses: 'n Max uses, 0 for unlimited',
    },
    perms: [P.CreateInstantInvite],
    async run(env, a) {
      const ch = r.channel(env, a.channel, { optional: true });
      const inv = await ch.createInvite({
        maxAge: (a.hours ?? 24) * 3600,
        maxUses: a.max_uses ?? 0,
        unique: true,
        reason: env.reason,
      });
      return `Here's the invite: ${inv.url}`;
    },
  },
  {
    name: 'list_invites',
    description: 'List active invite links and how often they were used',
    params: {},
    perms: [P.ManageGuild],
    async run(env) {
      const invites = await env.guild.invites.fetch();
      return invites.size
        ? invites
            .map(
              (i) =>
                `${i.code} by ${i.inviter?.username ?? '?'}: ${i.uses} uses${i.expiresAt ? `, expires ${ts(i.expiresAt, 'R')}` : ''}`,
            )
            .join('\n')
        : 'No active invites.';
    },
  },
  {
    name: 'delete_invite',
    description: 'Revoke an invite link',
    params: { code: 's! Invite code or link' },
    perms: [P.ManageGuild],
    confirm: true,
    async run(env, a) {
      const code = String(a.code).split('/').pop();
      await env.guild.invites.delete(code, env.reason);
      return `Revoked ${code}.`;
    },
  },
  {
    name: 'delete_all_invites',
    description: 'Revoke every invite link, e.g. during a raid',
    params: {},
    perms: [P.ManageGuild],
    confirm: true,
    danger: true,
    async run(env) {
      const invites = await env.guild.invites.fetch();
      for (const inv of invites.values()) await inv.delete(env.reason).catch(() => {});
      return `Revoked ${invites.size} invites.`;
    },
  },
];
