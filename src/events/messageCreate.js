const { Events } = require('discord.js');
const db = require('../lib/db');
const { Ctx } = require('../lib/context');
const { execute } = require('../lib/handler');
const { card, C } = require('../lib/ui');
const levels = require('../lib/levels');
const aiStaff = require('../ai/agent');
const { ts } = require('../lib/util');
const automod = require('../lib/automod');
const counting = require('../lib/counting');
const guard = require('../ai/guard');
const { isOn } = require('../lib/features');
const custom = require('../commands/customcommands');

const DEFAULT_PREFIX = process.env.DEFAULT_PREFIX || '!';

module.exports = {
  event: Events.MessageCreate,
  async run(client, message) {
    if (message.author.bot || message.webhookId) return;
    const prefix = (message.guild && db.guild(message.guild.id).prefix) || DEFAULT_PREFIX;
    const content = message.content || '';

    if (message.guild) {
      // Automod goes first: a deleted message shouldn't earn XP, count or trigger anything else
      if (await automod.check(message).catch((e) => console.error('[automod]', e))) return;
      if (await counting.check(message).catch((e) => console.error('[counting]', e))) return;
      // AI moderation runs in the background, it's slower and never blocks commands
      guard.moderate(message).catch(() => {});
      // Skip the clear when they're running the afk command itself, otherwise it'd undo the status they're setting
      const me = db.user(message.author.id);
      if (me.afk && !content.toLowerCase().startsWith(prefix + 'afk')) {
        me.afk = null;
        db.save();
        message
          .reply({
            ...card({
              description: `👋 Welcome back ${message.author}! I've cleared your AFK, so you're officially among the living again.`,
              color: C.info,
            }),
            allowedMentions: { repliedUser: false },
          })
          .then((m) => setTimeout(() => m.delete().catch(() => {}), 8000))
          .catch(() => {});
      }
      // Capped at 3 so a mass-ping doesn't turn this into a wall of text
      const afkHits = message.mentions.users.filter((u) => db.data.users[u.id]?.afk).first(3);
      if (afkHits.length) {
        const lines = afkHits.map((u) => {
          const a = db.data.users[u.id].afk;
          return `💤 **${u.username}** is away right now: ${a.reason} — ${ts(a.since, 'R')}`;
        });
        message
          .reply({
            ...card({ description: lines.join('\n'), color: C.info }),
            allowedMentions: { repliedUser: false },
          })
          .catch(() => {});
      }
      levels.onMessage(message).catch(() => {});
    }

    let used = null;
    const mention = new RegExp(`^<@!?${client.user.id}>\\s*`);
    if (content.startsWith(prefix)) used = prefix;
    else if (mention.test(content)) used = content.match(mention)[0];
    if (!used) return;
    const body = content.slice(used.length).trim();
    if (!body && used !== prefix) {
      return message.reply({
        ...card({
          description: `👋 Hey, you rang? My prefix here is \`${prefix}\`. Try \`${prefix}help\` or \`/help\` to see what I can do, or just mention me and ask for something in plain English.`,
        }),
        allowedMentions: { repliedUser: false },
      });
    }
    // With a Groq key set, mentions are plain-English requests for the AI staff, which can
    // still run any command itself. The prefix keeps working as a direct shortcut.
    const aiOn = !message.guild || isOn(message.guild.id, 'ai');
    if (used !== prefix && process.env.GROQ_API_KEY && aiOn) return aiStaff.handle(client, message, body);
    const name = body.split(/\s+/)[0]?.toLowerCase();
    if (!name) return;
    const cmd = client.commands.get(name) || client.commands.get(client.aliases.get(name));
    // "@bot can you set up some roles?" isn't a command, so it goes to the AI staff instead
    if (!cmd) {
      // Server-made custom commands only get a look-in when no built-in has the name
      const cc = message.guild && db.guild(message.guild.id).customCommands[name];
      if (cc && isOn(message.guild.id, 'customcommands')) {
        cc.uses++;
        db.save();
        const args = body.slice(name.length).trim();
        return message.channel
          .send({ ...card({ description: custom.render(cc, message, args), color: C.info }), allowedMentions: { parse: ['users'] } })
          .catch(() => {});
      }
      if (used !== prefix && aiOn) await aiStaff.handle(client, message, body);
      return;
    }
    const ctx = new Ctx({
      client,
      message,
      prefix: used === prefix ? prefix : `@${client.user.username} `,
      commandName: name,
    });
    ctx.rawArgs = body.slice(body.split(/\s+/)[0].length).trim();
    await execute(ctx, cmd);
  },
};
