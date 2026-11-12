const { card, C } = require('../lib/ui');
const { assert, fmtNum, fetchJson, ts } = require('../lib/util');

// Each factor is how many of the group's base unit one of that unit equals.
const UNITS = {
  length: {
    base: 'm',
    u: {
      mm: 0.001,
      cm: 0.01,
      m: 1,
      km: 1000,
      in: 0.0254,
      ft: 0.3048,
      yd: 0.9144,
      mi: 1609.344,
      nmi: 1852,
      ly: 9.4607e15,
    },
  },
  mass: {
    base: 'kg',
    u: { mg: 1e-6, g: 0.001, kg: 1, t: 1000, oz: 0.028349523125, lb: 0.45359237, st: 6.35029318 },
  },
  volume: {
    base: 'l',
    u: {
      ml: 0.001,
      l: 1,
      m3: 1000,
      tsp: 0.00492892,
      tbsp: 0.0147868,
      floz: 0.0295735,
      cup: 0.236588,
      pt: 0.473176,
      qt: 0.946353,
      gal: 3.78541,
    },
  },
  speed: { base: 'm/s', u: { 'm/s': 1, kmh: 1 / 3.6, mph: 0.44704, knot: 0.514444, fts: 0.3048, mach: 343 } },
  time: {
    base: 's',
    u: { ms: 0.001, s: 1, min: 60, h: 3600, day: 86400, week: 604800, month: 2629746, year: 31556952 },
  },
  data: {
    base: 'B',
    u: {
      bit: 0.125,
      B: 1,
      KB: 1e3,
      MB: 1e6,
      GB: 1e9,
      TB: 1e12,
      KiB: 1024,
      MiB: 1048576,
      GiB: 1073741824,
      TiB: 1099511627776,
    },
  },
  area: {
    base: 'm2',
    u: {
      cm2: 1e-4,
      m2: 1,
      km2: 1e6,
      ft2: 0.092903,
      yd2: 0.836127,
      acre: 4046.86,
      ha: 10000,
      mi2: 2589988.11,
    },
  },
  energy: {
    base: 'J',
    u: { J: 1, kJ: 1000, cal: 4.184, kcal: 4184, Wh: 3600, kWh: 3.6e6, eV: 1.602176634e-19, BTU: 1055.06 },
  },
  pressure: { base: 'Pa', u: { Pa: 1, kPa: 1000, bar: 1e5, psi: 6894.76, atm: 101325, mmHg: 133.322 } },
  power: { base: 'W', u: { W: 1, kW: 1000, MW: 1e6, hp: 745.7 } },
  angle: { base: 'deg', u: { deg: 1, rad: 180 / Math.PI, grad: 0.9, turn: 360 } },
};
const ALIAS = {
  meter: 'm',
  meters: 'm',
  metre: 'm',
  kilometer: 'km',
  kilometers: 'km',
  mile: 'mi',
  miles: 'mi',
  foot: 'ft',
  feet: 'ft',
  inch: 'in',
  inches: 'in',
  yard: 'yd',
  yards: 'yd',
  centimeter: 'cm',
  millimeter: 'mm',
  gram: 'g',
  grams: 'g',
  kilogram: 'kg',
  kgs: 'kg',
  pound: 'lb',
  pounds: 'lb',
  lbs: 'lb',
  ounce: 'oz',
  ounces: 'oz',
  stone: 'st',
  ton: 't',
  tonne: 't',
  liter: 'l',
  litre: 'l',
  liters: 'l',
  gallon: 'gal',
  gallons: 'gal',
  kph: 'kmh',
  'km/h': 'kmh',
  knots: 'knot',
  sec: 's',
  second: 's',
  seconds: 's',
  minute: 'min',
  minutes: 'min',
  hour: 'h',
  hours: 'h',
  hr: 'h',
  days: 'day',
  d: 'day',
  weeks: 'week',
  months: 'month',
  years: 'year',
  yr: 'year',
  byte: 'B',
  bytes: 'B',
  kb: 'KB',
  mb: 'MB',
  gb: 'GB',
  tb: 'TB',
  kib: 'KiB',
  mib: 'MiB',
  gib: 'GiB',
  tib: 'TiB',
  j: 'J',
  kj: 'kJ',
  wh: 'Wh',
  kwh: 'kWh',
  btu: 'BTU',
  pa: 'Pa',
  kpa: 'kPa',
  mmhg: 'mmHg',
  w: 'W',
  kw: 'kW',
  mw: 'MW',
  degrees: 'deg',
  radians: 'rad',
  hectare: 'ha',
  acres: 'acre',
};
// Temperature isn't a simple factor (offsets), so it gets its own path via Celsius.
const TEMP = { c: 'c', celsius: 'c', f: 'f', fahrenheit: 'f', k: 'k', kelvin: 'k' };
function toC(v, u) {
  return u === 'c' ? v : u === 'f' ? ((v - 32) * 5) / 9 : v - 273.15;
}
function fromC(v, u) {
  return u === 'c' ? v : u === 'f' ? (v * 9) / 5 + 32 : v + 273.15;
}
function find(unit) {
  const k = ALIAS[unit.toLowerCase()] || unit;
  for (const [g, def] of Object.entries(UNITS)) {
    const hit = Object.keys(def.u).find((x) => x === k || x.toLowerCase() === k.toLowerCase());
    if (hit) return { group: g, unit: hit, f: def.u[hit] };
  }
  return null;
}
function convertValue(v, from, to) {
  const tf = TEMP[from.toLowerCase()];
  const tt = TEMP[to.toLowerCase()];
  if (tf && tt) {
    const k = fromC(toC(v, tf), tt);
    assert(tt !== 'k' || k >= 0, 'Nothing gets colder than absolute zero, and that result would.');
    return {
      value: k,
      from: tf.toUpperCase() === 'K' ? 'K' : `°${tf.toUpperCase()}`,
      to: tt === 'k' ? 'K' : `°${tt.toUpperCase()}`,
    };
  }
  const a = find(from);
  const b = find(to);
  assert(
    a && b,
    `Never heard of one of those units. Try \`convert 10 km mi\`. I speak: ${Object.keys(UNITS).join(', ')}, temperature.`,
  );
  assert(a.group === b.group, `Can't turn ${a.group} into ${b.group}. Apples and oranges.`);
  return { value: (v * a.f) / b.f, from: a.unit, to: b.unit };
}
const out = (v, r) =>
  card({
    title: '🔁 Conversion',
    description: `**${fmtNum(v)} ${r.from}** = **${fmtNum(+r.value.toPrecision(10))} ${r.to}**`,
    color: C.info,
  });

const PAIRS = [
  ['c2f', 'c', 'f', 'Celsius → Fahrenheit'],
  ['f2c', 'f', 'c', 'Fahrenheit → Celsius'],
  ['c2k', 'c', 'k', 'Celsius → Kelvin'],
  ['k2c', 'k', 'c', 'Kelvin → Celsius'],
  ['f2k', 'f', 'k', 'Fahrenheit → Kelvin'],
  ['k2f', 'k', 'f', 'Kelvin → Fahrenheit'],
  ['km2mi', 'km', 'mi', 'Kilometres → miles'],
  ['mi2km', 'mi', 'km', 'Miles → kilometres'],
  ['m2ft', 'm', 'ft', 'Metres → feet'],
  ['ft2m', 'ft', 'm', 'Feet → metres'],
  ['cm2in', 'cm', 'in', 'Centimetres → inches'],
  ['in2cm', 'in', 'cm', 'Inches → centimetres'],
  ['m2yd', 'm', 'yd', 'Metres → yards'],
  ['yd2m', 'yd', 'm', 'Yards → metres'],
  ['mm2in', 'mm', 'in', 'Millimetres → inches'],
  ['nmi2km', 'nmi', 'km', 'Nautical miles → kilometres'],
  ['kg2lb', 'kg', 'lb', 'Kilograms → pounds'],
  ['lb2kg', 'lb', 'kg', 'Pounds → kilograms'],
  ['g2oz', 'g', 'oz', 'Grams → ounces'],
  ['oz2g', 'oz', 'g', 'Ounces → grams'],
  ['kg2st', 'kg', 'st', 'Kilograms → stone'],
  ['st2kg', 'st', 'kg', 'Stone → kilograms'],
  ['l2gal', 'l', 'gal', 'Litres → US gallons'],
  ['gal2l', 'gal', 'l', 'US gallons → litres'],
  ['ml2floz', 'ml', 'floz', 'Millilitres → US fl oz'],
  ['floz2ml', 'floz', 'ml', 'US fl oz → millilitres'],
  ['cup2ml', 'cup', 'ml', 'US cups → millilitres'],
  ['ml2cup', 'ml', 'cup', 'Millilitres → US cups'],
  ['tbsp2ml', 'tbsp', 'ml', 'Tablespoons → millilitres'],
  ['tsp2ml', 'tsp', 'ml', 'Teaspoons → millilitres'],
  ['kmh2mph', 'kmh', 'mph', 'km/h → mph'],
  ['mph2kmh', 'mph', 'kmh', 'mph → km/h'],
  ['ms2kmh', 'm/s', 'kmh', 'm/s → km/h'],
  ['knot2kmh', 'knot', 'kmh', 'Knots → km/h'],
  ['gb2mb', 'GB', 'MB', 'Gigabytes → megabytes'],
  ['mb2gb', 'MB', 'GB', 'Megabytes → gigabytes'],
  ['tb2gb', 'TB', 'GB', 'Terabytes → gigabytes'],
  ['gib2gb', 'GiB', 'GB', 'Gibibytes → gigabytes'],
  ['mb2bit', 'MB', 'bit', 'Megabytes → bits'],
  ['acre2m2', 'acre', 'm2', 'Acres → square metres'],
  ['ha2acre', 'ha', 'acre', 'Hectares → acres'],
  ['ft22m2', 'ft2', 'm2', 'Square feet → square metres'],
  ['m22ft2', 'm2', 'ft2', 'Square metres → square feet'],
  ['kcal2kj', 'kcal', 'kJ', 'Kilocalories → kilojoules'],
  ['kj2kcal', 'kJ', 'kcal', 'Kilojoules → kilocalories'],
  ['kwh2j', 'kWh', 'J', 'Kilowatt-hours → joules'],
  ['psi2bar', 'psi', 'bar', 'PSI → bar'],
  ['bar2psi', 'bar', 'psi', 'Bar → PSI'],
  ['atm2kpa', 'atm', 'kPa', 'Atmospheres → kilopascals'],
  ['hp2kw', 'hp', 'kW', 'Horsepower → kilowatts'],
  ['kw2hp', 'kW', 'hp', 'Kilowatts → horsepower'],
  ['h2min', 'h', 'min', 'Hours → minutes'],
  ['day2h', 'day', 'h', 'Days → hours'],
  ['year2day', 'year', 'day', 'Years → days'],
  ['min2s', 'min', 's', 'Minutes → seconds'],
];
const pairCmds = PAIRS.map(([name, from, to, description]) => ({
  name,
  description,
  options: [{ name: 'value', type: 'number', required: true, description: `How many ${from}?` }],
  async run(ctx, a) {
    return out(a.value, convertValue(a.value, from, to));
  },
}));

// The API only refreshes about once a day, so an hour of caching is plenty.
let fx = { at: 0, rates: null };
async function rates() {
  if (!fx.rates || Date.now() - fx.at > 3600000) {
    const d = await fetchJson('https://open.er-api.com/v6/latest/USD');
    assert(d.result === 'success', 'The exchange-rate service is taking a nap. Try again in a bit.');
    fx = { at: Date.now(), rates: d.rates, updated: d.time_last_update_utc };
  }
  return fx;
}
// Intl throws on bad zone names, which makes it a handy validator.
function zone(tz) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}
const CITY_TZ = {
  london: 'Europe/London',
  paris: 'Europe/Paris',
  berlin: 'Europe/Berlin',
  tokyo: 'Asia/Tokyo',
  delhi: 'Asia/Kolkata',
  mumbai: 'Asia/Kolkata',
  india: 'Asia/Kolkata',
  ist: 'Asia/Kolkata',
  newyork: 'America/New_York',
  nyc: 'America/New_York',
  est: 'America/New_York',
  la: 'America/Los_Angeles',
  pst: 'America/Los_Angeles',
  losangeles: 'America/Los_Angeles',
  chicago: 'America/Chicago',
  sydney: 'Australia/Sydney',
  dubai: 'Asia/Dubai',
  singapore: 'Asia/Singapore',
  moscow: 'Europe/Moscow',
  beijing: 'Asia/Shanghai',
  china: 'Asia/Shanghai',
  seoul: 'Asia/Seoul',
  toronto: 'America/Toronto',
  saopaulo: 'America/Sao_Paulo',
  utc: 'UTC',
  gmt: 'UTC',
};
const resolveTz = (s) =>
  zone(CITY_TZ[s.toLowerCase().replace(/[\s_-]/g, '')] || s) || zone(s.replace(/\s/g, '_'));
// Date-only strings are pinned to UTC so results don't shift with the host's timezone.
const parseDate = (s) => {
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T00:00:00Z' : s);
  assert(!Number.isNaN(d.getTime()), "I can't make sense of that date. Try something like `2026-12-25`.");
  return d;
};

module.exports = [
  {
    name: 'convert',
    description: 'Convert between units, e.g. convert 10 km mi (length, mass, temp, data…)',
    aliases: ['conv', 'unit'],
    options: [
      { name: 'value', type: 'number', required: true, description: 'How much?' },
      { name: 'from', type: 'string', required: true, description: 'The unit you have', rest: false },
      { name: 'to', type: 'string', required: true, description: 'The unit you want', rest: false },
    ],
    async run(ctx, a) {
      return out(a.value, convertValue(a.value, a.from, a.to));
    },
  },
  {
    name: 'units',
    description: 'Everything the converter knows how to convert',
    async run() {
      return card({
        title: 'Units I know',
        description: [
          ...Object.entries(UNITS).map(([g, d]) => `**${g}:** ${Object.keys(d.u).join(', ')}`),
          '**temperature:** c, f, k',
        ].join('\n'),
        color: C.info,
      });
    },
  },
  ...pairCmds,
  {
    name: 'currency',
    description: 'Convert money using live rates, e.g. currency 100 USD EUR',
    aliases: ['fx', 'exchange'],
    defer: true,
    options: [
      { name: 'amount', type: 'number', required: true, description: 'How much money?' },
      {
        name: 'from',
        type: 'string',
        required: true,
        description: 'Currency you have (e.g. USD)',
        rest: false,
      },
      {
        name: 'to',
        type: 'string',
        required: true,
        description: 'Currency you want (e.g. INR)',
        rest: false,
      },
    ],
    async run(ctx, a) {
      const r = await rates();
      const f = a.from.toUpperCase();
      const t = a.to.toUpperCase();
      assert(
        r.rates[f] && r.rates[t],
        "Don't recognise that currency. Stick to ISO codes like USD, EUR, INR, GBP or JPY.",
      );
      const v = (a.amount / r.rates[f]) * r.rates[t];
      return card({
        title: '💱 Currency',
        description: `**${fmtNum(a.amount)} ${f}** = **${fmtNum(+v.toFixed(4))} ${t}**\n1 ${f} = ${fmtNum(+(r.rates[t] / r.rates[f]).toFixed(6))} ${t}`,
        footer: `Rates via open.er-api.com · ${r.updated || ''}`,
        color: C.eco,
      });
    },
  },
  {
    name: 'time',
    description: 'What time is it in a timezone or city? e.g. time Asia/Tokyo, time london',
    aliases: ['clock', 'timein'],
    options: [{ name: 'zone', type: 'string', description: 'IANA zone or a city name (defaults to UTC)' }],
    async run(ctx, a) {
      const tz = resolveTz(a.zone || 'UTC');
      assert(
        tz,
        "Couldn't find that timezone. Try an IANA name like `Europe/London` or a city like `tokyo`.",
      );
      const now = new Date();
      const f = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        dateStyle: 'full',
        timeStyle: 'long',
      }).format(now);
      return card({
        title: `🕒 ${tz}`,
        description: `**${f}**\nOn your clock: ${ts(now, 'F')}`,
        color: C.info,
      });
    },
  },
  {
    name: 'timeconvert',
    description: 'Convert a time between zones, e.g. timeconvert 18:30 ist pst',
    aliases: ['tzconvert'],
    options: [
      { name: 'time', type: 'string', required: true, description: 'HH:MM (24h)', rest: false },
      { name: 'from', type: 'string', required: true, description: 'Starting zone or city', rest: false },
      { name: 'to', type: 'string', required: true, description: 'Target zone or city', rest: false },
    ],
    async run(ctx, a) {
      const m = a.time.match(/^(\d{1,2}):(\d{2})$/);
      assert(m, 'I need 24h time, like `18:30`.');
      const f = resolveTz(a.from);
      const t = resolveTz(a.to);
      assert(f && t, "One of those timezones didn't check out.");
      const now = new Date();
      // Current UTC offset in minutes (DST-aware), recovered by re-reading the wall clock in that zone.
      const offset = (tz) => {
        const p = Object.fromEntries(
          new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            hourCycle: 'h23',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })
            .formatToParts(now)
            .map((x) => [x.type, x.value]),
        );
        return (
          (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(now / 60000) * 60000) / 60000
        );
      };
      let mins = Number(m[1]) * 60 + Number(m[2]) - offset(f) + offset(t);
      const dayShift = Math.floor(mins / 1440);
      mins = ((mins % 1440) + 1440) % 1440;
      const hh = String(Math.floor(mins / 60)).padStart(2, '0');
      const mm = String(mins % 60).padStart(2, '0');
      return card({
        title: '🌐 Time zone conversion',
        description: `**${a.time}** in ${f} = **${hh}:${mm}** in ${t}${dayShift ? ` (${dayShift > 0 ? 'next' : 'previous'} day)` : ''}`,
        color: C.info,
      });
    },
  },
  {
    name: 'unixtime',
    description: 'The current Unix timestamp, fresh off the clock',
    aliases: ['epoch', 'now'],
    async run() {
      const n = Math.floor(Date.now() / 1000);
      return card({ description: `Unix time right now: **${n}**\n${ts(n * 1000, 'F')}`, color: C.info });
    },
  },
  {
    name: 'fromunix',
    description: 'Turn a Unix timestamp into a human-readable date',
    options: [
      { name: 'seconds', type: 'integer', required: true, description: 'Unix timestamp, in seconds or ms' },
    ],
    async run(ctx, a) {
      // Anything this big is almost certainly milliseconds already.
      const ms = a.seconds > 1e11 ? a.seconds : a.seconds * 1000;
      return card({
        description: `${ts(ms, 'F')} (${ts(ms, 'R')})\nISO: \`${new Date(ms).toISOString()}\``,
        color: C.info,
      });
    },
  },
  {
    name: 'age',
    description: 'Work out exact age from a birthday (YYYY-MM-DD)',
    options: [{ name: 'birthdate', type: 'string', required: true, description: 'Birthday as YYYY-MM-DD' }],
    async run(ctx, a) {
      const b = parseDate(a.birthdate);
      const n = new Date();
      assert(b < n, "That date hasn't happened yet. Nice try, time traveller.");
      let y = n.getUTCFullYear() - b.getUTCFullYear();
      let m = n.getUTCMonth() - b.getUTCMonth();
      let d = n.getUTCDate() - b.getUTCDate();
      if (d < 0) {
        m--;
        d += new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 0)).getUTCDate();
      }
      if (m < 0) {
        y--;
        m += 12;
      }
      const next = new Date(Date.UTC(n.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()));
      if (next < n) next.setUTCFullYear(next.getUTCFullYear() + 1);
      return card({
        title: '🎂 Age',
        fields: [
          ['Age', `${y} years, ${m} months, ${d} days`],
          ['Total days', fmtNum(Math.floor((n - b) / 86400000))],
          ['Next birthday', ts(next, 'R')],
        ],
        color: C.info,
      });
    },
  },
  {
    name: 'daysuntil',
    description: 'Count the days until a date',
    aliases: ['countdown'],
    options: [{ name: 'date', type: 'string', required: true, description: 'The big day, as YYYY-MM-DD' }],
    async run(ctx, a) {
      const d = parseDate(a.date);
      const days = Math.ceil((d - Date.now()) / 86400000);
      return card({
        description:
          days >= 0
            ? `📅 **${fmtNum(days)}** day(s) to go until ${ts(d, 'D')} (${ts(d, 'R')})`
            : `That one's already behind us, by ${fmtNum(-days)} day(s).`,
        color: C.info,
      });
    },
  },
  {
    name: 'dayssince',
    description: 'Count the days since a date',
    options: [{ name: 'date', type: 'string', required: true, description: 'Date as YYYY-MM-DD' }],
    async run(ctx, a) {
      const d = parseDate(a.date);
      const days = Math.floor((Date.now() - d) / 86400000);
      return card({ description: `📅 **${fmtNum(days)}** day(s) since ${ts(d, 'D')}`, color: C.info });
    },
  },
  {
    name: 'weekday',
    description: 'Find out which day of the week a date lands on',
    options: [{ name: 'date', type: 'string', required: true, description: 'Date as YYYY-MM-DD' }],
    async run(ctx, a) {
      const d = parseDate(a.date);
      return card({
        description: `**${a.date}** falls on a **${d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })}**.`,
        color: C.info,
      });
    },
  },
  {
    name: 'leapyear',
    description: 'Is it a leap year? Find out',
    options: [
      { name: 'year', type: 'integer', required: true, min: 1, max: 99999, description: 'Which year?' },
    ],
    async run(ctx, a) {
      const y = a.year;
      const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
      return card({ description: `${y} is ${leap ? '' : 'not '}a leap year.`, color: C.info });
    },
  },
  {
    name: 'datediff',
    description: 'How far apart two dates are',
    options: [
      { name: 'start', type: 'string', required: true, description: 'First date (YYYY-MM-DD)', rest: false },
      { name: 'end', type: 'string', required: true, description: 'Second date (YYYY-MM-DD)', rest: false },
    ],
    async run(ctx, a) {
      const s = parseDate(a.start);
      const e = parseDate(a.end);
      const d = Math.abs(e - s) / 86400000;
      return card({
        title: 'Date difference',
        fields: [
          ['Days', fmtNum(Math.round(d))],
          ['Weeks', fmtNum(+(d / 7).toFixed(2))],
          ['Months (approx)', fmtNum(+(d / 30.4375).toFixed(2))],
          ['Years (approx)', fmtNum(+(d / 365.2425).toFixed(3))],
        ],
        color: C.info,
      });
    },
  },
  {
    name: 'adddays',
    description: 'Shift a date forward or back by a number of days',
    options: [
      { name: 'date', type: 'string', required: true, description: 'YYYY-MM-DD or "today"', rest: false },
      {
        name: 'days',
        type: 'integer',
        required: true,
        description: 'How many days to add (negative to go back)',
      },
    ],
    async run(ctx, a) {
      const d = a.date.toLowerCase() === 'today' ? new Date() : parseDate(a.date);
      const r = new Date(d.getTime() + a.days * 86400000);
      return card({
        description: `${a.date} ${a.days >= 0 ? '+' : '−'} ${Math.abs(a.days)} days = **${r.toISOString().slice(0, 10)}** (${r.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })})`,
        color: C.info,
      });
    },
  },
];
