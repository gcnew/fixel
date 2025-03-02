
import {
    canvas, ctx,

    width, height, clickX, clickY, mouseX, mouseY, pressedKeys
} from './engine'


let loading = true;

const image = new Image();
image.onload = () => loading = false;
image.src = 'img/grass-set.png';

let playerX: number;
let playerY: number;

let playerSpeed = 200;

export function setup() {
    playerX = width / 2;
    playerY = height / 2;
}

export function tearDown() {
}

export function draw(dt: number) {
    ctx.clearRect(0, 0, width, height);

    if (loading) {
        drawLoading();
        return;
    }

    tick(dt);

    drawBackground();
    drawPlayer();
}

function tick(dt: number) {
    const dx = pressedKeys.RIGHT ?  dt :
               pressedKeys.LEFT  ? -dt : 0;
    const dy = pressedKeys.DOWN  ?  dt :
               pressedKeys.UP    ? -dt : 0;

    playerX += dx * playerSpeed / 1000;
    playerY += dy * playerSpeed / 1000;
}

function drawLoading() {
    ctx.fillStyle = '#34495E';
    ctx.font = '32px serif';

    const dots = (Date.now() % 1000) / 250 | 0;
    const dims = ctx.measureText(`Loading ...`);

    ctx.fillText(`Loading ${'.'.repeat(dots)}`, (width - dims.width) / 2, (height - dims.fontBoundingBoxAscent) / 2);
}

function drawBackground() {
    const h = 192;
    const w = 192;

    for (let i = 0; i < height; i += h) {
        for (let j = 0; j < width; j += w) {
            ctx.drawImage(image, j, i, w, h);
        }
    }
}

function drawPlayer() {
    ctx.fillStyle = '#FFF'
    ctx.fillRect(playerX - 20, playerY - 20, 20, 20);
}
