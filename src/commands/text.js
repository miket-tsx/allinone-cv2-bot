// Each row in T is [name, description, fn, aliases?]. The command objects are built from it further down.
const { card, C } = require('../lib/ui');
const { assert, shuffle, codeblock } = require('../lib/util');

// Pass a falsy start for any range you want left untouched.
const mapRange = (s, upperStart, lowerStart, digitStart) =>
  [...s]
    .map((c) => {
      const code = c.codePointAt(0);
      if (code >= 65 && code <= 90 && upperStart) return String.fromCodePoint(upperStart + code - 65);
      if (code >= 97 && code <= 122 && lowerStart) return String.fromCodePoint(lowerStart + code - 97);
      if (code >= 48 && code <= 57 && digitStart) return String.fromCodePoint(digitStart + code - 48);
      return c;
    })
    .join('');
const table = (from, to) => (s) =>
  [...s]
    .map((c) => {
      const i = from.indexOf(c);
      return i >= 0 ? [...to][i] : c;
    })
    .join('');
const ALPHA = 'abcdefghijklmnopqrstuvwxyz';
const MORSE = {
  a: '.-',
  b: '-...',
  c: '-.-.',
  d: '-..',
  e: '.',
  f: '..-.',
  g: '--.',
  h: '....',
  i: '..',
  j: '.---',
  k: '-.-',
  l: '.-..',
  m: '--',
  n: '-.',
  o: '---',
  p: '.--.',
  q: '--.-',
  r: '.-.',
  s: '...',
  t: '-',
  u: '..-',
  v: '...-',
  w: '.--',
  x: '-..-',
  y: '-.--',
  z: '--..',
  0: '-----',
  1: '.----',
  2: '..---',
  3: '...--',
  4: '....-',
  5: '.....',
  6: '-....',
  7: '--...',
  8: '---..',
  9: '----.',
  '.': '.-.-.-',
  ',': '--..--',
  '?': '..--..',
  '!': '-.-.--',
  '/': '-..-.',
  '@': '.--.-.',
  '&': '.-...',
  ':': '---...',
  '=': '-...-',
  '+': '.-.-.',
  '-': '-....-',
  "'": '.----.',
  '"': '.-..-.',
  '(': '-.--.',
  ')': '-.--.-',
};
const UNMORSE = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));
const NATO = {
  a: 'Alfa',
  b: 'Bravo',
  c: 'Charlie',
  d: 'Delta',
  e: 'Echo',
  f: 'Foxtrot',
  g: 'Golf',
  h: 'Hotel',
  i: 'India',
  j: 'Juliett',
  k: 'Kilo',
  l: 'Lima',
  m: 'Mike',
  n: 'November',
  o: 'Oscar',
  p: 'Papa',
  q: 'Quebec',
  r: 'Romeo',
  s: 'Sierra',
  t: 'Tango',
  u: 'Uniform',
  v: 'Victor',
  w: 'Whiskey',
  x: 'X-ray',
  y: 'Yankee',
  z: 'Zulu',
  0: 'Zero',
  1: 'One',
  2: 'Two',
  3: 'Three',
  4: 'Four',
  5: 'Five',
  6: 'Six',
  7: 'Seven',
  8: 'Eight',
  9: 'Nine',
};
// A character's index in this string is its offset from U+2800.
const BRAILLE = ' a1b\'k2l@cif/msp"e3h9o6r^djg>ntq,*5<-u8v.%[$+x!&;:4\\0z7(_?w]#y)=';
const FLIP_FROM = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?\'"()[]{}<>&_';
const FLIP_TO = "ɐqɔpǝɟƃɥᴉɾʞlɯuodbɹsʇnʌʍxʎz∀ꓭƆꓷƎℲ⅁HIſꓘ˥WNOԀΌꓤSꓕ∩ΛMX⅄Z0ƖᄅƐㄣϛ9ㄥ86˙'¡¿,„)(][}{><⅋‾";
const SUP = table(
  'abcdefghijklmnoprstuvwxyzABDEGHIJKLMNOPRTUVW0123456789+-=()',
  'ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖʳˢᵗᵘᵛʷˣʸᶻᴬᴮᴰᴱᴳᴴᴵᴶᴷᴸᴹᴺᴼᴾᴿᵀᵁⱽᵂ⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾',
);
const SUB = table('aehijklmnoprstuvx0123456789+-=()', 'ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎');
const SMALLCAPS = table(ALPHA, 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ');
const PIRATE = {
  hello: 'ahoy',
  hi: 'yo-ho-ho',
  my: 'me',
  friend: 'matey',
  friends: 'hearties',
  you: 'ye',
  your: 'yer',
  is: 'be',
  are: 'be',
  the: "th'",
  money: 'doubloons',
  yes: 'aye',
  no: 'nay',
  stop: 'avast',
  boy: 'lad',
  girl: 'lass',
  treasure: 'booty',
  drink: 'grog',
  where: 'whar',
  old: 'barnacle-covered',
};
// Splits on separators and on camelCase boundaries.
const RE = /[\s_-]+|(?<=[a-z])(?=[A-Z])/;
const words = (s) => s.trim().split(RE).filter(Boolean);
const caesar = (s, n) =>
  s.replace(/[a-z]/gi, (c) => {
    const b = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((((c.charCodeAt(0) - b + n) % 26) + 26) % 26) + b);
  });

const T = [
  ['reverse', 'Flip your text backwards', (s) => [...s].reverse().join('')],
  ['upper', 'SHOUT YOUR TEXT', (s) => s.toUpperCase(), ['uppercase']],
  ['lower', 'whisper your text in lowercase', (s) => s.toLowerCase(), ['lowercase']],
  [
    'titlecase',
    'Title Case Text, Like A Fancy Headline',
    (s) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
  ],
  [
    'swapcase',
    'sWAP tHE cASE, because why not',
    (s) => [...s].map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join(''),
  ],
  [
    'sentencecase',
    'Sentence case, like a well-behaved paragraph',
    (s) => s.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, (c) => c.toUpperCase()),
  ],
  [
    'mock',
    'sPoNgEbOb MoCk text, for when someone deserves it',
    (s) => {
      let i = 0;
      return [...s]
        .map((c) => (/[a-z]/i.test(c) ? (i++ % 2 ? c.toUpperCase() : c.toLowerCase()) : c))
        .join('');
    },
    ['spongebob'],
  ],
  [
    'randomcase',
    'rAnDOm cASe, decided by pure chaos',
    (s) => [...s].map((c) => (Math.random() > 0.5 ? c.toUpperCase() : c.toLowerCase())).join(''),
  ],
  ['clap', 'Add 👏 a clap 👏 between 👏 words', (s) => s.trim().split(/\s+/).join(' 👏 ')],
  [
    'owo',
    "OwO-ify text (we're sorry)",
    (s) =>
      s
        .replace(/[rl]/g, 'w')
        .replace(/[RL]/g, 'W')
        .replace(/n([aeiou])/g, 'ny$1')
        .replace(/ove/g, 'uv') +
      ' ' +
      ['owo', 'uwu', '>w<', '^w^'][s.length % 4],
    ['uwu'],
  ],
  ['leet', '1337 5p34k for 5up3r h4x0rz', table('aeiostgbAEIOSTGB', '4310579843105798'), ['1337']],
  [
    'vaporwave',
    'Ｆｕｌｌｗｉｄｔｈ ａｅｓｔｈｅｔｉｃ vibes',
    (s) =>
      [...s]
        .map((c) => {
          const k = c.charCodeAt(0);
          return k >= 33 && k <= 126 ? String.fromCharCode(k + 0xfee0) : c === ' ' ? '　' : c;
        })
        .join(''),
    ['aesthetic', 'fullwidth'],
  ],
  ['smallcaps', 'sᴍᴀʟʟ ᴄᴀᴘs for a quieter kind of loud', (s) => SMALLCAPS(s.toLowerCase())],
  ['superscript', 'ˢᵘᵖᵉʳˢᶜʳⁱᵖᵗ text for tiny floating words', SUP, ['tiny']],
  ['subscript', 'ₛᵤᵦₛ꜀ᵣᵢₚₜ text (only some letters make it)', (s) => SUB(s.toLowerCase())],
  [
    'bubble',
    'Ⓑⓤⓑⓑⓛⓔ letters, round and cheerful',
    (s) =>
      mapRange(s, 0x24b6, 0x24d0, null)
        .replace(/0/g, '⓪')
        .replace(/[1-9]/g, (d) => String.fromCodePoint(0x2460 + Number(d) - 1)),
    ['circled'],
  ],
  ['squared', '🅂🅀🅄🄰🅁🄴🄳 letters, all boxed in', (s) => mapRange(s.toUpperCase(), 0x1f130, null, null)],
  ['bold', '𝐁𝐨𝐥𝐝 unicode text, no markdown needed', (s) => mapRange(s, 0x1d400, 0x1d41a, 0x1d7ce)],
  ['italic', '𝘐𝘵𝘢𝘭𝘪𝘤 unicode text, no markdown needed', (s) => mapRange(s, 0x1d608, 0x1d622, null)],
  ['bolditalic', '𝙱𝚘𝚕𝚍 𝚒𝚝𝚊𝚕𝚒𝚌 unicode text, double the drama', (s) => mapRange(s, 0x1d63c, 0x1d656, null)],
  [
    'script',
    '𝓢𝓬𝓻𝓲𝓹𝓽 unicode text, wedding invitation energy',
    (s) => mapRange(s, 0x1d4d0, 0x1d4ea, null),
    ['cursive'],
  ],
  [
    'fraktur',
    '𝕱𝖗𝖆𝖐𝖙𝖚𝖗 unicode text, extremely medieval',
    (s) => mapRange(s, 0x1d56c, 0x1d586, null),
    ['gothic'],
  ],
  [
    'doublestruck',
    '𝔻𝕠𝕦𝕓𝕝𝕖-struck text, blackboard style',
    (s) =>
      mapRange(s, null, 0x1d552, 0x1d7d8).replace(
        /[A-Z]/g,
        (c) =>
          ({ C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' })[c] ||
          String.fromCodePoint(0x1d538 + c.charCodeAt(0) - 65),
      ),
    ['outline'],
  ],
  ['monospace', '𝚖𝚘𝚗𝚘𝚜𝚙𝚊𝚌𝚎 unicode text, typewriter vibes', (s) => mapRange(s, 0x1d670, 0x1d68a, 0x1d7f6)],
  [
    'strike',
    'S̶t̶r̶i̶k̶e̶t̶h̶r̶o̶u̶g̶h̶ text, no markdown required',
    (s) => [...s].map((c) => c + '\u0336').join(''),
    ['strikethrough'],
  ],
  ['underline', 'U̲n̲d̲e̲r̲l̲i̲n̲e̲ text, no markdown required', (s) => [...s].map((c) => c + '\u0332').join('')],
  [
    'zalgo',
    'Z̷̢a̸͙l̴̰g̵̜o̶̧ text, summon something cursed',
    (s) =>
      [...s]
        .map(
          (c) =>
            c +
            Array.from({ length: 4 }, () =>
              String.fromCharCode(0x300 + Math.floor(Math.random() * 0x6f)),
            ).join(''),
        )
        .join(''),
    ['cursed'],
  ],
  [
    'upsidedown',
    'uʍop ǝpᴉsdn text, turn it on its head',
    (s) => [...table(FLIP_FROM, FLIP_TO)(s)].reverse().join(''),
    ['fliptext'],
  ],
  [
    'mirror',
    'Reverse the letters in each word but keep the word order',
    (s) =>
      s
        .split(' ')
        .map((w) => [...w].reverse().join(''))
        .join(' '),
  ],
  [
    'emojify',
    'Turn text into big 🇪 🇲 🇴 🇯 🇮 letters',
    (s) =>
      [...s.toLowerCase()]
        .map((c) =>
          ALPHA.includes(c)
            ? `:regional_indicator_${c}:`
            : /\d/.test(c)
              ? [
                  ':zero:',
                  ':one:',
                  ':two:',
                  ':three:',
                  ':four:',
                  ':five:',
                  ':six:',
                  ':seven:',
                  ':eight:',
                  ':nine:',
                ][c]
              : c === ' '
                ? '   '
                : c === '?'
                  ? ':question:'
                  : c === '!'
                    ? ':exclamation:'
                    : c,
        )
        .join(' '),
    ['bigtext'],
  ],
  [
    'spoilerall',
    'Wrap every single character in its own spoiler',
    (s) => [...s].map((c) => `||${c}||`).join(''),
    ['spoilerify'],
  ],
  ['spaced', 'S p a c e  o u t your text', (s) => [...s].join(' '), ['space']],
  ['stretch', 'Streeetch your voweeels', (s) => s.replace(/[aeiou]/gi, (v) => v.repeat(3))],
  [
    'stutter',
    'S-s-stutter your t-text',
    (s) =>
      s
        .split(' ')
        .map((w) => (/^[a-z]/i.test(w) ? `${w[0]}-${w}` : w))
        .join(' '),
  ],
  ['reversewords', 'Reverse the order of the words', (s) => s.trim().split(/\s+/).reverse().join(' ')],
  ['shufflewords', 'Shuffle the words into a fresh mess', (s) => shuffle(s.trim().split(/\s+/)).join(' ')],
  [
    'sortwords',
    'Sort words alphabetically',
    (s) =>
      s
        .trim()
        .split(/\s+/)
        .sort((a, b) => a.localeCompare(b))
        .join(' '),
  ],
  [
    'uniquewords',
    'Drop duplicate words, keeping the first of each',
    (s) => [...new Set(s.trim().split(/\s+/))].join(' '),
  ],
  [
    'acronym',
    'Boil a phrase down to an acronym',
    (s) =>
      words(s)
        .map((w) => w[0].toUpperCase())
        .join(''),
  ],
  [
    'slugify',
    'make-a-url-friendly-slug',
    (s) =>
      s
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
    ['slug'],
  ],
  [
    'camelcase',
    'camelCaseText, humps included',
    (s) =>
      words(s)
        .map((w, i) => (i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase()))
        .join(''),
  ],
  [
    'pascalcase',
    'PascalCaseText, like camel but bolder',
    (s) =>
      words(s)
        .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
        .join(''),
  ],
  [
    'snakecase',
    'snake_case_text, sssmooth',
    (s) =>
      words(s)
        .map((w) => w.toLowerCase())
        .join('_'),
  ],
  [
    'kebabcase',
    'kebab-case-text, served on a skewer',
    (s) =>
      words(s)
        .map((w) => w.toLowerCase())
        .join('-'),
  ],
  [
    'constantcase',
    'CONSTANT_CASE_TEXT, for values that never change',
    (s) =>
      words(s)
        .map((w) => w.toUpperCase())
        .join('_'),
    ['screamingcase'],
  ],
  ['removespaces', 'Removeallthespaces, justlikethis', (s) => s.replace(/\s+/g, '')],
  [
    'piglatin',
    'Translate to Pig Latin (anslatetray otay igpay atinlay)',
    (s) =>
      s.replace(/\b([a-z]+)\b/gi, (w) => {
        const m = w.match(/^([^aeiou]*)(.*)$/i);
        return m[1] ? m[2] + m[1] + 'ay' : w + 'way';
      }),
  ],
  [
    'pirate',
    'Translate to pirate speak, arrr',
    (s) =>
      s.replace(/\b\w+\b/g, (w) => {
        const r = PIRATE[w.toLowerCase()];
        return r ? (w[0] === w[0].toUpperCase() ? r[0].toUpperCase() + r.slice(1) : r) : w;
      }) + ' Arrr! 🏴‍☠️',
  ],
  [
    'yoda',
    'Talk like Yoda, you will',
    (s) => {
      const w = s.replace(/[.!?]$/, '').split(' ');
      if (w.length < 3) return s;
      const cut = Math.ceil(w.length / 2);
      return `${w.slice(cut).join(' ')}, ${w.slice(0, cut).join(' ').toLowerCase()}. Hmmm.`;
    },
  ],
  [
    'nato',
    'Spell it all out with the NATO alphabet',
    (s) => [...s.toLowerCase()].map((c) => NATO[c] || (c === ' ' ? '/' : c)).join(' '),
  ],
  [
    'morse',
    'Text → Morse code (dots and dashes ahoy)',
    (s) =>
      [...s.toLowerCase()]
        .map((c) => (c === ' ' ? '/' : MORSE[c] || ''))
        .filter(Boolean)
        .join(' '),
  ],
  [
    'unmorse',
    'Morse code → text',
    (s) =>
      s
        .trim()
        .split(/\s+/)
        .map((c) => (c === '/' ? ' ' : UNMORSE[c] || '?'))
        .join('')
        .toUpperCase(),
    ['frommorse'],
  ],
  [
    'braille',
    'Text → Braille',
    (s) =>
      [...s.toLowerCase()]
        .map((c) => {
          const i = BRAILLE.indexOf(c);
          return i >= 0 ? String.fromCharCode(0x2800 + i) : c;
        })
        .join(''),
  ],
  [
    'binary',
    'Text → binary, for the 0s and 1s enthusiasts',
    (s) => [...Buffer.from(s)].map((b) => b.toString(2).padStart(8, '0')).join(' '),
  ],
  [
    'unbinary',
    'Binary → text',
    (s) => {
      const b = s.replace(/[^01]/g, '');
      assert(b.length % 8 === 0 && b.length, 'Binary has to come in groups of 8 bits, and yours is off.');
      return Buffer.from(b.match(/.{8}/g).map((x) => parseInt(x, 2))).toString('utf8');
    },
    ['frombinary'],
  ],
  [
    'hex',
    'Text → hexadecimal',
    (s) =>
      Buffer.from(s)
        .toString('hex')
        .match(/.{1,2}/g)
        .join(' '),
    ['tohex'],
  ],
  [
    'unhex',
    'Hexadecimal → text',
    (s) => {
      const h = s.replace(/[^0-9a-f]/gi, '');
      assert(h.length % 2 === 0 && h.length, "That doesn't look like valid hex.");
      return Buffer.from(h, 'hex').toString('utf8');
    },
    ['fromhex'],
  ],
  ['octal', 'Text → octal', (s) => [...Buffer.from(s)].map((b) => b.toString(8).padStart(3, '0')).join(' ')],
  ['base64', 'Text → Base64', (s) => Buffer.from(s).toString('base64'), ['b64']],
  [
    'unbase64',
    'Base64 → text',
    (s) => {
      const out = Buffer.from(s.trim(), 'base64').toString('utf8');
      assert(out, "That doesn't look like valid Base64.");
      return out;
    },
    ['fromb64', 'debase64'],
  ],
  ['rot13', 'ROT13 encode/decode (same trick both ways)', (s) => caesar(s, 13)],
  [
    'rot47',
    'ROT47 encode/decode (ROT13 with more symbols)',
    (s) => s.replace(/[!-~]/g, (c) => String.fromCharCode(33 + ((c.charCodeAt(0) + 14) % 94))),
  ],
  [
    'atbash',
    'Atbash cipher, flips A↔Z',
    (s) =>
      s.replace(/[a-z]/gi, (c) => {
        const b = c <= 'Z' ? 65 : 97;
        return String.fromCharCode(b + 25 - (c.charCodeAt(0) - b));
      }),
  ],
  ['urlencode', 'URL-encode text', (s) => encodeURIComponent(s)],
  [
    'urldecode',
    'URL-decode text',
    (s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        assert(false, 'That URL encoding is busted, sorry.');
      }
    },
  ],
  [
    'htmlescape',
    'Escape HTML entities so they behave',
    (s) =>
      s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;'),
  ],
  [
    'charcodes',
    'Characters → decimal char codes',
    (s) => [...s].map((c) => c.codePointAt(0)).join(' '),
    ['ascii'],
  ],
];

// Outputs where exact spacing and characters matter get a code block.
const CODE_OUT = new Set([
  'binary',
  'unbinary',
  'hex',
  'unhex',
  'octal',
  'base64',
  'unbase64',
  'morse',
  'unmorse',
  'urlencode',
  'urldecode',
  'htmlescape',
  'charcodes',
  'rot47',
  'slugify',
  'camelcase',
  'pascalcase',
  'snakecase',
  'kebabcase',
  'constantcase',
]);
const transforms = T.map(([name, description, fn, aliases = []]) => ({
  name,
  description,
  aliases,
  options: [{ name: 'text', type: 'string', required: true, description: 'The text to mess with' }],
  async run(ctx, a) {
    // Input is capped lower than output because some transforms (zalgo, emojify) balloon the length.
    const out = fn(a.text.slice(0, 1500));
    assert(out && out.trim(), 'That came out blank. Try some different text?');
    return card({
      description: CODE_OUT.has(name) ? codeblock(out) : out.slice(0, 2500),
      footer: name,
      color: C.info,
    });
  },
}));

const counts = (s) => ({
  chars: [...s].length,
  noSpace: s.replace(/\s/g, '').length,
  words: s.trim() ? s.trim().split(/\s+/).length : 0,
  lines: s.split('\n').length,
  sentences: (s.match(/[^.!?]+[.!?]+/g) || [s]).filter((x) => x.trim()).length,
  vowels: (s.match(/[aeiou]/gi) || []).length,
});

module.exports = [
  ...transforms,
  {
    name: 'caesar',
    description: 'Caesar cipher with a shift of your choosing',
    options: [
      {
        name: 'shift',
        type: 'integer',
        required: true,
        min: -25,
        max: 25,
        description: 'How far to shift (-25 to 25)',
      },
      { name: 'text', type: 'string', required: true, description: 'The text to scramble' },
    ],
    async run(ctx, a) {
      return card({
        description: codeblock(caesar(a.text, a.shift)),
        footer: `caesar ${a.shift}`,
        color: C.info,
      });
    },
  },
  {
    name: 'vigenere',
    description: 'Vigenère cipher. Start the key with - to decode instead',
    options: [
      { name: 'key', type: 'string', required: true, description: 'Secret key (letters only)', rest: false },
      { name: 'text', type: 'string', required: true, description: 'The text to scramble or unscramble' },
    ],
    async run(ctx, a) {
      const dec = a.key.startsWith('-');
      const key = a.key.replace(/[^a-z]/gi, '').toLowerCase();
      assert(key, 'I need a key with actual letters in it. Put a - in front to decode.');
      let j = 0;
      const out = a.text.replace(/[a-z]/gi, (c) => {
        const k = key.charCodeAt(j++ % key.length) - 97;
        return caesar(c, dec ? -k : k);
      });
      return card({ description: codeblock(out), footer: dec ? 'decoded' : 'encoded', color: C.info });
    },
  },
  {
    name: 'repeat',
    description: 'Repeat text a bunch of times',
    options: [
      { name: 'times', type: 'integer', required: true, min: 1, max: 50, description: 'How many times' },
      { name: 'text', type: 'string', required: true, description: 'The text to repeat' },
    ],
    async run(ctx, a) {
      return card({ description: (a.text + ' ').repeat(a.times).slice(0, 2000) });
    },
  },
  {
    name: 'count',
    description: 'Count characters, words, lines and other trivia',
    aliases: ['wordcount', 'charcount'],
    options: [{ name: 'text', type: 'string', required: true, description: 'The text to count' }],
    async run(ctx, a) {
      const c = counts(a.text);
      return card({
        title: 'Text stats',
        fields: [
          ['Characters', c.chars],
          ['Minus spaces', c.noSpace],
          ['Words', c.words],
          ['Lines', c.lines],
          ['Sentences', c.sentences],
          ['Vowels', c.vowels],
        ].map(([k, v]) => [k, String(v)]),
      });
    },
  },
  {
    name: 'palindrome',
    description: 'Check whether text reads the same both ways',
    options: [{ name: 'text', type: 'string', required: true, description: 'The text to check' }],
    async run(ctx, a) {
      const s = a.text.toLowerCase().replace(/[^a-z0-9]/g, '');
      assert(s, 'Gimme at least one letter or number to work with.');
      const yes = s === [...s].reverse().join('');
      return card({
        description: `${yes ? '✅' : '❌'} **${a.text.slice(0, 200)}** is ${yes ? '' : 'not '}a palindrome.`,
      });
    },
  },
  {
    name: 'anagram',
    description: 'Check if two words or phrases are anagrams',
    options: [
      { name: 'first', type: 'string', required: true, description: 'First word', rest: false },
      { name: 'second', type: 'string', required: true, description: 'Second word or phrase' },
    ],
    async run(ctx, a) {
      const n = (s) => [...s.toLowerCase().replace(/[^a-z0-9]/g, '')].sort().join('');
      const yes = n(a.first) === n(a.second) && n(a.first);
      return card({
        description: `${yes ? '✅' : '❌'} **${a.first}** and **${a.second}** are ${yes ? '' : 'not '}anagrams.`,
      });
    },
  },
  {
    name: 'codeblock',
    description: 'Wrap code in a code block with syntax highlighting',
    options: [
      {
        name: 'language',
        type: 'string',
        required: true,
        description: 'Language (js, py, json…)',
        rest: false,
      },
      { name: 'code', type: 'string', required: true, description: 'The code to wrap' },
    ],
    async run(ctx, a) {
      return card({ description: codeblock(a.code, a.language.replace(/\W/g, '')) });
    },
  },
  {
    name: 'lenny',
    description: '( ͡° ͜ʖ ͡°)',
    async run() {
      return '( ͡° ͜ʖ ͡°)';
    },
  },
  {
    name: 'shrugface',
    description: '¯\\_(ツ)_/¯',
    async run() {
      // Backslashes and underscores are escaped so markdown doesn't eat the arm and the face.
      return '¯\\\\_(ツ)\\_/¯';
    },
  },
  {
    name: 'fliptable',
    description: '(╯°□°)╯︵ ┻━┻',
    async run() {
      return '(╯°□°)╯︵ ┻━┻';
    },
  },
  {
    name: 'unflip',
    description: '┬─┬ ノ( ゜-゜ノ)',
    async run() {
      return '┬─┬ ノ( ゜-゜ノ)';
    },
  },
  {
    name: 'disapprove',
    description: 'ಠ_ಠ',
    async run() {
      return 'ಠ\\_ಠ';
    },
  },
];
