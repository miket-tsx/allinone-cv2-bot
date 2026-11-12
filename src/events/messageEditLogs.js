const { Events } = require('discord.js');
const { sendLog } = require('../lib/log');
const { C, trunc } = require('../lib/ui');

module.exports = {
  event: Events.MessageUpdate,
  async run(client, oldM, newM) {
    // Partial old messages have no content to diff against, and embed-only updates fire this event too.
    if (oldM.partial || !newM.guild || newM.author?.bot || oldM.content === newM.content) return;
    client.editSnipes.set(newM.channel.id, {
      before: oldM.content,
      after: newM.content,
      tag: newM.author.tag,
      avatar: newM.author.displayAvatarURL(),
      at: Date.now(),
      url: newM.url,
    });
    sendLog(newM.guild, {
      channelId: newM.channel.id,
      title: 'Someone had second thoughts ✏️',
      color: C.warn,
      fields: [
        ['Who', `<@${newM.author.id}>`],
        ['Where', `<#${newM.channel.id}> · [take me there](${newM.url})`],
        ['Before', trunc(oldM.content || '*(nothing here)*', 400)],
        ['After', trunc(newM.content || '*(nothing here)*', 400)],
      ],
    }, 'messages');
  },
};
