// One context object so every command works as both a prefix and a slash command.
const { MessageFlags } = require('discord.js');
const { card } = require('./ui');

function normalize(out) {
  if (typeof out === 'string') return card({ description: out });
  if (out && Array.isArray(out.components)) return { ...out };
  return card(out || {});
}

class Ctx {
  constructor({ client, message = null, interaction = null, prefix = '/', commandName }) {
    this.client = client;
    this.message = message;
    this.interaction = interaction;
    this.prefix = prefix;
    this.commandName = commandName;
    this.isSlash = !!interaction;
  }
  get user() {
    return this.interaction ? this.interaction.user : this.message.author;
  }
  get member() {
    return this.interaction ? this.interaction.member : this.message.member;
  }
  get guild() {
    return (this.interaction || this.message).guild;
  }
  get channel() {
    return (this.interaction || this.message).channel;
  }
  get createdAt() {
    return (this.interaction || this.message).createdAt;
  }

  async reply(out) {
    const payload = normalize(out);
    const eph = payload.ephemeral;
    delete payload.ephemeral;
    payload.allowedMentions ??= { parse: ['users'], repliedUser: false };
    if (this.isSlash) {
      const i = this.interaction;
      // First reply after a defer has to edit the placeholder; anything after that is a follow-up
      if (i.deferred && !this._edited) {
        this._edited = true;
        await i.editReply(payload);
        return i.fetchReply();
      }
      if (i.replied || i.deferred)
        return i.followUp({ ...payload, flags: payload.flags | (eph ? MessageFlags.Ephemeral : 0) });
      await i.reply({ ...payload, flags: payload.flags | (eph ? MessageFlags.Ephemeral : 0) });
      return i.fetchReply();
    }
    try {
      return await this.message.reply(payload);
    } catch {
      // The original message is probably gone, so just post in the channel
      return this.channel.send(payload);
    }
  }

  async getMember(user) {
    if (!this.guild || !user) return null;
    return this.guild.members.fetch(user.id).catch(() => null);
  }
}

module.exports = { Ctx, normalize };
