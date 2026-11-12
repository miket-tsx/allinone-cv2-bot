const { Events, MessageFlags } = require('discord.js');
const { Ctx } = require('../lib/context');
const { execute } = require('../lib/handler');
const { fail } = require('../lib/ui');
const { UserError } = require('../lib/util');
const { resolveSlash } = require('../lib/registry');

module.exports = {
  event: Events.InteractionCreate,
  async run(client, interaction) {
    if (interaction.isChatInputCommand()) {
      const cmd = client.commands.get(resolveSlash(interaction));
      if (!cmd) return;
      const ctx = new Ctx({ client, interaction, prefix: '/', commandName: cmd.name });
      return execute(ctx, cmd);
    }
    if (interaction.isMessageComponent()) {
      const [name, ...parts] = interaction.customId.split(':');
      const cmd = client.commands.get(name);
      // collectors handle their own components
      if (!cmd?.onComponent) return;
      try {
        await cmd.onComponent(interaction, parts, client);
      } catch (e) {
        const msg =
          e instanceof UserError ? e.message : "Well, that didn't go as planned. Mind trying again?";
        if (!(e instanceof UserError)) console.error(`[component:${name}]`, e);
        const p = { ...fail(msg) };
        delete p.ephemeral;
        p.flags |= MessageFlags.Ephemeral;
        if (interaction.replied || interaction.deferred) interaction.followUp(p).catch(() => {});
        else interaction.reply(p).catch(() => {});
      }
    }
  },
};
