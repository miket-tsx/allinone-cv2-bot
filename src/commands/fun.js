const db = require('../lib/db');
const { card, C } = require('../lib/ui');
const { pick, randInt, assert, fetchJson, codeblock } = require('../lib/util');

const optUser = { name: 'user', type: 'user', description: 'Who to pick (defaults to you)' };

// Seeded by the date so a rating stays put all day instead of rerolling on every call.
function seeded(str) {
  let h = 2166136261;
  for (const ch of str + new Date().toDateString()) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const L = {
  ball: [
    'It is certain.',
    'Without a doubt.',
    'Yes — definitely.',
    'You may rely on it.',
    'As I see it, yes.',
    'Most likely.',
    'Outlook good.',
    'Signs point to yes.',
    'Reply hazy, try again.',
    'Ask again later.',
    'Better not tell you now.',
    'Cannot predict now.',
    "Don't count on it.",
    'My reply is no.',
    'My sources say no.',
    'Outlook not so good.',
    'Very doubtful.',
  ],
  roast: [
    "You're the reason the gene pool needs a lifeguard.",
    "I'd agree with you but then we'd both be wrong.",
    'You bring everyone so much joy… when you leave the room.',
    "You're like a cloud — when you disappear it's a beautiful day.",
    "If laziness were a sport, you'd come in fourth so you didn't have to walk up to the podium.",
    'Your WiFi signal has more personality than you.',
    'You have something on your chin… no, the third one.',
    "You're proof that evolution can go in reverse.",
    "I'd explain it to you, but I left my crayons at home.",
    "You're not stupid; you just have bad luck thinking.",
  ],
  compliment: [
    "You're more fun than bubble wrap.",
    'You light up every channel you join.',
    'Your code compiles on the first try. Probably.',
    "You're a great listener.",
    'Your vibe is immaculate.',
    'You make the server better just by being here.',
    "You've got impeccable taste.",
    'You are someone people trust.',
    'Your laugh is contagious.',
    "You're even better than a free Nitro.",
  ],
  pickup: [
    'Are you a keyboard? Because you’re just my type.',
    'Are you a 404? Because I can’t find anyone like you.',
    'Do you have a map? I keep getting lost in your messages.',
    'Is your name Wi-Fi? Because I’m feeling a connection.',
    'You must be a ping, because my heart skips when you show up.',
    'Are you made of copper and tellurium? Because you’re Cu-Te.',
    'If you were a vegetable you’d be a cute-cumber.',
    'Are you a bank loan? Because you have my interest.',
  ],
  wyr: [
    'have the ability to fly or be invisible?',
    'never use social media again or never watch another movie?',
    'always be 10 minutes late or 20 minutes early?',
    'live without music or without TV?',
    'be able to talk to animals or speak every language?',
    'have unlimited pizza or unlimited tacos?',
    'explore space or the deep ocean?',
    'lose your phone or your wallet?',
    'be famous or be rich?',
    'have a rewind button or a pause button for life?',
    'be the funniest or the smartest person in the room?',
    'live in the city or the countryside?',
    'never sleep again or never eat again?',
    'always know when someone is lying or always get away with lying?',
  ],
  truth: [
    "What's the most embarrassing thing in your search history?",
    'Who was your first crush?',
    "What's a secret talent you have?",
    "What's the biggest lie you've ever told?",
    "What's your guiltiest pleasure?",
    'Have you ever pretended to be sick to skip something?',
    "What's the weirdest dream you remember?",
    "What's a habit you're secretly proud of?",
    'What was your most awkward moment at school?',
    "What's the last thing you googled?",
  ],
  dare: [
    'Change your nickname to "Potato" for an hour.',
    'Send the 5th photo in your gallery (if appropriate).',
    'Type with your elbows for the next message.',
    'Talk only in emojis for 5 minutes.',
    'Compliment everyone who speaks next.',
    'Do 10 push-ups and report back.',
    'Use a pirate accent in chat for 10 minutes.',
    'Write a haiku about the person above you.',
    'Change your status to something embarrassing for 30 minutes.',
    'Sing the chorus of your favourite song in VC.',
  ],
  nhie: [
    'stayed up for 24 hours straight.',
    'fallen asleep in class or a meeting.',
    'broken a bone.',
    'ghosted someone.',
    'eaten food off the floor.',
    'cried at a movie.',
    'been on TV.',
    'rage-quit a game.',
    'forgotten a friend’s birthday.',
    'sent a message to the wrong chat.',
    'binge-watched a whole series in a day.',
    'lied about my age.',
  ],
  topic: [
    "What's a skill you'd love to learn?",
    "What's the best game you've played this year?",
    'If you could live anywhere, where would it be?',
    "What's your unpopular opinion?",
    'What song do you have on repeat?',
    "What's the best advice you've received?",
    'What would your perfect day look like?',
    'Which fictional world would you want to live in?',
    "What's something that always makes you laugh?",
    "What's your dream job?",
    'Cats or dogs — and why?',
    "What's the most useful thing you own?",
  ],
  fortune: [
    'A pleasant surprise is waiting for you.',
    'Your hard work is about to pay off.',
    'Now is a good time to try something new.',
    'A friend will reach out with good news.',
    'Patience will bring you what you seek.',
    'An unexpected message will make your day.',
    'Your creativity will open a new door.',
    'Today, small wins add up.',
  ],
  riddles: [
    ['What has keys but can’t open locks?', 'A piano'],
    ['What gets wetter the more it dries?', 'A towel'],
    ['What has a neck but no head?', 'A bottle'],
    ['I speak without a mouth and hear without ears. What am I?', 'An echo'],
    ['What can travel around the world while staying in a corner?', 'A stamp'],
    ['What has many teeth but can’t bite?', 'A comb'],
    ['The more of this there is, the less you see. What is it?', 'Darkness'],
    ['What goes up but never comes down?', 'Your age'],
    ['What has one eye but can’t see?', 'A needle'],
    ['What can you catch but not throw?', 'A cold'],
  ],
  twister: [
    'She sells seashells by the seashore.',
    'Peter Piper picked a peck of pickled peppers.',
    'How much wood would a woodchuck chuck if a woodchuck could chuck wood?',
    'Red lorry, yellow lorry.',
    'Unique New York, unique New York.',
    'Six slippery snails slid slowly seaward.',
    'Fred fed Ted bread and Ted fed Fred bread.',
    'Irish wristwatch, Swiss wristwatch.',
  ],
  motivate: [
    'Small steps every day.',
    'Done is better than perfect.',
    'You’ve survived 100% of your bad days so far.',
    'Discipline beats motivation.',
    'Start where you are. Use what you have. Do what you can.',
    'Progress, not perfection.',
    'The best time to start was yesterday. The next best is now.',
    'Your future self is watching — make them proud.',
  ],
  thoughts: [
    'Your stomach thinks all potatoes are mashed.',
    'Clapping is just hitting yourself because you like something.',
    'The word "bed" looks like a bed.',
    'Nothing is on fire; fire is on things.',
    'Every mirror you buy is a used mirror.',
    'Your age is the number of times you’ve orbited the sun.',
    'Lawyers hope you get sued, doctors hope you get sick.',
    'Somewhere in the world there is a person who has the same birthday as you and the same favourite song.',
  ],
  insult: [
    'You absolute spoon.',
    'You walking 404 error.',
    'You soggy biscuit.',
    'You half-loaded webpage.',
    'You lukewarm cup of tea.',
    'You unpaid parking ticket.',
    'You expired coupon.',
    'You low-battery notification.',
  ],
  zodiac: [
    'Aries',
    'Taurus',
    'Gemini',
    'Cancer',
    'Leo',
    'Virgo',
    'Libra',
    'Scorpio',
    'Sagittarius',
    'Capricorn',
    'Aquarius',
    'Pisces',
  ],
};

const simple = (name, description, title, list, color = C.fun, aliases = []) => ({
  name,
  description,
  aliases,
  async run() {
    return card({ title, description: pick(list), color });
  },
});
const rate = (name, description, label, max = 100, unit = '%') => ({
  name,
  description,
  options: [optUser],
  async run(ctx, a) {
    const u = a.user || ctx.user;
    const v = seeded(name + u.id) % (max + 1);
    return card({ description: `**${u.username}** ${label} **${v}${unit}**`, color: C.fun });
  },
});
const apiText = (name, description, title, url, map, aliases = []) => ({
  name,
  description,
  aliases,
  defer: true,
  cooldown: 3,
  async run() {
    const d = await fetchJson(url);
    return card({ title, description: map(d), color: C.fun });
  },
});

function cowsay(text, animal = 'cow') {
  // Capped at 10 lines so a wall of text can't flood the channel.
  const lines = text
    .match(/.{1,36}(\s|$)|\S+?(\s|$)/g)
    .map((s) => s.trim())
    .slice(0, 10);
  const w = Math.max(...lines.map((l) => l.length));
  const bubble = [
    ' ' + '_'.repeat(w + 2),
    ...lines.map((l, i) => {
      const [o, c] =
        lines.length === 1
          ? ['<', '>']
          : i === 0
            ? ['/', '\\']
            : i === lines.length - 1
              ? ['\\', '/']
              : ['|', '|'];
      return `${o} ${l.padEnd(w)} ${c}`;
    }),
    ' ' + '-'.repeat(w + 2),
  ];
  const art =
    animal === 'cow'
      ? [
          '        \\   ^__^',
          '         \\  (oo)\\_______',
          '            (__)\\       )\\/\\',
          '                ||----w |',
          '                ||     ||',
        ]
      : ['   \\', '    \\  /\\_/\\', '      ( o.o )', '       > ^ <'];
  return [...bubble, ...art].join('\n');
}

module.exports = [
  {
    name: '8ball',
    description: 'Shake the magic 8-ball and brace yourself for the truth',
    aliases: ['eightball'],
    options: [{ name: 'question', type: 'string', required: true, description: 'What do you want to know?' }],
    async run(ctx, a) {
      return card({
        title: '🎱 Magic 8-ball',
        fields: [
          ['Question', a.question.slice(0, 300)],
          ['Answer', pick(L.ball)],
        ],
        color: C.fun,
      });
    },
  },
  {
    name: 'coinflip',
    description: 'Flip a coin and let fate decide',
    aliases: ['cf', 'flip'],
    async run() {
      return card({ description: `🪙 Landed on **${pick(['Heads', 'Tails'])}**!`, color: C.fun });
    },
  },
  {
    name: 'roll',
    description: 'Roll some dice in NdM format, like 2d6 (defaults to 1d6)',
    aliases: ['dice'],
    options: [{ name: 'dice', type: 'string', description: 'Something like 1d20 or 3d6+2' }],
    async run(ctx, a) {
      const m = (a.dice || '1d6')
        .toLowerCase()
        .replace(/\s/g, '')
        .match(/^(\d{0,2})d(\d{1,4})([+-]\d{1,4})?$/);
      assert(m, "That's not dice notation. Try `2d6` or `1d20+3`.");
      const n = Math.min(Number(m[1] || 1), 50) || 1;
      const sides = Number(m[2]);
      assert(sides >= 2, 'A one-sided die is just a very boring ball. Give it at least 2 sides.');
      const mod = Number(m[3] || 0);
      const rolls = Array.from({ length: n }, () => randInt(1, sides));
      const total = rolls.reduce((s, x) => s + x, 0) + mod;
      return card({
        title: `🎲 ${n}d${sides}${m[3] || ''}`,
        description: `Rolls: ${rolls.join(', ')}${mod ? ` (${m[3]})` : ''}\nTotal: **${total}**`,
        color: C.fun,
      });
    },
  },
  {
    name: 'choose',
    description: "Can't decide? Give me options split by | or commas and I'll pick one",
    aliases: ['pick'],
    options: [{ name: 'options', type: 'string', required: true, description: 'a | b | c' }],
    async run(ctx, a) {
      const o = a.options
        .split(/\||,/)
        .map((s) => s.trim())
        .filter(Boolean);
      assert(o.length >= 2, 'I need at least two options to choose between, split by `|` or `,`.');
      return card({ description: `🤔 Hmm… going with **${pick(o)}**`, color: C.fun });
    },
  },
  {
    name: 'rate',
    description: 'Get my completely unbiased rating of anything, out of 10',
    options: [{ name: 'thing', type: 'string', required: true, description: 'The thing to be judged' }],
    async run(ctx, a) {
      return card({
        description: `Verdict on **${a.thing.slice(0, 200)}**: **${seeded(a.thing.toLowerCase()) % 11}/10**`,
        color: C.fun,
      });
    },
  },
  {
    name: 'ship',
    description: 'Check how well two people would get on (romantically, allegedly)',
    aliases: ['love', 'lovecalc'],
    options: [
      { name: 'user1', type: 'user', required: true, description: 'First lovebird' },
      { name: 'user2', type: 'user', description: 'Second lovebird (defaults to you)' },
    ],
    async run(ctx, a) {
      const u1 = a.user1;
      const u2 = a.user2 || ctx.user;
      const ids = [u1.id, u2.id].sort().join('');
      const v = seeded(ids) % 101;
      const name =
        u1.username.slice(0, Math.ceil(u1.username.length / 2)) +
        u2.username.slice(Math.floor(u2.username.length / 2));
      const msg =
        v > 85
          ? 'Soulmates, no notes 💞'
          : v > 65
            ? 'Great match 💖'
            : v > 45
              ? 'There’s potential here 💗'
              : v > 25
                ? 'Friend zone, population: you two 🤝'
                : 'Yikes. Maybe in another life 💔';
      return card({
        title: `💘 ${u1.username} × ${u2.username}`,
        description: `Ship name: **${name}**\n${'❤️'.repeat(Math.round(v / 10))}${'🖤'.repeat(10 - Math.round(v / 10))} **${v}%**\n${msg}`,
        color: C.fun,
      });
    },
  },
  rate('howcool', 'Measure how cool someone is', 'is', 100, '% cool 😎'),
  rate('simprate', "Measure someone's simp levels", 'is', 100, '% simp'),
  rate('iq', 'Take a 100% scientifically rigorous IQ test', 'has an IQ of', 200, ''),
  rate('luck', 'Find out how lucky someone is today', 'is', 100, '% lucky today 🍀'),
  rate('sus', 'Check how suspicious someone is', 'is', 100, '% sus ඞ'),
  rate('vibecheck', 'Run a vibe check. Results are final', 'passed the vibe check with', 100, '% ✨'),
  rate('nerdrate', 'Find out how nerdy someone is', 'is', 100, '% nerd 🤓'),
  rate('chadrate', 'Measure the chad energy', 'is', 100, '% chad 🗿'),
  rate('smartrate', 'A brain power check', 'is', 100, '% big brain 🧠'),
  rate('hungry', 'Find out how hungry someone is', 'is', 100, '% hungry 🍔'),
  {
    name: 'roast',
    description: 'A light roast, served warm. All in good fun',
    options: [optUser],
    async run(ctx, a) {
      return card({ description: `🔥 ${a.user || ctx.user}, ${pick(L.roast)}`, color: C.fun });
    },
  },
  {
    name: 'compliment',
    description: 'Hand out a compliment, free of charge',
    options: [optUser],
    async run(ctx, a) {
      return card({ description: `💐 ${a.user || ctx.user}, ${pick(L.compliment)}`, color: C.fun });
    },
  },
  {
    name: 'insult',
    description: 'A silly, harmless insult (nobody gets hurt)',
    options: [optUser],
    async run(ctx, a) {
      return card({ description: `${a.user || ctx.user} — ${pick(L.insult)}`, color: C.fun });
    },
  },
  simple('pickupline', 'A pickup line so cheesy it comes with crackers', '😏 Pickup line', L.pickup),
  {
    name: 'wouldyourather',
    description: 'A "would you rather" to start an argument',
    aliases: ['wyr'],
    async run() {
      return card({ title: '🤔 Would you rather…', description: pick(L.wyr), color: C.fun });
    },
  },
  simple('truth', 'A truth question. No lying, we can tell', '🗣️ Truth', L.truth),
  simple('dare', "A dare you can totally back out of (but won't)", '🔥 Dare', L.dare),
  {
    name: 'neverhaveiever',
    description: 'Never have I ever… time to confess',
    aliases: ['nhie'],
    async run() {
      return card({ title: '🙊 Never have I ever…', description: pick(L.nhie), color: C.fun });
    },
  },
  simple('topic', 'A conversation starter for when chat goes quiet', '💬 Topic', L.topic, C.info),
  simple('fortune', 'Crack open a fortune cookie', '🥠 Fortune', L.fortune),
  {
    name: 'riddle',
    description: 'A riddle to chew on. The answer hides in a spoiler',
    async run() {
      const [q, a] = pick(L.riddles);
      return card({ title: '🧩 Riddle', description: `${q}\n\nAnswer: ||${a}||`, color: C.fun });
    },
  },
  simple('tonguetwister', 'A tongue twister to tie your mouth in knots', '👅 Tongue twister', L.twister),
  simple('motivate', 'A tiny pep talk, no coffee required', '💪 Motivation', L.motivate, C.success, [
    'motivation',
  ]),
  simple('showerthought', 'A shower thought to keep you up tonight', '🚿 Shower thought', L.thoughts),
  {
    name: 'horoscope',
    description: 'Your daily horoscope, made up with total confidence',
    options: [
      {
        name: 'sign',
        type: 'string',
        required: true,
        lower: true,
        description: 'Your zodiac sign',
        choices: L.zodiac.map((z) => z.toLowerCase()),
      },
    ],
    async run(ctx, a) {
      const s = seeded(a.sign);
      const mood = ['adventurous', 'calm', 'productive', 'social', 'creative', 'reflective'][s % 6];
      return card({
        title: `✨ ${a.sign[0].toUpperCase() + a.sign.slice(1)} — today`,
        description: `Today you'll feel **${mood}**. ${L.fortune[s % L.fortune.length]}`,
        fields: [
          ['Lucky number', String((s % 99) + 1)],
          ['Lucky color', ['Red', 'Blue', 'Green', 'Gold', 'Purple', 'Silver'][s % 6]],
        ],
        color: C.fun,
      });
    },
  },
  apiText(
    'joke',
    'A random joke, quality not guaranteed',
    '😂 Joke',
    'https://v2.jokeapi.dev/joke/Any?safe-mode',
    (d) => (d.type === 'single' ? d.joke : `${d.setup}\n\n||${d.delivery}||`),
  ),
  apiText(
    'dadjoke',
    'A dad joke. Groaning is encouraged',
    '👨 Dad joke',
    'https://icanhazdadjoke.com/',
    (d) => d.joke,
  ),
  apiText(
    'fact',
    "A random fact you'll never need but can't unlearn",
    '🧠 Fact',
    'https://uselessfacts.jsph.pl/api/v2/facts/random?language=en',
    (d) => d.text,
    ['randomfact'],
  ),
  apiText(
    'advice',
    'Unsolicited advice, fresh from the internet',
    '💡 Advice',
    'https://api.adviceslip.com/advice',
    (d) => d.slip.advice,
  ),
  apiText(
    'quote',
    'A quote to make you feel briefly profound',
    '📜 Quote',
    'https://dummyjson.com/quotes/random',
    (d) => `“${d.quote}”\n— *${d.author}*`,
    ['inspire'],
  ),
  apiText(
    'catfact',
    'A random fact about our feline overlords',
    '🐱 Cat fact',
    'https://catfact.ninja/fact',
    (d) => d.fact,
  ),
  apiText(
    'dogfact',
    'A random fact about very good dogs',
    '🐶 Dog fact',
    'https://dogapi.dog/api/v2/facts?limit=1',
    (d) => d.data[0].attributes.body,
  ),
  apiText(
    'chucknorris',
    'A Chuck Norris fact, because he made us',
    '🥋 Chuck Norris',
    'https://api.chucknorris.io/jokes/random',
    (d) => d.value,
    ['chuck'],
  ),
  apiText(
    'programmingjoke',
    'A programming joke that only some of you will get',
    '💻 Programming joke',
    'https://v2.jokeapi.dev/joke/Programming?safe-mode',
    (d) => (d.type === 'single' ? d.joke : `${d.setup}\n\n||${d.delivery}||`),
    ['devjoke'],
  ),
  apiText(
    'kanye',
    'Words of wisdom from Kanye West',
    '🎤 Kanye says',
    'https://api.kanye.rest/',
    (d) => `“${d.quote}”`,
  ),
  {
    name: 'cowsay',
    description: 'Make a cow say whatever you want',
    options: [{ name: 'text', type: 'string', required: true, description: 'What the cow should say' }],
    async run(ctx, a) {
      return card({ description: codeblock(cowsay(a.text.slice(0, 300))) });
    },
  },
  {
    name: 'catsay',
    description: 'Make a cat say whatever you want (it may ignore you)',
    options: [{ name: 'text', type: 'string', required: true, description: 'What the cat should say' }],
    async run(ctx, a) {
      return card({ description: codeblock(cowsay(a.text.slice(0, 300), 'cat')) });
    },
  },
  {
    name: 'hack',
    description: 'Hack someone. Extremely real, definitely legal',
    guildOnly: true,
    cooldown: 10,
    options: [{ name: 'user', type: 'user', required: true, description: 'Your unfortunate target' }],
    async run(ctx, a) {
      const steps = [
        'Bypassing the firewall…',
        `Locating ${a.user.username}'s IP… 127.0.0.1`,
        'Downloading the "memes" folder (4.2 GB)…',
        `Email: ${a.user.username.toLowerCase()}@totallyrealmail.com`,
        'Password: ********* (hunter2)',
        'Selling data to the highest bidder…',
        '✅ Hack complete. Very real, very scary.',
      ];
      const msg = await ctx.reply(
        card({ title: `💻 Hacking ${a.user.username}`, description: steps[0], color: 0x00ff00 }),
      );
      for (let i = 1; i < steps.length; i++) {
        await new Promise((r) => setTimeout(r, 1300));
        // the message can get deleted mid-animation; not worth crashing over
        await (
          ctx.isSlash
            ? ctx.interaction.editReply(
                card({
                  title: `💻 Hacking ${a.user.username}`,
                  description: steps.slice(0, i + 1).join('\n'),
                  color: 0x00ff00,
                }),
              )
            : msg.edit(
                card({
                  title: `💻 Hacking ${a.user.username}`,
                  description: steps.slice(0, i + 1).join('\n'),
                  color: 0x00ff00,
                }),
              )
        ).catch(() => {});
      }
    },
  },
  {
    name: 'fight',
    description: 'Settle it in a fully simulated brawl with someone',
    guildOnly: true,
    options: [{ name: 'user', type: 'user', required: true, description: "Who you're fighting" }],
    async run(ctx, a) {
      const p = [
        { n: ctx.user.username, hp: 100 },
        { n: a.user.username, hp: 100 },
      ];
      const log = [];
      let t = 0;
      const moves = [
        'punches',
        'kicks',
        'throws a chair at',
        'casts fireball on',
        'bonks',
        'body-slams',
        'uses a critical hit on',
      ];
      while (p[0].hp > 0 && p[1].hp > 0 && log.length < 14) {
        const atk = p[t % 2];
        const def = p[(t + 1) % 2];
        const dmg = randInt(8, 30);
        def.hp = Math.max(0, def.hp - dmg);
        log.push(`**${atk.n}** ${pick(moves)} **${def.n}** for ${dmg} (${def.hp} HP left)`);
        t++;
      }
      const w = p[0].hp > p[1].hp ? p[0] : p[1];
      return card({
        title: '⚔️ Fight!',
        description: log.join('\n'),
        fields: [['Winner', `🏆 ${w.n}`]],
        color: C.fun,
      });
    },
  },
  {
    name: 'russianroulette',
    description: 'Spin the cylinder and pray… 1 in 6 odds',
    aliases: ['rr'],
    async run(ctx) {
      return card({
        description:
          randInt(1, 6) === 1
            ? `💥 BANG! ${ctx.user} didn't make it.`
            : '*click* — lucky you, still breathing. 😮‍💨',
        color: C.fun,
      });
    },
  },
  {
    name: 'f',
    description: 'Press F to pay respects',
    options: [{ name: 'thing', type: 'string', description: "What we're mourning" }],
    async run(ctx, a) {
      return card({
        description: `🫡 **${ctx.user.username}** pays their respects${a.thing ? ` for **${a.thing.slice(0, 100)}**` : ''}.`,
        color: C.fun,
      });
    },
  },
  {
    name: 'cookie',
    description: 'Hand someone a cookie, because you care',
    options: [{ name: 'user', type: 'user', required: true, description: 'Who gets the cookie' }],
    async run(ctx, a) {
      assert(a.user.id !== ctx.user.id, 'Nice try, but no self-cookies. Share the love. 🍪');
      const u = db.user(a.user.id);
      u.cookies++;
      db.save();
      return card({
        description: `🍪 ${ctx.user} slid ${a.user} a cookie! That's **${u.cookies}** in the jar now.`,
        color: C.fun,
      });
    },
  },
  {
    name: 'cookies',
    description: "Peek at how big someone's cookie stash is",
    options: [optUser],
    async run(ctx, a) {
      const u = a.user || ctx.user;
      return card({
        description: `🍪 **${u.username}** is sitting on **${db.user(u.id).cookies}** cookie(s).`,
        color: C.fun,
      });
    },
  },
  {
    name: 'magicconch',
    description: 'Consult the magic conch shell. It has opinions',
    options: [{ name: 'question', type: 'string', required: true, description: 'Ask the shell' }],
    async run(ctx, a) {
      return card({
        title: '🐚 Magic conch',
        fields: [
          ['Q', a.question.slice(0, 300)],
          [
            'A',
            pick([
              'Maybe someday.',
              'Nothing.',
              'Neither.',
              'I don’t think so.',
              'Yes.',
              'No.',
              'Try asking again.',
            ]),
          ],
        ],
        color: C.fun,
      });
    },
  },
  {
    name: 'bubblewrap',
    description: 'Pop some virtual bubble wrap. Weirdly satisfying',
    async run() {
      return card({
        description: Array.from({ length: 5 }, () => '||pop||'.repeat(8)).join('\n'),
        color: C.fun,
      });
    },
  },
  {
    name: 'reverseuno',
    description: 'Slam down an Uno reverse card',
    async run(ctx) {
      return card({
        description: `🔄 **${ctx.user.username}** slaps down a Reverse card! No u.`,
        color: C.fun,
      });
    },
  },
  {
    name: 'emojisoup',
    description: 'Serve up a steaming bowl of emoji soup',
    async run() {
      const e = [
        '😀',
        '🎉',
        '🍕',
        '🐸',
        '🚀',
        '🌈',
        '🔥',
        '💎',
        '🍩',
        '🎮',
        '🦄',
        '⚡',
        '🐙',
        '🌮',
        '🎧',
        '🧠',
        '🍉',
        '🐢',
      ];
      return card({ description: `🥣 ${Array.from({ length: 12 }, () => pick(e)).join('')}`, color: C.fun });
    },
  },
];
