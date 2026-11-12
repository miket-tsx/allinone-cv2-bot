// Social alerts without API keys: YouTube and most blogs have RSS, Reddit has public JSON,
// and Twitch live status comes from decapi.me (a free public proxy, no key needed).
// Each check returns the newest items; the scheduler compares them with what it posted last.
const { UserError } = require('./util');

const UA = 'AllInOne-CV2-Bot/1.1 (feed checker)';

async function getText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) }).catch(() => null);
  if (!res?.ok) throw new UserError(`Couldn't load ${url} (${res ? res.status : 'no answer'}).`);
  return res.text();
}

const decode = (s) =>
  String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim();
const tag = (block, name) => decode(block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))?.[1]);

// Handles both RSS (<item>) and Atom (<entry>) feeds
function parseXml(xml) {
  const blocks = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].map((m) => m[0]);
  return blocks.slice(0, 15).map((b) => {
    const link = b.match(/<link[^>]*href="([^"]+)"/i)?.[1] || tag(b, 'link');
    return {
      id: tag(b, 'yt:videoId') || tag(b, 'guid') || tag(b, 'id') || link,
      title: tag(b, 'title') || 'New post',
      url: decode(link),
      author: tag(b, 'name') || tag(b, 'dc:creator') || tag(b, 'author'),
    };
  });
}

async function youtubeChannelId(target) {
  const t = target.trim();
  const direct = t.match(/(UC[\w-]{22})/)?.[1];
  if (direct) return direct;
  const handle = t.match(/@[\w.-]+/)?.[0] || `@${t.replace(/^.*\//, '')}`;
  const html = await getText(`https://www.youtube.com/${handle}`);
  const id = html.match(/"(?:externalId|channelId)":"(UC[\w-]{22})"/)?.[1] || html.match(/channel\/(UC[\w-]{22})/)?.[1];
  if (!id) throw new UserError(`I couldn't find a YouTube channel for ${handle}.`);
  return id;
}

// Turns what the user typed into the thing we actually poll, so bad input fails at setup time
async function resolve(type, target) {
  if (type === 'youtube') {
    const id = await youtubeChannelId(target);
    const items = parseXml(await getText(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`));
    return { target: id, label: items[0]?.author || target };
  }
  if (type === 'twitch') {
    const name = target.replace(/^.*twitch\.tv\//, '').replace(/[^\w]/g, '').toLowerCase();
    if (!name) throw new UserError("That doesn't look like a Twitch username.");
    return { target: name, label: name };
  }
  if (type === 'reddit') {
    const sub = target.replace(/^.*\/r\//, '').replace(/^r\//, '').replace(/[^\w]/g, '');
    if (!sub) throw new UserError("That doesn't look like a subreddit.");
    await getText(`https://www.reddit.com/r/${sub}/new.json?limit=1`);
    return { target: sub, label: `r/${sub}` };
  }
  if (!/^https?:\/\//.test(target)) throw new UserError('RSS feeds need a full link starting with http.');
  const items = parseXml(await getText(target));
  if (!items.length) throw new UserError("I loaded that link, but it doesn't look like an RSS or Atom feed.");
  return { target, label: new URL(target).hostname };
}

async function check(feed) {
  if (feed.type === 'youtube') return parseXml(await getText(`https://www.youtube.com/feeds/videos.xml?channel_id=${feed.target}`));
  if (feed.type === 'rss') return parseXml(await getText(feed.target));
  if (feed.type === 'reddit') {
    const json = JSON.parse(await getText(`https://www.reddit.com/r/${feed.target}/new.json?limit=10`));
    return json.data.children.map(({ data: p }) => ({ id: p.id, title: p.title, url: `https://reddit.com${p.permalink}`, author: `u/${p.author}` }));
  }
  if (feed.type === 'twitch') {
    const uptime = await getText(`https://decapi.me/twitch/uptime/${feed.target}`);
    if (/offline|not found|error/i.test(uptime)) return [];
    const title = await getText(`https://decapi.me/twitch/title/${feed.target}`).catch(() => 'Live now');
    // One "item" per stream: the id changes whenever a new stream starts, roughly by start hour
    const started = Date.now() - parseUptime(uptime);
    return [{ id: `live-${Math.floor(started / 3600_000)}`, title: title.trim(), url: `https://twitch.tv/${feed.target}`, author: feed.target, live: true }];
  }
  return [];
}

function parseUptime(s) {
  const n = (u) => Number(s.match(new RegExp(`(\\d+) ${u}`))?.[1] || 0);
  return ((n('day') * 24 + n('hour')) * 60 + n('minute')) * 60_000 + n('second') * 1000;
}

module.exports = { resolve, check, parseXml, parseUptime, TYPES: ['youtube', 'twitch', 'reddit', 'rss'] };
