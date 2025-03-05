
import {
    canvas, ctx,

    width, height, mouseX, mouseY, pressedKeys, listen, unlisten, registerShortcuts, removeShortcuts, addDebugMsg
} from './engine'

import { clamp } from 'util'

import type { Shortcut } from './keyboard'


const KbShortcuts: Shortcut[] = [
    [onEscape, 'ESC'],
];

const atlasPaths = [
    'img/dirt-v2.png',
    'img/dirt-wide-v2.png',
    'img/dirt-wide.png',
    'img/dirt.png',
    'img/doors.png',
    'img/fences.png',
    'img/grass.png',
    'img/hills.png',
    'img/house-roof.png',
    'img/house-walls.png',
    'img/water.png',
];

const loadedAtlases: { [k: string]: HTMLImageElement } = {};

let loading = true;

let toolSize = 64;
let gridSize = 64;
let toolOffset: number;

let objects: { x: number, y: number, tileX: number, tileY: number, atlas: string }[] = [];

let curAtlas = 'img/grass.png';
let currentTile: { x: number, y: number } | undefined;


export function setup() {
    listen('mouseup', onClickHandler);
    registerShortcuts(KbShortcuts);

    canvas.addEventListener('contextmenu', e => {
        const x = Math.floor(mouseX / gridSize) * gridSize;
        const y = Math.floor(mouseY / gridSize) * gridSize;

        objects = objects.filter(o => o.x !== x || o.y !== y);

        e.preventDefault();
        return false;
    });

    canvas.addEventListener('wheel', e => {
        gridSize = clamp(gridSize + (e.deltaY > 0 ? 16 : -16), 16, 128);
    });

    addDebugMsg(() => '' + toolOffset);
    loadAtlases();
}

export function tearDown() {
    unlisten('mouseup', onClickHandler);
    removeShortcuts(KbShortcuts);
}

function loadAtlases() {
    let leftToLoad = atlasPaths.length;

    atlasPaths.map(p => {
        const img = new Image();

        img.onload = () => {
            loadedAtlases[p] = img;

            if (--leftToLoad === 0) {
                loading = false;
            }
        };

        img.src = p;
    });
}

export function draw(dt: number) {
    ctx.clearRect(0, 0, width, height);

    if (loading) {
        drawLoading();
        return;
    }

    toolOffset = height - (toolSize + 5) * 4 - 5 - 5;

    drawAtlas();
    drawAtlasList();
    drawZoomLevel();
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

    ctx.fillStyle = '#FFF';
    for (let x = 0; x < width; x += gridSize) {
        ctx.fillRect(x, 0, 1, toolOffset);
    }

    for (let y = 0; y < toolOffset; y += gridSize) {
        ctx.fillRect(0, y, width, 1);
    }
}

function drawAtlas() {

    // clear the screen
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#FFF';
    ctx.imageSmoothingEnabled = false;

    ctx.fillRect(0, toolOffset, width, 1);

    // split the tile set
    const tileW = toolSize + 5;
    const atlas = loadedAtlases[curAtlas];
    for (let j = 0; j < atlas.height; j += 16) {
        for (let i = 0; i < atlas.width; i += 16) {
            const layer = (j / 16) % 4;
            const wOffset = Math.floor(j / 16 / 4) * ((atlas.width / 16) * tileW + 5);

            ctx.drawImage(atlas, i, j, 16, 16, 5 + (i / 16) * tileW + wOffset, toolOffset + 10 + layer * tileW, toolSize, toolSize);
        }
    }
}

function drawAtlasList() {
    const offset = toolOffset + 5;

    ctx.fillStyle = '#FFF';
    ctx.font = '16px monospace';

    for (let i = 0; i < atlasPaths.length; ++i) {
        const msg = atlasPaths[i]
            .replace('img/', '')
            .replace('.png', '');

        const dims = ctx.measureText(msg);
        ctx.fillStyle = atlasPaths[i] === curAtlas ? 'floralwhite' : 'darkgray';
        ctx.fillText(msg, width - dims.width - 5, offset + 21 + i * 21);
    }

    ctx.strokeStyle = 'darkgray';
    ctx.lineWidth = 1;
    for (let i = 0; i < atlasPaths.length; ++i) {
        ctx.strokeRect(width - 150, offset + 5 + i * 21, 149, 21);
    }

    // const idx = atlasPaths.indexOf(curAtlas);
    // ctx.strokeStyle = 'floralwhite';
    // ctx.lineWidth = 2;
    // ctx.strokeRect(width - 149, offset + 5 + idx * 21, 148, 21);
}

function drawZoomLevel() {
    const msg = 'x' + gridSize;
    const dims = ctx.measureText(msg);

    ctx.font = '16px monospace';
    ctx.fillStyle = 'darkgray';
    ctx.fillText(msg, width - dims.width - 155, toolOffset + 26);
}

function drawObjects() {
    for (const o of objects) {
        const atlas = loadedAtlases[o.atlas];

        ctx.drawImage(atlas, o.tileX * 16, o.tileY * 16, 16, 16, o.x, o.y, gridSize, gridSize);
    }
}

function drawCursor() {
    if (!currentTile) {
        return;
    }

    const x = mouseY <= toolOffset
        ? Math.floor(mouseX / gridSize) * gridSize
        : mouseX - (gridSize / 2);

    const y = mouseY <= toolOffset
        ? Math.floor(mouseY / gridSize) * gridSize
        : mouseY - (gridSize / 2);

    const atlas = loadedAtlases[curAtlas];
    ctx.drawImage(atlas, currentTile.x * 16, currentTile.y * 16 , 16, 16, x, y, gridSize, gridSize);
}

function onEscape() {
    currentTile = undefined;
}

function onClickHandler() {
    if (mouseY <= toolOffset) {
        if (!currentTile) {
            return;
        }

        const x = Math.floor(mouseX / gridSize) * gridSize;
        const y = Math.floor(mouseY / gridSize) * gridSize;
        objects.push({ x, y, tileX: currentTile.x, tileY: currentTile.y, atlas: curAtlas });

        return;
    }

    const tileW = toolSize + 5;
    const atlas = loadedAtlases[curAtlas];
    const rowWidth = atlas.width / 16 * tileW + 5;

    const x = (mouseX % rowWidth) / tileW | 0;
    const y = (mouseY - toolOffset - 10) / tileW | 0 + Math.floor(mouseX / rowWidth) * 4;

    currentTile = { x, y };

    if (mouseX >= width - 150) {
        const idx = (mouseY - toolOffset - 11) / 21 | 0;
        if (idx < atlasPaths.length) {
            curAtlas = atlasPaths[idx];
        }
    }
}
