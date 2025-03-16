
import {
    canvas, ctx,

    width, height, mouseX, mouseY, pressedKeys, debug,
    listen, unlisten, registerShortcuts, removeShortcuts, addDebugMsg
} from './engine'

import * as ENG from './engine'

import { compileStyle } from './mini-css'

import { clamp } from './util'

import type { Shortcut } from './keyboard'


const KbShortcuts: Shortcut[] = [
    [onEscape, 'ESC'],
    [() => displayBoundingBoxes = !displayBoundingBoxes, ']'],
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

let curAtlas = 'img/grass.png';
let currentTile: { x: number, y: number } | undefined;

let ui: UI<any>[] = [];
let layoutDataCache: { [id: string]: LayoutData } = {};

let displayBoundingBoxes = false;

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

const styles = compileStyle<UIStyle>(styleContext, `

    toolOffset = height - (toolSize + 5) * 4 - 5 - 5;

    #tools-container {
        x: (width < 600) ? width - 125 : width - 200;
        y: toolOffset + 10;
        w: (width < 600) ? 124 : 199;
        h: height - toolOffset - 10 - 1;
        gap: 5;
    }

    #atlas-list-container {
        w: (width < 600) ? 90 : 150;
        h: height - toolOffset - 10 - ((width < 600) ? 4 : 3);

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
`);

const defaultStyle: Required<UIStyle> = {
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    color: 'aqua',
    font: '12px monospace',
    borderW: 0,
    borderColor: 'aqua',
    gap: 0,
    scroll: undefined,
};

type ImageSlice = { kind: 'image', src: string, dx: number, dy: number, w: number, h: number }
type TextProps  = { kind: 'text', text: string, font: string, color: string }

type LayoutData = {
    style: UIStyle,

    x: number,
    y: number,

    w: number,
    h: number,

    scroll?: 'x' | 'y',
    scrollX: number,
    scrollY: number,

    // Accessors
    color: string,
    font: string,
    borderW: number | string,
    borderColor: string,
    gap: number,
}

type LayoutPrivate = {
    $x: number | undefined,
    $y: number | undefined,

    $w: number | undefined,
    $h: number | undefined,
}

type UIStyle = {
    x?: number,
    y?: number,

    w?: number,
    h?: number,
    color?: string,
    font?: string,
    borderW?: number | string,
    borderColor?: string,

    gap?: number,
    scroll: 'x' | 'y' | undefined,
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
    children: Exclude<UI<T>, { kind: 'old-button' }>[],
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
        if (handleScroll(ui, e.deltaX, e.deltaY)) {
            return;
        }

        gridSize = clamp(gridSize + (e.deltaY > 0 ? 16 : -16), 16, 128);
    });

    let touchY: number;
    let touchId: number | undefined;

    window.addEventListener('touchstart', e => {
        // this disables two-finger zooming on safari
        touchId = e.touches[0].identifier;
        touchY = e.touches[0].clientY;

        // BIG HACK
        const ref = ENG;
        ref.mouseX = e.touches[0].clientX;
        ref.mouseY = e.touches[0].clientY;
    }, { passive: false /* in safari defaults to `true` for touch and scroll events */ });

    window.addEventListener('touchmove', e => {
        const touch = [... e.touches].find(t => t.identifier === touchId);
        if (!touch) {
            return;
        }

        const deltaY = touch.clientY - touchY;
        touchY = touch.clientY;

        handleScroll(ui, deltaY, deltaY);
    }, { passive: false /* in safari defaults to `true` for touch and scroll events */ });

    window.addEventListener('touchend', e => {
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
    const ld = getOrCreateLayout(o);

    if (o.inner.kind === 'text') {
        ctx.fillStyle = ld.color;
        ctx.font = ld.font;

        const dims = ctx.measureText(o.inner.text);
        const ch = Math.round((ld.h - dims.actualBoundingBoxAscent) / 2);
        const wOffset = Math.max(ld.w - dims.width - 4 | 0, 5);

        ctx.fillText(o.inner.text, ld.x + wOffset, ld.y + dims.actualBoundingBoxAscent + ch | 0, ld.w - 9);
    }

    if (o.inner.kind === 'image') {
        const atlas = loadedAtlases[o.inner.src];

        ctx.drawImage(atlas, o.inner.dx, o.inner.dy, o.inner.w, o.inner.h, ld.x, ld.y, ld.w, ld.h);
    }

    drawBorder(ld);
}

function drawBorder(ld: LayoutData) {
    const borderW = ld.borderW;

    if (!borderW) {
        return;
    }

    switch (typeof borderW) {
        case 'number': {
            ctx.strokeStyle = ld.borderColor;
            ctx.lineWidth = borderW;

            ctx.strokeRect(ld.x, ld.y, ld.w, ld.h);
            return;
        }

        case 'string': {
            let parsed = borderW.split(/\s+/g)
                .map(Number);

            const strokeStyle = ld.borderColor;

            if (parsed.length !== 2 && parsed.length !== 4) {
                console.warn(`Bad border style: ${borderW} ${JSON.stringify(parsed)}`);
                return;
            }

            // top|bottom, left|right -> top,right,bottom,left
            if (parsed.length === 2) {
                parsed = [parsed[0], parsed[1], parsed[0], parsed[1]];
            }

            drawLine(ld.x, ld.y, ld.w, 0, strokeStyle, parsed[0]);
            drawLine(ld.x + ld.w, ld.y, 0, ld.h, strokeStyle, parsed[1]);
            drawLine(ld.x, ld.y + ld.h, ld.w, 0, strokeStyle, parsed[2]);
            drawLine(ld.x, ld.y, 0, ld.h, strokeStyle, parsed[3]);
            return;
        }
    }
}

function drawLine(x: number, y: number, w: number, h: number, strokeStyle: string, lineWidth: number) {
    if (!lineWidth) {
        return;
    }

    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y + h);
    ctx.stroke();
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

    if (displayBoundingBoxes) {
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 1;
        ctx.strokeRect(ld.x - 1, ld.y -1, ld.w + 1, ld.h + 1);
    }

    if (ld.scroll) {
        const totalHeight = o.children.reduce((acc, x) => acc + getOrCreateLayout(x).h, 0);
        const totalWidth = o.children.reduce((acc, x) => acc + getOrCreateLayout(x).w, 0);

        ld.scrollX = clamp(ld.scrollX, Math.min(ld.w, totalWidth) - totalWidth, 0);
        ld.scrollY = clamp(ld.scrollY, Math.min(ld.h, totalHeight) - totalHeight, 0);

        ctx.save();
        ctx.beginPath();
        ctx.rect(ld.x - 1, ld.y - 1, ld.w + 1, ld.h + 1);
        ctx.clip();
    }

    let dy = 0;
    let dx = 0;

    for (const c of o.children) {
        const childLd = getOrCreateLayout(c);

        childLd.x = ld.x + dx + ld.scrollX;
        childLd.y = ld.y + dy + ld.scrollY;

        if (o.mode === 'column') {
            dy += childLd.h + ld.gap;
        } else {
            dx += childLd.w + ld.gap;
        }
    }

    drawUI(o.children);
    if (ld.scroll) {
        ctx.restore();
    }
    drawBorder(ld);
}

function getOrCreateLayout(o: Button<unknown> | AutoContainer<unknown>): LayoutData {
    const key = o.id + o.style;
    const existing = layoutDataCache[key];
    if (existing) {
        return existing;
    }

    const style = o.style
        ? styles[o.style]
        : undefined;

    const ld = createLayoutData(style);
    layoutDataCache[key] = ld;
    return ld;
}

function createLayoutData(style: UIStyle | undefined): LayoutData {
    const res: LayoutPrivate & LayoutData = {
        $x: undefined,
        $y: undefined,
        $w: undefined,
        $h: undefined,

        style: style ?? defaultStyle,

        get x() { return this.$x ?? this.style.x ?? defaultStyle.x; },
        set x(val: number) { this.$x = val; },

        get y() { return this.$y ?? this.style.y ?? defaultStyle.y; },
        set y(val: number) { this.$y = val; },

        get w() { return this.$w ?? this.style.w ?? defaultStyle.w; },
        set w(val: number) { this.$w = val; },

        get h() { return this.$h ?? this.style.h ?? defaultStyle.h; },
        set h(val: number) { this.$h = val; },

        scroll: style?.scroll,
        scrollX: 0,
        scrollY: 0,

        // Accessors
        get color() { return style?.color || defaultStyle.color; },
        get font() { return style?.font || defaultStyle.font; },
        get borderW() { return style?.borderW || defaultStyle.borderW; },
        get borderColor() { return style?.borderColor || defaultStyle.borderColor; },
        get gap() { return style?.gap || defaultStyle.gap; },
    };

    return res;
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
                const ld = getOrCreateLayout(o);

                if (mouseX >= ld.x && mouseX <= ld.x + ld.w
                    && mouseY >= ld.y && mouseY <= ld.y + ld.h) {

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

function onScrollHandler() {

}

function handleScroll(ui: UI<unknown>[], deltaX: number, deltaY: number): boolean {
    for (const o of ui) {
        switch (o.kind) {
            case 'button':
            case 'old-button':
                break;

            case 'auto-container': {
                const ld = getOrCreateLayout(o);

                if (!(mouseX >= ld.x && mouseX <= ld.x + ld.w
                    && mouseY >= ld.y && mouseY <= ld.y + ld.h)) {
                    return false;
                }

                // first try children
                if (handleScroll(o.children, deltaX, deltaY)) {
                    return true;
                }

                if (!ld.scroll) {
                    return false;
                }

                if (ld.scroll === 'x') {
                    ld.scrollX = (ld.scrollX || 0) + deltaX;
                } else {
                    ld.scrollY = (ld.scrollY || 0) + deltaY;
                }

                return true;
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
