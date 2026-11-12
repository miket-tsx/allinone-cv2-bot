const { PermissionFlagsBits: P, ChannelType: T } = require('discord.js');
const r = require('../resolve');

const TYPE_NAMES = {
  [T.GuildText]: 'text',
  [T.GuildVoice]: 'voice',
  [T.GuildCategory]: 'category',
  [T.GuildAnnouncement]: 'announcement',
  [T.GuildStageVoice]: 'stage',
  [T.GuildForum]: 'forum',
};

// One factory covers text, voice, forum and friends; they only differ by type.
const creator = (name, type, description, extra = {}) => ({
  name,
  description,
  params: {
    name: 's! Channel name',
    category: 's Category to put it in',
    private: 'b Hide it from @everyone',
    ...extra,
  },
  perms: [P.ManageChannels],
  confirm: true,
  async run(env, a) {
    const overwrites = a.private ? [{ id: env.guild.id, deny: [P.ViewChannel] }] : undefined;
    const ch = await env.guild.channels.create({
      name: a.name,
      type,
      parent: type === T.GuildCategory ? undefined : r.category(env, a.category)?.id,
      topic: a.topic,
      userLimit: a.user_limit,
      permissionOverwrites: overwrites,
      reason: env.reason,
    });
    return `Created ${TYPE_NAMES[type]} channel ${ch.name}${a.private ? ' (private)' : ''}.`;
  },
});

const editor = (name, description, params, apply, extra = {}) => ({
  name,
  description,
  params: { channel: 's Channel name or mention (defaults to the current one)', ...params },
  perms: [P.ManageChannels],
  confirm: true,
  ...extra,
  async run(env, a) {
    const ch = r.channel(env, a.channel, { optional: true });
    return apply(env, ch, a);
  },
});

const overwrite = (allow) => async (env, ch, a) => {
  const flag = allow ? null : false;
  await ch.permissionOverwrites.edit(
    env.guild.id,
    { SendMessages: flag, SendMessagesInThreads: flag, Connect: flag },
    { reason: env.reason },
  );
  return `${allow ? 'Unlocked' : 'Locked'} #${ch.name}.`;
};

module.exports = [
  {
    name: 'list_channels',
    description: 'List every channel, grouped by category',
    params: {},
    run(env) {
      const all = env.guild.channels.cache;
      const lines = [];
      for (const c of all.filter((c) => !c.parentId && c.type !== T.GuildCategory).values())
        lines.push(`#${c.name} [${TYPE_NAMES[c.type] ?? c.type}]`);
      for (const cat of all
        .filter((c) => c.type === T.GuildCategory)
        .sort((a, b) => a.position - b.position)
        .values()) {
        lines.push(`${cat.name}:`);
        for (const c of all.filter((c) => c.parentId === cat.id).values())
          lines.push(`  #${c.name} [${TYPE_NAMES[c.type] ?? c.type}]`);
      }
      return lines.join('\n') || 'No channels.';
    },
  },
  {
    name: 'channel_info',
    description: 'Details about a channel: type, topic, slowmode, category',
    params: { channel: 's Channel (defaults to the current one)' },
    run(env, a) {
      const c = r.channel(env, a.channel, { optional: true });
      return [
        `#${c.name} (${TYPE_NAMES[c.type] ?? c.type}), id ${c.id}`,
        `category: ${c.parent?.name ?? 'none'}`,
        c.topic ? `topic: ${c.topic}` : null,
        c.rateLimitPerUser ? `slowmode: ${c.rateLimitPerUser}s` : null,
        `nsfw: ${!!c.nsfw}`,
      ]
        .filter(Boolean)
        .join('\n');
    },
  },
  creator('create_text_channel', T.GuildText, 'Create a text channel', { topic: 's Channel topic' }),
  creator('create_voice_channel', T.GuildVoice, 'Create a voice channel', {
    user_limit: 'n Max people, 0 for unlimited',
  }),
  creator('create_category', T.GuildCategory, 'Create a category to group channels'),
  creator(
    'create_announcement_channel',
    T.GuildAnnouncement,
    'Create an announcement channel (community servers)',
  ),
  creator('create_forum_channel', T.GuildForum, 'Create a forum channel (community servers)', {
    topic: 's Forum guidelines',
  }),
  creator('create_stage_channel', T.GuildStageVoice, 'Create a stage channel (community servers)'),
  editor(
    'delete_channel',
    'Delete a channel or category',
    {},
    async (env, ch) => {
      await ch.delete(env.reason);
      return `Deleted #${ch.name}.`;
    },
    { danger: true },
  ),
  editor('rename_channel', 'Rename a channel', { name: 's! New name' }, async (env, ch, a) => {
    const old = ch.name;
    await ch.setName(a.name, env.reason);
    return `Renamed #${old} to #${ch.name}.`;
  }),
  editor('set_channel_topic', "Set a text channel's topic", { topic: 's! New topic' }, async (env, ch, a) => {
    await ch.setTopic(a.topic.slice(0, 1024), env.reason);
    return `Updated the topic of #${ch.name}.`;
  }),
  editor(
    'set_slowmode',
    'Set slowmode on a channel',
    { seconds: 'n! Seconds between messages, 0 to turn off' },
    async (env, ch, a) => {
      await ch.setRateLimitPerUser(Math.min(21600, Math.max(0, a.seconds)), env.reason);
      return a.seconds ? `Slowmode in #${ch.name} is now ${a.seconds}s.` : `Slowmode is off in #${ch.name}.`;
    },
  ),
  editor(
    'set_nsfw',
    'Mark a channel as age-restricted or not',
    { nsfw: 'b! true to age-restrict' },
    async (env, ch, a) => {
      await ch.setNSFW(!!a.nsfw, env.reason);
      return `#${ch.name} is ${a.nsfw ? 'now' : 'no longer'} age-restricted.`;
    },
  ),
  editor(
    'move_channel',
    'Move a channel into a different category',
    { category: 's! Category name, or "none"' },
    async (env, ch, a) => {
      const parent = /^none$/i.test(a.category) ? null : r.category(env, a.category);
      await ch.setParent(parent, { lockPermissions: false, reason: env.reason });
      return `Moved #${ch.name} to ${parent?.name ?? 'no category'}.`;
    },
  ),
  editor(
    'clone_channel',
    'Make a copy of a channel with the same settings',
    { name: 's Name for the copy' },
    async (env, ch, a) => {
      const copy = await ch.clone({ name: a.name || ch.name, reason: env.reason });
      return `Cloned #${ch.name} as #${copy.name}.`;
    },
  ),
  editor('lock_channel', 'Stop @everyone from talking in a channel', {}, overwrite(false)),
  editor('unlock_channel', 'Let @everyone talk in a channel again', {}, overwrite(true)),
  editor('hide_channel', 'Hide a channel from @everyone', {}, async (env, ch) => {
    await ch.permissionOverwrites.edit(env.guild.id, { ViewChannel: false }, { reason: env.reason });
    return `#${ch.name} is now hidden.`;
  }),
  editor('unhide_channel', 'Make a hidden channel visible to @everyone again', {}, async (env, ch) => {
    await ch.permissionOverwrites.edit(env.guild.id, { ViewChannel: null }, { reason: env.reason });
    return `#${ch.name} is visible again.`;
  }),
  editor(
    'set_channel_permissions',
    'Allow or deny permissions for a role or member in a channel',
    {
      target: 's! Role or member the rule is for',
      allow: 's Comma separated permissions to allow',
      deny: 's Comma separated permissions to deny',
    },
    async (env, ch, a) => {
      let target;
      try {
        target = r.role(env, a.target);
      } catch {
        target = await r.member(env, a.target);
      }
      const edit = {};
      for (const p of r.perms(a.allow)) edit[p] = true;
      for (const p of r.perms(a.deny)) edit[p] = false;
      await ch.permissionOverwrites.edit(target.id, edit, { reason: env.reason });
      return `Updated permissions for ${target.name ?? target.user.username} in #${ch.name}.`;
    },
    { perms: [P.ManageChannels, P.ManageRoles] },
  ),
  editor(
    'reset_channel_permissions',
    'Clear the permission rules for a role or member in a channel',
    { target: 's! Role or member' },
    async (env, ch, a) => {
      let target;
      try {
        target = r.role(env, a.target);
      } catch {
        target = await r.member(env, a.target);
      }
      await ch.permissionOverwrites.delete(target.id, env.reason);
      return `Cleared the overrides for ${target.name ?? target.user.username} in #${ch.name}.`;
    },
    { perms: [P.ManageChannels, P.ManageRoles] },
  ),
  editor(
    'sync_channel_permissions',
    "Make a channel's permissions match its category",
    {},
    async (env, ch) => {
      if (!ch.parent) return `#${ch.name} isn't in a category.`;
      await ch.lockPermissions();
      return `#${ch.name} now follows ${ch.parent.name}'s permissions.`;
    },
  ),
  editor(
    'set_voice_limit',
    'Set how many people can join a voice channel',
    { limit: 'n! 0 to 99, 0 means unlimited' },
    async (env, ch, a) => {
      await ch.setUserLimit(Math.min(99, Math.max(0, a.limit)), env.reason);
      return `#${ch.name} now allows ${a.limit || 'unlimited'} people.`;
    },
  ),
  editor(
    'set_voice_bitrate',
    'Set the audio bitrate of a voice channel',
    { kbps: 'n! Bitrate in kbps, 8 to 96 (higher with boosts)' },
    async (env, ch, a) => {
      await ch.setBitrate(Math.max(8, a.kbps) * 1000, env.reason);
      return `#${ch.name} is now ${a.kbps}kbps.`;
    },
  ),
];
