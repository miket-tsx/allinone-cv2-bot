// Music. This is the optional, less reliable part of the bot: YouTube breaks third-party
// players every few months, and voice needs extra native bits. The voice packages
// (@discordjs/voice, @snazzah/davey, opusscript, libsodium-wrappers) are in package.json,
// and lib/ytdlp.js fetches yt-dlp itself on first use. Only ffmpeg has to be on the host.
const { spawn } = require('child_process');
const { card, ok, C, trunc } = require('../lib/ui');
const { assert, UserError, fmtDur } = require('../lib/util');
const { isOn } = require('../lib/features');
const ytdlp = require('../lib/ytdlp');

const queues = new Map(); // guildId -> { player, connection, tracks, now, loop, channelId }
let voice = null;

function lib() {
  if (voice) return voice;
  try {
    voice = require('@discordjs/voice');
  } catch (e) {
    console.error('[music] @discordjs/voice failed to load:', e.message);
    throw new UserError(
      `Music can't start here: the voice packages won't load (${trunc(e.message, 120)}). If the bot runs from Android shared storage, move the project to a normal Linux folder and run npm install there.`,
    );
  }
  return voice;
}

// yt-dlp does the heavy lifting: search, metadata and the audio stream
async function lookup(query) {
  const target = /^https?:\/\//.test(query) ? query : `ytsearch1:${query}`;
  const yt = await ytdlp.bin();
  return new Promise((resolve, reject) => {
    ytdlp.execFile(
      yt.command,
      [...yt.prefix, '--no-playlist', '--skip-download', '--print', '%(title)s\t%(webpage_url)s\t%(duration)s', target],
      { timeout: 60_000 },
      (err, out) => {
        if (err) return reject(new UserError("I couldn't find that song. (yt-dlp failed, check the bot's console.)"));
        const [title, url, duration] = out.trim().split('\n')[0].split('\t');
        if (!url) return reject(new UserError("I couldn't find that song."));
        resolve({ title, url, duration: Number(duration) * 1000 || 0 });
      },
    );
  });
}

async function stream(url) {
  const yt = await ytdlp.bin();
  const proc = spawn(yt.command, [...yt.prefix, '-f', 'bestaudio/best', '--no-playlist', '-q', '-o', '-', url], {
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return proc.stdout;
}

async function playNext(guildId) {
  const q = queues.get(guildId);
  if (!q) return;
  const { createAudioResource, StreamType } = lib();
  if (!q.loop || !q.now) q.now = q.tracks.shift();
  if (!q.now) {
    // Queue finished: hang around for 2 minutes, then leave
    q.idleTimer = setTimeout(() => destroy(guildId), 120_000);
    return;
  }
  clearTimeout(q.idleTimer);
  q.player.play(createAudioResource(await stream(q.now.url), { inputType: StreamType.Arbitrary }));
}

function destroy(guildId) {
  const q = queues.get(guildId);
  if (!q) return;
  clearTimeout(q.idleTimer);
  q.player.stop(true);
  q.connection.destroy();
  queues.delete(guildId);
}

function current(ctx, needSameChannel = true) {
  const q = queues.get(ctx.guild.id);
  assert(q, "Nothing's playing right now.");
  if (needSameChannel) assert(ctx.member.voice?.channelId === q.channelId, 'Join my voice channel first.');
  return q;
}

const base = { guildOnly: true, category: 'music' };

module.exports = [
  {
    ...base,
    name: 'play',
    description: 'Play a song from YouTube (search or link)',
    aliases: ['p'],
    defer: true,
    options: [{ name: 'song', type: 'string', required: true, description: 'Song name or link' }],
    async run(ctx, a) {
      assert(isOn(ctx.guild.id, 'music'), 'Music is switched off in this server.');
      const { joinVoiceChannel, createAudioPlayer, AudioPlayerStatus, VoiceConnectionStatus, entersState } = lib();
      const vc = ctx.member.voice?.channel;
      assert(vc, 'Join a voice channel first.');
      ytdlp.requireFfmpeg('Music');
      const track = { ...(await lookup(a.song)), by: ctx.user.id };
      let q = queues.get(ctx.guild.id);
      if (q) assert(q.channelId === vc.id, "I'm already playing in another channel.");
      else {
        const connection = joinVoiceChannel({ channelId: vc.id, guildId: ctx.guild.id, adapterCreator: ctx.guild.voiceAdapterCreator, selfDeaf: true });
        await entersState(connection, VoiceConnectionStatus.Ready, 20_000).catch(() => {
          connection.destroy();
          throw new UserError("I couldn't connect to that voice channel.");
        });
        const player = createAudioPlayer();
        connection.subscribe(player);
        q = { player, connection, tracks: [], now: null, loop: false, channelId: vc.id };
        queues.set(ctx.guild.id, q);
        player.on(AudioPlayerStatus.Idle, () => playNext(ctx.guild.id));
        player.on('error', () => playNext(ctx.guild.id));
        connection.on(VoiceConnectionStatus.Disconnected, () => destroy(ctx.guild.id));
      }
      q.tracks.push(track);
      if (!q.now || q.player.state.status === AudioPlayerStatus.Idle) {
        await playNext(ctx.guild.id);
        return card({ description: `🎶 Now playing **[${trunc(track.title, 150)}](${track.url})** (${fmtDur(track.duration)})`, color: C.fun });
      }
      return ok(`Queued **${trunc(track.title, 150)}** at #${q.tracks.length}.`);
    },
  },
  {
    ...base,
    name: 'skip',
    description: 'Skip the current song',
    run(ctx) {
      const q = current(ctx);
      q.loop = false;
      q.player.stop();
      return ok('Skipped.');
    },
  },
  {
    ...base,
    name: 'stop',
    description: 'Stop the music and leave the voice channel',
    aliases: ['leave', 'disconnect'],
    run(ctx) {
      current(ctx);
      destroy(ctx.guild.id);
      return ok('Stopped. See ya! 👋');
    },
  },
  {
    ...base,
    name: 'pause',
    description: 'Pause the music',
    run(ctx) {
      current(ctx).player.pause();
      return ok('Paused.');
    },
  },
  {
    ...base,
    name: 'resume',
    description: 'Resume the music',
    run(ctx) {
      current(ctx).player.unpause();
      return ok('Back on.');
    },
  },
  {
    ...base,
    name: 'queue',
    description: "See what's coming up",
    aliases: ['q'],
    run(ctx) {
      const q = current(ctx, false);
      return card({
        title: '🎶 Queue',
        description: `**Now:** ${q.now ? `[${trunc(q.now.title, 100)}](${q.now.url})` : 'nothing'}${q.loop ? ' 🔁' : ''}\n\n${
          q.tracks.slice(0, 15).map((t, i) => `${i + 1}. ${trunc(t.title, 80)} (${fmtDur(t.duration)})`).join('\n') || 'Nothing queued.'
        }`,
        color: C.fun,
      });
    },
  },
  {
    ...base,
    name: 'nowplaying',
    description: "What's playing right now",
    aliases: ['np'],
    run(ctx) {
      const q = current(ctx, false);
      assert(q.now, 'Nothing is playing.');
      return card({ description: `🎶 **[${trunc(q.now.title, 150)}](${q.now.url})**, asked for by <@${q.now.by}>`, color: C.fun });
    },
  },
  {
    ...base,
    name: 'loop',
    description: 'Loop the current song on or off',
    run(ctx) {
      const q = current(ctx);
      q.loop = !q.loop;
      return ok(q.loop ? '🔁 Looping this song.' : 'Loop off.');
    },
  },
];
