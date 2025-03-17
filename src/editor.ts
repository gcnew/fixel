
import {
    canvas, ctx,

    width, height, mouseX, mouseY,
    listen, unlisten, registerShortcuts, removeShortcuts,
} from './engine'

import * as ENG from './engine'

import { clamp } from './util'
import type { Shortcut } from './keyboard'
import {
    UI, Button, AutoContainer, OldButton,

    drawUI, handleScrollUI, handleClickUI, addStylesUI, addAtlasesUI, displayBoundingBoxes
} from './ui'


const KbShortcuts: Shortcut[] = [
    [onEscape, 'ESC'],
    [() => displayBoundingBoxes(!displayBoundingBoxes()), ']'],
];

const atlasPaths = [
    'img/chest.png',
    'img/chicken-house.png',
    'img/dirt-v2.png',
    'img/dirt-wide-v2.png',
    'img/dirt-wide.png',
    'img/dirt.png',
    'img/doors.png',
    'img/egg.png',
    'img/fences.png',
    'img/furniture.png',
    'img/grass-biom-things.png',
    'img/grass.png',
    'img/hills.png',
    'img/house-roof.png',
    'img/house-walls.png',
    'img/milk-and-grass-item.png',
    'img/paths.png',
    'img/plants.png',
    'img/tools-and-meterials.png',
    'img/water.png',
    'img/wood-bridge.png',
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

let curAtlas = 'img/grass.png';
let currentTile: { x: number, y: number } | undefined;

let ui: UI<any>[] = [];

const styleContext = {
    get height() {
        return height;
    },

    get width() {
        return width;
    },

    get toolSize() {
        return toolSize;
    }
};

const styles = `

    toolOffset = height - (toolSize + 5) * 4 - 5 - 5;

    #tools-container {
        x: (width < 600) ? width - 125 : width - 200;
        y: toolOffset + 10;
        gap: 5;
    }

    #atlas-list-container {
        maxHeight: height - toolOffset - 10 - ((width < 600) ? 4 : 3);

        borderW: 1;
        borderColor: 'darkgray';
        scroll: 'y';
    }

    #zoom-button {
        w: (width < 600) ? 30 : 45;
        h: (width < 600) ? 12 : 21;
        color: 'darkgray';
        font: (width < 600) ? '9px monospace' : '14px monospace';
        borderW: 1;
        borderColor: 'darkgray';
        marginRight: 5;
    }

    .atlas-list-button {
        w: (width < 600) ? 89 : 149;
        h: (width < 600) ? 12 : 21;
        borderW: 1;
        borderColor: 'darkgray';
        font: (width < 600) ? '9px monospace' : '14px monospace';
        color: 'darkgray';
    }

    .atlas-list-button-active {
        ... .atlas-list-button;
        color: 'floralwhite';
    }
`;

export function setup() {

    registerShortcuts(KbShortcuts);

    listen('mouseup', onClickHandler);
    listen('resize', regenerateUI);

    addStylesUI(styleContext, styles);

    addScrollListeners();
    addTouchListeners();

    loadAtlases();
}

export function tearDown() {
    unlisten('mouseup', onClickHandler);
    removeShortcuts(KbShortcuts);
}

export function draw() {
    if (loading) {
        drawLoading();
        return;
    }

    // clear the screen
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    drawUI(ui);
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

function drawObjects() {
    for (const o of objects) {
        const atlas = loadedAtlases[o.atlas]!;

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
    const atlas = loadedAtlases[curAtlas]!;

    ctx.drawImage(atlas, currentTile.x * sliceSize, currentTile.y * sliceSize , sliceSize, sliceSize, x, y, gridSize, gridSize);
}

function onEscape() {
    currentTile = undefined;
}

function onClickHandler() {
    handleClickUI(ui);

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
        createToolsContainer(),
        ... createAtlasTiles(),
    ];
}

function createToolsContainer() {
    const container: AutoContainer<undefined> = {
        kind: 'auto-container',
        id: 'tools-container',
        mode: 'row',
        children: [ zoomButton, createAtlasList() ],
        style: '#tools-container',
    };

    return container;
}

const zoomButton: Button<undefined> = {
    kind: 'button',
    id: 'zoomButton',
    data: undefined,
    style: '#zoom-button',
    inner: {
        kind: 'text',
        get text() {
            return 'x' + gridSize;
        }
    },

    onClick: () => {
        gridSize = gridSize + 16;
        if (gridSize > 128) {
            gridSize = 16;
        }
    }
};

function createAtlasList(): AutoContainer<undefined> {
    const list = atlasPaths.map<Button<undefined>>(path => {
        const text = path
            .replace('img/', '')
            .replace('.png', '');

        return {
            kind: 'button',
            id: path,
            data: undefined,

            get style() {
                return curAtlas === path ? '.atlas-list-button-active' : '.atlas-list-button';
            },

            inner: { kind: 'text', text },
            onClick: onAtlasButtonClick
        };
    });

    const container: AutoContainer<undefined> = {
        kind: 'auto-container',
        id: 'atlas-list-container',
        mode: 'column',
        children: list,
        style: '#atlas-list-container',
    };

    return container;
}

function onAtlasButtonClick(x: Button<undefined>) {
    curAtlas = x.id;
    currentTile = undefined;
    regenerateUI();
}

function createAtlasTiles(): OldButton<{x: number, y: number}>[] {

    const atlas = loadedAtlases[curAtlas]!;

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

        const btn: OldButton<{x: number, y: number}> = {
            kind: 'old-button',
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

function loadAtlases() {
    let leftToLoad = assetPaths.length;

    for (const p of assetPaths) {
        const img = new Image();

        img.onload = () => {
            loadedAtlases[p] = img;

            if (--leftToLoad === 0) {
                loading = false;
                addAtlasesUI(loadedAtlases);
                regenerateUI();
            }
        };

        img.src = p;
    }
}

function addTouchListeners() {
    let touchY: number;
    let touchId: number | undefined;

    window.addEventListener('touchstart', e => {
        // this disables two-finger zooming on safari
        touchId = e.touches[0]!.identifier;
        touchY = e.touches[0]!.clientY;

        // BIG HACK
        const ref = ENG;
        ref.mouseX = e.touches[0]!.clientX;
        ref.mouseY = e.touches[0]!.clientY;
    }, { passive: false /* in safari defaults to `true` for touch and scroll events */ });

    window.addEventListener('touchmove', e => {
        const touch = [... e.touches].find(t => t.identifier === touchId);
        if (!touch) {
            return;
        }

        const deltaY = touch.clientY - touchY;
        touchY = touch.clientY;

        handleScrollUI(ui, deltaY, deltaY);
    }, { passive: false /* in safari defaults to `true` for touch and scroll events */ });

    window.addEventListener('touchend', () => {
        touchId = undefined;
    }, { passive: false /* in safari defaults to `true` for touch and scroll events */ });
}

function addScrollListeners() {
    canvas.addEventListener('contextmenu', e => {
        const x = Math.floor(mouseX / gridSize) * gridSize;
        const y = Math.floor(mouseY / gridSize) * gridSize;

        objects = objects.filter(o => o.x !== x || o.y !== y);

        e.preventDefault();
        return false;
    });

    canvas.addEventListener('wheel', e => {
        if (handleScrollUI(ui, e.deltaX, e.deltaY)) {
            return;
        }

        gridSize = clamp(gridSize + (e.deltaY > 0 ? 16 : -16), 16, 128);
    });
}
