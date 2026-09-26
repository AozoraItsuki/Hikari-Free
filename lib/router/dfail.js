import config from '#config';

const msgs = {
  owner: '🚫 This command can only be used by the *Owner*.',
  mods: '🛠️ This command is restricted to *Developers* only.',
  premium: '💎 This feature is exclusive to *Premium* users.',
  group: '👥 This command can only be used in *Group Chats*.',
  private: '💬 This command can only be used in *Private Chat*.',
  admin: '🛡️ This command can only be executed by a *Group Admin*.',
  botAdmin: '🤖 Please promote the bot to *Admin* to use this feature.',
  onlyprem: `💎 This feature is only available for *Premium* users in Private Chat.\n🔗 Join the group: ${config.group || 'not available'}`,
  nsfw: '🚫 *NSFW* features have been disabled by the group admin.',
  rpg: '🎮 *RPG Game* features have been disabled by the group admin.',
  game: '🕹️ *Game* features have been disabled by the group admin.',
  limitExp:
    '⏳ You have reached the usage limit.\nUpgrade to *Premium* or wait until the daily reset at midnight.',
  restrict: '🔒 This feature is currently restricted and cannot be used.',
  energy: '⚡ Your energy is depleted. Use *#eat* to recharge.',
  unreg: '📋 You are not registered with this bot.',
};

export async function dfail(type, m, conn) {
  let msg = msgs[type];
  if (!msg) return;
  if (type === 'botAdmin') {
    msg = `🤖 Please promote ${conn?.user?.name ?? 'the bot'} to *Admin* to use this feature.`;
  } else if (type === 'unreg') {
    msg = `📋 You are not registered with *${conn?.user?.name ?? 'Hikari'}* yet.`;
  }
  if (type === 'unreg') {
    await conn.textOptions(m.chat, msg, config.media.image.denied, [['.daftar', 'Register']], m);
    return;
  }
  await conn.sendMessage(
    m.chat,
    {
      text: `🚫 *ACCESS DENIED*\n\n${msg}`,
    },
    {
      quoted: m,
    }
  );
}
