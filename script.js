// ==================== CONFIGURACIÓN ====================
const CONFIG = {
    canvasWidth: 0,
    canvasHeight: 0,
    maxEnemies: 8,
    maxItems: 5,
    maxParticles: 200,
    spawnEnemyInterval: 1200,
    spawnEnemies: true,
    difficulty: 'normal'
};

// ==================== FIREBASE CONFIGURATION ====================
const firebaseConfig = {
    apiKey: "AIzaSyAr6nZPf6zKyDUXbS6d86HDywr96foq7p8",
    authDomain: "chaos-arcade.firebaseapp.com",
    projectId: "chaos-arcade",
    storageBucket: "chaos-arcade.firebasestorage.app",
    messagingSenderId: "1063089973749",
    appId: "1:1063089973749:web:d05774de89467d0c4318bc",
    measurementId: "G-K4T083ZH6W"
};

// Inicializar Firebase
let db, auth;
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
} catch (e) {
    console.warn('Firebase no disponible:', e.message);
}

let currentUser = null;

// ==================== CONFIGURACIÓN ====================
const DIFFICULTY_SETTINGS = {
    easy: {
        maxEnemies: 3,
        spawnEnemyInterval: 2000,
        projectileSpeed: 5,
        enemySpeed: 0.8,
        multiplier: 0.7
    },
    normal: {
        maxEnemies: 5,
        spawnEnemyInterval: 1500,
        projectileSpeed: 6,
        enemySpeed: 1.0,
        multiplier: 1.0
    },
    hard: {
        maxEnemies: 8,
        spawnEnemyInterval: 1000,
        projectileSpeed: 7,
        enemySpeed: 1.3,
        multiplier: 1.5
    },
    extreme: {
        maxEnemies: 12,
        spawnEnemyInterval: 700,
        projectileSpeed: 8,
        enemySpeed: 1.6,
        multiplier: 2.0
    }
};

const CONFIG_OLD = {
    canvasWidth: 0,
    canvasHeight: 0,
    maxEnemies: 4,
    maxItems: 5,
    maxParticles: 200,
};

// ==================== VARIABLES GLOBALES ====================
let canvas, ctx;
let gameRunning = false;
let gameStartTime = 0;
let elapsedTime = 0;

let player = {
    x: 0,
    y: 0,
    width: 30,
    height: 30,
    vx: 0,
    vy: 0,
    speed: 5,
    color: '#00ff9f'
};

let items = [];
let particles = [];
let bullets = [];
let enemies = [];
let enemyProjectiles = [];

let score = 0;
let combo = 0;
let lastItemTime = 0;
let lastShotTime = 0;

// ==================== BUFFS DEL JUGADOR ====================
let playerBuffs = {
    damage: 1, // multiplicador de daño
    fireRateMultiplier: 1, // velocidad de disparo
    shield: false,
    doublePoints: false
};
let activeBuffTimers = [];

// Rules system removed but keep placeholders to avoid leftover references
let lastUsedRules = [];
let currentRules = new Set();
let changeRuleInterval = null;
let lastRuleChangeTime = Date.now();
let keys = {};
let leaderboard = [];

let spawnEnemyInterval = null;
let spawnItemInterval = null;
let difficultyInterval = null;

// ==================== INICIALIZACIÓN ====================
function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d', { alpha: true });

    const container = document.getElementById('gameContainer');
    CONFIG.canvasWidth = container.offsetWidth;
    CONFIG.canvasHeight = container.offsetHeight;

    canvas.width = CONFIG.canvasWidth;
    canvas.height = CONFIG.canvasHeight;

    player.x = CONFIG.canvasWidth / 2;
    player.y = CONFIG.canvasHeight / 2;

    loadLeaderboard();
    updateLeaderboardDisplay();

    // Event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    // Ensure Game Over 'back' button works even if inline handlers fail
    try {
        const backBtn = document.getElementById('backToLoginBtn');
        if (backBtn) backBtn.addEventListener('click', (e) => { e.preventDefault(); showStartScreen(); });
    } catch (e) { /* ignore */ }

    // Mostrar pantalla de login
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('difficultyScreen').style.display = 'none';
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.remove('show');

    // Mostrar opciones de no autenticado por defecto
    document.getElementById('userInfo').style.display = 'none';
    document.getElementById('notLoggedInInfo').style.display = 'block';

    // Cargar leaderboard global
    loadGlobalLeaderboard();

    // Inicializar Firebase Auth (intentar mostrar botón de Google si está disponible)
    setTimeout(() => {
        try {
            initializeFirebaseAuth();
        } catch (e) {
            console.warn('initializeFirebaseAuth error:', e && e.message);
            // Asegurar que sigue visible si hay error
            document.getElementById('notLoggedInInfo').style.display = 'block';
            document.getElementById('userInfo').style.display = 'none';
        }
    }, 100);

    // Iniciar bucle del juego
    requestAnimationFrame(gameLoop);
}

// ==================== INICIO DEL JUEGO ====================
function startGame() {
    // Ocultar pantallas que puedan tapar el canvas (Game Over / Login / Difficulty)
    try {
        const gos = document.getElementById('gameOverScreen');
        if (gos) gos.classList.remove('show');
        const login = document.getElementById('loginScreen');
        if (login) login.style.display = 'none';
        const diff = document.getElementById('difficultyScreen');
        if (diff) diff.style.display = 'none';
    } catch (e) { /* ignore */ }

    document.getElementById('startScreen').classList.add('hidden');
    gameRunning = true;
    gameStartTime = Date.now();
    lastRuleChangeTime = Date.now();
    score = 0;
    combo = 0;
    enemies = [];
    items = [];
    particles = [];
    bullets = [];
    enemyProjectiles = [];
    lastUsedRules = [];
    
    // Aplicar configuración de dificultad
    const settings = DIFFICULTY_SETTINGS[CONFIG.difficulty];
    CONFIG.maxEnemies = settings.maxEnemies;
    CONFIG.spawnEnemyInterval = settings.spawnEnemyInterval;
    // Crear intervalo de spawn de enemigos
    if (CONFIG.spawnEnemies) {
        // spawn inicial ligero
        for (let i = 0; i < Math.min(2, CONFIG.maxEnemies); i++) {
            spawnEnemy();
        }
        spawnEnemyInterval = setInterval(() => {
            if (gameRunning) spawnEnemy();
        }, CONFIG.spawnEnemyInterval);
    }
    // Generar items
    spawnItemInterval = setInterval(() => {
        if (gameRunning && items.length < CONFIG.maxItems) spawnItem();
    }, 3000);
    
    // reglas eliminadas

    // Aumentar dificultad
    difficultyInterval = setInterval(() => {
        if (gameRunning) increaseDifficulty();
    }, 25000);
}

// ==================== ENEMIGOS ====================
function spawnEnemy(forcedType) {
    try {
        if (!CONFIG.spawnEnemies) return;
        if (!gameRunning || enemies.length >= CONFIG.maxEnemies) return;

        const side = Math.floor(Math.random() * 4);
        let x, y;
        switch (side) {
            case 0: x = Math.random() * CONFIG.canvasWidth; y = -40; break;
            case 1: x = CONFIG.canvasWidth + 40; y = Math.random() * CONFIG.canvasHeight; break;
            case 2: x = Math.random() * CONFIG.canvasWidth; y = CONFIG.canvasHeight + 40; break;
            default: x = -40; y = Math.random() * CONFIG.canvasHeight; break;
        }

        const types = [
            { type: 'chaser', prob: 0.2 },
            { type: 'shooter', prob: 0.18 },
            { type: 'kamikaze', prob: 0.15 },
            { type: 'tank', prob: 0.25 },
            { type: 'splitter', prob: 0.12 },
            { type: 'turret', prob: 0.1 }
        ];

        function weightedPick(list) {
            const total = list.reduce((s, it) => s + (it.prob || 0), 0);
            let r = Math.random() * total;
            for (const it of list) {
                r -= (it.prob || 0);
                if (r <= 0) return it.type;
            }
            return list[list.length - 1].type;
        }

        let selected = forcedType || weightedPick(types);

        // Limit caps per type (prevent too many turrets etc.)
        const typeCaps = { turret: 2, tank: 4 };
        const counts = {};
        types.forEach(t => counts[t.type] = 0);
        enemies.forEach(e => { if (counts[e.type] !== undefined) counts[e.type]++; });
        if (typeCaps[selected] && counts[selected] >= typeCaps[selected]) {
            // fallback pick different type
            const alt = types.find(t => !typeCaps[t.type] || counts[t.type] < typeCaps[t.type]);
            if (alt) selected = alt.type;
        }

        const enemy = { x, y, vx: 0, vy: 0, type: selected, lastShot: Date.now(), id: Math.random() };

        switch (selected) {
            case 'chaser':
                enemy.size = 22; enemy.speed = 2.0; enemy.hp = 1; enemy.maxHp = 1; enemy.color = '#ffb86c'; enemy.width = 22; enemy.height = 22;
                break;
            case 'shooter':
                enemy.size = 28; enemy.speed = 0.8; enemy.hp = 2; enemy.maxHp = 2; enemy.color = '#8be9fd'; enemy.width = 28; enemy.height = 28; enemy.shootInterval = 1500;
                break;
            case 'kamikaze':
                enemy.size = 18; enemy.speed = 2.8; enemy.hp = 1; enemy.maxHp = 1; enemy.color = '#ff5555'; enemy.width = 18; enemy.height = 18;
                break;
                    case 'tank':
                        enemy.size = 40; enemy.speed = 0.5; enemy.hp = 3; enemy.maxHp = 3; enemy.color = '#bd93f9'; enemy.width = 40; enemy.height = 40; enemy.pulseInterval = 3500;
                break;
            case 'splitter':
                enemy.size = 26; enemy.speed = 1.3; enemy.hp = 2; enemy.maxHp = 2; enemy.color = '#f1fa8c'; enemy.width = 26; enemy.height = 26;
                break;
            case 'turret':
                enemy.size = 20; enemy.speed = 0.2; enemy.hp = 2; enemy.maxHp = 2; enemy.color = '#50fa7b'; enemy.width = 20; enemy.height = 20; enemy.shootInterval = 1800;
                break;
        }

        const settings = DIFFICULTY_SETTINGS[CONFIG.difficulty];
        enemy.speed *= settings.enemySpeed;
        enemy.hp = Math.ceil(enemy.hp * settings.multiplier);
        enemy.maxHp = enemy.hp;

        enemies.push(enemy);
    } catch (e) {
        console.error('spawnEnemy error:', e);
    }
}

function updateEnemies() {
    enemies = enemies.filter(e => e.hp > 0);
    const now = Date.now();
    enemies.forEach((enemy, index) => {
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const dist = Math.hypot(dx, dy);

        if (enemy.type === 'chaser') {
            if (dist > 0) {
                enemy.vx = (dx / dist) * enemy.speed;
                enemy.vy = (dy / dist) * enemy.speed;
            }
        } else if (enemy.type === 'shooter') {
            if (dist < 220) {
                enemy.vx = (-dx / dist) * enemy.speed * 0.8;
                enemy.vy = (-dy / dist) * enemy.speed * 0.8;
            } else if (dist > 320) {
                enemy.vx = (dx / dist) * enemy.speed * 0.4;
                enemy.vy = (dy / dist) * enemy.speed * 0.4;
            } else {
                enemy.vx *= 0.95; enemy.vy *= 0.95;
            }

            if (!enemy.shootInterval) enemy.shootInterval = 1500;
            if (now - enemy.lastShot > enemy.shootInterval) {
                enemy.lastShot = now;
                if (dist > 0) {
                    const dirx = dx / dist, diry = dy / dist;
                    const s = DIFFICULTY_SETTINGS[CONFIG.difficulty];
                    enemyProjectiles.push({ x: enemy.x, y: enemy.y, vx: dirx * s.projectileSpeed, vy: diry * s.projectileSpeed, radius: 5, color: '#8be9fd', type: 'straight' });
                    playSound(450, 0.05, 0.08);
                }
            }
        } else if (enemy.type === 'kamikaze') {
            if (dist > 0) {
                const factor = dist < 150 ? 2.0 : 1.0;
                enemy.vx = (dx / dist) * enemy.speed * factor;
                enemy.vy = (dy / dist) * enemy.speed * factor;
            }
        } else if (enemy.type === 'tank') {
            if (dist > 0) { enemy.vx = (dx / dist) * enemy.speed * 0.4; enemy.vy = (dy / dist) * enemy.speed * 0.4; }
            if (!enemy.pulseInterval) enemy.pulseInterval = 3500;
            if (now - enemy.lastShot > enemy.pulseInterval) {
                enemy.lastShot = now;
                const s = DIFFICULTY_SETTINGS[CONFIG.difficulty];
                for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 6) {
                    enemyProjectiles.push({ x: enemy.x, y: enemy.y, vx: Math.cos(angle) * (s.projectileSpeed * 0.8), vy: Math.sin(angle) * (s.projectileSpeed * 0.8), radius: 4, color: '#bd93f9', type: 'pulse' });
                }
                playSound(300, 0.1, 0.15);
            }
        } else if (enemy.type === 'splitter') {
            if (dist > 0) { enemy.vx = (dx / dist) * enemy.speed; enemy.vy = (dy / dist) * enemy.speed; }
            enemy.vx += Math.sin(now / 500) * 0.3; enemy.vy += Math.cos(now / 500) * 0.3;
        } else if (enemy.type === 'turret') {
            enemy.vx += (Math.sin(now / 1000 + enemy.id) * 0.1 - enemy.vx * 0.02);
            enemy.vy += (Math.cos(now / 1200 + enemy.id) * 0.1 - enemy.vy * 0.02);
            if (!enemy.shootInterval) enemy.shootInterval = 1800;
            if (now - enemy.lastShot > enemy.shootInterval) {
                enemy.lastShot = now;
                const s = DIFFICULTY_SETTINGS[CONFIG.difficulty];
                const angle = (now / 1000) % (Math.PI * 2);
                for (let i = 0; i < 5; i++) {
                    const a = angle + (i / 5) * Math.PI * 2;
                    enemyProjectiles.push({ x: enemy.x, y: enemy.y, vx: Math.cos(a) * s.projectileSpeed, vy: Math.sin(a) * s.projectileSpeed, radius: 4, color: '#50fa7b', type: 'spiral' });
                }
                playSound(500, 0.08, 0.1);
            }
        }

        if (currentRules.has('slow-motion')) { enemy.vx *= 0.5; enemy.vy *= 0.5; }

        enemy.x += enemy.vx; enemy.y += enemy.vy;

        if (enemy.x + enemy.width < 0 || enemy.x > CONFIG.canvasWidth || enemy.y + enemy.height < 0 || enemy.y > CONFIG.canvasHeight) {
            enemies.splice(index, 1);
            return;
        }

        if (checkCollision(player, enemy)) {
            if (currentRules.has('collect-enemies')) {
                score += 100; combo += 5; enemy.hp = 0; playSound(400, 0.2, 0.15);
            } else {
                if (playerBuffs.shield) {
                    // consumir shield y eliminar enemigo
                    playerBuffs.shield = false;
                    // eliminar el timer asociado si existe
                    for (let k = activeBuffTimers.length - 1; k >= 0; k--) if (activeBuffTimers[k].buff === 'shield') activeBuffTimers.splice(k,1);
                    enemy.hp = 0;
                    playSound(1000, 0.12, 0.12);
                } else {
                    endGame();
                }
            }
        }
    });
}

function updateEnemyProjectiles() {
    const now = Date.now();
    for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
        const p = enemyProjectiles[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < -50 || p.x > CONFIG.canvasWidth + 50 || p.y < -50 || p.y > CONFIG.canvasHeight + 50) { enemyProjectiles.splice(i, 1); continue; }
        const dx = p.x - (player.x + player.width / 2); const dy = p.y - (player.y + player.height / 2); const dist = Math.hypot(dx, dy);
        if (dist < p.radius + Math.max(player.width, player.height) / 2) {
            if (playerBuffs.shield) {
                playerBuffs.shield = false;
                for (let k = activeBuffTimers.length - 1; k >= 0; k--) if (activeBuffTimers[k].buff === 'shield') activeBuffTimers.splice(k,1);
                enemyProjectiles.splice(i,1);
                playSound(1000, 0.12, 0.12);
                return;
            }
            endGame(); return;
        }
    }
}

function drawEnemies() {
    enemies.forEach(enemy => {
        ctx.save(); ctx.translate(enemy.x, enemy.y);
        if (enemy.type === 'chaser') { ctx.fillStyle = enemy.color; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(0, 0, enemy.size / 2, 0, Math.PI * 2); ctx.fill(); ctx.closePath(); }
        else if (enemy.type === 'shooter') { ctx.fillStyle = enemy.color; ctx.globalAlpha = 0.85; ctx.fillRect(-enemy.size / 2, -enemy.size / 2, enemy.size, enemy.size); ctx.fillStyle = '#222'; ctx.fillRect(-3, -enemy.size / 2 - 6, 6, 6); }
        else if (enemy.type === 'kamikaze') { ctx.fillStyle = enemy.color; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.moveTo(0, -enemy.size / 2); ctx.lineTo(enemy.size / 2, enemy.size / 2); ctx.lineTo(-enemy.size / 2, enemy.size / 2); ctx.closePath(); ctx.fill(); }
        else if (enemy.type === 'tank') { ctx.fillStyle = enemy.color; ctx.globalAlpha = 0.85; ctx.fillRect(-enemy.size / 2, -enemy.size / 2, enemy.size, enemy.size); ctx.strokeStyle = '#ff00ff'; ctx.lineWidth = 2; ctx.globalAlpha = 0.6; ctx.strokeRect(-enemy.size / 2, -enemy.size / 2, enemy.size, enemy.size); ctx.globalAlpha = 1; ctx.fillStyle = '#ff5555'; ctx.fillRect(-enemy.size / 2 + 2, -enemy.size / 2 - 8, (enemy.hp / enemy.maxHp) * (enemy.size - 4), 3); }
        else if (enemy.type === 'splitter') { ctx.fillStyle = enemy.color; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.ellipse(0, 0, enemy.size / 2.2, enemy.size / 2.8, 0, 0, Math.PI * 2); ctx.fill(); }
        else if (enemy.type === 'turret') { ctx.fillStyle = enemy.color; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(0, 0, enemy.size / 2, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 1; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.moveTo(-enemy.size / 2 - 2, 0); ctx.lineTo(enemy.size / 2 + 2, 0); ctx.moveTo(0, -enemy.size / 2 - 2); ctx.lineTo(0, enemy.size / 2 + 2); ctx.stroke(); }
        ctx.restore();
    });
}

function drawEnemyProjectiles() {
    enemyProjectiles.forEach(p => {
        ctx.save(); ctx.translate(p.x, p.y);
        if (p.type === 'straight') { ctx.fillStyle = p.color; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI * 2); ctx.fill(); }
        else if (p.type === 'pulse') { ctx.fillStyle = p.color; ctx.globalAlpha = 0.85; ctx.fillRect(-p.radius, -p.radius, p.radius * 2, p.radius * 2); }
        else if (p.type === 'spiral') { ctx.fillStyle = p.color; ctx.globalAlpha = 0.85; ctx.beginPath(); for (let i = 0; i < 5; i++) { const angle = (i / 5) * Math.PI * 2 - Math.PI / 2; const x = Math.cos(angle) * p.radius; const y = Math.sin(angle) * p.radius; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.closePath(); ctx.fill(); }
        else { ctx.fillStyle = p.color; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
    });
}

// Utilities to control enemies
function clearEnemies() { enemies = []; }
window.clearEnemies = clearEnemies;
function disableEnemies() { CONFIG.spawnEnemies = false; if (spawnEnemyInterval) { clearInterval(spawnEnemyInterval); spawnEnemyInterval = null; } }
window.disableEnemies = disableEnemies;
function enableEnemies() { CONFIG.spawnEnemies = true; if (!spawnEnemyInterval && gameRunning) spawnEnemyInterval = setInterval(() => { if (gameRunning) spawnEnemy(); }, CONFIG.spawnEnemyInterval); }
window.enableEnemies = enableEnemies;

// ==================== MANEJO DE TECLADO ====================
function handleKeyDown(e) {
    keys[e.key.toLowerCase()] = true;
    
    if (e.key === ' ') {
        e.preventDefault();
        if (gameRunning) performSpecialAction();
    }
}

function handleKeyUp(e) {
    keys[e.key.toLowerCase()] = false;
}

// ==================== ACCIONES ESPECIALES ====================
function performSpecialAction() {
    const now = Date.now();
    // máximo N balas activas
    const maxBullets = playerBuffs.fireRateMultiplier < 1 ? 4 : 6;
    if (bullets.length >= maxBullets) return;
    const baseCooldown = 260; // cooldown ligeramente más relajado
    if (now - lastShotTime < baseCooldown * playerBuffs.fireRateMultiplier) return; // cooldown modificado por buff

    lastShotTime = now;

    // dirección normalizada
    let dir = { x: lastDirection.x, y: lastDirection.y };
    if (dir.x === 0 && dir.y === 0) dir = { x: 0, y: -1 }; // default arriba

    // posición de salida desde el centro del jugador
    const cx = player.x + player.width / 2;
    const cy = player.y + player.height / 2;

    // disparo único hacia la última dirección
    const speed = 12;
    const vx = dir.x * speed;
    const vy = dir.y * speed;
    bullets.push({
        x: cx + dir.x * (player.width / 2 + 6),
        y: cy + dir.y * (player.height / 2 + 6),
        vx: vx,
        vy: vy,
        radius: 6,
        color: '#ffd86b',
        born: now,
        life: 3000,
        trail: []
    });

    playSound(880, 0.08, 0.12);
}

// ==================== ACTUALIZAR JUGADOR ====================
let lastDirection = { x: 0, y: -1 }; // Dirección por defecto hacia arriba

function updatePlayer() {
    if (!gameRunning) return;
    
    let dx = 0;
    let dy = 0;

    if (keys['w'] || keys['arrowup']) dy -= 1;
    if (keys['s'] || keys['arrowdown']) dy += 1;
    if (keys['a'] || keys['arrowleft']) dx -= 1;
    if (keys['d'] || keys['arrowright']) dx += 1;

    // Guardar última dirección para ataque unidireccional
    if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        lastDirection = { x: dx / len, y: dy / len };
    }

    let speed = player.speed;

    player.vx = dx * speed;
    player.vy = dy * speed;

    player.x += player.vx;
    player.y += player.vy;
    if (player.x + player.width < 0) player.x = CONFIG.canvasWidth;
    if (player.x > CONFIG.canvasWidth) player.x = -player.width;
    if (player.y + player.height < 0) player.y = CONFIG.canvasHeight;
    if (player.y > CONFIG.canvasHeight) player.y = -player.height;
}

// ==================== ENEMIGOS ====================
// Enemy subsystem removed: spawn, update, and control functions deleted.
// Any references to enemies have been removed to keep the game running without enemies.

// ==================== ITEMS ====================
function spawnItem() {
    if (items.length >= CONFIG.maxItems) return;

    // 25% prob de que sea un buff
    const isBuff = Math.random() < 0.25;
    if (!isBuff) {
        items.push({ x: Math.random() * CONFIG.canvasWidth, y: Math.random() * CONFIG.canvasHeight, width: 15, height: 15, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, color: '#ffff00', collected: false, life: 300, buff: null });
    } else {
        // posibles buffs
        const buffs = ['damage', 'firerate', 'shield', 'doublepoints'];
        const b = buffs[Math.floor(Math.random() * buffs.length)];
        const colorMap = { damage: '#ff79c6', firerate: '#8be9fd', shield: '#50fa7b', doublepoints: '#bd93f9' };
        items.push({ x: Math.random() * CONFIG.canvasWidth, y: Math.random() * CONFIG.canvasHeight, width: 18, height: 18, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, color: colorMap[b] || '#ffffff', collected: false, life: 400, buff: b });
    }
}

function updateItems() {
    items = items.filter(item => item.life > 0);
    
    items.forEach((item, index) => {
        item.x += item.vx;
        item.y += item.vy;
        item.life--;

        if (item.x + item.width < 0) item.x = CONFIG.canvasWidth;
        if (item.x > CONFIG.canvasWidth) item.x = -item.width;
        if (item.y + item.height < 0) item.y = CONFIG.canvasHeight;
        if (item.y > CONFIG.canvasHeight) item.y = -item.height;

        if (checkCollision(player, item)) {
            if (item.buff) {
                applyBuff(item.buff, 10000); // 10s
                playSound(900, 0.08, 0.08);
            } else {
                score += 10 * (1 + combo); combo++; lastItemTime = Date.now(); playSound(600, 0.1, 0.1);
            }
            items.splice(index, 1);
        }
    });

    if (Date.now() - lastItemTime > 3000) {
        combo = Math.max(0, combo - 1);
        lastItemTime = Date.now();
    }
}

// ==================== BALAS ====================
function updateBullets() {
    const now = Date.now();
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        // update trail
        if (!b.trail) b.trail = [];
        b.trail.unshift({ x: b.x, y: b.y, alpha: 1.0 });
        if (b.trail.length > 10) b.trail.pop();

        b.x += b.vx;
        b.y += b.vy;

        // eliminar si expira
        if (now - b.born > b.life) {
            bullets.splice(i, 1);
            continue;
        }

        // eliminar si sale de pantalla
        if (b.x < -50 || b.x > CONFIG.canvasWidth + 50 || 
            b.y < -50 || b.y > CONFIG.canvasHeight + 50) {
            bullets.splice(i, 1);
            continue;
        }

        // Colisión con enemigos: aplicar daño según playerBuffs.damage
        for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            const dx = b.x - e.x;
            const dy = b.y - e.y;
            const dist = Math.hypot(dx, dy);
            const hitRadius = b.radius + Math.max(e.width, e.height) / 2;
            if (dist < hitRadius) {
                // daño básico 1 * multiplicador
                const dmg = Math.max(1, Math.round(1 * playerBuffs.damage));
                e.hp -= dmg;
                bullets.splice(i, 1);
                if (e.hp <= 0) {
                    const points = 100 * (playerBuffs.doublePoints ? 2 : 1);
                    score += points;
                    combo += 5;
                    // partículas al morir
                    for (let p = 0; p < 8; p++) {
                        particles.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, color: e.color, life: 40, maxLife: 40, size: 3 });
                    }
                }
                break;
            }
        }
    }
    enemies = enemies.filter(e => e.hp > 0);
}

// ==================== PROYECTILES DE ENEMIGOS ====================
// Enemy projectiles removed along with enemy subsystem.

// ==================== PARTÍCULAS ====================
function updateParticles() {
    particles = particles.filter(p => p.life > 0);
    
    particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2;
        p.life--;
    });
}

function applyBuff(buffName, durationMs) {
    switch (buffName) {
        case 'damage': playerBuffs.damage = 2; break;
        case 'firerate': playerBuffs.fireRateMultiplier = 0.6; break;
        case 'shield': playerBuffs.shield = true; break;
        case 'doublepoints': playerBuffs.doublePoints = true; break;
    }
    const expiry = Date.now() + durationMs;
    activeBuffTimers.push({ buff: buffName, expiresAt: expiry });
}

function updateBuffs() {
    const now = Date.now();
    for (let i = activeBuffTimers.length - 1; i >= 0; i--) {
        const t = activeBuffTimers[i];
        if (now >= t.expiresAt) {
            // revert
            switch (t.buff) {
                case 'damage': playerBuffs.damage = 1; break;
                case 'firerate': playerBuffs.fireRateMultiplier = 1; break;
                case 'shield': playerBuffs.shield = false; break;
                case 'doublepoints': playerBuffs.doublePoints = false; break;
            }
            activeBuffTimers.splice(i, 1);
        }
    }
}

// ==================== COLISIONES ====================
function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

// ==================== AUDIO CON WEB AUDIO API ====================
let audioContext;

function getAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
}

function playSound(frequency, duration, volume) {
    try {
        const ctx = getAudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(volume, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + duration);
    } catch (e) {
        // Ignorar si no hay soporte de audio
    }
}

// ==================== SISTEMA DE REGLAS ====================
const allRules = [
    { id: 'inverted', name: 'CONTROLES INVERTIDOS', sound: 400 },
    { id: 'gravity', name: 'ACTIVAR GRAVEDAD', sound: 300 },
    { id: 'speed-x2', name: 'VELOCIDAD X2', sound: 800 },
    { id: 'slow-motion', name: 'CÁMARA LENTA', sound: 200 },
    { id: 'horizontal-only', name: 'SOLO MOVIMIENTO HORIZONTAL', sound: 500 },
    { id: 'vertical-only', name: 'SOLO MOVIMIENTO VERTICAL', sound: 550 },
    { id: 'random-teleport', name: 'TELETRANSPORTE ALEATORIO', sound: 1000 },
    { id: 'collect-enemies', name: 'RECOLECTA ENEMIGOS +PTS', sound: 700 },
    { id: 'reverse-items', name: 'ITEMS RESTAN PUNTOS', sound: 150 },
    { id: 'wall-bounce', name: 'REBOTE EN PAREDES', sound: 600 }
];

// Rules removed

function increaseDifficulty() {
    if (!gameRunning) return;
    CONFIG.maxEnemies = Math.min(CONFIG.maxEnemies + 1, 10);
}

// ==================== RENDERIZADO ====================
function drawPlayer() {
    // Cambiar tamaño según reglas
    let size = 30;
    if (currentRules.has('mini-player')) size = 15;
    if (currentRules.has('giant-player')) size = 50;

    // Actualizar tamaño del jugador
    player.width = size;
    player.height = size;

    // Aplicar invisibilidad
    let opacity = 1;
    if (currentRules.has('partial-invisible')) {
        opacity = 0.4;
    }

    ctx.fillStyle = player.color;
    ctx.globalAlpha = opacity;
    ctx.fillRect(player.x - size / 2, player.y - size / 2, size, size);

    // Dibujar shield visible si está activo
    if (playerBuffs.shield) {
        try {
            const t = Date.now();
            const pulse = 1 + Math.sin(t / 200) * 0.08;
            ctx.beginPath();
            ctx.globalAlpha = 0.25;
            ctx.fillStyle = '#50fa7b';
            ctx.arc(player.x, player.y, Math.max(size, player.width) * 0.9 * pulse, 0, Math.PI*2);
            ctx.fill();
            ctx.globalAlpha = 0.7;
            ctx.strokeStyle = '#a8ffd1';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(player.x, player.y, Math.max(size, player.width) * 0.9 * pulse, 0, Math.PI*2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        } catch (e) { /* ignore drawing errors */ }
    }

    // Glow neon
    ctx.strokeStyle = player.color;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.5;
    ctx.strokeRect(player.x - size / 2 - 5, player.y - size / 2 - 5, size + 10, size + 10);

    ctx.globalAlpha = 1;
}

// drawEnemies removed

function drawItems() {
    items.forEach(item => {
        // Escala según vida restante
        const scale = 0.5 + (item.life / 300) * 0.5;
        
        ctx.fillStyle = item.color;
        ctx.globalAlpha = item.life / 300;
        ctx.fillRect(
            item.x - item.width * scale / 2,
            item.y - item.height * scale / 2,
            item.width * scale,
            item.height * scale
        );

        // Glow
        ctx.strokeStyle = item.color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = (item.life / 300) * 0.5;
        ctx.strokeRect(
            item.x - item.width * scale / 2,
            item.y - item.height * scale / 2,
            item.width * scale,
            item.height * scale
        );

        ctx.globalAlpha = 1;
    });
}

function drawBullets() {
    bullets.forEach(b => {
        // draw trail first
        if (b.trail && b.trail.length) {
            for (let t = 0; t < b.trail.length; t++) {
                const pt = b.trail[t];
                ctx.fillStyle = b.color;
                ctx.globalAlpha = (1 - t / b.trail.length) * 0.5;
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, Math.max(1, b.radius * (1 - t / (b.trail.length + 1)) * 0.6), 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.fillStyle = b.color;
        ctx.globalAlpha = 0.95;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();
        
        // pequeño glow
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6;
        ctx.stroke();
        ctx.globalAlpha = 1;
    });
}

// drawEnemyProjectiles removed

function drawParticles() {
    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    });
}

function render() {
    // Limpiar canvas con efecto de barrido
    ctx.fillStyle = 'rgba(10, 14, 39, 0.1)';
    ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

    // Aplicar rotación si la regla está activa
    if (currentRules.has('rotate-screen')) {
        ctx.save();
        ctx.translate(CONFIG.canvasWidth / 2, CONFIG.canvasHeight / 2);
        ctx.rotate((elapsedTime / 1000) * 0.3);
        ctx.translate(-CONFIG.canvasWidth / 2, -CONFIG.canvasHeight / 2);
    }

    drawParticles();
    drawBullets();
    drawEnemyProjectiles();
    drawEnemies();
    drawItems();
    drawPlayer();

    if (currentRules.has('rotate-screen')) {
        ctx.restore();
    }
}

// ==================== HUD ====================
function updateHUD() {
    elapsedTime = Date.now() - gameStartTime;
    const seconds = Math.floor(elapsedTime / 1000);
    
    document.getElementById('hudTime').textContent = seconds + 's';
    document.getElementById('hudScore').textContent = score;
    
    ruleChangeCountdown = Math.ceil((10000 - (Date.now() - lastRuleChangeTime)) / 1000);
    if (ruleChangeCountdown < 0) ruleChangeCountdown = 10;
    const ruleEl = document.getElementById('hudRuleCountdown');
    if (ruleEl) ruleEl.textContent = ruleChangeCountdown + 's';
    // Mostrar buffs activos
    try {
        const buffs = [];
        if (playerBuffs.damage && playerBuffs.damage > 1) buffs.push('DAÑO x' + playerBuffs.damage);
        if (playerBuffs.fireRateMultiplier && playerBuffs.fireRateMultiplier < 1) buffs.push('FIRERATE');
        if (playerBuffs.shield) buffs.push('SHIELD');
        if (playerBuffs.doublePoints) buffs.push('x2 PUNTOS');
        document.getElementById('hudBuffs').textContent = buffs.length ? buffs.join(' • ') : '—';
    } catch (e) { /* ignore if HUD element missing */ }
}

// ==================== GAME OVER ====================
function endGame() {
    gameRunning = false;
    if (spawnEnemyInterval) { clearInterval(spawnEnemyInterval); spawnEnemyInterval = null; }
    clearInterval(spawnItemInterval);
    clearInterval(changeRuleInterval);
    clearInterval(difficultyInterval);
    
    playSound(100, 1, 0.5);

    const seconds = Math.floor(elapsedTime / 1000);
    document.getElementById('finalTime').textContent = seconds + 's';
    document.getElementById('finalScore').textContent = score;

    saveScore(score, seconds);
    saveScoreToFirebase(Math.floor(score), seconds);
    updateLeaderboardDisplay();

    // Recargar leaderboard global después de guardar
    setTimeout(() => {
        loadGlobalLeaderboard();
    }, 500);

    // Asegurar que la pantalla de inicio esté oculta mientras mostramos Game Over
    try {
        const start = document.getElementById('startScreen');
        if (start) start.classList.add('hidden');
    } catch (e) { /* ignore */ }

    document.getElementById('gameOverScreen').classList.add('show');
}

// ==================== LEADERBOARD ====================
function loadLeaderboard() {
    const stored = localStorage.getItem('chaosArcadeLeaderboard');
    leaderboard = stored ? JSON.parse(stored) : [];
}

function saveScore(points, time) {
    leaderboard.push({ score: points, time: time, date: new Date().toLocaleDateString() });
    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard = leaderboard.slice(0, 10);
    localStorage.setItem('chaosArcadeLeaderboard', JSON.stringify(leaderboard));
}

function updateLeaderboardDisplay() {
    const list = document.getElementById('leaderboardList');
    if (leaderboard.length === 0) {
        list.textContent = 'Sin registros';
        return;
    }

    list.innerHTML = leaderboard.slice(0, 5).map((entry, idx) => 
        `<div>${idx + 1}. ${entry.score} pts (${entry.time}s)</div>`
    ).join('');
}

// ==================== LOOP DEL JUEGO ====================
function gameLoop() {
    if (gameRunning) {
        updateHUD();
        updatePlayer();
        updateEnemies();
        updateBullets();
        updateEnemyProjectiles();
        updateItems();
        updateBuffs();
        updateParticles();
    }

    render();

    requestAnimationFrame(gameLoop);
}

// ==================== INICIO ====================
// ==================== PANTALLAS Y SELECCIÓN DE DIFICULTAD ====================
function showDifficultyScreen() {
    try {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('difficultyScreen').style.display = 'flex';
        // Ocultar pantalla de inicio si estaba visible
        const start = document.getElementById('startScreen');
        if (start) start.classList.add('hidden');
    } catch (e) { console.warn('showDifficultyScreen error:', e); }
}
window.showDifficultyScreen = showDifficultyScreen;

function showLoginScreen() {
    try {
        // Force screens visibility to ensure consistent behavior
        const diff = document.getElementById('difficultyScreen'); if (diff) diff.style.display = 'none';
        const login = document.getElementById('loginScreen'); if (login) login.style.display = 'flex';
        const gos = document.getElementById('gameOverScreen'); if (gos) { gos.classList.remove('show'); gos.style.display = 'none'; }
        const start = document.getElementById('startScreen'); if (start) { start.classList.remove('hidden'); start.style.display = 'flex'; }

        // Reset ligero del estado del juego para permitir reinicio limpio
        gameRunning = false;
        if (spawnEnemyInterval) { clearInterval(spawnEnemyInterval); spawnEnemyInterval = null; }
        if (spawnItemInterval) { clearInterval(spawnItemInterval); spawnItemInterval = null; }
        if (difficultyInterval) { clearInterval(difficultyInterval); difficultyInterval = null; }
        enemies = [];
        enemyProjectiles = [];
        items = [];
        bullets = [];
        particles = [];
        score = 0;
        combo = 0;
    } catch (e) { console.warn('showLoginScreen error:', e); }
}
window.showLoginScreen = showLoginScreen;

// Mostrar únicamente la pantalla de inicio (Start) — útil para el botón "VOLVER AL INICIO"
function showStartScreen() {
    try {
        // Hide other screens
        const login = document.getElementById('loginScreen'); if (login) login.style.display = 'none';
        const diff = document.getElementById('difficultyScreen'); if (diff) diff.style.display = 'none';
        const gos = document.getElementById('gameOverScreen'); if (gos) { gos.classList.remove('show'); gos.style.display = 'none'; }

        // Show start
        const start = document.getElementById('startScreen'); if (start) { start.classList.remove('hidden'); start.style.display = 'flex'; }

        // reset minimal state
        gameRunning = false;
        if (spawnEnemyInterval) { clearInterval(spawnEnemyInterval); spawnEnemyInterval = null; }
        if (spawnItemInterval) { clearInterval(spawnItemInterval); spawnItemInterval = null; }
        enemies = []; bullets = []; items = []; particles = [];
        score = 0; combo = 0;
    } catch (e) { console.warn('showStartScreen error:', e); }
}
window.showStartScreen = showStartScreen;

function setDifficulty(level) {
    try {
        if (!DIFFICULTY_SETTINGS[level]) {
            console.warn('Dificultad no válida:', level);
            return;
        }
        CONFIG.difficulty = level;

        // Marcar visualmente el botón seleccionado (si existe CSS para .selected)
        const buttons = document.querySelectorAll('.difficulty-button');
        buttons.forEach(btn => {
            // cada botón tiene clases como 'difficulty-button easy'
            const isSelected = btn.classList.contains(level);
            btn.classList.toggle('selected', isSelected);
        });

        // Volver a la pantalla de inicio para que el usuario pulse "COMENZAR"
        document.getElementById('difficultyScreen').style.display = 'none';
        const start = document.getElementById('startScreen');
        if (start) start.classList.remove('hidden');

        // Feedback sonoro
        try { playSound(700, 0.08, 0.08); } catch (e) { /* ignore */ }
    } catch (e) {
        console.error('setDifficulty error:', e);
    }
}
window.setDifficulty = setDifficulty;

// Iniciar después de definir helpers
window.addEventListener('load', init);

// Manejar cambio de visibilidad para pausar audio
document.addEventListener('visibilitychange', () => {
    if (document.hidden && audioContext) {
        // Podrías pausar aquí si implementas música
    }
});

// ==================== AUTENTICACIÓN ROBUSTA CON GOOGLE ====================
function initializeFirebaseAuth() {
    if (!auth) {
        console.warn('Firebase Auth no está disponible');
        document.getElementById('userInfo').style.display = 'none';
        document.getElementById('notLoggedInInfo').style.display = 'block';
        return;
    }

    const provider = new firebase.auth.GoogleAuthProvider();

    // Escuchar cambios de estado de autenticación
    auth.onAuthStateChanged(user => {
        currentUser = user;
        if (user) {
            document.getElementById('userInfo').style.display = 'block';
            document.getElementById('notLoggedInInfo').style.display = 'none';
            try {
                const nameEl = document.getElementById('userName');
                const imgEl = document.getElementById('userPhoto');
                if (nameEl) nameEl.textContent = user.displayName || 'Usuario';
                if (imgEl && user.photoURL) imgEl.src = user.photoURL;
            } catch (e) { /* silent */ }
            loadGlobalLeaderboard();
        } else {
            document.getElementById('userInfo').style.display = 'none';
            document.getElementById('notLoggedInInfo').style.display = 'block';
            loadGlobalLeaderboard();
        }
    });

    // Configurar botón de inicio (si existe)
    const btn = document.getElementById('googleSignInBtn');
    if (btn) {
        btn.style.display = 'inline-block';
        btn.disabled = false;
        btn.textContent = 'INICIAR SESIÓN CON GOOGLE';
        btn.addEventListener('click', (ev) => {
            ev.preventDefault();
            // El click del usuario permite abrir popup sin ser bloqueado
            signInWithGoogle().catch(err => {
                console.error('signInWithGoogle error (on click):', err);
            });
        });
    }

    // Intentar resolver resultado de un redirect anterior, si lo hubiera.
    // Si falla por "missing initial state" o entorno particionado, no forzamos otro redirect.
    auth.getRedirectResult().then(result => {
        if (result && result.user) {
            // Autenticación completada por redirect; onAuthStateChanged la manejará.
            return;
        }
        // No hay usuario: no forzamos redirect automático aquí para evitar el error "missing initial state".
        // Dejamos que el usuario haga click en el botón (popup) o intente redirect manualmente.
    }).catch(err => {
        // Detectar missing initial state (mensaje clásico de Firebase) y no intentar redirect automáticamente
        const msg = (err && err.message) ? err.message.toLowerCase() : '';
        if (msg.includes('missing initial state') || msg.includes('sessionstorage') || msg.includes('storage')) {
            console.warn('getRedirectResult falló por estado inicial faltante o problema de almacenamiento. Habilite el botón de login y use popup en su lugar.', err);
            // Asegurar que el botón esté activo para que el usuario intente popup manualmente
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'INICIAR SESIÓN CON GOOGLE';
            }
            // Mostrar mensaje claro al usuario
            const errEl = document.getElementById('authError');
            if (errEl) {
                errEl.style.display = 'block';
                errEl.textContent = 'No fue posible completar login por redirect (estado inicial faltante). Usa el botón de "INICIAR SESIÓN CON GOOGLE" y permite popups/cookies en tu navegador.';
            }
            return;
        }
        console.warn('getRedirectResult error:', err);
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'INICIAR SESIÓN CON GOOGLE';
        }
        const errEl2 = document.getElementById('authError');
        if (errEl2) {
            errEl2.style.display = 'block';
            errEl2.textContent = 'Error al comprobar autenticación: ' + (err && err.message ? err.message : 'desconocido');
        }
    });
}

// Intentar iniciar sesión: preferir popup (requiere interacción), si falla -> redirect
async function signInWithGoogle() {
    if (!auth) throw new Error('Auth no disponible');
    const provider = new firebase.auth.GoogleAuthProvider();
    const btn = document.getElementById('googleSignInBtn');

    try {
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Procesando...';
        }

        // Fijar persistencia LOCAL para evitar dependencia de sessionStorage si es posible
        if (auth.setPersistence) {
            try {
                await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
            } catch (e) {
                // si falla, continuar; no crítico
                console.warn('No se pudo establecer persistencia LOCAL:', e);
            }
        }

        // Intentar popup (mejor cuando hay interacción del usuario)
        try {
            await auth.signInWithPopup(provider);
            return;
        } catch (popupErr) {
            // Si popup falla (bloqueado o no soportado), probamos redirect como fallback.
            console.warn('signInWithPopup falló, intentando signInWithRedirect:', popupErr);
            const errEl = document.getElementById('authError');
            if (errEl) {
                errEl.style.display = 'block';
                errEl.textContent = 'Popup bloqueado o no disponible. Intentando login por redirect como alternativa...';
            }
            try {
                await auth.signInWithRedirect(provider);
                return;
            } catch (redirectErr) {
                // Si redirect falla por missing initial state u otros, informar y reactivar botón
                console.error('signInWithRedirect también falló:', redirectErr);
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'INICIAR SESIÓN CON GOOGLE';
                }
                const errEl2 = document.getElementById('authError');
                if (errEl2) {
                    errEl2.style.display = 'block';
                    errEl2.textContent = 'No se pudo iniciar sesión: ' + (redirectErr && redirectErr.message ? redirectErr.message : 'error desconocido') + '. Asegura cookies y popups habilitados.';
                }
                throw redirectErr;
            }
        }
    } catch (e) {
        // Reactivar botón y mostrar estado
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'INICIAR SESIÓN CON GOOGLE';
        }
        throw e;
    }
}

// Exponer en window para que onclick inline o HTML pueda usarlo
window.signInWithGoogle = signInWithGoogle;

// Wrapper usado por el HTML (evita error de function not found)
function logoutUser() {
    // delegar en la función signOut existente
    signOut().catch(e => console.error('Error logoutUser:', e));
}
window.logoutUser = logoutUser;

async function signOut() {
    if (!auth) return;
    try {
        await auth.signOut();
        currentUser = null;
        document.getElementById('userInfo').style.display = 'none';
        document.getElementById('notLoggedInInfo').style.display = 'block';
    } catch (e) {
        console.error('Error al cerrar sesión:', e);
    }
}

// ==================== GUARDAR SCORES LOCALMENTE ====================
async function saveScoreToFirebase(scoreValue, time) {
    // Si no hay Firestore o no hay usuario, almacenar solo localmente y mostrar mensaje
    if (!db || !auth) {
        console.log('Firestore o Auth no disponible. Score guardado localmente:', scoreValue);
        return;
    }

    const data = {
        score: scoreValue,
        time: time,
        difficulty: CONFIG.difficulty || 'normal',
        date: new Date(),
        userId: currentUser ? currentUser.uid : null,
        userName: currentUser ? (currentUser.displayName || 'Anónimo') : 'Anónimo'
    };

    try {
        await db.collection('scores').add(data);
        console.log('Score guardado en Firestore:', data);
    } catch (e) {
        console.error('Error guardando score en Firestore:', e);
    }
}

// ==================== CARGAR LEADERBOARD GLOBAL ====================
async function loadGlobalLeaderboard() {
    if (!db) {
        document.getElementById('globalLeaderboardList').innerHTML = 
            '<p style="text-align: center; color: #ff006e;">Firebase no disponible</p>';
        return;
    }
    
    try {
        const snapshot = await db.collection('scores')
            .orderBy('score', 'desc')
            .limit(15)
            .get();
        
        const globalScores = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            // Excluir entradas sin userId (no autenticadas)
            if (data && data.userId) globalScores.push(data);
        });
        
        displayGlobalLeaderboard(globalScores);
    } catch (error) {
        console.error('Error al cargar leaderboard global:', error);
        document.getElementById('globalLeaderboardList').innerHTML = 
            '<p style="text-align: center; color: #ff006e;">Error al cargar</p>';
    }
}

function displayGlobalLeaderboard(scores) {
    const list = document.getElementById('globalLeaderboardList');
    
    if (scores.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: #ffb86c;">Sin registros aún</p>';
        return;
    }
    
    let html = '';
    scores.forEach((score, index) => {
        const medalEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '⭐';
        const difficultyColor = {
            easy: '#50fa7b',
            normal: '#ffb86c',
            hard: '#ff79c6',
            extreme: '#ff5555'
        }[score.difficulty] || '#00ff9f';
        
        html += `
            <div class="global-entry">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span class="global-entry-rank">${medalEmoji} ${index + 1}.</span>
                        <span class="global-entry-name">${escapeHtml(score.userName || 'Anónimo')}</span>
                    </div>
                    <span class="global-entry-score">${score.score} pts</span>
                </div>
                <div class="global-entry-difficulty" style="color: ${difficultyColor};">
                    ${score.difficulty.toUpperCase()} • ${score.time}s
                </div>
            </div>
        `;
    });
    
    list.innerHTML = html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
