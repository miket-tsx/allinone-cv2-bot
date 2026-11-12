const { PermissionFlagsBits: P } = require('discord.js');
const r = require('../resolve');
const { UserError } = require('../../lib/util');

const thread = (env, ref) => {
  const t = r.channel(env, ref, { optional: true });
  if (!t.isThread()) throw new UserError(`#${t.name} isn't a thread.`);
  return t;
};

const threadToggle = (name, description, apply) => ({
  name,
  description,
  params: { thread: 's Thread (defaults to the current one)' },
  perms: [P.ManageThreads],
  confirm: true,
  async run(env, a) {
    const t = thread(env, a.thread);
    await apply(t, env.reason);
    return `Done with #${t.name}.`;
  },
});

module.exports = [
  {
    name: 'list_threads',
    description: 'List the active threads in the server',
    params: {},
    async run(env) {
      const { threads } = await env.guild.channels.fetchActiveThreads();
      return threads.size
        ? threads.map((t) => `#${t.name} in #${t.parent?.name}`).join('\n')
        : 'No active threads.';
    },
  },
  {
    name: 'create_thread',
    description: 'Start a new thread in a text channel',
    params: { name: 's! Thread name', channel: 's Channel to start it in', private: 'b Private thread' },
    perms: [P.CreatePublicThreads],
    confirm: true,
    async run(env, a) {
      const ch = r.channel(env, a.channel, { optional: true });
      const t = await ch.threads.create({ name: a.name, type: a.private ? 12 : 11, reason: env.reason });
      return `Started thread #${t.name}.`;
    },
  },
  threadToggle('archive_thread', 'Archive a thread', (t, reason) => t.setArchived(true, reason)),
  threadToggle('unarchive_thread', 'Bring an archived thread back', (t, reason) =>
    t.setArchived(false, reason),
  ),
  threadToggle('lock_thread', 'Lock a thread so only mods can reply', (t, reason) =>
    t.setLocked(true, reason),
  ),
  {
    name: 'delete_thread',
    description: 'Delete a thread',
    params: { thread: 's! Thread name' },
    perms: [P.ManageThreads],
    confirm: true,
    danger: true,
    async run(env, a) {
      const t = thread(env, a.thread);
      await t.delete(env.reason);
      return `Deleted thread #${t.name}.`;
    },
  },
];
