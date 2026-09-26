import toMs from 'ms';
import * as jimp from 'jimp';
const GAME_IMAGES = {
  thumb1:
    'https://user-images.githubusercontent.com/72728486/235344562-4677d2ad-48ee-419d-883f-e0ca9ba1c7b8.jpg',
  thumb2:
    'https://user-images.githubusercontent.com/72728486/235344861-acdba7d1-8fce-41b8-adf6-337c818cda2b.jpg',
  thumb3:
    'https://user-images.githubusercontent.com/72728486/235316834-f9f84ba0-8df3-4444-81d8-db5270995e6d.jpg',
  thumb4:
    'https://user-images.githubusercontent.com/72728486/235354619-6ad1cabd-216c-4c7c-b7c2-3a564836653a.jpg',
  thumb5:
    'https://user-images.githubusercontent.com/72728486/235365156-cfab66ce-38b2-4bc7-90d7-7756fc320e06.jpg',
  thumb6:
    'https://user-images.githubusercontent.com/72728486/235365148-35b8def7-c1a2-451d-a2f2-6b6a911b37db.jpg',
};
const ROLE_CONFIG = {
  werewolf: {
    emoji: '🐺',
    team: 'evil',
    hasNightAction: true,
  },
  seer: {
    emoji: '👁️',
    team: 'good',
    hasNightAction: true,
  },
  guardian: {
    emoji: '👼',
    team: 'good',
    hasNightAction: true,
  },
  warga: {
    emoji: '👱‍♂️',
    team: 'good',
    hasNightAction: false,
  },
  sorcerer: {
    emoji: '🔮',
    team: 'evil',
    hasNightAction: true,
  },
  witch: {
    emoji: '🧙‍♀️',
    team: 'good',
    hasNightAction: true,
  },
  hunter: {
    emoji: '🏹',
    team: 'good',
    hasNightAction: false,
  },
  cupid: {
    emoji: '💘',
    team: 'neutral',
    hasNightAction: true,
  },
  detective: {
    emoji: '🕵️',
    team: 'good',
    hasNightAction: true,
  },
  mayor: {
    emoji: '👨‍💼',
    team: 'good',
    hasNightAction: false,
  },
  fool: {
    emoji: '🤡',
    team: 'neutral',
    hasNightAction: false,
  },
  alpha: {
    emoji: '🌕',
    team: 'evil',
    hasNightAction: true,
  },
};
const GAME_PHASES = {
  NIGHT: 'malam',
  DAY: 'pagi',
  VOTING: 'voting',
  SKILLS: 'skills',
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const resize = async (image, width, height) => {
  try {
    const read = await jimp.read(image);
    const data = await read.resize(width, height).getBufferAsync(jimp.MIME_JPEG);
    return data;
  } catch (error) {
    console.error('Image resize error:', error);
    return null;
  }
};
const findObject = (obj = {}, key, value) => {
  const result = [];
  const recursiveSearch = (obj = {}) => {
    if (!obj || typeof obj !== 'object') return;
    if (obj[key] === value) result.push(obj);
    Object.keys(obj).forEach((k) => recursiveSearch(obj[k]));
  };
  recursiveSearch(obj);
  return result;
};
const getSession = (from, data) => {
  return data[from] || false;
};
const isPlayerInAnyGame = (playerId, data) => {
  return findObject(data, 'id', playerId).length > 0;
};
const isPlayerInRoom = (playerId, roomId, data) => {
  const result = findObject(data, 'id', playerId);
  return result.length > 0 && result[0].sesi === roomId;
};
const getPlayerData = (playerId, data) => {
  const result = findObject(data, 'id', playerId);
  return result.length > 0 ? result[0] : false;
};
const getPlayerByNumber = (playerNumber, data) => {
  const result = findObject(data, 'number', playerNumber);
  return result.length > 0 ? result[0] : false;
};
const removePlayerFromRoom = (roomId, playerId, data) => {
  const room = getSession(roomId, data);
  if (!room) return false;
  const playerIndex = room.player.findIndex((p) => p.id === playerId);
  if (playerIndex !== -1) {
    room.player.splice(playerIndex, 1);
    room.player.forEach((p, index) => (p.number = index + 1));
  }
  return true;
};
const getPlayerByNumberInRoom = (roomId, playerId, playerNumber, data) => {
  const room = getSession(roomId, data);
  if (!room) return false;
  const playerIndex = room.player.findIndex((p) => p.number === playerNumber);
  if (playerIndex === -1) return false;
  return {
    index: playerIndex,
    room: roomId,
    data: room.player[playerIndex],
  };
};
const getPlayerByNumberForSender = (senderId, playerNumber, data) => {
  const senderData = findObject(data, 'id', senderId);
  if (senderData.length === 0) return false;
  const roomId = senderData[0].sesi;
  return getPlayerByNumberInRoom(roomId, senderId, playerNumber, data);
};
const executeWerewolfKill = (senderId, targetNumber, data) => {
  const result = getPlayerByNumberForSender(senderId, targetNumber, data);
  if (!result) return false;
  const { index, room, data: targetData } = result;
  const gameRoom = getSession(room, data);
  if (!targetData.effect.includes('protected')) {
    gameRoom.nightKills.push(targetNumber);
  }
  return true;
};
const executeSeerVision = (senderId, targetNumber, data) => {
  const result = getPlayerByNumberForSender(senderId, targetNumber, data);
  if (!result) return false;
  const { room, data: targetData } = result;
  const gameRoom = getSession(room, data);
  if (ROLE_CONFIG[targetData.role]?.team === 'evil') {
    gameRoom.seerFound = true;
  }
  return {
    role: targetData.role,
    team: ROLE_CONFIG[targetData.role]?.team || 'unknown',
  };
};
const executeGuardianProtect = (senderId, targetNumber, data) => {
  const result = getPlayerByNumberForSender(senderId, targetNumber, data);
  if (!result) return false;
  const { index, room } = result;
  const gameRoom = getSession(room, data);
  gameRoom.player[index].effect.push('protected');
  gameRoom.protectedPlayers.push(targetNumber);
  return true;
};
const executeWitchAction = (senderId, action, targetNumber, data) => {
  const senderData = getPlayerData(senderId, data);
  if (!senderData || senderData.role !== 'witch') return false;
  const room = getSession(senderData.sesi, data);
  if (!room) return false;
  if (action === 'heal' && room.witchPotions.heal > 0) {
    const killIndex = room.nightKills.indexOf(targetNumber);
    if (killIndex !== -1) {
      room.nightKills.splice(killIndex, 1);
      room.witchPotions.heal--;
      return {
        success: true,
        action: 'healed',
      };
    }
  } else if (action === 'poison' && room.witchPotions.poison > 0) {
    room.nightKills.push(targetNumber);
    room.witchPotions.poison--;
    return {
      success: true,
      action: 'poisoned',
    };
  }
  return {
    success: false,
    reason: 'invalid_action',
  };
};
const executeHunterRevenge = (hunterId, targetNumber, data) => {
  const hunterData = getPlayerData(hunterId, data);
  if (!hunterData) return false;
  const room = getSession(hunterData.sesi, data);
  if (!room) return false;
  const targetIndex = room.player.findIndex((p) => p.number === targetNumber);
  if (targetIndex !== -1) {
    room.player[targetIndex].isdead = true;
    room.hunterKill = targetNumber;
    return true;
  }
  return false;
};
const executeCupidLink = (senderId, target1, target2, data) => {
  const result1 = getPlayerByNumberForSender(senderId, target1, data);
  const result2 = getPlayerByNumberForSender(senderId, target2, data);
  if (!result1 || !result2) return false;
  const room = getSession(result1.room, data);
  if (!room) return false;
  room.lovers = [target1, target2];
  room.player[result1.index].effect.push('lover');
  room.player[result2.index].effect.push('lover');
  return true;
};
const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};
const assignRole = (roomId, playerId, role, data) => {
  const room = getSession(roomId, data);
  if (!room) return false;
  const playerIndex = room.player.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) return false;
  room.player[playerIndex].role = role;
  return true;
};
const calculateRoleDistribution = (playerCount) => {
  const distributions = {
    5: {
      werewolf: 1,
      seer: 1,
      guardian: 1,
      warga: 2,
    },
    6: {
      werewolf: 1,
      seer: 1,
      guardian: 1,
      witch: 1,
      warga: 2,
    },
    7: {
      werewolf: 2,
      seer: 1,
      guardian: 1,
      warga: 3,
    },
    8: {
      werewolf: 2,
      seer: 1,
      guardian: 1,
      hunter: 1,
      warga: 3,
    },
    9: {
      werewolf: 2,
      seer: 1,
      guardian: 1,
      sorcerer: 1,
      warga: 4,
    },
    10: {
      werewolf: 2,
      seer: 1,
      guardian: 1,
      witch: 1,
      hunter: 1,
      warga: 4,
    },
    11: {
      werewolf: 2,
      seer: 1,
      guardian: 1,
      detective: 1,
      cupid: 1,
      warga: 5,
    },
    12: {
      werewolf: 2,
      seer: 1,
      guardian: 2,
      witch: 1,
      hunter: 1,
      warga: 5,
    },
    13: {
      werewolf: 3,
      seer: 1,
      guardian: 1,
      sorcerer: 1,
      detective: 1,
      warga: 6,
    },
    14: {
      werewolf: 3,
      seer: 1,
      guardian: 1,
      witch: 1,
      hunter: 1,
      mayor: 1,
      warga: 6,
    },
    15: {
      werewolf: 3,
      seer: 1,
      guardian: 2,
      sorcerer: 1,
      detective: 1,
      fool: 1,
      warga: 6,
    },
    16: {
      werewolf: 3,
      seer: 1,
      guardian: 1,
      witch: 1,
      hunter: 1,
      alpha: 1,
      cupid: 1,
      mayor: 1,
      warga: 6,
    },
  };
  return distributions[playerCount] || distributions[15];
};
const distributeRoles = (roomId, data) => {
  const room = getSession(roomId, data);
  if (!room) return false;
  const roleDistribution = calculateRoleDistribution(room.player.length);
  const availablePlayers = [...room.player];
  Object.entries(roleDistribution).forEach(([role, count]) => {
    for (let i = 0; i < count; i++) {
      const eligiblePlayers = availablePlayers.filter((p) => !p.role);
      if (eligiblePlayers.length === 0) return;
      const shuffled = shuffleArray(eligiblePlayers);
      const selectedPlayer = shuffled[0];
      assignRole(roomId, selectedPlayer.id, role, data);
    }
  });
  sortPlayersByNumber(roomId, data);
  return true;
};
const addGameTimer = (roomId, seconds, data) => {
  const room = getSession(roomId, data);
  if (!room) return false;
  room.cooldown = Date.now() + toMs(`${seconds}s`);
  return true;
};
const startGameSession = (roomId, data) => {
  const room = getSession(roomId, data);
  if (!room) return false;
  room.status = true;
  return true;
};
const changeGamePhase = (roomId, data) => {
  const room = getSession(roomId, data);
  if (!room) return false;
  switch (room.time) {
    case GAME_PHASES.DAY:
      room.time = GAME_PHASES.VOTING;
      break;
    case GAME_PHASES.NIGHT:
      room.time = GAME_PHASES.DAY;
      room.day += 1;
      break;
    case GAME_PHASES.VOTING:
      room.time = GAME_PHASES.NIGHT;
      break;
    case GAME_PHASES.SKILLS:
      room.time = GAME_PHASES.DAY;
      break;
  }
  return true;
};
const setVotingPhase = (roomId, data) => {
  const room = getSession(roomId, data);
  if (!room) return false;
  room.time = GAME_PHASES.VOTING;
  return true;
};
const castVote = (roomId, targetNumber, voterId, data) => {
  const room = getSession(roomId, data);
  if (!room) return false;
  const voterIndex = room.player.findIndex((p) => p.id === voterId);
  if (voterIndex === -1) return false;
  const targetIndex = room.player.findIndex((p) => p.number === targetNumber);
  if (targetIndex === -1) return false;
  if (room.player[voterIndex].isvote) return false;
  room.player[voterIndex].isvote = true;
  if (room.player[voterIndex].role === 'mayor') {
    room.player[targetIndex].vote += 2;
  } else {
    room.player[targetIndex].vote += 1;
  }
  return true;
};
const getVotingResult = (roomId, data) => {
  const room = getSession(roomId, data);
  if (!room) return false;
  const sortedPlayers = [...room.player].sort((a, b) => b.vote - a.vote);
  if (sortedPlayers[0].vote === 0)
    return {
      type: 'no_votes',
    };
  if (sortedPlayers.length > 1 && sortedPlayers[0].vote === sortedPlayers[1].vote) {
    return {
      type: 'tie',
    };
  }
  return {
    type: 'executed',
    player: sortedPlayers[0],
  };
};
const executeVoting = (roomId, data) => {
  const result = getVotingResult(roomId, data);
  if (result.type === 'executed') {
    const room = getSession(roomId, data);
    const playerIndex = room.player.findIndex((p) => p.number === result.player.number);
    if (playerIndex !== -1) {
      room.player[playerIndex].isdead = true;
      if (result.player.role === 'hunter') {
        room.hunterRevenge = result.player.number;
      }
      if (result.player.effect.includes('lover')) {
        const loverNumber = room.lovers.find((l) => l !== result.player.number);
        if (loverNumber) {
          const loverIndex = room.player.findIndex((p) => p.number === loverNumber);
          if (loverIndex !== -1) {
            room.player[loverIndex].isdead = true;
          }
        }
      }
    }
  }
  return result;
};
const resetVotes = (roomId, data) => {
  const room = getSession(roomId, data);
  if (!room) return false;
  room.player.forEach((p) => {
    p.vote = 0;
    p.isvote = false;
  });
  return true;
};
const toggleVotingStatus = (roomId, status, data) => {
  const room = getSession(roomId, data);
  if (!room) return false;
  room.voting = status;
  return true;
};
const resetNightActions = (roomId, data) => {
  const room = getSession(roomId, data);
  if (!room) return false;
  room.nightKills = [];
  room.seerFound = false;
  room.protectedPlayers = [];
  room.voting = false;
  return true;
};
const resetPlayerEffects = (roomId, data) => {
  const room = getSession(roomId, data);
  if (!room) return false;
  room.player.forEach((p) => (p.effect = []));
  return true;
};
const setPlayersSkillStatus = (roomId, status, data) => {
  const room = getSession(roomId, data);
  if (!room) return false;
  room.player.forEach((p) => (p.status = status));
  return true;
};
const countAlivePlayers = (roomData) => {
  return roomData.player.filter((p) => !p.isdead).length;
};
const countDeadPlayers = (roomData) => {
  return roomData.player.filter((p) => p.isdead).length;
};
const countAliveByTeam = (roomData) => {
  const alive = roomData.player.filter((p) => !p.isdead);
  const evil = alive.filter((p) => ROLE_CONFIG[p.role]?.team === 'evil').length;
  const good = alive.filter((p) => ROLE_CONFIG[p.role]?.team === 'good').length;
  const neutral = alive.filter((p) => ROLE_CONFIG[p.role]?.team === 'neutral').length;
  return {
    evil,
    good,
    neutral,
    total: alive.length,
  };
};
const checkWinCondition = (roomId, data) => {
  const room = getSession(roomId, data);
  if (!room) return false;
  const teams = countAliveByTeam(room);
  if (room.voting) {
    const voteResult = getVotingResult(roomId, data);
    if (voteResult.type === 'executed') {
      const playerTeam = ROLE_CONFIG[voteResult.player.role]?.team;
      if (playerTeam === 'evil') teams.evil--;
      else if (playerTeam === 'good') teams.good--;
      else if (playerTeam === 'neutral') teams.neutral--;
    }
  }
  if (teams.evil === 0) {
    room.iswin = 'good';
    return {
      voting: room.voting,
      winner: 'good',
    };
  }
  if (teams.evil >= teams.good) {
    room.iswin = 'evil';
    return {
      voting: room.voting,
      winner: 'evil',
    };
  }
  const fool = room.player.find((p) => p.role === 'fool' && p.isdead && p.killedByVoting);
  if (fool) {
    room.iswin = 'fool';
    return {
      voting: room.voting,
      winner: 'fool',
    };
  }
  return {
    voting: room.voting,
    winner: null,
  };
};
const sortPlayersByNumber = (roomId, data) => {
  const room = getSession(roomId, data);
  if (!room) return false;
  room.player.sort((a, b) => a.number - b.number);
  return true;
};
const processNightKills = (roomId, data) => {
  const room = getSession(roomId, data);
  if (!room) return false;
  const actualKills = [];
  room.nightKills.forEach((targetNumber) => {
    const targetIndex = room.player.findIndex((p) => p.number === targetNumber);
    if (targetIndex !== -1 && !room.player[targetIndex].effect.includes('protected')) {
      room.player[targetIndex].isdead = true;
      actualKills.push(targetNumber);
      if (room.player[targetIndex].effect.includes('lover')) {
        const loverNumber = room.lovers.find((l) => l !== targetNumber);
        if (loverNumber) {
          const loverIndex = room.player.findIndex((p) => p.number === loverNumber);
          if (loverIndex !== -1 && !room.player[loverIndex].isdead) {
            room.player[loverIndex].isdead = true;
            actualKills.push(loverNumber);
          }
        }
      }
    }
  });
  return actualKills;
};
const generateDayMessage = (roomData) => {
  const kills = roomData.nightKills || [];
  const _protected = roomData.protectedPlayers || [];
  if (kills.length === 0) {
    return `*⌂ W E R E W O L F - G A M E*\n\nThe sun has risen, no victims fell last night, the villagers go back to their daily routines.\n\n90 seconds left before the decision, the villagers are welcome to discuss\n*Day ${roomData.day}*`;
  }
  let killedText = '';
  let protectedText = '';
  kills.forEach((killNumber, index) => {
    const player = roomData.player.find((p) => p.number === killNumber);
    if (player && !player.effect.includes('protected')) {
      killedText +=
        index === kills.length - 1 && kills.length > 1
          ? ` dan @${player.id.replace('@s.whatsapp.net', '')}`
          : `@${player.id.replace('@s.whatsapp.net', '')}${index < kills.length - 1 ? ', ' : ''}`;
    }
  });
  _protected.forEach((protectNumber, index) => {
    const player = roomData.player.find((p) => p.number === protectNumber);
    if (player) {
      protectedText +=
        index === _protected.length - 1 && _protected.length > 1
          ? ` dan @${player.id.replace('@s.whatsapp.net', '')}`
          : `@${player.id.replace('@s.whatsapp.net', '')}${index < _protected.length - 1 ? ', ' : ''}`;
    }
  });
  return `*⌂ W E R E W O L F - G A M E*\n\nMorning has come, the villagers find ${kills.length > 1 ? 'several' : '1'} corpses in a pile of rubble and scattered blood. ${killedText ? killedText + ' have died! ' : ''}${protectedText ? `${protectedText} were almost killed, but the Guardian Angel managed to protect them.` : ''}\n\nBefore you know it, it is already noon, the sun is right overhead, the scorching heat makes the atmosphere rowdy, the villagers have 90 seconds to discuss\n*Day ${roomData.day}*`;
};
const initializeGameRoom = (roomId, ownerId) => {
  return {
    room: roomId,
    owner: ownerId,
    status: false,
    iswin: null,
    cooldown: null,
    day: 0,
    time: GAME_PHASES.NIGHT,
    player: [],
    nightKills: [],
    voting: false,
    seerFound: false,
    protectedPlayers: [],
    witchPotions: {
      heal: 1,
      poison: 1,
    },
    lovers: [],
    hunterRevenge: null,
    mayorRevealed: false,
    detectiveInvestigations: [],
  };
};
const createPlayer = (playerId, playerNumber, roomId) => {
  return {
    id: playerId,
    number: playerNumber,
    sesi: roomId,
    status: false,
    role: false,
    effect: [],
    vote: 0,
    isdead: false,
    isvote: false,
    killedByVoting: false,
  };
};
export {
  GAME_IMAGES,
  ROLE_CONFIG,
  GAME_PHASES,
  sleep,
  resize,
  findObject,
  getSession,
  isPlayerInAnyGame,
  isPlayerInRoom,
  getPlayerData,
  getPlayerByNumber,
  removePlayerFromRoom,
  getPlayerByNumberInRoom,
  getPlayerByNumberForSender,
  executeWerewolfKill,
  executeSeerVision,
  executeGuardianProtect,
  executeWitchAction,
  executeHunterRevenge,
  executeCupidLink,
  shuffleArray,
  assignRole,
  calculateRoleDistribution,
  distributeRoles,
  addGameTimer,
  startGameSession,
  changeGamePhase,
  setVotingPhase,
  castVote,
  getVotingResult,
  executeVoting,
  resetVotes,
  toggleVotingStatus,
  resetNightActions,
  resetPlayerEffects,
  setPlayersSkillStatus,
  countAlivePlayers,
  countDeadPlayers,
  countAliveByTeam,
  checkWinCondition,
  sortPlayersByNumber,
  processNightKills,
  generateDayMessage,
  initializeGameRoom,
  createPlayer,
};
