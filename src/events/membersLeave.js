const { Events } = require('discord.js');
const db = require('../lib/db');
const { card, C } = require('../lib/ui');
const { sendLog, fill } = require('../lib/log');

module.exports = {
  event: Events.GuildMemberRemove,
  async run(client, member) {
    const g = db.guild(member.guild.id);
    if (g.leave.channel) {
      const ch = member.guild.channels.cache.get(g.leave.channel);
      // The channel may have been deleted or locked down; a failed goodbye isn't worth crashing over.
      ch?.send({
        ...card({ description: fill(g.leave.message, member), color: C.warn }),
        allowedMentions: { parse: [] },
      }).catch(() => {});
    }
    sendLog(member.guild, {
      title: 'Someone slipped out the back 👋',
      color: C.warn,
      description: `${member.user.tag} (${member.id})`,
    }, 'members');
  },
};
