const { Events } = require('discord.js');
const db = require('../lib/db');
const { card, C } = require('../lib/ui');
const { sendLog, fill } = require('../lib/log');
const { ts } = require('../lib/util');

module.exports = {
  event: Events.GuildMemberAdd,
  async run(client, member) {
    const g = db.guild(member.guild.id);
    // Role/welcome failures (missing perms, deleted channel) shouldn't block the join log
    if (g.autorole) member.roles.add(g.autorole).catch(() => {});
    if (g.welcome.channel) {
      const ch = member.guild.channels.cache.get(g.welcome.channel);
      ch?.send({
        ...card({
          title: 'Welcome aboard!',
          description: fill(g.welcome.message, member),
          thumbnail: member.user.displayAvatarURL({ size: 256 }),
          color: C.success,
        }),
        allowedMentions: { users: [member.id] },
      }).catch(() => {});
    }
    sendLog(member.guild, {
      title: 'New member',
      color: C.success,
      description: `<@${member.id}> (${member.user.tag})`,
      fields: [['Account age', ts(member.user.createdAt, 'R')]],
    }, 'members');
  },
};
