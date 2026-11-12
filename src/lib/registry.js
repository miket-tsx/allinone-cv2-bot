// Loads and validates every command module, and builds slash JSON for the curated slash list.
const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const SLASH = require('../slash');

function loadCommands() {
  const dir = path.join(__dirname, '..', 'commands');
  const commands = new Map();
  const aliases = new Map();
  for (const f of fs
    .readdirSync(dir)
    .filter((x) => x.endsWith('.js'))
    .sort()) {
    const list = require(path.join(dir, f));
    const category = path.basename(f, '.js');
    for (const cmd of list) {
      cmd.category ??= category;
      cmd.options ??= [];
      cmd.aliases ??= [];
      if (!/^[a-z0-9_-]{1,32}$/.test(cmd.name))
        throw new Error(
          `"${cmd.name}" in ${f} isn't a valid command name (lowercase letters, numbers, - and _ only, 32 max)`,
        );
      if (!cmd.description || cmd.description.length > 100)
        throw new Error(`Command ${cmd.name} needs a description, and it has to stay under 100 chars`);
      if (typeof cmd.run !== 'function')
        throw new Error(`Command ${cmd.name} has no run() — it kind of needs one`);
      if (commands.has(cmd.name) || aliases.has(cmd.name))
        throw new Error(`"${cmd.name}" is already taken — spotted the duplicate in ${f}`);
      commands.set(cmd.name, cmd);
      for (const a of cmd.aliases) {
        if (commands.has(a) || aliases.has(a))
          throw new Error(`Alias "${a}" on ${cmd.name} is already used by another command or alias`);
        aliases.set(a, cmd.name);
      }
    }
  }
  // Commands load in file order, so an alias can slip in before a command with the same name
  for (const a of aliases.keys())
    if (commands.has(a)) throw new Error(`Alias "${a}" is stepping on a command with the same name`);
  return { commands, aliases };
}

function addOptions(b, cmd) {
  let seenOptional = false;
  for (const o of cmd.options) {
    if (o.required && seenOptional)
      throw new Error(
        `Slash ${cmd.name}: required option "${o.name}" can't come after an optional one, Discord won't allow it`,
      );
    if (!o.required) seenOptional = true;
    const set = (x) => {
      x.setName(o.name).setDescription(o.description.slice(0, 100)).setRequired(!!o.required);
      if (o.choices && x.addChoices)
        x.addChoices(
          ...o.choices.slice(0, 25).map((c) => ({
            name: String(c),
            value: o.type === 'integer' || o.type === 'number' ? Number(c) : String(c),
          })),
        );
      if (o.min !== undefined && x.setMinValue) x.setMinValue(o.min);
      if (o.max !== undefined && x.setMaxValue) x.setMaxValue(o.max);
      return x;
    };
    switch (o.type || 'string') {
      case 'user':
        b.addUserOption(set);
        break;
      case 'integer':
        b.addIntegerOption(set);
        break;
      case 'number':
        b.addNumberOption(set);
        break;
      case 'boolean':
        b.addBooleanOption(set);
        break;
      case 'channel':
        b.addChannelOption(set);
        break;
      case 'role':
        b.addRoleOption(set);
        break;
      default:
        b.addStringOption(set);
    }
  }
  return b;
}

function buildSlash(cmd) {
  const b = new SlashCommandBuilder().setName(cmd.name).setDescription(cmd.description);
  if (cmd.perms?.length) b.setDefaultMemberPermissions(new PermissionsBitField(cmd.perms).bitfield);
  if (cmd.guildOnly) b.setContexts(0); // 0 = guild context only
  return addOptions(b, cmd).toJSON();
}

// A group becomes one slash command with a subcommand per prefix command. Permissions are
// still checked per subcommand by the handler, since Discord can only gate the whole group.
function buildGroup(entry, commands) {
  const b = new SlashCommandBuilder().setName(entry.name).setDescription(entry.description).setContexts(0);
  for (const [sub, cmdName] of Object.entries(entry.sub)) {
    const cmd = commands.get(cmdName);
    b.addSubcommand((s) => addOptions(s.setName(sub).setDescription(cmd.description), cmd));
  }
  return b.toJSON();
}

const entryNames = (e) => (typeof e === 'string' ? [e] : Object.values(e.sub));

function slashCommands(commands) {
  const missing = SLASH.flatMap(entryNames).filter((n) => !commands.has(n));
  if (missing.length) throw new Error(`Slash list mentions commands that don't exist: ${missing.join(', ')}`);
  const top = SLASH.map((e) => (typeof e === 'string' ? e : e.name));
  if (new Set(top).size !== top.length) throw new Error('Slash list has duplicate entries, each command only gets one slot');
  for (const e of SLASH)
    if (typeof e !== 'string' && Object.keys(e.sub).length > 25) throw new Error(`/${e.name} has more than 25 subcommands`);
  return SLASH.map((e) => (typeof e === 'string' ? buildSlash(commands.get(e)) : buildGroup(e, commands)));
}

// "/automod filter" for a grouped command, "/ping" for a plain one, null when it's prefix only
const slashLabels = new Map();
for (const e of SLASH) {
  if (typeof e === 'string') slashLabels.set(e, `/${e}`);
  else for (const [sub, cmd] of Object.entries(e.sub)) if (!slashLabels.has(cmd)) slashLabels.set(cmd, `/${e.name} ${sub}`);
}
const slashLabel = (name) => slashLabels.get(name) || null;

// Which prefix command an incoming slash interaction means
function resolveSlash(interaction) {
  const entry = SLASH.find((e) => (typeof e === 'string' ? e : e.name) === interaction.commandName);
  if (!entry) return null;
  if (typeof entry === 'string') return entry;
  return entry.sub[interaction.options.getSubcommand(false)] || null;
}

module.exports = { loadCommands, buildSlash, slashCommands, slashLabel, resolveSlash, SLASH };
