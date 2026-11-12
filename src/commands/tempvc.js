// Join-to-create voice: join the hub channel and you get your own room, which disappears
// once everyone leaves. The owner can rename, lock, cap or kick people from it.
const { PermissionFlagsBits: P, ChannelType } = require('discord.js');
const db = require('../lib/db');
const { ok } = require('../lib/ui');
const { assert } = require('../lib/util');

const admin = { guildOnly: true, perms: [P.ManageGuild], botPerms: [P.ManageChannels, P.MoveMembers] };

// The room you're sitting in, and only if it's yours (or you're staff)
function myRoom(ctx) {
  const cfg = db.guild(ctx.guild.id).tempvc;
  const ch = ctx.member.voice?.channel;
  assert(ch && cfg.active[ch.id], 'Hop into your temporary voice channel first.');
  assert(cfg.active[ch.id] === ctx.user.id || ctx.member.permissions.has(P.ManageChannels), "That room isn't yours.");
  return ch;
}

module.exports = [
  {
    name: 'tempvcsetup',
    description: 'Create a "Join to create" voice channel',
    ...admin,
    options: [
      { name: 'category', type: 'channel', description: 'Category for the rooms (defaults to a new one)' },
      { name: 'name', type: 'string', description: "Room name, {user} is the owner. Default: {user}'s room" },
    ],
    async run(ctx, a) {
      const cfg = db.guild(ctx.guild.id).tempvc;
      let category = a.category;
      if (category) assert(category.type === ChannelType.GuildCategory, 'That needs to be a category.');
      category ??= await ctx.guild.channels.create({ name: 'Voice rooms', type: ChannelType.GuildCategory });
      const hub = await ctx.guild.channels.create({ name: '➕ Join to create', type: ChannelType.GuildVoice, parent: category.id });
      Object.assign(cfg, { hub: hub.id, category: category.id });
      if (a.name) cfg.name = a.name.slice(0, 90);
      db.save();
      return ok(`Done. Joining ${hub} now makes a private room in **${category.name}**, which goes away when it's empty.`);
    },
  },
  {
    name: 'tempvcoff',
    description: 'Turn off temporary voice channels',
    ...admin,
    async run(ctx) {
      const cfg = db.guild(ctx.guild.id).tempvc;
      await ctx.guild.channels.cache.get(cfg.hub)?.delete('Temp VCs turned off').catch(() => {});
      cfg.hub = null;
      db.save();
      return ok("Temp VCs are off. Rooms that are in use stay until they're empty.");
    },
  },
  {
    name: 'roomrename',
    description: 'Rename your temporary voice channel',
    guildOnly: true,
    cooldown: 10,
    options: [{ name: 'name', type: 'string', required: true, description: 'New name' }],
    async run(ctx, a) {
      const ch = myRoom(ctx);
      await ch.setName(a.name.slice(0, 90));
      return ok(`Renamed to **${ch.name}**. (Discord only allows 2 renames per 10 minutes.)`);
    },
  },
  {
    name: 'roomlimit',
    description: 'Cap how many people can join your room (0 = no limit)',
    guildOnly: true,
    options: [{ name: 'limit', type: 'integer', required: true, min: 0, max: 99, description: 'Max people' }],
    async run(ctx, a) {
      const ch = myRoom(ctx);
      await ch.setUserLimit(a.limit);
      return ok(a.limit ? `Room capped at ${a.limit}.` : 'No limit anymore.');
    },
  },
  {
    name: 'roomlock',
    description: 'Lock your room so nobody new can join',
    guildOnly: true,
    async run(ctx) {
      const ch = myRoom(ctx);
      await ch.permissionOverwrites.edit(ctx.guild.id, { Connect: false });
      await ch.permissionOverwrites.edit(ctx.user.id, { Connect: true });
      return ok('🔒 Locked. Use `roomunlock` to open it again.');
    },
  },
  {
    name: 'roomunlock',
    description: 'Unlock your room',
    guildOnly: true,
    async run(ctx) {
      const ch = myRoom(ctx);
      await ch.permissionOverwrites.edit(ctx.guild.id, { Connect: null });
      return ok('🔓 Unlocked.');
    },
  },
  {
    name: 'roomkick',
    description: 'Kick someone out of your temporary voice room',
    guildOnly: true,
    options: [{ name: 'user', type: 'user', required: true, description: 'Who' }],
    async run(ctx, a) {
      const ch = myRoom(ctx);
      const target = ch.members.get(a.user.id);
      assert(target, "They're not in your room.");
      assert(target.id !== ctx.user.id, "You can't kick yourself, just leave. 😄");
      await target.voice.disconnect('Kicked from temp VC by its owner');
      await ch.permissionOverwrites.edit(target.id, { Connect: false });
      return ok(`${target.displayName} is out and can't rejoin this room.`);
    },
  },
];
