const { PermissionFlagsBits: P } = require('discord.js');
const features = require('../lib/features');
const { card, ok, C } = require('../lib/ui');
const { assert } = require('../lib/util');

const admin = { guildOnly: true, perms: [P.ManageGuild] };

module.exports = [
  {
    name: 'features',
    description: 'See which features and command categories are on in this server',
    ...admin,
    aliases: ['modules'],
    run(ctx) {
      const lines = Object.entries(features.MODULES).map(
        ([k, m]) => `${features.isOn(ctx.guild.id, k) ? '🟢' : '⚫'} **${k}**: ${m.label}`,
      );
      const cats = [...new Set([...ctx.client.commands.values()].map((c) => c.category))]
        .filter((c) => !features.LOCKED_CATEGORIES.has(c))
        .sort()
        .map((c) => `${features.categoryOn(ctx.guild.id, c) ? '🟢' : '⚫'} ${c}`);
      return card({
        title: '🧩 Features',
        description: lines.join('\n'),
        fields: [['Command categories', cats.join('  ')]],
        footer: 'Switch one with: feature <name> <on|off>',
        color: C.info,
      });
    },
  },
  {
    name: 'feature',
    description: 'Switch a feature or a whole command category on or off',
    ...admin,
    aliases: ['module'],
    options: [
      { name: 'name', type: 'string', required: true, lower: true, description: 'Feature or category name (see features)' },
      { name: 'enabled', type: 'boolean', required: true, description: 'on or off' },
    ],
    run(ctx, a) {
      if (features.MODULES[a.name]) {
        features.set(ctx.guild.id, a.name, a.enabled);
        return ok(`**${a.name}** is ${a.enabled ? 'on' : 'off'}.${a.enabled && ['automod', 'antiraid', 'antinuke', 'verification', 'aimod'].includes(a.name) ? ' Check its settings so it does what you expect.' : ''}`);
      }
      const cats = new Set([...ctx.client.commands.values()].map((c) => c.category));
      assert(cats.has(a.name), `There's no feature or category called \`${a.name}\`. Run \`features\` to see the list.`);
      assert(!features.LOCKED_CATEGORIES.has(a.name), `The ${a.name} commands can't be switched off, or you could lock yourself out.`);
      features.set(ctx.guild.id, `cat:${a.name}`, a.enabled);
      return ok(`All **${a.name}** commands are ${a.enabled ? 'back on' : 'off'} in this server.`);
    },
  },
];
