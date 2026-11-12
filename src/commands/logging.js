const { PermissionFlagsBits: P } = require('discord.js');
const db = require('../lib/db');
const { card, ok, C } = require('../lib/ui');
const { assert } = require('../lib/util');
const { LOG_TYPES } = require('../lib/log');

const admin = { guildOnly: true, perms: [P.ManageGuild] };

module.exports = [
  {
    name: 'logs',
    description: 'See where each kind of log goes',
    ...admin,
    run(ctx) {
      const g = db.guild(ctx.guild.id);
      return card({
        title: '📜 Logging',
        description: g.logChannel ? `Main log channel: <#${g.logChannel}>` : 'No main log channel yet. Set one with `setlogs`.',
        fields: [
          ...Object.entries(LOG_TYPES).map(([k, what]) => [
            k,
            `${g.logs[k] ? `<#${g.logs[k]}>` : g.logChannel ? 'main channel' : '*nowhere*'} · ${what}`,
          ]),
          ['Not logged', g.logs.ignored.map((c) => `<#${c}>`).join(' ') || 'Nothing ignored'],
        ],
        color: C.info,
      });
    },
  },
  {
    name: 'logchannel',
    description: 'Send one kind of log to its own channel ("reset" to use the main one)',
    ...admin,
    options: [
      { name: 'type', type: 'string', required: true, lower: true, choices: Object.keys(LOG_TYPES), description: 'Which logs' },
      { name: 'channel', type: 'channel', description: 'Where they go. Leave out to use the main log channel' },
    ],
    run(ctx, a) {
      if (a.channel) assert(a.channel.isTextBased(), 'That has to be a text channel.');
      db.guild(ctx.guild.id).logs[a.type] = a.channel?.id || null;
      db.save();
      return ok(a.channel ? `${a.type} logs now go to ${a.channel}.` : `${a.type} logs go to the main log channel again.`);
    },
  },
  {
    name: 'logignore',
    description: "Stop (or start again) logging a noisy channel's messages",
    ...admin,
    options: [{ name: 'channel', type: 'channel', required: true, description: 'Which channel' }],
    run(ctx, a) {
      const list = db.guild(ctx.guild.id).logs.ignored;
      const had = list.includes(a.channel.id);
      if (had) list.splice(list.indexOf(a.channel.id), 1);
      else list.push(a.channel.id);
      db.save();
      return ok(had ? `I'll log ${a.channel} again.` : `${a.channel} won't show up in the logs anymore.`);
    },
  },
  {
    name: 'logsetup',
    description: 'Create a private logs category with a channel for each kind of log',
    ...admin,
    botPerms: [P.ManageChannels],
    defer: true,
    async run(ctx) {
      const g = db.guild(ctx.guild.id);
      const hidden = [
        { id: ctx.guild.id, deny: [P.ViewChannel] },
        { id: ctx.client.user.id, allow: [P.ViewChannel, P.SendMessages, P.AttachFiles] },
      ];
      const cat = await ctx.guild.channels.create({ name: 'Logs', type: 4, permissionOverwrites: hidden });
      for (const type of Object.keys(LOG_TYPES)) {
        const ch = await ctx.guild.channels.create({ name: `${type}-log`, parent: cat.id, permissionOverwrites: hidden });
        g.logs[type] = ch.id;
      }
      g.logChannel ??= g.logs.moderation;
      db.save();
      return ok(`Made a hidden **Logs** category with ${Object.keys(LOG_TYPES).length} channels. Only admins can see it for now. Give your mod role access if they should too.`);
    },
  },
];
