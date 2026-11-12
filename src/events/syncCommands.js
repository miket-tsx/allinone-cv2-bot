// Slash commands are registered per server, so new servers get them instantly
// instead of waiting on Discord's global rollout.
const { Events } = require('discord.js');
const { slashCommands } = require('../lib/registry');

async function sync(guild) {
  const body = slashCommands(guild.client.commands);
  try {
    await guild.commands.set(body);
    console.log(`Slash commands ready in ${guild.name} (${body.length})`);
  } catch (err) {
    // 50001 means the bot was invited without the applications.commands scope.
    console.warn(`Couldn't register slash commands in ${guild.name}: ${err.message}`);
  }
}

module.exports = [
  {
    event: Events.ClientReady,
    once: true,
    async run(client) {
      for (const guild of client.guilds.cache.values()) await sync(guild);
    },
  },
  {
    event: Events.GuildCreate,
    run: (client, guild) => sync(guild),
  },
];
