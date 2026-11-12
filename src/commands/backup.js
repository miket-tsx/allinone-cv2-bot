// Server backups: roles, categories, channels, permission overrides and basic settings.
// Restoring only *adds* what's missing (matched by name). It never deletes or overwrites
// anything, so running it on a healthy server does nothing scary.
const {
  PermissionFlagsBits: P,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  MessageFlags,
} = require('discord.js');
const db = require('../lib/db');
const { card, ok, C } = require('../lib/ui');
const { assert, ts } = require('../lib/util');

const admin = { guildOnly: true, perms: [P.Administrator] };
const KEEP = 10;
const newId = () => Math.random().toString(36).slice(2, 8);
const mine = (guildId) => db.data.backups.filter((b) => b.guildId === guildId);
const COPY_TYPES = [ChannelType.GuildCategory, ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildAnnouncement, ChannelType.GuildStageVoice, ChannelType.GuildForum];

function snapshot(guild) {
  const roleName = (id) => (id === guild.id ? '@everyone' : guild.roles.cache.get(id)?.name);
  const roles = guild.roles.cache
    .filter((r) => !r.managed && r.id !== guild.id)
    .sort((a, b) => b.position - a.position)
    .map((r) => ({ name: r.name, color: r.color, hoist: r.hoist, mentionable: r.mentionable, permissions: r.permissions.bitfield.toString() }));
  const channels = guild.channels.cache
    .filter((c) => COPY_TYPES.includes(c.type))
    .sort((a, b) => (a.type === ChannelType.GuildCategory ? -1 : 0) - (b.type === ChannelType.GuildCategory ? -1 : 0) || a.rawPosition - b.rawPosition)
    .map((c) => ({
      name: c.name,
      type: c.type,
      parent: c.parent?.name || null,
      topic: c.topic || null,
      nsfw: !!c.nsfw,
      slowmode: c.rateLimitPerUser || 0,
      userLimit: c.userLimit || 0,
      // Member-specific overrides are skipped: people come and go, roles are what matters
      overwrites: c.permissionOverwrites.cache
        .filter((o) => o.type === 0 && roleName(o.id))
        .map((o) => ({ role: roleName(o.id), allow: o.allow.bitfield.toString(), deny: o.deny.bitfield.toString() })),
    }));
  return {
    name: guild.name,
    settings: {
      verificationLevel: guild.verificationLevel,
      explicitContentFilter: guild.explicitContentFilter,
      defaultMessageNotifications: guild.defaultMessageNotifications,
      afkTimeout: guild.afkTimeout,
    },
    everyone: guild.roles.everyone.permissions.bitfield.toString(),
    roles,
    channels,
  };
}

// Works out what restore would create, without touching anything
function diff(guild, data) {
  const roleNames = new Set(guild.roles.cache.map((r) => r.name));
  const key = (c) => `${c.type}:${c.parent || ''}:${c.name}`;
  const existing = new Set(guild.channels.cache.map((c) => key({ type: c.type, parent: c.parent?.name, name: c.name })));
  return {
    roles: data.roles.filter((r) => !roleNames.has(r.name)),
    channels: data.channels.filter((c) => !existing.has(key(c))),
  };
}

async function restore(guild, data, reason) {
  const todo = diff(guild, data);
  let roles = 0;
  let channels = 0;
  const failed = [];
  for (const r of todo.roles.slice(0, 100)) {
    await guild.roles
      .create({ name: r.name, color: r.color, hoist: r.hoist, mentionable: r.mentionable, permissions: BigInt(r.permissions), reason })
      .then(() => roles++)
      .catch(() => failed.push(`role ${r.name}`));
  }
  const roleId = (name) => (name === '@everyone' ? guild.id : guild.roles.cache.find((r) => r.name === name)?.id);
  // Categories first so channels have somewhere to go
  const ordered = [...todo.channels].sort((a, b) => (b.type === ChannelType.GuildCategory) - (a.type === ChannelType.GuildCategory));
  for (const c of ordered.slice(0, 200)) {
    const parent = c.parent ? guild.channels.cache.find((x) => x.type === ChannelType.GuildCategory && x.name === c.parent)?.id : null;
    await guild.channels
      .create({
        name: c.name,
        type: c.type,
        parent,
        topic: c.topic || undefined,
        nsfw: c.nsfw,
        rateLimitPerUser: c.slowmode || undefined,
        userLimit: c.userLimit || undefined,
        permissionOverwrites: c.overwrites
          .map((o) => ({ id: roleId(o.role), allow: BigInt(o.allow), deny: BigInt(o.deny) }))
          .filter((o) => o.id),
        reason,
      })
      .then(() => channels++)
      .catch(() => failed.push(`#${c.name}`));
  }
  return { roles, channels, failed };
}

const eph = (p) => ({ ...p, flags: (p.flags || 0) | MessageFlags.Ephemeral });

// Restore buttons. Their custom IDs start with backup:, so they land here
async function onRestoreClick(i, [action, id, userId]) {
  if (i.user.id !== userId) return i.reply(eph(card({ description: 'Only the person who asked can press that.', color: C.warn })));
  if (action === 'cancel') return i.update(card({ description: 'Cancelled. Nothing changed.' }));
  if (!i.member.permissions.has(P.Administrator)) return i.reply(eph(card({ description: 'You need Administrator for that.', color: C.warn })));
  const b = mine(i.guild.id).find((x) => x.id === id);
  if (!b) return i.update(card({ description: 'That backup is gone.', color: C.error }));
  await i.update(card({ description: '⏳ Restoring… this can take a minute with lots of channels.' }));
  const r = await restore(i.guild, b.data, `Backup ${b.id} restored by ${i.user.username}`);
  return i.editReply(
    card({
      description: `✅ Restored ${r.roles} roles and ${r.channels} channels.${r.failed.length ? `\nCouldn't make: ${r.failed.slice(0, 15).join(', ')}` : ''}`,
      color: r.failed.length ? C.warn : C.success,
    }),
  );
}

module.exports = [
  {
    name: 'backup',
    description: 'Save a backup of the roles, channels and permissions',
    ...admin,
    cooldown: 30,
    onComponent: onRestoreClick,
    run(ctx) {
      const list = mine(ctx.guild.id);
      const data = snapshot(ctx.guild);
      const b = { id: newId(), guildId: ctx.guild.id, at: Date.now(), by: ctx.user.id, data };
      db.data.backups.push(b);
      // Only the newest few per server are kept
      if (list.length + 1 > KEEP) {
        const drop = new Set(list.sort((x, y) => x.at - y.at).slice(0, list.length + 1 - KEEP).map((x) => x.id));
        db.data.backups = db.data.backups.filter((x) => !(x.guildId === ctx.guild.id && drop.has(x.id)));
      }
      db.save();
      return ok(`Backup \`${b.id}\` saved: ${data.roles.length} roles and ${data.channels.length} channels. I keep the last ${KEEP}.`);
    },
  },
  {
    name: 'backups',
    description: 'List the saved backups',
    ...admin,
    run(ctx) {
      const list = mine(ctx.guild.id).sort((a, b) => b.at - a.at);
      return card({
        title: `💾 ${list.length} backup${list.length === 1 ? '' : 's'}`,
        description: list.map((b) => `\`${b.id}\` ${ts(b.at, 'R')} by <@${b.by}>: ${b.data.roles.length} roles, ${b.data.channels.length} channels`).join('\n') || 'None yet. Make one with `backup`.',
      });
    },
  },
  {
    name: 'backuprestore',
    description: 'Recreate roles and channels from a backup that are missing now',
    ...admin,
    botPerms: [P.ManageRoles, P.ManageChannels],
    options: [{ name: 'id', type: 'string', required: true, description: 'Backup ID from backups' }],
    run(ctx, a) {
      const b = mine(ctx.guild.id).find((x) => x.id === a.id);
      assert(b, 'No backup with that ID.');
      const todo = diff(ctx.guild, b.data);
      assert(todo.roles.length || todo.channels.length, 'Nothing is missing. Everything in that backup is still here.');
      return card({
        title: `Restore backup ${b.id}?`,
        description:
          `This creates **${todo.roles.length} roles** and **${todo.channels.length} channels** that are in the backup but not here now. ` +
          "Nothing gets deleted or overwritten. Messages can't be restored, Discord doesn't allow that.",
        fields: [
          ['Roles', todo.roles.slice(0, 15).map((r) => r.name).join(', ') + (todo.roles.length > 15 ? '…' : '')],
          ['Channels', todo.channels.slice(0, 15).map((c) => c.name).join(', ') + (todo.channels.length > 15 ? '…' : '')],
        ],
        color: C.warn,
        rows: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`backup:go:${b.id}:${ctx.user.id}`).setLabel('Restore').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`backup:cancel:${b.id}:${ctx.user.id}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary),
          ),
        ],
      });
    },
  },
  {
    name: 'backupdelete',
    description: 'Delete a saved backup',
    ...admin,
    options: [{ name: 'id', type: 'string', required: true, description: 'Backup ID' }],
    run(ctx, a) {
      const before = db.data.backups.length;
      db.data.backups = db.data.backups.filter((x) => !(x.guildId === ctx.guild.id && x.id === a.id));
      assert(db.data.backups.length < before, 'No backup with that ID.');
      db.save();
      return ok('Deleted.');
    },
  },
  {
    name: 'backupexport',
    description: 'Download a backup as a JSON file',
    ...admin,
    options: [{ name: 'id', type: 'string', description: 'Backup ID (defaults to a fresh snapshot)' }],
    async run(ctx, a) {
      const data = a.id ? mine(ctx.guild.id).find((x) => x.id === a.id)?.data : snapshot(ctx.guild);
      assert(data, 'No backup with that ID.');
      const file = new AttachmentBuilder(Buffer.from(JSON.stringify(data, null, 2)), { name: `backup-${ctx.guild.id}-${a.id || 'now'}.json` });
      await ctx.reply(ok(`Here's the backup: ${data.roles.length} roles, ${data.channels.length} channels.`));
      // Components V2 messages can't carry loose files, so the file goes in a plain message
      if (ctx.isSlash) await ctx.interaction.followUp({ files: [file], flags: MessageFlags.Ephemeral });
      else await ctx.channel.send({ files: [file] });
    },
  },
];

module.exports.snapshot = snapshot;
module.exports.diff = diff;
