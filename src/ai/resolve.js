// Turns the loose references an LLM produces ("the mods role", "#general", "bob") into real
// Discord objects, and holds the safety checks every server action goes through.
const { PermissionFlagsBits, ChannelType } = require('discord.js');
const { UserError, parseDur } = require('../lib/util');

const idOf = (s) => String(s ?? '').match(/(\d{17,20})/)?.[1] ?? null;
const clean = (s) =>
  String(s ?? '')
    .trim()
    .replace(/^[@#]/, '')
    .toLowerCase();

function role(env, ref) {
  const roles = env.guild.roles.cache;
  const id = idOf(ref);
  const q = clean(ref);
  if (q === 'everyone') return env.guild.roles.everyone;
  const found =
    (id && roles.get(id)) ||
    roles.find((r) => r.name.toLowerCase() === q) ||
    roles.find((r) => r.name.toLowerCase().replace(/[^a-z0-9]/g, '') === q.replace(/[^a-z0-9]/g, '')) ||
    roles.find((r) => r.name.toLowerCase().includes(q));
  if (!found) throw new UserError(`I couldn't find a role called "${ref}".`);
  return found;
}

function channel(env, ref, { optional = false } = {}) {
  if (!ref) {
    if (optional) return env.channel;
    throw new UserError('Which channel? I need a name or a mention.');
  }
  const chans = env.guild.channels.cache;
  const id = idOf(ref);
  const q = clean(ref).replace(/\s+/g, '-');
  const found =
    (id && chans.get(id)) ||
    chans.find((c) => c.name.toLowerCase() === q) ||
    chans.find((c) => c.name.toLowerCase() === clean(ref)) ||
    chans.find((c) => c.name.toLowerCase().includes(q));
  if (!found) throw new UserError(`I couldn't find a channel called "${ref}".`);
  return found;
}

function category(env, ref) {
  if (!ref) return null;
  const c = channel(env, ref);
  if (c.type !== ChannelType.GuildCategory) throw new UserError(`"${c.name}" isn't a category.`);
  return c;
}

async function member(env, ref) {
  const id = idOf(ref);
  if (id) {
    const m = await env.guild.members.fetch(id).catch(() => null);
    if (m) return m;
  }
  const q = clean(ref);
  if (q === 'me' || q === 'myself') return env.member;
  let m = env.guild.members.cache.find(
    (x) =>
      x.user.username.toLowerCase() === q ||
      x.displayName.toLowerCase() === q ||
      x.user.globalName?.toLowerCase() === q,
  );
  if (!m && q.length >= 2)
    m = (await env.guild.members.fetch({ query: q, limit: 1 }).catch(() => null))?.first();
  if (!m) throw new UserError(`I couldn't find a member called "${ref}".`);
  return m;
}

async function message(env, ref, chanRef) {
  const ch = channel(env, chanRef, { optional: true });
  const id = idOf(ref);
  if (!id) throw new UserError('I need the message ID or link for that.');
  const msg = await ch.messages?.fetch(id).catch(() => null);
  if (!msg) throw new UserError(`I couldn't find that message in #${ch.name}.`);
  return msg;
}

const PERM_KEYS = Object.keys(PermissionFlagsBits);
function perms(list) {
  if (!list) return [];
  const words = Array.isArray(list) ? list : String(list).split(/[,|]/);
  return words
    .map((w) => w.trim())
    .filter(Boolean)
    .map((w) => {
      const norm = w.replace(/[\s_-]/g, '').toLowerCase();
      const key = PERM_KEYS.find((k) => k.toLowerCase() === norm);
      if (!key) throw new UserError(`"${w}" isn't a Discord permission I recognise.`);
      return key;
    });
}

function color(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const named = {
    red: 0xed4245,
    green: 0x57f287,
    blue: 0x3498db,
    yellow: 0xfee75c,
    orange: 0xe67e22,
    purple: 0x9b59b6,
    pink: 0xeb459e,
    white: 0xffffff,
    black: 0x010101,
    grey: 0x95a5a6,
    gray: 0x95a5a6,
    gold: 0xf1c40f,
    teal: 0x1abc9c,
    blurple: 0x5865f2,
  };
  const s = String(value).trim().toLowerCase();
  if (named[s] !== undefined) return named[s];
  const hex = s.replace(/^#|^0x/, '');
  if (!/^[0-9a-f]{6}$/.test(hex))
    throw new UserError(`"${value}" isn't a colour I understand. Try a hex like #ff8800.`);
  return parseInt(hex, 16);
}

function duration(value, { max } = {}) {
  const ms = typeof value === 'number' ? value * 60000 : parseDur(String(value));
  if (!ms) throw new UserError(`"${value}" isn't a duration I understand. Try something like 10m, 2h or 1d.`);
  if (max && ms > max) throw new UserError('That duration is longer than Discord allows.');
  return ms;
}

const isOwner = (env, m = env.member) => env.guild.ownerId === m.id;

// The requester and the bot both have to sit above a role to touch it.
function assertRoleEditable(env, r) {
  if (r.managed)
    throw new UserError(`**${r.name}** is managed by an integration, so nobody can edit it by hand.`);
  if (r.id === env.guild.id) return;
  if (!isOwner(env) && r.position >= env.member.roles.highest.position)
    throw new UserError(
      `**${r.name}** is at or above your highest role, so I won't touch it on your behalf.`,
    );
  if (r.position >= env.guild.members.me.roles.highest.position)
    throw new UserError(`**${r.name}** is above my highest role. Drag my role higher and try again.`);
}

function assertMemberManageable(env, target) {
  if (target.id === env.guild.ownerId) throw new UserError("That's the server owner. Not happening.");
  if (target.id === env.client.user.id) throw new UserError("I'm not going to do that to myself.");
  if (target.id === env.member.id) throw new UserError("You can't point that at yourself.");
  if (!isOwner(env) && target.roles.highest.position >= env.member.roles.highest.position)
    throw new UserError(`**${target.user.username}** has a role equal to or above yours.`);
  if (target.roles.highest.position >= env.guild.members.me.roles.highest.position)
    throw new UserError(`**${target.user.username}** is above me in the role list, so I can't do that.`);
}

module.exports = {
  idOf,
  role,
  channel,
  category,
  member,
  message,
  perms,
  color,
  duration,
  assertRoleEditable,
  assertMemberManageable,
};
