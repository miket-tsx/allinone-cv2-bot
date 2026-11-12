// Everything the AI staff can do, in one catalogue: 100 direct server actions plus every
// bot command. Capabilities are grouped so the model only ever sees the few groups it needs.
const fs = require('fs');
const path = require('path');
const { PermissionsBitField } = require('discord.js');
const { usage } = require('../lib/args');

const GROUP_HINTS = {
  roles: 'create, edit, delete, assign and inspect roles',
  channels: 'create, edit, delete, lock, hide and organise channels and categories',
  members: 'member lookups, kick, ban, timeout, warn, nicknames, voice moderation',
  messages: 'read, post, announce, purge, pin, react, DM members',
  threads: 'create, archive, lock and delete threads',
  server: 'server settings, overview, audit log, pruning',
  emojis: 'custom emojis and stickers',
  invites: 'create, list and revoke invite links',
  webhooks: 'list, create and delete webhooks',
  automod: 'AutoMod word filters and rules',
  knowledge: "remember facts about the server, look things up in the server's own docs and FAQ",
};

const TYPE = { s: 'string', n: 'number', b: 'boolean' };

// "s! Role name" -> required string described as "Role name"
function toSchema(params) {
  const properties = {};
  const required = [];
  for (const [name, spec] of Object.entries(params)) {
    const [, t, bang, desc] = spec.match(/^([snb])(!?)\s+(.*)$/);
    properties[name] = { type: TYPE[t], description: desc };
    if (bang) required.push(name);
  }
  return { type: 'object', properties, required };
}

function loadActions() {
  const dir = path.join(__dirname, 'actions');
  const actions = new Map();
  for (const file of fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .sort()) {
    const group = path.basename(file, '.js');
    for (const a of require(path.join(dir, file))) {
      if (actions.has(a.name)) throw new Error(`AI action "${a.name}" is defined twice`);
      actions.set(a.name, { ...a, group, kind: 'action', perms: a.perms || [], schema: toSchema(a.params) });
    }
  }
  return actions;
}

function build(commands) {
  const actions = loadActions();
  const groups = new Map();
  for (const a of actions.values()) {
    if (!groups.has(a.group))
      groups.set(a.group, { name: a.group, hint: GROUP_HINTS[a.group], actions: [], commands: [] });
    groups.get(a.group).actions.push(a);
  }
  for (const cmd of commands.values()) {
    if (cmd.ownerOnly) continue;
    const name = `cmd_${cmd.category}`;
    if (!groups.has(name))
      groups.set(name, { name, hint: `bot commands: ${cmd.category}`, actions: [], commands: [] });
    groups.get(name).commands.push(cmd);
  }
  // Give each command group a better hint from its own command names
  for (const g of groups.values())
    if (g.commands.length)
      g.hint = `${g.commands.length} ${g.name.slice(4)} commands, e.g. ${g.commands
        .slice(0, 8)
        .map((c) => c.name)
        .join(', ')}`;

  const ownerOnly = [...commands.values()].filter((c) => c.ownerOnly).length;
  return { actions, groups, total: actions.size + commands.size, ownerOnly };
}

// Command groups are exposed as a single tool each, so a 79-command category costs one tool slot.
function commandTool(group) {
  return {
    type: 'function',
    function: {
      name: `run_${group.name.slice(4)}_command`,
      description: `Run one of the bot's ${group.name.slice(4)} commands. The full list with usage is in the system message.`,
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', enum: group.commands.map((c) => c.name) },
          args: {
            type: 'string',
            description: 'Arguments exactly as typed after the command, e.g. "@bob 10m spamming"',
          },
        },
        required: ['command'],
      },
    },
  };
}

const actionTool = (a) => ({
  type: 'function',
  function: { name: a.name, description: a.description, parameters: a.schema },
});

function commandCatalogue(group) {
  return group.commands
    .map(
      (c) =>
        `- ${usage(c, '')}: ${c.description}${c.perms?.length ? ` (needs ${new PermissionsBitField(c.perms).toArray().join(', ')})` : ''}`,
    )
    .join('\n');
}

module.exports = { build, commandTool, actionTool, commandCatalogue, toSchema };
