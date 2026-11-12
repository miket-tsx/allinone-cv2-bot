// Everything else worth logging: member changes, bans and kicks, channels, roles, emojis,
// threads, invites, voice, bulk deletes and server settings. Message and join/leave logs
// live in their own files.
const { Events, AuditLogEvent, ChannelType, AttachmentBuilder } = require('discord.js');
const { sendLog } = require('../lib/log');
const { isOn } = require('../lib/features');
const { C, trunc } = require('../lib/ui');
const { ts, fmtDur } = require('../lib/util');

const invites = new Map(); // guildId -> Map(code -> uses), for working out which invite someone used
const log = (guild, type, opts) => isOn(guild?.id, 'logging') && sendLog(guild, opts, type);
const kindOf = (c) => ChannelType[c.type]?.replace(/^Guild/, '').toLowerCase() || 'channel';

async function cacheInvites(guild) {
  const list = await guild.invites.fetch().catch(() => null);
  if (list) invites.set(guild.id, new Map(list.map((i) => [i.code, i.uses])));
}

function diff(pairs) {
  return pairs.filter(([, a, b]) => a !== b).map(([k, a, b]) => [k, `${trunc(a ?? 'none', 200)} → ${trunc(b ?? 'none', 200)}`]);
}

module.exports = [
  {
    event: Events.ClientReady,
    once: true,
    async run(client) {
      for (const g of client.guilds.cache.values()) await cacheInvites(g);
    },
  },
  { event: Events.GuildCreate, run: (client, guild) => cacheInvites(guild) },
  {
    event: Events.InviteCreate,
    run(client, inv) {
      invites.get(inv.guild.id)?.set(inv.code, inv.uses ?? 0);
      log(inv.guild, 'server', {
        title: 'Invite created',
        color: C.info,
        description: `\`${inv.code}\` by ${inv.inviter ? `<@${inv.inviter.id}>` : 'someone'} for <#${inv.channelId}>`,
        fields: [
          ['Expires', inv.expiresAt ? ts(inv.expiresAt, 'R') : 'Never'],
          ['Max uses', inv.maxUses || 'Unlimited'],
        ],
      });
    },
  },
  {
    event: Events.InviteDelete,
    run(client, inv) {
      invites.get(inv.guild.id)?.delete(inv.code);
      log(inv.guild, 'server', { title: 'Invite deleted', color: C.warn, description: `\`${inv.code}\`` });
    },
  },
  {
    // Which invite did they use? Whichever one's use count went up.
    event: Events.GuildMemberAdd,
    async run(client, member) {
      const before = invites.get(member.guild.id);
      await cacheInvites(member.guild);
      const after = invites.get(member.guild.id);
      if (!before || !after) return;
      const used = [...after].find(([code, uses]) => uses > (before.get(code) ?? 0));
      if (!used) return;
      const inv = await member.guild.invites.fetch(used[0]).catch(() => null);
      log(member.guild, 'members', {
        title: 'Joined with an invite',
        color: C.info,
        description: `<@${member.id}> used \`${used[0]}\`${inv?.inviter ? ` from <@${inv.inviter.id}>` : ''} (${used[1]} uses now)`,
      });
    },
  },
  {
    event: Events.GuildMemberUpdate,
    run(client, before, after) {
      if (before.partial) return;
      const added = after.roles.cache.filter((r) => !before.roles.cache.has(r.id));
      const removed = before.roles.cache.filter((r) => !after.roles.cache.has(r.id));
      if (added.size || removed.size)
        log(after.guild, 'members', {
          title: 'Roles changed',
          color: C.info,
          description: `<@${after.id}> (${after.user.username})`,
          fields: [
            ['Added', added.map((r) => r.name).join(', ')],
            ['Removed', removed.map((r) => r.name).join(', ')],
          ],
        });
      if (before.nickname !== after.nickname)
        log(after.guild, 'members', {
          title: 'Nickname changed',
          color: C.info,
          description: `<@${after.id}>: ${before.nickname || '*none*'} → ${after.nickname || '*none*'}`,
        });
      const was = before.communicationDisabledUntilTimestamp > Date.now();
      const is = after.communicationDisabledUntilTimestamp > Date.now();
      if (!was && is)
        log(after.guild, 'moderation', {
          title: 'Member timed out',
          color: C.mod,
          description: `<@${after.id}> until ${ts(after.communicationDisabledUntil)} (${fmtDur(after.communicationDisabledUntilTimestamp - Date.now())})`,
        });
      else if (was && !is)
        log(after.guild, 'moderation', { title: 'Timeout removed', color: C.success, description: `<@${after.id}>` });
    },
  },
  {
    event: Events.GuildBanAdd,
    async run(client, ban) {
      const full = await ban.fetch().catch(() => ban);
      log(ban.guild, 'moderation', {
        title: 'Member banned 🔨',
        color: C.error,
        description: `${ban.user.username} (${ban.user.id})`,
        fields: [['Reason', full.reason || 'None given']],
      });
    },
  },
  {
    event: Events.GuildBanRemove,
    run: (client, ban) =>
      log(ban.guild, 'moderation', { title: 'Member unbanned', color: C.success, description: `${ban.user.username} (${ban.user.id})` }),
  },
  {
    // Kicks only show up in the audit log, there's no dedicated event for them
    event: Events.GuildAuditLogEntryCreate,
    run(client, entry, guild) {
      if (entry.action !== AuditLogEvent.MemberKick) return;
      log(guild, 'moderation', {
        title: 'Member kicked 👢',
        color: C.mod,
        description: `<@${entry.targetId}> by <@${entry.executorId}>`,
        fields: [['Reason', entry.reason || 'None given']],
      });
    },
  },
  {
    event: Events.ChannelCreate,
    run: (client, ch) =>
      ch.guild && log(ch.guild, 'server', { title: 'Channel created', color: C.success, description: `<#${ch.id}> (${kindOf(ch)})` }),
  },
  {
    event: Events.ChannelDelete,
    run: (client, ch) =>
      ch.guild && log(ch.guild, 'server', { title: 'Channel deleted', color: C.error, description: `#${ch.name} (${kindOf(ch)})` }),
  },
  {
    event: Events.ChannelUpdate,
    run(client, a, b) {
      if (!b.guild) return;
      const fields = diff([
        ['Name', a.name, b.name],
        ['Topic', a.topic, b.topic],
        ['Slowmode', a.rateLimitPerUser, b.rateLimitPerUser],
        ['NSFW', a.nsfw, b.nsfw],
        ['Category', a.parent?.name, b.parent?.name],
      ]);
      const overwrites = (c) => JSON.stringify(c.permissionOverwrites.cache.map((o) => [o.id, o.allow.bitfield.toString(), o.deny.bitfield.toString()]).sort());
      const permsChanged = overwrites(a) !== overwrites(b);
      if (permsChanged) fields.push(['Permissions', 'Overrides were changed']);
      if (fields.length) log(b.guild, 'server', { title: 'Channel updated', color: C.info, description: `<#${b.id}>`, fields, channelId: b.id });
    },
  },
  {
    event: Events.GuildRoleCreate,
    run: (client, r) => log(r.guild, 'server', { title: 'Role created', color: C.success, description: `${r.name} (${r.id})` }),
  },
  {
    event: Events.GuildRoleDelete,
    run: (client, r) => log(r.guild, 'server', { title: 'Role deleted', color: C.error, description: `${r.name} (${r.id})` }),
  },
  {
    event: Events.GuildRoleUpdate,
    run(client, a, b) {
      const fields = diff([
        ['Name', a.name, b.name],
        ['Color', a.hexColor, b.hexColor],
        ['Shown separately', a.hoist, b.hoist],
        ['Mentionable', a.mentionable, b.mentionable],
      ]);
      const gained = b.permissions.toArray().filter((p) => !a.permissions.has(p));
      const lost = a.permissions.toArray().filter((p) => !b.permissions.has(p));
      if (gained.length) fields.push(['Permissions added', gained.join(', ')]);
      if (lost.length) fields.push(['Permissions removed', lost.join(', ')]);
      if (fields.length) log(b.guild, 'server', { title: 'Role updated', color: C.info, description: `<@&${b.id}>`, fields });
    },
  },
  {
    event: Events.GuildEmojiCreate,
    run: (client, e) => log(e.guild, 'server', { title: 'Emoji added', color: C.success, description: `${e} :${e.name}:` }),
  },
  {
    event: Events.GuildEmojiDelete,
    run: (client, e) => log(e.guild, 'server', { title: 'Emoji removed', color: C.warn, description: `:${e.name}:` }),
  },
  {
    event: Events.ThreadCreate,
    run: (client, t, isNew) =>
      isNew && log(t.guild, 'server', { title: 'Thread started', color: C.info, description: `<#${t.id}> in <#${t.parentId}>`, channelId: t.parentId }),
  },
  {
    event: Events.ThreadDelete,
    run: (client, t) => log(t.guild, 'server', { title: 'Thread deleted', color: C.warn, description: `#${t.name} in <#${t.parentId}>`, channelId: t.parentId }),
  },
  {
    event: Events.GuildUpdate,
    run(client, a, b) {
      const fields = diff([
        ['Name', a.name, b.name],
        ['Verification level', a.verificationLevel, b.verificationLevel],
        ['Content filter', a.explicitContentFilter, b.explicitContentFilter],
        ['AFK channel', a.afkChannel?.name, b.afkChannel?.name],
        ['System channel', a.systemChannel?.name, b.systemChannel?.name],
        ['Vanity URL', a.vanityURLCode, b.vanityURLCode],
      ]);
      if (a.icon !== b.icon) fields.push(['Icon', 'Changed']);
      if (fields.length) log(b, 'server', { title: 'Server settings changed', color: C.info, fields });
    },
  },
  {
    // Purges get a single entry with a text file of what was removed
    event: Events.MessageBulkDelete,
    run(client, messages, channel) {
      if (!channel.guild) return;
      const lines = [...messages.values()]
        .reverse()
        .map((m) => `[${m.createdAt?.toISOString() ?? '?'}] ${m.author?.username ?? 'unknown'}: ${m.content || '(no text)'}`);
      log(channel.guild, 'messages', {
        title: 'Messages bulk deleted',
        color: C.error,
        description: `${messages.size} messages in <#${channel.id}>`,
        channelId: channel.id,
        files: [new AttachmentBuilder(Buffer.from(lines.join('\n')), { name: `purge-${channel.name}.txt` })],
      });
    },
  },
  {
    event: Events.VoiceStateUpdate,
    run(client, a, b) {
      const m = b.member || a.member;
      if (!m || m.user.bot || a.channelId === b.channelId) return;
      const opts = !a.channelId
        ? { title: 'Joined voice', color: C.success, description: `<@${m.id}> joined <#${b.channelId}>` }
        : !b.channelId
          ? { title: 'Left voice', color: C.warn, description: `<@${m.id}> left <#${a.channelId}>` }
          : { title: 'Moved voice', color: C.info, description: `<@${m.id}>: <#${a.channelId}> → <#${b.channelId}>` };
      log(b.guild, 'voice', opts);
    },
  },
];
