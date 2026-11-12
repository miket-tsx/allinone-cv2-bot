// Help menus are Components V2 cards: a category select plus paginated lists.
const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { card, C } = require('../lib/ui');
const { assert, chunk } = require('../lib/util');
const db = require('../lib/db');

const ICON = {
  actions: '🤗',
  color: '🎨',
  config: '⚙️',
  convert: '🔁',
  dev: '💻',
  economy: '💰',
  fun: '🎉',
  images: '🖼️',
  leveling: '📈',
  math: '🧮',
  meta: '📖',
  moderation: '🛡️',
  random: '🎲',
  text: '🔤',
  utility: '🧰',
  ai: '🤖',
  automation: '⏰',
  automod: '🚫',
  backup: '💾',
  community: '🏘️',
  customcommands: '🧷',
  features: '🧩',
  logging: '📜',
  music: '🎶',
  security: '🔐',
  selfroles: '🏷️',
  tempvc: '🔊',
  tickets: '🎫',
  web: '🌐',
};
const PER = 15;

function cats(client) {
  const m = {};
  for (const c of client.commands.values()) (m[c.category] ||= []).push(c);
  return m;
}
// A select menu holds 25 options at most, so the categories are split over two menus
function menu(client, selected) {
  const m = cats(client);
  const keys = Object.keys(m).sort();
  const half = Math.ceil(keys.length / 2);
  const groups = keys.length > 25 ? [keys.slice(0, half), keys.slice(half)] : [keys];
  return groups.map((part, n) =>
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`help:cat:${n}`)
        .setPlaceholder(groups.length > 1 ? `Categories ${part[0]} to ${part.at(-1)}` : 'Pick a category')
        .addOptions(
          part.map((k) => ({
            label: `${k[0].toUpperCase() + k.slice(1)} (${m[k].length})`,
            value: k,
            emoji: ICON[k] || '📁',
            default: k === selected,
          })),
        ),
    ),
  );
}
function home(client, prefix) {
  const m = cats(client);
  const slash = require('../slash').length;
  return card({
    title: '📖 Help',
    color: C.primary,
    description: `**${client.commands.size}** prefix commands and **${slash}** slash commands, all at your service.\nMy prefix here is \`${prefix}\`. Try \`${prefix}help <command>\` when you want the details.`,
    fields: Object.keys(m)
      .sort()
      .map((k) => [`${ICON[k] || '📁'} ${k}`, `${m[k].length} commands`]),
    rows: menu(client),
  });
}
function page(client, cat, p, prefix) {
  const list = cats(client)[cat] || [];
  const pages = chunk(list, PER);
  // clamp so a stale button can't walk off either end
  p = Math.max(0, Math.min(p, pages.length - 1));
  const nav = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`help:page:${cat}:${p - 1}`)
      .setLabel('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(p === 0),
    new ButtonBuilder()
      .setCustomId('help:noop')
      .setLabel(`${p + 1}/${pages.length}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`help:page:${cat}:${p + 1}`)
      .setLabel('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(p >= pages.length - 1),
    new ButtonBuilder().setCustomId('help:home').setLabel('Back home').setStyle(ButtonStyle.Primary),
  );
  return card({
    title: `${ICON[cat] || '📁'} ${cat} — ${list.length} commands`,
    description: pages[p].map((c) => `\`${prefix}${c.name}\` — ${c.description}`).join('\n'),
    color: C.primary,
    rows: [...menu(client, cat), nav],
  });
}
const prefixFor = (i) => (i.guild && db.guild(i.guild.id).prefix) || process.env.DEFAULT_PREFIX || '!';

module.exports = [
  {
    name: 'help',
    description: 'Browse commands by category, or dig into one in detail',
    aliases: ['h', 'commands', 'cmds'],
    options: [{ name: 'command', type: 'string', description: 'A command or category to look up' }],
    async run(ctx, a) {
      const p = ctx.isSlash ? prefixFor(ctx) : ctx.prefix;
      if (!a.command) return home(ctx.client, p);
      const q = a.command.toLowerCase().replace(/^[/!]/, '');
      if (cats(ctx.client)[q]) return page(ctx.client, q, 0, p);
      const c = ctx.client.commands.get(q) || ctx.client.commands.get(ctx.client.aliases.get(q));
      assert(c, `Hmm, I don't know any command or category called \`${q}\`.`);
      const label = require('../lib/registry').slashLabel(c.name);
      return card({
        title: `${p}${c.name}`,
        description: c.description,
        color: C.primary,
        fields: [
          [
            'Usage',
            `\`${p}${c.name}${c.options.map((o) => (o.required ? ` <${o.name}>` : ` [${o.name}]`)).join('')}\``,
          ],
          [
            'Options',
            c.options
              .map(
                (o) =>
                  `\`${o.name}\` (${o.type || 'text'}${o.required ? ', required' : ''}) — ${o.description}`,
              )
              .join('\n') || 'None, just run it',
          ],
          ['Aliases', c.aliases.map((x) => `\`${x}\``).join(', ') || 'None'],
          ['Category', c.category],
          ['Slash', label ? `✅ ${label}` : 'Prefix only, no slash version yet'],
          ['Cooldown', `${c.cooldown ?? 2}s`],
        ],
      });
    },
    async onComponent(i, parts, client) {
      const p = prefixFor(i);
      if (parts[0] === 'home') return i.update(home(client, p));
      if (parts[0] === 'cat') return i.update(page(client, i.values[0], 0, p));
      if (parts[0] === 'page') return i.update(page(client, parts[1], Number(parts[2]), p));
    },
  },
  {
    name: 'slashlist',
    description: 'Every slash command I know, all in one place',
    aliases: ['slashcommands'],
    async run() {
      const SL = require('../slash');
      return card({
        title: `/ ${SL.length} slash commands`,
        description: SL.map((e) => (typeof e === 'string' ? `\`/${e}\`` : `\`/${e.name}\` (${Object.keys(e.sub).length} subcommands)`)).join(' '),
        color: C.primary,
      });
    },
  },
  {
    name: 'categories',
    description: 'See which categories exist and how many commands each has',
    async run(ctx) {
      const m = cats(ctx.client);
      return card({
        title: 'Categories',
        description: Object.keys(m)
          .sort()
          .map((k) => `${ICON[k] || '📁'} **${k}** — ${m[k].length}`)
          .join('\n'),
        color: C.primary,
      });
    },
  },
  {
    name: 'searchcommands',
    description: "Can't remember a command? Search by keyword",
    aliases: ['findcmd'],
    options: [{ name: 'query', type: 'string', required: true, description: 'What to search for' }],
    async run(ctx, a) {
      const q = a.query.toLowerCase();
      const r = [...ctx.client.commands.values()]
        .filter((c) => c.name.includes(q) || c.description.toLowerCase().includes(q))
        .slice(0, 30);
      assert(r.length, 'Nothing matched that. Maybe try a shorter keyword?');
      return card({
        title: `Commands matching “${a.query}”`,
        description: r.map((c) => `\`${c.name}\` — ${c.description}`).join('\n'),
        color: C.primary,
      });
    },
  },
];
