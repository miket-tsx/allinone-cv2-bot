require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');
const { loadCommands } = require('./lib/registry');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildExpressions,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.DirectMessages,
  ],
  // Partials let us react to old, uncached messages: DMs, starboard and reaction roles
  partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User, Partials.GuildMember],
});

const { commands, aliases } = loadCommands();
client.commands = commands;
client.aliases = aliases;
client.snipes = new Map();
client.editSnipes = new Map();
client.startedAt = Date.now();

for (const f of fs.readdirSync(path.join(__dirname, 'events')).filter((x) => x.endsWith('.js'))) {
  for (const ev of [].concat(require(path.join(__dirname, 'events', f)))) {
    client[ev.once ? 'once' : 'on'](ev.event, (...a) => ev.run(client, ...a));
  }
}
client.once(Events.ClientReady, (c) =>
  console.log(`Online as ${c.user.tag} with ${commands.size} commands ready to go.`),
);

// flush before exiting so pending writes don't get lost
const shutdown = () => {
  require('./lib/db').flush();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));

if (!process.env.DISCORD_TOKEN) {
  console.error("No DISCORD_TOKEN found in .env, and I can't log in without one.");
  process.exit(1);
}
client.login(process.env.DISCORD_TOKEN);
