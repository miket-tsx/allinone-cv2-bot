// Storage. Everything lives in memory as plain objects and gets written to SQLite in the
// background, so the rest of the code can just mutate `db.guild(id).whatever` and call save().
//
// Each guild, member and user is its own row holding a JSON document. On save we only write
// rows whose JSON actually changed, which keeps writes small even on busy servers.
//
// Uses Node's built-in SQLite (Node 22.5+), so there's nothing native to compile. On older
// Node versions it falls back to the old single JSON file. An existing data/db.json is imported
// into SQLite automatically the first time, and kept as db.json.bak.
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', '..', 'data');
const SQLITE_FILE = process.env.DB_PATH || path.join(DIR, 'bot.sqlite');
const JSON_FILE = process.env.DB_FILE || path.join(DIR, 'db.json');

const LISTS = ['reminders', 'giveaways', 'schedules', 'feeds', 'backups'];
const blank = () => ({ guilds: {}, members: {}, users: {}, ...Object.fromEntries(LISTS.map((k) => [k, []])) });

let data = blank();
let sql = null;
const written = new Map(); // row key -> last JSON we wrote, so unchanged rows are skipped

function openSqlite() {
  let DatabaseSync;
  try {
    // Hide the "SQLite is experimental" warning some Node versions print once
    const emit = process.emitWarning;
    process.emitWarning = (w, ...rest) => (String(w).includes('SQLite') ? undefined : emit.call(process, w, ...rest));
    ({ DatabaseSync } = require('node:sqlite'));
    process.emitWarning = emit;
  } catch {
    return null;
  }
  fs.mkdirSync(path.dirname(SQLITE_FILE), { recursive: true });
  const conn = new DatabaseSync(SQLITE_FILE);
  conn.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    CREATE TABLE IF NOT EXISTS docs (
      kind TEXT NOT NULL,
      id   TEXT NOT NULL,
      data TEXT NOT NULL,
      PRIMARY KEY (kind, id)
    );
  `);
  return {
    conn,
    upsert: conn.prepare('INSERT INTO docs (kind, id, data) VALUES (?, ?, ?) ON CONFLICT (kind, id) DO UPDATE SET data = excluded.data'),
    remove: conn.prepare('DELETE FROM docs WHERE kind = ? AND id = ?'),
    all: conn.prepare('SELECT kind, id, data FROM docs'),
  };
}

// guild:123, member:123:456, user:789, list:reminders
function rows() {
  const out = new Map();
  for (const [id, g] of Object.entries(data.guilds)) out.set(`guild\u0000${id}`, g);
  for (const [gid, ms] of Object.entries(data.members))
    for (const [uid, m] of Object.entries(ms)) out.set(`member\u0000${gid}:${uid}`, m);
  for (const [id, u] of Object.entries(data.users)) out.set(`user\u0000${id}`, u);
  for (const k of LISTS) out.set(`list\u0000${k}`, data[k]);
  return out;
}

function loadFromSqlite() {
  for (const r of sql.all.all()) {
    const doc = JSON.parse(r.data);
    written.set(`${r.kind}\u0000${r.id}`, r.data);
    if (r.kind === 'guild') data.guilds[r.id] = doc;
    else if (r.kind === 'user') data.users[r.id] = doc;
    else if (r.kind === 'list') data[r.id] = doc;
    else if (r.kind === 'member') {
      const [gid, uid] = r.id.split(':');
      (data.members[gid] ??= {})[uid] = doc;
    }
  }
}

function readJsonFile() {
  if (!fs.existsSync(JSON_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
  } catch (e) {
    console.error(`[db] couldn't read ${JSON_FILE}: ${e.message}`);
    return null;
  }
}

function writeAll() {
  if (!sql) {
    fs.mkdirSync(path.dirname(JSON_FILE), { recursive: true });
    // temp file + rename, so a crash mid-write can't leave a half-written db
    fs.writeFileSync(JSON_FILE + '.tmp', JSON.stringify(data));
    fs.renameSync(JSON_FILE + '.tmp', JSON_FILE);
    return;
  }
  const current = rows();
  sql.conn.exec('BEGIN');
  try {
    for (const [key, doc] of current) {
      const json = JSON.stringify(doc);
      if (written.get(key) === json) continue;
      const [kind, id] = key.split('\u0000');
      sql.upsert.run(kind, id, json);
      written.set(key, json);
    }
    for (const key of [...written.keys()])
      if (!current.has(key)) {
        const [kind, id] = key.split('\u0000');
        sql.remove.run(kind, id);
        written.delete(key);
      }
    sql.conn.exec('COMMIT');
  } catch (e) {
    sql.conn.exec('ROLLBACK');
    throw e;
  }
}

function init() {
  sql = process.env.DB_DRIVER === 'json' ? null : openSqlite();
  if (!sql) {
    data = { ...blank(), ...(readJsonFile() || {}) };
    if (process.env.DB_DRIVER !== 'json') console.warn('[db] node:sqlite not available (needs Node 22.5+), using the JSON file instead');
    return;
  }
  loadFromSqlite();
  const empty = !Object.keys(data.guilds).length && !Object.keys(data.users).length && !Object.keys(data.members).length;
  const legacy = empty ? readJsonFile() : null;
  if (legacy) {
    data = { ...blank(), ...legacy };
    writeAll();
    fs.renameSync(JSON_FILE, JSON_FILE + '.bak');
    console.log(`[db] moved ${Object.keys(data.guilds).length} servers and ${Object.keys(data.users).length} users from db.json into SQLite`);
  }
}

let timer = null;
function save() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    try {
      writeAll();
    } catch (e) {
      console.error('[db] save failed:', e.message);
    }
  }, 1500);
}
function flush() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  writeAll();
}

const guildDefaults = () => ({
  prefix: null,
  logChannel: null,
  // per-type log channels; anything unset falls back to logChannel
  logs: { messages: null, members: null, moderation: null, server: null, voice: null, ignored: [] },
  welcome: {
    channel: null,
    message: 'Hey {user}, welcome to **{server}**! You are member #{count}, make yourself at home. 🎉',
  },
  leave: { channel: null, message: '**{username}** has left the building. 👋' },
  autorole: null,
  levels: { enabled: true, channel: null, roles: {} },
  disabled: [],
  features: {},
  warns: {},
  notes: {},
  tags: {},
  customCommands: {},
  automod: {
    enabled: false,
    filters: {
      spam: { on: true, count: 6, seconds: 5 },
      duplicates: { on: true, count: 3, seconds: 30 },
      mentions: { on: true, max: 5 },
      links: { on: false, allow: ['tenor.com', 'giphy.com', 'youtube.com', 'youtu.be'] },
      invites: { on: true },
      caps: { on: true, percent: 70, min: 12 },
      emoji: { on: true, max: 10 },
      badwords: { on: true, words: [] },
      newlines: { on: false, max: 15 },
    },
    exemptRoles: [],
    exemptChannels: [],
    // Strikes stack up within `decayHours`, and each step fires once you reach it
    punishments: [
      { strikes: 3, action: 'timeout', duration: '10m' },
      { strikes: 5, action: 'timeout', duration: '1h' },
      { strikes: 7, action: 'kick' },
      { strikes: 10, action: 'ban' },
    ],
    decayHours: 24,
    strikes: {},
  },
  antiraid: { enabled: false, joins: 8, seconds: 10, action: 'timeout', minAccountDays: 0, raidUntil: 0 },
  antinuke: {
    enabled: false,
    limits: { channelDelete: 3, channelCreate: 6, roleDelete: 3, roleCreate: 6, ban: 4, kick: 5, webhookCreate: 3 },
    seconds: 30,
    punishment: 'strip',
    whitelist: [],
  },
  verify: { enabled: false, role: null, channel: null, mode: 'button', removeRole: null },
  tickets: { category: null, staffRoles: [], logChannel: null, counter: 0, open: {}, topics: [], maxOpen: 1 },
  selfRoles: { panels: {}, reactions: {} },
  starboard: { channel: null, emoji: '⭐', threshold: 3, selfStar: false, posts: {} },
  suggestions: { channel: null, counter: 0, items: {} },
  tempvc: { hub: null, category: null, name: "{user}'s room", active: {} },
  counting: { channel: null, current: 0, lastUser: null, best: 0, math: true },
  birthdays: { channel: null, role: null, message: 'Happy birthday {user}! 🎂', lastRun: null, roleHolders: [] },
  ai: { memories: [], knowledge: [], moderation: { enabled: false, action: 'flag', channels: [] } },
});

// backfills keys added after a guild was first saved, one level deep for nested settings
function guild(id) {
  data.guilds[id] ??= guildDefaults();
  const g = data.guilds[id];
  for (const [k, v] of Object.entries(guildDefaults())) {
    if (g[k] === undefined || g[k] === null) g[k] = v;
    else if (v && typeof v === 'object' && !Array.isArray(v) && typeof g[k] === 'object')
      for (const [kk, vv] of Object.entries(v)) g[k][kk] ??= vv;
  }
  return g;
}
function member(gid, uid) {
  data.members[gid] ??= {};
  data.members[gid][uid] ??= {};
  const m = data.members[gid][uid];
  m.wallet ??= 0;
  m.bank ??= 0;
  m.inv ??= {};
  m.cd ??= {};
  m.xp ??= 0;
  m.level ??= 0;
  m.msgs ??= 0;
  m.rep ??= 0;
  return m;
}
function members(gid) {
  return data.members[gid] || {};
}
function user(uid) {
  data.users[uid] ??= { afk: null, todos: [], bio: '', cookies: 0, lastRep: 0 };
  return data.users[uid];
}

init();

module.exports = {
  get data() {
    return data;
  },
  driver: () => (sql ? 'sqlite' : 'json'),
  save,
  flush,
  guild,
  member,
  members,
  user,
  guildDefaults,
};
