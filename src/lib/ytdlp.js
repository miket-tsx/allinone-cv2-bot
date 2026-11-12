// yt-dlp isn't an npm package, so this finds one and, if there isn't one, downloads the
// official standalone build the first time it's needed. That way music and the download
// command work on a fresh install without the owner installing anything by hand.
//
// It goes in the first place that can actually *execute* a file we write. Shared Android
// storage (where this project often lives) mounts noexec, so `data/bin` is tried first but
// we fall back to the user's cache directory when chmod/exec doesn't stick.
const { execFile, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { UserError } = require('./util');

const RELEASE = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/';
const PROJECT_BIN = path.join(__dirname, '..', '..', 'data', 'bin');
const CACHE_BIN = path.join(os.homedir(), '.cache', 'allinone', 'bin');

// Termux gets the python zipapp (it has python3, but not a glibc loader for our binaries)
const ASSET = (() => {
  if (process.platform === 'win32') return 'yt-dlp.exe';
  if (process.platform === 'darwin') return 'yt-dlp_macos';
  if (process.platform === 'android') return 'yt-dlp';
  return process.arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux';
})();
const NEEDS_PYTHON = ASSET === 'yt-dlp';

const isExec = (p) => {
  try {
    fs.accessSync(p, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

function onPath(name) {
  for (const dir of (process.env.PATH || '').split(path.delimiter).filter(Boolean)) {
    const p = path.join(dir, name);
    if (isExec(p)) return p;
  }
  return null;
}

// Can we write a file here *and* run it? Android shared storage says no to the second part.
function canExecuteIn(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    if (process.platform === 'win32') return true; // no chmod/exec bit to worry about
    const probe = path.join(dir, `.probe-${process.pid}`);
    fs.writeFileSync(probe, '#!/bin/sh\nexit 0\n');
    fs.chmodSync(probe, 0o755);
    execFileSync(probe, [], { stdio: 'ignore', timeout: 5000 });
    fs.rmSync(probe, { force: true });
    return true;
  } catch {
    return false;
  }
}

let binDir;
function installDir() {
  if (binDir !== undefined) return binDir;
  const wanted = [process.env.YTDLP_DIR, PROJECT_BIN, CACHE_BIN].filter(Boolean);
  binDir = wanted.find(canExecuteIn) || CACHE_BIN;
  return binDir;
}

// { command, prefix } so callers can execFile(command, [...prefix, ...args])
let resolved = null;
let pending = null;

async function download(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const res = await fetch(RELEASE + ASSET, { redirect: 'follow' }).catch((e) => {
    throw new UserError(`I couldn't download yt-dlp (${e.message}). Check the host's internet.`);
  });
  if (!res.ok) throw new UserError(`I couldn't download yt-dlp (the release server said ${res.status}).`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 100_000) throw new UserError('The yt-dlp download came back empty. Try again in a bit.');
  // Write next to the target and rename, so a half-written file never looks usable
  const tmp = `${file}.part`;
  fs.writeFileSync(tmp, buf);
  try {
    fs.chmodSync(tmp, 0o755);
  } catch {
    /* some filesystems keep their own mode; the exec test below is what matters */
  }
  fs.renameSync(tmp, file);
}

async function resolve() {
  const custom = process.env.YTDLP_PATH;
  if (custom && isExec(custom)) return { command: custom, prefix: [] };
  const system = onPath(ASSET) || onPath('yt-dlp');
  if (system) return { command: system, prefix: [] };

  const local = path.join(installDir(), ASSET);
  if (!isExec(local)) {
    if (!pending) pending = download(local).finally(() => (pending = null));
    await pending;
  }
  return NEEDS_PYTHON ? { command: 'python3', prefix: [local] } : { command: local, prefix: [] };
}

async function bin() {
  if (resolved) return resolved;
  try {
    resolved = await resolve();
  } catch (e) {
    if (e instanceof UserError) throw e;
    throw new UserError(`yt-dlp isn't available on the bot host (${e.message}).`);
  }
  // YouTube now wants a JavaScript runtime to decipher its player. The bot runs on Node, so
  // hand that to yt-dlp when the build knows the flag (older builds don't have it).
  try {
    const help = execFileSync(resolved.command, [...resolved.prefix, '--help'], {
      encoding: 'utf8',
      timeout: 20_000,
      maxBuffer: 16 * 1024 * 1024,
    });
    if (help.includes('--js-runtimes') && process.execPath)
      resolved.prefix.push('--js-runtimes', `node:${process.execPath}`);
  } catch {
    /* help text is a nicety; carry on without the flag */
  }
  return resolved;
}

// Music needs this too: yt-dlp pipes raw audio and ffmpeg turns it into something Discord can play
let ffmpegPath;
function ffmpeg() {
  if (ffmpegPath !== undefined) return ffmpegPath;
  ffmpegPath = onPath('ffmpeg');
  return ffmpegPath;
}

function requireFfmpeg(what) {
  if (!ffmpeg())
    throw new UserError(
      `${what} needs ffmpeg on the bot host and I can't find it. Install it (\`apt install ffmpeg\`, or \`pkg install ffmpeg\` in Termux).`,
    );
}

module.exports = { bin, ffmpeg, requireFfmpeg, asset: ASSET, dir: installDir, execFile };
