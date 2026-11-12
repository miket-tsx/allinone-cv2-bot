const { PermissionFlagsBits: P } = require('discord.js');
const r = require('../resolve');
const db = require('../../lib/db');
const { ts } = require('../../lib/util');

const MAX_TIMEOUT = 28 * 24 * 60 * 60 * 1000;

// Every moderation action shares the same shape: find the member, check the hierarchy, act.
const modAction = (name, description, perms, act, extra = {}) => ({
  name,
  description,
  params: { member: 's! Member name, mention or ID', ...(extra.params || {}) },
  perms,
  confirm: true,
  danger: extra.danger ?? false,
  async run(env, a) {
    const m = await r.member(env, a.member);
    r.assertMemberManageable(env, m);
    return act(env, m, a);
  },
});

const voiceAction = (name, description, act) => ({
  name,
  description,
  params: { member: 's! Member in a voice channel', on: 'b true to apply, false to undo' },
  perms: [P.MuteMembers],
  confirm: true,
  async run(env, a) {
    const m = await r.member(env, a.member);
    if (!m.voice.channel) return `${m.user.username} isn't in a voice channel.`;
    return act(env, m, a.on !== false);
  },
});

module.exports = [
  {
    name: 'member_info',
    description: 'Look up a member: roles, join date, account age, timeout status',
    params: { member: 's! Member name, mention or ID' },
    async run(env, a) {
      const m = await r.member(env, a.member);
      return [
        `${m.user.username} (${m.displayName}), id ${m.id}${m.user.bot ? ', bot' : ''}`,
        `joined ${ts(m.joinedAt, 'R')}, account created ${ts(m.user.createdAt, 'R')}`,
        `roles: ${
          m.roles.cache
            .filter((x) => x.id !== env.guild.id)
            .map((x) => x.name)
            .join(', ') || 'none'
        }`,
        m.communicationDisabledUntil > new Date()
          ? `timed out until ${ts(m.communicationDisabledUntil)}`
          : null,
        `warnings: ${(db.guild(env.guild.id).warns[m.id] || []).length}`,
      ]
        .filter(Boolean)
        .join('\n');
    },
  },
  {
    name: 'search_members',
    description: 'Find members whose name contains some text',
    params: { query: 's! Part of a username or nickname' },
    async run(env, a) {
      const found = await env.guild.members.fetch({ query: a.query, limit: 25 });
      return found.size ? found.map((m) => `${m.user.username} (${m.id})`).join('\n') : 'Nobody matched.';
    },
  },
  {
    name: 'member_counts',
    description: 'How many humans, bots and online members the server has',
    params: {},
    async run(env) {
      const all = await env.guild.members.fetch({ withPresences: false });
      const bots = all.filter((m) => m.user.bot).size;
      return `${all.size} members: ${all.size - bots} humans, ${bots} bots.`;
    },
  },
  {
    name: 'list_timed_out',
    description: 'List members who are currently timed out',
    params: {},
    async run(env) {
      const all = await env.guild.members.fetch();
      const muted = all.filter((m) => m.communicationDisabledUntil > new Date());
      return muted.size
        ? muted.map((m) => `${m.user.username} until ${ts(m.communicationDisabledUntil)}`).join('\n')
        : 'Nobody is timed out.';
    },
  },
  modAction(
    'kick_member',
    'Kick a member from the server',
    [P.KickMembers],
    async (env, m) => {
      await m.kick(env.reason);
      return `Kicked ${m.user.username}.`;
    },
    { danger: true, params: { reason: 's Why' } },
  ),
  modAction(
    'ban_member',
    'Ban a member from the server',
    [P.BanMembers],
    async (env, m, a) => {
      await m.ban({ reason: env.reason, deleteMessageSeconds: Math.min(7, a.delete_days || 0) * 86400 });
      return `Banned ${m.user.username}.`;
    },
    { danger: true, params: { reason: 's Why', delete_days: 'n Days of their messages to delete, 0 to 7' } },
  ),
  modAction(
    'timeout_member',
    'Time out a member so they cannot talk',
    [P.ModerateMembers],
    async (env, m, a) => {
      const ms = r.duration(a.duration, { max: MAX_TIMEOUT });
      await m.timeout(ms, env.reason);
      return `Timed out ${m.user.username} for ${a.duration}.`;
    },
    { params: { duration: 's! How long, e.g. 10m, 2h, 1d (max 28d)', reason: 's Why' } },
  ),
  modAction('remove_timeout', "Lift a member's timeout", [P.ModerateMembers], async (env, m) => {
    await m.timeout(null, env.reason);
    return `${m.user.username} can talk again.`;
  }),
  modAction(
    'warn_member',
    "Add a warning to a member's record",
    [P.ModerateMembers],
    async (env, m, a) => {
      const warns = db.guild(env.guild.id).warns;
      (warns[m.id] ??= []).push({ by: env.member.id, reason: a.reason || 'No reason given', at: Date.now() });
      db.save();
      return `Warned ${m.user.username}. That's warning #${warns[m.id].length}.`;
    },
    { params: { reason: 's! Why' } },
  ),
  modAction(
    'set_nickname',
    "Change a member's nickname",
    [P.ManageNicknames],
    async (env, m, a) => {
      await m.setNickname(a.nickname?.slice(0, 32) || null, env.reason);
      return a.nickname
        ? `${m.user.username} is now "${a.nickname}".`
        : `Reset ${m.user.username}'s nickname.`;
    },
    { params: { nickname: 's New nickname, leave empty to reset' } },
  ),
  {
    name: 'unban_user',
    description: 'Unban a user by ID or username',
    params: { user: 's! User ID or username' },
    perms: [P.BanMembers],
    confirm: true,
    async run(env, a) {
      const bans = await env.guild.bans.fetch();
      const q = String(a.user).toLowerCase();
      const ban = bans.get(r.idOf(a.user)) || bans.find((b) => b.user.username.toLowerCase() === q);
      if (!ban) return `${a.user} isn't banned.`;
      await env.guild.bans.remove(ban.user.id, env.reason);
      return `Unbanned ${ban.user.username}.`;
    },
  },
  {
    name: 'list_bans',
    description: 'List banned users and why',
    params: {},
    perms: [P.BanMembers],
    async run(env) {
      const bans = await env.guild.bans.fetch();
      return bans.size
        ? bans
            .first(40)
            .map((b) => `${b.user.username} (${b.user.id}): ${b.reason || 'no reason'}`)
            .join('\n')
        : 'Nobody is banned.';
    },
  },
  {
    name: 'move_to_voice',
    description: 'Move a member to another voice channel',
    params: { member: 's! Member in voice', channel: 's! Voice channel to move them to' },
    perms: [P.MoveMembers],
    confirm: true,
    async run(env, a) {
      const m = await r.member(env, a.member);
      if (!m.voice.channel) return `${m.user.username} isn't in voice.`;
      const ch = r.channel(env, a.channel);
      await m.voice.setChannel(ch, env.reason);
      return `Moved ${m.user.username} to ${ch.name}.`;
    },
  },
  {
    name: 'disconnect_from_voice',
    description: 'Disconnect a member from voice',
    params: { member: 's! Member in voice' },
    perms: [P.MoveMembers],
    confirm: true,
    async run(env, a) {
      const m = await r.member(env, a.member);
      if (!m.voice.channel) return `${m.user.username} isn't in voice.`;
      await m.voice.disconnect(env.reason);
      return `Disconnected ${m.user.username}.`;
    },
  },
  voiceAction('server_mute', 'Server-mute or unmute a member in voice', async (env, m, on) => {
    await m.voice.setMute(on, env.reason);
    return `${on ? 'Muted' : 'Unmuted'} ${m.user.username}.`;
  }),
  voiceAction('server_deafen', 'Server-deafen or undeafen a member in voice', async (env, m, on) => {
    await m.voice.setDeaf(on, env.reason);
    return `${on ? 'Deafened' : 'Undeafened'} ${m.user.username}.`;
  }),
];
