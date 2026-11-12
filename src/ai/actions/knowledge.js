// Lets the AI staff use its own memory and the server docs while it works.
const { PermissionFlagsBits: P } = require('discord.js');
const knowledge = require('../knowledge');
const db = require('../../lib/db');

module.exports = [
  {
    name: 'remember_fact',
    description: 'Save a lasting fact about this server so you remember it in future conversations',
    params: { fact: 's! The fact, one short sentence' },
    perms: [P.ManageGuild],
    async run(env, a) {
      const m = knowledge.remember(env.guild.id, a.fact, env.member.id);
      return `Saved memory ${m.id}.`;
    },
  },
  {
    name: 'forget_fact',
    description: 'Forget a saved fact about this server',
    params: { memory: 's! Memory ID or words from it' },
    perms: [P.ManageGuild],
    async run(env, a) {
      const m = knowledge.forget(env.guild.id, a.memory);
      return m ? `Forgot: ${m.text}` : 'No memory like that.';
    },
  },
  {
    name: 'list_memories',
    description: 'List every saved fact about this server',
    params: {},
    async run(env) {
      const list = db.guild(env.guild.id).ai.memories;
      return list.map((m) => `${m.id}: ${m.text}`).join('\n') || 'No memories saved.';
    },
  },
  {
    name: 'search_docs',
    description: "Search the server's own docs, rules and FAQ",
    params: { query: 's! What to look for' },
    async run(env, a) {
      const hits = knowledge.search(env.guild.id, a.query, 4);
      return hits.map((h) => `[${h.title}]\n${h.text}`).join('\n---\n') || 'Nothing in the server docs about that.';
    },
  },
];
