
import {
    type KbKey, type KbShortcut,

    KeyMap, normaliseShortcut, keyToSigil,
} from './keyboard'

import { Falsy, clamp, isTruthy } from './util'

type GameObj = {
    draw: (dt: number) => void,
    setup: () => void,
    tearDown: () => void
}

let game: GameObj;
let drawGame: (dt: number) => void;

export let canvas: HTMLCanvasElement;
export let ctx: CanvasRenderingContext2D;
export let width: number;
export let height: number;

export let debug: boolean = false;

const frameWindow = 1000;
let   frameRateBuffer: number[] = [];

export let lastT: number = 0;
export let dt: number = 0;

let gameStop = false;

export const pressedKeys: { [key in typeof KeyMap[keyof typeof KeyMap]]?: true | undefined } = {};

export let mouseX: number;
export let mouseY: number;

export let clickX: number | undefined;
export let clickY: number | undefined;

export const isMac = /Mac/.test(navigator.userAgent);

let KbShortcuts: Map<string, { fn: () => void, repeat: boolean }> = new Map();

export type VEvent = { kind: 'mouseup',   clickX: number, clickY: number, button: 'primary' | 'secondary' }
                   | { kind: 'mousedown', clickX: number, clickY: number, button: 'primary' | 'secondary', preventDefault: boolean }
                   | { kind: 'keydown',   key: KbKey, preventDefault: boolean }
                   | { kind: 'resize' }

const eventRegistry: { [E in VEvent['kind']]?: ((e: Extract<VEvent, { kind: E }>) => void)[] } = {};

export function setup() {
    canvas = document.getElementById('gameCanvas')! as HTMLCanvasElement;

    ctx = canvas.getContext('2d')!;
    if (ctx === null) {
        // Cannot initialise the context, show the banner message and exit
        document.getElementById('cannotInitBanner')!.style.display = null!;
        return;
    }

    resize();

    window.onresize = resize;
    window.requestAnimationFrame(draw);

    window.addEventListener('keydown', keydownListener);
    window.addEventListener('keyup',   keyupListener);
    window.addEventListener('keydown', e => {
        // do nothing if the originating element is input unless the pressed key is ESC
        // in case of ESC, the element should lose focus
        if ((e.target as HTMLElement).tagName === 'INPUT') {
            if (KeyMap[e.code as keyof typeof KeyMap] === 'ESC') {
                (e.target as HTMLElement).blur();
            }

            return;
        }

        const sigil = keyToSigil(e);
        const handler = KbShortcuts.get(sigil);
        if (handler && (!e.repeat || handler.repeat)) {
            handler.fn();

            // TODO: this should be configurable
            e.preventDefault();
        }
    });

    window.addEventListener('mousemove', e => {
        // TODO: should clip left/top too (e.g. if the canvas is in the middle of the screen)
        mouseX = clamp(e.pageX, 0, width);
        mouseY = clamp(e.pageY, 0, height);
    });

    canvas.addEventListener('mousedown', e => {
        if (e.button !== 0) {
            return;
        }

        clickX = e.offsetX;
        clickY = e.offsetY;
        raise({ kind: 'mousedown', clickX: clickX!, clickY: clickY!, button: e.button === 0 ? 'primary' : 'secondary', preventDefault: false });
    });

    canvas.addEventListener('contextmenu', e => {
        clickX = e.offsetX;
        clickY = e.offsetY;

        const customEvent: VEvent = {
            kind: 'mousedown',
            clickX: clickX!,
            clickY: clickY!,
            button: e.button === 0 ? 'primary' : 'secondary',
            preventDefault: false
        };

        raise(customEvent);
        if (customEvent.preventDefault) {
            e.preventDefault();
            return false;
        }

        return undefined;
    });

    // listen on the window for mouse-up, otherwise the event is not received if clicked outside of the window or canvas
    window.addEventListener('mouseup', e => {
        if (e.button !== 0 && e.button !== 2) {
            return;
        }

        raise({ kind: 'mouseup', clickX: clickX!, clickY: clickY!, button: e.button === 0 ? 'primary' : 'secondary' });

        clickX = undefined;
        clickY = undefined;
    });

    canvas.addEventListener('touchstart', e => {
        clickX = mouseX = e.touches[0]!.clientX;
        clickY = mouseY = e.touches[0]!.clientY;
    });

    canvas.addEventListener('touchmove', e => {
        // TODO: should clip
        mouseX = e.touches[0]!.clientX;
        mouseY = e.touches[0]!.clientY;
    });

    window.addEventListener('touchend', () => {
        clickX = undefined;
        clickY = undefined;
    });
}

export function setGameObject(newGame: GameObj) {
    game?.tearDown();
    game = newGame;
    game.setup();
    drawGame = game.draw;
    resize();
}

export function registerShortcuts(shortcuts: KbShortcut[]) {
    for (const [fn, sc, repeat] of shortcuts) {
        const fixed = normaliseShortcut(sc);
        KbShortcuts.set(fixed, { fn, repeat: repeat ?? false });
    }
}

export function removeShortcuts(shortcuts: KbShortcut[]) {
    for (const [_, sc] of shortcuts) {
        const fixed = normaliseShortcut(sc);
        KbShortcuts.delete(fixed);
    }
}

export function toggleDebug() {
    debug = !debug;
}

export function toggleRun() {
    gameStop = !gameStop;
    !gameStop && window.requestAnimationFrame(draw);
}

export function listen<E extends VEvent['kind']>(e: E, f: (evt: Extract<VEvent, { kind: E }>) => void) {
    eventRegistry[e] = eventRegistry[e] || [];
    eventRegistry[e]!.push(f);
}

export function unlisten<E extends VEvent['kind']>(e: E, f: (evt: Extract<VEvent, { kind: E }>) => void) {
    eventRegistry[e] = eventRegistry[e]?.filter(x => x !== f) as any; // TYH
}

export function raise(e: VEvent) {
    eventRegistry[e.kind]?.forEach(fn => fn(e as any));   // TYH
}

function resize() {
    // if setup fails, etc
    if (!canvas) {
        return;
    }

    width = canvas.clientWidth;
    height = canvas.clientHeight;

    // we need to set proper width / height of the canvas, as it's 300x150 by default
    // also, make sure that it takes into account high dpi displays
    const devicePixelRatio = window.devicePixelRatio ?? 1;
    canvas.width = width * devicePixelRatio;
    canvas.height = height * devicePixelRatio;

    // calling resize (by extension `scale`) multiple times is fine and does not add up,
    // as setting width/height of the canvas resets the context & its matrix
    ctx.scale(devicePixelRatio, devicePixelRatio);

    raise({ kind: 'resize' });
}

function keydownListener(e: KeyboardEvent) {
    const code = KeyMap[e.code as keyof typeof KeyMap] || e.code;

    // tab has a special meaning; if it is fired point-blank, we cancel the default behaviour
    // otherwise, the keyup event might never be received if the window loses focus
    if (e.code === 'Tab' && e.target === document.body) {
        e.preventDefault();
    }

    pressedKeys[code] = true;

    const customEvent: VEvent = {
        kind: 'keydown',
        key: {
            altKey: e.altKey,
            metaKey: e.metaKey,
            shiftKey: e.shiftKey,
            ctrlKey: e.ctrlKey,

            code: e.code,
            key: e.key,
            repeat: e.repeat,
        },
        preventDefault: false
    };
    raise(customEvent);

    if (customEvent.preventDefault) {
        e.preventDefault();
    }
}

function keyupListener(e: KeyboardEvent) {
    const code = KeyMap[e.code as keyof typeof KeyMap] || e.code;

    // when holding the meta (command) key, key-up events are not fired sans CapsLock
    // so we need to clear all pressed keys here
    if (isMac && code === 'META') {
        const keys = Object.keys(pressedKeys) as (keyof typeof pressedKeys)[];
        for (const k of keys) {
            if (k !== 'CAPSLOCK') {
                delete pressedKeys[k];
            }
        }
    }

    delete pressedKeys[code];
}

type DebugMsgFunc = () => string | Falsy

let DebugMessages: DebugMsgFunc[] = [

    () => {
        const fps = frameRateBuffer.length / frameWindow * 1000 | 0;
        return `w:${width} h:${height} fps:${fps}`;
    },

    () => {
        let min, max;
        if (frameRateBuffer.length) {
            max = frameRateBuffer.reduce((x, y) => x > y ? x : y);
            min = frameRateBuffer.reduce((x, y) => x < y ? x : y);
        }

        return `min:${min?.toFixed(2)} max:${max?.toFixed(2)}`;
    },

    () => {
        return `x:${mouseX} y:${mouseY}`;
    },

    () => {
        return clickX && `cx:${clickX} cy:${clickY}`;
    },

    () => {
        const keys = Object.keys(pressedKeys);

        return keys.length && `keys:${keys.join(', ')}`;
    }
];

export function addDebugMsg(f: DebugMsgFunc) {
    DebugMessages.push(f);
}

export function removeDebugMsg(f: DebugMsgFunc) {
    DebugMessages = DebugMessages.filter(x => x !== f)
}

function drawDebug() {
    ctx.fillStyle = 'darkred';
    ctx.font = '10px monospace';

    const msg = DebugMessages
        .map(f => f())
        .filter(isTruthy);

    for (let i = 0; i < msg.length; ++i) {
        ctx.fillText(msg[i]!, width - 130, (i + 1) * 10);
    }
}

function updateFrameStats(dt: number) {
    frameRateBuffer.push(dt);
    const [frames] = frameRateBuffer.reduceRight(([fs, sum], x) => x + sum < frameWindow ? [fs + 1, x + sum] : [fs, frameWindow], [0, 0]);
    frameRateBuffer.splice(0, frameRateBuffer.length - frames);
}

function draw(t: number) {
    dt = t - lastT;
    lastT = t;

    updateFrameStats(dt);

    drawGame(dt);
    debug && drawDebug();

    if (!gameStop) {
        window.requestAnimationFrame(draw);
    }
}
