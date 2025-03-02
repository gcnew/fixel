
import {
    canvas, ctx,

    width, height, mouseX, mouseY, pressedKeys, listen, registerShortcuts
} from './engine'

import type { Shortcut } from './keyboard'


const KbShortcuts: Shortcut[] = [
    [onEscape, 'ESC'],
];


let loading = true;

let objects: { x: number, y: number, tileX: number, tileY: number }[] = [];

let currentTile: { x: number, y: number } | undefined;

const image = new Image();
image.onload = () => loading = false;
image.src = 'img/grass-set.png';

export function setup() {
    listen('mouseup', onClickHandler);
    registerShortcuts(KbShortcuts);
}

export function tearDown() {
}

export function draw(dt: number) {
    ctx.clearRect(0, 0, width, height);

    if (loading) {
        drawLoading();
        return;
    }

    drawBackground();
    drawGrid();
    drawObjects();
    drawCursor();
}

function drawLoading() {
    ctx.fillStyle = '#34495E';
    ctx.font = '32px serif';

    const dots = (Date.now() % 1000) / 250 | 0;
    const dims = ctx.measureText(`Loading ...`);

    ctx.fillText(`Loading ${'.'.repeat(dots)}`, (width - dims.width) / 2, (height - dims.fontBoundingBoxAscent) / 2);
}

function drawGrid() {
    const offset = height - (64 + 5) * 4 - 5 - 5;

    for (let x = 0; x < width; x += 64) {
        ctx.fillRect(x, 0, 2, offset);
    }

    for (let y = 0; y < offset; y += 64) {
        ctx.fillRect(0, y, width, 2);
    }
}

function drawBackground() {

    // clear the screen
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = '#FFF';

    const offset = height - (64 + 5) * 4 - 5;
    ctx.fillRect(0, offset - 5, width, 2);


    // split the tile set
    for (let j = 0; j < image.height; j += 16) {
        for (let i = 0; i < image.width; i += 16) {
            const layer = (j / 16) % 4;
            const wOffset = Math.floor(j / 16 / 4) * ((image.width / 16) * 69 + 5);

            ctx.drawImage(image, i, j, 16, 16, 5 + (i / 16) * 69 + wOffset, offset + 5 + layer * 69, 64, 64);
        }
    }
}

function drawObjects() {
    for (const o of objects) {
        ctx.drawImage(image, o.tileX * 16, o.tileY * 16, 16, 16, o.x, o.y, 64, 64);
    }
}

function drawCursor() {
    if (!currentTile) {
        return;
    }

    ctx.drawImage(image, currentTile.x * 16, currentTile.y * 16 , 16, 16, mouseX - 32, mouseY - 32, 64, 64);
}

function onEscape() {
    currentTile = undefined;
}

function onClickHandler() {
    const offset = height - (64 + 5) * 4 - 5;

    if (mouseY < offset) {
        if (!currentTile) {
            return;
        }

        const x = Math.floor(mouseX / 64) * 64;
        const y = Math.floor(mouseY / 64) * 64;
        objects.push({ x, y, tileX: currentTile.x, tileY: currentTile.y });

        return;
    }

    const rowWidth = image.width / 16 * 69 + 5;

    const x = (mouseX % rowWidth) / 69 | 0;
    const y = (mouseY - offset) / 69 | 0 + Math.floor(mouseX / rowWidth) * 4;

    currentTile = { x, y };
}
