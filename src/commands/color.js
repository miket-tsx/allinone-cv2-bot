const { card } = require('../lib/ui');
const { assert, randInt } = require('../lib/util');

const NAMED = {
  red: 'ff0000',
  green: '00ff00',
  blue: '0000ff',
  white: 'ffffff',
  black: '000000',
  yellow: 'ffff00',
  cyan: '00ffff',
  magenta: 'ff00ff',
  orange: 'ffa500',
  purple: '800080',
  pink: 'ffc0cb',
  gray: '808080',
  grey: '808080',
  brown: 'a52a2a',
  blurple: '5865f2',
  teal: '008080',
  navy: '000080',
  gold: 'ffd700',
  lime: '32cd32',
  crimson: 'dc143c',
  indigo: '4b0082',
  coral: 'ff7f50',
  salmon: 'fa8072',
  violet: 'ee82ee',
};
function parse(input) {
  const s = String(input).trim().toLowerCase();
  if (NAMED[s]) return parseInt(NAMED[s], 16);
  let m = s.match(/^#?([0-9a-f]{6})$/);
  if (m) return parseInt(m[1], 16);
  m = s.match(/^#?([0-9a-f]{3})$/);
  if (m) return parseInt([...m[1]].map((c) => c + c).join(''), 16);
  m = s.match(/^(?:rgb\()?\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*\)?$/);
  if (m && m.slice(1).every((x) => x <= 255)) return (m[1] << 16) | (m[2] << 8) | Number(m[3]);
  m = s.match(/^hsl\(?\s*(\d{1,3})[\s,]+(\d{1,3})%?[\s,]+(\d{1,3})%?\s*\)?$/);
  if (m) return fromHsl(+m[1], +m[2], +m[3]);
  assert(
    false,
    "Hmm, I couldn't make sense of that color. Try `#ff0055`, `f05`, `rgb(255,0,85)`, `hsl(340,100,50)` or a name like `coral`.",
  );
}
const rgb = (n) => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
const hex = (n) => '#' + n.toString(16).padStart(6, '0').toUpperCase();
function toHsl(n) {
  let [r, g, b] = rgb(n).map((x) => x / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}
// Same conversion the CSS Color spec uses
function fromHsl(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return (f(0) << 16) | (f(8) << 8) | f(4);
}
const swatch = (n) => `https://singlecolorimage.com/get/${n.toString(16).padStart(6, '0')}/200x80`;
function info(n, title) {
  const [r, g, b] = rgb(n);
  const [h, s, l] = toHsl(n);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return card({
    title: title || hex(n),
    color: n,
    image: swatch(n),
    fields: [
      ['HEX', hex(n)],
      ['RGB', `rgb(${r}, ${g}, ${b})`],
      ['HSL', `hsl(${h}, ${s}%, ${l}%)`],
      ['Integer', String(n)],
      ['Best text color', lum > 0.55 ? 'Black' : 'White'],
    ],
  });
}
const shade = (n, amt) => {
  const [h, s, l] = toHsl(n);
  return fromHsl(h, s, Math.max(0, Math.min(100, l + amt)));
};
const colorOpt = {
  name: 'color',
  type: 'string',
  required: true,
  description: 'Hex, rgb(), hsl() or a name like coral',
};
const one = (name, description, fn, aliases = []) => ({
  name,
  description,
  aliases,
  options: [colorOpt],
  async run(ctx, a) {
    const n = parse(a.color);
    return info(fn(n), `${name}: ${hex(n)} → ${hex(fn(n))}`);
  },
});

module.exports = [
  {
    name: 'color',
    description: 'Get the full rundown and a swatch for any color',
    aliases: ['colour', 'colorinfo'],
    options: [colorOpt],
    async run(ctx, a) {
      return info(parse(a.color));
    },
  },
  {
    name: 'randomcolor',
    description: 'Roll the dice and get a random color',
    aliases: ['randomcolour'],
    async run() {
      return info(randInt(0, 0xffffff), 'Fresh off the color roulette 🎲');
    },
  },
  one('complement', 'Find the color sitting opposite on the wheel', (n) => {
    const [h, s, l] = toHsl(n);
    return fromHsl((h + 180) % 360, s, l);
  }),
  one('invertcolor', 'Flip a color to its exact opposite', (n) => 0xffffff ^ n, ['invert']),
  one('lighten', 'Brighten a color by 15%', (n) => shade(n, 15)),
  one('darken', 'Make a color moodier by darkening it 15%', (n) => shade(n, -15)),
  one(
    'grayscale',
    'Drain all the fun (and color) out of a color',
    (n) => {
      const [r, g, b] = rgb(n);
      const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      return (y << 16) | (y << 8) | y;
    },
    ['greyscale'],
  ),
  {
    name: 'mixcolors',
    description: 'Blend two colors half and half',
    aliases: ['blend'],
    options: [
      { ...colorOpt, name: 'first', rest: false },
      { ...colorOpt, name: 'second' },
    ],
    async run(ctx, a) {
      const x = rgb(parse(a.first));
      const y = rgb(parse(a.second));
      const m = x.map((v, i) => Math.round((v + y[i]) / 2));
      const n = (m[0] << 16) | (m[1] << 8) | m[2];
      return info(n, `Mixed → ${hex(n)}`);
    },
  },
  {
    name: 'palette',
    description: 'Whip up a 5-color palette that actually goes together',
    options: [{ name: 'color', type: 'string', description: 'Starting color (leave blank for a surprise)' }],
    async run(ctx, a) {
      const base = a.color ? parse(a.color) : randInt(0, 0xffffff);
      const [h, s, l] = toHsl(base);
      // Clamp saturation and lightness so near-black/white bases still give usable swatches
      const cols = [0, 30, 60, 180, 210].map((d) =>
        fromHsl((h + d) % 360, Math.max(s, 45), Math.min(Math.max(l, 35), 65)),
      );
      return card({
        title: '🎨 Your palette',
        color: base,
        description: cols.map(hex).join('  ·  '),
        images: cols.map(swatch),
      });
    },
  },
  {
    name: 'contrast',
    description: 'Check the WCAG contrast ratio of two colors',
    options: [
      { ...colorOpt, name: 'first', rest: false },
      { ...colorOpt, name: 'second' },
    ],
    async run(ctx, a) {
      // Relative luminance per WCAG 2.x
      const L = (n) => {
        const c = rgb(n).map((v) => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      };
      const [l1, l2] = [L(parse(a.first)), L(parse(a.second))].sort((x, y) => y - x);
      const r = (l1 + 0.05) / (l2 + 0.05);
      return card({
        title: 'Contrast check',
        description: `**${r.toFixed(2)}:1**`,
        fields: [
          ['AA normal text', r >= 4.5 ? '✅' : '❌'],
          ['AA large text', r >= 3 ? '✅' : '❌'],
          ['AAA normal text', r >= 7 ? '✅' : '❌'],
        ],
      });
    },
  },
  {
    name: 'rolecolor',
    description: "Peek at a role's color",
    guildOnly: true,
    options: [{ name: 'role', type: 'role', required: true, description: 'The role to peek at' }],
    async run(ctx, a) {
      return info(a.role.color, `${a.role.name} — ${hex(a.role.color)}`);
    },
  },
];
