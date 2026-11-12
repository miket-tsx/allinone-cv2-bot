// Event side of the community features: starboard, reaction roles and temp voice rooms.
// Counting and custom commands hook into messageCreate instead.
const { Events, ChannelType, PermissionFlagsBits: P } = require('discord.js');
const db = require('../lib/db');
const { isOn } = require('../lib/features');
const { card, C, trunc } = require('../lib/ui');
const { emojiKey } = require('../lib/util');

async function full(reaction, user) {
  if (reaction.partial) reaction = await reaction.fetch().catch(() => null);
  if (reaction?.message.partial) await reaction.message.fetch().catch(() => null);
  if (user?.partial) await user.fetch().catch(() => null);
  return reaction;
}

async function reactionRole(reaction, user, adding) {
  const msg = reaction.message;
  const entry = db.guild(msg.guild.id).selfRoles.reactions[msg.id];
  const roleId = entry?.map[emojiKey(reaction.emoji)];
  if (!roleId || !isOn(msg.guild.id, 'selfroles')) return;
  const member = await msg.guild.members.fetch(user.id).catch(() => null);
  if (!member) return;
  if (adding) await member.roles.add(roleId, 'Reaction role').catch(() => {});
  else await member.roles.remove(roleId, 'Reaction role').catch(() => {});
}

function starCard(msg, count, emoji) {
  const image = msg.attachments.find((a) => a.contentType?.startsWith('image/'))?.url;
  return card({
    title: `${emoji} ${count} · #${msg.channel.name}`,
    description: `${trunc(msg.content || '*(no text)*', 1500)}\n\n[Jump to message](${msg.url})`,
    thumbnail: msg.author.displayAvatarURL({ size: 128 }),
    image,
    footer: `${msg.author.username} · ${msg.createdAt.toUTCString()}`,
    color: C.eco,
  });
}

async function starboard(reaction) {
  const msg = reaction.message;
  const cfg = db.guild(msg.guild.id).starboard;
  if (!cfg.channel || !isOn(msg.guild.id, 'starboard') || msg.channel.id === cfg.channel) return;
  if (emojiKey(reaction.emoji) !== emojiKey(cfg.emoji)) return;
  const users = await reaction.users.fetch().catch(() => null);
  if (!users) return;
  const count = users.filter((u) => !u.bot && (cfg.selfStar || u.id !== msg.author.id)).size;
  const board = msg.guild.channels.cache.get(cfg.channel);
  if (!board?.isTextBased()) return;
  const existing = cfg.posts[msg.id];
  const payload = { ...starCard(msg, count, cfg.emoji), allowedMentions: { parse: [] } };
  if (existing) {
    const post = await board.messages.fetch(existing).catch(() => null);
    // Dropped below the line? Take it down, it can come back later
    if (count < cfg.threshold) {
      await post?.delete().catch(() => {});
      delete cfg.posts[msg.id];
    } else await post?.edit(payload).catch(() => {});
  } else if (count >= cfg.threshold) {
    const post = await board.send(payload).catch(() => null);
    if (post) cfg.posts[msg.id] = post.id;
  }
  db.save();
}

module.exports = [
  {
    event: Events.MessageReactionAdd,
    async run(client, r, user) {
      if (user.bot) return;
      const reaction = await full(r, user);
      if (!reaction?.message.guild) return;
      await reactionRole(reaction, user, true);
      await starboard(reaction);
    },
  },
  {
    event: Events.MessageReactionRemove,
    async run(client, r, user) {
      if (user.bot) return;
      const reaction = await full(r, user);
      if (!reaction?.message.guild) return;
      await reactionRole(reaction, user, false);
      await starboard(reaction);
    },
  },
  {
    event: Events.VoiceStateUpdate,
    async run(client, before, after) {
      const guild = after.guild;
      const cfg = db.guild(guild.id).tempvc;
      // Left (or moved out of) a temp room: delete it once it's empty
      if (before.channelId && cfg.active[before.channelId] && before.channelId !== after.channelId) {
        const ch = guild.channels.cache.get(before.channelId);
        if (!ch || ch.members.filter((m) => !m.user.bot).size === 0) {
          await ch?.delete('Temp VC empty').catch(() => {});
          delete cfg.active[before.channelId];
          db.save();
        }
      }
      if (!cfg.hub || after.channelId !== cfg.hub || !isOn(guild.id, 'tempvc')) return;
      const member = after.member;
      // Already own a room? Send them back to it instead of making a second one
      const mine = Object.entries(cfg.active).find(([id, owner]) => owner === member.id && guild.channels.cache.has(id));
      if (mine) return member.voice.setChannel(mine[0]).catch(() => {});
      const room = await guild.channels
        .create({
          name: cfg.name.replaceAll('{user}', member.displayName).slice(0, 90),
          type: ChannelType.GuildVoice,
          parent: cfg.category || after.channel.parentId,
          permissionOverwrites: [{ id: member.id, allow: [P.Connect, P.MoveMembers, P.ManageChannels] }],
          reason: `Temp VC for ${member.user.username}`,
        })
        .catch(() => null);
      if (!room) return;
      cfg.active[room.id] = member.id;
      db.save();
      await member.voice.setChannel(room).catch(async () => {
        await room.delete().catch(() => {});
        delete cfg.active[room.id];
        db.save();
      });
    },
  },
  {
    // Rooms left over from a restart get cleaned up once we're back
    event: Events.ClientReady,
    once: true,
    async run(client) {
      for (const guild of client.guilds.cache.values()) {
        const cfg = db.data.guilds[guild.id]?.tempvc;
        if (!cfg) continue;
        for (const id of Object.keys(cfg.active)) {
          const ch = guild.channels.cache.get(id);
          if (!ch) delete cfg.active[id];
          else if (!ch.members.size) {
            await ch.delete('Temp VC empty').catch(() => {});
            delete cfg.active[id];
          }
        }
      }
      db.save();
    },
  },
];
