// Server-made commands: `ccadd rules Read #rules before posting!` and then `!rules` just works.
// They only fire when no built-in command has the same name.
const { PermissionFlagsBits: P } = require('discord.js');
const db = require('../lib/db');
const { card, ok, C, trunc } = require('../lib/ui');
const { assert, ts } = require('../lib/util');

const admin = { guildOnly: true, perms: [P.ManageGuild] };
const MAX = 100;
const store = (ctx) => db.guild(ctx.guild.id).customCommands;

function clean(name) {
  return String(name).toLowerCase().replace(/^[!/.]/, '');
}

// Turns a custom command's text into the reply. Also used by messageCreate.
function render(cc, message, args) {
  return cc.response
    .replaceAll('{user}', `<@${message.author.id}>`)
    .replaceAll('{username}', message.author.username)
    .replaceAll('{server}', message.guild.name)
    .replaceAll('{channel}', `<#${message.channel.id}>`)
    .replaceAll('{count}', String(message.guild.memberCount))
    .replaceAll('{uses}', String(cc.uses))
    .replaceAll('{args}', args || '');
}

module.exports = [
  {
    name: 'ccadd',
    description: 'Make a custom command for this server',
    ...admin,
    aliases: ['addcc'],
    options: [
      { name: 'name', type: 'string', required: true, description: 'Command name, e.g. rules', rest: false },
      { name: 'response', type: 'string', required: true, description: 'What it says. {user} {server} {channel} {args} work' },
    ],
    run(ctx, a) {
      const name = clean(a.name);
      assert(/^[a-z0-9_-]{1,32}$/.test(name), 'Names can use letters, numbers, - and _ (32 max).');
      assert(!ctx.client.commands.has(name) && !ctx.client.aliases.has(name), `\`${name}\` is already one of my built-in commands.`);
      const list = store(ctx);
      assert(!list[name], `\`${name}\` exists already. Use \`ccedit\` to change it.`);
      assert(Object.keys(list).length < MAX, `You've hit the limit of ${MAX} custom commands.`);
      list[name] = { response: a.response.slice(0, 2000), by: ctx.user.id, uses: 0, created: Date.now() };
      db.save();
      return ok(`Made \`${ctx.prefix}${name}\`. Give it a go!`);
    },
  },
  {
    name: 'ccedit',
    description: 'Change what a custom command says',
    ...admin,
    options: [
      { name: 'name', type: 'string', required: true, description: 'Command name', rest: false },
      { name: 'response', type: 'string', required: true, description: 'New response' },
    ],
    run(ctx, a) {
      const cc = store(ctx)[clean(a.name)];
      assert(cc, 'No custom command with that name.');
      cc.response = a.response.slice(0, 2000);
      db.save();
      return ok('Updated.');
    },
  },
  {
    name: 'ccremove',
    description: 'Delete a custom command',
    ...admin,
    aliases: ['ccdelete', 'delcc'],
    options: [{ name: 'name', type: 'string', required: true, description: 'Command name' }],
    run(ctx, a) {
      const name = clean(a.name);
      assert(store(ctx)[name], 'No custom command with that name.');
      delete store(ctx)[name];
      db.save();
      return ok(`Deleted \`${name}\`.`);
    },
  },
  {
    name: 'cclist',
    description: "List this server's custom commands",
    guildOnly: true,
    aliases: ['customcommands', 'ccs'],
    run(ctx) {
      const list = Object.entries(store(ctx));
      return card({
        title: `🧷 ${list.length} custom command${list.length === 1 ? '' : 's'}`,
        description:
          list
            .sort(([x], [y]) => x.localeCompare(y))
            .map(([n, cc]) => `\`${n}\`: ${trunc(cc.response.replace(/\n/g, ' '), 60)} · ${cc.uses} uses`)
            .join('\n') || 'None yet. Admins can add one with `ccadd`.',
        color: C.info,
      });
    },
  },
  {
    name: 'ccinfo',
    description: 'Details about one custom command',
    guildOnly: true,
    options: [{ name: 'name', type: 'string', required: true, description: 'Command name' }],
    run(ctx, a) {
      const cc = store(ctx)[clean(a.name)];
      assert(cc, 'No custom command with that name.');
      return card({
        title: `${ctx.prefix}${clean(a.name)}`,
        description: cc.response,
        fields: [
          ['Made by', `<@${cc.by}>`],
          ['Created', ts(cc.created, 'R')],
          ['Used', `${cc.uses} times`],
        ],
      });
    },
  },
];

module.exports.render = render;
