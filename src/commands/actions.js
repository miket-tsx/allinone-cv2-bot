// Anime reaction GIFs from nekos.best (free, no API key needed).
const { card, C } = require('../lib/ui');
const { fetchJson, pick } = require('../lib/util');

// [endpoint, verb text, targeted?]
const ACTIONS = [
  ['hug', 'hugs', true],
  ['kiss', 'kisses', true],
  ['pat', 'pats', true],
  ['slap', 'slaps', true],
  ['poke', 'pokes', true],
  ['cuddle', 'cuddles', true],
  ['bite', 'bites', true],
  ['highfive', 'high-fives', true],
  ['handshake', 'shakes hands with', true],
  ['handhold', 'holds hands with', true],
  ['tickle', 'tickles', true],
  ['feed', 'feeds', true],
  ['punch', 'punches', true],
  ['peck', 'gives a peck to', true],
  ['yeet', 'yeets', true],
  ['shoot', 'finger-guns', true],
  ['stare', 'stares at', true],
  ['baka', 'calls baka:', true],
  ['wave', 'waves at', true],
  ['nom', 'noms', true],
  ['smile', 'smiles', false],
  ['laugh', 'laughs', false],
  ['cry', 'cries', false],
  ['blush', 'blushes', false],
  ['dance', 'dances', false],
  ['happy', 'is happy', false],
  ['nod', 'nods', false],
  ['nope', 'says nope', false],
  ['bored', 'is bored', false],
  ['facepalm', 'facepalms', false],
  ['shrug', 'shrugs', false],
  ['sleep', 'falls asleep', false],
  ['think', 'is thinking', false],
  ['thumbsup', 'gives a thumbs up', false],
  ['wink', 'winks', false],
  ['yawn', 'yawns', false],
  ['smug', 'looks smug', false],
  ['pout', 'pouts', false],
  ['lurk', 'lurks', false],
  ['run', 'runs away', false],
];

module.exports = ACTIONS.map(([ep, verb, targeted]) => ({
  name: ep,
  category: 'actions',
  // the colon in "calls baka:" only makes sense mid-sentence, so strip it here
  description: targeted ? `Anime GIF energy: ${verb.replace(':', '')} someone` : `Anime GIF mood: ${verb}`,
  defer: true,
  cooldown: 3,
  options: [
    {
      name: 'user',
      type: 'user',
      required: false,
      description: targeted ? 'Who is on the receiving end?' : 'Aim it at someone (optional)',
    },
  ],
  async run(ctx, a) {
    const d = await fetchJson(`https://nekos.best/api/v2/${ep}`);
    const r = pick(d.results);
    const who = a.user && a.user.id !== ctx.user.id ? ` ${a.user}` : targeted ? ' themselves' : '';
    const text = targeted
      ? `**${ctx.user.username}** ${verb}${who}`
      : `**${ctx.user.username}** ${verb}${a.user && who ? ` at${who}` : ''}`;
    return card({
      description: text,
      image: r.url,
      footer: r.anime_name ? `Straight out of ${r.anime_name}` : 'via nekos.best',
      color: C.fun,
    });
  },
}));
