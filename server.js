const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('public'));

// Game states
const GAME_STATES = {
  WAITING: 'WAITING',     // Less than 4 players
  LOBBY: 'LOBBY',         // 4 players, waiting for ready
  PLAYING: 'PLAYING',     // Active game
  GAME_OVER: 'GAME_OVER'  // Show winner, transition to next
};

// Game state
const gameState = {
  state: GAME_STATES.WAITING,
  ball: {
    x: 960,
    y: 540,
    vx: 10,
    vy: 6,
    radius: 20,
    speed: 10
  },
  paddles: {
    left1: { x: 40, y: 170, width: 30, height: 200, team: 'left' },
    left2: { x: 40, y: 710, width: 30, height: 200, team: 'left' },
    right1: { x: 1850, y: 170, width: 30, height: 200, team: 'right' },
    right2: { x: 1850, y: 710, width: 30, height: 200, team: 'right' }
  },
  score: {
    left: 0,
    right: 0
  },
  activePlayers: {},  // { slot: { socketId, ready, nickname } }
  gameWidth: 1920,
  gameHeight: 1080,
  maxScore: 10
};

// Queue system
const playerQueue = []; // Array of { socketId, nickname }
const playerSlots = ['left1', 'right1', 'left2', 'right2']; // Alternate between sides

// Socket ID to player mapping
const socketToPlayer = {}; // { socketId: 'queue' | slot }

// Random player name generator
const PLAYER_NAMES = [
  'DeskWarrior22', 'HRknight_', 'CodeNinja42', 'OfficeHero', 'MeetingSlayer',
  'KeyboardKing', 'MouseMaster', 'ChairChamp', 'CoffeeQueen', 'LunchLegend',
  'EmailExpert', 'SlackStar', 'ZoomZombie', 'WiFiWizard', 'PrinterPro',
  'DevDude88', 'BugHunter', 'SyntaxSensei', 'LoopLord', 'ArrayAce',
  'PixelPusher', 'DataDragon', 'CloudChaser', 'ServerSage', 'BashBoss',
  'GitGuru', 'MergeMonster', 'CommitKing', 'PullPrince', 'BranchBaron',
  'APIavenger', 'JSONjedi', 'ReactRanger', 'VueVikking', 'AngularArcher',
  'CSScrafter', 'HTMLhero', 'JSjuggler', 'TypeMaster', 'QueryQueen'
];

function generateRandomName() {
  const name = PLAYER_NAMES[Math.floor(Math.random() * PLAYER_NAMES.length)];
  const suffix = Math.floor(Math.random() * 100);
  return `${name}${suffix}`;
}

// Timer system
let lobbyTimer = null;
let lobbyCountdown = 0;
const LOBBY_COUNTDOWN_TIME = 30; // 30 seconds

// Game loop - 60 ticks per second
const TICK_RATE = 60;
const TICK_INTERVAL = 1000 / TICK_RATE;

function updateGame() {
  // Only update physics when playing
  if (gameState.state !== GAME_STATES.PLAYING) return;

  const ball = gameState.ball;
  const paddles = gameState.paddles;

  // Move ball
  ball.x += ball.vx;
  ball.y += ball.vy;

  // Ball collision with top/bottom walls
  if (ball.y - ball.radius <= 0 || ball.y + ball.radius >= gameState.gameHeight) {
    ball.vy *= -1;
    ball.y = Math.max(ball.radius, Math.min(gameState.gameHeight - ball.radius, ball.y));
  }

  // Ball collision with paddles - only check active players
  Object.keys(gameState.activePlayers).forEach(slot => {
    const paddle = paddles[slot];
    if (!paddle) return;

    if (ball.x - ball.radius < paddle.x + paddle.width &&
        ball.x + ball.radius > paddle.x &&
        ball.y + ball.radius > paddle.y &&
        ball.y - ball.radius < paddle.y + paddle.height) {

      // Bounce ball and increase speed slightly
      const speedMultiplier = 1.08; // Increase 8% per hit
      ball.vx *= -speedMultiplier;
      ball.vy *= speedMultiplier;

      // Add spin based on where ball hits paddle
      const hitPos = (ball.y - paddle.y) / paddle.height;
      ball.vy += (hitPos - 0.5) * 10;

      // Move ball outside paddle to prevent sticking
      if (paddle.team === 'left') {
        ball.x = paddle.x + paddle.width + ball.radius;
      } else {
        ball.x = paddle.x - ball.radius;
      }
    }
  });

  // Scoring - ball goes past left/right edge
  if (ball.x - ball.radius <= 0) {
    gameState.score.right++;
    resetBall('left');
    io.emit('score', gameState.score);
    checkWin();
  } else if (ball.x + ball.radius >= gameState.gameWidth) {
    gameState.score.left++;
    resetBall('right');
    io.emit('score', gameState.score);
    checkWin();
  }

  // Emit game state to all clients
  io.emit('gameState', {
    ball: gameState.ball,
    paddles: gameState.paddles,
    score: gameState.score,
    activeSlots: Object.keys(gameState.activePlayers)
  });
}

function resetBall(direction) {
  gameState.ball.x = gameState.gameWidth / 2;
  gameState.ball.y = gameState.gameHeight / 2;
  gameState.ball.speed = 10;
  gameState.ball.vx = direction === 'left' ? -10 : 10;
  gameState.ball.vy = (Math.random() - 0.5) * 12;
}

function checkWin() {
  if (gameState.score.left >= gameState.maxScore) {
    endGame('left');
  } else if (gameState.score.right >= gameState.maxScore) {
    endGame('right');
  }
}

function endGame(winner) {
  gameState.state = GAME_STATES.GAME_OVER;
  io.emit('gameOver', { winner, score: gameState.score });

  console.log(`Game over! ${winner} team wins!`);

  // Move all active players to back of queue
  setTimeout(() => {
    Object.keys(gameState.activePlayers).forEach(slot => {
      const player = gameState.activePlayers[slot];
      playerQueue.push({ socketId: player.socketId, nickname: player.nickname });
      socketToPlayer[player.socketId] = 'queue';

      // Notify player they're in queue
      const queuePosition = playerQueue.findIndex(p => p.socketId === player.socketId) + 1;
      io.to(player.socketId).emit('queueUpdate', { position: queuePosition, total: playerQueue.length });
    });

    // Clear active players
    gameState.activePlayers = {};

    // Start next game
    startNextGame();
  }, 5000);
}

function startNextGame() {
  // Reset scores
  gameState.score.left = 0;
  gameState.score.right = 0;
  resetBall('left');
  io.emit('score', gameState.score);

  // Set to waiting and fill from queue
  gameState.state = GAME_STATES.WAITING;
  io.emit('stateChange', { state: GAME_STATES.WAITING });

  fillActivePlayersFromQueue();
}

function broadcastLobbyState() {
  const activeCount = Object.keys(gameState.activePlayers).length;
  const readyCount = Object.values(gameState.activePlayers).filter(p => p.ready).length;
  const players = Object.keys(gameState.activePlayers).map(slot => ({
    slot,
    nickname: gameState.activePlayers[slot].nickname,
    ready: gameState.activePlayers[slot].ready,
    team: gameState.paddles[slot].team
  }));

  io.emit('lobbyUpdate', {
    readyCount,
    totalPlayers: activeCount,
    players
  });
}

function checkAllReady() {
  const activeCount = Object.keys(gameState.activePlayers).length;
  const allReady = Object.values(gameState.activePlayers).every(p => p.ready);

  // Start game when all active players are ready (regardless of count)
  if (allReady && activeCount >= 2) {
    stopLobbyTimer();
    startGame();
  }
}

function startGame() {
  gameState.state = GAME_STATES.PLAYING;
  gameState.score.left = 0;
  gameState.score.right = 0;
  resetBall('left');
  io.emit('score', gameState.score);

  io.emit('gameStart');
  console.log('Game started!');
}

function updateQueuePositions() {
  playerQueue.forEach((player, index) => {
    io.to(player.socketId).emit('queueUpdate', {
      position: index + 1,
      total: playerQueue.length
    });
  });
}

// Timer functions
function startLobbyTimer() {
  if (lobbyTimer) {
    clearInterval(lobbyTimer);
  }

  lobbyCountdown = LOBBY_COUNTDOWN_TIME;
  io.emit('lobbyTimer', { countdown: lobbyCountdown });

  lobbyTimer = setInterval(() => {
    lobbyCountdown--;
    io.emit('lobbyTimer', { countdown: lobbyCountdown });

    if (lobbyCountdown <= 0) {
      stopLobbyTimer();
      // Timer finished - go to lobby with current players
      gameState.state = GAME_STATES.LOBBY;
      io.emit('stateChange', { state: GAME_STATES.LOBBY });
      broadcastLobbyState();
      console.log('Timer finished - moving to lobby');
    }
  }, 1000);

  console.log(`Lobby timer started: ${LOBBY_COUNTDOWN_TIME}s`);
}

function stopLobbyTimer() {
  if (lobbyTimer) {
    clearInterval(lobbyTimer);
    lobbyTimer = null;
    lobbyCountdown = 0;
    io.emit('lobbyTimer', { countdown: 0 });
  }
}


function fillActivePlayersFromQueue() {
  // Only fill when in WAITING state
  if (gameState.state !== GAME_STATES.WAITING) {
    return;
  }

  // Fill up to 4 active players from queue
  while (playerQueue.length > 0 && Object.keys(gameState.activePlayers).length < 4) {
    const player = playerQueue.shift();
    const availableSlot = playerSlots.find(slot => !gameState.activePlayers[slot]);

    if (!availableSlot) break;

    gameState.activePlayers[availableSlot] = {
      socketId: player.socketId,
      nickname: player.nickname,
      ready: false
    };

    socketToPlayer[player.socketId] = availableSlot;

    io.to(player.socketId).emit('playerAssigned', {
      slot: availableSlot,
      paddle: gameState.paddles[availableSlot]
    });

    console.log(`Player ${player.nickname} moved from queue to ${availableSlot}`);
  }

  updateQueuePositions();
  checkPlayerCountAndStartTimer();
}

function checkPlayerCountAndStartTimer() {
  const activeCount = Object.keys(gameState.activePlayers).length;

  if (activeCount >= 4) {
    // Got 4 players, stop timer and go directly to lobby
    stopLobbyTimer();
    gameState.state = GAME_STATES.LOBBY;
    io.emit('stateChange', { state: GAME_STATES.LOBBY });
    broadcastLobbyState();
  } else if (activeCount >= 2 && !lobbyTimer && gameState.state === GAME_STATES.WAITING) {
    // Got 2-3 players, start countdown
    startLobbyTimer();
  } else if (activeCount < 2 && lobbyTimer) {
    // Dropped below 2 players, cancel timer
    stopLobbyTimer();
  }
}

// Start game loop
setInterval(updateGame, TICK_INTERVAL);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send current game state
  socket.emit('stateChange', { state: gameState.state });

  // Send current timer status if timer is running
  if (lobbyTimer && lobbyCountdown > 0) {
    socket.emit('lobbyTimer', { countdown: lobbyCountdown });
  }

  // Player wants to join
  socket.on('joinGame', (data) => {
    const nickname = data?.nickname || generateRandomName();

    // Check if already in game/queue
    if (socketToPlayer[socket.id]) {
      return;
    }

    // Add to queue
    playerQueue.push({ socketId: socket.id, nickname });
    socketToPlayer[socket.id] = 'queue';

    const position = playerQueue.length;
    socket.emit('queueUpdate', { position, total: playerQueue.length });

    console.log(`Player ${nickname} added to queue at position ${position}`);

    updateQueuePositions();

    // Try to fill active players from queue
    fillActivePlayersFromQueue();
  });

  // Player ready toggle
  socket.on('toggleReady', () => {
    const slot = socketToPlayer[socket.id];

    if (slot && slot !== 'queue' && gameState.activePlayers[slot]) {
      gameState.activePlayers[slot].ready = !gameState.activePlayers[slot].ready;
      broadcastLobbyState();
      checkAllReady();
    }
  });

  // Handle paddle movement
  socket.on('move', (data) => {
    const slot = socketToPlayer[socket.id];

    if (slot && slot !== 'queue' && gameState.paddles[slot] && gameState.state === GAME_STATES.PLAYING) {
      const paddle = gameState.paddles[slot];
      paddle.y = Math.max(0, Math.min(gameState.gameHeight - paddle.height, data.y));
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const playerLocation = socketToPlayer[socket.id];

    if (!playerLocation) return;

    if (playerLocation === 'queue') {
      // Remove from queue
      const index = playerQueue.findIndex(p => p.socketId === socket.id);
      if (index !== -1) {
        playerQueue.splice(index, 1);
        updateQueuePositions();
        console.log(`Player removed from queue`);
      }
    } else {
      // Remove from active players
      delete gameState.activePlayers[playerLocation];

      console.log(`Player ${playerLocation} disconnected`);

      // If in lobby or playing, go back to waiting
      if (gameState.state === GAME_STATES.LOBBY || gameState.state === GAME_STATES.PLAYING) {
        stopLobbyTimer();
        gameState.state = GAME_STATES.WAITING;
        io.emit('stateChange', { state: GAME_STATES.WAITING });

        // Move remaining active players to queue
        Object.keys(gameState.activePlayers).forEach(slot => {
          const player = gameState.activePlayers[slot];
          playerQueue.unshift({ socketId: player.socketId, nickname: player.nickname });
          socketToPlayer[player.socketId] = 'queue';
        });

        gameState.activePlayers = {};
        startNextGame();
      } else if (gameState.state === GAME_STATES.WAITING) {
        // Player left during waiting, try to fill from queue
        fillActivePlayersFromQueue();
      }
    }

    delete socketToPlayer[socket.id];
  });
});

http.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Projector display: http://localhost:${PORT}/display.html`);
  console.log(`Mobile controller: http://localhost:${PORT}/controller.html`);
});
