const db = require('./db');
const { card, C } = require('./ui');

// xp needed to go from lvl -> lvl+1
const xpFor = (lvl) => 5 * lvl * lvl + 50 * lvl + 100;
function totalXpFor(lvl) {
  let t = 0;
  for (let i = 0; i < lvl; i++) t += xpFor(i);
  return t;
}
function levelFromXp(xp) {
  let l = 0;
  while (xp >= totalXpFor(l + 1)) l++;
  return l;
}
function progress(xp) {
  const l = levelFromXp(xp);
  const base = totalXpFor(l);
  return { level: l, into: xp - base, needed: xpFor(l) };
}
function bar(frac, len = 14) {
  const f = Math.round(Math.max(0, Math.min(1, frac)) * len);
  return '▰'.repeat(f) + '▱'.repeat(len - f);
}

async function applyRoles(member, level) {
  const g = db.guild(member.guild.id);
  for (const [lvl, roleId] of Object.entries(g.levels.roles)) {
    if (level >= Number(lvl) && !member.roles.cache.has(roleId))
      // role may be deleted or above ours; not worth blowing up over
      await member.roles.add(roleId).catch(() => {});
  }
}

const lastXp = new Map();
async function onMessage(message) {
  const g = db.guild(message.guild.id);
  const m = db.member(message.guild.id, message.author.id);
  m.msgs++;
  if (!g.levels.enabled) return db.save();
  const key = `${message.guild.id}:${message.author.id}`;
  // one xp payout per minute, so spamming doesn't get anyone anywhere
  if ((lastXp.get(key) || 0) > Date.now()) return db.save();
  lastXp.set(key, Date.now() + 60000);
  const before = levelFromXp(m.xp);
  m.xp += 15 + Math.floor(Math.random() * 11);
  const after = levelFromXp(m.xp);
  m.level = after;
  db.save();
  if (after > before) {
    const ch = (g.levels.channel && message.guild.channels.cache.get(g.levels.channel)) || message.channel;
    ch.send({
      ...card({
        title: 'Ding! Level up',
        description: `${message.author} just hit **level ${after}** 🎉 Nice grinding!`,
        color: C.level,
      }),
      allowedMentions: { users: [message.author.id] },
    }).catch(() => {});
    if (message.member) applyRoles(message.member, after);
  }
}

module.exports = { xpFor, totalXpFor, levelFromXp, progress, bar, applyRoles, onMessage };
