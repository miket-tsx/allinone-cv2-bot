const db = require('./db');
const { card } = require('./ui');

// Log types and what they cover. Each can have its own channel; unset ones use the main log channel.
const LOG_TYPES = {
  messages: 'deleted, edited and bulk-deleted messages',
  members: 'joins, leaves, nickname and role changes, invites used',
  moderation: 'bans, kicks, timeouts, warnings, automod and security alerts',
  server: 'channels, roles, emojis, threads, invites and server settings',
  voice: 'joining, leaving and moving between voice channels',
};

function logChannel(guild, type) {
  const g = db.guild(guild.id);
  const id = (type && g.logs[type]) || g.logChannel;
  if (!id) return null;
  const ch = guild.channels.cache.get(id);
  return ch?.isTextBased() ? ch : null;
}

// `channelId` in opts lets people mute logging for noisy channels via the ignore list
async function sendLog(guild, opts, type = 'moderation') {
  if (!guild) return;
  if (opts.channelId && db.guild(guild.id).logs.ignored.includes(opts.channelId)) return;
  // Switching logging off silences the routine logs; security and mod alerts still get through
  if (type !== 'moderation' && db.guild(guild.id).features.logging === false) return;
  const ch = logChannel(guild, type);
  if (!ch) return;
  // Logs often quote user input, so never let them ping anyone.
  // Failures are swallowed on purpose: a broken log channel shouldn't break the command.
  const { channelId, files, ...rest } = opts;
  const sent = await ch
    .send({ ...card({ ...rest, footer: rest.footer || new Date().toUTCString() }), allowedMentions: { parse: [] } })
    .catch(() => null);
  // Components V2 messages don't show loose attachments, so files go in a plain follow-up
  if (sent && files?.length) await ch.send({ files }).catch(() => {});
}

function fill(tpl, member) {
  return String(tpl)
    .replaceAll('{user}', `<@${member.id}>`)
    .replaceAll('{username}', member.user.username)
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{count}', String(member.guild.memberCount));
}

module.exports = { sendLog, fill, logChannel, LOG_TYPES };
