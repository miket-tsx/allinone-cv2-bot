// What the AI staff knows about a server beyond what it can look up live:
//   memories  - short facts staff told it to remember ("our mod role is called Guardians")
//   docs      - longer server docs, rules and FAQs, searched per question
// Search is a small keyword ranker (BM25-ish). It's simple, offline and good enough for a few
// hundred KB of docs, which is way more than most servers have.
const db = require('../lib/db');

const MAX_MEMORIES = 100;
const MAX_DOCS = 50;
const MAX_DOC_CHARS = 40_000;
const CHUNK = 900;
const STOP = new Set(
  'the and for are but not you your with this that have from they will can what when where how who why which our out was were has had all any its his her she him them then than there their about into just like also only some more most very been does did dont cant wont should would could please hey bot'.split(' '),
);

// Rough stemming so "advertise", "advertising" and "advertised" all match each other
const stem = (w) => (w.length > 5 ? w.replace(/(ing|ed|es|s|e)$/, '') : w);
const words = (s) =>
  (
    String(s)
      .toLowerCase()
      .match(/[a-z0-9]{3,}/g)
      ?.filter((w) => !STOP.has(w)) || []
  ).map(stem);

const store = (guildId) => db.guild(guildId).ai;
const newId = () => Math.random().toString(36).slice(2, 7);

function remember(guildId, text, by) {
  const list = store(guildId).memories;
  if (list.length >= MAX_MEMORIES) list.shift(); // oldest falls off
  const m = { id: newId(), text: String(text).slice(0, 300), by, at: Date.now() };
  list.push(m);
  db.save();
  return m;
}

function forget(guildId, ref) {
  const ai = store(guildId);
  const q = String(ref).toLowerCase();
  const hit = ai.memories.find((m) => m.id === ref) || ai.memories.find((m) => m.text.toLowerCase().includes(q));
  if (!hit) return null;
  ai.memories = ai.memories.filter((m) => m !== hit);
  db.save();
  return hit;
}

function addDoc(guildId, title, text, by) {
  const ai = store(guildId);
  if (ai.knowledge.length >= MAX_DOCS) return null;
  const existing = ai.knowledge.find((d) => d.title.toLowerCase() === title.toLowerCase());
  const doc = existing || { id: newId(), title: title.slice(0, 100) };
  Object.assign(doc, { text: String(text).slice(0, MAX_DOC_CHARS), by, at: Date.now() });
  if (!existing) ai.knowledge.push(doc);
  db.save();
  return doc;
}

function removeDoc(guildId, ref) {
  const ai = store(guildId);
  const hit = ai.knowledge.find((d) => d.id === ref || d.title.toLowerCase() === String(ref).toLowerCase());
  if (!hit) return null;
  ai.knowledge = ai.knowledge.filter((d) => d !== hit);
  db.save();
  return hit;
}

// Splits on paragraphs, then packs them into ~900 char chunks
function chunks(doc) {
  const out = [];
  let cur = '';
  for (const para of doc.text.split(/\n\s*\n/)) {
    if (cur && cur.length + para.length > CHUNK) {
      out.push(cur);
      cur = '';
    }
    cur += (cur ? '\n\n' : '') + para;
    while (cur.length > CHUNK * 1.5) {
      out.push(cur.slice(0, CHUNK));
      cur = cur.slice(CHUNK);
    }
  }
  if (cur.trim()) out.push(cur);
  return out.map((text) => ({ title: doc.title, text }));
}

function search(guildId, query, limit = 4) {
  const docs = store(guildId).knowledge;
  if (!docs.length) return [];
  const all = docs.flatMap(chunks);
  const q = [...new Set(words(query))];
  if (!q.length) return [];
  const tf = all.map((c) => {
    const counts = new Map();
    for (const w of words(`${c.title} ${c.text}`)) counts.set(w, (counts.get(w) || 0) + 1);
    return counts;
  });
  const avgLen = all.reduce((n, c) => n + c.text.length, 0) / all.length;
  const scored = all.map((c, i) => {
    let score = 0;
    for (const w of q) {
      const f = tf[i].get(w) || 0;
      if (!f) continue;
      const df = tf.filter((t) => t.has(w)).length;
      const idf = Math.log(1 + (all.length - df + 0.5) / (df + 0.5));
      score += (idf * f * 2.2) / (f + 1.2 * (0.25 + 0.75 * (c.text.length / avgLen)));
    }
    return { ...c, score };
  });
  return scored
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// The bit that goes into the AI's system prompt for each request
function promptContext(guildId, request) {
  const ai = store(guildId);
  const parts = [];
  if (ai.memories.length)
    parts.push(`Things the staff asked you to remember about this server:\n${ai.memories.slice(-40).map((m) => `- ${m.text}`).join('\n')}`);
  const hits = search(guildId, request);
  if (hits.length)
    parts.push(
      `Relevant parts of the server's own docs (prefer these over general knowledge, and say which doc you used):\n${hits.map((h) => `[${h.title}]\n${h.text}`).join('\n---\n')}`,
    );
  return parts.join('\n\n');
}

module.exports = { remember, forget, addDoc, removeDoc, search, promptContext, chunks, MAX_DOCS, MAX_MEMORIES };
