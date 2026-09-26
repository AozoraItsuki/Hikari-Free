import { db } from '#src/database';
let handler = async (m, { conn }) => {
  let user = db.data.users[m.sender];
  if (!user) return;
  if (!user.titleCollection) user.titleCollection = [];
  let titles = user.titleCollection;
  let newTitles = [];
  let messages = [];
  const titlesToCheck = [
    {
      condition: user.skata >= 1000,
      title: 'SkataMaster',
      message: `Your Skata MMR has reached *1000*!\nAs a reward, you get the title:\n\n🏆 *SkataMaster*`,
    },
    {
      condition: user.skata >= 2000,
      title: 'God of Skata',
      message: `Your Skata MMR has reached *2000*!\nYou are now worthy of the Title *God of Skata*`,
    },
    {
      condition: user.money >= 1000000,
      title: 'Career Starter',
      message: `Your total money has reached *1 million*\nYou earned the Title: *Career Starter*\nThis is the beginning of your journey to success!\n\n*KEEP GOING, PIONEER!*`,
    },
    {
      condition: user.money >= 5000000,
      title: 'Young Entrepreneur',
      message: `Your total money has reached *5 million*\nYou earned the Title: *Young Entrepreneur*\nYou have opened the doors of success even wider!\n\nKeep fighting and never give up! 😉`,
    },
    {
      condition: user.money >= 10000000,
      title: 'Rising Tycoon',
      message: `Your total money has reached *10 million*\nYou earned the Title: *Rising Tycoon*\nYou are getting closer to even greater success!\n\nKeep working hard and be an inspiration to others! 💪`,
    },
    {
      condition: user.money >= 50000000,
      title: 'Business Mogul',
      message: `Your total money has reached *50 million*\nYou earned the Title: *Business Mogul*\nYou have proven yourself as a great entrepreneur!\n\nKeep innovating and become a legend in the business world! 🚀`,
    },
    {
      condition: user.money >= 100000000,
      title: 'Empire Builder',
      message: `Your total money has reached *100 million*\nYou earned the Title: *Empire Builder*\nYou are no longer just an entrepreneur, but building your own business empire! 👑`,
    },
    {
      condition: user.money >= 500000000,
      title: 'Legendary Tycoon',
      message: `Your total money has reached *500 million*\nYou earned the Title: *Legendary Tycoon*\nYou have reached legendary level in the business world!\n\nNow, people know your name as an inspiration of success! 🔥`,
    },
    {
      condition: user.money >= 1000000000,
      title: 'The Ultimate Visionary',
      message: `🎉 Congratulations to *${m.pushName}*! 🎉\n\nYour total money has reached *1 Billion*! 💰\nYou earned the Title: *The Ultimate Visionary* 🔥\n\nYou are not just a successful entrepreneur, but also a visionary changing the world! 🌍\n\nYour big dream has come true. Keep creating innovations and leave a lasting mark in history! 🚀`,
    },
    {
      condition: user.money >= 100000000000,
      title: 'God of Business',
      message: `👑 *${m.pushName}, The Business Ruler!* 👑\n\nYour total money has reached *100 Billion*! 💎\nYou earned the Title: *GOD OF BUSINESS* ⚡\n\nYou have reached the highest peak in the business world! 💰🔥\n\nThe world now sees you as a living legend. Keep making history and inspire future generations! 🚀`,
    },
    {
      condition: user.level >= 50,
      title: 'Pro Leveling',
      message: `Your level has reached *50*!\nYou are now considered an experienced player and get the title:\n\n🏆 *Pro Leveling*`,
    },
    {
      condition: user.level >= 100,
      title: 'God Leveling',
      message: `You have reached *level 100*!\nNot many can reach this stage, and as a reward, you get the title:\n\n🏆 *God Leveling*`,
    },
    {
      condition: user.level >= 500,
      title: 'Heavenly Demon',
      message: `nYou have reached *level 500*! This is a very high level and almost impossible to achieve.\n\nThat's why you get the title *Heavenly Demon* 🏆\n\nFrom here, your journey as a human has ended! 🫡`,
    },
    {
      condition: user.level >= 1000,
      title: 'Heavenly Immortal',
      message: `🌌 *${m.pushName}, The Immortal Being!* 🌌\n\nYou have reached *Level 1000*! ⚡\nYou earned the Title: *HEAVENLY IMMORTAL* 🏆\n\nYou are no longer an ordinary human, but have achieved immortality in legend! 🔥\n\nThe world admires your existence. Become a legend that will be remembered forever! ⚔️`,
    },
  ];
  for (let { condition, title, message } of titlesToCheck) {
    if (condition && !titles.includes(title)) {
      titles.push(title);
      newTitles.push(title);
      messages.push(message);
    }
  }
  if (newTitles.length > 0) {
    let userMessage = `🎉 *Congratulations!* 🎉\n\n` + messages.join('\n\n');
    await conn.sendMessage(
      m.sender,
      {
        text: userMessage,
      },
      {
        quoted: m,
      }
    );
  }
};
handler.before = handler;
export default handler;
