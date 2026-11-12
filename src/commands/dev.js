const crypto = require('crypto');
const dns = require('dns').promises;
const { SnowflakeUtil } = require('discord.js');
const { card, C } = require('../lib/ui');
const { assert, codeblock, ts, pick } = require('../lib/util');

const hashCmd = (name, algo) => ({
  name,
  description: `Get the ${algo.toUpperCase()} hash of any text`,
  options: [{ name: 'text', type: 'string', required: true, description: 'Whatever you want hashed' }],
  async run(ctx, a) {
    return card({
      title: `${algo.toUpperCase()} hash`,
      description: codeblock(crypto.createHash(algo).update(a.text).digest('hex')),
      color: C.info,
    });
  },
});
const HTTP = {
  100: 'Continue',
  101: 'Switching Protocols',
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  206: 'Partial Content',
  301: 'Moved Permanently',
  302: 'Found',
  304: 'Not Modified',
  307: 'Temporary Redirect',
  308: 'Permanent Redirect',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  418: "I'm a teapot",
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};
const LOREM =
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum'.split(
    ' ',
  );

module.exports = [
  hashCmd('md5', 'md5'),
  hashCmd('sha1', 'sha1'),
  hashCmd('sha256', 'sha256'),
  hashCmd('sha384', 'sha384'),
  hashCmd('sha512', 'sha512'),
  {
    name: 'hmac',
    description: 'Sign some text with a key using HMAC-SHA256',
    options: [
      { name: 'key', type: 'string', required: true, description: 'Your secret key', rest: false },
      { name: 'text', type: 'string', required: true, description: 'The text to sign' },
    ],
    async run(ctx, a) {
      return {
        ...card({
          title: 'HMAC-SHA256',
          description: codeblock(crypto.createHmac('sha256', a.key).update(a.text).digest('hex')),
          color: C.info,
        }),
        // keys shouldn't end up in channel history
        ephemeral: true,
      };
    },
  },
  {
    name: 'jwtdecode',
    description: 'Peek inside a JWT (header + payload, signature is NOT verified)',
    aliases: ['jwt'],
    options: [{ name: 'token', type: 'string', required: true, description: 'The token to crack open' }],
    async run(ctx, a) {
      const p = a.token.trim().split('.');
      assert(p.length === 3, "That doesn't look like a JWT. I'm expecting three dot-separated chunks.");
      const dec = (s) => {
        try {
          return JSON.stringify(JSON.parse(Buffer.from(s, 'base64url').toString()), null, 2);
        } catch {
          assert(false, "Couldn't decode that JWT. One of the segments is pure gibberish.");
        }
      };
      const payload = JSON.parse(dec(p[1]));
      const exp = payload.exp
        ? `\nExpires: ${ts(payload.exp * 1000, 'F')} (${ts(payload.exp * 1000, 'R')})`
        : '';
      return {
        ...card({
          title: 'JWT',
          description: `**Header**${codeblock(dec(p[0]), 'json')}**Payload**${codeblock(dec(p[1]), 'json')}${exp}`,
          footer: "Signature not verified, so don't trust it with your life",
          color: C.info,
        }),
        // tokens are sensitive, keep the reply private
        ephemeral: true,
      };
    },
  },
  {
    name: 'json',
    description: 'Check that your JSON is valid and make it pretty',
    aliases: ['prettyjson'],
    options: [
      { name: 'json', type: 'string', required: true, description: 'JSON to check (code blocks are fine)' },
    ],
    async run(ctx, a) {
      let v;
      try {
        v = JSON.parse(a.json.replace(/^```(json)?|```$/g, ''));
      } catch (e) {
        assert(false, `That JSON is busted: ${e.message}`);
      }
      return card({
        title: '✅ Looks like valid JSON',
        description: codeblock(JSON.stringify(v, null, 2), 'json'),
        color: C.success,
      });
    },
  },
  {
    name: 'minifyjson',
    description: 'Squish JSON down to a single line',
    options: [
      { name: 'json', type: 'string', required: true, description: 'JSON to squish (code blocks are fine)' },
    ],
    async run(ctx, a) {
      let v;
      try {
        v = JSON.parse(a.json.replace(/^```(json)?|```$/g, ''));
      } catch (e) {
        assert(false, `Can't minify that, the JSON is invalid: ${e.message}`);
      }
      return card({ description: codeblock(JSON.stringify(v), 'json'), color: C.info });
    },
  },
  {
    name: 'regex',
    description: 'Try a regex against some text: /pattern/flags text',
    aliases: ['regextest'],
    options: [
      { name: 'pattern', type: 'string', required: true, description: '/pattern/flags', rest: false },
      { name: 'text', type: 'string', required: true, description: 'Text to run it against' },
    ],
    async run(ctx, a) {
      const m = a.pattern.match(/^\/(.+)\/([dgimsuy]*)$/);
      let re;
      try {
        // matchAll throws without the g flag, so force it
        re = m ? new RegExp(m[1], m[2].includes('g') ? m[2] : m[2] + 'g') : new RegExp(a.pattern, 'g');
      } catch (e) {
        assert(false, `Your regex didn't compile: ${e.message}`);
      }
      // cap input and hit count to keep runtime and the reply size sane
      const hits = [...a.text.slice(0, 2000).matchAll(re)].slice(0, 25);
      return card({
        title: `Regex ${re}`,
        description: hits.length
          ? hits
              .map(
                (h, i) =>
                  `**${i + 1}.** \`${h[0]}\` at ${h.index}${
                    h.length > 1
                      ? ` · groups: ${h
                          .slice(1)
                          .map((g) => `\`${g}\``)
                          .join(', ')}`
                      : ''
                  }`,
              )
              .join('\n')
          : 'Nothing matched. Regex strikes again.',
        color: C.info,
      });
    },
  },
  {
    name: 'snowflake',
    description: 'Find out when a Discord ID was created (and a bit more)',
    options: [{ name: 'id', type: 'string', required: true, description: 'Any Discord ID' }],
    async run(ctx, a) {
      const id = a.id.match(/\d{17,20}/)?.[0];
      assert(id, "That doesn't look like a Discord ID. I'm after 17-20 digits.");
      const d = SnowflakeUtil.deconstruct(id);
      return card({
        title: `Snowflake ${id}`,
        fields: [
          ['Created', `${ts(Number(d.timestamp))} (${ts(Number(d.timestamp), 'R')})`],
          ['Worker', String(d.workerId)],
          ['Process', String(d.processId)],
          ['Increment', String(d.increment)],
        ],
        color: C.info,
      });
    },
  },
  {
    name: 'httpstatus',
    description: 'What does that HTTP status code actually mean?',
    aliases: ['http'],
    options: [
      { name: 'code', type: 'integer', required: true, min: 100, max: 599, description: 'The status code' },
    ],
    async run(ctx, a) {
      const t = HTTP[a.code];
      const cls = ['', 'Informational', 'Success', 'Redirection', 'Client error', 'Server error'][
        Math.floor(a.code / 100)
      ];
      return card({
        title: `HTTP ${a.code}`,
        description: `**${t || 'Unofficial / uncommon code'}** — ${cls}`,
        image: `https://http.cat/${a.code}.jpg`,
        color: C.info,
      });
    },
  },
  {
    name: 'lorem',
    description: 'Whip up some lorem ipsum filler text',
    aliases: ['loremipsum'],
    options: [
      { name: 'words', type: 'integer', min: 1, max: 300, description: 'How many words (default 50)' },
    ],
    async run(ctx, a) {
      const n = a.words || 50;
      // the first few words stay canonical so it still reads as "the" lorem ipsum
      const w = Array.from({ length: n }, (_, i) => (i < 8 ? LOREM[i] : pick(LOREM)));
      const s = w.join(' ');
      return card({ description: s[0].toUpperCase() + s.slice(1) + '.', color: C.info });
    },
  },
  {
    name: 'dns',
    description: 'Look up DNS records for a domain',
    aliases: ['dnslookup'],
    defer: true,
    options: [
      { name: 'domain', type: 'string', required: true, description: 'The domain to look up', rest: false },
      {
        name: 'type',
        type: 'string',
        lower: true,
        description: 'Which record type (default A)',
        choices: ['a', 'aaaa', 'mx', 'txt', 'ns', 'cname'],
      },
    ],
    async run(ctx, a) {
      const t = (a.type || 'a').toUpperCase();
      // people paste full URLs, so strip the scheme and path
      const d = a.domain.replace(/^https?:\/\//, '').split('/')[0];
      assert(/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d), "That doesn't look like a domain to me.");
      let r;
      try {
        r = await dns.resolve(d, t);
      } catch (e) {
        assert(false, `No ${t} records found (${e.code}).`);
      }
      const lines = r.map((x) =>
        typeof x === 'string'
          ? x
          : Array.isArray(x)
            ? x.join('')
            : x.exchange
              ? `${x.priority} ${x.exchange}`
              : JSON.stringify(x),
      );
      return card({ title: `${t} records — ${d}`, description: codeblock(lines.join('\n')), color: C.info });
    },
  },
  {
    name: 'urlparse',
    description: 'Take a URL apart and see what it is made of',
    options: [{ name: 'url', type: 'string', required: true, description: 'The URL to dissect' }],
    async run(ctx, a) {
      let u;
      try {
        u = new URL(a.url);
      } catch {
        assert(false, "That URL didn't parse. Did you forget the https://?");
      }
      const q = [...u.searchParams].map(([k, v]) => `\`${k}\` = \`${v}\``).join('\n');
      return card({
        title: 'URL parts',
        fields: [
          ['Protocol', u.protocol],
          ['Host', u.hostname],
          ['Port', u.port || '(default)'],
          ['Path', u.pathname],
          ['Query', q || '—'],
          ['Hash', u.hash || '—'],
        ],
        color: C.info,
      });
    },
  },
  {
    name: 'timestampms',
    description: 'Turn a date string into Unix time and ISO format',
    options: [{ name: 'date', type: 'string', required: true, description: 'Pretty much any date string' }],
    async run(ctx, a) {
      const d = new Date(a.date);
      assert(
        !Number.isNaN(d.getTime()),
        "I can't make sense of that date. Try something like 2024-05-01 12:00 UTC.",
      );
      return card({
        fields: [
          ['ISO', `\`${d.toISOString()}\``],
          ['Unix (s)', `\`${Math.floor(d / 1000)}\``],
          ['Unix (ms)', `\`${d.getTime()}\``],
          ['Discord', ts(d, 'F')],
        ],
        color: C.info,
      });
    },
  },
  {
    name: 'bytes',
    description: 'How big is your text? Bytes (UTF-8) and characters',
    options: [{ name: 'text', type: 'string', required: true, description: 'Text to measure' }],
    async run(ctx, a) {
      return card({
        fields: [
          ['Bytes (UTF-8)', String(Buffer.byteLength(a.text))],
          ['Characters', String([...a.text].length)],
          ['UTF-16 units', String(a.text.length)],
        ],
        color: C.info,
      });
    },
  },
  {
    name: 'cron',
    description: 'Translate a 5-field cron expression into plain English-ish',
    options: [{ name: 'expression', type: 'string', required: true, description: 'e.g. */15 9-17 * * 1-5' }],
    async run(ctx, a) {
      const f = a.expression.trim().split(/\s+/);
      assert(f.length === 5, 'Cron wants exactly 5 fields: minute, hour, day, month, weekday.');
      const names = ['Minute', 'Hour', 'Day of month', 'Month', 'Day of week'];
      const explain = (v) =>
        v === '*'
          ? 'every'
          : v.startsWith('*/')
            ? `every ${v.slice(2)}`
            : v.includes('-')
              ? `from ${v.replace('-', ' to ')}`
              : v.includes(',')
                ? `at ${v}`
                : `at ${v}`;
      return card({
        title: `cron: ${a.expression}`,
        fields: f.map((v, i) => [names[i], `\`${v}\` — ${explain(v)}`]),
        color: C.info,
      });
    },
  },
];
