import { hkNet } from '#lib/utils/network';
let hikari = async (m, { conn, usedPrefix }) => {
  try {
    let result = await hkNet.get(
      'https://raw.githubusercontent.com/BochilTeam/database/master/kata-kata/dare.json'
    );
    let dare = result.data[Math.floor(Math.random() * result.data.length)];
    m.reply(dare);
  } catch (e) {
    m.reply('Failed to fetch dare data.');
  }
};
hikari.help = ['dare'];
hikari.command = /^(dare)$/i;
export default hikari;
