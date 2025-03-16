var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
define("keyboard", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.normaliseShortcut = exports.KeyMap = void 0;
    exports.KeyMap = {
        F1: 'F1',
        F2: 'F2',
        F3: 'F3',
        F4: 'F4',
        F5: 'F5',
        F6: 'F6',
        F7: 'F7',
        F8: 'F8',
        F9: 'F9',
        F10: 'F10',
        F11: 'F11',
        F12: 'F12',
        Digit1: '1',
        Digit2: '2',
        Digit3: '3',
        Digit4: '4',
        Digit5: '5',
        Digit6: '6',
        Digit7: '7',
        Digit8: '8',
        Digit9: '9',
        Digit0: '0',
        KeyA: 'A',
        KeyB: 'B',
        KeyC: 'C',
        KeyD: 'D',
        KeyE: 'E',
        KeyF: 'F',
        KeyG: 'G',
        KeyH: 'H',
        KeyI: 'I',
        KeyJ: 'J',
        KeyK: 'K',
        KeyL: 'L',
        KeyM: 'M',
        KeyN: 'N',
        KeyO: 'O',
        KeyP: 'P',
        KeyQ: 'Q',
        KeyR: 'R',
        KeyS: 'S',
        KeyT: 'T',
        KeyU: 'U',
        KeyV: 'V',
        KeyW: 'W',
        KeyX: 'X',
        KeyY: 'Y',
        KeyZ: 'Z',
        ShiftLeft: 'SHIFT',
        ShiftRight: 'SHIFT',
        ControlLeft: 'CTRL',
        ControlRight: 'CTRL',
        AltLeft: 'ALT',
        AltRight: 'ALT',
        MetaLeft: 'META',
        MetaRight: 'META',
        Escape: 'ESC',
        Tab: 'TAB',
        Backspace: 'BACKSPACE',
        Delete: 'DELETE',
        Enter: 'ENTER',
        CapsLock: 'CAPSLOCK',
        Space: 'SPACE',
        ArrowLeft: 'LEFT',
        ArrowRight: 'RIGHT',
        ArrowUp: 'UP',
        ArrowDown: 'DOWN',
        Minus: '-',
        Equal: '=',
        BracketLeft: '[',
        BracketRight: ']',
        Semicolon: ';',
        Quote: '\'',
        Backslash: '\\',
        Backquote: '`',
        Comma: ',',
        Period: '.',
        Slash: '/',
    };
    function normaliseShortcut(sc) {
        const prio = ['META', 'CTRL', 'ALT', 'SHIFT'];
        return sc
            .toUpperCase()
            .split(/\s*\+\s*/g)
            .sort(x => {
            const idx = prio.indexOf(x);
            return idx !== -1 ? idx : x.charCodeAt(0);
        })
            .join('+');
    }
    exports.normaliseShortcut = normaliseShortcut;
});
define("util", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.onlyKey = exports.uuid = exports.clamp = exports.isTruthy = void 0;
    function isTruthy(x) {
        return !!x;
    }
    exports.isTruthy = isTruthy;
    function clamp(x, min, max) {
        return Math.max(min, Math.min(x, max));
    }
    exports.clamp = clamp;
    function uuid() {
        return crypto.randomUUID();
    }
    exports.uuid = uuid;
    function onlyKey(x) {
        const keys = Object.keys(x);
        return keys.length === 1 ? keys[0] : undefined;
    }
    exports.onlyKey = onlyKey;
});
define("engine", ["require", "exports", "keyboard", "util"], function (require, exports, keyboard_1, util_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.removeDebugMsg = exports.addDebugMsg = exports.raise = exports.unlisten = exports.listen = exports.toggleRun = exports.toggleDebug = exports.removeShortcuts = exports.registerShortcuts = exports.setGameObject = exports.setup = exports.isMac = exports.clickY = exports.clickX = exports.mouseY = exports.mouseX = exports.pressedKeys = exports.debug = exports.height = exports.width = exports.ctx = exports.canvas = void 0;
    let game;
    let drawGame;
    exports.debug = true;
    const frameWindow = 1000;
    let frameRateBuffer = [];
    let lastT = 0;
    let gameStop = false;
    exports.pressedKeys = {};
    exports.isMac = /Mac/.test(navigator.platform);
    let KbShortcuts = new Map();
    const eventRegistry = {};
    function setup() {
        exports.canvas = document.getElementById('gameCanvas');
        exports.ctx = exports.canvas.getContext('2d');
        if (exports.ctx === null) {
            // Cannot initialise the context, show the banner message and exit
            document.getElementById('cannotInitBanner').style.display = null;
            return;
        }
        resize();
        window.onresize = resize;
        window.requestAnimationFrame(draw);
        window.addEventListener('keydown', keydownListener);
        window.addEventListener('keyup', keyupListener);
        window.addEventListener('keydown', e => {
            // skip repeats
            if (e.repeat) {
                return;
            }
            // do nothing if the originating element is input unless the pressed key is ESC
            // in case of ESC, the element should lose focus
            if (e.target.tagName === 'INPUT') {
                if (keyboard_1.KeyMap[e.code] === 'ESC') {
                    e.target.blur();
                }
                return;
            }
            const sigil = [
                e.metaKey && 'META',
                e.ctrlKey && 'CTRL',
                e.altKey && 'ALT',
                e.shiftKey && 'SHIFT',
                keyboard_1.KeyMap[e.code] || e.code
            ]
                .filter(util_1.isTruthy)
                .join('+');
            KbShortcuts.get(sigil)?.();
        });
        window.addEventListener('mousemove', e => {
            exports.mouseX = (0, util_1.clamp)(e.pageX, 0, exports.width);
            exports.mouseY = (0, util_1.clamp)(e.pageY, 0, exports.height);
        });
        exports.canvas.addEventListener('mousedown', e => {
            if (e.button !== 0) {
                return;
            }
            exports.clickX = e.offsetX;
            exports.clickY = e.offsetY;
            raise({ kind: 'mousedown', clickX: exports.clickX, clickY: exports.clickY });
        });
        // listen on the window for mouse-up, otherwise the event is not received if clicked outside of the window or canvas
        window.addEventListener('mouseup', e => {
            if (e.button !== 0) {
                return;
            }
            raise({ kind: 'mouseup', clickX: exports.clickX, clickY: exports.clickY });
            exports.clickX = undefined;
            exports.clickY = undefined;
        });
    }
    exports.setup = setup;
    function setGameObject(newGame) {
        game?.tearDown();
        game = newGame;
        game.setup();
        drawGame = game.draw;
        resize();
    }
    exports.setGameObject = setGameObject;
    function registerShortcuts(shortcuts) {
        for (const [fn, sc] of shortcuts) {
            const fixed = (0, keyboard_1.normaliseShortcut)(sc);
            KbShortcuts.set(fixed, fn);
        }
    }
    exports.registerShortcuts = registerShortcuts;
    function removeShortcuts(shortcuts) {
        for (const [fn, sc] of shortcuts) {
            const fixed = (0, keyboard_1.normaliseShortcut)(sc);
            KbShortcuts.delete(fixed);
        }
    }
    exports.removeShortcuts = removeShortcuts;
    function toggleDebug() {
        exports.debug = !exports.debug;
    }
    exports.toggleDebug = toggleDebug;
    function toggleRun() {
        gameStop = !gameStop;
        !gameStop && window.requestAnimationFrame(draw);
    }
    exports.toggleRun = toggleRun;
    function listen(e, f) {
        eventRegistry[e] = eventRegistry[e] || [];
        eventRegistry[e].push(f);
    }
    exports.listen = listen;
    function unlisten(e, f) {
        eventRegistry[e] = eventRegistry[e]?.filter(x => x !== f); // TYH
    }
    exports.unlisten = unlisten;
    function raise(e) {
        eventRegistry[e.kind]?.forEach(fn => fn(e)); // TYH
    }
    exports.raise = raise;
    function resize() {
        // if setup fails, etc
        if (!exports.canvas) {
            return;
        }
        exports.width = exports.canvas.clientWidth;
        exports.height = exports.canvas.clientHeight;
        // fix for high-dpi displays
        if (window.devicePixelRatio !== 1) {
            exports.canvas.width = exports.width * window.devicePixelRatio;
            exports.canvas.height = exports.height * window.devicePixelRatio;
            exports.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        }
        raise({ kind: 'resize' });
    }
    function keydownListener(e) {
        const code = keyboard_1.KeyMap[e.code] || e.code;
        // tab has a special meaning; if it is fired point-blank, we cancel the default behaviour
        // otherwise, the keyup event might never be received if the window loses focus
        if (e.code === 'Tab' && e.target === document.body) {
            e.preventDefault();
        }
        exports.pressedKeys[code] = true;
    }
    function keyupListener(e) {
        const code = keyboard_1.KeyMap[e.code] || e.code;
        // when holding the meta (command) key, key-up events are not fired sans CapsLock
        // so we need to clear all pressed keys here
        if (exports.isMac && code === 'META') {
            const keys = Object.keys(exports.pressedKeys);
            for (const k of keys) {
                if (k !== 'CAPSLOCK') {
                    delete exports.pressedKeys[k];
                }
            }
        }
        delete exports.pressedKeys[code];
    }
    let DebugMessages = [
        () => {
            const fps = frameRateBuffer.length / frameWindow * 1000 | 0;
            return `w:${exports.width} h:${exports.height} fps:${fps}`;
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
            return `x:${exports.mouseX} y:${exports.mouseY}`;
        },
        () => {
            return exports.clickX && `cx:${exports.clickX} cy:${exports.clickY}`;
        },
        () => {
            const keys = Object.keys(exports.pressedKeys);
            return keys.length && `keys:${keys.join(', ')}`;
        }
    ];
    function addDebugMsg(f) {
        DebugMessages.push(f);
    }
    exports.addDebugMsg = addDebugMsg;
    function removeDebugMsg(f) {
        DebugMessages = DebugMessages.filter(x => x !== f);
    }
    exports.removeDebugMsg = removeDebugMsg;
    function drawDebug() {
        exports.ctx.fillStyle = 'darkred';
        exports.ctx.font = '10px monospace';
        const msg = DebugMessages
            .map(f => f())
            .filter(util_1.isTruthy);
        for (let i = 0; i < msg.length; ++i) {
            exports.ctx.fillText(msg[i], exports.width - 130, (i + 1) * 10);
        }
    }
    function updateFrameStats(dt) {
        frameRateBuffer.push(dt);
        const [frames] = frameRateBuffer.reduceRight(([fs, sum], x) => x + sum < frameWindow ? [fs + 1, x + sum] : [fs, frameWindow], [0, 0]);
        frameRateBuffer.splice(0, frameRateBuffer.length - frames);
    }
    function draw(t) {
        const dt = t - lastT;
        lastT = t;
        updateFrameStats(dt);
        drawGame(dt);
        exports.debug && drawDebug();
        if (!gameStop) {
            window.requestAnimationFrame(draw);
        }
    }
});
define("mini-css", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.compileStyle = void 0;
    function compileStyle(ctx0, style) {
        const vars = [];
        const rules = [];
        const left = style
            .trim()
            .replaceAll(/[a-z_]+\s*=[^;]*?;/gi, matched => {
            const compiled = compileVar(matched);
            if (!compiled) {
                return matched;
            }
            vars.push(compiled);
            return '';
        })
            .replaceAll(/[#.]?[a-z-_]+\s*{[^}]+?}/gi, matched => {
            const compiled = compileRule(matched);
            if (!compiled) {
                return matched;
            }
            rules.push(compiled);
            return '';
        });
        if (left.trim()) {
            console.warn(`Styles not fully parsed: <<<${left}>>>`);
        }
        const ctx = Object.create(Object.create(null), Object.getOwnPropertyDescriptors(ctx0));
        const varsEntries = vars.map(x => [x.name, { get: x.func }]);
        Object.defineProperties(ctx, Object.fromEntries(varsEntries));
        const rulesEntries = rules.map(x => {
            const final = applyExtends(x, rules, []);
            const propEntries = final.props.map(x => [x.name, { get: x.func }]);
            // TODO: this might not be ideal; in the perfect case we should not be copying the ctx properties to every style
            // also, it can be flattened instead of Object.create(ctx)
            const props = Object.defineProperties(Object.create(ctx), Object.fromEntries(propEntries));
            return [x.name, { value: props }];
        });
        return Object.defineProperties(Object.create(null), Object.fromEntries(rulesEntries));
    }
    exports.compileStyle = compileStyle;
    function compileVar(def) {
        const [_, name, expr] = /([a-z_]+)\s*=\s*([^;]*?;)/gi.exec(def) || [];
        if (!name) {
            return undefined;
        }
        const func = compileExpr(expr);
        if (!func) {
            return undefined;
        }
        return { name, func };
    }
    function compileRule(def) {
        const [_, name, body] = /([#.]?[a-z-_]+)\s*{([^}]+?)}/gi.exec(def) || [];
        if (!name) {
            return undefined;
        }
        const exts = [];
        const props = [];
        const left = body
            .trim()
            .replaceAll(/\.\.\. *([#.]?[a-z-_]+);/gi, (_, name) => {
            exts.push(name);
            return '';
        })
            .replaceAll(/([a-z_]+)\s*:([^;]*?;)/gi, (matched, name, expr) => {
            const func = compileExpr(expr);
            if (!func) {
                return matched;
            }
            props.push({ name, func });
            return '';
        });
        if (left.trim()) {
            console.warn(`Rule \`${name}\` not fully compiled: <<<${left}>>>`);
        }
        return { name: name, extends: exts, props };
    }
    function compileExpr(expr) {
        const saved = [];
        const fixed = expr.trim()
            .replace(/'[^']*?'/g, matched => {
            saved.push(matched);
            return `___SAVED___`;
        })
            .replace(/[a-z_]+/gi, 'this.$&')
            .replace(/this\.___SAVED___/g, () => {
            return saved.shift();
        });
        return Function(`return ${fixed}`);
    }
    function applyExtends(x, xs, applied0) {
        if (!x.extends) {
            return x;
        }
        const finalProps = [];
        const applied = [...applied0, x.name];
        for (const ext of x.extends) {
            if (applied.includes(ext)) {
                continue;
            }
            const rule = xs.find(x => x.name === ext);
            if (!rule) {
                console.warn(`Cannot find rule \`${ext}\` referenced by \`${x.name}\``);
                continue;
            }
            const extended = applyExtends(rule, xs, applied);
            finalProps.push(...extended.props);
        }
        finalProps.push(...x.props);
        return { name: x.name, extends: x.extends, props: finalProps };
    }
});
define("editor", ["require", "exports", "engine", "mini-css", "util"], function (require, exports, engine_1, mini_css_1, util_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.draw = exports.tearDown = exports.setup = void 0;
    const KbShortcuts = [
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
        ...atlasPaths
    ];
    const loadedAtlases = {};
    let loading = true;
    let toolSize = 64;
    let gridSize = 64;
    let sliceSize = 16;
    let toolOffset;
    let objects = [];
    let curAtlas = 'img/grass.png';
    let currentTile;
    let ui = [];
    let layoutDataCache = {};
    const styleContext = {
        get height() {
            return engine_1.height;
        },
        get width() {
            return engine_1.width;
        },
        get toolSize() {
            return toolSize;
        }
    };
    const styles = (0, mini_css_1.compileStyle)(styleContext, `

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
        h: height - toolOffset - 10 - 1;

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
    function setup() {
        (0, engine_1.registerShortcuts)(KbShortcuts);
        (0, engine_1.listen)('mouseup', onClickHandler);
        (0, engine_1.listen)('resize', regenerateUI);
        engine_1.canvas.addEventListener('contextmenu', e => {
            const x = Math.floor(engine_1.mouseX / gridSize) * gridSize;
            const y = Math.floor(engine_1.mouseY / gridSize) * gridSize;
            objects = objects.filter(o => o.x !== x || o.y !== y);
            e.preventDefault();
            return false;
        });
        engine_1.canvas.addEventListener('wheel', e => {
            if (handleScroll(ui, e.deltaX, e.deltaY)) {
                return;
            }
            gridSize = (0, util_2.clamp)(gridSize + (e.deltaY > 0 ? 16 : -16), 16, 128);
        });
        let touchY;
        let touchId;
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
            const touch = [...e.touches].find(t => t.identifier === touchId);
            if (!touch) {
                return;
            }
            const deltaY = touchY - touch.screenY;
            if (Date.now() - lastT < 100 || Math.abs(deltaY) < 10) {
                return;
            }
            lastT = Date.now();
            touchY = touch.screenY;
            gridSize = (0, util_2.clamp)(gridSize + (deltaY > 0 ? 16 : -16), 16, 128);
        }, { passive: false /* in safari defaults to `true` for touch and scroll events */ });
        window.addEventListener('touchend', e => {
            // this disables two-finger zooming on safari
            e.preventDefault();
            touchId = undefined;
        }, { passive: false /* in safari defaults to `true` for touch and scroll events */ });
        loadAtlases();
    }
    exports.setup = setup;
    function tearDown() {
        (0, engine_1.unlisten)('mouseup', onClickHandler);
        (0, engine_1.removeShortcuts)(KbShortcuts);
    }
    exports.tearDown = tearDown;
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
    function draw(dt) {
        if (loading) {
            drawLoading();
            return;
        }
        // clear the screen
        engine_1.ctx.fillStyle = '#000';
        engine_1.ctx.fillRect(0, 0, engine_1.width, engine_1.height);
        drawUI(ui);
        drawGrid();
        drawObjects();
        drawCursor();
    }
    exports.draw = draw;
    function drawLoading() {
        engine_1.ctx.clearRect(0, 0, engine_1.width, engine_1.height);
        engine_1.ctx.fillStyle = '#34495E';
        engine_1.ctx.font = '32px serif';
        const dots = (Date.now() % 1000) / 250 | 0;
        const dims = engine_1.ctx.measureText(`Loading ...`);
        engine_1.ctx.fillText(`Loading ${'.'.repeat(dots)}`, (engine_1.width - dims.width) / 2, (engine_1.height - dims.fontBoundingBoxAscent) / 2);
    }
    function drawGrid() {
        engine_1.ctx.fillStyle = 'darkgray';
        for (let x = 0; x < engine_1.width; x += gridSize) {
            engine_1.ctx.fillRect(x, 0, 1, toolOffset);
        }
        for (let y = 0; y < toolOffset; y += gridSize) {
            engine_1.ctx.fillRect(0, y, engine_1.width, 1);
        }
        // the last horizontal line (in case of off-tile height)
        engine_1.ctx.fillRect(0, toolOffset, engine_1.width, 1);
    }
    function drawUI(ui) {
        for (const o of ui) {
            switch (o.kind) {
                case 'button':
                    drawButton(o);
                    break;
                case 'old-button':
                    drawOldButton(o);
                    break;
                case 'auto-container': drawAutoContainer(o);
            }
        }
    }
    function drawButton(o) {
        const ld = getOrCreateLayout(o);
        if (o.inner.kind === 'text') {
            engine_1.ctx.fillStyle = ld.color || 'aqua'; // TODO: [styles]
            engine_1.ctx.font = ld.font || '12px monospace'; // TODO: [styles]
            const dims = engine_1.ctx.measureText(o.inner.text);
            const ch = Math.round((ld.h - dims.actualBoundingBoxAscent) / 2); // TODO: [styles]
            const wOffset = Math.max(ld.w - dims.width - 4 | 0, 5);
            engine_1.ctx.fillText(o.inner.text, ld.x + wOffset, ld.y + dims.actualBoundingBoxAscent + ch | 0, ld.w - 9); // TODO: [styles]
        }
        if (o.inner.kind === 'image') {
            const atlas = loadedAtlases[o.inner.src];
            engine_1.ctx.drawImage(atlas, o.inner.dx, o.inner.dy, o.inner.w, o.inner.h, ld.x, ld.y, ld.w, ld.h); // TODO: [styles]
        }
        if (ld.borderW) {
            engine_1.ctx.strokeStyle = ld.borderColor || 'aqua'; // TODO: [styles]
            engine_1.ctx.lineWidth = ld.borderW;
            engine_1.ctx.strokeRect(ld.x, ld.y, ld.w, ld.h); // TODO: [styles]
        }
    }
    function drawOldButton(o) {
        if (o.inner.kind === 'text') {
            engine_1.ctx.fillStyle = o.inner.color;
            engine_1.ctx.font = o.inner.font;
            const dims = engine_1.ctx.measureText(o.inner.text);
            const ch = Math.round((o.h - dims.actualBoundingBoxAscent) / 2);
            engine_1.ctx.fillText(o.inner.text, o.x + o.w - dims.width - 4 | 0, o.y + dims.actualBoundingBoxAscent + ch | 0);
        }
        if (o.inner.kind === 'image') {
            const atlas = loadedAtlases[o.inner.src];
            engine_1.ctx.drawImage(atlas, o.inner.dx, o.inner.dy, o.inner.w, o.inner.h, o.x, o.y, o.w, o.h);
        }
        if (o.borderW) {
            engine_1.ctx.strokeStyle = o.color;
            engine_1.ctx.lineWidth = o.borderW;
            engine_1.ctx.strokeRect(o.x, o.y, o.w, o.h);
        }
    }
    function drawAutoContainer(o) {
        const ld = getOrCreateLayout(o);
        if (engine_1.debug) {
            engine_1.ctx.strokeStyle = 'red';
            engine_1.ctx.lineWidth = 1;
            engine_1.ctx.strokeRect(ld.x, ld.y, ld.w, ld.h); // TODO: [styles]
        }
        if (ld.scroll) {
            engine_1.ctx.save();
            engine_1.ctx.beginPath();
            engine_1.ctx.rect(ld.x - 1, ld.y - 1, ld.w + 1, ld.h + 1); // TODO: [styles]
            engine_1.ctx.clip();
        }
        const gap = ld.gap ?? 0;
        let dy = 0;
        let dx = 0;
        const totalHeight = o.children.reduce((acc, x) => acc + getOrCreateLayout(x).h, 0);
        const totalWidth = o.children.reduce((acc, x) => acc + getOrCreateLayout(x).w, 0);
        ld.scrollX = (0, util_2.clamp)(ld.scrollX ?? 0, Math.min(ld.w, totalWidth) - totalWidth, 0);
        ld.scrollY = (0, util_2.clamp)(ld.scrollY ?? 0, Math.min(ld.h, totalHeight) - totalHeight, 0);
        for (const c of o.children) {
            const childLd = getOrCreateLayout(c);
            childLd.x = ld.x + dx + ld.scrollX; // TODO: [styles]
            childLd.y = ld.y + dy + ld.scrollY; // TODO: [styles]
            if (o.mode === 'column') {
                dy += childLd.h + gap; // TODO: [styles]
            }
            else {
                dx += childLd.w + gap; // TODO: [styles]
            }
        }
        drawUI(o.children);
        if (ld.scroll) {
            engine_1.ctx.restore();
        }
    }
    function getOrCreateLayout(o) {
        const key = o.id + o.style;
        const existing = layoutDataCache[key];
        if (existing) {
            return existing;
        }
        const style = o.style !== undefined
            ? styles[o.style]
            : undefined;
        let ld = { x: 0, y: 0 };
        if (style) {
            ld = Object.create(style); // TODO: [styles]
            //ld.x = ld.y = 0;             // TODO: [styles]
        }
        layoutDataCache[key] = ld;
        return ld;
    }
    function drawObjects() {
        for (const o of objects) {
            const atlas = loadedAtlases[o.atlas];
            engine_1.ctx.drawImage(atlas, o.tileX * sliceSize, o.tileY * sliceSize, sliceSize, sliceSize, o.x, o.y, gridSize, gridSize);
        }
    }
    function drawCursor() {
        if (!currentTile) {
            return;
        }
        if (engine_1.mouseY > toolOffset) {
            return;
        }
        const x = Math.floor(engine_1.mouseX / gridSize) * gridSize;
        const y = Math.floor(engine_1.mouseY / gridSize) * gridSize;
        const atlas = loadedAtlases[curAtlas];
        engine_1.ctx.drawImage(atlas, currentTile.x * sliceSize, currentTile.y * sliceSize, sliceSize, sliceSize, x, y, gridSize, gridSize);
    }
    function onEscape() {
        currentTile = undefined;
    }
    function onClickHandler() {
        handleClickUI(ui);
        if (engine_1.mouseY <= toolOffset) {
            if (!currentTile) {
                return;
            }
            const x = Math.floor(engine_1.mouseX / gridSize) * gridSize;
            const y = Math.floor(engine_1.mouseY / gridSize) * gridSize;
            objects.push({ x, y, tileX: currentTile.x, tileY: currentTile.y, atlas: curAtlas });
            return;
        }
    }
    function handleClickUI(ui) {
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
                    if (engine_1.mouseX >= ld.x && engine_1.mouseX <= ld.x + ld.w // TODO: [styles]
                        && engine_1.mouseY >= ld.y && engine_1.mouseY <= ld.y + ld.h) { // TODO: [styles]
                        o.onClick(o);
                        return true;
                    }
                    break;
                }
                case 'old-button': {
                    if (engine_1.mouseX >= o.x && engine_1.mouseX <= o.x + o.w
                        && engine_1.mouseY >= o.y && engine_1.mouseY <= o.y + o.h) {
                        o.onClick(o);
                        return true;
                    }
                }
            }
        }
        return false;
    }
    function handleScroll(ui, deltaX, deltaY) {
        for (const o of ui) {
            switch (o.kind) {
                case 'button':
                case 'old-button':
                    break;
                case 'auto-container': {
                    const ld = getOrCreateLayout(o);
                    if (!(engine_1.mouseX >= ld.x && engine_1.mouseX <= ld.x + ld.w // TODO: [styles]
                        && engine_1.mouseY >= ld.y && engine_1.mouseY <= ld.y + ld.h)) { // TODO: [styles]
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
                    }
                    else {
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
        toolSize = (engine_1.width < 600) ? 32 : 64;
        engine_1.ctx.imageSmoothingEnabled = false;
        toolOffset = engine_1.height - (toolSize + 5) * 4 - 5 - 5;
        ui = [
            createToolsContainer(),
            ...createAtlasTiles(),
        ];
    }
    function createToolsContainer() {
        const container = {
            kind: 'auto-container',
            id: 'tools-container',
            mode: 'row',
            children: [zoomButton, createAtlasList()],
            style: '#tools-container',
        };
        return container;
    }
    const zoomButton = {
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
    function createAtlasList() {
        const list = atlasPaths.map((path, i) => {
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
        const container = {
            kind: 'auto-container',
            id: 'atlas-list-container',
            mode: 'column',
            children: list,
            style: '#atlas-list-container',
        };
        return container;
    }
    function onAtlasButtonClick(x) {
        curAtlas = x.id;
        currentTile = undefined;
        regenerateUI();
    }
    function createAtlasTiles() {
        const atlas = loadedAtlases[curAtlas];
        const aw = atlas.width / sliceSize;
        const ah = atlas.height / sliceSize;
        const maxTiles = Math.floor((engine_1.width - 205) / (toolSize + 5)) * 4;
        const count = Math.min(ah * aw, maxTiles);
        const acc = [];
        for (let i = 0; i < count; ++i) {
            const ax = i % aw;
            const ay = i / aw | 0;
            const tx = Math.floor(ay / 4) * aw + ax;
            const ty = ay % 4;
            const btn = {
                kind: 'old-button',
                id: 'btn:' + ax + ':' + ay,
                data: { x: ax, y: ay },
                x: 5 + tx * (toolSize + 5),
                y: toolOffset + 10 + ty * (toolSize + 5),
                w: toolSize,
                h: toolSize,
                color: '#cc0909',
                get borderW() { return currentTile === this.data ? 2 : 0; },
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
    function onAtlasTileClick(x) {
        currentTile = currentTile === x.data
            ? undefined
            : x.data;
    }
});
define("game", ["require", "exports", "engine"], function (require, exports, engine_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.draw = exports.tearDown = exports.setup = void 0;
    let loading = true;
    const image = new Image();
    image.onload = () => loading = false;
    image.src = 'img/grass.png';
    let playerX;
    let playerY;
    let playerSpeed = 200;
    function setup() {
        playerX = engine_2.width / 2;
        playerY = engine_2.height / 2;
    }
    exports.setup = setup;
    function tearDown() {
    }
    exports.tearDown = tearDown;
    function draw(dt) {
        engine_2.ctx.clearRect(0, 0, engine_2.width, engine_2.height);
        if (loading) {
            drawLoading();
            return;
        }
        tick(dt);
        drawBackground();
        drawPlayer();
    }
    exports.draw = draw;
    function tick(dt) {
        const dx = engine_2.pressedKeys.RIGHT ? dt :
            engine_2.pressedKeys.LEFT ? -dt : 0;
        const dy = engine_2.pressedKeys.DOWN ? dt :
            engine_2.pressedKeys.UP ? -dt : 0;
        playerX += dx * playerSpeed / 1000;
        playerY += dy * playerSpeed / 1000;
    }
    function drawLoading() {
        engine_2.ctx.fillStyle = '#34495E';
        engine_2.ctx.font = '32px serif';
        const dots = (Date.now() % 1000) / 250 | 0;
        const dims = engine_2.ctx.measureText(`Loading ...`);
        engine_2.ctx.fillText(`Loading ${'.'.repeat(dots)}`, (engine_2.width - dims.width) / 2, (engine_2.height - dims.fontBoundingBoxAscent) / 2);
    }
    function drawBackground() {
        const h = 192;
        const w = 192;
        for (let i = 0; i < engine_2.height; i += h) {
            for (let j = 0; j < engine_2.width; j += w) {
                engine_2.ctx.drawImage(image, j, i, w, h);
            }
        }
    }
    function drawPlayer() {
        engine_2.ctx.fillStyle = '#FFF';
        engine_2.ctx.fillRect(playerX - 20, playerY - 20, 20, 20);
    }
});
define("index", ["require", "exports", "editor", "engine"], function (require, exports, Game, engine_3) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Game = __importStar(Game);
    let KbShortcuts = [
        [engine_3.toggleDebug, 'D'],
    ];
    window.onload = function () {
        (0, engine_3.setup)();
        (0, engine_3.registerShortcuts)(KbShortcuts);
        (0, engine_3.setGameObject)(Game);
    };
});
