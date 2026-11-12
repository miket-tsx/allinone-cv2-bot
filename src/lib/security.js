// Anti-raid watches the join rate; anti-nuke watches the audit log for someone with admin
// powers tearing the server down. Both alert the moderation log when they act.
const { PermissionFlagsBits: P, AuditLogEvent: A } = require('discord.js');
const db = require('./db');
const { C } = require('./ui');
const { sendLog } = require('./log');
const { ts, fmtDur } = require('./util');

const RAID_LENGTH = 10 * 60_000;
const joins = new Map(); // guildId -> [timestamps]

async function onJoin(member) {
  const g = db.guild(member.guild.id);
  const cfg = g.antiraid;
  if (!cfg.enabled || member.user.bot) return;
  const now = Date.now();

  // Brand-new accounts are the classic raid tool, so there's an optional minimum age
  const ageDays = (now - member.user.createdTimestamp) / 86400_000;
  if (cfg.minAccountDays && ageDays < cfg.minAccountDays) {
    await member
      .send(`Your account is a bit too new to join **${member.guild.name}**. Try again in ${Math.ceil(cfg.minAccountDays - ageDays)} days.`)
      .catch(() => {});
    await member.kick(`Anti-raid: account younger than ${cfg.minAccountDays} days`).catch(() => {});
    return sendLog(member.guild, {
      title: 'Anti-raid: new account kicked',
      color: C.mod,
      description: `${member.user.username} (${member.id}), created ${ts(member.user.createdAt, 'R')}`,
    });
  }

  const list = (joins.get(member.guild.id) || []).filter((t) => now - t < cfg.seconds * 1000);
  list.push(now);
  joins.set(member.guild.id, list);

  if (cfg.raidUntil < now && list.length >= cfg.joins) {
    cfg.raidUntil = now + RAID_LENGTH;
    db.save();
    sendLog(member.guild, {
      title: '🚨 Raid detected',
      color: C.error,
      description: `${list.length} people joined in ${cfg.seconds} seconds. Raid mode is on for ${fmtDur(RAID_LENGTH)}: everyone who joins now gets **${cfg.action === 'alert' ? 'flagged only' : cfg.action}**.`,
      footer: 'End it early with raidmode off',
    });
  }
  if (cfg.raidUntil > now) await handleRaider(member, cfg.action);
}

async function handleRaider(member, action) {
  const reason = 'Anti-raid: joined during a raid';
  if (action === 'kick') await member.kick(reason).catch(() => {});
  else if (action === 'ban') await member.ban({ reason, deleteMessageSeconds: 3600 }).catch(() => {});
  else if (action === 'timeout') await member.timeout(60 * 60_000, reason).catch(() => {});
}

// Audit log action -> anti-nuke limit name
const WATCHED = {
  [A.ChannelDelete]: 'channelDelete',
  [A.ChannelCreate]: 'channelCreate',
  [A.RoleDelete]: 'roleDelete',
  [A.RoleCreate]: 'roleCreate',
  [A.MemberBanAdd]: 'ban',
  [A.MemberKick]: 'kick',
  [A.WebhookCreate]: 'webhookCreate',
};
const DANGEROUS = [P.Administrator, P.ManageGuild, P.ManageRoles, P.ManageChannels, P.BanMembers, P.KickMembers, P.ManageWebhooks];
const actions = new Map(); // `${guild}:${user}:${kind}` -> [timestamps]
const punished = new Map();

async function onAudit(entry, guild) {
  const g = db.guild(guild.id);
  const cfg = g.antinuke;
  const kind = WATCHED[entry.action];
  if (!cfg.enabled || !kind || !entry.executorId) return;
  if (entry.executorId === guild.ownerId || entry.executorId === guild.client.user.id) return;
  if (cfg.whitelist.includes(entry.executorId)) return;

  const now = Date.now();
  const key = `${guild.id}:${entry.executorId}:${kind}`;
  const list = (actions.get(key) || []).filter((t) => now - t < cfg.seconds * 1000);
  list.push(now);
  actions.set(key, list);
  if (list.length < (cfg.limits[kind] ?? Infinity)) return;
  if (punished.get(`${guild.id}:${entry.executorId}`) > now - 60_000) return;
  punished.set(`${guild.id}:${entry.executorId}`, now);

  const member = await guild.members.fetch(entry.executorId).catch(() => null);
  let outcome = 'could not be found';
  if (member) outcome = await contain(member, cfg.punishment);
  sendLog(guild, {
    title: '🚨 Anti-nuke triggered',
    color: C.error,
    description: `<@${entry.executorId}> did **${kind}** ${list.length} times in ${cfg.seconds}s.`,
    fields: [
      ['What I did', outcome],
      ['If this was legit', 'Add them with `antinukewhitelist` and give their roles back.'],
    ],
  });
}

async function contain(member, punishment) {
  const reason = 'Anti-nuke: too many destructive actions';
  if (member.user.bot && punishment !== 'ban') punishment = 'kick'; // a rogue bot has no business staying
  try {
    if (punishment === 'ban') {
      await member.ban({ reason });
      return 'banned them';
    }
    if (punishment === 'kick') {
      await member.kick(reason);
      return 'kicked them';
    }
    const risky = member.roles.cache.filter((r) => !r.managed && r.id !== member.guild.id && DANGEROUS.some((p) => r.permissions.has(p)));
    await member.roles.remove(risky, reason);
    return risky.size ? `removed ${risky.size} roles with admin powers: ${risky.map((r) => r.name).join(', ')}` : 'found no roles to strip';
  } catch {
    return 'tried to stop them, but their top role is above mine. Move my role higher!';
  }
}

module.exports = { onJoin, onAudit, contain, WATCHED, RAID_LENGTH };
