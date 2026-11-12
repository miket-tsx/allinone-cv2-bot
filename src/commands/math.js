const { card, C } = require('../lib/ui');
const { assert, fmtNum } = require('../lib/util');
const { evaluate, fact } = require('../lib/mathparse');

const N = (name, d, req = true) => ({ name, type: 'number', required: req, description: d });
const I = (name, d, min, max) => ({ name, type: 'integer', required: true, description: d, min, max });
const LIST = {
  name: 'numbers',
  type: 'string',
  required: true,
  description: 'Numbers, separated by spaces or commas',
};
const nums = (s) => {
  const a = s
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  assert(a.length && a.every(Number.isFinite), 'I need actual numbers here, separated by spaces or commas.');
  return a;
};
const res = (title, value, extra) =>
  card({
    title,
    description: `**${typeof value === 'number' ? fmtNum(value) : value}**${extra ? `\n${extra}` : ''}`,
    color: C.info,
  });
const fin = (v) => {
  assert(Number.isFinite(v), "That answer is either too big for me or just isn't a number.");
  return v;
};

const binary = (name, description, sym, fn, aliases = []) => ({
  name,
  description,
  aliases,
  options: [N('a', 'The first number'), N('b', 'The second number')],
  async run(ctx, a) {
    return res(`${fmtNum(a.a)} ${sym} ${fmtNum(a.b)}`, fin(fn(a.a, a.b)));
  },
});
const unary = (name, description, fn, aliases = [], label) => ({
  name,
  description,
  aliases,
  options: [N('x', 'Your number')],
  async run(ctx, a) {
    return res(`${label || name}(${fmtNum(a.x)})`, fin(fn(a.x)));
  },
});
const listCmd = (name, description, fn, aliases = []) => ({
  name,
  description,
  aliases,
  options: [LIST],
  async run(ctx, a) {
    const n = nums(a.numbers);
    return res(`${name} of ${n.length} number(s)`, fn(n));
  },
});

const isPrime = (n) => {
  if (n < 2 || !Number.isInteger(n)) return false;
  if (n < 4) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return false;
  return true;
};
const gcd = (a, b) => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};
const mean = (n) => n.reduce((s, x) => s + x, 0) / n.length;
const variance = (n) => {
  const m = mean(n);
  return n.reduce((s, x) => s + (x - m) ** 2, 0) / n.length;
};
const ROMAN = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];
const ONES = [
  '',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function words(n) {
  if (n === 0) return 'zero';
  if (n < 0) return 'minus ' + words(-n);
  const scales = [
    [1e12, 'trillion'],
    [1e9, 'billion'],
    [1e6, 'million'],
    [1e3, 'thousand'],
    [100, 'hundred'],
  ];
  for (const [v, w] of scales)
    if (n >= v)
      return `${words(Math.floor(n / v))} ${w}${n % v ? (v === 100 ? ' and ' : ' ') + words(n % v) : ''}`;
  return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
}
const baseConv = (name, description, from, to, aliases = []) => ({
  name,
  description,
  aliases,
  options: [
    { name: 'value', type: 'string', required: true, description: `A number written in base ${from}` },
  ],
  async run(ctx, a) {
    const v = a.value.trim().replace(/^0[xbo]/i, '');
    const n = parseInt(v, from);
    // parseInt quietly stops at the first bad digit, so check every character ourselves
    assert(
      !Number.isNaN(n) && [...v.toLowerCase()].every((c) => parseInt(c, from) < from),
      `That doesn't look like a valid base-${from} number to me.`,
    );
    return res(`${a.value} (base ${from}) → base ${to}`, n.toString(to).toUpperCase());
  },
});

module.exports = [
  {
    name: 'calc',
    description: 'Your pocket calculator: 2^10, sqrt(2)*pi, 5!, sin(pi/2)…',
    aliases: ['math', 'calculate', '='],
    options: [{ name: 'expression', type: 'string', required: true, description: 'What you want crunched' }],
    async run(ctx, a) {
      let v;
      try {
        v = evaluate(a.expression);
      } catch (e) {
        assert(false, `That didn't compute: ${e.message}`);
      }
      return card({
        title: '🧮 Calculator',
        fields: [
          ['Input', `\`${a.expression.slice(0, 200)}\``],
          ['Result', `**${Number.isFinite(v) ? fmtNum(+v.toPrecision(15)) : String(v)}**`],
        ],
        color: C.info,
      });
    },
  },
  binary('add', 'Add two numbers together', '+', (x, y) => x + y, ['plus']),
  binary('subtract', 'Take one number away from another', '−', (x, y) => x - y, ['minus']),
  binary('multiply', 'Multiply two numbers', '×', (x, y) => x * y, ['times']),
  binary('divide', 'Divide one number by another', '÷', (x, y) => {
    assert(y !== 0, 'Dividing by zero? Bold move. Still impossible.');
    return x / y;
  }),
  binary('power', 'Raise a to the power of b', '^', (x, y) => x ** y, ['pow']),
  binary(
    'modulo',
    'The remainder of a ÷ b',
    'mod',
    (x, y) => {
      assert(y !== 0, "Modulo by zero isn't a thing, sorry.");
      // JS % keeps the dividend's sign; this gives the always-positive flavor
      return ((x % y) + y) % y;
    },
    ['mod'],
  ),
  binary(
    'root',
    'The b-th root of a',
    '√',
    (x, y) => {
      assert(y !== 0, "There's no 0th root. Try a different degree.");
      // odd roots of negatives are real, but ** would give NaN
      return x < 0 && y % 2 ? -((-x) ** (1 / y)) : x ** (1 / y);
    },
    ['nthroot'],
  ),
  binary(
    'hypotenuse',
    'Let Pythagoras find the hypotenuse from two sides',
    'hyp',
    (x, y) => Math.hypot(x, y),
    ['hypot'],
  ),
  binary('percentof', 'What is a% of b?', '% of', (x, y) => (x / 100) * y),
  binary('percentage', 'What percent is a of b?', 'as % of', (x, y) => {
    assert(y !== 0, "b can't be 0. There's no percentage of nothing.");
    return (x / y) * 100;
  }),
  binary('percentchange', 'Percent change from a to b', '→ % change', (x, y) => {
    assert(x !== 0, "a can't be 0. You can't measure change from nothing.");
    return ((y - x) / Math.abs(x)) * 100;
  }),
  binary('logbase', 'Logarithm of a in base b', 'log base', (x, y) => Math.log(x) / Math.log(y)),
  binary('gcd', 'Greatest common divisor', 'gcd', (x, y) => gcd(x, y), ['hcf']),
  binary('lcm', 'Least common multiple', 'lcm', (x, y) => Math.abs(x * y) / gcd(x, y)),
  binary(
    'ncr',
    'Combinations: how many ways to choose b from a',
    'C',
    (n, r) => {
      assert(
        Number.isInteger(n) && Number.isInteger(r) && r >= 0 && n >= r && n <= 1000,
        'Whole numbers only, and keep it at 0 ≤ b ≤ a ≤ 1000.',
      );
      let v = 1;
      // multiply before dividing so every intermediate step stays an exact integer
      for (let i = 1; i <= r; i++) v = (v * (n - r + i)) / i;
      return Math.round(v);
    },
    ['combinations'],
  ),
  binary(
    'npr',
    'Permutations: how many ways to arrange b of a',
    'P',
    (n, r) => {
      assert(
        Number.isInteger(n) && Number.isInteger(r) && r >= 0 && n >= r && n <= 170,
        'Whole numbers only, and keep it at 0 ≤ b ≤ a ≤ 170.',
      );
      return fact(n) / fact(n - r);
    },
    ['permutations'],
  ),
  unary('sqrt', 'Square root', (x) => {
    assert(x >= 0, "Negative numbers don't have a real square root. Imaginary ones are out of scope.");
    return Math.sqrt(x);
  }),
  unary('cbrt', 'Cube root', Math.cbrt),
  unary('square', 'Square a number', (x) => x * x),
  unary('cube', 'Cube a number', (x) => x ** 3),
  unary('abs', 'Absolute value (drops the minus sign)', Math.abs),
  unary('round', 'Round to the nearest whole number', Math.round),
  unary('floor', 'Round down', Math.floor),
  unary('ceil', 'Round up', Math.ceil),
  unary('ln', 'Natural logarithm', (x) => {
    assert(x > 0, 'ln only plays with positive numbers.');
    return Math.log(x);
  }),
  unary(
    'log10',
    'Base-10 logarithm',
    (x) => {
      assert(x > 0, 'log only works on positive numbers.');
      return Math.log10(x);
    },
    ['log'],
  ),
  unary('exp', 'e raised to the power of x', Math.exp),
  // toFixed(12) scrubs float noise, so sin(180) shows 0 instead of 1.2e-16
  unary('sin', 'Sine (in degrees)', (x) => +Math.sin((x * Math.PI) / 180).toFixed(12)),
  unary('cos', 'Cosine (in degrees)', (x) => +Math.cos((x * Math.PI) / 180).toFixed(12)),
  unary('tan', 'Tangent (in degrees)', (x) => {
    assert(Math.abs(x % 180) !== 90, 'tan shoots off to infinity there. No answer for you.');
    return +Math.tan((x * Math.PI) / 180).toFixed(12);
  }),
  unary('deg2rad', 'Degrees → radians', (x) => (x * Math.PI) / 180, [], 'rad'),
  unary('rad2deg', 'Radians → degrees', (x) => (x * 180) / Math.PI, [], 'deg'),
  unary('reciprocal', 'Flip it: 1 ÷ x', (x) => {
    assert(x !== 0, "Zero doesn't have a reciprocal, sadly.");
    return 1 / x;
  }),
  {
    name: 'factorial',
    description: 'n! for any n from 0 to 170',
    options: [I('n', 'A whole number', 0, 170)],
    async run(ctx, a) {
      return res(`${a.n}!`, fact(a.n));
    },
  },
  {
    name: 'fibonacci',
    description: 'The n-th Fibonacci number, plus how we got there',
    aliases: ['fib'],
    options: [I('n', 'Position in the sequence (1-75)', 1, 75)],
    async run(ctx, a) {
      const s = [0, 1];
      while (s.length <= a.n) s.push(s.at(-1) + s.at(-2));
      return res(
        `F(${a.n})`,
        s[a.n],
        `The run-up: ${s.slice(0, Math.min(a.n + 1, 20)).join(', ')}${a.n > 19 ? ', …' : ''}`,
      );
    },
  },
  {
    name: 'isprime',
    description: 'Find out if a number is prime',
    aliases: ['prime'],
    options: [I('n', 'A whole number', 0, 1e12)],
    async run(ctx, a) {
      return res(`Is ${fmtNum(a.n)} prime?`, isPrime(a.n) ? 'Yep, prime ✅' : 'Nope ❌');
    },
  },
  {
    name: 'primes',
    description: 'List every prime up to n',
    options: [I('n', 'Upper limit (2-5000)', 2, 5000)],
    async run(ctx, a) {
      const p = [];
      for (let i = 2; i <= a.n; i++) if (isPrime(i)) p.push(i);
      // stay comfortably under the embed length limit
      return res(`${p.length} primes ≤ ${a.n}`, p.join(', ').slice(0, 1800));
    },
  },
  {
    name: 'primefactors',
    description: 'Break a number down into its prime factors',
    aliases: ['factorize'],
    options: [I('n', 'A whole number, 2 or more', 2, 1e12)],
    async run(ctx, a) {
      let n = a.n;
      const f = [];
      for (let d = 2; d * d <= n; d++)
        while (n % d === 0) {
          f.push(d);
          n /= d;
        }
      if (n > 1) f.push(n);
      return res(`Prime factors of ${fmtNum(a.n)}`, f.join(' × '));
    },
  },
  {
    name: 'divisors',
    description: 'Every number that divides evenly into n',
    options: [I('n', 'A whole number (1 to 1e9)', 1, 1e9)],
    async run(ctx, a) {
      const d = [];
      for (let i = 1; i * i <= a.n; i++)
        if (a.n % i === 0) {
          d.push(i);
          if (i !== a.n / i) d.push(a.n / i);
        }
      d.sort((x, y) => x - y);
      return res(`${d.length} divisors of ${fmtNum(a.n)}`, d.join(', ').slice(0, 1800));
    },
  },
  {
    name: 'collatz',
    description: 'Follow the Collatz sequence from n down to 1',
    options: [I('n', 'Where to start', 1, 1e9)],
    async run(ctx, a) {
      let n = a.n;
      const s = [n];
      // hard cap so an unlucky start can't spin forever
      while (n !== 1 && s.length < 1000) {
        n = n % 2 ? 3 * n + 1 : n / 2;
        s.push(n);
      }
      return res(`Collatz(${a.n}) — ${s.length - 1} steps`, s.join(' → ').slice(0, 1800));
    },
  },
  {
    name: 'digitsum',
    description: 'Add up all the digits of a number',
    options: [{ name: 'n', type: 'string', required: true, description: 'Any number' }],
    async run(ctx, a) {
      const d = a.n.replace(/\D/g, '');
      assert(d, 'I need at least one digit to work with.');
      return res(
        `Digit sum of ${a.n}`,
        [...d].reduce((s, x) => s + Number(x), 0),
      );
    },
  },
  listCmd('sum', 'Add up a bunch of numbers', (n) => n.reduce((s, x) => s + x, 0), ['total']),
  listCmd('average', 'The average (mean) of your numbers', mean, ['mean', 'avg']),
  listCmd('median', 'The middle value of your numbers', (n) => {
    const s = [...n].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }),
  listCmd('mode', 'Whichever number(s) show up most often', (n) => {
    const c = {};
    n.forEach((x) => (c[x] = (c[x] || 0) + 1));
    const max = Math.max(...Object.values(c));
    return (
      Object.keys(c)
        .filter((k) => c[k] === max)
        .join(', ') + ` (×${max})`
    );
  }),
  listCmd(
    'range',
    'The spread between the biggest and smallest (max − min)',
    (n) => Math.max(...n) - Math.min(...n),
  ),
  listCmd('minimum', 'The smallest of the bunch', (n) => Math.min(...n), ['min']),
  listCmd('maximum', 'The largest of the bunch', (n) => Math.max(...n), ['max']),
  listCmd('stddev', 'Population standard deviation', (n) => Math.sqrt(variance(n)), ['standarddeviation']),
  listCmd('variance', 'Population variance', variance),
  listCmd('product', 'Multiply a bunch of numbers together', (n) => n.reduce((s, x) => s * x, 1)),
  listCmd(
    'sortnumbers',
    'Sort numbers from smallest to largest',
    (n) => [...n].sort((a, b) => a - b).join(', '),
    ['sortnum'],
  ),
  {
    name: 'roman',
    description: 'Turn a number into Roman numerals',
    options: [I('n', 'A whole number from 1 to 3999', 1, 3999)],
    async run(ctx, a) {
      let n = a.n;
      let r = '';
      for (const [v, s] of ROMAN)
        while (n >= v) {
          r += s;
          n -= v;
        }
      return res(`${a.n} in Roman numerals`, r);
    },
  },
  {
    name: 'unroman',
    description: 'Turn Roman numerals back into a number',
    aliases: ['fromroman'],
    options: [{ name: 'numeral', type: 'string', required: true, description: 'Something like MMXXVI' }],
    async run(ctx, a) {
      const s = a.numeral.toUpperCase();
      assert(
        /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(s) && s,
        "Caesar wouldn't recognize that as a Roman numeral.",
      );
      const v = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
      let t = 0;
      for (let i = 0; i < s.length; i++) t += v[s[i]] < (v[s[i + 1]] || 0) ? -v[s[i]] : v[s[i]];
      return res(`${s} as a number`, t);
    },
  },
  {
    name: 'numbertowords',
    description: 'Spell a number out in English',
    aliases: ['numwords'],
    options: [I('n', 'A whole number', -1e15, 1e15)],
    async run(ctx, a) {
      return res(fmtNum(a.n), words(a.n));
    },
  },
  {
    name: 'convertbase',
    description: 'Convert a number between any two bases from 2 to 36',
    aliases: ['base'],
    options: [
      I('from', 'Base to convert from', 2, 36),
      I('to', 'Base to convert to', 2, 36),
      { name: 'value', type: 'string', required: true, description: 'The number to convert' },
    ],
    async run(ctx, a) {
      const n = parseInt(a.value, a.from);
      assert(!Number.isNaN(n), "That number doesn't fit the base you picked.");
      return res(`${a.value} (base ${a.from}) → base ${a.to}`, n.toString(a.to).toUpperCase());
    },
  },
  baseConv('dec2bin', 'Decimal → binary', 10, 2),
  baseConv('bin2dec', 'Binary → decimal', 2, 10),
  baseConv('dec2hex', 'Decimal → hexadecimal', 10, 16),
  baseConv('hex2dec', 'Hexadecimal → decimal', 16, 10),
  baseConv('dec2oct', 'Decimal → octal', 10, 8),
  baseConv('oct2dec', 'Octal → decimal', 8, 10),
  baseConv('bin2hex', 'Binary → hexadecimal', 2, 16),
  baseConv('hex2bin', 'Hexadecimal → binary', 16, 2),
  {
    name: 'quadratic',
    description: 'Solve ax² + bx + c = 0, complex roots included',
    options: [N('a', 'Coefficient a'), N('b', 'Coefficient b'), N('c', 'Coefficient c')],
    async run(ctx, a) {
      assert(a.a !== 0, "`a` can't be 0, or it stops being a quadratic.");
      const d = a.b ** 2 - 4 * a.a * a.c;
      const f = (x) => fmtNum(+x.toFixed(6));
      const sol =
        d >= 0
          ? `x₁ = ${f((-a.b + Math.sqrt(d)) / (2 * a.a))}\nx₂ = ${f((-a.b - Math.sqrt(d)) / (2 * a.a))}`
          : `x = ${f(-a.b / (2 * a.a))} ± ${f(Math.sqrt(-d) / (2 * a.a))}i`;
      return card({
        title: `${a.a}x² + ${a.b}x + ${a.c} = 0`,
        description: `Discriminant: ${f(d)}\n${sol}`,
        color: C.info,
      });
    },
  },
  {
    name: 'circle',
    description: 'Area, circumference and diameter from a radius',
    options: [N('radius', 'The radius')],
    async run(ctx, a) {
      assert(a.radius >= 0, "Negative radius? Circles don't work that way.");
      return card({
        title: `Circle r = ${a.radius}`,
        fields: [
          ['Area', fmtNum(Math.PI * a.radius ** 2)],
          ['Circumference', fmtNum(2 * Math.PI * a.radius)],
          ['Diameter', fmtNum(2 * a.radius)],
        ],
        color: C.info,
      });
    },
  },
  {
    name: 'triangle',
    description: 'Area and perimeter of a triangle from its three sides',
    options: [N('a', 'Length of side a'), N('b', 'Length of side b'), N('c', 'Length of side c')],
    async run(ctx, x) {
      const { a, b, c } = x;
      assert(a + b > c && a + c > b && b + c > a && a > 0, "Those sides can't close up into a triangle.");
      const s = (a + b + c) / 2;
      return card({
        title: 'Triangle',
        fields: [
          ['Area', fmtNum(Math.sqrt(s * (s - a) * (s - b) * (s - c)))],
          ['Perimeter', fmtNum(a + b + c)],
        ],
        color: C.info,
      });
    },
  },
  {
    name: 'sphere',
    description: 'Volume and surface area of a sphere',
    options: [N('radius', 'The radius')],
    async run(ctx, a) {
      return card({
        title: `Sphere r = ${a.radius}`,
        fields: [
          ['Volume', fmtNum((4 / 3) * Math.PI * a.radius ** 3)],
          ['Surface area', fmtNum(4 * Math.PI * a.radius ** 2)],
        ],
        color: C.info,
      });
    },
  },
  {
    name: 'interest',
    description: 'Watch your money grow: principal, annual rate %, years',
    aliases: ['compound'],
    options: [
      N('principal', 'What you start with'),
      N('rate', 'Annual rate in %'),
      N('years', 'How many years to wait'),
      {
        name: 'times',
        type: 'integer',
        min: 1,
        max: 365,
        description: 'Compounds per year (defaults to 12)',
      },
    ],
    async run(ctx, a) {
      const n = a.times || 12;
      const total = a.principal * (1 + a.rate / 100 / n) ** (n * a.years);
      return card({
        title: '💰 Compound interest',
        fields: [
          ['Final amount', fmtNum(+total.toFixed(2))],
          ['Interest earned', fmtNum(+(total - a.principal).toFixed(2))],
          ['Compounding', `${n}×/year`],
        ],
        color: C.info,
      });
    },
  },
  {
    name: 'loan',
    description: 'Monthly payment on a loan: amount, annual rate %, years',
    aliases: ['emi', 'mortgage'],
    options: [
      N('amount', 'How much you borrow'),
      N('rate', 'Annual interest in %'),
      N('years', 'Length of the loan in years'),
    ],
    async run(ctx, a) {
      const r = a.rate / 100 / 12;
      const n = a.years * 12;
      assert(n > 0, 'The loan has to last longer than zero years.');
      // a 0% rate would divide by zero in the annuity formula
      const m = r ? (a.amount * r) / (1 - (1 + r) ** -n) : a.amount / n;
      return card({
        title: '🏦 Loan calculator',
        fields: [
          ['Monthly payment', fmtNum(+m.toFixed(2))],
          ['Total paid', fmtNum(+(m * n).toFixed(2))],
          ['Total interest', fmtNum(+(m * n - a.amount).toFixed(2))],
        ],
        color: C.info,
      });
    },
  },
  {
    name: 'tip',
    description: 'Work out the tip and split the bill',
    options: [
      N('bill', 'The bill before tip'),
      N('percent', 'Tip in %'),
      {
        name: 'people',
        type: 'integer',
        min: 1,
        max: 100,
        description: 'How many are splitting it (defaults to 1)',
      },
    ],
    async run(ctx, a) {
      const p = a.people || 1;
      const tip = (a.bill * a.percent) / 100;
      return card({
        title: '🧾 Tip calculator',
        fields: [
          ['Tip', fmtNum(+tip.toFixed(2))],
          ['Total', fmtNum(+(a.bill + tip).toFixed(2))],
          ['Per person', fmtNum(+((a.bill + tip) / p).toFixed(2))],
        ],
        color: C.info,
      });
    },
  },
  {
    name: 'discount',
    description: 'See what something costs after the discount',
    options: [N('price', 'The original price'), N('percent', 'Discount in %')],
    async run(ctx, a) {
      const off = (a.price * a.percent) / 100;
      return card({
        title: '🏷️ Discount',
        fields: [
          ['You save', fmtNum(+off.toFixed(2))],
          ['Final price', fmtNum(+(a.price - off).toFixed(2))],
        ],
        color: C.info,
      });
    },
  },
  {
    name: 'bmi',
    description: 'Body Mass Index from weight (kg) and height (cm)',
    options: [N('weight', 'Your weight in kg'), N('height', 'Your height in cm')],
    async run(ctx, a) {
      assert(a.height > 0 && a.weight > 0, 'Weight and height both need to be above zero.');
      const b = a.weight / (a.height / 100) ** 2;
      const cat = b < 18.5 ? 'Underweight' : b < 25 ? 'Normal' : b < 30 ? 'Overweight' : 'Obese';
      return card({
        title: 'BMI',
        fields: [
          ['BMI', b.toFixed(1)],
          ['Category', cat],
        ],
        footer: "BMI is a rough yardstick, not a diagnosis. Don't sweat it.",
        color: C.info,
      });
    },
  },
  {
    name: 'average3',
    description: 'What you need on the final to hit your target grade',
    aliases: ['gradeneeded'],
    options: [
      N('current', 'Your current grade in %'),
      N('target', 'The grade you want in %'),
      N('weight', 'How much the final counts, in %'),
    ],
    async run(ctx, a) {
      assert(a.weight > 0 && a.weight <= 100, 'The final needs to be worth between 1 and 100%.');
      const need = (a.target - a.current * (1 - a.weight / 100)) / (a.weight / 100);
      return res(
        'Score needed on the final',
        `${need.toFixed(1)}%`,
        need > 100
          ? 'Not happening without extra credit 😬'
          : need <= 0
            ? "You've already got it in the bag 🎉"
            : null,
      );
    },
  },
];
