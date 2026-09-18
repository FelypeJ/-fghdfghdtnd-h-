// ==========================================================
// Fruit Power - Ilha da Aventura
// Jogo 2D original: colete frutas para ganhar poderes,
// lute contra inimigos, suba de nível.
// ==========================================================

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const W = canvas.width;
const H = canvas.height;

const levelEl = document.getElementById('level');
const hpBar = document.getElementById('hp-bar');
const xpBar = document.getElementById('xp-bar');
const powerNameEl = document.getElementById('power-name');
const scoreEl = document.getElementById('score');

const overlay = document.getElementById('message-overlay');
const messageTitle = document.getElementById('message-title');
const messageText = document.getElementById('message-text');
const messageBtn = document.getElementById('message-btn');

// ---------- Definição de poderes de frutas ----------
const FRUITS = [
  { name: 'Fruta de Fogo', color: '#ff6b35', damage: 18, range: 90, cooldown: 700, projectile: '#ff9f1c' },
  { name: 'Fruta do Gelo', color: '#4cc9f0', damage: 12, range: 70, cooldown: 500, projectile: '#a9def9', slow: true },
  { name: 'Fruta do Trovão', color: '#f9c74f', damage: 26, range: 130, cooldown: 1100, projectile: '#ffe066' },
  { name: 'Fruta das Trevas', color: '#7209b7', damage: 20, range: 100, cooldown: 800, projectile: '#b298dc' },
  { name: 'Fruta da Borracha', color: '#ff477e', damage: 10, range: 60, cooldown: 350, projectile: '#ffafcc' },
];

// ---------- Estado do jogo ----------
const player = {
  x: W / 2,
  y: H / 2,
  radius: 16,
  speed: 3.2,
  hp: 100,
  maxHp: 100,
  level: 1,
  xp: 0,
  xpToNext: 50,
  score: 0,
  fruitPower: null,
  lastAttack: 0,
  invulnUntil: 0,
  facing: { x: 1, y: 0 },
};

let fruits = [];
let enemies = [];
let projectiles = [];
let particles = [];
let keys = {};
let paused = false;
let lastTime = 0;
let enemySpawnTimer = 0;
let fruitSpawnTimer = 0;

// ---------- Utilidades ----------
function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function showMessage(title, text) {
  messageTitle.textContent = title;
  messageText.textContent = text;
  overlay.classList.remove('hidden');
  paused = true;
}

messageBtn.addEventListener('click', () => {
  overlay.classList.add('hidden');
  paused = false;
  lastTime = performance.now();
  requestAnimationFrame(loop);
});

// ---------- Entidades ----------
function spawnFruit() {
  const type = FRUITS[Math.floor(rand(0, FRUITS.length))];
  fruits.push({
    x: rand(40, W - 40),
    y: rand(40, H - 40),
    radius: 12,
    type,
    bob: Math.random() * Math.PI * 2,
  });
}

function spawnEnemy() {
  const edge = Math.floor(rand(0, 4));
  let x, y;
  if (edge === 0) { x = -20; y = rand(0, H); }
  else if (edge === 1) { x = W + 20; y = rand(0, H); }
  else if (edge === 2) { x = rand(0, W); y = -20; }
  else { x = rand(0, W); y = H + 20; }

  const tier = clamp(Math.floor(player.level / 2), 0, 4);
  enemies.push({
    x, y,
    radius: 14 + tier * 2,
    speed: 1.1 + tier * 0.15,
    hp: 30 + tier * 20,
    maxHp: 30 + tier * 20,
    damage: 6 + tier * 2,
    xpValue: 15 + tier * 10,
    color: `hsl(${rand(0, 360)}, 60%, 55%)`,
    lastHit: 0,
  });
}

function spawnParticles(x, y, color, count = 8) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: rand(-2, 2),
      vy: rand(-2, 2),
      life: 30,
      color,
    });
  }
}

// ---------- Input ----------
window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === ' ') e.preventDefault();
});
window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

// ---------- Lógica de atualização ----------
function updatePlayer(dt) {
  let dx = 0, dy = 0;
  if (keys['w'] || keys['arrowup']) dy -= 1;
  if (keys['s'] || keys['arrowdown']) dy += 1;
  if (keys['a'] || keys['arrowleft']) dx -= 1;
  if (keys['d'] || keys['arrowright']) dx += 1;

  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    dx /= len; dy /= len;
    player.x = clamp(player.x + dx * player.speed, player.radius, W - player.radius);
    player.y = clamp(player.y + dy * player.speed, player.radius, H - player.radius);
    player.facing = { x: dx, y: dy };
  }

  // Ataque
  const now = performance.now();
  if (keys[' '] && player.fruitPower && now - player.lastAttack > player.fruitPower.cooldown) {
    player.lastAttack = now;
    fireProjectile();
  }

  // Regeneração leve de HP com o tempo
  player.hp = clamp(player.hp + dt * 0.002, 0, player.maxHp);
}

function fireProjectile() {
  const power = player.fruitPower;
  // Mira no inimigo mais próximo, senão na direção que o jogador está olhando
  let target = null;
  let best = Infinity;
  for (const en of enemies) {
    const d = dist(player, en);
    if (d < best) { best = d; target = en; }
  }

  let vx, vy;
  if (target && best < power.range * 2.2) {
    vx = target.x - player.x;
    vy = target.y - player.y;
  } else {
    vx = player.facing.x || 1;
    vy = player.facing.y || 0;
  }
  const len = Math.hypot(vx, vy) || 1;
  vx /= len; vy /= len;

  projectiles.push({
    x: player.x,
    y: player.y,
    vx: vx * 7,
    vy: vy * 7,
    radius: 7,
    color: power.projectile,
    damage: power.damage,
    life: 60,
    slow: power.slow || false,
  });
}

function updateEnemies(dt) {
  for (const en of enemies) {
    const dx = player.x - en.x;
    const dy = player.y - en.y;
    const len = Math.hypot(dx, dy) || 1;
    const spd = en.slowUntil && en.slowUntil > performance.now() ? en.speed * 0.4 : en.speed;
    en.x += (dx / len) * spd;
    en.y += (dy / len) * spd;

    if (len < en.radius + player.radius) {
      const now = performance.now();
      if (now > player.invulnUntil) {
        player.hp -= en.damage;
        player.invulnUntil = now + 500;
        spawnParticles(player.x, player.y, '#ef476f', 10);
      }
    }
  }

  enemies = enemies.filter((en) => en.hp > 0);
}

function updateProjectiles() {
  for (const p of projectiles) {
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
  }
  projectiles = projectiles.filter(
    (p) => p.life > 0 && p.x > -20 && p.x < W + 20 && p.y > -20 && p.y < H + 20
  );

  for (const p of projectiles) {
    for (const en of enemies) {
      if (dist(p, en) < p.radius + en.radius) {
        en.hp -= p.damage;
        p.life = 0;
        spawnParticles(en.x, en.y, p.color, 6);
        if (p.slow) en.slowUntil = performance.now() + 1500;
        if (en.hp <= 0) {
          player.xp += en.xpValue;
          player.score += en.xpValue * 2;
          spawnParticles(en.x, en.y, '#ffd166', 14);
          checkLevelUp();
        }
      }
    }
  }
  projectiles = projectiles.filter((p) => p.life > 0);
}

function checkLevelUp() {
  while (player.xp >= player.xpToNext) {
    player.xp -= player.xpToNext;
    player.level++;
    player.xpToNext = Math.round(player.xpToNext * 1.35);
    player.maxHp += 15;
    player.hp = player.maxHp;
    spawnParticles(player.x, player.y, '#06d6a0', 20);
  }
}

function updateFruits() {
  for (const f of fruits) {
    f.bob += 0.05;
    if (dist(player, f) < player.radius + f.radius) {
      player.fruitPower = f.type;
      player.score += 5;
      spawnParticles(f.x, f.y, f.type.color, 12);
      f.eaten = true;
      if (!player.hasEatenBefore) {
        player.hasEatenBefore = true;
        showMessage(
          'Fruta consumida!',
          `Você comeu a ${f.type.name} e ganhou um novo poder de ataque à distância. Pressione ESPAÇO para atacar!`
        );
      }
    }
  }
  fruits = fruits.filter((f) => !f.eaten);
}

function updateParticles() {
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
  }
  particles = particles.filter((p) => p.life > 0);
}

function checkGameOver() {
  if (player.hp <= 0) {
    showMessage(
      'Você foi derrotado!',
      `Pontuação final: ${player.score}. Pressione continuar para recomeçar a aventura.`
    );
    resetGame();
  }
}

function resetGame() {
  player.x = W / 2;
  player.y = H / 2;
  player.hp = player.maxHp = 100;
  player.level = 1;
  player.xp = 0;
  player.xpToNext = 50;
  player.score = 0;
  player.fruitPower = null;
  player.hasEatenBefore = false;
  enemies = [];
  fruits = [];
  projectiles = [];
  particles = [];
}

// ---------- Desenho ----------
function drawBackground() {
  ctx.clearRect(0, 0, W, H);
  const grad = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W);
  grad.addColorStop(0, '#4ea8de');
  grad.addColorStop(1, '#1b4965');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // ilha central decorativa
  ctx.fillStyle = 'rgba(255, 224, 130, 0.25)';
  ctx.beginPath();
  ctx.ellipse(W / 2, H / 2, 260, 160, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayer() {
  const blinking = performance.now() < player.invulnUntil && Math.floor(performance.now() / 80) % 2 === 0;
  ctx.globalAlpha = blinking ? 0.4 : 1;
  ctx.fillStyle = player.fruitPower ? player.fruitPower.color : '#f1f5f9';
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0a1c2b';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // indicador de direção
  ctx.fillStyle = '#0a1c2b';
  ctx.beginPath();
  ctx.arc(
    player.x + player.facing.x * player.radius * 0.6,
    player.y + player.facing.y * player.radius * 0.6,
    3, 0, Math.PI * 2
  );
  ctx.fill();
}

function drawFruits() {
  for (const f of fruits) {
    const bobY = Math.sin(f.bob) * 4;
    ctx.fillStyle = f.type.color;
    ctx.beginPath();
    ctx.arc(f.x, f.y + bobY, f.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawEnemies() {
  for (const en of enemies) {
    ctx.fillStyle = en.color;
    ctx.beginPath();
    ctx.arc(en.x, en.y, en.radius, 0, Math.PI * 2);
    ctx.fill();

    // barra de vida do inimigo
    const barW = en.radius * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(en.x - barW / 2, en.y - en.radius - 10, barW, 4);
    ctx.fillStyle = '#ef476f';
    ctx.fillRect(en.x - barW / 2, en.y - en.radius - 10, barW * (en.hp / en.maxHp), 4);
  }
}

function drawProjectiles() {
  for (const p of projectiles) {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / 30, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function updateHUD() {
  levelEl.textContent = player.level;
  hpBar.style.width = `${clamp((player.hp / player.maxHp) * 100, 0, 100)}%`;
  xpBar.style.width = `${clamp((player.xp / player.xpToNext) * 100, 0, 100)}%`;
  powerNameEl.textContent = player.fruitPower ? player.fruitPower.name : 'Nenhum';
  scoreEl.textContent = player.score;
}

// ---------- Loop principal ----------
function loop(time) {
  if (paused) return;
  const dt = time - lastTime;
  lastTime = time;

  fruitSpawnTimer += dt;
  enemySpawnTimer += dt;

  if (fruitSpawnTimer > 4000 && fruits.length < 5) {
    fruitSpawnTimer = 0;
    spawnFruit();
  }
  if (enemySpawnTimer > Math.max(1200, 3000 - player.level * 100) && enemies.length < 10) {
    enemySpawnTimer = 0;
    spawnEnemy();
  }

  updatePlayer(dt);
  updateEnemies(dt);
  updateProjectiles();
  updateFruits();
  updateParticles();
  checkGameOver();
  updateHUD();

  drawBackground();
  drawFruits();
  drawEnemies();
  drawProjectiles();
  drawParticles();
  drawPlayer();

  requestAnimationFrame(loop);
}

// ---------- Início ----------
spawnFruit();
spawnFruit();
showMessage(
  'Bem-vindo à Ilha da Aventura!',
  'Explore a ilha, colete frutas para ganhar poderes de ataque à distância e derrote inimigos para subir de nível. Use WASD/Setas para mover e ESPAÇO para atacar.'
);
requestAnimationFrame(loop);
