const canvas = document.getElementById('marioCanvas');
const ctx = canvas.getContext('2d');

// 像素与物理参数 (基于 16x16 瓦片放大至 32x32)
const TILE_SIZE = 32;
const GRAVITY = 0.45;
const FRICTION = 0.85;

let score = 0;
let coins = 0;
let cameraX = 0;

// 加载 FC 原版超级玛丽 Spritesheet 贴图
const spriteSheet = new Image();
spriteSheet.src = 'https://unpkg.com/super-mario-sprites@1.0.0/spritesheet.png';

// 1-1 关卡地图数据 (0: 空白, 1: 地面/普通砖, 2: 问号砖, 3: 空问号砖)
const MAP_WIDTH = 60;
const MAP_HEIGHT = 14;
const levelMap = [
    ...Array(10).fill().map(() => Array(MAP_WIDTH).fill(0)),
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,1,2,1,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    Array(MAP_WIDTH).fill(1).map((v, i) => (i >= 26 && i <= 28) ? 0 : 1),
    Array(MAP_WIDTH).fill(1).map((v, i) => (i >= 26 && i <= 28) ? 0 : 1),
];

// 输入状态管理（同时支持键盘与触控）
const keys = { left: false, right: false, jump: false, run: false };

// 键盘事件绑定
window.addEventListener('keydown', e => {
    if (e.key === 'a' || e.key === 'ArrowLeft') keys.left = true;
    if (e.key === 'd' || e.key === 'ArrowRight') keys.right = true;
    if (e.key === 'j' || e.key === 'Shift') keys.run = true;
    if (e.key === 'k' || e.key === ' ' || e.key === 'ArrowUp') {
        if (!keys.jump && mario.grounded) {
            mario.vy = -10.8;
            mario.grounded = false;
        }
        keys.jump = true;
    }
});

window.addEventListener('keyup', e => {
    if (e.key === 'a' || e.key === 'ArrowLeft') keys.left = false;
    if (e.key === 'd' || e.key === 'ArrowRight') keys.right = false;
    if (e.key === 'j' || e.key === 'Shift') keys.run = false;
    if (e.key === 'k' || e.key === ' ' || e.key === 'ArrowUp') keys.jump = false;
});

// 手机端虚拟触控按键绑定
function setupTouchControls() {
    function bindBtn(id, keyName) {
        const btn = document.getElementById(id);
        if (!btn) return;

        // 支持多点触控并防止默认事件干扰
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            keys[keyName] = true;
            if (keyName === 'jump' && mario.grounded) {
                mario.vy = -10.8;
                mario.grounded = false;
            }
        });

        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            keys[keyName] = false;
        });

        btn.addEventListener('mousedown', () => {
            keys[keyName] = true;
            if (keyName === 'jump' && mario.grounded) {
                mario.vy = -10.8;
                mario.grounded = false;
            }
        });
        btn.addEventListener('mouseup', () => { keys[keyName] = false; });
    }

    bindBtn('btn-left', 'left');
    bindBtn('btn-right', 'right');
    bindBtn('btn-jump', 'jump');
    bindBtn('btn-run', 'run');
}

// 马里奥主角对象
const mario = {
    x: 50,
    y: 300,
    width: 28,
    height: 32,
    vx: 0,
    vy: 0,
    speed: 3.8,
    grounded: false,
    facing: 'right',
    animFrame: 0,

    update() {
        // 冲刺按键加速
        let currentMaxSpeed = keys.run ? this.speed * 1.4 : this.speed;

        if (keys.right) {
            if (this.vx < currentMaxSpeed) this.vx += 0.45;
            this.facing = 'right';
            this.animFrame += 0.2;
        } else if (keys.left) {
            if (this.vx > -currentMaxSpeed) this.vx -= 0.45;
            this.facing = 'left';
            this.animFrame += 0.2;
        } else {
            this.vx *= FRICTION;
            this.animFrame = 0;
        }

        this.vy += GRAVITY;

        // X轴移动与地形碰撞
        this.x += this.vx;
        this.checkCollisionX();

        // Y轴移动与地形碰撞
        this.grounded = false;
        this.y += this.vy;
        this.checkCollisionY();

        // 掉入坑洞死亡
        if (this.y > canvas.height + 50) {
            this.die();
        }
    },

    checkCollisionX() {
        for (let r = 0; r < MAP_HEIGHT; r++) {
            for (let c = 0; c < MAP_WIDTH; c++) {
                if (levelMap[r][c] !== 0) {
                    let tileX = c * TILE_SIZE - cameraX;
                    let tileY = r * TILE_SIZE;

                    if (isColliding(this.x, this.y, this.width, this.height, tileX, tileY, TILE_SIZE, TILE_SIZE)) {
                        if (this.vx > 0) this.x = tileX - this.width;
                        else if (this.vx < 0) this.x = tileX + TILE_SIZE;
                        this.vx = 0;
                    }
                }
            }
        }
    },

    checkCollisionY() {
        for (let r = 0; r < MAP_HEIGHT; r++) {
            for (let c = 0; c < MAP_WIDTH; c++) {
                if (levelMap[r][c] !== 0) {
                    let tileX = c * TILE_SIZE - cameraX;
                    let tileY = r * TILE_SIZE;

                    if (isColliding(this.x, this.y, this.width, this.height, tileX, tileY, TILE_SIZE, TILE_SIZE)) {
                        if (this.vy > 0) {
                            this.y = tileY - this.height;
                            this.vy = 0;
                            this.grounded = true;
                        } else if (this.vy < 0) {
                            this.y = tileY + TILE_SIZE;
                            this.vy = 0;
                            // 顶金币问号砖
                            if (levelMap[r][c] === 2) {
                                levelMap[r][c] = 3;
                                coins++;
                                score += 200;
                                updateHUD();
                            }
                        }
                    }
                }
            }
        }
    },

    draw() {
        ctx.save();
        if (spriteSheet.complete && spriteSheet.naturalWidth !== 0) {
            let frameX = 276; 
            if (!this.grounded) frameX = 359; // 空中跳跃姿态
            else if (Math.abs(this.vx) > 0.5) {
                frameX = (Math.floor(this.animFrame) % 3 === 0) ? 290 : 304; // 跑动帧
            }

            if (this.facing === 'left') {
                ctx.translate(this.x + this.width, this.y);
                ctx.scale(-1, 1);
                ctx.drawImage(spriteSheet, frameX, 44, 16, 16, 0, 0, this.width, this.height);
            } else {
                ctx.drawImage(spriteSheet, frameX, 44, 16, 16, this.x, this.y, this.width, this.height);
            }
        } else {
            // 贴图加载失败时的纯色备用绘制
            ctx.fillStyle = '#b53120';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
        ctx.restore();
    },

    die() {
        this.x = 50;
        this.y = 300;
        this.vx = 0;
        this.vy = 0;
        cameraX = 0;
        initEnemies();
    }
};

// 板栗仔 (Goomba) 敌人类
class Goomba {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 30;
        this.vx = -1.2;
        this.vy = 0;
        this.alive = true;
        this.squashed = false;
        this.squashTimer = 0;
    }

    update() {
        if (this.squashed) {
            this.squashTimer++;
            return;
        }

        this.vy += GRAVITY;
        this.x += this.vx;

        // 撞墙反向巡逻
        for (let r = 0; r < MAP_HEIGHT; r++) {
            for (let c = 0; c < MAP_WIDTH; c++) {
                if (levelMap[r][c] !== 0) {
                    let tileX = c * TILE_SIZE - cameraX;
                    let tileY = r * TILE_SIZE;
                    if (isColliding(this.x, this.y, this.width, this.height, tileX, tileY, TILE_SIZE, TILE_SIZE)) {
                        this.vx = -this.vx;
                        this.x += this.vx;
                    }
                }
            }
        }

        this.y += this.vy;
        // 地面悬停与落脚判定
        for (let r = 0; r < MAP_HEIGHT; r++) {
            for (let c = 0; c < MAP_WIDTH; c++) {
                if (levelMap[r][c] !== 0) {
                    let tileX = c * TILE_SIZE - cameraX;
                    let tileY = r * TILE_SIZE;
                    if (isColliding(this.x, this.y, this.width, this.height, tileX, tileY, TILE_SIZE, TILE_SIZE)) {
                        if (this.vy > 0) {
                            this.y = tileY - this.height;
                            this.vy = 0;
                        }
                    }
                }
            }
        }

        // 与马里奥碰撞逻辑
        if (isColliding(mario.x, mario.y, mario.width, mario.height, this.x, this.y, this.width, this.height)) {
            // 从上方踩下判定
            if (mario.vy > 0 && (mario.y + mario.height - mario.vy) <= this.y + 12) {
                this.squashed = true;
                mario.vy = -7; // 踩中弹跳
                score += 100;
                updateHUD();
            } else {
                // 侧面撞击：马里奥死亡
                mario.die();
            }
        }
    }

    draw() {
        if (this.squashTimer > 20) this.alive = false;

        ctx.save();
        if (this.squashed) {
            ctx.fillStyle = '#a84010';
            ctx.fillRect(this.x, this.y + 16, this.width, 14);
        } else {
            if (spriteSheet.complete && spriteSheet.naturalWidth !== 0) {
                ctx.drawImage(spriteSheet, 0, 16, 16, 16, this.x, this.y, this.width, this.height);
            } else {
                ctx.fillStyle = '#8b4513';
                ctx.fillRect(this.x, this.y, this.width, this.height);
            }
        }
        ctx.restore();
    }
}

// 敌人生成管理
let enemies = [];
function initEnemies() {
    enemies = [
        new Goomba(450, 320),
        new Goomba(750, 320),
        new Goomba(1200, 320)
    ];
}

// 碰撞函数
function isColliding(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

// 摄像机平滑跟随
function updateCamera() {
    if (mario.x > canvas.width / 2) {
        let diff = mario.x - canvas.width / 2;
        cameraX += diff;
        mario.x -= diff;
        enemies.forEach(e => e.x -= diff);
    }
}

// 刷新状态栏UI
function updateHUD() {
    const coinsEl = document.getElementById('coins');
    const scoreEl = document.getElementById('score');
    if (coinsEl) coinsEl.textContent = String(coins).padStart(2, '0');
    if (scoreEl) scoreEl.textContent = String(score).padStart(6, '0');
}

// 地图瓦片绘制
function drawMap() {
    for (let r = 0; r < MAP_HEIGHT; r++) {
        for (let c = 0; c < MAP_WIDTH; c++) {
            let tile = levelMap[r][c];
            if (tile !== 0) {
                let x = c * TILE_SIZE - cameraX;
                let y = r * TILE_SIZE;

                if (tile === 1) { // 地面/砖块
                    if (spriteSheet.complete && spriteSheet.naturalWidth !== 0) {
                        ctx.drawImage(spriteSheet, 0, 0, 16, 16, x, y, TILE_SIZE, TILE_SIZE);
                    } else {
                        ctx.fillStyle = '#c84c0c';
                        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                    }
                } else if (tile === 2) { // 问号砖
                    if (spriteSheet.complete && spriteSheet.naturalWidth !== 0) {
                        ctx.drawImage(spriteSheet, 384, 0, 16, 16, x, y, TILE_SIZE, TILE_SIZE);
                    } else {
                        ctx.fillStyle = '#ea9e22';
                        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                    }
                } else if (tile === 3) { // 顶过的空砖
                    if (spriteSheet.complete && spriteSheet.naturalWidth !== 0) {
                        ctx.drawImage(spriteSheet, 432, 0, 16, 16, x, y, TILE_SIZE, TILE_SIZE);
                    } else {
                        ctx.fillStyle = '#8b4513';
                        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                    }
                }
            }
        }
    }
}

// 主渲染与物理更新循环
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    mario.update();
    updateCamera();

    enemies = enemies.filter(e => e.alive);
    enemies.forEach(enemy => {
        enemy.update();
        enemy.draw();
    });

    drawMap();
    mario.draw();

    requestAnimationFrame(gameLoop);
}

// 初始化启动
initEnemies();
setupTouchControls();
gameLoop();