// Download a video from YouTube, Instagram and the other sites yt-dlp knows, and post it
// straight into the channel. Nothing is kept: the file lands in a temp folder, gets uploaded,
// and the folder is wiped whether that worked or not.
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { AttachmentBuilder } = require('discord.js');
const { card, C } = require('../lib/ui');
const { assert, UserError, fmtDur } = require('../lib/util');
const ytdlp = require('../lib/ytdlp');

// Discord's upload cap is 25 MB without boosts, so aim just under it
const LIMIT = 24 * 1024 * 1024;
const MAX_FILES = 4;
const KNOWN = /^https?:\/\/(www\.|m\.|music\.|vm\.)?(youtube\.com|youtu\.be|instagram\.com|instagr\.am|tiktok\.com|twitter\.com|x\.com|facebook\.com|reddit\.com|vimeo\.com)\//i;

// Long videos at 720p blow past the upload cap, so drop the quality as the length grows
const heightFor = (seconds) => (seconds > 900 ? 360 : seconds > 300 ? 480 : 720);

function media(yt, args, timeout = 180_000) {
  return new Promise((resolve, reject) => {
    execFile(yt.command, [...yt.prefix, ...args], { timeout, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const detail = String(stderr || err.message).split('\n').filter(Boolean).slice(-2).join(' ').slice(0, 200);
        return reject(new UserError(err.killed ? 'That download took too long, so I stopped it.' : `yt-dlp couldn't grab that one. ${detail}`));
      }
      resolve(stdout);
    });
  });
}

function filesIn(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => !f.endsWith('.part') && !f.endsWith('.ytdl'))
    .map((f) => path.join(dir, f))
    .sort((a, b) => fs.statSync(b).size - fs.statSync(a).size);
}

const safeName = (title, file) => {
  const clean = String(title || 'video')
    .replace(/[^\w\s.-]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return `${clean || 'video'}${path.extname(file) || '.mp4'}`;
};

module.exports = [
  {
    name: 'download',
    description: 'Grab a YouTube or Instagram video and post it here (nothing is saved)',
    defer: true,
    cooldown: 15,
    aliases: ['dl', 'ytdl'],
    botPerms: ['AttachFiles'],
    options: [{ name: 'url', type: 'string', required: true, description: 'Link to the video' }],
    async run(ctx, a) {
      const url = a.url.trim();
      assert(/^https?:\/\//i.test(url), 'That needs to be a link, starting with http:// or https://');
      if (!KNOWN.test(url)) assert(/^https?:\/\/[^\s/]+\.[a-z]{2,}/i.test(url), "That doesn't look like a video link.");
      const yt = await ytdlp.bin();

      // One quick metadata pass, so we know what we're dealing with and can size the quality
      const meta = await media(yt, ['--no-playlist', '--skip-download', '--print', '%(title)s\t%(duration)s', url], 45_000);
      const [title = 'video', secs = '0'] = meta.trim().split('\n')[0].split('\t');
      const duration = Number(secs) || 0;
      if (duration > 3600) throw new UserError("That's over an hour long. Discord wouldn't take the file anyway.");

      const merged = !!ytdlp.ffmpeg();
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aio-dl-'));
      let files = [];
      let h = heightFor(duration);
      try {
        // Two passes at most: try the nice quality, fall back to 360p if it's too heavy
        for (;;) {
          const fmt = merged
            ? `bv*[height<=${h}][ext=mp4]+ba[ext=m4a]/b[height<=${h}][ext=mp4]/b[height<=${h}]/b`
            : `b[height<=${h}][ext=mp4]/b[height<=${h}]/b`;
          const args = ['--no-playlist', '--no-warnings', '--quiet', '-f', fmt, '-o', path.join(dir, 'media.%(ext)s')];
          if (merged) args.push('--merge-output-format', 'mp4');
          await media(yt, [...args, url]);

          files = filesIn(dir);
          assert(files.length, "I couldn't find a video on that link.");
          const biggest = files.slice(0, MAX_FILES).reduce((n, f) => n + fs.statSync(f).size, 0);
          if (biggest <= LIMIT) break;
          if (h === 360) throw new UserError(`That one is ${(biggest / 1024 / 1024).toFixed(0)} MB even at 360p, and Discord stops at 25 MB.`);
          // wipe and retry smaller
          for (const f of files) fs.rmSync(f, { force: true });
          h = 360;
        }

        const picked = files.slice(0, MAX_FILES);
        const total = picked.reduce((n, f) => n + fs.statSync(f).size, 0);
        const attachments = picked.map((f, i) =>
          i === 0 ? new AttachmentBuilder(f, { name: safeName(title, f) }) : new AttachmentBuilder(f),
        );
        const payload = {
          ...card({
            title: `🎬 ${title.slice(0, 180)}`,
            description: `${duration ? `${fmtDur(duration * 1000)} · ` : ''}${(total / 1024 / 1024).toFixed(1)} MB${h < heightFor(duration) ? ' · 360p (smaller to fit Discord)' : ''}\n<${url}>`,
            footer: 'Nothing kept on my end',
            color: C.info,
          }),
          files: attachments,
        };
        if (ctx.isSlash) await ctx.interaction.editReply(payload);
        else await ctx.channel.send(payload);
        return null;
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  },
];
