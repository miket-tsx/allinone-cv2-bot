const { PermissionFlagsBits: P } = require('discord.js');
const db = require('../lib/db');
const { card, ok, C } = require('../lib/ui');
const { assert } = require('../lib/util');
const { fill } = require('../lib/log');

const admin = { guildOnly: true, perms: [P.ManageGuild] };
const chanOpt = { name: 'channel', type: 'channel', required: true, description: 'Which text channel?' };
const textChan = (c) => assert(c.isTextBased(), "That's not a text channel. Try another one?");

module.exports = [
  {
    name: 'setprefix',
    description: 'Change what you type to summon me in this server',
    ...admin,
    options: [
      { name: 'prefix', type: 'string', required: true, description: 'The new prefix (5 characters max)' },
    ],
    async run(ctx, a) {
      assert(
        a.prefix.length <= 5 && !/\s/.test(a.prefix),
        'Keep the prefix to 1-5 characters, and no spaces please.',
      );
      db.guild(ctx.guild.id).prefix = a.prefix;
      db.save();
      return ok(`Done! I'll answer to \`${a.prefix}\` from now on.`);
    },
  },
  {
    name: 'prefix',
    description: 'Check which prefix I answer to here',
    guildOnly: true,
    async run(ctx) {
      return card({
        description: `Around here you can summon me with \`${db.guild(ctx.guild.id).prefix || process.env.DEFAULT_PREFIX || '!'}\`. Slash commands work too, if that's more your style.`,
      });
    },
  },
  {
    name: 'resetprefix',
    description: 'Put the prefix back to the default',
    ...admin,
    async run(ctx) {
      db.guild(ctx.guild.id).prefix = null;
      db.save();
      return ok(`Back to basics: the prefix is \`${process.env.DEFAULT_PREFIX || '!'}\` again.`);
    },
  },
  {
    name: 'setlogs',
    description: 'Pick the channel for moderation and message logs',
    ...admin,
    options: [chanOpt],
    aliases: ['setlog', 'modlog'],
    async run(ctx, a) {
      textChan(a.channel);
      db.guild(ctx.guild.id).logChannel = a.channel.id;
      db.save();
      return ok(`Got it, I'll drop the logs in ${a.channel}.`);
    },
  },
  {
    name: 'disablelogs',
    description: 'Stop logging',
    ...admin,
    async run(ctx) {
      db.guild(ctx.guild.id).logChannel = null;
      db.save();
      return ok("Logging's off. I'll keep quiet about everything now.");
    },
  },
  {
    name: 'setwelcome',
    description: 'Pick the channel where new members get greeted',
    ...admin,
    options: [chanOpt],
    async run(ctx, a) {
      textChan(a.channel);
      db.guild(ctx.guild.id).welcome.channel = a.channel.id;
      db.save();
      return ok(`New arrivals will be greeted in ${a.channel}.`);
    },
  },
  {
    name: 'welcomemessage',
    description: 'Set the welcome text. Variables: {user} {username} {server} {count}',
    ...admin,
    aliases: ['welcomemsg'],
    options: [
      { name: 'message', type: 'string', required: true, description: 'Your welcome message template' },
    ],
    async run(ctx, a) {
      // Stay well under embed description limits once variables expand.
      db.guild(ctx.guild.id).welcome.message = a.message.slice(0, 1500);
      db.save();
      return card({
        title: "Welcome message saved. Here's a sneak peek",
        description: fill(a.message, ctx.member),
        color: C.success,
      });
    },
  },
  {
    name: 'disablewelcome',
    description: 'Stop greeting new members',
    ...admin,
    async run(ctx) {
      db.guild(ctx.guild.id).welcome.channel = null;
      db.save();
      return ok('Welcome messages are off. New folks can find their own way in.');
    },
  },
  {
    name: 'testwelcome',
    description: 'Preview the welcome message using yourself as the guinea pig',
    ...admin,
    async run(ctx) {
      const g = db.guild(ctx.guild.id);
      return card({
        title: 'Welcome! (test run)',
        description: fill(g.welcome.message, ctx.member),
        thumbnail: ctx.user.displayAvatarURL(),
        color: C.success,
        footer: g.welcome.channel
          ? `Will post in #${ctx.guild.channels.cache.get(g.welcome.channel)?.name}`
          : 'No welcome channel set yet',
      });
    },
  },
  {
    name: 'setleave',
    description: 'Pick the channel for goodbye messages',
    ...admin,
    options: [chanOpt],
    aliases: ['setgoodbye'],
    async run(ctx, a) {
      textChan(a.channel);
      db.guild(ctx.guild.id).leave.channel = a.channel.id;
      db.save();
      return ok(`Goodbyes will be posted in ${a.channel}.`);
    },
  },
  {
    name: 'leavemessage',
    description: 'Set the goodbye text. Variables: {user} {username} {server} {count}',
    ...admin,
    aliases: ['leavemsg'],
    options: [
      { name: 'message', type: 'string', required: true, description: 'Your goodbye message template' },
    ],
    async run(ctx, a) {
      db.guild(ctx.guild.id).leave.message = a.message.slice(0, 1500);
      db.save();
      return ok('Goodbye message saved. Parting is such sweet sorrow.');
    },
  },
  {
    name: 'disableleave',
    description: 'Stop posting goodbye messages',
    ...admin,
    async run(ctx) {
      db.guild(ctx.guild.id).leave.channel = null;
      db.save();
      return ok('Leave messages are off. People can slip out quietly now.');
    },
  },
  {
    name: 'autorole',
    description: 'Automatically hand a role to everyone who joins',
    ...admin,
    botPerms: [P.ManageRoles],
    options: [{ name: 'role', type: 'role', required: true, description: 'The role to give on join' }],
    async run(ctx, a) {
      assert(a.role.editable, "I can't hand out that role because it sits above my highest one.");
      assert(!a.role.managed, 'That role belongs to an integration, so I have to leave it alone.');
      db.guild(ctx.guild.id).autorole = a.role.id;
      db.save();
      return ok(`Newcomers will now get ${a.role} automatically.`);
    },
  },
  {
    name: 'disableautorole',
    description: 'Stop auto-assigning a role on join',
    ...admin,
    async run(ctx) {
      db.guild(ctx.guild.id).autorole = null;
      db.save();
      return ok("Autorole's off. New members start with a clean slate.");
    },
  },
  {
    name: 'levelchannel',
    description: 'Where to announce level-ups (leave empty to use the current chat)',
    ...admin,
    options: [{ name: 'channel', type: 'channel', description: 'Which text channel?' }],
    async run(ctx, a) {
      db.guild(ctx.guild.id).levels.channel = a.channel?.id || null;
      db.save();
      return ok(
        a.channel
          ? `Level-ups will be announced in ${a.channel}.`
          : "Level-ups will pop up right where the member's chatting.",
      );
    },
  },
  {
    name: 'togglelevels',
    description: 'Turn the leveling system on or off',
    ...admin,
    async run(ctx) {
      const l = db.guild(ctx.guild.id).levels;
      l.enabled = !l.enabled;
      db.save();
      return ok(`Leveling is now **${l.enabled ? 'enabled' : 'disabled'}**.`);
    },
  },
  {
    name: 'levelrole',
    description: 'Hand out a role as a reward at a certain level',
    ...admin,
    botPerms: [P.ManageRoles],
    options: [
      {
        name: 'level',
        type: 'integer',
        required: true,
        min: 1,
        max: 500,
        description: 'The level to reward',
      },
      { name: 'role', type: 'role', required: true, description: 'The role to give' },
    ],
    async run(ctx, a) {
      assert(a.role.editable, "I can't hand out that role because it sits above my highest one.");
      db.guild(ctx.guild.id).levels.roles[a.level] = a.role.id;
      db.save();
      return ok(`Anyone who hits level **${a.level}** gets ${a.role}.`);
    },
  },
  {
    name: 'removelevelrole',
    description: 'Remove a level role reward',
    ...admin,
    options: [{ name: 'level', type: 'integer', required: true, min: 1, description: 'The level to clear' }],
    async run(ctx, a) {
      const r = db.guild(ctx.guild.id).levels.roles;
      assert(r[a.level], "There's no reward set at that level.");
      delete r[a.level];
      db.save();
      return ok(`The level ${a.level} reward is gone.`);
    },
  },
  {
    name: 'levelroles',
    description: 'See all the level role rewards',
    guildOnly: true,
    async run(ctx) {
      const r = Object.entries(db.guild(ctx.guild.id).levels.roles).sort((a, b) => a[0] - b[0]);
      return card({
        title: '🏆 Level rewards',
        description: r.length
          ? r.map(([l, id]) => `Level **${l}** → <@&${id}>`).join('\n')
          : 'No rewards yet. Set one up with the levelrole command!',
        color: C.level,
      });
    },
  },
  {
    name: 'disablecommand',
    description: 'Switch off a command in this server',
    ...admin,
    options: [
      { name: 'command', type: 'string', required: true, lower: true, description: 'Name of the command' },
    ],
    async run(ctx, a) {
      const name = ctx.client.commands.has(a.command) ? a.command : ctx.client.aliases.get(a.command);
      assert(name, "I don't know a command by that name.");
      // Disabling these would lock admins out of undoing it.
      assert(
        !['disablecommand', 'enablecommand', 'help'].includes(name),
        'Nice try, but that one has to stay on.',
      );
      const d = db.guild(ctx.guild.id).disabled;
      if (!d.includes(name)) d.push(name);
      db.save();
      return ok(`\`${name}\` is now off in this server.`);
    },
  },
  {
    name: 'enablecommand',
    description: 'Turn a disabled command back on',
    ...admin,
    options: [
      { name: 'command', type: 'string', required: true, lower: true, description: 'Name of the command' },
    ],
    async run(ctx, a) {
      const g = db.guild(ctx.guild.id);
      const name = ctx.client.aliases.get(a.command) || a.command;
      g.disabled = g.disabled.filter((x) => x !== name);
      db.save();
      return ok(`\`${name}\` is back in action.`);
    },
  },
  {
    name: 'disabledcommands',
    description: 'See which commands are switched off here',
    guildOnly: true,
    async run(ctx) {
      const d = db.guild(ctx.guild.id).disabled;
      return card({
        title: 'Disabled commands',
        description: d.length
          ? d.map((x) => `\`${x}\``).join(' ')
          : 'Nothing is disabled. Everything is fair game.',
      });
    },
  },
  {
    name: 'settings',
    description: 'Show how I\u2019m set up in this server',
    guildOnly: true,
    aliases: ['config'],
    async run(ctx) {
      const g = db.guild(ctx.guild.id);
      const ch = (id) => (id ? `<#${id}>` : 'Off');
      return card({
        title: `⚙️ Settings — ${ctx.guild.name}`,
        fields: [
          ['Prefix', `\`${g.prefix || process.env.DEFAULT_PREFIX || '!'}\``],
          ['Logs', ch(g.logChannel)],
          ['Welcome', ch(g.welcome.channel)],
          ['Leave', ch(g.leave.channel)],
          ['Autorole', g.autorole ? `<@&${g.autorole}>` : 'Off'],
          ['Leveling', g.levels.enabled ? `On (${Object.keys(g.levels.roles).length} reward roles)` : 'Off'],
          ['Level channel', g.levels.channel ? `<#${g.levels.channel}>` : 'Wherever people chat'],
          ['Disabled commands', String(g.disabled.length)],
        ],
      });
    },
  },
  {
    name: 'resetsettings',
    description: 'Wipe all bot settings for this server (economy and levels stay put)',
    guildOnly: true,
    perms: [P.Administrator],
    async run(ctx) {
      const g = db.guild(ctx.guild.id);
      // Moderation history shouldn't vanish just because someone reset the config.
      const keep = { warns: g.warns, notes: g.notes, tags: g.tags };
      delete db.data.guilds[ctx.guild.id];
      Object.assign(db.guild(ctx.guild.id), keep);
      db.save();
      return ok('All settings are back to their defaults. Fresh start!');
    },
  },
];
