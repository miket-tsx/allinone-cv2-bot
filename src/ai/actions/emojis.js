const { PermissionFlagsBits: P } = require('discord.js');
const { UserError } = require('../../lib/util');

const findEmoji = (env, ref) => {
  const q = String(ref).replace(/^:|:$/g, '').toLowerCase();
  const id = String(ref).match(/(\d{17,20})/)?.[1];
  const e =
    (id && env.guild.emojis.cache.get(id)) || env.guild.emojis.cache.find((x) => x.name.toLowerCase() === q);
  if (!e) throw new UserError(`There's no emoji called "${ref}" here.`);
  return e;
};

module.exports = [
  {
    name: 'list_emojis',
    description: 'List the custom emojis in the server',
    params: {},
    run: (env) => env.guild.emojis.cache.map((e) => `${e} :${e.name}:`).join(' ') || 'No custom emojis yet.',
  },
  {
    name: 'add_emoji',
    description: 'Upload a new custom emoji from an image URL',
    params: { name: 's! Emoji name (letters, numbers, underscores)', url: 's! Image URL, under 256KB' },
    perms: [P.ManageGuildExpressions],
    confirm: true,
    async run(env, a) {
      const e = await env.guild.emojis.create({
        attachment: a.url,
        name: a.name.replace(/[^\w]/g, '_'),
        reason: env.reason,
      });
      return `Added ${e}.`;
    },
  },
  {
    name: 'rename_emoji',
    description: 'Rename a custom emoji',
    params: { emoji: 's! Emoji', name: 's! New name' },
    perms: [P.ManageGuildExpressions],
    confirm: true,
    async run(env, a) {
      const e = findEmoji(env, a.emoji);
      await e.setName(a.name.replace(/[^\w]/g, '_'), env.reason);
      return `Renamed it to :${e.name}:.`;
    },
  },
  {
    name: 'delete_emoji',
    description: 'Delete a custom emoji',
    params: { emoji: 's! Emoji' },
    perms: [P.ManageGuildExpressions],
    confirm: true,
    danger: true,
    async run(env, a) {
      const e = findEmoji(env, a.emoji);
      await e.delete(env.reason);
      return `Deleted :${e.name}:.`;
    },
  },
  {
    name: 'list_stickers',
    description: 'List the custom stickers in the server',
    params: {},
    async run(env) {
      const stickers = await env.guild.stickers.fetch();
      return stickers.map((s) => s.name).join(', ') || 'No custom stickers.';
    },
  },
];
