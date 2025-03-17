
import {
    canvas, ctx,

    width, height, mouseX, mouseY,
    listen, unlisten, registerShortcuts, removeShortcuts,
} from './engine'

import * as ENG from './engine'

import { clamp } from './util'
import type { Shortcut } from './keyboard'
import {
    UI, Button, AutoContainer,

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
    },

    get toolOffset() {
        return toolOffset;
    }
};

const styles = `

    #tiles-container {
        x: 5;
        y: toolOffset + 10;
        w: (width < 600) ? width - 140 : width - 215;
        h: height - toolOffset - 10;
        gap: 5;

        scroll: 'x';
    }

    .tile {
        w: toolSize;
        h: toolSize;
    }

    .tile-active {
        ... .tile;
        borderColor: '#cc0909';
        borderW: 2;
    }

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
    listen('resize', onResize);

    addStylesUI(styleContext, styles);

    addScrollListeners();
    addTouchListeners();

    loadAtlases();
    onResize();
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

function onResize() {
    ctx.imageSmoothingEnabled = false;

    toolSize = (width < 600) ? 32 : 64;
    toolOffset = height - (toolSize + 5) * 4 - 5 - 5;
}

function regenerateUI() {
    if (loading) {
        return;
    }

    ui = [
        createToolsContainer(),
        createAtlasTiles(4),
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

function createAtlasTiles(nRows: number): AutoContainer<{ x: number, y: number }> {

    const atlas = loadedAtlases[curAtlas]!;

    const ac = atlas.width / sliceSize;
    const ar = atlas.height / sliceSize;
    const count = ar * ac;

    const cols = [];
    let rows = [];
    let currRow = [];

    for (let i = 0; i < count; ++i) {
        const ax = i % ac;
        const ay = i / ac | 0;
        const data = { x: ax, y: ay };

        const btn: Button<{x: number, y: number}> = {
            kind: 'button',
            id: 'btn:' + ax + ':' + ay,
            data,

            get style() {
                return currentTile === data ? '.tile-active' : '.tile';
            },

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

        currRow.push(btn);
        if (i % ac === ac - 1) {
            const container: AutoContainer<{ x: number, y: number }> = {
                kind: 'auto-container',
                id: `tiles-row:${cols.length}:${rows.length}`,
                mode: 'row',
                children: currRow,
                style: { gap: 5 },
            };

            rows.push(container);
            currRow = [];
        }

        if (rows.length === nRows || i === count - 1) {
            const container: AutoContainer<{ x: number, y: number }> = {
                kind: 'auto-container',
                id: `tiles-col:${cols.length}`,
                mode: 'column',
                children: rows,
                style: { gap: 5 },
            };

            cols.push(container);
            rows = [];
        }
    }

    const container: AutoContainer<{ x: number, y: number }> = {
        kind: 'auto-container',
        id: 'tiles-container',
        mode: 'row',
        children: cols,
        style: '#tiles-container',
    };

    return container;
}

function onAtlasTileClick(x: Button<NonNullable<typeof currentTile>>) {
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
    let touchX: number;
    let touchId: number | undefined;

    window.addEventListener('touchstart', e => {
        // this disables two-finger zooming on safari
        touchId = e.touches[0]!.identifier;
        touchX = e.touches[0]!.clientX;
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

        const deltaX = touch.clientX - touchX;
        const deltaY = touch.clientY - touchY;

        touchX = touch.clientX;
        touchY = touch.clientY;

        handleScrollUI(ui, deltaX, deltaY);
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
