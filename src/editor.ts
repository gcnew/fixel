
import {
    canvas, ctx,

    width, height, mouseX, mouseY, pressedKeys, debug,
    listen, unlisten, registerShortcuts, removeShortcuts, addDebugMsg
} from './engine'

import { clamp } from 'util'

import type { Shortcut } from './keyboard'


const KbShortcuts: Shortcut[] = [
    [onEscape, 'ESC'],
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
    'img/empty.png',
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

let ui: UI<any>[] = [];
let layoutDataCache: { [id: string]: LayoutData } = {};

const computedStyles: { [id: string]: ComputedStyle } = {
    '#tools-container': {
        get x() {
            const aw = (width < 600) ? 90 : 150;
            const w = (width < 600) ? 35 : 50;

            return width - w - aw;
        },

        get y() {
            return toolOffset + 10;
        },

        get w() {
            const aw = (width < 600) ? 90 : 150;
            const w = (width < 600) ? 35 : 50;

            return aw + w - 1;
        },

        get h() {
            return height - toolOffset - 10 - 1;
        },
    },

    '#atlas-list-container': {
        get w() {
            const w = (width < 600) ? 90 : 150;
            return w;
        },

        get h() {
            return height - toolOffset - 10 - 1;
        }
    },

    'zoom-button': {
        get w() {
            const w = (width < 600) ? 35 : 50;
            return  w - 5;
        },

        get h() {
            return (width < 600) ? 12  : 21;
        },

        get color() {
            return 'darkgray';
        },

        get font() {
            return (width < 600) ? '9px monospace' : '14px monospace';
        },

        get borderW() {
            return 1
        },

        get borderColor() {
            return 'darkgray';
        },
    },

    '.atlas-list-button': {
        get w() {
            const w = (width < 600) ? 90 : 150;
            return w - 1;
        },

        get h() {
            return (width < 600) ? 12  : 21;
        },

        get borderW() {
            return 1;
        },

        get borderColor() {
            return 'darkgray';
        },

        get font() {
            return (width < 600) ? '9px monospace' : '14px monospace';
        },

        get color() {
            return 'darkgray';
        },
    },

    '.atlas-list-button-active': {
        get w() {
            const w = (width < 600) ? 90 : 150;
            return w - 1;
        },

        get h() {
            return (width < 600) ? 12  : 21;
        },

        get borderW() {
            return 1;
        },

        get borderColor() {
            return 'darkgray';
        },

        get font() {
            return (width < 600) ? '9px monospace' : '14px monospace';
        },

        get color() {
            return 'floralwhite';
        },
    }
};

let curAtlas = 'img/grass.png';
let currentTile: { x: number, y: number } | undefined;

type ImageSlice = { kind: 'image', src: string, dx: number, dy: number, w: number, h: number }
type TextProps  = { kind: 'text', text: string, font: string, color: string }

type LayoutData = {
    x: number,
    y: number,

    w?: number,
    h?: number,
    color?: string,
    font?: string,
    borderW?: number,
    borderColor?: string,
}

type ComputedStyle = {
    x?: number,
    y?: number,

    w?: number,
    h?: number,
    color?: string,
    font?: string,
    borderW?: number,
    borderColor?: string,
}

type UI<T> = Button<T>
           | AutoContainer<T>
           | OldButton<T>

type OldButton<T> = {
    kind: 'old-button',
    id: string,
    data: T,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    borderW: number,
    inner: ImageSlice | TextProps,
    onClick: (o: OldButton<T>) => void,
}

type Button<T> = {
    kind: 'button',
    id: string,
    data: T,
    style: string | undefined,
    inner: ImageSlice
        | { kind: 'text', text: string, font?: string, color?: string },
    onClick: (o: Button<T>) => void,
}

type AutoContainer<T> = {
    kind: 'auto-container',
    id: string,
    mode: 'column' | 'row',
    children: UI<T>[],
    style: string | undefined,
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

    let touchY: number;
    let touchId: number | undefined;
    let lastT = 0;

    window.addEventListener('touchstart', e => {
        // this disables two-finger zooming on safari
        e.preventDefault();

        if (e.touches.length === 2) {
            touchId = e.touches[0].identifier;
            touchY = e.touches[0].screenY;
        }
    }, { passive: false /* in safari defaults to `true` for touch and scroll events */ });

    window.addEventListener('touchmove', e => {
        // this disables two-finger zooming on safari
        e.preventDefault();

        const touch = [... e.touches].find(t => t.identifier === touchId);
        if (!touch) {
            return;
        }

        const deltaY = touchY - touch.screenY;
        if (Date.now() - lastT < 100 || Math.abs(deltaY) < 10) {
            return;
        }

        lastT = Date.now();
        touchY = touch.screenY;
        gridSize = clamp(gridSize + (deltaY > 0 ? 16 : -16), 16, 128);
    }, { passive: false /* in safari defaults to `true` for touch and scroll events */ });

    window.addEventListener('touchend', e => {
        // this disables two-finger zooming on safari
        e.preventDefault();

        touchId = undefined;
    }, { passive: false /* in safari defaults to `true` for touch and scroll events */ });

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

function drawUI(ui: UI<unknown>[]) {
    for (const o of ui) {
        switch (o.kind) {
            case 'button': drawButton(o); break;
            case 'old-button': drawOldButton(o); break;
            case 'auto-container': drawAutoContainer(o);
        }
    }
}

function drawButton(o: Button<unknown>) {
    const ld = layoutDataCache[o.id];

    if (o.inner.kind === 'text') {
        ctx.fillStyle = ld.color || 'aqua';       // TODO: [styles]
        ctx.font = ld.font || '12px monospace';   // TODO: [styles]

        const dims = ctx.measureText(o.inner.text);
        const ch = Math.round((ld.h! - dims.actualBoundingBoxAscent) / 2);   // TODO: [styles]
        ctx.fillText(o.inner.text, ld.x + ld.w! - dims.width - 4 | 0, ld.y + dims.actualBoundingBoxAscent + ch | 0); // TODO: [styles]
    }

    if (o.inner.kind === 'image') {
        const atlas = loadedAtlases[o.inner.src];

        ctx.drawImage(atlas, o.inner.dx, o.inner.dy, o.inner.w, o.inner.h, ld.x, ld.y, ld.w!, ld.h!); // TODO: [styles]
    }

    if (ld.borderW) {
        ctx.strokeStyle = ld.borderColor || 'aqua';  // TODO: [styles]
        ctx.lineWidth = ld.borderW;

        ctx.strokeRect(ld.x, ld.y, ld.w!, ld.h!);    // TODO: [styles]
    }
}

function drawOldButton(o: OldButton<unknown>) {
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

function drawAutoContainer(o: AutoContainer<unknown>) {
    const ld = getOrCreateLayout(o);
    if (debug) {
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 1;
        ctx.strokeRect(ld.x!, ld.y!, ld.w!, ld.h!);    // TODO: [styles]
    }

    let dy = 0;
    let dx = 0;
    for (const c of o.children) {
        const childLd = getOrCreateLayout(c);

        childLd.x = ld.x! + dx;  // TODO: [styles]
        childLd.y = ld.y! + dy;  // TODO: [styles]

        if (o.mode === 'column') {
            dy += childLd.h!;    // TODO: [styles]
        } else {
            dx += childLd.w!;    // TODO: [styles]
        }
    }

    drawUI(o.children);
}

function getOrCreateLayout(o: UI<unknown>): LayoutData {
    const existing = layoutDataCache[o.id];
    if (existing) {
        return existing;
    }

    if (o.kind === 'old-button') {
        return { x: 0, y: 0 };
    }

    const style = o.style !== undefined
        ? computedStyles[o.style]
        : undefined;

    let ld = { x: 0, y: 0 };
    if (style) {
        ld = Object.create(style);   // TODO: [styles]
        //ld.x = ld.y = 0;             // TODO: [styles]
    }

    layoutDataCache[o.id] = ld;
    return ld;
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

function handleClickUI(ui: UI<unknown>[]): boolean {
    for (const o of ui) {
        switch (o.kind) {
            case 'auto-container': {
                if (handleClickUI(o.children)) {
                    return true;
                }

                break;
            }

            case 'button': {
                const ld = layoutDataCache[o.id];

                if (mouseX >= ld.x && mouseX <= ld.x + ld.w!        // TODO: [styles]
                    && mouseY >= ld.y && mouseY <= ld.y + ld.h!) {  // TODO: [styles]

                    o.onClick(o);
                    return true;
                }

                break;
            }

            case 'old-button': {
                if (mouseX >= o.x && mouseX <= o.x + o.w
                    && mouseY >= o.y && mouseY <= o.y + o.h) {

                    o.onClick(o);
                    return true;
                }
            }
        }
    }

    return false;
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

function createToolsContainer(): AutoContainer<any> {
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
    style: 'zoom-button',
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
    const list = atlasPaths.map<Button<undefined>>((path, i) => {
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
