// Turns prefix-command text (or slash options) into a typed args object using the command's option schema.
const { ChannelType } = require('discord.js');
const { UserError } = require('./util');

class UsageError extends UserError {}

function tokenize(raw) {
  const out = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m;
  while ((m = re.exec(raw))) out.push({ value: m[1] ?? m[2], start: m.index });
  return out;
}

function usage(cmd, prefix = '!') {
  const opts = (cmd.options || []).map((o) => (o.required ? `<${o.name}>` : `[${o.name}]`)).join(' ');
  return `${prefix}${cmd.name}${opts ? ' ' + opts : ''}`;
}

async function resolveUser(ctx, tok) {
  const id = tok.match(/^<@!?(\d{17,20})>$/)?.[1] || (/^\d{17,20}$/.test(tok) ? tok : null);
  if (id) return ctx.client.users.fetch(id).catch(() => null);
  if (!ctx.guild) return null;
  const q = tok.toLowerCase();
  let m = ctx.guild.members.cache.find(
    (x) => x.user.username.toLowerCase() === q || x.displayName.toLowerCase() === q,
  );
  if (!m && q.length >= 2)
    m = (await ctx.guild.members.fetch({ query: tok, limit: 1 }).catch(() => null))?.first();
  return m?.user ?? null;
}
function resolveChannel(ctx, tok) {
  const id = tok.match(/^<#(\d{17,20})>$/)?.[1] || (/^\d{17,20}$/.test(tok) ? tok : null);
  if (!ctx.guild) return null;
  if (id) return ctx.guild.channels.cache.get(id) || null;
  return (
    ctx.guild.channels.cache.find((c) => c.name.toLowerCase() === tok.toLowerCase().replace(/^#/, '')) || null
  );
}
function resolveRole(ctx, tok) {
  if (!ctx.guild) return null;
  const id = tok.match(/^<@&(\d{17,20})>$/)?.[1] || (/^\d{17,20}$/.test(tok) ? tok : null);
  if (id) return ctx.guild.roles.cache.get(id) || null;
  const q = tok.toLowerCase().replace(/^@/, '');
  return (
    ctx.guild.roles.cache.find((r) => r.name.toLowerCase() === q) ||
    ctx.guild.roles.cache.find((r) => r.name.toLowerCase().startsWith(q)) ||
    null
  );
}
const BOOL = {
  true: true,
  yes: true,
  on: true,
  y: true,
  enable: true,
  1: true,
  false: false,
  no: false,
  off: false,
  n: false,
  disable: false,
  0: false,
};

async function convert(ctx, o, tok) {
  switch (o.type) {
    case 'integer': {
      if (!/^-?\d+$/.test(tok.replace(/,/g, ''))) return undefined;
      const n = parseInt(tok.replace(/,/g, ''), 10);
      return n;
    }
    case 'number': {
      const n = Number(tok.replace(/,/g, ''));
      return Number.isFinite(n) ? n : undefined;
    }
    case 'boolean':
      return BOOL[tok.toLowerCase()];
    case 'user':
      return (await resolveUser(ctx, tok)) ?? undefined;
    case 'channel':
      return resolveChannel(ctx, tok) ?? undefined;
    case 'role':
      return resolveRole(ctx, tok) ?? undefined;
    default:
      return tok;
  }
}

function checkRange(cmd, o, v, prefix) {
  if (v === undefined) return;
  if (o.type === 'integer' || o.type === 'number') {
    if (o.min !== undefined && v < o.min)
      throw new UsageError(`\`${o.name}\` needs to be at least ${o.min}.\nUsage: \`${usage(cmd, prefix)}\``);
    if (o.max !== undefined && v > o.max)
      throw new UsageError(`\`${o.name}\` can't go higher than ${o.max}.\nUsage: \`${usage(cmd, prefix)}\``);
  }
  if (o.choices && !o.choices.map((c) => String(c).toLowerCase()).includes(String(v).toLowerCase())) {
    throw new UsageError(`\`${o.name}\` has to be one of: ${o.choices.map((c) => `\`${c}\``).join(', ')}`);
  }
}

async function parsePrefix(ctx, cmd, raw) {
  const opts = cmd.options || [];
  const toks = tokenize(raw);
  const a = {};
  let i = 0;
  for (let k = 0; k < opts.length; k++) {
    const o = opts[k];
    const isLastString = k === opts.length - 1 && (o.type || 'string') === 'string';
    if (i >= toks.length) {
      if (o.required)
        throw new UsageError(
          `You forgot \`${o.name}\` — ${o.description}.\nUsage: \`${usage(cmd, ctx.prefix)}\``,
        );
      continue;
    }
    if (o.rest || (isLastString && o.rest !== false)) {
      a[o.name] = raw.slice(toks[i].start).trim();
      i = toks.length;
      checkRange(cmd, o, a[o.name], ctx.prefix);
      continue;
    }
    const v = await convert(ctx, o, toks[i].value);
    if (v === undefined) {
      if (o.required)
        throw new UsageError(
          `\`${o.name}\` doesn't look right: "${toks[i].value}" — I was expecting ${o.type || 'text'}.\nUsage: \`${usage(cmd, ctx.prefix)}\``,
        );
      continue; // optional and didn't match: leave the token for the next option
    }
    a[o.name] = (o.type || 'string') === 'string' && o.lower ? v.toLowerCase() : v;
    i++;
    checkRange(cmd, o, a[o.name], ctx.prefix);
  }
  return a;
}

function parseSlash(ctx, cmd) {
  const a = {};
  const io = ctx.interaction.options;
  for (const o of cmd.options || []) {
    let v;
    switch (o.type || 'string') {
      case 'user':
        v = io.getUser(o.name);
        break;
      case 'integer':
        v = io.getInteger(o.name);
        break;
      case 'number':
        v = io.getNumber(o.name);
        break;
      case 'boolean':
        v = io.getBoolean(o.name);
        break;
      case 'channel':
        v = io.getChannel(o.name);
        break;
      case 'role':
        v = io.getRole(o.name);
        break;
      default:
        v = io.getString(o.name);
        if (v && o.lower) v = v.toLowerCase();
    }
    if (v !== null && v !== undefined) a[o.name] = v;
  }
  return a;
}

module.exports = { parsePrefix, parseSlash, usage, UsageError, tokenize, resolveUser, ChannelType };
