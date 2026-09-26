import {
  GAME_IMAGES,
  ROLE_CONFIG,
  GAME_PHASES,
  getSession,
  changeGamePhase,
  setPlayersSkillStatus,
  sortPlayersByNumber,
  processNightKills,
  generateDayMessage,
  resetNightActions,
  resetPlayerEffects,
  setVotingPhase,
  toggleVotingStatus,
  resetVotes,
  getVotingResult,
  executeVoting,
  checkWinCondition,
  sleep,
  resize,
} from '#lib/utils/werewolf';
const generateRoleInstructions = (role) => {
  const instructions = {
    werewolf: {
      title: 'Werewolf',
      description: 'You are a bloodthirsty werewolf. Choose a target to devour tonight.',
      action: '.wwpc kill number - to kill a player',
    },
    seer: {
      title: 'Seer',
      description: "You have the ability to see other players' roles.",
      action: ".wwpc dreamy number - to view a player's role",
    },
    guardian: {
      title: 'Guardian Angel',
      description: 'You can protect one player from the attack tonight.',
      action: '.wwpc deff number - to protect a player',
    },
    witch: {
      title: 'Witch',
      description: 'You have a healing potion and a poison. Use them wisely.',
      action: '.wwpc heal number - to heal a target\n.wwpc poison number - to poison a target',
    },
    hunter: {
      title: 'Hunter',
      description: 'If you die, you can take revenge by killing one player.',
      action: '.wwpc revenge number - to take revenge (only when dead)',
    },
    sorcerer: {
      title: 'Dark Sorcerer',
      description: "You are the werewolf's ally who can see players' identities.",
      action: ".wwpc sorcerer number - to view a player's role",
    },
    detective: {
      title: 'Detective',
      description: 'You can investigate players and see who they visited.',
      action: '.wwpc investigate number - to investigate a player',
    },
    cupid: {
      title: 'Cupid',
      description: 'You can make two players fall in love. If one dies, the other dies too.',
      action: '.wwpc link number1 number2 - to link two players',
    },
    mayor: {
      title: 'Mayor',
      description: 'Your vote counts double. You can also reveal your identity at any time.',
      action: '.wwpc reveal - to reveal your identity as the mayor',
    },
    fool: {
      title: 'Fool',
      description: 'If you are executed during voting, you win alone!',
      action: 'No special action - survive or win when executed',
    },
    alpha: {
      title: 'Alpha Werewolf',
      description: 'You are the werewolf leader with a special power.',
      action: '.wwpc alpha number - to turn a player into a werewolf',
    },
    warga: {
      title: 'Villager',
      description: 'You are a regular villager. Use voting to get rid of the werewolf.',
      action: 'Discuss and vote during the day',
    },
  };
  return (
    instructions[role] || {
      title: 'Unknown',
      description: '',
      action: '',
    }
  );
};
async function dayPhase(conn, roomData, data) {
  setPlayersSkillStatus(roomData.room, false, data);
  const mentions = roomData.player.map((p) => p.id);
  sortPlayersByNumber(roomData.room, data);
  const actualKills = processNightKills(roomData.room, data);
  sortPlayersByNumber(roomData.room, data);
  changeGamePhase(roomData.room, data);
  const dayMessage = generateDayMessage(roomData);
  return await conn.adReply(
    roomData.room,
    dayMessage,
    'W E R E W O L F',
    '',
    await resize(GAME_IMAGES.thumb1, 300, 175),
    false
  );
}
async function votingPhase(conn, roomData, data) {
  toggleVotingStatus(roomData.room, true, data);
  let playerList = '';
  const mentions = [];
  sortPlayersByNumber(roomData.room, data);
  roomData.player.forEach((player) => {
    const statusIcon = player.isdead ? ' ☠️' : '';
    const mayorIcon = player.role === 'mayor' && roomData.mayorRevealed ? ' 👨‍💼' : '';
    playerList += `(${player.number}) @${player.id.replace('@s.whatsapp.net', '')}${statusIcon}${mayorIcon}\n`;
    mentions.push(player.id);
  });
  const votingMessage = `⌂ W E R E W O L F - G A M E\n\nDusk has arrived. All the villagers gather at the village hall to choose who will be executed. Some villagers look busy preparing torture tools for tonight. You have 90 seconds to vote! Watch out, there is a traitor among you!\n\nL I S T - P L A Y E R:\n${playerList}\nType .ww vote number to vote for a player`;
  setVotingPhase(roomData.room, data);
  resetNightActions(roomData.room, data);
  resetPlayerEffects(roomData.room, data);
  return await conn.adReply(
    roomData.room,
    votingMessage,
    'W E R E W O L F',
    '',
    await resize(GAME_IMAGES.thumb2, 300, 175),
    false
  );
}
async function nightPhase(conn, roomData, data) {
  const voteResult = getVotingResult(roomData.room, data);
  let nightMessage = '';
  if (voteResult.type === 'no_votes') {
    nightMessage = `*⌂ W E R E W O L F - G A M E*\n\nToo indecisive to make a choice. The villagers head back to their homes, no one was executed today. The moon shines bright, a chilling night has come. Hopefully no one dies tonight. Night players: you have 90 seconds to act!`;
  } else if (voteResult.type === 'tie') {
    nightMessage = `*⌂ W E R E W O L F - G A M E*\n\nThe villagers have voted, but the result is a tie.\n\nThe stars shine beautifully tonight, the villagers rest in their homes. Night players: you have 90 seconds to act!`;
  } else if (voteResult.type === 'executed') {
    const executedPlayer = voteResult.player;
    executedPlayer.killedByVoting = true;
    executeVoting(roomData.room, data);
    if (executedPlayer.role === 'werewolf' || ROLE_CONFIG[executedPlayer.role]?.team === 'evil') {
      nightMessage = `*⌂ W E R E W O L F - G A M E*\n\nThe villagers have voted and agreed to execute @${executedPlayer.id.replace('@s.whatsapp.net', '')}.\n\n@${executedPlayer.id.replace('@s.whatsapp.net', '')} was ${executedPlayer.role} ${ROLE_CONFIG[executedPlayer.role]?.emoji || ''}`;
    } else {
      nightMessage = `*⌂ W E R E W O L F - G A M E*\n\nThe villagers have voted and agreed to execute @${executedPlayer.id.replace('@s.whatsapp.net', '')}.\n\n@${executedPlayer.id.replace('@s.whatsapp.net', '')} was ${executedPlayer.role} ${ROLE_CONFIG[executedPlayer.role]?.emoji || ''}\n\nThe moon shines bright tonight, the villagers rest in their homes. Night players: you have 90 seconds to act!`;
    }
  }
  await conn.adReply(
    roomData.room,
    nightMessage,
    'W E R E W O L F',
    '',
    await resize(GAME_IMAGES.thumb4, 300, 175),
    false
  );
  changeGamePhase(roomData.room, data);
  toggleVotingStatus(roomData.room, false, data);
  resetVotes(roomData.room, data);
  const winCheck = checkWinCondition(roomData.room, data);
  if (winCheck.winner) return await showWinners(roomData, winCheck.winner, conn, data);
}
async function skillPhase(conn, roomData, data) {
  setPlayersSkillStatus(roomData.room, true, data);
  if (checkWinCondition(roomData.room, data).winner) {
    return await showWinners(roomData, checkWinCondition(roomData.room, data).winner, conn, data);
  }
  const mentions = [];
  let playerList = '';
  let evilPlayerList = '';
  sortPlayersByNumber(roomData.room, data);
  roomData.player.forEach((player) => {
    const statusIcon = player.isdead ? ' ☠️' : '';
    playerList += `(${player.number}) @${player.id.replace('@s.whatsapp.net', '')}${statusIcon}\n`;
    if (ROLE_CONFIG[player.role]?.team === 'evil' || player.role === 'sorcerer') {
      evilPlayerList += `(${player.number}) @${player.id.replace('@s.whatsapp.net', '')} ${player.isdead ? ' ☠️' : ` [${player.role}]`}\n`;
    }
    mentions.push(player.id);
  });
  for (const player of roomData.player) {
    if (player.isdead) continue;
    const roleInstructions = generateRoleInstructions(player.role);
    let message = '';
    switch (player.role) {
      case 'werewolf':
      case 'alpha':
        message = `Please choose one person you want to eat tonight\n*LIST PLAYER*:\n${evilPlayerList}\n\n${roleInstructions.action}`;
        break;
      case 'seer':
        message = `Hi ${roleInstructions.title}, ${roleInstructions.description}\n*LIST PLAYER*:\n${playerList}\n\n${roleInstructions.action}`;
        break;
      case 'guardian':
        message = `Hi *${roleInstructions.title}*, ${roleInstructions.description}\n*LIST PLAYER*:\n${playerList}\n\n${roleInstructions.action}`;
        break;
      case 'witch':
        const { heal, poison } = roomData.witchPotions;
        message = `Hi *${roleInstructions.title}*, ${roleInstructions.description}\nPotions left: Heal(${heal}) Poison(${poison})\n*LIST PLAYER*:\n${playerList}\n\n${roleInstructions.action}`;
        break;
      case 'detective':
        message = `Hi *${roleInstructions.title}*, ${roleInstructions.description}\n*LIST PLAYER*:\n${playerList}\n\n${roleInstructions.action}`;
        break;
      case 'cupid':
        if (roomData.day === 0) {
          message = `Hi *${roleInstructions.title}*, ${roleInstructions.description}\n*LIST PLAYER*:\n${playerList}\n\n${roleInstructions.action}`;
        } else {
          message = `*⌂ W E R E W O L F - G A M E*\n\nAs Cupid, your task is done. Rest well.\n*LIST PLAYER*:\n${playerList}`;
        }
        break;
      case 'sorcerer':
        message = `Hi *${roleInstructions.title}*, ${roleInstructions.description}\n*LIST PLAYER*:\n${evilPlayerList}\n\n${roleInstructions.action}`;
        break;
      case 'warga':
      case 'mayor':
      case 'fool':
        message = `*⌂ W E R E W O L F - G A M E*\n\nAs a ${roleInstructions.title}, ${roleInstructions.description}\n*LIST PLAYER*:\n${playerList}`;
        break;
      case 'hunter':
        if (player.needsRevenge) {
          message = `You have died! As a *${roleInstructions.title}*, you can take revenge.\n*LIST PLAYER*:\n${playerList}\n\n${roleInstructions.action}`;
        } else {
          message = `*⌂ W E R E W O L F - G A M E*\n\nAs a *${roleInstructions.title}*, ${roleInstructions.description}\n*LIST PLAYER*:\n${playerList}`;
        }
        break;
    }
    if (message) {
      await conn.sendMessage(player.id, {
        text: message,
        mentions: mentions,
      });
    }
  }
}
async function showWinners(roomData, winner, conn, data) {
  const roomId = roomData.room;
  let winMessage = '';
  const winners = [];
  if (winner === 'evil') {
    winMessage = '*W E R E W O L F - W I N*\n\nTEAM WEREWOLF WINS!\n\n';
    roomData.player.forEach((player) => {
      if (ROLE_CONFIG[player.role]?.team === 'evil') {
        winMessage += `${player.number}) @${player.id.replace('@s.whatsapp.net', '')}\n     *Role*: ${player.role} ${ROLE_CONFIG[player.role]?.emoji}\n\n`;
        winners.push(player.id);
      }
    });
  } else if (winner === 'good') {
    winMessage = '*T E A M - W A R G A - W I N*\n\nTEAM WARGA WINS!\n\n';
    roomData.player.forEach((player) => {
      if (ROLE_CONFIG[player.role]?.team === 'good') {
        winMessage += `${player.number}) @${player.id.replace('@s.whatsapp.net', '')}\n     *Role*: ${player.role} ${ROLE_CONFIG[player.role]?.emoji}\n\n`;
        winners.push(player.id);
      }
    });
  } else if (winner === 'fool') {
    const fool = roomData.player.find((p) => p.role === 'fool' && p.killedByVoting);
    winMessage = '*F O O L - W I N S*\n\nTHE FOOL WINS ALONE!\n\n';
    if (fool) {
      winMessage += `${fool.number}) @${fool.id.replace('@s.whatsapp.net', '')}\n     *Role*: fool 🤡\n\n`;
      winners.push(fool.id);
    }
  } else if (winner === 'lovers') {
    winMessage = '*L O V E R S - W I N*\n\nTHE LOVERS WIN!\n\n';
    roomData.lovers.forEach((loverNumber) => {
      const lover = roomData.player.find((p) => p.number === loverNumber);
      if (lover) {
        winMessage += `${lover.number}) @${lover.id.replace('@s.whatsapp.net', '')}\n     *Role*: ${lover.role} ${ROLE_CONFIG[lover.role]?.emoji}\n\n`;
        winners.push(lover.id);
      }
    });
  }
  const thumbImage = winner === 'evil' ? GAME_IMAGES.thumb5 : GAME_IMAGES.thumb6;
  await conn.adReply(
    roomId,
    winMessage,
    'W E R E W O L F',
    '',
    await resize(thumbImage, 300, 175),
    false
  );
  delete data[roomId];
}
async function gameLoop(conn, roomId, data, startPhase = GAME_PHASES.NIGHT) {
  let currentPhase = startPhase;
  while (true) {
    const winCheck = checkWinCondition(roomId, data);
    if (winCheck.winner) {
      await showWinners(getSession(roomId, data), winCheck.winner, conn, data);
      break;
    }
    const roomData = getSession(roomId, data);
    if (!roomData) break;
    switch (currentPhase) {
      case GAME_PHASES.VOTING:
        await votingPhase(conn, roomData, data);
        await sleep(90000);
        currentPhase = GAME_PHASES.NIGHT;
        break;
      case GAME_PHASES.NIGHT:
        await nightPhase(conn, roomData, data);
        await sleep(90000);
        currentPhase = GAME_PHASES.SKILLS;
        break;
      case GAME_PHASES.SKILLS:
        await skillPhase(conn, roomData, data);
        await sleep(90000);
        currentPhase = GAME_PHASES.DAY;
        break;
      case GAME_PHASES.DAY:
        await dayPhase(conn, roomData, data);
        await sleep(90000);
        currentPhase = GAME_PHASES.VOTING;
        break;
    }
    const finalWinCheck = checkWinCondition(roomId, data);
    if (finalWinCheck.winner) {
      await showWinners(getSession(roomId, data), finalWinCheck.winner, conn, data);
      break;
    }
  }
}
async function startVotingLoop(conn, roomId, data) {
  return await gameLoop(conn, roomId, data, GAME_PHASES.VOTING);
}
async function startNightLoop(conn, roomId, data) {
  return await gameLoop(conn, roomId, data, GAME_PHASES.NIGHT);
}
async function startDayLoop(conn, roomId, data) {
  return await gameLoop(conn, roomId, data, GAME_PHASES.DAY);
}
export {
  generateRoleInstructions,
  dayPhase,
  votingPhase,
  nightPhase,
  skillPhase,
  showWinners,
  gameLoop,
  startVotingLoop,
  startNightLoop,
  startDayLoop,
};
