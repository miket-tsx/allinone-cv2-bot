const { Events } = require('discord.js');
const { sendLog } = require('../lib/log');
const { C, trunc } = require('../lib/ui');

module.exports = {
  event: Events.MessageDelete,
  async run(client, message) {
    // Partials have no content or author, so there's nothing useful to log
    if (message.partial || !message.guild || message.author?.bot) return;

    // Stash it so the snipe command can dig it back up
    client.snipes.set(message.channel.id, {
      content: message.content,
      authorId: message.author.id,
      tag: message.author.tag,
      avatar: message.author.displayAvatarURL(),
      at: Date.now(),
      image: message.attachments.find((a) => a.contentType?.startsWith('image/'))?.proxyURL || null,
    });
    sendLog(message.guild, {
      channelId: message.channel.id,
      title: 'Message deleted 🗑️',
      color: C.error,
      description: trunc(message.content || '*(no text, maybe just an attachment)*', 1500),
      fields: [
        ['Sent by', `<@${message.author.id}> (${message.author.tag})`],
        ['Where', `<#${message.channel.id}>`],
      ],
    }, 'messages');
  },
};
