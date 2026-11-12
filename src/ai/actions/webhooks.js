const { PermissionFlagsBits: P } = require('discord.js');
const r = require('../resolve');

module.exports = [
  {
    name: 'list_webhooks',
    description: 'List the webhooks in the server',
    params: {},
    perms: [P.ManageWebhooks],
    async run(env) {
      const hooks = await env.guild.fetchWebhooks();
      return hooks.size
        ? hooks.map((h) => `${h.name} in #${h.channel?.name ?? '?'} (${h.id})`).join('\n')
        : 'No webhooks.';
    },
  },
  {
    name: 'create_webhook',
    description: 'Create a webhook in a channel. The URL is sent to the requester privately.',
    params: { channel: 's! Channel', name: 's! Webhook name' },
    perms: [P.ManageWebhooks],
    confirm: true,
    async run(env, a) {
      const ch = r.channel(env, a.channel);
      const hook = await ch.createWebhook({ name: a.name, reason: env.reason });
      // The URL is a secret, so it goes to the requester's DMs rather than the channel
      const dm = await env.member
        .send(`Webhook **${hook.name}** for #${ch.name}: ||${hook.url}||`)
        .catch(() => null);
      return `Created webhook ${hook.name}.${dm ? ' I DMed you the URL.' : ' Your DMs are closed, so grab the URL from channel settings.'}`;
    },
  },
  {
    name: 'delete_webhook',
    description: 'Delete a webhook',
    params: { webhook: 's! Webhook name or ID' },
    perms: [P.ManageWebhooks],
    confirm: true,
    danger: true,
    async run(env, a) {
      const hooks = await env.guild.fetchWebhooks();
      const hook =
        hooks.get(r.idOf(a.webhook)) ||
        hooks.find((h) => h.name.toLowerCase() === String(a.webhook).toLowerCase());
      if (!hook) return `No webhook called "${a.webhook}".`;
      await hook.delete(env.reason);
      return `Deleted webhook ${hook.name}.`;
    },
  },
];
