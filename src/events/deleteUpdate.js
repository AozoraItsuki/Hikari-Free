import { db } from '#src/database';
export async function deleteUpdate(message) {
  try {
    const { fromMe, id, participant } = message;
    if (fromMe || !participant) return;
    let msg = await this.serializeM(this.loadMessage(id));
    if (!msg) return;
    let chat = db.data.chats[msg.chat] || {};
    if (!chat.antidelete) return;
    await this.reply(
      msg.chat,
      `💬 *AntiDelete Mode On!*\n\nUheee~ @${participant.split`@`[0]} you tried to delete the message but got caught 🤭\nDon't worry, I saved it again so it won't disappear~\n\nIf you want to turn this off:\n> *.disable antidelete* but you need to be an admin firstuuu~~~`,
      msg,
      {
        mentions: [participant],
      }
    );
    await this.copyNForward(msg.chat, msg).catch((e) => console.log(e, msg));
  } catch (e) {
    console.error(e);
  }
}
