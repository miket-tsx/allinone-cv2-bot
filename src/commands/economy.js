// Per-server economy: wallet/bank, jobs, gambling, shop & items.
const {
  PermissionFlagsBits: P,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require('discord.js');
const db = require('../lib/db');
const { card, ok, C } = require('../lib/ui');
const { assert, pick, randInt, fmtDur, fmtNum, shuffle } = require('../lib/util');

const CUR = '🪙';
const money = (n) => `${CUR} **${fmtNum(Math.floor(n))}**`;
const me = (ctx) => db.member(ctx.guild.id, ctx.user.id);
const eco = { guildOnly: true };

const ITEMS = {
  fishingrod: {
    name: '🎣 Fishing Rod',
    price: 2500,
    desc: 'Needed for `fish`. The fish won’t catch themselves.',
  },
  bow: { name: '🏹 Hunting Bow', price: 3000, desc: 'Needed for `hunt`.' },
  pickaxe: { name: '⛏️ Pickaxe', price: 3500, desc: 'Needed for `mine`.' },
  axe: { name: '🪓 Axe', price: 2000, desc: 'Needed for `chop`.' },
  shovel: { name: '🪏 Shovel', price: 1500, desc: 'Needed for `dig`.' },
  laptop: { name: '💻 Laptop', price: 5000, desc: 'Needed for `postmeme`.' },
  padlock: { name: '🔒 Padlock', price: 4000, desc: 'Stops one robbery attempt, then it’s gone.' },
  luckycharm: { name: '🍀 Lucky Charm', price: 7500, desc: 'Nudges your odds by +5% on gambling commands.' },
  trophy: { name: '🏆 Trophy', price: 100000, desc: 'Pure flex. Still counts toward net worth.' },
  diamond: { name: '💎 Diamond', price: 25000, desc: 'Shiny collectible. Sells back for 70%.' },
};
const LOOT = {
  fish: {
    tool: 'fishingrod',
    items: [
      ['🐟 a common fish', 150, 450],
      ['🐠 a tropical fish', 400, 900],
      ['🦈 a small shark', 1200, 2500],
      ['👢 an old boot', 1, 20],
    ],
    cd: 45,
  },
  hunt: {
    tool: 'bow',
    items: [
      ['🐇 a rabbit', 200, 500],
      ['🦌 a deer', 700, 1500],
      ['🐗 a boar', 900, 1800],
      ['🍂 nothing but leaves', 0, 0],
    ],
    cd: 45,
  },
  mine: {
    tool: 'pickaxe',
    items: [
      ['🪨 some stone', 100, 300],
      ['⚙️ iron ore', 400, 900],
      ['🥇 gold ore', 1000, 2200],
      ['💎 a raw gem', 2500, 4500],
    ],
    cd: 60,
  },
  chop: {
    tool: 'axe',
    items: [
      ['🪵 a few logs', 150, 400],
      ['🌳 a whole oak', 400, 900],
      ['🍎 an apple tree', 300, 700],
    ],
    cd: 40,
  },
  dig: {
    tool: 'shovel',
    items: [
      ['🪱 some worms', 20, 80],
      ['🏺 an old vase', 500, 1200],
      ['💰 a buried chest', 1500, 3500],
      ['🦴 a fossil', 800, 1600],
    ],
    cd: 50,
  },
};
const luck = (m) => (m.inv.luckycharm ? 0.05 : 0);

function cooldown(m, key, secs) {
  const left = (m.cd[key] || 0) - Date.now();
  assert(left <= 0, `⏳ Easy there. Try that again in **${fmtDur(left)}**.`);
  m.cd[key] = Date.now() + secs * 1000;
}
function amountArg(str, max) {
  const s = String(str).toLowerCase().replace(/,/g, '');
  if (s === 'all' || s === 'max') return Math.floor(max);
  if (s === 'half') return Math.floor(max / 2);
  const k = s.match(/^(\d+(?:\.\d+)?)(k|m)?$/);
  assert(k, 'I need an amount like `500`, `2k`, `half` or `all`.');
  return Math.floor(Number(k[1]) * (k[2] === 'k' ? 1e3 : k[2] === 'm' ? 1e6 : 1));
}
const amountOpt = (d = 'How much: a number, 2k, half, or all') => ({
  name: 'amount',
  type: 'string',
  required: true,
  description: d,
  rest: false,
});
function bet(ctx, a) {
  const m = me(ctx);
  const amt = amountArg(a.amount, m.wallet);
  assert(amt >= 10, 'The minimum bet is 10. Even gamblers have standards.');
  assert(amt <= m.wallet, `You've only got ${money(m.wallet)} in your wallet. Nice try, though.`);
  assert(amt <= 500000, 'Whoa, high roller. The max bet is 500,000.');
  return { m, amt };
}
const finish = (m, win, amt, mult = 1) => {
  m.wallet += win ? Math.floor(amt * mult) : -amt;
  db.save();
};

const job = (name, description, secs, min, max, lines, aliases = []) => ({
  name,
  description,
  aliases,
  ...eco,
  async run(ctx) {
    const m = me(ctx);
    cooldown(m, name, secs);
    const v = randInt(min, max);
    m.wallet += v;
    db.save();
    return card({
      description: pick(lines).replace('{n}', money(v)),
      color: C.eco,
      footer: `Wallet now: ${fmtNum(m.wallet)}`,
    });
  },
});
const gather = (name, description) => ({
  name,
  description,
  ...eco,
  async run(ctx) {
    const L = LOOT[name];
    const m = me(ctx);
    assert(
      m.inv[L.tool],
      `You'll need a **${ITEMS[L.tool].name}** for that. Grab one with \`buy ${L.tool}\`.`,
    );
    cooldown(m, name, L.cd);
    const [what, lo, hi] = pick(L.items);
    const v = randInt(lo, hi);
    m.wallet += v;
    let broke = '';
    if (Math.random() < 0.04) {
      m.inv[L.tool]--;
      if (!m.inv[L.tool]) delete m.inv[L.tool];
      broke = `\n💥 Your ${ITEMS[L.tool].name} snapped in half. Rest in pieces.`;
    }
    db.save();
    return card({ description: `You came up with ${what} worth ${money(v)}.${broke}`, color: C.eco });
  },
});
const claim = (name, description, secs, amount) => ({
  name,
  description,
  ...eco,
  async run(ctx) {
    const m = me(ctx);
    cooldown(m, name, secs);
    let bonus = 0;
    if (name === 'daily') {
      // 48h window so claiming a little late doesn't nuke the streak
      m.streak = m.lastDaily && Date.now() - m.lastDaily < 48 * 3600000 ? (m.streak || 0) + 1 : 1;
      m.lastDaily = Date.now();
      bonus = Math.min(m.streak, 30) * 50;
    }
    m.wallet += amount + bonus;
    db.save();
    return card({
      title: `${description}`,
      description: `Fresh off the press: ${money(amount + bonus)}${bonus ? ` (that includes a ${fmtNum(bonus)} streak bonus, 🔥 ${m.streak} days running)` : ''}!`,
      color: C.eco,
    });
  },
});

const deck = () =>
  shuffle(
    ['♠', '♥', '♦', '♣'].flatMap((s) =>
      ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'].map((r) => r + s),
    ),
  );
const score = (h) => {
  let t = 0;
  let aces = 0;
  for (const c of h) {
    const r = c.slice(0, -1);
    if (r === 'A') {
      aces++;
      t += 11;
    } else t += ['J', 'Q', 'K'].includes(r) ? 10 : Number(r);
  }
  while (t > 21 && aces--) t -= 10;
  return t;
};

module.exports = [
  {
    name: 'balance',
    description: 'Peek at your wallet and bank (or snoop on someone else’s)',
    ...eco,
    aliases: ['bal', 'money', 'wallet'],
    options: [{ name: 'user', type: 'user', description: 'Whose balance to peek at' }],
    async run(ctx, a) {
      const u = a.user || ctx.user;
      const m = db.member(ctx.guild.id, u.id);
      return card({
        title: `${u.username}'s balance`,
        thumbnail: u.displayAvatarURL(),
        fields: [
          ['Wallet', money(m.wallet)],
          ['Bank', money(m.bank)],
          ['Total', money(m.wallet + m.bank)],
        ],
        color: C.eco,
      });
    },
  },
  claim('daily', '📅 Daily paycheck', 86400, 1000),
  claim('weekly', '🗓️ Weekly bonus', 7 * 86400, 7500),
  claim('monthly', '📆 Monthly windfall', 30 * 86400, 30000),
  job('work', 'Clock in for a shift and earn some coins', 3600, 300, 900, [
    'You pulled espresso shots all day as a barista and pocketed {n}.',
    'You squashed bugs for a startup that pays in coins. Total: {n}.',
    'You delivered pizzas without eating a single slice and made {n}.',
    'You moderated a Discord server and somehow survived. Payout: {n}.',
    'You walked a pack of very pulling dogs and earned {n}.',
    'You designed a logo (the client wanted it bigger) and got {n}.',
  ]),
  job('beg', 'Hold out a cup and beg strangers for coins', 60, 10, 150, [
    'A kind stranger dropped {n} in your cup.',
    'Someone tossed you {n} without making eye contact.',
    'A passing bot felt generous and donated {n}.',
    'You found {n} wedged under a couch cushion. Lucky!',
  ]),
  job('search', 'Dig through random places for loose change', 120, 50, 350, [
    'You went through the car seats and turned up {n}.',
    'Old jacket, forgotten pocket: {n}. Nice.',
    'You poked around behind the server rack and found {n}.',
  ]),
  {
    name: 'crime',
    description: 'Commit a totally fictional crime. Risky, obviously',
    ...eco,
    async run(ctx) {
      const m = me(ctx);
      cooldown(m, 'crime', 1800);
      if (Math.random() < 0.55) {
        const v = randInt(600, 2000);
        m.wallet += v;
        db.save();
        return card({
          description: `🦹 ${pick(['You hacked a vending machine', 'You pickpocketed a pickpocket', 'You sold fake NFTs'])} and walked away with ${money(v)}.`,
          color: C.eco,
        });
      }
      const fine = Math.min(m.wallet, randInt(300, 1200));
      m.wallet -= fine;
      db.save();
      return card({ description: `🚓 Busted! The fine came to ${money(fine)}.`, color: C.error });
    },
  },
  {
    name: 'rob',
    description: 'Try to lift some coins from someone’s wallet',
    ...eco,
    options: [{ name: 'user', type: 'user', required: true, description: 'Your unlucky victim' }],
    async run(ctx, a) {
      assert(a.user.id !== ctx.user.id && !a.user.bot, 'Pick a real target. No robbing yourself or bots.');
      const m = me(ctx);
      const t = db.member(ctx.guild.id, a.user.id);
      assert(m.wallet >= 500, 'You need at least 500 in your wallet to rob. Think of it as bail money.');
      assert(t.wallet >= 500, 'They’ve got less than 500. Not worth the risk.');
      cooldown(m, 'rob', 3600);
      if (t.inv.padlock) {
        t.inv.padlock--;
        if (!t.inv.padlock) delete t.inv.padlock;
        const f = Math.floor(m.wallet * 0.1);
        m.wallet -= f;
        db.save();
        return card({
          description: `🔒 ${a.user.username} had a padlock! Ouch, that attempt cost you ${money(f)}.`,
          color: C.error,
        });
      }
      if (Math.random() < 0.45) {
        const v = Math.floor(t.wallet * (randInt(10, 40) / 100));
        t.wallet -= v;
        m.wallet += v;
        db.save();
        return card({
          description: `💰 Smooth work. You robbed ${a.user} and ran off with ${money(v)}!`,
          color: C.eco,
        });
      }
      const f = Math.floor(m.wallet * 0.2);
      m.wallet -= f;
      t.wallet += f;
      db.save();
      return card({
        description: `🚨 Caught red-handed! You paid ${a.user} ${money(f)} in damages.`,
        color: C.error,
      });
    },
  },
  {
    name: 'deposit',
    description: 'Stash coins in the bank where robbers can’t reach them',
    ...eco,
    aliases: ['dep'],
    options: [amountOpt()],
    async run(ctx, a) {
      const m = me(ctx);
      const v = amountArg(a.amount, m.wallet);
      assert(v > 0 && v <= m.wallet, `You only have ${money(m.wallet)} in your wallet.`);
      m.wallet -= v;
      m.bank += v;
      db.save();
      return ok(`Tucked ${money(v)} away. Your bank now holds ${money(m.bank)}.`);
    },
  },
  {
    name: 'withdraw',
    description: 'Pull coins out of the bank and into your wallet',
    ...eco,
    aliases: ['with'],
    options: [amountOpt()],
    async run(ctx, a) {
      const m = me(ctx);
      const v = amountArg(a.amount, m.bank);
      assert(v > 0 && v <= m.bank, `You only have ${money(m.bank)} in the bank.`);
      m.bank -= v;
      m.wallet += v;
      db.save();
      return ok(`Withdrew ${money(v)}. Your wallet is now at ${money(m.wallet)}.`);
    },
  },
  {
    name: 'pay',
    description: 'Share the wealth with another member',
    ...eco,
    aliases: ['give', 'transfer'],
    options: [{ name: 'user', type: 'user', required: true, description: 'Who gets the coins' }, amountOpt()],
    async run(ctx, a) {
      assert(a.user.id !== ctx.user.id && !a.user.bot, 'Pick another human. Bots and yourself don’t count.');
      const m = me(ctx);
      const v = amountArg(a.amount, m.wallet);
      assert(v > 0 && v <= m.wallet, `You only have ${money(m.wallet)} in your wallet.`);
      m.wallet -= v;
      db.member(ctx.guild.id, a.user.id).wallet += v;
      db.save();
      return ok(`Sent ${money(v)} to ${a.user}. Generous!`);
    },
  },
  {
    name: 'richest',
    description: 'See who’s hoarding the most coins in this server',
    ...eco,
    aliases: ['baltop', 'ecolb'],
    async run(ctx) {
      const all = Object.entries(db.members(ctx.guild.id))
        .map(([id, m]) => [id, (m.wallet || 0) + (m.bank || 0)])
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      return card({
        title: `💰 Richest in ${ctx.guild.name}`,
        description: all.length
          ? all
              .map(([id, v], i) => `${['🥇', '🥈', '🥉'][i] || `**${i + 1}.**`} <@${id}> — ${money(v)}`)
              .join('\n')
          : 'Nobody’s got a coin to their name yet. Start with `daily`!',
        color: C.eco,
      });
    },
  },
  {
    name: 'shop',
    description: 'Browse the item shop (window shopping is free)',
    ...eco,
    aliases: ['store'],
    async run() {
      return card({
        title: '🛒 Shop',
        description: Object.entries(ITEMS)
          .map(([id, it]) => `${it.name} — ${money(it.price)}\n-# \`${id}\` · ${it.desc}`)
          .join('\n'),
        footer: 'Ready to splurge? buy <item> [amount]',
        color: C.eco,
      });
    },
  },
  {
    name: 'buy',
    description: 'Spend some coins on a shop item',
    ...eco,
    options: [
      {
        name: 'item',
        type: 'string',
        required: true,
        lower: true,
        description: 'Item id (check the shop)',
        rest: false,
        choices: Object.keys(ITEMS),
      },
      { name: 'amount', type: 'integer', min: 1, max: 100, description: 'How many (default 1)' },
    ],
    async run(ctx, a) {
      const it = ITEMS[a.item];
      const q = a.amount || 1;
      const m = me(ctx);
      const cost = it.price * q;
      assert(m.wallet >= cost, `That'll run you ${money(cost)}, and you're holding ${money(m.wallet)}.`);
      m.wallet -= cost;
      m.inv[a.item] = (m.inv[a.item] || 0) + q;
      db.save();
      return ok(`Bought **${q}× ${it.name}** for ${money(cost)}. Enjoy!`);
    },
  },
  {
    name: 'sell',
    description: 'Sell an item back for 70% of its price',
    ...eco,
    options: [
      {
        name: 'item',
        type: 'string',
        required: true,
        lower: true,
        description: 'Item id',
        rest: false,
        choices: Object.keys(ITEMS),
      },
      { name: 'amount', type: 'integer', min: 1, max: 100, description: 'How many (default 1)' },
    ],
    async run(ctx, a) {
      const m = me(ctx);
      const q = a.amount || 1;
      assert((m.inv[a.item] || 0) >= q, "You don't have that many to sell.");
      const v = Math.floor(ITEMS[a.item].price * 0.7 * q);
      m.inv[a.item] -= q;
      if (!m.inv[a.item]) delete m.inv[a.item];
      m.wallet += v;
      db.save();
      return ok(`Sold **${q}× ${ITEMS[a.item].name}** for ${money(v)}.`);
    },
  },
  {
    name: 'inventory',
    description: 'Rummage through your items (or someone else’s)',
    ...eco,
    aliases: ['inv', 'items'],
    options: [{ name: 'user', type: 'user', description: 'Whose bag to look in' }],
    async run(ctx, a) {
      const u = a.user || ctx.user;
      const inv = db.member(ctx.guild.id, u.id).inv;
      const e = Object.entries(inv).filter(([, q]) => q > 0);
      return card({
        title: `🎒 ${u.username}'s inventory`,
        description: e.length
          ? e.map(([id, q]) => `${ITEMS[id]?.name || id} × **${q}**`).join('\n')
          : 'Nothing but lint. Pay a visit to the `shop`.',
        color: C.eco,
      });
    },
  },
  {
    name: 'iteminfo',
    description: 'Get the full scoop on a shop item',
    ...eco,
    options: [
      {
        name: 'item',
        type: 'string',
        required: true,
        lower: true,
        description: 'Item id',
        choices: Object.keys(ITEMS),
      },
    ],
    async run(ctx, a) {
      const it = ITEMS[a.item];
      return card({
        title: it.name,
        description: it.desc,
        fields: [
          ['Price', money(it.price)],
          ['Sells for', money(it.price * 0.7)],
          ['ID', `\`${a.item}\``],
        ],
        color: C.eco,
      });
    },
  },
  {
    name: 'giveitem',
    description: 'Hand an item over to another member',
    ...eco,
    options: [
      { name: 'user', type: 'user', required: true, description: 'Who gets it' },
      {
        name: 'item',
        type: 'string',
        required: true,
        lower: true,
        description: 'Item id',
        rest: false,
        choices: Object.keys(ITEMS),
      },
      { name: 'amount', type: 'integer', min: 1, max: 100, description: 'How many (default 1)' },
    ],
    async run(ctx, a) {
      assert(a.user.id !== ctx.user.id && !a.user.bot, 'Pick someone other than yourself (and no bots).');
      const m = me(ctx);
      const q = a.amount || 1;
      assert((m.inv[a.item] || 0) >= q, "You don't have that many to give away.");
      m.inv[a.item] -= q;
      if (!m.inv[a.item]) delete m.inv[a.item];
      const t = db.member(ctx.guild.id, a.user.id);
      t.inv[a.item] = (t.inv[a.item] || 0) + q;
      db.save();
      return ok(`Handed **${q}× ${ITEMS[a.item].name}** over to ${a.user}.`);
    },
  },
  {
    name: 'gamble',
    description: 'Roll against the bot — higher number wins',
    ...eco,
    aliases: ['bet'],
    options: [amountOpt('Your wager')],
    async run(ctx, a) {
      const { m, amt } = bet(ctx, a);
      const you = randInt(1, 100) + Math.round(luck(m) * 100);
      const bot = randInt(1, 100);
      const win = you > bot;
      finish(m, win, amt);
      return card({
        title: '🎲 Gamble',
        fields: [
          ['You rolled', String(Math.min(you, 100))],
          ['Bot rolled', String(bot)],
          ['Result', win ? `Won ${money(amt)} 🎉` : `Lost ${money(amt)}`],
        ],
        color: win ? C.success : C.error,
      });
    },
  },
  {
    name: 'slots',
    description: 'Pull the lever on the slot machine',
    ...eco,
    aliases: ['slot'],
    options: [amountOpt('Your wager')],
    async run(ctx, a) {
      const { m, amt } = bet(ctx, a);
      const sym = ['🍒', '🍋', '🍇', '🔔', '⭐', '💎'];
      const r = [pick(sym), pick(sym), pick(sym)];
      if (Math.random() < luck(m)) r[2] = r[1] = r[0];
      const mult =
        r[0] === r[1] && r[1] === r[2]
          ? r[0] === '💎'
            ? 10
            : 5
          : r[0] === r[1] || r[1] === r[2] || r[0] === r[2]
            ? 1.5
            : 0;
      finish(m, mult > 0, amt, mult);
      return card({
        title: '🎰 Slots',
        description: `**[ ${r.join(' | ')} ]**\n${mult ? `Ka-ching! You won ${money(amt * mult)} (×${mult})!` : `No match. ${money(amt)} gone.`}`,
        color: mult ? C.success : C.error,
      });
    },
  },
  {
    name: 'betflip',
    description: 'Call it in the air: heads or tails',
    ...eco,
    aliases: ['cfbet'],
    options: [
      {
        name: 'side',
        type: 'string',
        required: true,
        lower: true,
        description: 'heads or tails',
        choices: ['heads', 'tails'],
        rest: false,
      },
      amountOpt('Your wager'),
    ],
    async run(ctx, a) {
      const { m, amt } = bet(ctx, a);
      const res = Math.random() < 0.5 + luck(m) ? a.side : a.side === 'heads' ? 'tails' : 'heads';
      const win = res === a.side;
      finish(m, win, amt);
      return card({
        description: `🪙 Landed on **${res}**, so you ${win ? `won ${money(amt)}` : `lost ${money(amt)}`}.`,
        color: win ? C.success : C.error,
      });
    },
  },
  {
    name: 'betroll',
    description: 'Roll 1-100: 66+ doubles, 90+ triples, 100 ×10',
    ...eco,
    options: [amountOpt('Your wager')],
    async run(ctx, a) {
      const { m, amt } = bet(ctx, a);
      const r = Math.min(100, randInt(1, 100) + Math.round(luck(m) * 100));
      const mult = r === 100 ? 10 : r >= 90 ? 3 : r >= 66 ? 2 : 0;
      m.wallet += mult ? amt * (mult - 1) : -amt;
      db.save();
      return card({
        description: `🎲 Rolled a **${r}**, so you ${mult ? `won ${money(amt * (mult - 1))} (×${mult})` : `lost ${money(amt)}`}.`,
        color: mult ? C.success : C.error,
      });
    },
  },
  {
    name: 'roulette',
    description: 'Bet on red, black, green, or a number 0-36',
    ...eco,
    options: [
      {
        name: 'choice',
        type: 'string',
        required: true,
        lower: true,
        description: 'red, black, green, or 0-36',
        rest: false,
      },
      amountOpt('Your wager'),
    ],
    async run(ctx, a) {
      const c = a.choice;
      assert(
        ['red', 'black', 'green'].includes(c) || (/^\d+$/.test(c) && +c <= 36),
        'Pick red, black, green, or a number from 0 to 36.',
      );
      const { m, amt } = bet(ctx, a);
      const n = randInt(0, 36);
      const reds = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
      const col = n === 0 ? 'green' : reds.includes(n) ? 'red' : 'black';
      const mult = /^\d+$/.test(c) ? (+c === n ? 35 : 0) : c === col ? (c === 'green' ? 14 : 1) : 0;
      m.wallet += mult ? amt * mult : -amt;
      db.save();
      return card({
        title: '🎡 Roulette',
        description: `The ball settled on **${n} ${col === 'red' ? '🔴' : col === 'black' ? '⚫' : '🟢'}**\n${mult ? `Winner! ${money(amt * mult)} is yours.` : `The house wins. You lost ${money(amt)}.`}`,
        color: mult ? C.success : C.error,
      });
    },
  },
  {
    name: 'blackjack',
    description: 'Take on the dealer in a hand of blackjack',
    ...eco,
    aliases: ['bj'],
    options: [amountOpt('Your wager')],
    async run(ctx, a) {
      const { m, amt } = bet(ctx, a);
      m.wallet -= amt;
      db.save(); // hold the bet up front so walking away mid-hand can't dodge a loss
      const d = deck();
      const you = [d.pop(), d.pop()];
      const dealer = [d.pop(), d.pop()];
      const view = (done, note) =>
        card({
          title: '🃏 Blackjack',
          color: done ? C.info : C.eco,
          fields: [
            ['Your hand', `${you.join(' ')} — **${score(you)}**`],
            ['Dealer', done ? `${dealer.join(' ')} — **${score(dealer)}**` : `${dealer[0]} 🂠`],
            ['Bet', money(amt)],
          ],
          description: note || null,
          rows: done
            ? []
            : [
                new ActionRowBuilder().addComponents(
                  new ButtonBuilder().setCustomId('bj_hit').setLabel('Hit me').setStyle(ButtonStyle.Primary),
                  new ButtonBuilder()
                    .setCustomId('bj_stand')
                    .setLabel('Stand')
                    .setStyle(ButtonStyle.Secondary),
                  new ButtonBuilder()
                    .setCustomId('bj_double')
                    .setLabel('Double down')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(m.wallet < amt),
                ),
              ],
        });
      const settle = (mult, note) => {
        m.wallet += Math.floor(amt * mult);
        db.save();
        return view(true, note);
      };
      if (score(you) === 21)
        return settle(
          score(dealer) === 21 ? 1 : 2.5,
          score(dealer) === 21
            ? 'Two blackjacks. It’s a push.'
            : `**Blackjack!** That’s ${money(amt * 1.5)} in your pocket.`,
        );
      const msg = await ctx.reply(view(false));
      let bet2 = amt;
      const col = msg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000,
        filter: (i) => i.user.id === ctx.user.id,
      });
      const dealerPlay = () => {
        while (score(dealer) < 17) dealer.push(d.pop());
      };
      const result = () => {
        const y = score(you);
        const dl = score(dealer);
        if (y > 21) return [0, `Bust! ${money(bet2)} down the drain.`];
        if (dl > 21 || y > dl) return [2, `You beat the dealer and win ${money(bet2)}!`];
        if (y === dl) return [1, 'Push. You get your bet back.'];
        return [0, `Dealer takes it. You lose ${money(bet2)}.`];
      };
      col.on('collect', async (i) => {
        if (i.customId === 'bj_double') {
          m.wallet -= amt;
          bet2 = amt * 2;
          you.push(d.pop());
          dealerPlay();
          col.stop('done');
          const [mul, note] = result();
          m.wallet += Math.floor(bet2 * mul);
          db.save();
          return i.update(view(true, `Doubled down! ${note}`));
        }
        if (i.customId === 'bj_hit') {
          you.push(d.pop());
          if (score(you) > 21) {
            col.stop('done');
            db.save();
            return i.update(view(true, `Bust! ${money(bet2)} down the drain.`));
          }
          if (score(you) === 21) {
            dealerPlay();
            col.stop('done');
            const [mul, note] = result();
            m.wallet += Math.floor(bet2 * mul);
            db.save();
            return i.update(view(true, note));
          }
          return i.update(view(false));
        }
        dealerPlay();
        col.stop('done');
        const [mul, note] = result();
        m.wallet += Math.floor(bet2 * mul);
        db.save();
        return i.update(view(true, note));
      });
      col.on('end', (_, reason) => {
        if (reason !== 'done') {
          dealerPlay();
          const [mul, note] = result();
          m.wallet += Math.floor(bet2 * mul);
          db.save();
          msg.edit(view(true, `You went quiet, so we auto-stood for you. ${note}`)).catch(() => {});
        }
      });
    },
  },
  {
    name: 'highlow',
    description: 'Guess if the next number (1-100) is higher or lower',
    ...eco,
    aliases: ['hl'],
    options: [amountOpt('Your wager')],
    async run(ctx, a) {
      const { m, amt } = bet(ctx, a);
      const first = randInt(1, 100);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('hl_high')
          .setLabel('Higher')
          .setEmoji('⬆️')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('hl_low')
          .setLabel('Lower')
          .setEmoji('⬇️')
          .setStyle(ButtonStyle.Danger),
      );
      const msg = await ctx.reply(
        card({
          title: '🔢 Higher or lower?',
          description: `The number is **${first}**. Higher or lower next time? Choose wisely.`,
          rows: [row],
          color: C.eco,
        }),
      );
      const i = await msg
        .awaitMessageComponent({ time: 30000, filter: (x) => x.user.id === ctx.user.id })
        .catch(() => null);
      if (!i)
        return msg
          .edit(card({ description: 'Too slow! No coins lost, though.', color: C.info }))
          .catch(() => {});
      const next = randInt(1, 100);
      // a tie counts as a loss
      const win = next !== first && (i.customId === 'hl_high' ? next > first : next < first);
      finish(m, win, amt);
      return i.update(
        card({
          title: '🔢 Higher or lower',
          description: `${first} → **${next}**, so you ${win ? `won ${money(amt)}` : `lost ${money(amt)}`}.`,
          color: win ? C.success : C.error,
        }),
      );
    },
  },
  {
    name: 'scratch',
    description: 'Buy a scratch card for 250 coins',
    ...eco,
    aliases: ['scratchcard'],
    async run(ctx) {
      const m = me(ctx);
      assert(m.wallet >= 250, 'Scratch cards cost 250 coins, and you’re a little short.');
      cooldown(m, 'scratch', 20);
      m.wallet -= 250;
      const s = ['💰', '💎', '🍀', '❌', '❌', '❌'];
      const g = Array.from({ length: 9 }, () => pick(s));
      const counts = {};
      g.forEach((x) => (counts[x] = (counts[x] || 0) + 1));
      const prize =
        (counts['💎'] >= 3 ? 5000 : 0) + (counts['💰'] >= 3 ? 1500 : 0) + (counts['🍀'] >= 3 ? 800 : 0);
      m.wallet += prize;
      db.save();
      return card({
        title: '🎫 Scratch card',
        description: `${g
          .slice(0, 3)
          .map((x) => `||${x}||`)
          .join(' ')}\n${g
          .slice(3, 6)
          .map((x) => `||${x}||`)
          .join(' ')}\n${g
          .slice(6)
          .map((x) => `||${x}||`)
          .join(
            ' ',
          )}\n\n${prize ? `Prize: ${money(prize)} 🎉` : 'Nothing this time. Better luck on the next scratch.'}`,
        color: prize ? C.success : C.eco,
      });
    },
  },
  gather('fish', 'Cast a line and see what bites (needs a fishing rod)'),
  gather('hunt', 'Stalk something tasty (needs a bow)'),
  gather('mine', 'Swing a pickaxe at some rocks (needs a pickaxe)'),
  gather('chop', 'Chop down a few trees (needs an axe)'),
  gather('dig', 'Dig for buried treasure (needs a shovel)'),
  {
    name: 'postmeme',
    description: 'Post a meme and hope it lands (needs a laptop)',
    ...eco,
    async run(ctx) {
      const m = me(ctx);
      assert(m.inv.laptop, 'Memes don’t post themselves. You need a **💻 Laptop**, so try `buy laptop`.');
      cooldown(m, 'postmeme', 300);
      const r = pick([
        ['went viral 🔥', 2000, 4000],
        ['did okay 👍', 400, 1200],
        ['flopped 💀', 0, 50],
      ]);
      const v = randInt(r[1], r[2]);
      m.wallet += v;
      db.save();
      return card({ description: `Your meme ${r[0]} and earned you ${money(v)}.`, color: C.eco });
    },
  },
  {
    name: 'networth',
    description: 'Wallet + bank + what your items would sell for',
    ...eco,
    aliases: ['nw'],
    options: [{ name: 'user', type: 'user', description: 'Whose net worth to check' }],
    async run(ctx, a) {
      const u = a.user || ctx.user;
      const m = db.member(ctx.guild.id, u.id);
      const items = Object.entries(m.inv).reduce((s, [id, q]) => s + (ITEMS[id]?.price || 0) * 0.7 * q, 0);
      return card({
        title: `📈 ${u.username}'s net worth`,
        fields: [
          ['Cash', money(m.wallet + m.bank)],
          ['Items', money(items)],
          ['Net worth', money(m.wallet + m.bank + items)],
        ],
        color: C.eco,
      });
    },
  },
  {
    name: 'cooldowns',
    description: 'See what you’re still waiting on',
    ...eco,
    aliases: ['cd'],
    async run(ctx) {
      const m = me(ctx);
      const now = Date.now();
      const e = Object.entries(m.cd).filter(([, t]) => t > now);
      return card({
        title: '⏳ Cooldowns',
        description: e.length
          ? e.map(([k, t]) => `\`${k}\` — ${fmtDur(t - now)}`).join('\n')
          : 'Nothing on cooldown. Go wild.',
        color: C.eco,
      });
    },
  },
  {
    name: 'addmoney',
    description: 'Admin: conjure coins out of thin air for a member',
    ...eco,
    perms: [P.ManageGuild],
    options: [
      { name: 'user', type: 'user', required: true, description: 'Member' },
      { name: 'amount', type: 'integer', required: true, min: 1, max: 1e9, description: 'Amount' },
    ],
    async run(ctx, a) {
      db.member(ctx.guild.id, a.user.id).wallet += a.amount;
      db.save();
      return ok(`Conjured ${money(a.amount)} for ${a.user}.`);
    },
  },
  {
    name: 'removemoney',
    description: 'Admin: make a member’s coins disappear',
    ...eco,
    perms: [P.ManageGuild],
    options: [
      { name: 'user', type: 'user', required: true, description: 'Member' },
      { name: 'amount', type: 'integer', required: true, min: 1, max: 1e9, description: 'Amount' },
    ],
    async run(ctx, a) {
      const m = db.member(ctx.guild.id, a.user.id);
      m.wallet = Math.max(0, m.wallet - a.amount);
      db.save();
      return ok(`Poof! ${money(a.amount)} removed from ${a.user}.`);
    },
  },
  {
    name: 'reseteconomy',
    description: 'Admin: wipe a member’s economy data clean',
    ...eco,
    perms: [P.ManageGuild],
    aliases: ['reseteco'],
    options: [{ name: 'user', type: 'user', required: true, description: 'Member' }],
    async run(ctx, a) {
      const m = db.member(ctx.guild.id, a.user.id);
      Object.assign(m, { wallet: 0, bank: 0, inv: {}, cd: {}, streak: 0 });
      db.save();
      return ok(`${a.user} is back to a clean slate.`);
    },
  },
];
