// Lookups and games backed by free public APIs that don't need keys.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { card, C } = require('../lib/ui');
const { assert, fetchJson, shuffle, fmtNum, ts, UserError } = require('../lib/util');

const WMO = {
  0: '☀️ Clear',
  1: '🌤️ Mainly clear',
  2: '⛅ Partly cloudy',
  3: '☁️ Overcast',
  45: '🌫️ Fog',
  48: '🌫️ Rime fog',
  51: '🌦️ Light drizzle',
  53: '🌦️ Drizzle',
  55: '🌧️ Heavy drizzle',
  61: '🌧️ Light rain',
  63: '🌧️ Rain',
  65: '🌧️ Heavy rain',
  71: '🌨️ Light snow',
  73: '🌨️ Snow',
  75: '❄️ Heavy snow',
  80: '🌦️ Showers',
  81: '🌧️ Heavy showers',
  82: '⛈️ Violent showers',
  95: '⛈️ Thunderstorm',
  96: '⛈️ Thunderstorm + hail',
  99: '⛈️ Severe thunderstorm',
};

// OpenTDB and MyMemory both hand back HTML-escaped text. Only the common entities are handled; the rest get dropped.
const dec = (s) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&eacute;/g, 'é')
    .replace(/&[a-z]+;/g, '');
async function geo(place) {
  const g = await fetchJson(
    `https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(place)}`,
  );
  assert(g.results?.length, "Couldn't find that place. Double-check the spelling?");
  return g.results[0];
}

// The old restcountries v3.1 endpoint (restcountries.com/v3.1/name/...) now 301s to a
// "this API version has been deprecated" stub, which is why every lookup failed. Their own
// dataset is still public on the CDN, so pull it once, cache it, and search locally: same
// fields, no API key, and it also handles "usa", "PRC", "Holland" and plain typos.
const COUNTRY_URLS = [
  'https://cdn.jsdelivr.net/gh/restcountries/restcountries@master/src/main/resources/countriesV3.1.json',
  'https://raw.githubusercontent.com/restcountries/restcountries/master/src/main/resources/countriesV3.1.json',
];
const COUNTRY_TTL = 24 * 60 * 60 * 1000;
// Shorthands the dataset doesn't list but people type anyway (GB and CN are ISO codes)
const COUNTRY_ALIASES = {
  prc: 'CN',
  england: 'GB',
  scotland: 'GB',
  wales: 'GB',
  'northern ireland': 'GB',
  drc: 'CD',
};
let countryCache = null;

const normName = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase();

const countryNames = (c) =>
  [c.name?.common, c.name?.official, c.cca2, c.cca3, c.ccn3, ...(c.altSpellings || [])].filter(Boolean);

function editDistance(a, b) {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

function findCountry(list, index, query) {
  const q = normName(query);
  if (!q) return null;
  if (index.has(q)) return index.get(q);
  if (COUNTRY_ALIASES[q]) return list.find((c) => c.cca2 === COUNTRY_ALIASES[q]) || null;
  if (q.length >= 4) {
    const hits = list.filter((c) =>
      countryNames(c).some((n) => {
        const x = normName(n);
        return x.length >= 4 && (x.includes(q) || q.includes(x));
      }),
    );
    // "china" also matches "Taiwan, Province of China"; the shortest name is the intended one
    if (hits.length) return hits.sort((a, b) => a.name.common.length - b.name.common.length)[0];
  }
  let best = null;
  let bestD = Infinity;
  for (const c of list)
    for (const n of countryNames(c)) {
      const x = normName(n);
      if (x.length < 4) continue;
      const d = editDistance(q, x);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
  return bestD <= (q.length <= 4 ? 1 : q.length <= 8 ? 2 : 3) ? best : null;
}

async function countryData() {
  if (countryCache && Date.now() - countryCache.at < COUNTRY_TTL) return countryCache;
  for (const url of COUNTRY_URLS) {
    try {
      const list = await fetchJson(url, { timeout: 20_000 });
      if (!Array.isArray(list) || list.length < 100) continue;
      const index = new Map();
      for (const c of list)
        for (const n of countryNames(c)) {
          const k = normName(n);
          if (k && !index.has(k)) index.set(k, c);
        }
      countryCache = { at: Date.now(), list, index };
      return countryCache;
    } catch {
      // mirror down or slow: try the next one, and keep the stale copy if we have one
    }
  }
  if (countryCache) return countryCache;
  throw new UserError("I couldn't fetch the country list just now (the host had trouble reaching the CDN). Try again in a minute.");
}

module.exports = [
  {
    name: 'weather',
    description: 'Current weather plus a 3-day forecast for any place',
    defer: true,
    aliases: ['w', 'forecast'],
    options: [{ name: 'place', type: 'string', required: true, description: 'Which city or town to check' }],
    async run(ctx, a) {
      const p = await geo(a.place);
      const d = await fetchJson(
        `https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=3&timezone=auto`,
      );
      const c = d.current;
      const days = d.daily.time.map(
        (t, i) =>
          `**${new Date(t).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}** ${WMO[d.daily.weather_code[i]] || '—'} ${Math.round(d.daily.temperature_2m_min[i])}°–${Math.round(d.daily.temperature_2m_max[i])}°C · 💧${d.daily.precipitation_probability_max[i] ?? 0}%`,
      );
      return card({
        title: `${WMO[c.weather_code] || ''} ${p.name}${p.admin1 ? `, ${p.admin1}` : ''}, ${p.country || ''}`,
        color: C.info,
        fields: [
          [
            'Temperature',
            `${c.temperature_2m}°C (feels ${c.apparent_temperature}°C) · ${Math.round((c.temperature_2m * 9) / 5 + 32)}°F`,
          ],
          ['Humidity', `${c.relative_humidity_2m}%`],
          ['Wind', `${c.wind_speed_10m} km/h`],
          ['Forecast', '\n' + days.join('\n')],
        ],
        footer: 'Open-Meteo',
      });
    },
  },
  {
    name: 'translate',
    description: 'Translate some text, e.g. translate es Hello there',
    defer: true,
    aliases: ['tr'],
    options: [
      {
        name: 'to',
        type: 'string',
        required: true,
        lower: true,
        description: 'Language to translate into (es, fr, hi, ja…)',
        rest: false,
      },
      { name: 'text', type: 'string', required: true, description: 'What you want translated' },
    ],
    async run(ctx, a) {
      assert(
        /^[a-z]{2}(-[a-z]{2})?$/i.test(a.to),
        "That doesn't look like a language code. Try `es`, `fr`, `hi`, `ja` or `pt-br`.",
      );
      // Cheap script sniffing; MyMemory needs a source language and rejects identical pairs.
      const src = /[\u0900-\u097F]/.test(a.text) ? 'hi' : /[\u3040-\u30ff]/.test(a.text) ? 'ja' : 'en';
      // Free tier tops out around 500 chars per query.
      const d = await fetchJson(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(a.text.slice(0, 450))}&langpair=${src === a.to ? 'en' : src}|${a.to}`,
      );
      assert(
        d.responseStatus === 200,
        d.responseDetails || 'The translation got lost on the way. Try again?',
      );
      return card({
        title: `🌐 → ${a.to}`,
        fields: [
          ['Original', a.text.slice(0, 450)],
          ['Translation', dec(d.responseData.translatedText)],
        ],
        footer: 'MyMemory',
        color: C.info,
      });
    },
  },
  {
    name: 'trivia',
    description: 'Take a shot at a multiple-choice trivia question',
    defer: true,
    cooldown: 5,
    options: [
      {
        name: 'difficulty',
        type: 'string',
        lower: true,
        description: 'Pick your pain: easy, medium or hard',
        choices: ['easy', 'medium', 'hard'],
      },
    ],
    async run(ctx, a) {
      const d = await fetchJson(
        `https://opentdb.com/api.php?amount=1&type=multiple${a.difficulty ? `&difficulty=${a.difficulty}` : ''}`,
      );
      assert(d.results?.length, 'The trivia server is out to lunch. Give it a moment and retry.');
      const q = d.results[0];
      const answers = shuffle([q.correct_answer, ...q.incorrect_answers].map(dec));
      const right = dec(q.correct_answer);
      const L = ['A', 'B', 'C', 'D'];
      const row = (done, picked) =>
        new ActionRowBuilder().addComponents(
          answers.map((x, i) =>
            new ButtonBuilder()
              .setCustomId(`tq_${i}`)
              .setLabel(`${L[i]}. ${x}`.slice(0, 80))
              .setDisabled(done)
              .setStyle(
                done
                  ? x === right
                    ? ButtonStyle.Success
                    : i === picked
                      ? ButtonStyle.Danger
                      : ButtonStyle.Secondary
                  : ButtonStyle.Primary,
              ),
          ),
        );
      const view = (done, picked, note) =>
        card({
          title: `🧠 ${dec(q.category)} · ${q.difficulty}`,
          description: `**${dec(q.question)}**${note ? `\n\n${note}` : ''}`,
          rows: [row(done, picked)],
          footer: done ? null : '20 seconds on the clock. Open to everyone, and the first click wins.',
          color: C.fun,
        });
      const msg = await ctx.reply(view(false));
      const i = await msg.awaitMessageComponent({ time: 20000 }).catch(() => null);
      if (!i) return msg.edit(view(true, -1, `⏰ Time's up! It was **${right}**`)).catch(() => {});
      const n = Number(i.customId.slice(3));
      const ok = answers[n] === right;
      return i.update(
        view(
          true,
          n,
          ok ? `✅ ${i.user} nailed it — **${right}**!` : `❌ Nope, ${i.user}. The answer was **${right}**`,
        ),
      );
    },
  },
  {
    name: 'define',
    description: 'Look up an English word in the dictionary',
    defer: true,
    aliases: ['dictionary', 'dict'],
    options: [
      { name: 'word', type: 'string', required: true, description: 'The word you are curious about' },
    ],
    async run(ctx, a) {
      const d = await fetchJson(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(a.word.trim())}`,
      ).catch(() => null);
      assert(Array.isArray(d), 'Never heard of it. No definition found.');
      const e = d[0];
      const lines = e.meanings
        .slice(0, 4)
        .map(
          (m) =>
            `*${m.partOfSpeech}* — ${m.definitions[0].definition}${m.definitions[0].example ? `\n> ${m.definitions[0].example}` : ''}`,
        );
      return card({
        title: `📚 ${e.word}${e.phonetic ? `  ${e.phonetic}` : ''}`,
        description: lines.join('\n\n'),
        color: C.info,
      });
    },
  },
  {
    name: 'wiki',
    description: 'Get the gist of a Wikipedia article',
    defer: true,
    aliases: ['wikipedia'],
    options: [{ name: 'query', type: 'string', required: true, description: 'What to look up' }],
    async run(ctx, a) {
      const s = await fetchJson(
        `https://en.wikipedia.org/w/api.php?action=opensearch&limit=1&format=json&search=${encodeURIComponent(a.query)}`,
      );
      assert(s[1]?.length, 'Wikipedia came up empty on that one.');
      const d = await fetchJson(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(s[1][0])}`,
      );
      return card({
        title: `📖 ${d.title}`,
        description: `${d.extract.slice(0, 1200)}\n\n[Fall down the rabbit hole](${d.content_urls.desktop.page})`,
        thumbnail: d.thumbnail?.source,
        color: C.info,
      });
    },
  },
  {
    name: 'github',
    description: 'Peek at a GitHub user profile',
    defer: true,
    aliases: ['gh'],
    options: [{ name: 'username', type: 'string', required: true, description: 'GitHub username' }],
    async run(ctx, a) {
      const d = await fetchJson(`https://api.github.com/users/${encodeURIComponent(a.username)}`).catch(
        () => null,
      );
      assert(d?.login, 'No GitHub user by that name.');
      return card({
        title: `${d.name || d.login} (@${d.login})`,
        description: `${d.bio || ''}\n${d.html_url}`,
        thumbnail: d.avatar_url,
        fields: [
          ['Repos', String(d.public_repos)],
          ['Followers', fmtNum(d.followers)],
          ['Following', fmtNum(d.following)],
          ['Joined', ts(d.created_at, 'D')],
        ],
        color: 0x24292e,
      });
    },
  },
  {
    name: 'npm',
    description: 'Look up a package on npm',
    defer: true,
    options: [{ name: 'package', type: 'string', required: true, description: 'Package name' }],
    async run(ctx, a) {
      // Scoped names (@scope/pkg) must keep a literal @ in the registry URL.
      const d = await fetchJson(
        `https://registry.npmjs.org/${encodeURIComponent(a.package.toLowerCase()).replace('%40', '@')}`,
      ).catch(() => null);
      assert(d?.name, 'npm has never heard of that package.');
      const v = d['dist-tags']?.latest;
      const l = d.versions?.[v] || {};
      return card({
        title: `📦 ${d.name}@${v}`,
        description: d.description || '',
        fields: [
          ['License', l.license || '—'],
          ['Dependencies', String(Object.keys(l.dependencies || {}).length)],
          ['Updated', d.time?.modified ? ts(d.time.modified, 'R') : '—'],
          ['Link', `https://npmjs.com/package/${d.name}`],
        ],
        color: 0xcb3837,
      });
    },
  },
  {
    name: 'crypto',
    description: 'Check a coin price in USD, EUR and INR',
    defer: true,
    aliases: ['coin', 'price'],
    options: [
      {
        name: 'coin',
        type: 'string',
        required: true,
        lower: true,
        description: 'Which coin? e.g. bitcoin, ethereum, solana',
      },
    ],
    async run(ctx, a) {
      // CoinGecko wants full ids, so map the tickers people actually type.
      const id =
        {
          btc: 'bitcoin',
          eth: 'ethereum',
          sol: 'solana',
          doge: 'dogecoin',
          xrp: 'ripple',
          ada: 'cardano',
          bnb: 'binancecoin',
          ltc: 'litecoin',
        }[a.coin] || a.coin;
      const d = await fetchJson(
        `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd,inr,eur&include_24hr_change=true`,
      );
      const c = d[id];
      assert(c, "Don't know that coin. Try its CoinGecko id, like `bitcoin`.");
      const ch = c.usd_24h_change;
      return card({
        title: `🪙 ${id}`,
        fields: [
          ['USD', `$${fmtNum(c.usd)}`],
          ['EUR', `€${fmtNum(c.eur)}`],
          ['INR', `₹${fmtNum(c.inr)}`],
          ['24h', `${ch >= 0 ? '📈 +' : '📉 '}${ch?.toFixed(2)}%`],
        ],
        footer: 'CoinGecko',
        color: ch >= 0 ? C.success : C.error,
      });
    },
  },
  {
    name: 'country',
    description: 'Quick facts about a country',
    defer: true,
    options: [{ name: 'name', type: 'string', required: true, description: 'Which country?' }],
    async run(ctx, a) {
      const { list, index } = await countryData();
      const c = findCountry(list, index, a.name);
      assert(c, `I couldn't match "${a.name}" to a country. Try the English name, like \`china\` or \`united states\`.`);
      return card({
        title: `${c.flag || ''} ${c.name.common}`,
        thumbnail: c.flags?.png,
        fields: [
          ['Official', c.name.official],
          ['Capital', (c.capital || ['—']).join(', ')],
          ['Region', `${c.region}${c.subregion ? ` / ${c.subregion}` : ''}`],
          ['Population', fmtNum(c.population)],
          ['Area', `${fmtNum(c.area)} km²`],
          [
            'Currencies',
            Object.values(c.currencies || {})
              .map((x) => `${x.name} (${x.symbol || ''})`)
              .join(', ') || '—',
          ],
          ['Languages', Object.values(c.languages || {}).join(', ') || '—'],
        ],
        footer: c.cca3 ? `${c.cca3} · restcountries data` : undefined,
        color: C.info,
      });
    },
  },
  {
    name: 'mcserver',
    description: 'See if a Minecraft server is up and who is on it',
    defer: true,
    aliases: ['mcstatus'],
    options: [{ name: 'address', type: 'string', required: true, description: 'Server address' }],
    async run(ctx, a) {
      const d = await fetchJson(`https://api.mcsrvstat.us/3/${encodeURIComponent(a.address)}`);
      return card({
        title: `⛏️ ${a.address}`,
        description: d.online
          ? `🟢 Online — **${d.players?.online ?? 0}/${d.players?.max ?? 0}** players\n${(d.motd?.clean || []).join('\n')}`
          : "🔴 Offline — nobody's home",
        fields: d.online ? [['Version', d.version || '—']] : [],
        thumbnail: d.online ? `https://api.mcsrvstat.us/icon/${encodeURIComponent(a.address)}` : null,
        color: d.online ? C.success : C.error,
      });
    },
  },
];
