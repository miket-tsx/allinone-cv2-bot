// Per-server on/off switches. Modules are features with their own settings (automod, tickets...),
// command categories can be switched off wholesale (say, no economy in a serious server).
const db = require('./db');

// Modules that do nothing until an admin turns them on default to off; the rest default to on
const MODULES = {
  automod: { label: 'Automod filters and punishments', default: false, setting: (g) => g.automod.enabled },
  antiraid: { label: 'Anti-raid join protection', default: false, setting: (g) => g.antiraid.enabled },
  antinuke: { label: 'Anti-nuke admin protection', default: false, setting: (g) => g.antinuke.enabled },
  verification: { label: 'Member verification', default: false, setting: (g) => g.verify.enabled },
  logging: { label: 'Server logs', default: true },
  tickets: { label: 'Support tickets', default: true },
  selfroles: { label: 'Button and reaction roles', default: true },
  starboard: { label: 'Starboard', default: true },
  suggestions: { label: 'Suggestions', default: true },
  customcommands: { label: 'Custom commands', default: true },
  tempvc: { label: 'Temporary voice channels', default: true },
  schedules: { label: 'Scheduled messages', default: true },
  feeds: { label: 'YouTube, Twitch, Reddit and RSS alerts', default: true },
  counting: { label: 'Counting channel', default: true },
  birthdays: { label: 'Birthday announcements', default: true },
  leveling: { label: 'XP and levels', default: true },
  welcome: { label: 'Welcome and leave messages', default: true },
  music: { label: 'Music (optional install)', default: true },
  ai: { label: 'AI staff (mention the bot)', default: true },
  aimod: { label: 'AI message moderation', default: false, setting: (g) => g.ai.moderation.enabled },
};

// Modules with their own enabled flag keep using it, so `automod on` and `feature enable automod`
// stay in sync instead of fighting each other.
const SETTERS = {
  automod: (g, v) => (g.automod.enabled = v),
  antiraid: (g, v) => (g.antiraid.enabled = v),
  antinuke: (g, v) => (g.antinuke.enabled = v),
  verification: (g, v) => (g.verify.enabled = v),
  aimod: (g, v) => (g.ai.moderation.enabled = v),
};

function isOn(guildId, name) {
  if (!guildId) return true;
  const g = db.guild(guildId);
  const mod = MODULES[name];
  if (mod?.setting) return !!mod.setting(g);
  return g.features[name] ?? mod?.default ?? true;
}

function set(guildId, name, value) {
  const g = db.guild(guildId);
  if (SETTERS[name]) SETTERS[name](g, value);
  else g.features[name] = value;
  db.save();
}

// Command categories that can be turned off as a block. Admin categories stay on so nobody locks themselves out.
const LOCKED_CATEGORIES = new Set(['config', 'meta', 'moderation', 'features']);
const categoryOn = (guildId, category) => !guildId || db.guild(guildId).features[`cat:${category}`] !== false;

module.exports = { MODULES, isOn, set, categoryOn, LOCKED_CATEGORIES };
