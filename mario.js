const canvas = document.getElementById('marioCanvas');
const ctx = canvas.getContext('2d');

const TILE_SIZE = 32;
const GRAVITY = 0.45;
const FRICTION = 0.85;

let score = 0;
let coins = 0;
let cameraX = 0;

// 加载 FC 原版高清 Spritesheet 资源
const spriteSheet = new Image();
spriteSheet.src = 'https://unpkg.com/super-mario-sprites@1.0.0/spritesheet.png';

// 地图数据：0:空白, 1:地面砖, 2:蘑菇/火花问号砖, 3:金币问号砖, 4:已用砖
const MAP_WIDTH = 70;
const MAP_HEIGHT = 14;
const levelMap = [
    ...Array(10).fill().map(() => Array(MAP_WIDTH).fill(0)),
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,1,3,1,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    Array(MAP_WIDTH).fill(1).map((v, i) => (i >= 26 && i <= 28) ? 0 : 1),
    Array(MAP_WIDTH).fill(1).map((v, i) => (i >= 26 && i <= 28) ? 0 : 1),
];

const keys = { left: false, right: false, jump: false, run: false };

window.addEventListener('keydown', e => {
    if (e.key === 'a' || e.key === 'ArrowLeft') keys.left = true;
    if (e.key === 'd' || e.key === 'ArrowRight') keys.right = true;
    if (e.key === 'j' || e.key === 'Shift') {
        keys.run = true;
        if (mario.state === 'fire') mario.shootFireball();
    }
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

function setupTouchControls() {
    function bindBtn(id, keyName, action) {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            keys[keyName] = true;
            if (action) action();
        });
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            keys[keyName] = false;
        });
    }

    bindBtn('btn-left', 'left');
    bindBtn('btn-right', 'right');
    bindBtn('btn-jump', 'jump', () => {
        if (mario.grounded) {
            mario.vy = -10.8;
            mario.grounded = false;
        }
    });
    bindBtn('btn-run', 'run', () => {
        if (mario.state === 'fire') mario.shootFireball();
    });
}

// 马里奥角色类（支持三种状态：small, big, fire）
const mario = {
    x: 50,
    y: 300,
    width: 28,
    height: 32, // 变大后为 64
    vx: 0,
    vy: 0,
    speed: 3.8,
    grounded: false,
    facing: 'right',
    state: 'small', // 'small' | 'big' | 'fire'
    invulnerableTimer: 0, // 受到伤害后的无敌闪烁时间
    animFrame: 0,

    update() {
        if (this.invulnerableTimer > 0) this.invulnerableTimer--;

        let currentSpeed = keys.run ? this.speed * 1.4 : this.speed;

        if (keys.right) {
            if (this.vx < currentSpeed) this.vx += 0.45;
            this.facing = 'right';
            this.animFrame += 0.2;
        } else if (keys.left) {
            if (this.vx > -currentSpeed) this.vx -= 0.45;
            this.facing = 'left';
            this.animFrame += 0.2;
        } else {
            this.vx *= FRICTION;
            this.animFrame = 0;
        }

        this.vy += GRAVITY;

        this.x += this.vx;
        this.checkCollisionX();

        this.grounded = false;
        this.y += this.vy;
        this.checkCollisionY();

        if (this.y > canvas.height + 50) this.die();
    },

    grow() {
        if (this.state === 'small') {
            this.state = 'big';
            this.y -= 32;
            this.height = 64;
        } else if (this.state === 'big') {
            this.state = 'fire';
        }
    },

    takeDamage() {
        if (this.invulnerableTimer > 0) return;

        if (this.state === 'fire') {
            this.state = 'big';
            this.invulnerableTimer = 60;
        } else if (this.state === 'big') {
            this.state = 'small';
            this.height = 32;
            this.invulnerableTimer = 60;
        } else {
            this.die();
        }
    },

    shootFireball() {
        fireballs.push(new Fireball(this.x + (this.facing === 'right' ? this.width : -10), this.y + 16, this.facing));
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
                            // 顶砖逻辑
                            if (levelMap[r][c] === 2) {
                                levelMap[r][c] = 4;
                                spawnItem(c * TILE_SIZE, (r - 1) * TILE_SIZE);
                            } else if (levelMap[r][c] === 3) {
                                levelMap[r][c] = 4;
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
        if (this.invulnerableTimer % 4 >= 2) return; // 闪烁效果

        ctx.save();
        if (spriteSheet.complete && spriteSheet.naturalWidth !== 0) {
            let srcY = 44; // 小马里奥 Y 坐标
            if (this.state === 'big') srcY = 0;
            if (this.state === 'fire') srcY = 88;

            let frameX = 276;
            if (!this.grounded) frameX = 359;
            else if (Math.abs(this.vx) > 0.5) frameX = (Math.floor(this.animFrame) % 3 === 0) ? 290 : 304;

            let srcH = this.state === 'small' ? 16 : 32;

            if (this.facing === 'left') {
                ctx.translate(this.x + this.width, this.y);
                ctx.scale(-1, 1);
                ctx.drawImage(spriteSheet, frameX, srcY, 16, srcH, 0, 0, this.width, this.height);
            } else {
                ctx.drawImage(spriteSheet, frameX, srcY, 16, srcH, this.x, this.y, this.width, this.height);
            }
        } else {
            ctx.fillStyle = this.state === 'fire' ? '#fff' : '#b53120';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
        ctx.restore();
    },

    die() {
        this.state = 'small';
        this.height = 32;
        this.x = 50;
        this.y = 300;
        this.vx = 0;
        this.vy = 0;
        cameraX = 0;
        initEntities();
    }
};

// 道具管理（变大蘑菇与火花）
let items = [];
function spawnItem(x, y) {
    if (mario.state === 'small') {
        items.push({ x, y, width: 30, height: 30, type: 'mushroom', vx: 1.5, vy: 0 });
    } else {
        items.push({ x, y, width: 30, height: 30, type: 'flower' });
    }
}

function updateItems() {
    items.forEach((item, index) => {
        if (item.type === 'mushroom') {
            item.vy += GRAVITY;
            item.x += item.vx;
            item.y += item.vy;
            // 简单地面碰撞
            if (item.y > 320) { item.y = 320; item.vy = 0; }
        }

        let itemCanvasX = item.x - cameraX;
        if (isColliding(mario.x, mario.y, mario.width, mario.height, itemCanvasX, item.y, item.width, item.height)) {
            mario.grow();
            score += 1000;
            updateHUD();
            items.splice(index, 1);
        }
    });
}

function drawItems() {
    items.forEach(item => {
        let x = item.x - cameraX;
        if (spriteSheet.complete && spriteSheet.naturalWidth !== 0) {
            let srcX = item.type === 'mushroom' ? 0 : 64;
            ctx.drawImage(spriteSheet, srcX, 32, 16, 16, x, item.y, item.width, item.height);
        } else {
            ctx.fillStyle = item.type === 'mushroom' ? '#ea9e22' : '#f00';
            ctx.fillRect(x, item.y, item.width, item.height);
        }
    });
}

// 板栗仔 (Goomba)
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
        this.timer = 0;
    }

    update() {
        if (this.squashed) {
            if (++this.timer > 20) this.alive = false;
            return;
        }

        this.vy += GRAVITY;
        this.x += this.vx;
        this.y += this.vy;
        if (this.y > 320) { this.y = 320; this.vy = 0; }

        if (isColliding(mario.x, mario.y, mario.width, mario.height, this.x, this.y, this.width, this.height)) {
            if (mario.vy > 0 && (mario.y + mario.height - mario.vy) <= this.y + 12) {
                this.squashed = true;
                mario.vy = -7;
                score += 100;
                updateHUD();
            } else {
                mario.takeDamage();
            }
        }
    }

    draw() {
        if (this.squashed) {
            ctx.fillStyle = '#a84010';
            ctx.fillRect(this.x, this.y + 16, this.width, 14);
            return;
        }
        if (spriteSheet.complete && spriteSheet.naturalWidth !== 0) {
            ctx.drawImage(spriteSheet, 0, 16, 16, 16, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = '#8b4513';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }
}

// 绿壳龟 (Koopa Paratroopa / Troop)
class Koopa {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 44;
        this.vx = -1.0;
        this.vy = 0;
        this.alive = true;
        this.isShell = false;
        this.shellSpeed = 0;
    }

    update() {
        this.vy += GRAVITY;
        this.x += this.isShell ? this.shellSpeed : this.vx;
        this.y += this.vy;
        if (this.y > 308) { this.y = 308; this.vy = 0; }

        if (isColliding(mario.x, mario.y, mario.width, mario.height, this.x, this.y, this.width, this.height)) {
            if (mario.vy > 0 && (mario.y + mario.height - mario.vy) <= this.y + 16) {
                mario.vy = -7;
                if (!this.isShell) {
                    this.isShell = true;
                    this.height = 30;
                    this.y += 14;
                    this.shellSpeed = 0;
                } else {
                    // 踢飞龟壳
                    this.shellSpeed = mario.x < this.x ? 6 : -6;
                }
            } else {
                if (this.isShell && this.shellSpeed === 0) {
                    // 安全踢飞
                    this.shellSpeed = mario.x < this.x ? 6 : -6;
                } else {
                    mario.takeDamage();
                }
            }
        }
    }

    draw() {
        if (spriteSheet.complete && spriteSheet.naturalWidth !== 0) {
            let srcX = this.isShell ? 360 : 180;
            let srcH = this.isShell ? 16 : 24;
            ctx.drawImage(spriteSheet, srcX, 16, 16, srcH, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = '#22c55e';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }
}

// 火花子弹类
let fireballs = [];
class Fireball {
    constructor(x, y, dir) {
        this.x = x;
        this.y = y;
        this.vx = dir === 'right' ? 6 : -6;
        this.vy = 2;
        this.alive = true;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.y >= 330) { this.vy = -4; } // 反弹

        enemies.forEach(e => {
            if (e.alive && isColliding(this.x, this.y, 12, 12, e.x, e.y, e.width, e.height)) {
                e.alive = false;
                this.alive = false;
                score += 200;
                updateHUD();
            }
        });

        if (this.x < 0 || this.x > canvas.width + 100) this.alive = false;
    }

    draw() {
        ctx.fillStyle = '#ff4500';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 6, 0, Math.PI * 2);
        ctx.fill();
    }
}

// 敌人集合
let enemies = [];
function initEntities() {
    enemies = [
        new Goomba(450, 320),
        new Koopa(750, 308),
        new Goomba(1100, 320)
    ];
    items = [];
    fireballs = [];
}

function isColliding(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

function updateCamera() {
    if (mario.x > canvas.width / 2) {
        let diff = mario.x - canvas.width / 2;
        cameraX += diff;
        mario.x -= diff;
        enemies.forEach(e => e.x -= diff);
        items.forEach(i => i.x -= diff);
    }
}

function updateHUD() {
    document.getElementById('coins').textContent = String(coins).padStart(2, '0');
    document.getElementById('score').textContent = String(score).padStart(6, '0');
}

function drawMap() {
    for (let r = 0; r < MAP_HEIGHT; r++) {
        for (let c = 0; c < MAP_WIDTH; c++) {
            let tile = levelMap[r][c];
            if (tile !== 0) {
                let x = c * TILE_SIZE - cameraX;
                let y = r * TILE_SIZE;

                if (spriteSheet.complete && spriteSheet.naturalWidth !== 0) {
                    let srcX = (tile === 1) ? 0 : (tile === 2 || tile === 3 ? 384 : 432);
                    ctx.drawImage(spriteSheet, srcX, 0, 16, 16, x, y, TILE_SIZE, TILE_SIZE);
                } else {
                    ctx.fillStyle = tile === 1 ? '#c84c0c' : '#ea9e22';
                    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                }
            }
        }
    }
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    mario.update();
    updateCamera();
    updateItems();

    enemies = enemies.filter(e => e.alive);
    enemies.forEach(e => { e.update(); e.draw(); });

    fireballs = fireballs.filter(f => f.alive);
    fireballs.forEach(f => { f.update(); f.draw(); });

    drawMap();
    drawItems();
    mario.draw();

    requestAnimationFrame(gameLoop);
}

initEntities();
setupTouchControls();
gameLoop();
