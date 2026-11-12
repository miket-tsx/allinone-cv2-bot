const pick = (a) => a[Math.floor(Math.random() * a.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const shuffle = (a) => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const fmtNum = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 6 });
const ts = (date, style = 'f') => `<t:${Math.floor(new Date(date).getTime() / 1000)}:${style}>`;

function fmtDur(ms) {
  ms = Math.max(0, Math.floor(ms));
  const parts = [];
  const units = [
    ['d', 86400000],
    ['h', 3600000],
    ['m', 60000],
    ['s', 1000],
  ];
  for (const [u, v] of units) {
    const q = Math.floor(ms / v);
    if (q) {
      parts.push(q + u);
      ms -= q * v;
    }
  }
  return parts.join(' ') || '0s';
}

function parseDur(str) {
  if (!str) return null;
  const re = /(\d+(?:\.\d+)?)\s*(w|d|h|m|s)/gi;
  const mult = { w: 604800000, d: 86400000, h: 3600000, m: 60000, s: 1000 };
  let total = 0,
    m,
    matched = '';
  while ((m = re.exec(str))) {
    total += parseFloat(m[1]) * mult[m[2].toLowerCase()];
    matched += m[0];
  }
  // leftover junk (e.g. "5m banana") means the input isn't a clean duration
  if (!total || matched.replace(/\s/g, '').length !== String(str).replace(/\s/g, '').length) return null;
  return total;
}

// Errors safe to show to users as-is
class UserError extends Error {}
const assert = (cond, msg) => {
  if (!cond) throw new UserError(msg);
};

async function fetchJson(url, opts = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), opts.timeout || 10000);
  try {
    const res = await fetch(url, {
      ...opts,
      signal: ctl.signal,
      headers: { 'User-Agent': 'AllInOne-CV2-Bot/1.0', Accept: 'application/json', ...(opts.headers || {}) },
    });
    if (!res.ok)
      throw new UserError(
        `The service came back with a ${res.status}. Give it another shot, or double-check what you typed.`,
      );
    return await res.json();
  } catch (e) {
    if (e instanceof UserError) throw e;
    throw new UserError(
      e.name === 'AbortError'
        ? 'The service took so long to answer that I gave up waiting.'
        : 'Could not reach the service right now. It might be having a moment.',
    );
  } finally {
    clearTimeout(t);
  }
}

// zero-width space keeps user content from closing the fence early
const codeblock = (s, lang = '') =>
  '```' + lang + '\n' + String(s).replace(/```/g, '`\u200b``').slice(0, 1900) + '\n```';
// Custom emoji come in as <:name:id> and reactions report them by id; unicode ones are just the character
const emojiKey = (e) => String(e?.id || e).match(/(\d{15,})/)?.[1] || String(e?.name || e).trim();
const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);

module.exports = {
  pick,
  randInt,
  shuffle,
  chunk,
  fmtNum,
  ts,
  fmtDur,
  parseDur,
  UserError,
  assert,
  fetchJson,
  codeblock,
  cap,
  emojiKey,
};
