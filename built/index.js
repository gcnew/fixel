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
define("util", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.assertNever = exports.onlyKey = exports.uuid = exports.clamp = exports.isTruthy = void 0;
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
    function assertNever(x) {
        throw new Error(`Not a never ${JSON.stringify(x)}`);
    }
    exports.assertNever = assertNever;
});
define("keyboard", ["require", "exports", "util"], function (require, exports, util_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.keyToSigil = exports.normaliseShortcut = exports.KeyMap = void 0;
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
            .sort((x, y) => {
            const idx1 = prio.indexOf(x) === -1 ? x.charCodeAt(0) : prio.indexOf(x);
            const idx2 = prio.indexOf(y) === -1 ? y.charCodeAt(0) : prio.indexOf(y);
            return idx1 - idx2;
        })
            .join('+');
    }
    exports.normaliseShortcut = normaliseShortcut;
    function keyToSigil(k) {
        return [
            k.metaKey && 'META',
            k.ctrlKey && 'CTRL',
            k.altKey && 'ALT',
            k.shiftKey && 'SHIFT',
            exports.KeyMap[k.code] || k.code
        ]
            .filter(util_1.isTruthy)
            .join('+');
    }
    exports.keyToSigil = keyToSigil;
});
define("engine", ["require", "exports", "keyboard", "util"], function (require, exports, keyboard_1, util_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.removeDebugMsg = exports.addDebugMsg = exports.raise = exports.unlisten = exports.listen = exports.toggleRun = exports.toggleDebug = exports.removeShortcuts = exports.registerShortcuts = exports.setGameObject = exports.setup = exports.isMac = exports.clickY = exports.clickX = exports.mouseY = exports.mouseX = exports.pressedKeys = exports.dt = exports.lastT = exports.debug = exports.height = exports.width = exports.ctx = exports.canvas = void 0;
    let game;
    let drawGame;
    exports.debug = false;
    const frameWindow = 1000;
    let frameRateBuffer = [];
    exports.lastT = 0;
    exports.dt = 0;
    let gameStop = false;
    exports.pressedKeys = {};
    exports.isMac = /Mac/.test(navigator.userAgent);
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
            // do nothing if the originating element is input unless the pressed key is ESC
            // in case of ESC, the element should lose focus
            if (e.target.tagName === 'INPUT') {
                if (keyboard_1.KeyMap[e.code] === 'ESC') {
                    e.target.blur();
                }
                return;
            }
            const sigil = (0, keyboard_1.keyToSigil)(e);
            const handler = KbShortcuts.get(sigil);
            if (handler && (!e.repeat || handler.repeat)) {
                handler.fn();
                // TODO: this should be configurable
                e.preventDefault();
            }
        });
        window.addEventListener('mousemove', e => {
            // TODO: should clip left/top too (e.g. if the canvas is in the middle of the screen)
            exports.mouseX = (0, util_2.clamp)(e.pageX, 0, exports.width);
            exports.mouseY = (0, util_2.clamp)(e.pageY, 0, exports.height);
        });
        exports.canvas.addEventListener('mousedown', e => {
            if (e.button !== 0) {
                return;
            }
            exports.clickX = e.offsetX;
            exports.clickY = e.offsetY;
            raise({ kind: 'mousedown', clickX: exports.clickX, clickY: exports.clickY, button: e.button === 0 ? 'primary' : 'secondary', preventDefault: false });
        });
        exports.canvas.addEventListener('contextmenu', e => {
            exports.clickX = e.offsetX;
            exports.clickY = e.offsetY;
            const customEvent = {
                kind: 'mousedown',
                clickX: exports.clickX,
                clickY: exports.clickY,
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
            raise({ kind: 'mouseup', clickX: exports.clickX, clickY: exports.clickY, button: e.button === 0 ? 'primary' : 'secondary' });
            exports.clickX = undefined;
            exports.clickY = undefined;
        });
        exports.canvas.addEventListener('touchstart', e => {
            exports.clickX = exports.mouseX = e.touches[0].clientX;
            exports.clickY = exports.mouseY = e.touches[0].clientY;
        });
        exports.canvas.addEventListener('touchmove', e => {
            // TODO: should clip
            exports.mouseX = e.touches[0].clientX;
            exports.mouseY = e.touches[0].clientY;
        });
        window.addEventListener('touchend', () => {
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
        for (const [fn, sc, repeat] of shortcuts) {
            const fixed = (0, keyboard_1.normaliseShortcut)(sc);
            KbShortcuts.set(fixed, { fn, repeat: repeat ?? false });
        }
    }
    exports.registerShortcuts = registerShortcuts;
    function removeShortcuts(shortcuts) {
        for (const [_, sc] of shortcuts) {
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
        // we need to set proper width / height of the canvas, as it's 300x150 by default
        // also, make sure that it takes into account high dpi displays
        const devicePixelRatio = window.devicePixelRatio ?? 1;
        exports.canvas.width = exports.width * devicePixelRatio;
        exports.canvas.height = exports.height * devicePixelRatio;
        // calling resize (by extension `scale`) multiple times is fine and does not add up,
        // as setting width/height of the canvas resets the context & its matrix
        exports.ctx.scale(devicePixelRatio, devicePixelRatio);
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
        const customEvent = {
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
            .filter(util_2.isTruthy);
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
        exports.dt = t - exports.lastT;
        exports.lastT = t;
        updateFrameStats(exports.dt);
        drawGame(exports.dt);
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
            .replaceAll(/[a-z_][a-z_0-9]*\s*=[^;]*?;/gi, matched => {
            const compiled = compileVar(matched);
            if (!compiled) {
                return matched;
            }
            vars.push(compiled);
            return '';
        })
            .replaceAll(/[#.]?[a-z-_][a-z-_0-9]*\s*{[^}]+?}/gi, matched => {
            const compiled = compileRule(matched);
            if (!compiled) {
                return matched;
            }
            rules.push(compiled);
            return '';
        });
        if (left.trim()) {
            console.warn(`Styles not fully parsed: <<<\n${left.trim()}\n>>>`);
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
        const [_, name, expr] = /([a-z_][a-z_0-9]*)\s*=\s*([^;]*?;)/gi.exec(def) || [];
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
        const [_, name, body] = /([#.]?[a-z-_][a-z-_0-9]*)\s*{([^}]+?)}/gi.exec(def) || [];
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
            console.warn(`Rule \`${name}\` not fully compiled: <<<\n${left.trim()}\n>>>`);
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
            .replace(/[a-z_][a-z_0-9]*/gi, 'this.$&')
            .replace(/this\.___SAVED___/g, () => {
            return saved.shift();
        });
        try {
            return Function(`return ${fixed}`);
        }
        catch (e) {
            return undefined;
        }
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
define("ui", ["require", "exports", "engine", "mini-css", "keyboard", "util"], function (require, exports, engine_1, mini_css_1, keyboard_2, util_3) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.debugBoundingBox = exports.handleKeyDown = exports.handleScrollUI = exports.isMouseInside = exports.isClickInside = exports.handleClickUI = exports.loseFocus = exports.handleMouseDown = exports.drawUI = exports.addAtlasesUI = exports.addStylesUI = exports.displayBoundingBoxes = exports.styles = exports.focusedInput = void 0;
    const defaultStyle = {
        top: 0,
        left: 0,
        maxWidth: undefined,
        maxHeight: undefined,
        color: 'aqua',
        font: '12px monospace',
        align: 'left',
        verticalAlign: 'top',
        borderWidth: 0,
        borderColor: 'aqua',
        backgroundColor: undefined,
        display: 'visible',
        margin: 0,
        padding: 0,
        layoutMode: 'column',
        gap: 0,
        scroll: undefined,
    };
    let focusedId;
    exports.styles = {};
    const loadedAtlases = {};
    const idMap = new WeakMap();
    const layoutCache = new Map();
    let displayBoundingBoxes = false;
    let _mouseX;
    let _mouseY;
    let _clickX;
    let mouseDx;
    let mouseDy;
    function accessDisplayBoundingBoxes(val) {
        if (typeof val === 'boolean') {
            displayBoundingBoxes = val;
        }
        return displayBoundingBoxes;
    }
    exports.displayBoundingBoxes = accessDisplayBoundingBoxes;
    function addStylesUI(styleContext, stylesToAdd) {
        const compiled = (0, mini_css_1.compileStyle)(styleContext, stylesToAdd);
        Object.defineProperties(exports.styles, Object.getOwnPropertyDescriptors(compiled));
    }
    exports.addStylesUI = addStylesUI;
    function addAtlasesUI(atlases) {
        Object.defineProperties(loadedAtlases, Object.getOwnPropertyDescriptors(atlases));
    }
    exports.addAtlasesUI = addAtlasesUI;
    function layoutDraw(ui) {
        beforeDraw(ui);
        const baseline = engine_1.ctx.textBaseline;
        engine_1.ctx.textBaseline = 'top';
        // update the `focusedInput` object on every draw cycle, as the element reference
        // might change; the element is replaced by an element with the same `id`
        const focusCache = exports.focusedInput;
        exports.focusedInput = undefined;
        calcBoxes(ui);
        layout(ui);
        drawUI(ui);
        if (!exports.focusedInput && focusCache) {
            exports.focusedInput = focusCache;
            loseFocus();
        }
        engine_1.ctx.textBaseline = baseline;
    }
    exports.drawUI = layoutDraw;
    function beforeDraw(ui) {
        mouseDx = _mouseX - engine_1.mouseX;
        mouseDy = _mouseY - engine_1.mouseY;
        _mouseX = engine_1.mouseX;
        _mouseY = engine_1.mouseY;
        // TODO ...
        mouseDx;
        mouseDy;
        if (engine_1.clickX !== undefined && _clickX === undefined) {
            handleMouseDown(ui);
        }
        _clickX = engine_1.clickX;
    }
    function calcBoxes(ui) {
        for (const o of ui) {
            const ld = getOrCreateLayout(o);
            if (ld.display === 'none') {
                continue;
            }
            switch (o.kind) {
                case 'text':
                    calcTextBox(o);
                    break;
                case 'text-input':
                    calcTextInputBox(o);
                    break;
                case 'image':
                    calcImageBox(o);
                    break;
                case 'button':
                    calcButtonBox(o);
                    break;
                case 'container':
                    calcContainerBox(o);
                    break;
                default: (0, util_3.assertNever)(o);
            }
        }
    }
    function calcTextBox(o) {
        const ld = getOrCreateLayout(o);
        engine_1.ctx.font = ld.font;
        const dims = engine_1.ctx.measureText(o.text);
        ld.textMetrics = dims;
        ld.$w = ld.style?.width ?? (dims.width + ld.padding.left + ld.padding.right);
        ld.$h = ld.style?.height ?? (dims.fontBoundingBoxDescent + ld.padding.top + ld.padding.bottom);
    }
    function calcTextInputBox(o) {
        const ld = getOrCreateLayout(o);
        // TODO: this might be better placed in `layout`
        if (ld.id === focusedId && o.kind === 'text-input') {
            exports.focusedInput = o;
        }
        engine_1.ctx.font = ld.font;
        const text = o.edit?.text ?? o.text;
        const dims = engine_1.ctx.measureText(text);
        ld.textMetrics = dims;
        ld.$w = ld.style?.width ?? (dims.width + ld.padding.left + ld.padding.right);
        ld.$h = ld.style?.height ?? (dims.fontBoundingBoxDescent + ld.padding.top + ld.padding.bottom);
    }
    function calcImageBox(o) {
        const ld = getOrCreateLayout(o);
        const img = loadedAtlases[o.src];
        ld.imageDimensions = img
            ? { width: img.naturalWidth, height: img.naturalHeight }
            : { width: 0, height: 0 };
        ld.$w = ld.style?.width ?? ((o.width ?? ld.imageDimensions.width) + ld.padding.left + ld.padding.right);
        ld.$h = ld.style?.height ?? ((o.height ?? ld.imageDimensions.height) + ld.padding.top + ld.padding.bottom);
    }
    function calcButtonBox(o) {
        const ld = getOrCreateLayout(o);
        if (o.inner.kind === 'text') {
            engine_1.ctx.font = ld.font;
            const dims = engine_1.ctx.measureText(o.inner.text);
            ld.textMetrics = dims;
            ld.$w = ld.style?.width ?? (dims.width + ld.padding.left + ld.padding.right + 10);
            ld.$h = ld.style?.height ?? (dims.actualBoundingBoxDescent + ld.padding.top + ld.padding.bottom + 10);
        }
        if (o.inner.kind === 'image') {
            ld.$w = ld.style?.width ?? (o.inner.w + ld.padding.left + ld.padding.right);
            ld.$h = ld.style?.width ?? (o.inner.h + ld.padding.top + ld.padding.bottom);
        }
    }
    function calcContainerBox(o) {
        const ld = getOrCreateLayout(o);
        // first, layout its children to obtain accurate ($w,$h)
        calcBoxes(o.children);
        ld.scrollHeight = ld.layoutMode === 'row'
            ? o.children.reduce((acc, x) => {
                const cl = getOrCreateLayout(x);
                const h = cl.$h + cl.margin.top + cl.margin.bottom;
                return cl.display === 'none' ? acc : Math.max(acc, h);
            }, 0)
            : o.children.reduce((acc, x) => {
                const cl = getOrCreateLayout(x);
                const h = cl.$h + cl.margin.top + cl.margin.bottom;
                return cl.display === 'none' ? acc : acc + h + (acc ? ld.gap.row : 0);
            }, 0);
        ld.scrollWidth = ld.layoutMode === 'row'
            ? o.children.reduce((acc, x) => {
                const cl = getOrCreateLayout(x);
                const w = cl.$w + cl.margin.left + cl.margin.right;
                return cl.display === 'none' ? acc : acc + w + (acc ? ld.gap.column : 0);
            }, 0)
            : o.children.reduce((acc, x) => {
                const cl = getOrCreateLayout(x);
                const w = cl.$w + cl.margin.left + cl.margin.right;
                return cl.display === 'none' ? acc : Math.max(acc, w);
            }, 0);
        ld.$w = Math.min(ld.style?.width ?? (ld.scrollWidth + ld.padding.left + ld.padding.right), ld.style?.maxWidth ?? Infinity);
        ld.$h = Math.min(ld.style?.height ?? (ld.scrollHeight + ld.padding.top + ld.padding.bottom), ld.style?.maxHeight ?? Infinity);
        ld.scrollX = (0, util_3.clamp)(ld.scrollX, Math.min(ld.$w, ld.scrollWidth) - ld.scrollWidth, 0);
        ld.scrollY = (0, util_3.clamp)(ld.scrollY, Math.min(ld.$h, ld.scrollHeight) - ld.scrollHeight, 0);
    }
    function layout(ui) {
        for (const o of ui) {
            const ld = getOrCreateLayout(o);
            if (ld.display === 'none') {
                continue;
            }
            switch (o.kind) {
                case 'text': break;
                case 'image': break;
                case 'button': break;
                case 'text-input': break;
                case 'container':
                    layoutContainer(o);
                    break;
                default: (0, util_3.assertNever)(o);
            }
        }
    }
    function layoutContainer(o) {
        const ld = getOrCreateLayout(o);
        // TODO: fix `ld.$x` and `ld.$y` for parent;
        // currently handled by `LayoutData` haxy
        let dx = ld.$x + ld.padding.left + ld.scrollX;
        let dy = ld.$y + ld.padding.top + ld.scrollY;
        for (const c of o.children) {
            const childLd = getOrCreateLayout(c);
            childLd.$x = dx + childLd.margin.left;
            childLd.$y = dy + childLd.margin.top;
            if (ld.layoutMode === 'row') {
                dx += childLd.$w + childLd.margin.left + childLd.margin.right + ld.gap.column;
            }
            else {
                dy += childLd.$h + childLd.margin.top + childLd.margin.bottom + ld.gap.row;
            }
        }
        layout(o.children);
    }
    function drawUI(ui) {
        for (const o of ui) {
            const ld = getOrCreateLayout(o);
            if (ld.display !== 'visible') {
                continue;
            }
            switch (o.kind) {
                case 'text':
                    drawText(o);
                    break;
                case 'text-input':
                    drawTextInput(o);
                    break;
                case 'image':
                    drawImage(o);
                    break;
                case 'button':
                    drawButton(o);
                    break;
                case 'container':
                    drawContainer(o);
                    break;
                default: (0, util_3.assertNever)(o);
            }
        }
    }
    function drawText(o) {
        const ld = getOrCreateLayout(o);
        if (ld.backgroundColor) {
            engine_1.ctx.fillStyle = ld.backgroundColor;
            engine_1.ctx.fillRect(ld.$x, ld.$y, ld.$w, ld.$h);
        }
        engine_1.ctx.fillStyle = ld.color;
        engine_1.ctx.font = ld.font;
        engine_1.ctx.fillText(o.text, ld.$x + ld.padding.left, ld.$y + ld.padding.top);
        drawBoundingBox(ld);
    }
    function drawTextInput(o) {
        const ld = getOrCreateLayout(o);
        if (ld.backgroundColor) {
            engine_1.ctx.fillStyle = ld.backgroundColor;
            engine_1.ctx.fillRect(ld.$x, ld.$y, ld.$w + 20, ld.$h);
        }
        if (o === exports.focusedInput && o.edit?.selection) {
            const prefix = o.edit.text.slice(0, o.edit.selection.start);
            const offset = engine_1.ctx.measureText(prefix).width;
            const selected = o.edit.text.slice(o.edit.selection.start, o.edit.selection.end);
            const width = engine_1.ctx.measureText(selected).width;
            engine_1.ctx.fillStyle = 'rgb(180,215,255)';
            engine_1.ctx.fillRect(ld.$x + ld.padding.left + offset, ld.$y + ld.padding.top - 2, width, ld.$h - 2);
        }
        const text = o.edit?.text ?? o.text;
        engine_1.ctx.fillStyle = ld.color;
        engine_1.ctx.font = ld.font;
        engine_1.ctx.fillText(text, ld.$x + ld.padding.left, ld.$y + ld.padding.top);
        if (o === exports.focusedInput && o.edit) {
            const prefix = o.edit.text.slice(0, o.edit.cursor);
            const offset = engine_1.ctx.measureText(prefix).width;
            const isOdd = engine_1.lastT / 500 & 1;
            if (isOdd) {
                engine_1.ctx.fillStyle = ld.color;
                engine_1.ctx.fillRect(ld.$x + ld.padding.left + offset, ld.$y + ld.padding.top - 2, 1, ld.$h + 4);
            }
        }
        drawBoundingBox(ld);
    }
    function drawImage(o) {
        const ld = getOrCreateLayout(o);
        const atlas = loadedAtlases[o.src];
        if (atlas) {
            engine_1.ctx.drawImage(atlas, o.x ?? 0, o.y ?? 0, o.width ?? ld.imageDimensions.width, o.height ?? ld.imageDimensions.height, ld.$x + ld.padding.left, ld.$y + ld.padding.top, ld.$w - ld.padding.left - ld.padding.right, ld.$h - ld.padding.top - ld.padding.bottom);
        }
        drawBorder(ld);
        drawBoundingBox(ld);
    }
    function drawButton(o) {
        const ld = getOrCreateLayout(o);
        if (o.inner.kind === 'text') {
            engine_1.ctx.fillStyle = ld.color;
            engine_1.ctx.font = ld.font;
            const dims = ld.textMetrics;
            const ch = (ld.$h - dims.actualBoundingBoxDescent) / 2 | 0;
            let wOffset;
            switch (ld.align) {
                case 'left': {
                    wOffset = 5;
                    break;
                }
                case 'right': {
                    wOffset = Math.max(ld.$w - dims.width - 4 | 0, 5);
                    break;
                }
                case 'center': {
                    wOffset = (ld.$w - dims.width) / 2 | 0;
                    break;
                }
            }
            engine_1.ctx.fillText(o.inner.text, ld.$x + wOffset, ld.$y + ch, ld.$w - 9);
            if (displayBoundingBoxes) {
                drawBoundingBox({ $x: ld.$x + ld.$w - dims.width - 4, $y: ld.$y, $w: dims.width, $h: dims.fontBoundingBoxDescent });
            }
        }
        if (o.inner.kind === 'image') {
            const atlas = loadedAtlases[o.inner.src];
            if (atlas) {
                engine_1.ctx.drawImage(atlas, o.inner.dx, o.inner.dy, o.inner.w, o.inner.h, ld.$x, ld.$y, ld.$w, ld.$h);
            }
        }
        drawBorder(ld);
    }
    function drawContainer(o) {
        const ld = getOrCreateLayout(o);
        // TODO: this must be `content{Width, Height}` not `$h / $w`
        const clip = !!ld.scroll || ld.scrollHeight > ld.$h || ld.scrollWidth > ld.$w;
        if (clip) {
            engine_1.ctx.save();
            engine_1.ctx.beginPath();
            engine_1.ctx.rect(ld.$x - 0.5, ld.$y - 0.5, ld.$w + 0.5, ld.$h + 0.5);
            engine_1.ctx.clip();
        }
        if (ld.backgroundColor) {
            engine_1.ctx.fillStyle = ld.backgroundColor;
            engine_1.ctx.fillRect(ld.$x, ld.$y, ld.$w, ld.$h);
        }
        drawUI(o.children);
        if (clip) {
            engine_1.ctx.restore();
        }
        drawBorder(ld);
        drawBoundingBox(ld);
    }
    function drawBorder(ld) {
        const borderWidth = ld.borderWidth;
        const strokeStyle = ld.borderColor;
        drawLine(ld.$x, ld.$y, ld.$w, 0, strokeStyle, borderWidth.top);
        drawLine(ld.$x + ld.$w, ld.$y, 0, ld.$h, strokeStyle, borderWidth.right);
        drawLine(ld.$x, ld.$y + ld.$h, ld.$w, 0, strokeStyle, borderWidth.bottom);
        drawLine(ld.$x, ld.$y, 0, ld.$h, strokeStyle, borderWidth.left);
    }
    function drawLine(x, y, w, h, strokeStyle, lineWidth) {
        if (!lineWidth) {
            return;
        }
        engine_1.ctx.strokeStyle = strokeStyle;
        engine_1.ctx.lineWidth = lineWidth;
        engine_1.ctx.beginPath();
        engine_1.ctx.moveTo(x, y);
        engine_1.ctx.lineTo(x + w, y + h);
        engine_1.ctx.stroke();
    }
    function drawBoundingBox({ $x, $y, $w, $h }) {
        if (displayBoundingBoxes) {
            engine_1.ctx.strokeStyle = 'red';
            engine_1.ctx.lineWidth = 1;
            engine_1.ctx.strokeRect($x, $y, $w, $h);
        }
    }
    function getOrCreateLayout(o) {
        let id = o.id ?? idMap.get(o);
        if (id === undefined) {
            id = (0, util_3.uuid)();
            idMap.set(o, id);
        }
        const existing = layoutCache.get(id);
        if (existing && existing.style === o.style) {
            return existing.layout;
        }
        const style = typeof o.style === 'string'
            ? exports.styles[o.style]
            : o.style;
        const ld = createLayoutData(id, style);
        layoutCache.set(id, { style: o.style, layout: ld });
        return ld;
    }
    const zeroTRBL = {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
    };
    function createLayoutData(id, style) {
        const res = {
            id,
            style,
            $$x: undefined,
            get $x() { return this.$$x ?? style?.left ?? defaultStyle.left; },
            set $x(val) { this.$$x = val; },
            $$y: undefined,
            get $y() { return this.$$y ?? style?.top ?? defaultStyle.top; },
            set $y(val) { this.$$y = val; },
            $w: 0,
            $h: 0,
            textMetrics: undefined,
            imageDimensions: undefined,
            scroll: style?.scroll,
            scrollX: 0,
            scrollY: 0,
            scrollHeight: 0,
            scrollWidth: 0,
            // Accessors
            get maxWidth() { return style?.maxWidth || defaultStyle.maxWidth; },
            get maxHeight() { return style?.maxHeight || defaultStyle.maxHeight; },
            get color() { return style?.color || defaultStyle.color; },
            get font() { return style?.font || defaultStyle.font; },
            get align() { return style?.align || defaultStyle.align; },
            get verticalAlign() { return style?.verticalAlign || defaultStyle.verticalAlign; },
            get borderColor() { return style?.borderColor || defaultStyle.borderColor; },
            get backgroundColor() { return style?.backgroundColor || defaultStyle.backgroundColor; },
            get display() { return style?.display || defaultStyle.display; },
            get layoutMode() { return style?.layoutMode || defaultStyle.layoutMode; },
            $borderWidth: { key: 0, value: zeroTRBL },
            get borderWidth() {
                return cacheTRBL('borderWidth', this.$borderWidth, style?.borderWidth || defaultStyle.borderWidth);
            },
            $margin: { key: 0, value: zeroTRBL },
            get margin() {
                return cacheTRBL('margin', this.$margin, style?.margin ?? defaultStyle.margin);
            },
            $padding: { key: 0, value: zeroTRBL },
            get padding() {
                return cacheTRBL('padding', this.$padding, style?.padding ?? defaultStyle.padding);
            },
            $gap: { key: 0, value: { row: 0, column: 0 } },
            get gap() {
                return cacheGap('gap', this.$gap, style?.gap ?? defaultStyle.gap);
            },
        };
        return res;
    }
    function cacheTRBL(property, cache, key) {
        if (cache.key === key) {
            return cache.value;
        }
        if (typeof key === 'number') {
            cache.key = key;
            cache.value = { top: key, right: key, bottom: key, left: key };
            return cache.value;
        }
        if (typeof key === 'object') {
            cache.key = key;
            cache.value = {
                get top() { return key.top ?? 0; },
                get right() { return key.right ?? 0; },
                get bottom() { return key.bottom ?? 0; },
                get left() { return key.left ?? 0; },
            };
            return cache.value;
        }
        let parsed = key.split(/\s+/g)
            .map(Number);
        if (parsed.length !== 2 && parsed.length !== 4) {
            console.warn(`Bad ${property} style: ${key}`);
            parsed = [0, 0, 0, 0];
        }
        else if (parsed.length === 2) {
            // top|bottom, left|right -> top,right,bottom,left
            parsed = [parsed[0], parsed[1], parsed[0], parsed[1]];
        }
        cache.key = key;
        cache.value = { top: parsed[0], right: parsed[1], bottom: parsed[2], left: parsed[3] };
        return cache.value;
    }
    function cacheGap(property, cache, key) {
        if (cache.key === key) {
            return cache.value;
        }
        if (typeof key === 'number') {
            cache.key = key;
            cache.value = { row: key, column: key };
            return cache.value;
        }
        let parsed = key.split(/\s+/g)
            .map(Number);
        if (parsed.length !== 2) {
            console.warn(`Bad ${property} style: ${key}`);
            parsed = [0, 0];
        }
        cache.key = key;
        cache.value = { row: parsed[0], column: parsed[1] };
        return cache.value;
    }
    function handleMouseDown(ui) {
        // losing focus should happend before the other events
        if (exports.focusedInput && !isMouseInside(exports.focusedInput)) {
            loseFocus();
        }
        return handleMouseDownWorker(ui);
    }
    exports.handleMouseDown = handleMouseDown;
    function handleMouseDownWorker(ui) {
        for (const o of ui) {
            switch (o.kind) {
                case 'text':
                case 'image':
                case 'button':
                    break;
                case 'text-input': {
                    if (!isMouseInside(o)) {
                        break;
                    }
                    if (exports.focusedInput !== o) {
                        loseFocus();
                        exports.focusedInput = o;
                        focusedId = o.id ?? idMap.get(o);
                        if (!exports.focusedInput.edit) {
                            exports.focusedInput.edit = {
                                text: exports.focusedInput.text,
                                cursor: exports.focusedInput.text.length,
                                selection: undefined
                            };
                        }
                    }
                    return true;
                }
                case 'container': {
                    if (!isMouseInside(o)) {
                        break;
                    }
                    if (handleMouseDownWorker(o.children)) {
                        return true;
                    }
                    break;
                }
                default: (0, util_3.assertNever)(o);
            }
        }
        return false;
    }
    function loseFocus() {
        if (exports.focusedInput?.edit) {
            exports.focusedInput.edit = undefined;
        }
        focusedId = undefined;
        exports.focusedInput = undefined;
    }
    exports.loseFocus = loseFocus;
    function handleClickUI(ui) {
        for (const o of ui) {
            switch (o.kind) {
                case 'text':
                case 'text-input':
                case 'image':
                case 'button': {
                    if (o.onClick && isClickInside(o)) {
                        o.onClick(o); // TYH: ts can't figure out the relation, lol
                        return true;
                    }
                    break;
                }
                case 'container': {
                    if (!isClickInside(o)) {
                        break;
                    }
                    if (handleClickUI(o.children)) {
                        return true;
                    }
                    if (o.onClick) {
                        o.onClick(o);
                        return true;
                    }
                    break;
                }
                default: (0, util_3.assertNever)(o);
            }
        }
        return false;
    }
    exports.handleClickUI = handleClickUI;
    function isClickInside(o) {
        const ld = getOrCreateLayout(o);
        // for a click to be valid, both the initial touch down and the current position need
        // to be inside the element
        return ld.display !== 'none'
            && engine_1.clickX >= ld.$x && engine_1.clickX <= ld.$x + ld.$w
            && engine_1.clickY >= ld.$y && engine_1.clickY <= ld.$y + ld.$h
            && engine_1.mouseX >= ld.$x && engine_1.mouseX <= ld.$x + ld.$w
            && engine_1.mouseY >= ld.$y && engine_1.mouseY <= ld.$y + ld.$h;
    }
    exports.isClickInside = isClickInside;
    function isMouseInside(o) {
        const ld = getOrCreateLayout(o);
        return ld.display !== 'none'
            && engine_1.mouseX >= ld.$x && engine_1.mouseX <= ld.$x + ld.$w
            && engine_1.mouseY >= ld.$y && engine_1.mouseY <= ld.$y + ld.$h;
    }
    exports.isMouseInside = isMouseInside;
    function isScrollInside(o, isWheel) {
        const ld = getOrCreateLayout(o);
        if (isWheel) {
            return ld.display !== 'none'
                && engine_1.mouseX >= ld.$x && engine_1.mouseX <= ld.$x + ld.$w
                && engine_1.mouseY >= ld.$y && engine_1.mouseY <= ld.$y + ld.$h;
        }
        // touch devices: scroll should work for the element where the tap was initiated
        // even if the current position of the pointer is outside the scrolled element
        return ld.display !== 'none'
            && engine_1.clickX >= ld.$x && engine_1.clickX <= ld.$x + ld.$w
            && engine_1.clickY >= ld.$y && engine_1.clickY <= ld.$y + ld.$h;
    }
    function handleScrollUI(ui, deltaX, deltaY, isWheel) {
        for (const o of ui) {
            switch (o.kind) {
                case 'text':
                case 'image':
                case 'text-input':
                case 'button':
                    break;
                case 'container': {
                    if (!isScrollInside(o, isWheel)) {
                        break;
                    }
                    // try the children first
                    if (handleScrollUI(o.children, deltaX, deltaY, isWheel)) {
                        return true;
                    }
                    const ld = getOrCreateLayout(o);
                    if (!ld.scroll) {
                        break;
                    }
                    if (ld.scroll === 'x') {
                        ld.scrollX = ld.scrollX - deltaX;
                    }
                    else {
                        ld.scrollY = ld.scrollY - deltaY;
                    }
                    return true;
                }
                default: (0, util_3.assertNever)(o);
            }
        }
        return false;
    }
    exports.handleScrollUI = handleScrollUI;
    // todo:
    // - support {option,ctrl}+{backspace,delete}
    // - support word hopping in non-latin
    // - history
    // - scrolling
    // - mobile support?
    // - Windows / Linux keybindings
    function handleKeyDown(_ui, key) {
        if (!exports.focusedInput || !exports.focusedInput.edit) {
            return false;
        }
        const sigil = (0, keyboard_2.keyToSigil)(key);
        const edit = exports.focusedInput.edit;
        switch (sigil) {
            case 'META+LEFT':
            case 'UP': {
                edit.cursor = 0;
                edit.selection = undefined;
                return true;
            }
            case 'META+SHIFT+LEFT':
            case 'SHIFT+UP': {
                if (edit.selection) {
                    edit.selection.start = 0;
                }
                else if (edit.cursor !== 0) {
                    edit.selection = {
                        start: 0,
                        end: edit.cursor
                    };
                }
                edit.cursor = 0;
                return true;
            }
            case 'META+RIGHT':
            case 'DOWN': {
                edit.cursor = edit.text.length;
                edit.selection = undefined;
                return true;
            }
            case 'META+SHIFT+RIGHT':
            case 'SHIFT+DOWN': {
                if (edit.selection) {
                    edit.selection.end = edit.text.length;
                }
                else if (edit.cursor !== edit.text.length) {
                    edit.selection = {
                        start: edit.cursor,
                        end: edit.text.length
                    };
                }
                edit.cursor = edit.text.length;
                return true;
            }
            case 'LEFT': {
                edit.cursor = edit.selection
                    ? edit.selection.start
                    : Math.max(edit.cursor - 1, 0);
                edit.selection = undefined;
                return false;
            }
            case 'SHIFT+LEFT': {
                if (edit.selection) {
                    if (edit.cursor === edit.selection.start) {
                        edit.cursor = Math.max(edit.cursor - 1, 0);
                        edit.selection.start = edit.cursor;
                    }
                    else if (edit.cursor === edit.selection.end) {
                        edit.cursor = Math.max(edit.cursor - 1, 0);
                        edit.selection.end = edit.cursor;
                    }
                    if (edit.selection.start === edit.selection.end) {
                        edit.selection = undefined;
                    }
                }
                else {
                    if (edit.cursor !== 0 && edit.text.length !== 0) {
                        edit.cursor--;
                        edit.selection = {
                            start: edit.cursor,
                            end: edit.cursor + 1
                        };
                    }
                }
                return false;
            }
            case 'CTRL+LEFT':
            case 'CTRL+SHIFT+LEFT':
            case 'ALT+LEFT':
            case 'ALT+SHIFT+LEFT': {
                const rx = key.altKey
                    ? /\w+\s*$/
                    : /[a-zA-Z0-9]+_*\s*$/;
                const prefix = edit.text.slice(0, edit.cursor);
                const offset = rx.exec(prefix)?.[0].length
                    ?? /(.)\1*\s*$/.exec(prefix)?.[0].length
                    ?? 1;
                const saved = edit.cursor;
                edit.cursor = Math.max(edit.cursor - offset, 0);
                if (key.shiftKey) {
                    if (edit.selection) {
                        if (edit.selection.end === saved && edit.cursor >= edit.selection.start) {
                            edit.selection.end = edit.cursor;
                        }
                        else {
                            edit.selection.start = edit.cursor;
                        }
                        if (edit.selection.start === edit.selection.end) {
                            edit.selection = undefined;
                        }
                    }
                    else {
                        edit.selection = edit.cursor !== saved
                            ? { start: edit.cursor, end: saved }
                            : undefined;
                    }
                }
                else {
                    edit.selection = undefined;
                }
                return false;
            }
            case 'RIGHT': {
                edit.cursor = edit.selection
                    ? edit.selection.end
                    : Math.min(edit.cursor + 1, edit.text.length);
                edit.selection = undefined;
                return false;
            }
            case 'SHIFT+RIGHT': {
                if (edit.selection) {
                    if (edit.cursor === edit.selection.start) {
                        edit.cursor = Math.min(edit.cursor + 1, edit.text.length);
                        edit.selection.start = edit.cursor;
                    }
                    else if (edit.cursor === edit.selection.end) {
                        edit.cursor = Math.min(edit.cursor + 1, edit.text.length);
                        edit.selection.end = edit.cursor;
                    }
                    if (edit.selection.start === edit.selection.end) {
                        edit.selection = undefined;
                    }
                }
                else {
                    if (edit.cursor !== edit.text.length) {
                        edit.cursor++;
                        edit.selection = {
                            start: edit.cursor - 1,
                            end: edit.cursor
                        };
                    }
                }
                return false;
            }
            case 'CTRL+RIGHT':
            case 'CTRL+SHIFT+RIGHT':
            case 'ALT+RIGHT':
            case 'ALT+SHIFT+RIGHT': {
                const rx = key.altKey
                    ? /^\s*\w+/
                    : /^\s*_*[a-zA-Z0-9]+/;
                const suffix = edit.text.slice(edit.cursor);
                const offset = rx.exec(suffix)?.[0].length
                    ?? /^\s*(.)\1*/.exec(suffix)?.[0].length
                    ?? 1;
                const saved = edit.cursor;
                edit.cursor = Math.min(edit.cursor + offset, edit.text.length);
                if (key.shiftKey) {
                    if (edit.selection) {
                        if (edit.selection.start === saved && edit.cursor <= edit.selection.end) {
                            edit.selection.start = edit.cursor;
                        }
                        else {
                            edit.selection.end = edit.cursor;
                        }
                        if (edit.selection.start === edit.selection.end) {
                            edit.selection = undefined;
                        }
                    }
                    else {
                        edit.selection = edit.cursor !== saved
                            ? { start: saved, end: edit.cursor }
                            : undefined;
                    }
                }
                else {
                    edit.selection = undefined;
                }
                return false;
            }
            case 'META+DELETE': {
                edit.text = edit.text.slice(0, edit.cursor);
                edit.selection = undefined;
                return false;
            }
            case 'META+BACKSPACE': {
                edit.text = edit.text.slice(edit.cursor);
                edit.cursor = 0;
                edit.selection = undefined;
                return false;
            }
            case 'DELETE':
            case 'BACKSPACE': {
                if (edit.selection) {
                    edit.cursor = edit.selection.start;
                    edit.text = edit.text.slice(0, edit.selection.start) + edit.text.slice(edit.selection.end);
                    edit.selection = undefined;
                }
                else if (sigil === 'BACKSPACE' && edit.cursor !== 0) {
                    edit.cursor = edit.cursor - 1;
                    edit.text = edit.text.slice(0, edit.cursor) + edit.text.slice(edit.cursor + 1);
                }
                else if (sigil === 'DELETE' && edit.cursor < edit.text.length) {
                    edit.text = edit.text.slice(0, edit.cursor) + edit.text.slice(edit.cursor + 1);
                }
                return false;
            }
            case 'ESC': {
                loseFocus();
                return false;
            }
            case 'META+C': {
                if (edit.selection) {
                    const selected = edit.text.slice(edit.selection.start, edit.selection.end);
                    navigator.clipboard.writeText(selected);
                }
                return false;
            }
            case 'META+V': {
                // This is not entirely correct as it will happen sometime in the future due to the promise
                // i.e. there is a race condition, but I think it's good enough as is
                navigator.clipboard
                    .readText()
                    .then(text => {
                    const start = edit.selection ? edit.selection.start : edit.cursor;
                    const end = edit.selection ? edit.selection.end : edit.cursor;
                    edit.text = edit.text.slice(0, start) + text + edit.text.slice(end);
                    edit.cursor = edit.cursor + text.length;
                    edit.selection = undefined;
                });
                return false;
            }
            default: {
                // accept only characters
                if (key.key.length === 1) {
                    const start = edit.selection ? edit.selection.start : edit.cursor;
                    const end = edit.selection ? edit.selection.end : edit.cursor;
                    edit.text = edit.text.slice(0, start) + key.key + edit.text.slice(end);
                    edit.cursor = start + 1;
                    edit.selection = undefined;
                }
                return false;
            }
        }
    }
    exports.handleKeyDown = handleKeyDown;
    function debugBoundingBox(ui) {
        const lds = ui.map(getOrCreateLayout);
        const x = Math.min(...lds.map(o => o.$x));
        const y = Math.min(...lds.map(o => o.$y));
        const right = Math.max(...lds.map(o => o.$x + o.$w));
        const bottom = Math.max(...lds.map(o => o.$y + o.$h));
        return { x, y, width: right - x, height: bottom - y };
    }
    exports.debugBoundingBox = debugBoundingBox;
});
define("editor", ["require", "exports", "engine", "util", "ui"], function (require, exports, engine_2, util_4, ui_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.draw = exports.tearDown = exports.setup = void 0;
    const META_KEY = engine_2.isMac ? 'META' : 'CTRL';
    const KbShortcuts = [
        [onEscape, 'ESC'],
        [historyUndo, `${META_KEY} + Z`, true],
        [historyRedo, `${META_KEY} + SHIFT + Z`, true],
        [historyRedo, `CTRL + Y`, true],
        [() => (0, ui_1.displayBoundingBoxes)(!(0, ui_1.displayBoundingBoxes)()), ']'],
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
        ...atlasPaths
    ];
    const loadedAtlases = {};
    let loading = true;
    let tileRows = 4;
    let toolSize = 64;
    let gridSize = 64;
    let sliceSize = 16;
    let toolsOffset;
    let smallScreen;
    let settings_toolSize;
    let settings_multiselect;
    let settings_buttons = new Set(['gridSize', 'noRows', 'delMode', 'multiselect', 'undo', 'redo']);
    let mouseDown = false;
    let deleteMode = false;
    let multiselectMode = false;
    let settingsOpen = false;
    const GridSizes = [16, 24, 32, 48, 64, 80, 96, 128];
    const AllButtons = ['gridSize', 'noRows', 'delMode', 'multiselect', 'undo', 'redo'];
    let tiles = [];
    let historyIndex = 0;
    let massHistoryStart;
    const history = [];
    let curAtlas = 'img/grass.png';
    let currentTiles;
    let ui = [];
    const styleContext = {
        get screenHeight() {
            return engine_2.height;
        },
        get screenWidth() {
            return engine_2.width;
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
        top: toolsOffset + 20;
        left: 5;
        width: screenWidth - 10;
        height: screenHeight - toolsOffset - 30;
        gap: 15;
        scroll: 'y';
        layoutMode: 'column';
        test: 'AAAJJJTTTTg';
    }

    #tiles-container {
        top: toolsOffset + 10;
        left: 5;
        width: smallScreen ? screenWidth - 140 : screenWidth - 215;
        height: screenHeight - toolsOffset - 10;
        gap: 5;
        layoutMode: 'row';

        scroll: 'x';
    }

    .tile {
        width: toolSize;
        height: toolSize;
    }

    .tile-active {
        ... .tile;
        borderColor: '#cc0909';
        borderWidth: 2;
    }

    #tools-container {
        top: toolsOffset + 10;
        left: smallScreen ? screenWidth - 125 : screenWidth - 200;
        gap: 5;
        layoutMode: 'row';
    }

    .small-button {
        width: smallScreen ? 30 : 45;
        height: smallScreen ? 14 : 21;
        color: 'darkgray';
        font: smallScreen ? '9px monospace' : '14px monospace';
        borderWidth: 1;
        borderColor: 'darkgray';
        align: 'center';
    }

    .small-button-active {
        ... .small-button;
        color: 'floralwhite';
        borderColor: 'floralwhite';
    }

    #atlas-list-container {
        maxHeight: screenHeight - toolsOffset - 10 - (smallScreen ? 4 : 3);

        borderWidth: 1;
        borderColor: 'darkgray';
        scroll: 'y';
        layoutMode: 'column';
    }

    .atlas-list-button {
        width: smallScreen ? 89 : 149;
        height: smallScreen ? 12 : 21;
        borderWidth: 1;
        borderColor: 'darkgray';
        font: smallScreen ? '9px monospace' : '14px monospace';
        color: 'darkgray';
        align: 'right';
    }

    .atlas-list-button-active {
        ... .atlas-list-button;
        color: 'floralwhite';
    }

    .gap5-row {
        gap: 5;
        layoutMode: 'row';
    }

    .gap5-column {
        gap: 5;
        layoutMode: 'column';
    }

    .settings-label {
        color: 'floralwhite';
        font: '16px monospace';
        height: 21;
        width: 150;
    }

    .checkbox {
        borderWidth: 2;
        borderColor: 'grey';
        color: 'floralwhite';
        font: '16px monospace';
        align: 'center';
        width: 20;
        height: 20;
    }

    .checkbox-label {
        color: 'darkgray';
        font: '14px monospace';
        height: 21;
    }

    .checkbox-label-active {
        ... .checkbox-label;
        color: 'floralwhite';
    }
`;
    function setup() {
        (0, engine_2.registerShortcuts)(KbShortcuts);
        (0, engine_2.listen)('mouseup', onMouseUp);
        (0, engine_2.listen)('mousedown', onMouseDown);
        (0, engine_2.listen)('resize', onResize);
        (0, engine_2.listen)('keydown', onKeyDown);
        engine_2.canvas.addEventListener('wheel', onScrollListener);
        addTouchListeners();
        (0, ui_1.addStylesUI)(styleContext, styles);
        loadAtlases();
        onResize();
        gridSize = smallScreen ? 32 : 64;
    }
    exports.setup = setup;
    function tearDown() {
        (0, engine_2.removeShortcuts)(KbShortcuts);
        (0, engine_2.unlisten)('mouseup', onMouseUp);
        (0, engine_2.unlisten)('mousedown', onMouseDown);
        (0, engine_2.unlisten)('resize', onResize);
        engine_2.canvas.removeEventListener('wheel', onScrollListener);
    }
    exports.tearDown = tearDown;
    function draw() {
        if (loading) {
            drawLoading();
            return;
        }
        // clear the screen
        engine_2.ctx.fillStyle = '#000';
        engine_2.ctx.fillRect(0, 0, engine_2.width, engine_2.height);
        beforeDraw();
        drawMainView();
        (0, ui_1.drawUI)(ui);
    }
    exports.draw = draw;
    function beforeDraw() {
        handleMouseDraw();
        multiselectMode = settings_multiselect ?? !!engine_2.pressedKeys.META;
        if (dragging) {
            dragging.style.left = engine_2.mouseX + draggingDx;
            dragging.style.top = engine_2.mouseY + draggingDy;
        }
    }
    function handleMouseDraw() {
        if (!mouseDown || engine_2.clickY >= toolsOffset || engine_2.mouseY >= toolsOffset) {
            return;
        }
        const { x, y } = toTileCoordinates(engine_2.mouseX, engine_2.mouseY);
        if (deleteMode) {
            const toDelete = tiles.filter(t => t.x === x && t.y === y);
            if (toDelete.length) {
                executeAction({ kind: 'delete-tiles', tiles: toDelete });
            }
            return;
        }
        if (!currentTiles) {
            return;
        }
        // check if this exact tile is already present at this location
        const existing = tiles.some(t => t.x === x
            && t.y === y
            && t.atlas === curAtlas
            && currentTiles.some(c => t.atlasY === c.x && t.atlasY === c.y));
        if (!existing) {
            const tiles = currentTiles.map(t => ({
                x: x + t.dx,
                y: y + t.dy,
                atlasX: t.x,
                atlasY: t.y,
                atlas: curAtlas
            }));
            executeAction({ kind: 'add-tiles', tiles });
        }
    }
    function drawLoading() {
        // clear the screen
        engine_2.ctx.fillStyle = '#000';
        engine_2.ctx.fillRect(0, 0, engine_2.width, engine_2.height);
        engine_2.ctx.fillStyle = 'floralwhite';
        engine_2.ctx.font = '32px serif';
        const dots = (Date.now() % 1000) / 250 | 0;
        const dims = engine_2.ctx.measureText(`Loading ...`);
        engine_2.ctx.fillText(`Loading ${'.'.repeat(dots)}`, (engine_2.width - dims.width) / 2, (engine_2.height - dims.fontBoundingBoxAscent) / 2);
        const progress = `${Object.keys(loadedAtlases).length} / ${assetPaths.length}`;
        const pw = engine_2.ctx.measureText(progress).width;
        engine_2.ctx.fillText(progress, (engine_2.width - pw) / 2, (engine_2.height - dims.fontBoundingBoxAscent) / 2 + 40);
    }
    function drawMainView() {
        engine_2.ctx.save();
        engine_2.ctx.beginPath();
        engine_2.ctx.rect(0, 0, engine_2.width, toolsOffset + 1);
        engine_2.ctx.clip();
        drawGrid();
        drawTiles();
        drawCursor();
        engine_2.ctx.restore();
    }
    function drawGrid() {
        engine_2.ctx.fillStyle = 'darkgray';
        for (let x = 0; x < engine_2.width; x += gridSize) {
            engine_2.ctx.fillRect(x, 0, 1, toolsOffset);
        }
        for (let y = 0; y < toolsOffset; y += gridSize) {
            engine_2.ctx.fillRect(0, y, engine_2.width, 1);
        }
        // the last horizontal line (in case of off-tile height)
        engine_2.ctx.fillRect(0, toolsOffset, engine_2.width, 1);
    }
    function drawTiles() {
        for (const t of tiles) {
            const atlas = loadedAtlases[t.atlas];
            engine_2.ctx.drawImage(atlas, t.atlasX * sliceSize, t.atlasY * sliceSize, sliceSize, sliceSize, t.x * gridSize, t.y * gridSize, gridSize, gridSize);
        }
    }
    function drawCursor() {
        engine_2.canvas.style.cursor = (deleteMode && engine_2.mouseY <= toolsOffset) ? 'none' : 'initial';
        if (engine_2.mouseY > toolsOffset) {
            return;
        }
        if (deleteMode) {
            const deleteIcon = loadedAtlases['img/delete.png'];
            engine_2.ctx.drawImage(deleteIcon, engine_2.mouseX - 16, engine_2.mouseY - 16, 32, 32);
        }
        if (currentTiles && !deleteMode) {
            const x = Math.floor(engine_2.mouseX / gridSize) * gridSize;
            const y = Math.floor(engine_2.mouseY / gridSize) * gridSize;
            const atlas = loadedAtlases[curAtlas];
            const alpha = engine_2.ctx.globalAlpha;
            engine_2.ctx.globalAlpha = 0.75;
            for (const t of currentTiles) {
                engine_2.ctx.drawImage(atlas, t.x * sliceSize, t.y * sliceSize, sliceSize, sliceSize, x + t.dx * gridSize, y + t.dy * gridSize, gridSize, gridSize);
            }
            engine_2.ctx.globalAlpha = alpha;
        }
    }
    function onEscape() {
        deleteMode = false;
        currentTiles = undefined;
        settings_multiselect = undefined;
    }
    function onMouseUp(e) {
        dragging = undefined;
        mouseDown = false;
        if (massHistoryStart !== undefined) {
            aggregateHistory(massHistoryStart, historyIndex);
            massHistoryStart = undefined;
        }
        if (e.button === 'secondary') {
            deleteMode = false;
        }
        if (e.button === 'primary' && (0, ui_1.handleClickUI)(ui)) {
            return;
        }
    }
    let dragging;
    let draggingDx;
    let draggingDy;
    function onMouseDown(e) {
        if ((0, ui_1.isClickInside)(popupHeader)) {
            dragging = popUp;
            draggingDx = popUp.style.left - engine_2.mouseX;
            draggingDy = popUp.style.top - engine_2.mouseY;
            return;
        }
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
        engine_2.ctx.imageSmoothingEnabled = false;
        smallScreen = (engine_2.width < 600 || engine_2.height < 600);
        toolSize = settings_toolSize ?? (smallScreen ? 24 : 64);
        toolsOffset = engine_2.height - (toolSize + 5) * 4 - 5 - 5;
    }
    function onScrollListener(e) {
        if ((0, ui_1.handleScrollUI)(ui, e.deltaX, e.deltaY, true)) {
            return;
        }
        const idx = (0, util_4.clamp)(GridSizes.indexOf(gridSize) + (e.deltaY > 0 ? 1 : -1), 0, GridSizes.length - 1);
        gridSize = GridSizes[idx];
    }
    function onKeyDown(e) {
        e.preventDefault = (0, ui_1.handleKeyDown)(ui, e.key);
    }
    function regenerateUI() {
        if (loading) {
            return;
        }
        ui = settingsOpen
            ? [settingsContainer, popUp]
            : [
                createToolsContainer(),
                createAtlasTiles(tileRows),
                popUp
            ];
    }
    function createToolsContainer() {
        const container = {
            kind: 'container',
            children: [createSmallTools(), createAtlasList()],
            style: '#tools-container',
        };
        return container;
    }
    const zoomButton = {
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
            gridSize = GridSizes[idx];
        }
    };
    const tileRowsButton = {
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
    const deleteModeButton = {
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
    const multiselectModeButton = {
        kind: 'button',
        get style() {
            return multiselectMode ? '.small-button-active' : '.small-button';
        },
        inner: {
            kind: 'text',
            text: 'MUL',
        },
        onClick: () => {
            settings_multiselect = settings_multiselect ? undefined : true;
        }
    };
    const undoButton = {
        kind: 'button',
        style: '.small-button',
        inner: {
            kind: 'text',
            text: 'UNDO',
        },
        onClick: historyUndo
    };
    const redoButton = {
        kind: 'button',
        style: '.small-button',
        inner: {
            kind: 'text',
            text: 'REDO',
        },
        onClick: historyRedo
    };
    const settingsButton = {
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
        multiselect: multiselectModeButton,
        undo: undoButton,
        redo: redoButton,
    };
    function createSmallTools() {
        return {
            kind: 'container',
            children: [
                ...AllButtons.flatMap(btn => settings_buttons.has(btn) ? [smallButtons[btn]] : []),
                settingsButton
            ],
            style: {
                gap: 5,
                scroll: 'y',
                get maxHeight() { return engine_2.height - toolsOffset - 20; },
                layoutMode: 'column'
            },
        };
    }
    ;
    const toolSizeRow = {
        kind: 'container',
        style: { layoutMode: 'row' },
        children: [
            {
                kind: 'text',
                text: 'Tile size:',
                style: '.settings-label'
            },
            {
                kind: 'container',
                style: { layoutMode: 'row' },
                children: [
                    {
                        kind: 'button',
                        get style() { return settings_toolSize ? '.small-button' : '.small-button-active'; },
                        inner: {
                            kind: 'text',
                            text: 'auto'
                        },
                        onClick: () => {
                            settings_toolSize = undefined;
                            onResize();
                        }
                    },
                    ...GridSizes.map(sz => {
                        return {
                            kind: 'button',
                            get style() { return toolSize === sz ? '.small-button-active' : '.small-button'; },
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
    const availableButtons = {
        kind: 'container',
        style: { layoutMode: 'row' },
        children: [
            {
                kind: 'text',
                text: 'Active tools:',
                style: '.settings-label'
            },
            {
                kind: 'container',
                style: { gap: 20, layoutMode: 'row' },
                children: AllButtons.map(btn => {
                    const checkbox = {
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
                            }
                            else {
                                settings_buttons.add(btn);
                            }
                        },
                    };
                    const label = {
                        kind: 'text',
                        text: btn,
                        get style() {
                            return settings_buttons.has(btn) ? '.checkbox-label-active' : '.checkbox-label';
                        }
                    };
                    return {
                        kind: 'container',
                        style: { gap: 8, layoutMode: 'row' },
                        children: [checkbox, label],
                    };
                }),
            },
        ],
    };
    const settingsContainer = {
        kind: 'container',
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
                style: { borderWidth: 1, borderColor: 'darkgray', color: 'darkgray' },
                onClick: () => { settingsOpen = false, regenerateUI(); }
            }
        ],
    };
    const popupHeader = {
        kind: 'container',
        children: [
            {
                kind: 'button',
                inner: {
                    kind: 'text',
                    text: '_',
                },
                onClick: () => { minimised = !minimised; }
            },
            {
                kind: 'button',
                inner: {
                    kind: 'text',
                    text: 'X',
                },
                onClick: () => {
                    popUp.style.display = 'none';
                }
            }
        ],
        style: { width: 300, height: 30, borderWidth: 2, borderColor: 'grey', layoutMode: 'row' }
    };
    const popUp = {
        kind: 'container',
        id: 'pop-up',
        children: [
            popupHeader,
            {
                kind: 'container',
                get children() {
                    if (!selectedStyle) {
                        return Object.getOwnPropertyNames(ui_1.styles).map(st => {
                            return {
                                kind: 'button',
                                id: 'btn-' + st,
                                inner: { kind: 'text', text: st },
                                onClick: () => {
                                    selectedStyle = st;
                                    selectedStyleChildren = createSelectedStyleUI();
                                }
                            };
                        });
                    }
                    return selectedStyleChildren;
                },
                style: { layoutMode: 'column', get display() { return minimised ? 'none' : 'visible'; } }
            },
        ],
        style: { top: 100, left: 100, width: 300, borderWidth: 2, borderColor: 'grey', backgroundColor: 'black', scroll: 'y', layoutMode: 'column', },
    };
    let minimised = false;
    let selectedStyle;
    let selectedStyleChildren;
    const width100 = { width: 100 };
    const backButton = { borderWidth: 1, borderColor: 'darkgray' };
    function createSelectedStyleUI() {
        const style = ui_1.styles[selectedStyle];
        return [
            ...Object.getOwnPropertyNames(style).map(name => {
                const self = {
                    kind: 'text-input',
                    text: String(style[name]),
                    style: {
                        get backgroundColor() { return self === ui_1.focusedInput ? 'floralwhite' : undefined; },
                        get color() { return self === ui_1.focusedInput ? 'black' : undefined; },
                        get padding() { return self === ui_1.focusedInput ? '3 2 2 2' : undefined; },
                    }
                };
                return {
                    kind: 'container',
                    style: { layoutMode: 'row' },
                    children: [
                        {
                            kind: 'text',
                            text: name + ':',
                            style: width100
                        },
                        self
                    ]
                };
            }),
            {
                kind: 'button',
                inner: { kind: 'text', text: 'Back' },
                style: backButton,
                onClick: () => {
                    selectedStyle = undefined;
                    selectedStyleChildren = undefined;
                },
            }
        ];
    }
    function createAtlasList() {
        const list = atlasPaths.map(path => {
            const text = path
                .replace('img/', '')
                .replace('.png', '');
            const button = {
                kind: 'button',
                get style() {
                    return curAtlas === path ? '.atlas-list-button-active' : '.atlas-list-button';
                },
                inner: { kind: 'text', text },
                onClick: () => onAtlasButtonClick(path)
            };
            return button;
        });
        const container = {
            kind: 'container',
            children: list,
            style: '#atlas-list-container',
        };
        return container;
    }
    function onAtlasButtonClick(path) {
        curAtlas = path;
        currentTiles = undefined;
        regenerateUI();
    }
    function createAtlasTiles(nRows) {
        const atlas = loadedAtlases[curAtlas];
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
            const btn = {
                kind: 'button',
                get style() {
                    return currentTiles?.some(t => t.x === data.x && t.y === data.y) ? '.tile-active' : '.tile';
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
                const container = {
                    kind: 'container',
                    children: currRow,
                    style: '.gap5-row',
                };
                rows.push(container);
                currRow = [];
            }
            if (rows.length === nRows || i === count - 1) {
                const container = {
                    kind: 'container',
                    children: rows,
                    style: '.gap5-column',
                };
                cols.push(container);
                rows = [];
            }
        }
        const container = {
            kind: 'container',
            children: cols,
            style: '#tiles-container',
        };
        return container;
    }
    function onAtlasTileClick(data) {
        deleteMode = false;
        if (!currentTiles || !multiselectMode) {
            const existing = currentTiles?.some(t => t.x === data.x && t.y === data.y);
            currentTiles = existing
                ? undefined
                : [{ x: data.x, y: data.y, dx: 0, dy: 0 }];
            return;
        }
        const idx = currentTiles.findIndex(t => t.x === data.x && t.y === data.y);
        if (idx !== -1) {
            currentTiles.splice(idx, 1);
            currentTiles = currentTiles.length ? currentTiles : undefined;
            return;
        }
        currentTiles.push({ x: data.x, y: data.y, dx: 0, dy: 0 });
        const xySets = currentTiles
            .reduce((acc, t) => {
            acc.xs.add(t.x);
            acc.ys.add(t.y);
            return acc;
        }, { xs: new Set, ys: new Set });
        const xs = [...xySets.xs].toSorted((x, y) => x - y);
        const ys = [...xySets.ys].toSorted((x, y) => x - y);
        for (const t of currentTiles) {
            t.dx = xs.indexOf(t.x);
            t.dy = ys.indexOf(t.y);
        }
    }
    function loadAtlases() {
        let leftToLoad = assetPaths.length;
        for (const p of assetPaths) {
            const img = new Image();
            img.onload = () => {
                loadedAtlases[p] = img;
                if (--leftToLoad === 0) {
                    loading = false;
                    (0, ui_1.addAtlasesUI)(loadedAtlases);
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
        let touchY;
        let touchX;
        let touchId;
        window.addEventListener('touchstart', e => {
            // this disables two-finger zooming on safari
            touchId = e.touches[0].identifier;
            touchX = e.touches[0].clientX;
            touchY = e.touches[0].clientY;
            mouseDown = true;
        }, { passive: false /* in safari defaults to `true` for touch and scroll events */ });
        window.addEventListener('touchmove', e => {
            const touch = [...e.touches].find(t => t.identifier === touchId);
            if (!touch) {
                return;
            }
            const deltaX = touchX - touch.clientX;
            const deltaY = touchY - touch.clientY;
            touchX = touch.clientX;
            touchY = touch.clientY;
            (0, ui_1.handleScrollUI)(ui, deltaX, deltaY, false);
        }, { passive: false /* in safari defaults to `true` for touch and scroll events */ });
        window.addEventListener('touchend', () => {
            touchId = undefined;
            mouseDown = false;
        }, { passive: false /* in safari defaults to `true` for touch and scroll events */ });
    }
    function toTileCoordinates(x, y) {
        return { x: Math.floor(x / gridSize), y: Math.floor(y / gridSize) };
    }
    function executeAction(action) {
        if (historyIndex !== history.length) {
            history.splice(historyIndex, history.length - historyIndex);
        }
        history.push(action);
        historyIndex = history.length;
        applyAction(action);
    }
    function historyUndo() {
        if (historyIndex === 0) {
            return;
        }
        const action = history[--historyIndex];
        revertAction(action);
    }
    function historyRedo() {
        if (historyIndex === history.length) {
            return;
        }
        const action = history[historyIndex++];
        applyAction(action);
    }
    function applyAction(action) {
        switch (action.kind) {
            case 'add-tiles': {
                tiles.push(...action.tiles);
                return;
            }
            case 'delete-tiles': {
                tiles = tiles.filter(x => !action.tiles.includes(x));
                return;
            }
            default: (0, util_4.assertNever)(action);
        }
    }
    function revertAction(action) {
        switch (action.kind) {
            case 'add-tiles': {
                tiles = tiles.filter(x => !action.tiles.includes(x));
                return;
            }
            case 'delete-tiles': {
                tiles.push(...action.tiles);
                return;
            }
            default: (0, util_4.assertNever)(action);
        }
    }
    function aggregateHistory(start, end) {
        if (start === end) {
            return;
        }
        const entries = history.slice(start, end);
        // this should never happen under normal circumstances, however one can press CTRL + Z amidst drawing
        if (!entries.length || entries.some((x, _, a) => x.kind !== a[0].kind)) {
            return;
        }
        const aggregated = entries.reduce((acc, x) => {
            acc.tiles.push(...x.tiles);
            return acc;
        });
        history.splice(start, end - start, aggregated);
        historyIndex = history.length;
    }
});
define("index", ["require", "exports", "editor", "engine"], function (require, exports, Game, engine_3) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Game = __importStar(Game);
    let KbShortcuts = [
        [engine_3.toggleDebug, '['],
    ];
    window.onload = function () {
        (0, engine_3.setup)();
        (0, engine_3.registerShortcuts)(KbShortcuts);
        (0, engine_3.setGameObject)(Game);
    };
});
