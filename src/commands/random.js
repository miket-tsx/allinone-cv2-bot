const crypto = require('crypto');
const { PermissionFlagsBits: P } = require('discord.js');
const db = require('../lib/db');
const giveaways = require('../lib/giveaways');
const { card, ok, C } = require('../lib/ui');
const { pick, randInt, shuffle, assert, parseDur, fmtDur, codeblock } = require('../lib/util');

const L = {
  first: [
    'Ava',
    'Liam',
    'Noah',
    'Mia',
    'Zara',
    'Kai',
    'Aria',
    'Leo',
    'Ivy',
    'Arjun',
    'Yuki',
    'Omar',
    'Sofia',
    'Mateo',
    'Nora',
    'Ezra',
    'Luna',
    'Rohan',
    'Elena',
    'Felix',
  ],
  last: [
    'Smith',
    'Patel',
    'Kim',
    'Garcia',
    'Nguyen',
    'Silva',
    'Müller',
    'Rossi',
    'Tanaka',
    'Khan',
    'Brown',
    'Lopez',
    'Ivanova',
    'Okafor',
    'Haddad',
    'Jensen',
    'Sharma',
    'Cohen',
    'Moreau',
    'Walsh',
  ],
  words: [
    'nebula',
    'lantern',
    'cobalt',
    'whisper',
    'meadow',
    'quartz',
    'harbor',
    'ember',
    'falcon',
    'velvet',
    'tundra',
    'pixel',
    'saffron',
    'glacier',
    'orbit',
    'canyon',
    'maple',
    'thunder',
    'cipher',
    'zephyr',
    'lotus',
    'atlas',
    'comet',
    'prism',
  ],
  animals: [
    '🦊 Fox',
    '🐼 Panda',
    '🦉 Owl',
    '🐙 Octopus',
    '🦒 Giraffe',
    '🐢 Turtle',
    '🦁 Lion',
    '🐧 Penguin',
    '🦦 Otter',
    '🐨 Koala',
    '🦈 Shark',
    '🦜 Parrot',
    '🐺 Wolf',
    '🦔 Hedgehog',
    '🐬 Dolphin',
    '🦩 Flamingo',
  ],
  food: [
    '🍕 Pizza',
    '🍣 Sushi',
    '🌮 Tacos',
    '🍜 Ramen',
    '🍔 Burger',
    '🥗 Salad',
    '🍛 Biryani',
    '🥘 Paella',
    '🍝 Pasta',
    '🥟 Dumplings',
    '🌯 Burrito',
    '🍲 Pho',
    '🧆 Falafel',
    '🥞 Pancakes',
    '🍗 Fried chicken',
  ],
  countries: [
    'Japan',
    'Brazil',
    'India',
    'Canada',
    'Kenya',
    'Norway',
    'Mexico',
    'Italy',
    'Vietnam',
    'Australia',
    'Egypt',
    'Peru',
    'Iceland',
    'Morocco',
    'South Korea',
    'Portugal',
    'New Zealand',
    'Argentina',
    'Thailand',
    'Greece',
  ],
  emojis: [
    '😀',
    '😂',
    '🥹',
    '😎',
    '🤖',
    '👻',
    '🐸',
    '🦄',
    '🍕',
    '🚀',
    '🌈',
    '⚡',
    '🔥',
    '💎',
    '🎉',
    '🎮',
    '🧠',
    '🌙',
    '🍀',
    '🎧',
    '🐳',
    '🍩',
    '🌵',
    '🪐',
  ],
  tarot: [
    'The Fool — new beginnings',
    'The Magician — willpower',
    'The High Priestess — intuition',
    'The Empress — abundance',
    'The Emperor — structure',
    'The Lovers — choices',
    'The Chariot — determination',
    'Strength — courage',
    'The Hermit — reflection',
    'Wheel of Fortune — change',
    'Justice — fairness',
    'The Star — hope',
    'The Moon — the unknown',
    'The Sun — joy',
    'The World — completion',
  ],
  colors: [
    'Red',
    'Orange',
    'Yellow',
    'Green',
    'Blue',
    'Indigo',
    'Violet',
    'Pink',
    'Teal',
    'Gold',
    'Silver',
    'Black',
    'White',
    'Brown',
    'Turquoise',
    'Magenta',
  ],
};
const listPick = (name, description, title, list, aliases = []) => ({
  name,
  description,
  aliases,
  async run() {
    return card({ title, description: `**${pick(list)}**`, color: C.fun });
  },
});
const items = (s) =>
  s
    .split(/\||,|\n/)
    .map((x) => x.trim())
    .filter(Boolean);

module.exports = [
  {
    name: 'random',
    description: 'Roll a random number between min and max',
    aliases: ['rng', 'randomnumber'],
    options: [
      { name: 'min', type: 'integer', required: true, description: 'Lowest number allowed' },
      { name: 'max', type: 'integer', required: true, description: 'Highest number allowed' },
    ],
    async run(ctx, a) {
      assert(a.min <= a.max, "min can't be bigger than max. Nice try, though.");
      return card({
        description: `🎲 **${randInt(a.min, a.max)}** (somewhere between ${a.min} and ${a.max})`,
        color: C.fun,
      });
    },
  },
  {
    name: 'randommember',
    description: 'Pick a random member, optionally limited to one role',
    guildOnly: true,
    aliases: ['randomuser'],
    options: [{ name: 'role', type: 'role', description: 'Only pick from members with this role' }],
    async run(ctx, a) {
      const all = await ctx.guild.members.fetch();
      const pool = all.filter((m) => !m.user.bot && (!a.role || m.roles.cache.has(a.role.id)));
      assert(pool.size, "Nobody's eligible. The pool is bone dry.");
      const m = pool.random();
      return card({
        description: `🎯 The universe has chosen: **${m.user.username}** (${m})`,
        thumbnail: m.user.displayAvatarURL(),
        color: C.fun,
      });
    },
  },
  {
    name: 'password',
    description: 'Generate a strong random password (only you see it with slash)',
    aliases: ['pass', 'genpass'],
    options: [
      { name: 'length', type: 'integer', min: 8, max: 128, description: 'How long to make it (default 20)' },
    ],
    async run(ctx, a) {
      // No I, l, O, 0 or 1: they're easy to misread when typing a password by hand
      const set = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+';
      const n = a.length || 20;
      const pw = Array.from(crypto.randomBytes(n), (b) => set[b % set.length]).join('');
      return {
        ...card({
          title: '🔐 Fresh password',
          description: codeblock(pw),
          footer: 'Made with crypto.randomBytes and never stored. Still, get a password manager!',
          color: C.success,
        }),
        ephemeral: true,
      };
    },
  },
  {
    name: 'uuid',
    description: 'Generate a random UUID v4',
    aliases: ['guid'],
    options: [
      { name: 'count', type: 'integer', min: 1, max: 20, description: 'How many you want (default 1)' },
    ],
    async run(ctx, a) {
      return card({
        description: codeblock(Array.from({ length: a.count || 1 }, () => crypto.randomUUID()).join('\n')),
        color: C.info,
      });
    },
  },
  {
    name: 'randomletter',
    description: 'Get a random letter from A to Z',
    async run() {
      return card({ description: `🔤 **${String.fromCharCode(65 + randInt(0, 25))}**`, color: C.fun });
    },
  },
  listPick('randomword', 'Get a random word, no context included', '📖 Your word', L.words),
  {
    name: 'randomname',
    description: 'Dream up a random full name',
    async run() {
      return card({ description: `🪪 **${pick(L.first)} ${pick(L.last)}**`, color: C.fun });
    },
  },
  listPick('randomanimal', 'Meet a random animal', '🐾 Say hi to', L.animals),
  listPick('randomfood', "Can't decide what to eat? Let fate choose", '🍽️ Go eat this', L.food, [
    'whattoeat',
  ]),
  listPick('randomcountry', 'Get a random country for your next daydream', '🌍 Pack your bags', L.countries),
  {
    name: 'randomemoji',
    description: 'Spit out some random emojis',
    options: [
      { name: 'count', type: 'integer', min: 1, max: 30, description: 'How many you want (default 1)' },
    ],
    async run(ctx, a) {
      return card({
        description: Array.from({ length: a.count || 1 }, () => pick(L.emojis)).join(' '),
        color: C.fun,
      });
    },
  },
  listPick('randomcolorname', 'Get a random color name', '🎨 Your color', L.colors),
  listPick('tarot', 'Draw a tarot card (results not legally binding)', '🔮 Your card', L.tarot),
  {
    name: 'randomcard',
    description: 'Draw a random card from the deck',
    aliases: ['drawcard'],
    async run() {
      return card({
        description: `🃏 **${pick(['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'])}${pick(['♠️', '♥️', '♦️', '♣️'])}**`,
        color: C.fun,
      });
    },
  },
  {
    name: 'randomdate',
    description: 'Get a random date somewhere between 1900 and 2100',
    async run() {
      const d = new Date(randInt(Date.UTC(1900, 0, 1), Date.UTC(2100, 0, 1)));
      return card({
        description: `📅 **${d.toISOString().slice(0, 10)}** (${d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })})`,
        color: C.fun,
      });
    },
  },
  {
    name: 'lotto',
    description: 'Generate your lucky lottery numbers (6 of 49)',
    async run() {
      return card({
        description: `🎟️ ${shuffle(Array.from({ length: 49 }, (_, i) => i + 1))
          .slice(0, 6)
          .sort((a, b) => a - b)
          .join(' · ')}`,
        color: C.fun,
      });
    },
  },
  {
    name: 'coinflips',
    description: 'Flip a coin a whole bunch of times',
    options: [
      { name: 'times', type: 'integer', required: true, min: 1, max: 1000, description: 'How many flips' },
    ],
    async run(ctx, a) {
      let h = 0;
      for (let i = 0; i < a.times; i++) if (Math.random() < 0.5) h++;
      return card({
        title: `🪙 ${a.times} flips`,
        fields: [
          ['Heads', `${h} (${((h / a.times) * 100).toFixed(1)}%)`],
          ['Tails', `${a.times - h} (${(((a.times - h) / a.times) * 100).toFixed(1)}%)`],
        ],
        color: C.fun,
      });
    },
  },
  {
    name: 'shuffle',
    description: 'Shuffle a list (a, b, c or a | b | c)',
    options: [
      { name: 'items', type: 'string', required: true, description: 'Your list, split by commas or |' },
    ],
    async run(ctx, a) {
      const it = items(a.items);
      assert(it.length >= 2, 'Shuffling one thing just gives you that thing. Give me at least 2.');
      return card({
        title: '🔀 Shuffled',
        description: shuffle(it)
          .map((x, i) => `**${i + 1}.** ${x}`)
          .join('\n'),
        color: C.fun,
      });
    },
  },
  {
    name: 'teams',
    description: 'Split a list of names into N random teams',
    options: [
      { name: 'count', type: 'integer', required: true, min: 2, max: 10, description: 'How many teams' },
      { name: 'names', type: 'string', required: true, description: 'Names separated by commas or |' },
    ],
    async run(ctx, a) {
      const n = items(a.names);
      assert(n.length >= a.count, 'Not enough names, every team needs at least one person.');
      const s = shuffle(n);
      const t = Array.from({ length: a.count }, () => []);
      s.forEach((x, i) => t[i % a.count].push(x));
      return card({
        title: '👥 Teams',
        description: t.map((x, i) => `**Team ${i + 1}:** ${x.join(', ')}`).join('\n'),
        color: C.fun,
      });
    },
  },
  {
    name: 'gstart',
    description: 'Start a giveaway, e.g. gstart 1h 1 Nitro',
    guildOnly: true,
    perms: [P.ManageGuild],
    aliases: ['giveaway'],
    options: [
      {
        name: 'duration',
        type: 'string',
        required: true,
        description: 'How long it runs, e.g. 30m or 1d',
        rest: false,
      },
      {
        name: 'winners',
        type: 'integer',
        required: true,
        min: 1,
        max: 20,
        description: 'How many lucky winners',
      },
      { name: 'prize', type: 'string', required: true, description: "What you're giving away" },
    ],
    async run(ctx, a) {
      const ms = parseDur(a.duration);
      assert(
        ms && ms >= 10000 && ms <= 30 * 86400000,
        'Pick a duration between 10s and 30d. Shorter is a blink, longer is a commitment.',
      );
      const g = {
        id: crypto.randomBytes(4).toString('hex'),
        guildId: ctx.guild.id,
        channelId: ctx.channel.id,
        messageId: null,
        hostId: ctx.user.id,
        prize: a.prize.slice(0, 200),
        winnerCount: a.winners,
        endsAt: Date.now() + ms,
        entries: [],
        ended: false,
        winners: [],
      };
      // parse: [] so a prize like "@everyone" can't ping anyone
      const msg = await ctx.channel.send({ ...giveaways.render(g), allowedMentions: { parse: [] } });
      g.messageId = msg.id;
      db.data.giveaways.push(g);
      db.save();
      if (ctx.message) ctx.message.delete().catch(() => {});
      else
        return { ...ok(`Giveaway is live! It wraps up in ${fmtDur(ms)}. ID: \`${g.id}\``), ephemeral: true };
    },
    async onComponent(i, [action, id]) {
      const g = db.data.giveaways.find((x) => x.id === id);
      assert(g && !g.ended, 'Too late, this giveaway has already ended.');
      const idx = g.entries.indexOf(i.user.id);
      if (idx >= 0) g.entries.splice(idx, 1);
      else g.entries.push(i.user.id);
      db.save();
      await i.update({ ...giveaways.render(g), allowedMentions: { parse: [] } });
      // 64 = ephemeral, so joins and leaves don't clutter the channel
      await i.followUp({
        ...card({
          description: idx >= 0 ? "You're out. No hard feelings." : "🎉 You're in! Fingers crossed.",
        }),
        flags: card({}).flags | 64,
      });
    },
  },
  {
    name: 'gend',
    description: 'End a giveaway right now',
    guildOnly: true,
    perms: [P.ManageGuild],
    options: [
      { name: 'id', type: 'string', required: true, description: "Giveaway ID (it's in the footer)" },
    ],
    async run(ctx, a) {
      const g = db.data.giveaways.find((x) => x.id === a.id && x.guildId === ctx.guild.id);
      assert(g && !g.ended, "Couldn't find a running giveaway with that ID.");
      await giveaways.end(ctx.client, g);
      return ok('Giveaway ended. Hope somebody is happy!');
    },
  },
  {
    name: 'greroll',
    description: 'Reroll the winner(s) of a giveaway that has ended',
    guildOnly: true,
    perms: [P.ManageGuild],
    options: [{ name: 'id', type: 'string', required: true, description: 'ID of the ended giveaway' }],
    async run(ctx, a) {
      const g = db.data.giveaways.find((x) => x.id === a.id && x.guildId === ctx.guild.id);
      assert(g?.ended, "I can't find an ended giveaway with that ID.");
      assert(g.entries.length, "Nobody entered, so there's no one to reroll.");
      g.winners = giveaways.draw(g);
      db.save();
      return {
        ...card({
          description: `🎊 Fresh winner(s) for **${g.prize}**: ${g.winners.map((w) => `<@${w}>`).join(', ')}`,
          color: C.success,
        }),
        allowedMentions: { users: g.winners },
      };
    },
  },
  {
    name: 'glist',
    description: 'See which giveaways are running right now',
    guildOnly: true,
    async run(ctx) {
      const l = db.data.giveaways.filter((g) => g.guildId === ctx.guild.id && !g.ended);
      return card({
        title: '🎉 Running giveaways',
        description: l.length
          ? l
              .map(
                (g) =>
                  `\`${g.id}\` **${g.prize}** — ${g.entries.length} entries — ends <t:${Math.floor(g.endsAt / 1000)}:R> in <#${g.channelId}>`,
              )
              .join('\n')
          : 'Nothing running right now. Maybe start one?',
        color: C.fun,
      });
    },
  },
  {
    name: 'pickfrom',
    description: 'Pick N random items from a list',
    options: [
      { name: 'count', type: 'integer', required: true, min: 1, max: 50, description: 'How many to pick' },
      { name: 'items', type: 'string', required: true, description: 'Your items, separated by commas' },
    ],
    async run(ctx, a) {
      const it = items(a.items);
      assert(it.length >= a.count, 'You asked for more items than you gave me.');
      return card({ description: `🎯 ${shuffle(it).slice(0, a.count).join(', ')}`, color: C.fun });
    },
  },
  {
    name: 'yesno',
    description: 'Let fate answer your yes/no question',
    async run() {
      return card({ description: `**${pick(['Yes ✅', 'No ❌'])}**`, color: C.fun });
    },
  },
  {
    name: 'randomhex',
    description: 'Generate a random hex string',
    options: [
      { name: 'bytes', type: 'integer', min: 1, max: 64, description: 'How many bytes (default 16)' },
    ],
    async run(ctx, a) {
      return card({
        description: codeblock(crypto.randomBytes(a.bytes || 16).toString('hex')),
        color: C.info,
      });
    },
  },
  {
    name: 'randomip',
    description: 'Make up a random IPv4 address (probably not real)',
    async run() {
      return card({
        description: `\`${[randInt(1, 223), randInt(0, 255), randInt(0, 255), randInt(1, 254)].join('.')}\``,
        color: C.info,
      });
    },
  },
];
