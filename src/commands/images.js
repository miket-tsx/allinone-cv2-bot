// Animal pictures, memes and assorted fun images from free public APIs.
const { card, C } = require('../lib/ui');
const { fetchJson, assert, pick, randInt } = require('../lib/util');

const img = (name, description, url, map, aliases = []) => ({
  name,
  description,
  aliases,
  defer: true,
  cooldown: 3,
  async run() {
    const d = await fetchJson(url);
    const o = map(d);
    return card({ title: o.title, image: o.url, footer: o.footer, color: C.fun });
  },
});
const nb = (ep, title) =>
  img(ep, `A fresh ${ep} pic, safe for work`, `https://nekos.best/api/v2/${ep}`, (d) => ({
    title,
    url: d.results[0].url,
    footer: d.results[0].artist_name ? `Art: ${d.results[0].artist_name}` : null,
  }));
// The description is derived from the title by dropping the leading emoji.
const breed = (name, b, title) =>
  img(
    name,
    `A random ${title.split(' ').slice(1).join(' ')}, fresh from the park`,
    `https://dog.ceo/api/breed/${b}/images/random`,
    (d) => ({ title, url: d.message }),
  );

module.exports = [
  img(
    'cat',
    'A random cat, no questions asked',
    'https://api.thecatapi.com/v1/images/search',
    (d) => ({ title: '🐱 Meow', url: d[0].url }),
    ['kitty'],
  ),
  img(
    'dog',
    'A random good dog',
    'https://dog.ceo/api/breeds/image/random',
    (d) => ({ title: '🐶 Woof', url: d.message, footer: d.message.split('/')[4] }),
    ['doggo', 'puppy'],
  ),
  img('fox', 'A random fox, extra floofy', 'https://randomfox.ca/floof/', (d) => ({
    title: '🦊 Floof',
    url: d.image,
  })),
  img('duck', 'A random duck, mostly quacking', 'https://random-d.uk/api/v2/random', (d) => ({
    title: '🦆 Quack',
    url: d.url,
  })),
  breed('shiba', 'shiba', '🐕 Shiba Inu'),
  breed('husky', 'husky', '🐺 Husky'),
  breed('corgi', 'pembroke', '🐕 Corgi'),
  breed('pug', 'pug', '🐶 Pug'),
  breed('goldenretriever', 'retriever/golden', '🐕 Golden Retriever'),
  breed('beagle', 'beagle', '🐶 Beagle'),
  breed('samoyed', 'samoyed', '🐕 Samoyed'),
  img(
    'meme',
    'A random meme, fresh off Reddit',
    'https://meme-api.com/gimme',
    (d) => ({ title: d.title.slice(0, 200), url: d.url, footer: `r/${d.subreddit} · 👍 ${d.ups}` }),
    ['memes'],
  ),
  // api.waifu.pics stopped resolving, so this rides on nekos.best like the others
  nb('waifu', '✨ Waifu'),
  nb('neko', '🐾 Neko'),
  nb('kitsune', '🦊 Kitsune'),
  nb('husbando', '✨ Husbando'),
  img(
    'coffee',
    'A random coffee, since we all need one',
    'https://coffee.alexflipnote.dev/random.json',
    (d) => ({
      title: '☕ Coffee',
      url: d.file,
    }),
  ),
  {
    name: 'dogbreed',
    description: 'A picture of the dog breed of your choice',
    defer: true,
    options: [
      {
        name: 'breed',
        type: 'string',
        required: true,
        lower: true,
        description: 'Breed name, e.g. pug, beagle, or "retriever golden"',
      },
    ],
    async run(ctx, a) {
      // dog.ceo wants the parent breed first: "golden retriever" -> "retriever/golden"
      const b = a.breed.trim().split(/\s+/).reverse().join('/');
      const d = await fetchJson(`https://dog.ceo/api/breed/${b}/images/random`).catch(() => null);
      assert(
        d?.status === 'success',
        'Never heard of that breed. Try `pug`, `beagle`, `corgi` or `retriever golden`.',
      );
      return card({ title: `🐶 ${a.breed}`, image: d.message, color: C.fun });
    },
  },
  {
    name: 'reddit',
    description: 'A random image post from any subreddit (SFW only)',
    defer: true,
    cooldown: 4,
    options: [{ name: 'subreddit', type: 'string', required: true, description: 'Which subreddit to raid' }],
    async run(ctx, a) {
      const s = a.subreddit.replace(/^r\//i, '').replace(/[^\w]/g, '');
      const d = await fetchJson(`https://meme-api.com/gimme/${s}`);
      assert(!d.nsfw, "That one's NSFW, so I'm keeping it to myself. Roll again?");
      return card({
        title: d.title.slice(0, 200),
        image: d.url,
        footer: `r/${d.subreddit} · 👍 ${d.ups}`,
        color: C.fun,
      });
    },
  },
  {
    name: 'xkcd',
    description: 'An xkcd comic: the latest, a random one, or pick a number',
    defer: true,
    options: [{ name: 'number', type: 'string', description: 'Comic number, or "random" to roll the dice' }],
    async run(ctx, a) {
      const latest = await fetchJson('https://xkcd.com/info.0.json');
      let n = latest.num;
      if (a.number === 'random' || a.number === 'r') n = randInt(1, latest.num);
      else if (a.number) {
        n = parseInt(a.number, 10);
        assert(n >= 1 && n <= latest.num, `That comic doesn't exist. Pick something from 1-${latest.num}.`);
      }
      const d = n === latest.num ? latest : await fetchJson(`https://xkcd.com/${n}/info.0.json`);
      return card({ title: `xkcd #${d.num}: ${d.safe_title}`, image: d.img, footer: d.alt, color: C.info });
    },
  },
  {
    name: 'apod',
    description: "NASA's Astronomy Picture of the Day",
    defer: true,
    cooldown: 10,
    async run() {
      const d = await fetchJson(
        `https://api.nasa.gov/planetary/apod?api_key=${process.env.NASA_KEY || 'DEMO_KEY'}`,
      );
      return card({
        title: `🔭 ${d.title}`,
        description: d.explanation.slice(0, 900),
        image: d.media_type === 'image' ? d.url : null,
        footer: `${d.date}${d.copyright ? ` · © ${d.copyright.trim()}` : ''}${d.media_type !== 'image' ? ` · ${d.url}` : ''}`,
        color: C.info,
      });
    },
  },
  {
    name: 'pokemon',
    description: 'Look up a Pokémon in the Pokédex',
    defer: true,
    aliases: ['pokedex'],
    options: [
      {
        name: 'name',
        type: 'string',
        required: true,
        lower: true,
        description: 'Its name or Pokédex number',
      },
    ],
    async run(ctx, a) {
      const d = await fetchJson(
        `https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(a.name.trim().replace(/\s+/g, '-'))}`,
      ).catch(() => null);
      assert(d, "Couldn't find that Pokémon. Double-check the spelling?");
      const stats = d.stats
        .map((s) => `${s.stat.name.replace('special-', 'sp.')}: **${s.base_stat}**`)
        .join(' · ');
      return card({
        title: `#${d.id} ${d.name[0].toUpperCase() + d.name.slice(1)}`,
        thumbnail: d.sprites.other?.['official-artwork']?.front_default || d.sprites.front_default,
        fields: [
          ['Type', d.types.map((t) => t.type.name).join(', ')],
          ['Height', `${d.height / 10} m`],
          ['Weight', `${d.weight / 10} kg`],
          ['Abilities', d.abilities.map((x) => x.ability.name).join(', ')],
          ['Base stats', stats],
        ],
        color: 0xffcb05,
      });
    },
  },
  {
    name: 'catgif',
    description: 'A random cat GIF, for emergencies',
    async run() {
      // timestamp busts Discord's image cache so repeat calls give a new cat
      return card({ title: '🐱 Cat GIF', image: `https://cataas.com/cat/gif?${Date.now()}`, color: C.fun });
    },
  },
  {
    name: 'catsays',
    description: 'A cat that says whatever you want it to',
    options: [
      { name: 'text', type: 'string', required: true, description: 'What the cat says (keep it short)' },
    ],
    async run(ctx, a) {
      return card({
        image: `https://cataas.com/cat/says/${encodeURIComponent(a.text.slice(0, 60))}?fontSize=40&fontColor=white&t=${Date.now()}`,
        color: C.fun,
      });
    },
  },
  {
    name: 'placeholder',
    description: 'A placeholder image in any size, e.g. placeholder 600x400',
    options: [{ name: 'size', type: 'string', required: true, description: 'Size as WIDTHxHEIGHT' }],
    async run(ctx, a) {
      const m = a.size.match(/^(\d{2,4})x(\d{2,4})$/);
      assert(m && +m[1] <= 2000 && +m[2] <= 2000, 'Give me WIDTHxHEIGHT, and nothing bigger than 2000x2000.');
      return card({ image: `https://placehold.co/${m[1]}x${m[2]}/png`, footer: `${m[1]}×${m[2]}` });
    },
  },
  {
    name: 'robohash',
    description: 'A one-of-a-kind robot avatar for any text',
    aliases: ['robot'],
    options: [
      { name: 'text', type: 'string', description: 'Text to build your robot from (defaults to your name)' },
    ],
    async run(ctx, a) {
      const s = a.text || ctx.user.username;
      return card({
        title: `🤖 ${s.slice(0, 60)}`,
        image: `https://robohash.org/${encodeURIComponent(s)}.png?size=300x300&set=${pick(['set1', 'set2', 'set3', 'set4'])}`,
        color: C.fun,
      });
    },
  },
  {
    name: 'qrcode',
    description: 'Turn text or a link into a QR code',
    aliases: ['qr'],
    options: [{ name: 'text', type: 'string', required: true, description: 'The text or link to encode' }],
    async run(ctx, a) {
      return card({
        title: '🔳 QR code',
        image: `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(a.text.slice(0, 900))}`,
        footer: a.text.slice(0, 100),
      });
    },
  },
];
