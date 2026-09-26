import { db } from '#src/database';
export async function before(m) {
  if (!this.verif) this.verif = {};
  if (m.isBaileys || m.fromMe) return;
  if (!(m.sender in this.verif)) return;
  setTimeout(() => {
    if (this.verif[m.sender] && Date.now() - this.verif[m.sender].lastCode > 180000)
      delete this.verif[m.sender];
  }, 180000);
  let user = db.data.users;
  let bot = db.data.bots.users;
  let setting = db.data.settings[this.user.jid];
  if (this.verif[m.sender].codeEmail && m.text.trim() === this.verif[m.sender].codeEmail) {
    if (setting.autoread) await this.readMessages([m.key]);
    if (setting.composing) await this.sendPresenceUpdate('composing', m.chat);
    if (Date.now() - this.verif[m.sender].lastCode > 180000) {
      return m.reply('Verification code has expired!');
    }
    if (this.verif[m.sender].login) {
      let dataUser = Object.keys(user).find(
        (v) => user[v].email == this.verif[m.sender].login && user[v].verif
      );
      let dataBot = Object.keys(bot).find((v) => bot[this.verif[m.sender].login]);
      if (dataUser) {
        user[m.sender] = user[dataUser];
        delete user[dataUser];
      } else if (dataBot) {
        user[m.sender] = bot[dataBot];
        delete bot[dataBot];
      }
      m.reply('Login successful! Email verified and account transferred successfully.');
      delete this.verif[m.sender];
    } else {
      m.reply(`Email verified!\nYour chat limit is now 1000`);
      user[m.sender].commandLimit = 1000;
      user[m.sender].verif = true;
    }
    delete this.verif[m.sender];
  }
}
