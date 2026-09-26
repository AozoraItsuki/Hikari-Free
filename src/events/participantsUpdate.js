import config from '#config';
import { db } from '#src/database';
import { welcomeBanner } from '#lib/media/welcomeBanner';
export async function participantsUpdate({ id, participants, action }) {
  console.log({
    id,
    participants,
    action,
  });
  if (config.bot.mode == 'self' || opts['self'] || this.isInit) return;
  const chat = db.data.chats[id] || {};
  if (!chat.welcome && !chat.bye && !chat.detect) return;
  const groupMetadata = await this.groupMetadata(id).catch(() => null);
  if (!groupMetadata) return;
  const groupName = groupMetadata.subject;
  const desc = groupMetadata.desc?.toString() || 'No Description';
  const date = new Date().toLocaleDateString('id', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const createBanner = async (userJid, type) => {
    const name = db.data.users?.[userJid]?.name || (await this.getName(userJid));
    const pp = await this.profilePictureUrl(userJid, 'image').catch(
      () => config.media.image.avatar
    );
    return welcomeBanner(pp, name, groupName, type);
  };
  const processParticipant = async (userLid) => {
    let userJid = userLid.phoneNumber || (await this.resolveJid(userLid.id || userLid, 'pn'));
    if (!userJid) userJid = userLid;
    if (typeof userJid !== 'string') userJid = String(userJid);
    switch (action) {
      case 'add':
        if (chat.welcome) {
          const img = await createBanner(userJid, 'welcome');
          const text = (chat.sWelcome || '👋 Welcome @user to @subject')
            .replace(/@user/g, `@${userJid.split('@')[0] || userJid}`)
            .replace(/@subject/g, groupName)
            .replace(/@desc/g, desc)
            .replace(/@tanggal/g, date);
          await this.adReply(
            id,
            text,
            'WELCOME USER',
            config.watermark,
            img,
            config.website,
            false,
            true
          );
        }
        break;
      case 'remove':
        if (chat.bye) {
          const img = await createBanner(userJid, 'bye');
          const text = (chat.sBye || '👋 Goodbye @user!')
            .replace(/@user/g, `@${userJid.split('@')[0] || userJid}`)
            .replace(/@subject/g, groupName)
            .replace(/@desc/g, desc)
            .replace(/@tanggal/g, date);
          await this.adReply(
            id,
            text,
            'BYE USER',
            config.watermark,
            img,
            config.website,
            false,
            true
          );
        }
        break;
      case 'promote':
        if (chat.detect) {
          const text = (chat.sPromote || '@user is now an admin').replace(
            '@user',
            `@${userJid.split('@')[0] || userJid}`
          );
          await this.reply(id, text, false, {
            mentions: [userJid],
          });
        }
        break;
      case 'demote':
        if (chat.detect) {
          const text = (chat.sDemote || '@user is no longer an admin').replace(
            '@user',
            `@${userJid.split('@')[0] || userJid}`
          );
          await this.reply(id, text, false, {
            mentions: [userJid],
          });
        }
        break;
    }
  };
  await this.insertAllGroup();
  await Promise.all(participants.map(processParticipant));
}
