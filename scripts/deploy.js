// Pushes the 100 slash commands to Discord. Set DEV_GUILD_ID for instant guild-only updates; without it you get global registration, which is slow.
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { loadCommands, slashCommands } = require('../src/lib/registry');

(async () => {
  const { DISCORD_TOKEN, CLIENT_ID, DEV_GUILD_ID } = process.env;
  if (!DISCORD_TOKEN || !CLIENT_ID) {
    console.error('Missing DISCORD_TOKEN or CLIENT_ID. Add them to your .env and try again.');
    process.exit(1);
  }
  const body = slashCommands(loadCommands().commands);
  const rest = new REST().setToken(DISCORD_TOKEN);
  const route = DEV_GUILD_ID
    ? Routes.applicationGuildCommands(CLIENT_ID, DEV_GUILD_ID)
    : Routes.applicationCommands(CLIENT_ID);
  const res = await rest.put(route, { body });
  console.log(
    `All set! Registered ${res.length} slash commands ${DEV_GUILD_ID ? `to guild ${DEV_GUILD_ID}` : 'globally (may take up to an hour to appear)'}.`,
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
