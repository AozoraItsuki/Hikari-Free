import { db } from '#src/database';
export async function before(m, { conn }) {
  let user = db.data.users;
  let chat = db.data.chats;
  let dataUser = Object.keys(user).filter((v) => {
    let u = user[v];
    return u.banned && u.bannedTime > 0 && u.bannedTime != 17 && Date.now() >= u.bannedTime;
  });
  for (let id of dataUser) {
    user[id].banned = false;
    user[id].bannedTime = 0;
  }
  let dataChat = Object.keys(chat).filter((v) => {
    let c = chat[v];
    return c.isBanned && c.isBannedTime > 0 && c.isBannedTime != 17 && Date.now() >= c.isBannedTime;
  });
  for (let id of dataChat) {
    chat[id].isBanned = false;
    chat[id].isBannedTime = 0;
  }
  for (let number of dataChat) {
    let userChat = chat[number]?.member || {};
    let dataUserChat = Object.keys(userChat).filter((v) => {
      let u = userChat[v];
      return u.banned && u.bannedTime > 0 && u.bannedTime != 17 && Date.now() >= u.bannedTime;
    });
    for (let member of dataUserChat) {
      userChat[member].banned = false;
      userChat[member].bannedTime = 0;
    }
  }
}
