import { pickRandom } from '#lib/utils/helper';
let hikari = async (m, { conn }) => {
  m.reply(`"${pickRandom(quotes)}"`);
};
hikari.help = ['quotes'];
hikari.command = /^(quotes|katabijak)$/i;
export default hikari;
const quotes = [
  'Belief is a knowledge within the heart, far beyond the reach of proof.',
  'Happiness and unhappiness do not come from what you have, nor from who you are, nor from what you do. Happiness and unhappiness come from your mind.',
  'The pain of struggle is only temporary. You may feel it for a minute, an hour, a day, or a year. But if you give up, that pain will last forever.',
  'Only someone who is afraid can act brave. Without that fear, nothing can be called courage.',
  'Be yourself. Who else could do it better than you?',
  'Your chance to succeed in any situation can always be measured by how much you believe in yourself.',
  'Our greatest glory is not in never failing, but in rising every time we fall.',
  'A task that is never finished is a task that was never started.',
  'Your mind is like a fire that needs to be lit, not a vessel waiting to be filled.',
  'Honesty is the cornerstone of all success. Acknowledgment is the strongest motivation. Even criticism can build confidence when tucked between praise.',
  'Everything has an ending. Let what has ended pass, and trust that everything will be alright.',
  'Every second is precious because time knows many things, including the secrets of the heart.',
  "If you can't find the book you're looking for on the shelf, then write your own.",
  'If your heart aches a lot, learn from that pain not to cause pain to others.',
  "Life isn't always about a partner.",
  'Home is not just a place, it is a feeling.',
  'Which would you choose: the one who dreams of success or the one who makes it a reality?',
  'You may not be able to water a withered flower and hope it blooms again, but you can plant a new flower with better hope than before.',
  'It is not happiness that makes us grateful, but gratitude that makes our lives happy.',
  'I may be silent. But I am not blind.',
];
