const {
  PermissionFlagsBits: P,
  AutoModerationRuleTriggerType: Trigger,
  AutoModerationActionType: Act,
} = require('discord.js');

const findRule = async (env, ref) => {
  const rules = await env.guild.autoModerationRules.fetch();
  return rules.get(String(ref)) || rules.find((x) => x.name.toLowerCase() === String(ref).toLowerCase());
};

module.exports = [
  {
    name: 'list_automod_rules',
    description: "List the server's AutoMod rules",
    params: {},
    perms: [P.ManageGuild],
    async run(env) {
      const rules = await env.guild.autoModerationRules.fetch();
      return rules.size
        ? rules
            .map(
              (x) =>
                `${x.name} (${x.enabled ? 'on' : 'off'}): ${x.triggerMetadata.keywordFilter?.join(', ') || Trigger[x.triggerType]}`,
            )
            .join('\n')
        : 'No AutoMod rules yet.';
    },
  },
  {
    name: 'create_word_filter',
    description: 'Create an AutoMod rule that blocks messages with certain words',
    params: {
      name: 's! Rule name',
      words: 's! Comma separated words or phrases. Use *word* to match inside other words',
      timeout_minutes: 'n Also time out offenders for this many minutes',
    },
    perms: [P.ManageGuild],
    confirm: true,
    async run(env, a) {
      const words = a.words
        .split(',')
        .map((w) => w.trim())
        .filter(Boolean)
        .slice(0, 1000);
      const actions = [
        { type: Act.BlockMessage, metadata: { customMessage: 'That word is not allowed here.' } },
      ];
      if (a.timeout_minutes)
        actions.push({
          type: Act.Timeout,
          metadata: { durationSeconds: Math.min(2419200, a.timeout_minutes * 60) },
        });
      await env.guild.autoModerationRules.create({
        name: a.name,
        eventType: 1,
        triggerType: Trigger.Keyword,
        triggerMetadata: { keywordFilter: words },
        actions,
        enabled: true,
        reason: env.reason,
      });
      return `Created the "${a.name}" filter with ${words.length} words.`;
    },
  },
  {
    name: 'toggle_automod_rule',
    description: 'Turn an AutoMod rule on or off',
    params: { rule: 's! Rule name or ID', enabled: 'b! true to turn on' },
    perms: [P.ManageGuild],
    confirm: true,
    async run(env, a) {
      const rule = await findRule(env, a.rule);
      if (!rule) return `No AutoMod rule called "${a.rule}".`;
      await rule.setEnabled(!!a.enabled, env.reason);
      return `${rule.name} is ${a.enabled ? 'on' : 'off'}.`;
    },
  },
  {
    name: 'delete_automod_rule',
    description: 'Delete an AutoMod rule',
    params: { rule: 's! Rule name or ID' },
    perms: [P.ManageGuild],
    confirm: true,
    danger: true,
    async run(env, a) {
      const rule = await findRule(env, a.rule);
      if (!rule) return `No AutoMod rule called "${a.rule}".`;
      await rule.delete(env.reason);
      return `Deleted ${rule.name}.`;
    },
  },
];
