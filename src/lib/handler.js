const { PermissionsBitField } = require('discord.js');
const { fail } = require('./ui');
const { UserError } = require('./util');
const { parsePrefix, parseSlash } = require('./args');
const db = require('./db');
const { categoryOn, LOCKED_CATEGORIES } = require('./features');

const cooldowns = new Map();
const OWNERS = (process.env.OWNER_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const permName = (p) =>
  new PermissionsBitField(p)
    .toArray()
    .map((x) => x.replace(/([a-z])([A-Z])/g, '$1 $2'))
    .join(', ');

async function execute(ctx, cmd) {
  try {
    if (cmd.guildOnly && !ctx.guild) return ctx.reply(fail('This one only works in a server, not in DMs.'));
    if (cmd.ownerOnly && !OWNERS.includes(ctx.user.id))
      return ctx.reply(fail('Nice try, but that one is for the bot owner only.'));
    // enable/disable must stay usable, otherwise a server could lock itself out of re-enabling commands
    if (
      ctx.guild &&
      !['enablecommand', 'disablecommand'].includes(cmd.name) &&
      db.guild(ctx.guild.id).disabled.includes(cmd.name)
    ) {
      return ctx.reply(fail('An admin has switched this command off in this server.'));
    }
    if (ctx.guild && !LOCKED_CATEGORIES.has(cmd.category) && !categoryOn(ctx.guild.id, cmd.category))
      return ctx.reply(fail(`The ${cmd.category} commands are switched off in this server.`));
    if (ctx.guild && cmd.perms?.length && !ctx.member.permissions.has(cmd.perms)) {
      return ctx.reply(fail(`You'll need **${permName(cmd.perms)}** to pull that off.`));
    }
    if (ctx.guild && cmd.botPerms?.length) {
      const me = ctx.guild.members.me;
      if (!me.permissionsIn(ctx.channel).has(cmd.botPerms))
        return ctx.reply(
          fail(`I can't do that without **${permName(cmd.botPerms)}**. Mind sorting that out?`),
        );
    }
    const cd = (cmd.cooldown ?? 2) * 1000;
    const key = `${cmd.name}:${ctx.user.id}`;
    const now = Date.now();
    if (cooldowns.get(key) > now)
      return ctx.reply(
        fail(`Easy there, speedy. Try again in ${((cooldowns.get(key) - now) / 1000).toFixed(1)}s.`),
      );
    cooldowns.set(key, now + cd);

    const args = ctx.isSlash ? parseSlash(ctx, cmd) : await parsePrefix(ctx, cmd, ctx.rawArgs || '');
    // slash interactions expire after 3s, so defer slow commands up front
    if (cmd.defer && ctx.isSlash && !ctx.interaction.deferred) await ctx.interaction.deferReply();
    else if (cmd.defer && !ctx.isSlash) ctx.channel.sendTyping().catch(() => {});
    const out = await cmd.run(ctx, args);
    if (out !== undefined && out !== null) await ctx.reply(out);
  } catch (e) {
    if (e instanceof UserError) return ctx.reply(fail(e.message)).catch(() => {});
    if (e?.code === 50013)
      return ctx
        .reply(
          fail(
            "Discord says I'm not allowed to do that. Check my role position and the channel permissions.",
          ),
        )
        .catch(() => {});
    console.error(`[cmd:${cmd.name}]`, e);
    return ctx
      .reply(fail('Well, that went sideways. Something broke on my end, so try again in a bit.'))
      .catch(() => {});
  }
}

module.exports = { execute, OWNERS, permName };
