
import {
    type VEvent,

    canvas, ctx,

    width, height, mouseX, mouseY, clickY, isMac,
    listen, unlisten, registerShortcuts, removeShortcuts,
} from './engine'

import { clamp, assertNever } from './util'
import type { Shortcut } from './keyboard'
import {
    UI, Button, UIText, AutoContainer,

    drawUI, handleScrollUI, handleClickUI, addStylesUI, addAtlasesUI, displayBoundingBoxes
} from './ui'


type Action = { kind: 'add-tiles',    tiles: Tile[] }
            | { kind: 'delete-tiles', tiles: Tile[] }

type Tile = { x: number, y: number, atlasX: number, atlasY: number, atlas: string }

const META_KEY = isMac ? 'META' : 'CTRL';

const KbShortcuts: Shortcut[] = [
    [onEscape,    'ESC'],
    [historyUndo, `${META_KEY} + Z`,          true],
    [historyRedo, `${META_KEY} + SHIFT + Z`,  true],
    [historyRedo, `CTRL + Y`,                 true],

    [() => displayBoundingBoxes(!displayBoundingBoxes()), ']'],
];

const atlasPaths = [
    'img/chest.png',
    'img/chicken-house.png',
    'img/dirt.png',
    'img/dirt-wide.png',
    'img/dirt-v2.png',
    'img/dirt-wide-v2.png',
    'img/doors.png',
    'img/egg.png',
    'img/fences.png',
    'img/furniture.png',
    'img/grass.png',
    'img/grass-biom-things.png',
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
    'img/delete.png',
    ... atlasPaths
];

const loadedAtlases: { [k: string]: HTMLImageElement } = {};

let loading = true;

let tileRows = 4;
let toolSize = 64;
let gridSize = 64;
let sliceSize = 16;
let toolsOffset: number;
let smallScreen: boolean;

let settings_toolSize: number | undefined;
let settings_buttons: Set<typeof AllButtons[number]> = new Set([ 'gridSize', 'noRows', 'delMode', 'undo', 'redo' ]);

let mouseDown = false;
let deleteMode = false;
let settingsOpen = false;

const GridSizes = [ 16, 24, 32, 48, 64, 80, 96, 128 ];
const AllButtons = [ 'gridSize', 'noRows', 'delMode', 'undo', 'redo' ] as const;

let tiles: Tile[] = [];

let historyIndex = 0;
let massHistoryStart: number | undefined;
const history: Action[] = [];

let curAtlas = 'img/grass.png';
let currentTile: { x: number, y: number } | undefined;

let ui: UI[] = [];

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

    get toolsOffset() {
        return toolsOffset;
    },

    get smallScreen() {
        return smallScreen;
    },
};

const styles = `

    .settings-container {
        x: 5;
        y: toolsOffset + 20;
        w: width - 10;
        h: height - toolsOffset - 30;
        gap: 15;
        scroll: 'y';
    }

    #tiles-container {
        x: 5;
        y: toolsOffset + 10;
        w: smallScreen ? width - 140 : width - 215;
        h: height - toolsOffset - 10;
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
        x: smallScreen ? width - 125 : width - 200;
        y: toolsOffset + 10;
        gap: 5;
    }

    .small-button {
        w: smallScreen ? 30 : 45;
        h: smallScreen ? 14 : 21;
        color: 'darkgray';
        font: smallScreen ? '9px monospace' : '14px monospace';
        borderW: 1;
        borderColor: 'darkgray';
        textAlign: 'center';
    }

    .small-button-active {
        ... .small-button;
        color: 'floralwhite';
        borderColor: 'floralwhite';
    }

    #atlas-list-container {
        maxHeight: height - toolsOffset - 10 - (smallScreen ? 4 : 3);

        borderW: 1;
        borderColor: 'darkgray';
        scroll: 'y';
    }

    .atlas-list-button {
        w: smallScreen ? 89 : 149;
        h: smallScreen ? 12 : 21;
        borderW: 1;
        borderColor: 'darkgray';
        font: smallScreen ? '9px monospace' : '14px monospace';
        color: 'darkgray';
        textAlign: 'right';
    }

    .atlas-list-button-active {
        ... .atlas-list-button;
        color: 'floralwhite';
    }

    .gap5 {
        gap: 5;
    }

    .settings-label {
        color: 'floralwhite';
        font: '16px monospace';
        h: 21;
        w: 150;
    }

    .checkbox {
        borderW: 2;
        borderColor: 'grey';
        color: 'floralwhite';
        font: '16px monospace';
        textAlign: 'center';
        w: 20;
        h: 20;
    }

    .checkbox-label {
        color: 'darkgray';
        font: '14px monospace';
        h: 21;
    }

    .checkbox-label-active {
        ... .checkbox-label;
        color: 'floralwhite';
    }
`;

export function setup() {

    registerShortcuts(KbShortcuts);

    listen('mouseup', onMouseUp);
    listen('mousedown', onMouseDown);
    listen('resize', onResize);

    canvas.addEventListener('wheel', onScrollListener);
    addTouchListeners();

    addStylesUI(styleContext, styles);
    loadAtlases();
    onResize();

    gridSize = smallScreen ? 32 : 64;
}

export function tearDown() {

    removeShortcuts(KbShortcuts);

    unlisten('mouseup', onMouseUp);
    unlisten('mousedown', onMouseDown);
    unlisten('resize', onResize);

    canvas.removeEventListener('wheel', onScrollListener);
}

export function draw() {
    if (loading) {
        drawLoading();
        return;
    }

    // clear the screen
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    beforeDraw();

    drawMainView();
    drawUI(ui);
}

function beforeDraw() {
    if (mouseDown && clickY! <= toolsOffset && mouseY <= toolsOffset) {
        const { x, y } = toTileCoordinates(mouseX, mouseY);

        if (deleteMode) {
            const toDelete = tiles.filter(t => t.x === x && t.y === y);

            if (toDelete.length) {
                executeAction({ kind: 'delete-tiles', tiles: toDelete });
            }

            return;
        }

        if (!currentTile) {
            return;
        }

        // check if this exact tile is already present at this location
        const existing = tiles.find(t => t.x === x
                                         && t.y === y
                                         && t.atlas === curAtlas
                                         && t.atlasX === currentTile!.x
                                         && t.atlasY === currentTile!.y);
        if (!existing) {
            const tile = { x, y, atlasX: currentTile.x, atlasY: currentTile.y, atlas: curAtlas };
            executeAction({ kind: 'add-tiles', tiles: [tile] });
        }
    }
}

function drawLoading() {
    // clear the screen
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'floralwhite';
    ctx.font = '32px serif';

    const dots = (Date.now() % 1000) / 250 | 0;
    const dims = ctx.measureText(`Loading ...`);

    ctx.fillText(`Loading ${'.'.repeat(dots)}`, (width - dims.width) / 2, (height - dims.fontBoundingBoxAscent) / 2);

    const progress = `${Object.keys(loadedAtlases).length} / ${assetPaths.length}`;
    const pw = ctx.measureText(progress).width;
    ctx.fillText(progress, (width - pw) / 2, (height - dims.fontBoundingBoxAscent) / 2 + 40);
}

function drawMainView() {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, toolsOffset + 1);
    ctx.clip();

    drawGrid();
    drawTiles();
    drawCursor();

    ctx.restore();
}

function drawGrid() {
    ctx.fillStyle = 'darkgray';
    for (let x = 0; x < width; x += gridSize) {
        ctx.fillRect(x, 0, 1, toolsOffset);
    }

    for (let y = 0; y < toolsOffset; y += gridSize) {
        ctx.fillRect(0, y, width, 1);
    }

    // the last horizontal line (in case of off-tile height)
    ctx.fillRect(0, toolsOffset, width, 1);
}

function drawTiles() {
    for (const t of tiles) {
        const atlas = loadedAtlases[t.atlas]!;
        ctx.drawImage(atlas, t.atlasX * sliceSize, t.atlasY * sliceSize, sliceSize, sliceSize, t.x * gridSize, t.y * gridSize, gridSize, gridSize);
    }
}

function drawCursor() {
    canvas.style.cursor = (deleteMode && mouseY <= toolsOffset) ? 'none' : 'initial';

    if (mouseY > toolsOffset) {
        return;
    }

    if (deleteMode) {
        const deleteIcon = loadedAtlases['img/delete.png']!;

        ctx.drawImage(deleteIcon, mouseX - 16, mouseY - 16, 32, 32);
    }

    if (currentTile && !deleteMode) {
        const x = Math.floor(mouseX / gridSize) * gridSize;
        const y = Math.floor(mouseY / gridSize) * gridSize;
        const atlas = loadedAtlases[curAtlas]!;

        ctx.globalAlpha = 0.75;
        ctx.drawImage(atlas, currentTile.x * sliceSize, currentTile.y * sliceSize , sliceSize, sliceSize, x, y, gridSize, gridSize);
        ctx.globalAlpha = 1;
    }
}

function onEscape() {
    deleteMode = false;
    currentTile = undefined;
}

function onMouseUp(e: Extract<VEvent, { kind: 'mouseup' }>) {
    mouseDown = false;
    if (massHistoryStart !== undefined) {
        aggregateHistory(massHistoryStart, historyIndex);
        massHistoryStart = undefined;
    }

    if (e.button === 'secondary') {
        deleteMode = false;
    }

    if (e.button === 'primary' && handleClickUI(ui)) {
        return;
    }
}

function onMouseDown(e: Extract<VEvent, { kind: 'mousedown' }>) {
    mouseDown = true;

    // can happen if the non-primary button is pressed
    if (massHistoryStart !== undefined) {
        aggregateHistory(massHistoryStart, historyIndex);
    }

    massHistoryStart = historyIndex;

    if (e.button === 'secondary') {
        deleteMode = true;
        e.preventDefault = true;
    }
}

function onResize() {
    ctx.imageSmoothingEnabled = false;

    smallScreen = (width < 600 || height < 600);
    toolSize = settings_toolSize ?? (smallScreen ? 24 : 64);
    toolsOffset = height - (toolSize + 5) * 4 - 5 - 5;
}

function onScrollListener(e: WheelEvent) {
    if (handleScrollUI(ui, e.deltaX, e.deltaY, true)) {
        return;
    }

    const idx = clamp(GridSizes.indexOf(gridSize) + (e.deltaY > 0 ? 1 : -1), 0, GridSizes.length - 1);
    gridSize = GridSizes[idx]!;
}

function regenerateUI() {
    if (loading) {
        return;
    }

    ui = settingsOpen
        ? [ settingsContainer ]
        : [
            createToolsContainer(),
            createAtlasTiles(tileRows),
        ];
}

function createToolsContainer() {
    const container: AutoContainer = {
        kind: 'auto-container',
        mode: 'row',
        children: [ createSmallTools(), createAtlasList() ],
        style: '#tools-container',
    };

    return container;
}

const zoomButton: Button = {
    kind: 'button',
    style: '.small-button',
    inner: {
        kind: 'text',
        get text() {
            return 'x' + gridSize;
        }
    },

    onClick: () => {
        const idx = (GridSizes.indexOf(gridSize) + 1) % GridSizes.length;
        gridSize = GridSizes[idx]!;
    }
};

const tileRowsButton: Button = {
    kind: 'button',
    style: '.small-button',
    inner: {
        kind: 'text',
        get text() {
            return '#' + tileRows;
        }
    },

    onClick: () => {
        tileRows = tileRows === 4 ? 3 : 4;
        regenerateUI();
    }
};

const deleteModeButton: Button = {
    kind: 'button',
    get style() {
        return deleteMode ? '.small-button-active' : '.small-button';
    },
    inner: {
        kind: 'text',
        text: 'DEL',
    },
    onClick: () => {
        deleteMode = !deleteMode;
    }
};

const undoButton: Button = {
    kind: 'button',
    style: '.small-button',
    inner: {
        kind: 'text',
        text: 'UNDO',
    },
    onClick: historyUndo
};

const redoButton: Button = {
    kind: 'button',
    style: '.small-button',
    inner: {
        kind: 'text',
        text: 'REDO',
    },
    onClick: historyRedo
};

const settingsButton: Button = {
    kind: 'button',
    get style() {
        return settingsOpen ? '.small-button-active' : '.small-button';
    },
    inner: {
        kind: 'text',
        text: '⚙',
    },
    onClick: () => {
        settingsOpen = !settingsOpen;
        regenerateUI();
    }
};

const smallButtons = {
    gridSize: zoomButton,
    noRows: tileRowsButton,
    delMode: deleteModeButton,
    undo: undoButton,
    redo: redoButton,
};

function createSmallTools(): AutoContainer {
    return {
        kind: 'auto-container',
        mode: 'column',
        children: [
            ... AllButtons.flatMap(btn => settings_buttons.has(btn) ? [ smallButtons[btn] ] : []),
            settingsButton
        ],
        style: {
            gap: 5,
            scroll: 'y',
            get maxHeight() { return height - toolsOffset - 20; }
        },
    };
};

const toolSizeRow: AutoContainer = {
    kind: 'auto-container',
    mode: 'row',
    children: [
        {
            kind: 'text',
            text: 'Tile size:',
            style: '.settings-label'
        },
        {
            kind: 'auto-container',
            mode: 'row',
            style: 'gap5',
            children: [
                {
                    kind: 'button',
                    get style() { return settings_toolSize ? '.small-button' : '.small-button-active' },
                    inner: {
                        kind: 'text',
                        text: 'auto'
                    },
                    onClick: () => {
                        settings_toolSize = undefined;
                        onResize();
                    }
                },

                ... GridSizes.map<UI>(sz => {
                    return {
                        kind: 'button',
                        get style() { return toolSize === sz ? '.small-button-active' : '.small-button' },
                        inner: {
                            kind: 'text',
                            text: String(sz)
                        },

                        onClick: () => {
                            settings_toolSize = sz;

                            onResize();
                        }
                    };
                }),
            ],
        },
    ],
};

const availableButtons: AutoContainer = {
    kind: 'auto-container',
    mode: 'row',
    children: [
        {
            kind: 'text',
            text: 'Active tools:',
            style: '.settings-label'
        },
        {
            kind: 'auto-container',
            mode: 'row',
            style: { gap: 20 },
            children: AllButtons.map<UI>(btn => {
                const checkbox: Button = {
                    kind: 'button',
                    inner: {
                        kind: 'text',
                        get text() {
                            return settings_buttons.has(btn) ? 'x' : ' ';
                        },
                    },
                    style: '.checkbox',
                    onClick: () => {
                        if (settings_buttons.has(btn)) {
                            settings_buttons.delete(btn);
                        } else {
                            settings_buttons.add(btn);
                        }
                    },
                };

                const label: UIText = {
                    kind: 'text',
                    text: btn,
                    get style() {
                        return settings_buttons.has(btn) ? '.checkbox-label-active' : '.checkbox-label';
                    }
                };

                return {
                    kind: 'auto-container',
                    mode: 'row',
                    style: { gap: 8 },
                    children: [ checkbox, label ],
                };
            }),
        },
    ],
};

const settingsContainer: AutoContainer = {
    kind: 'auto-container',
    mode: 'column',
    style: '.settings-container',
    children: [
        toolSizeRow,
        availableButtons,

        {
            kind: 'button',
            inner: {
                kind: 'text',
                text: 'Close',
            },
            style: { borderW: 1, borderColor: 'darkgray', color: 'darkgray' },
            onClick: () => { settingsOpen = false, regenerateUI(); }
        }
    ],
};

function createAtlasList(): AutoContainer {
    const list = atlasPaths.map(path => {
        const text = path
            .replace('img/', '')
            .replace('.png', '');

        const button: Button = {
            kind: 'button',

            get style() {
                return curAtlas === path ? '.atlas-list-button-active' : '.atlas-list-button';
            },

            inner: { kind: 'text', text },
            onClick: () => onAtlasButtonClick(path)
        };

        return button;
    });

    const container: AutoContainer = {
        kind: 'auto-container',
        mode: 'column',
        children: list,
        style: '#atlas-list-container',
    };

    return container;
}

function onAtlasButtonClick(path: string) {
    curAtlas = path;
    currentTile = undefined;

    regenerateUI();
}

function createAtlasTiles(nRows: number): AutoContainer {

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

        const btn: Button = {
            kind: 'button',

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
            onClick: () => onAtlasTileClick(data)
        };

        currRow.push(btn);
        if (i % ac === ac - 1) {
            const container: AutoContainer = {
                kind: 'auto-container',
                mode: 'row',
                children: currRow,
                style: '.gap5',
            };

            rows.push(container);
            currRow = [];
        }

        if (rows.length === nRows || i === count - 1) {
            const container: AutoContainer = {
                kind: 'auto-container',
                mode: 'column',
                children: rows,
                style: '.gap5',
            };

            cols.push(container);
            rows = [];
        }
    }

    const container: AutoContainer = {
        kind: 'auto-container',
        mode: 'row',
        children: cols,
        style: '#tiles-container',
    };

    return container;
}

function onAtlasTileClick(data: typeof currentTile) {
    deleteMode = false;
    currentTile = currentTile === data
        ? undefined
        : data;
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

        let attempts = 1;
        img.onerror = () => {
            if (attempts < 3) {
                img.src = p + `?attempt=${++attempts}`;
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

        mouseDown = true;
    }, { passive: false /* in safari defaults to `true` for touch and scroll events */ });

    window.addEventListener('touchmove', e => {
        const touch = [... e.touches].find(t => t.identifier === touchId);
        if (!touch) {
            return;
        }

        const deltaX = touchX - touch.clientX;
        const deltaY = touchY - touch.clientY;

        touchX = touch.clientX;
        touchY = touch.clientY;

        handleScrollUI(ui, deltaX, deltaY, false);
    }, { passive: false /* in safari defaults to `true` for touch and scroll events */ });

    window.addEventListener('touchend', () => {
        touchId = undefined;
        mouseDown = false;
    }, { passive: false /* in safari defaults to `true` for touch and scroll events */ });
}

function toTileCoordinates(x: number, y: number) {
    return { x: Math.floor(x / gridSize), y: Math.floor(y / gridSize) };
}

function executeAction(action: Action) {
    if (historyIndex !== history.length) {
        history.splice(historyIndex, history.length - historyIndex)
    }

    history.push(action);
    historyIndex = history.length;

    applyAction(action);
}

function historyUndo() {
    if (historyIndex === 0) {
        return;
    }

    const action = history[--historyIndex]!;
    revertAction(action);
}

function historyRedo() {
    if (historyIndex === history.length) {
        return;
    }

    const action = history[historyIndex++]!;
    applyAction(action);
}

function applyAction(action: Action) {
    switch (action.kind) {
        case 'add-tiles': {
            tiles.push(... action.tiles);
            return;
        }

        case 'delete-tiles': {
            tiles = tiles.filter(x => !action.tiles.includes(x));
            return;
        }

        default: assertNever(action);
    }
}

function revertAction(action: Action) {
    switch (action.kind) {
        case 'add-tiles': {
            tiles = tiles.filter(x => !action.tiles.includes(x));
            return;
        }

        case 'delete-tiles': {
            tiles.push(... action.tiles);
            return;
        }

        default: assertNever(action);
    }
}

function aggregateHistory(start: number, end: number) {
    if (start === end) {
        return;
    }

    const entries = history.slice(start, end);

    // this should never happen under normal circumstances, however one can press CTRL + Z amidst drawing
    if (!entries.length || entries.some((x, _, a) => x.kind !== a[0]!.kind)) {
        return;
    }

    const aggregated = entries.reduce((acc, x) => {
        acc.tiles.push(... x.tiles);
        return acc;
    });

    history.splice(start, end - start, aggregated);
    historyIndex = history.length;
}
