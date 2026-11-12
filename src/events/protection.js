// Anti-raid hears every join, anti-nuke reads every audit log entry. All the logic is in lib/security.
const { Events } = require('discord.js');
const security = require('../lib/security');

module.exports = [
  {
    event: Events.GuildMemberAdd,
    run: (client, member) => security.onJoin(member).catch((e) => console.error('[antiraid]', e)),
  },
  {
    event: Events.GuildAuditLogEntryCreate,
    run: (client, entry, guild) => security.onAudit(entry, guild).catch((e) => console.error('[antinuke]', e)),
  },
];
