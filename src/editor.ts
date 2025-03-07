
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

const assetPaths = [
    'img/empty.png',
    ... atlasPaths
];

const loadedAtlases: { [k: string]: HTMLImageElement } = {};

let loading = true;

let toolSize = 64;
let gridSize = 64;
let sliceSize = 16;
let toolOffset: number;

let objects: { x: number, y: number, tileX: number, tileY: number, atlas: string }[] = [];

let ui: UI<any>[] = [];

let curAtlas = 'img/grass.png';
let currentTile: { x: number, y: number } | undefined;

type ImageSlice = { kind: 'image', src: string, dx: number, dy: number, w: number, h: number }
type TextProps  = { kind: 'text', text: string, font: string, color: string }

type UI<T> = Button<T>

type Button<T> = {
    kind: 'button',
    id: string,
    data: T,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    borderW: number,
    inner: ImageSlice | TextProps,
    onClick: (o: Button<T>) => void
}

export function setup() {

    registerShortcuts(KbShortcuts);

    listen('mouseup', onClickHandler);
    listen('resize', regenerateUI);

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

    let touchId: number | undefined;
    let touchY: number;
    canvas.addEventListener('touchstart', e => {
        if (e.touches.length === 2) {
            touchId = e.touches[0].identifier;
            touchY = e.touches[0].screenY;
        }
    });

    canvas.addEventListener('touchmove', e => {
        // this disables two-finger zooming on safari
        if ('scale' in e && (e as any).scale !== 1) {
            e.preventDefault();
        }

        const touch = [... e.touches].find(t => t.identifier === touchId);
        if (!touch) {
            return;
        }

        const deltaY = touchY - touch.screenY;
        gridSize = clamp(gridSize + (deltaY > 0 ? 16 : -16), 16, 128);
    }, { passive: false /* in safari defaults to `true` for touch and scroll events */ });

    canvas.addEventListener('touchend', e => {
        touchId = undefined;
    });

    loadAtlases();
}

export function tearDown() {
    unlisten('mouseup', onClickHandler);
    removeShortcuts(KbShortcuts);
}

function loadAtlases() {
    let leftToLoad = assetPaths.length;

    for (const p of assetPaths) {
        const img = new Image();

        img.onload = () => {
            loadedAtlases[p] = img;

            if (--leftToLoad === 0) {
                loading = false;
                regenerateUI();
            }
        };

        img.src = p;
    }
}

export function draw(dt: number) {
    if (loading) {
        drawLoading();
        return;
    }

    // clear the screen
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    drawUI();
    drawGrid();
    drawObjects();
    drawCursor();
}

function drawLoading() {
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#34495E';
    ctx.font = '32px serif';

    const dots = (Date.now() % 1000) / 250 | 0;
    const dims = ctx.measureText(`Loading ...`);

    ctx.fillText(`Loading ${'.'.repeat(dots)}`, (width - dims.width) / 2, (height - dims.fontBoundingBoxAscent) / 2);
}

function drawGrid() {

    ctx.fillStyle = 'darkgray';
    for (let x = 0; x < width; x += gridSize) {
        ctx.fillRect(x, 0, 1, toolOffset);
    }

    for (let y = 0; y < toolOffset; y += gridSize) {
        ctx.fillRect(0, y, width, 1);
    }

    // the last horizontal line (in case of off-tile height)
    ctx.fillRect(0, toolOffset, width, 1);
}

function drawUI() {
    for (const o of ui) {
        switch (o.kind) {
            case 'button': drawButton(o); break;
        }
    }
}

function drawButton(o: Button<unknown>) {
    if (o.inner.kind === 'text') {
        ctx.fillStyle = o.inner.color;
        ctx.font = o.inner.font;

        const dims = ctx.measureText(o.inner.text);
        const ch = Math.round((o.h - dims.actualBoundingBoxAscent) / 2);
        ctx.fillText(o.inner.text, o.x + o.w - dims.width - 4 | 0, o.y + dims.actualBoundingBoxAscent + ch | 0);
    }

    if (o.inner.kind === 'image') {
        const atlas = loadedAtlases[o.inner.src];

        ctx.drawImage(atlas, o.inner.dx, o.inner.dy, o.inner.w, o.inner.h, o.x, o.y, o.w, o.h);
    }

    if (o.borderW) {
        ctx.strokeStyle = o.color;
        ctx.lineWidth = o.borderW;

        ctx.strokeRect(o.x, o.y, o.w, o.h);
    }
}

function drawObjects() {
    for (const o of objects) {
        const atlas = loadedAtlases[o.atlas];

        ctx.drawImage(atlas, o.tileX * sliceSize, o.tileY * sliceSize, sliceSize, sliceSize, o.x, o.y, gridSize, gridSize);
    }
}

function drawCursor() {
    if (!currentTile) {
        return;
    }

    if (mouseY > toolOffset) {
        return;
    }

    const x = Math.floor(mouseX / gridSize) * gridSize;
    const y = Math.floor(mouseY / gridSize) * gridSize;
    const atlas = loadedAtlases[curAtlas];

    ctx.drawImage(atlas, currentTile.x * sliceSize, currentTile.y * sliceSize , sliceSize, sliceSize, x, y, gridSize, gridSize);
}

function onEscape() {
    currentTile = undefined;
}

function onClickHandler() {
    for (const o of ui) {
        if (mouseX >= o.x && mouseX <= o.x + o.w
            && mouseY >= o.y && mouseY <= o.y + o.h) {

            o.onClick(o);
            break;
        }
    }

    if (mouseY <= toolOffset) {
        if (!currentTile) {
            return;
        }

        const x = Math.floor(mouseX / gridSize) * gridSize;
        const y = Math.floor(mouseY / gridSize) * gridSize;
        objects.push({ x, y, tileX: currentTile.x, tileY: currentTile.y, atlas: curAtlas });

        return;
    }
}

function regenerateUI() {
    if (loading) {
        return;
    }

    toolSize = (width < 600) ? 32 : 64;

    ctx.imageSmoothingEnabled = false;
    toolOffset = height - (toolSize + 5) * 4 - 5 - 5;

    ui = [
        createZoomButton(),
        ... createAtlasList(),
        ... createAtlasTiles(),
    ];
}

function createZoomButton(): Button<undefined> {
    const aw = (width < 600) ? 90 : 150;
    const w = (width < 600) ? 35 : 50;
    const h = (width < 600) ? 12  : 21;
    const font = (width < 600) ? '9px monospace' : '14px monospace';

    return {
        kind: 'button',
        id: 'zoomButton',
        data: undefined,
        x: width - aw - w,
        y: toolOffset + 10,
        w: w - 5,
        h,
        color: 'darkgray',
        borderW: 1,
        inner: {
            kind: 'text',
            get text() {
                return 'x' + gridSize;
            },
            font,
            color: 'darkgray'
        },
        onClick: onZoomButtonClick
    };
}

function onZoomButtonClick(x: ReturnType<typeof createZoomButton>) {
    gridSize = gridSize + 16;
    if (gridSize > 128) {
        gridSize = 16;
    }
}

function createAtlasList(): Button<undefined>[] {
    const w = (width < 600) ? 90 : 150;
    const h = (width < 600) ? 12  : 21;
    const font = (width < 600) ? '9px monospace' : '14px monospace';

    return atlasPaths.map<Button<undefined>>((path, i) => {
        const text = path
            .replace('img/', '')
            .replace('.png', '');

        return {
            kind: 'button',
            id: path,
            data: undefined,
            x: width - w,
            y: toolOffset + 10 + i * h,
            w: w - 1,
            h: h,
            color: 'darkgray',
            borderW: 1,
            inner: {
                kind: 'text',
                text,
                font,
                get color() {
                    return path === curAtlas ? 'floralwhite' : 'darkgray';
                }
            },
            onClick: onAtlasButtonClick
        };
    });
}

function onAtlasButtonClick(x: ReturnType<typeof createAtlasList>[0]) {
    curAtlas = x.id;
    currentTile = undefined;
    regenerateUI();
}

function createAtlasTiles(): Button<{x: number, y: number}>[] {

    const atlas = loadedAtlases[curAtlas];

    const aw = atlas.width / sliceSize;
    const ah = atlas.height / sliceSize;
    const maxTiles = Math.floor((width - 205) / (toolSize + 5)) * 4;
    const count = Math.min(ah * aw, maxTiles);

    const acc = [];
    for (let i = 0; i < count; ++i) {
        const ax = i % aw;
        const ay = i / aw | 0;

        const tx = Math.floor(ay / 4) * aw + ax;
        const ty = ay % 4;

        const btn: Button<{x: number, y: number}> = {
            kind: 'button',
            id: 'btn:' + ax + ':' + ay,
            data: { x: ax, y: ay },
            x: 5 + tx * (toolSize + 5),
            y: toolOffset + 10 + ty * (toolSize + 5),
            w: toolSize,
            h: toolSize,
            color: '#cc0909',
            get borderW() { return currentTile === this.data ? 2 : 0 },
            inner: {
                kind: 'image',
                src: curAtlas,
                dx: ax * sliceSize,
                dy: ay * sliceSize,
                w: sliceSize,
                h: sliceSize
            },
            onClick: onAtlasTileClick
        };

        acc.push(btn);
    }

    return acc;
}

function onAtlasTileClick(x: ReturnType<typeof createAtlasTiles>[0]) {
    currentTile = currentTile === x.data
        ? undefined
        : x.data;
}
