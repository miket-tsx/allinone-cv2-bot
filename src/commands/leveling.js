const { PermissionFlagsBits: P } = require('discord.js');
const db = require('../lib/db');
const { card, ok, C } = require('../lib/ui');
const { assert, fmtNum, fmtDur } = require('../lib/util');
const L = require('../lib/levels');

const g = { guildOnly: true };
const admin = { guildOnly: true, perms: [P.ManageGuild] };
const rankOf = (gid, uid) =>
  Object.entries(db.members(gid))
    .sort((a, b) => (b[1].xp || 0) - (a[1].xp || 0))
    .findIndex(([id]) => id === uid) + 1;
const setXp = async (ctx, user, xp) => {
  const m = db.member(ctx.guild.id, user.id);
  m.xp = Math.max(0, Math.floor(xp));
  m.level = L.levelFromXp(m.xp);
  db.save();
  // Re-sync level roles, since XP can go down as well as up
  const mem = await ctx.getMember(user);
  if (mem) await L.applyRoles(mem, m.level);
  return m;
};

module.exports = [
  {
    name: 'rank',
    description: 'Check your level, XP and where you sit on the leaderboard',
    ...g,
    aliases: ['level', 'xp'],
    options: [{ name: 'user', type: 'user', description: 'Whose rank to peek at (defaults to you)' }],
    async run(ctx, a) {
      const u = a.user || ctx.user;
      const m = db.member(ctx.guild.id, u.id);
      const p = L.progress(m.xp);
      return card({
        title: `${u.username} — Level ${p.level}`,
        thumbnail: u.displayAvatarURL(),
        color: C.level,
        description: `${L.bar(p.into / p.needed)} ${Math.floor((p.into / p.needed) * 100)}%`,
        fields: [
          ['XP', `${fmtNum(p.into)} / ${fmtNum(p.needed)} (total ${fmtNum(m.xp)})`],
          ['Rank', `#${rankOf(ctx.guild.id, u.id) || '—'}`],
          ['Messages', fmtNum(m.msgs)],
        ],
      });
    },
  },
  {
    name: 'levels',
    description: 'The server’s top XP grinders',
    ...g,
    aliases: ['leaderboard', 'lb', 'top'],
    async run(ctx) {
      const all = Object.entries(db.members(ctx.guild.id))
        .filter(([, m]) => m.xp > 0)
        .sort((a, b) => b[1].xp - a[1].xp)
        .slice(0, 10);
      return card({
        title: `🏆 Levels — ${ctx.guild.name}`,
        color: C.level,
        description: all.length
          ? all
              .map(
                ([id, m], i) =>
                  `${['🥇', '🥈', '🥉'][i] || `**${i + 1}.**`} <@${id}> — Level **${L.levelFromXp(m.xp)}** (${fmtNum(m.xp)} XP)`,
              )
              .join('\n')
          : 'Nobody has any XP yet. Say something, anything!',
      });
    },
  },
  {
    name: 'setlevel',
    description: 'Admin: force a member to a specific level',
    ...admin,
    options: [
      { name: 'user', type: 'user', required: true, description: 'The member to adjust' },
      {
        name: 'level',
        type: 'integer',
        required: true,
        min: 0,
        max: 500,
        description: 'The level they’ll land on',
      },
    ],
    async run(ctx, a) {
      await setXp(ctx, a.user, L.totalXpFor(a.level));
      return ok(`${a.user} is officially level **${a.level}**.`);
    },
  },
  {
    name: 'addxp',
    description: 'Admin: slip a member some bonus XP',
    ...admin,
    options: [
      { name: 'user', type: 'user', required: true, description: 'Lucky recipient' },
      {
        name: 'amount',
        type: 'integer',
        required: true,
        min: 1,
        max: 1e7,
        description: 'How much XP to hand over',
      },
    ],
    async run(ctx, a) {
      const m = await setXp(ctx, a.user, db.member(ctx.guild.id, a.user.id).xp + a.amount);
      return ok(`Slipped ${fmtNum(a.amount)} XP to ${a.user}. They’re now level ${m.level}.`);
    },
  },
  {
    name: 'removexp',
    description: 'Admin: take some XP away from a member',
    ...admin,
    options: [
      { name: 'user', type: 'user', required: true, description: 'Unlucky member' },
      {
        name: 'amount',
        type: 'integer',
        required: true,
        min: 1,
        max: 1e7,
        description: 'How much XP to take',
      },
    ],
    async run(ctx, a) {
      const m = await setXp(ctx, a.user, db.member(ctx.guild.id, a.user.id).xp - a.amount);
      return ok(`Took ${fmtNum(a.amount)} XP from ${a.user}. They’re sitting at level ${m.level}.`);
    },
  },
  {
    name: 'resetxp',
    description: 'Admin: wipe a member’s XP back to zero',
    ...admin,
    options: [{ name: 'user', type: 'user', required: true, description: 'Member getting a fresh start' }],
    async run(ctx, a) {
      await setXp(ctx, a.user, 0);
      return ok(`${a.user} is back to zero XP. Fresh start!`);
    },
  },
  {
    name: 'resetlevels',
    description: 'Admin: wipe XP for the entire server (no undo!)',
    guildOnly: true,
    perms: [P.Administrator],
    async run(ctx) {
      for (const m of Object.values(db.members(ctx.guild.id))) {
        m.xp = 0;
        m.level = 0;
      }
      db.save();
      return ok('Everyone’s XP has been wiped. Clean slate, server-wide.');
    },
  },
  {
    name: 'messages',
    description: 'Count how many messages someone has sent since I showed up',
    ...g,
    aliases: ['msgs'],
    options: [{ name: 'user', type: 'user', description: 'Who to check (defaults to you)' }],
    async run(ctx, a) {
      const u = a.user || ctx.user;
      return card({
        description: `💬 **${u.username}** has fired off **${fmtNum(db.member(ctx.guild.id, u.id).msgs)}** message(s) so far.`,
        color: C.level,
      });
    },
  },
  {
    name: 'rep',
    description: 'Give someone a reputation point (one per 24h, spend it wisely)',
    ...g,
    options: [{ name: 'user', type: 'user', required: true, description: 'Who deserves a gold star' }],
    async run(ctx, a) {
      assert(a.user.id !== ctx.user.id && !a.user.bot, 'Nice try, but you can’t rep yourself or a bot.');
      const me = db.user(ctx.user.id);
      const left = (me.lastRep || 0) + 86400000 - Date.now();
      assert(left <= 0, `Easy there. You can hand out more rep in ${fmtDur(left)}.`);
      me.lastRep = Date.now();
      const t = db.member(ctx.guild.id, a.user.id);
      t.rep++;
      db.save();
      return card({
        description: `⭐ ${ctx.user} gave ${a.user} a rep point! They’re up to **${t.rep}**.`,
        color: C.level,
      });
    },
  },
  {
    name: 'reptop',
    description: 'The most well-liked people in the server',
    ...g,
    async run(ctx) {
      const all = Object.entries(db.members(ctx.guild.id))
        .filter(([, m]) => m.rep > 0)
        .sort((a, b) => b[1].rep - a[1].rep)
        .slice(0, 10);
      return card({
        title: '⭐ Reputation',
        description: all.length
          ? all.map(([id, m], i) => `**${i + 1}.** <@${id}> — ${m.rep}`).join('\n')
          : 'No rep handed out yet. Go be nice to someone.',
        color: C.level,
      });
    },
  },
  {
    name: 'profile',
    description: 'The full rundown: level, coins, rep and bio',
    ...g,
    options: [{ name: 'user', type: 'user', description: 'Whose profile to snoop on (defaults to you)' }],
    async run(ctx, a) {
      const u = a.user || ctx.user;
      const m = db.member(ctx.guild.id, u.id);
      const usr = db.user(u.id);
      return card({
        title: `${u.username}'s profile`,
        thumbnail: u.displayAvatarURL(),
        description: usr.bio || '*No bio yet. Fix that with `setbio`.*',
        color: C.level,
        fields: [
          ['Level', `${L.levelFromXp(m.xp)} (${fmtNum(m.xp)} XP)`],
          ['Rank', `#${rankOf(ctx.guild.id, u.id) || '—'}`],
          ['Coins', fmtNum(m.wallet + m.bank)],
          ['Reputation', String(m.rep)],
          ['Cookies', String(usr.cookies)],
          ['Messages', fmtNum(m.msgs)],
        ],
      });
    },
  },
  {
    name: 'setbio',
    description: 'Write something about yourself for your profile',
    options: [
      {
        name: 'bio',
        type: 'string',
        required: true,
        description: 'Your bio (200 characters max, so keep it punchy)',
      },
    ],
    async run(ctx, a) {
      db.user(ctx.user.id).bio = a.bio.slice(0, 200);
      db.save();
      return ok('Bio saved. Looking good.');
    },
  },
];
