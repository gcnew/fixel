
import {
    ctx,
    lastT, mouseX, mouseY, clickX, clickY, pressedKeys, addDebugMsg
} from './engine'

import { compileStyle } from './mini-css'
import { type KbKey, keyToSigil, KeyMap } from './keyboard'
import { uuid, clamp, assertNever } from './util'

export type UI = UIText
               | UITextInput
               | UIImage
               | UIButton
               | UIContainer

type Focusable = UITextInput

export interface UIContainer extends UIBase<UIContainer> {
    kind: 'container',
    children: UI[],
}

export interface UIText extends UIBase<UIText> {
    kind: 'text',
    text: string,
}

export interface UIImage extends UIBase<UIImage> {
    kind: 'image',
    src: string,
    x?: number,
    y?: number,
    width?: number,
    height?: number
}

export type EditData = {
    text: string,
    cursor: number,
    lastKeyT: number,
    selection: undefined | {
        start: number,
        end: number
    },
    history: HistoryEntry[],
    historyIndex: number,
}

export type HistoryEntry = {
    cursor: number,
    inserted: string,
    deleted: string,

    // FEATURE: in a future version can support multiple cursors, which require selection tracking
    //          the current version is intended to behave lika a classic `<input type=text>` field
    // selectionStart: number,
    // selectionEnd: number,
}

export interface UITextInput extends UIBase<UITextInput> {
    kind: 'text-input',
    text: string,
    edit?: EditData | undefined,
    onChange?: (self: UITextInput, newText: string) => void,
}

export type ImageSlice = { kind: 'image', src: string, dx: number, dy: number, w: number, h: number }
export type TextProps  = { kind: 'text', text: string }

export { UIButton as Button }
export interface UIButton extends UIBase<UIButton> {
    kind: 'button',
    inner: ImageSlice | TextProps
}

export interface UIBase<T> {
    id?: string,
    style?: string | UIStyle,
    onClick?: (self: T) => void,
}

export interface UIStyle {
    top?: number,
    left?: number,

    width?: number,
    height?: number,

    maxWidth?: number | undefined,
    maxHeight?: number | undefined,

    color?: string,
    font?: string,
    align?: 'left' | 'right' | 'center',
    verticalAlign?: 'top' | 'center' | 'bottom',

    borderWidth?: number | string | Partial<TRBL>,
    borderColor?: string,

    backgroundColor?: string | undefined,
    display?: 'none' | 'hidden' | 'visible',

    margin?: number | string | Partial<TRBL>,
    padding?: number | string | Partial<TRBL>,

    gap?: number | string,
    layoutMode?: 'column' | 'row',
    scroll?: 'x' | 'y' | undefined,
}

type LayoutData = {
    id: string,
    style: UIStyle | undefined,

    $x: number,
    $y: number,
    $w: number,
    $h: number,

    textMetrics: TextMetrics | undefined,
    imageDimensions: { width: number, height: number } | undefined,

    scroll: 'x' | 'y' | undefined,
    scrollX: number,
    scrollY: number,
    scrollHeight: number,
    scrollWidth: number,

    // Accessors
    maxWidth: number | undefined,
    maxHeight: number | undefined,

    color: string,
    font: string,
    align: 'left' | 'right' | 'center',
    verticalAlign: 'top' | 'center' | 'bottom',

    borderWidth: TRBL,
    borderColor: string,

    backgroundColor: string | undefined,
    display: 'none' | 'hidden' | 'visible',

    margin:  TRBL,
    padding: TRBL,

    gap: { row: number, column: number },
    layoutMode: 'column' | 'row',
}

type TRBL = { top: number, right: number, bottom: number, left: number }

type OmitOwn<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

const defaultStyle: Required<OmitOwn<UIStyle, 'width' | 'height'>> = {
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

let focusedId: string | undefined;
export let focusedInput: Focusable | undefined;

export const styles: ReturnType<typeof compileStyle<UIStyle>> = {};

const loadedAtlases: { [k: string]: HTMLImageElement } = {};

const idMap = new WeakMap<UI, string>();
const layoutCache = new Map<string, { style: UI['style'], layout: LayoutData }>();

let displayBoundingBoxes = false;

let _mouseX: number;
let _mouseY: number;
let _clickX: number | undefined;

let mouseDx: number;
let mouseDy: number;

addDebugMsg(() => { const x = focusedInput?.edit?.historyIndex.toString(); return x && `h-idx: ${x}` });
addDebugMsg(() => { const x = focusedInput?.edit?.history.length.toString(); return x && `h-len: ${x}` });
addDebugMsg(() => { const x = focusedInput?.edit?.cursor.toString(); return x && `cursor: ${x}` });

export { accessDisplayBoundingBoxes as displayBoundingBoxes }
function accessDisplayBoundingBoxes(val?: boolean): boolean {
    if (typeof val === 'boolean') {
        displayBoundingBoxes = val;
    }

    return displayBoundingBoxes;
}

export function addStylesUI(styleContext: Object, stylesToAdd: string) {
    const compiled = compileStyle<UIStyle>(styleContext, stylesToAdd);
    Object.defineProperties(styles, Object.getOwnPropertyDescriptors(compiled));
}

export function addAtlasesUI(atlases: typeof loadedAtlases) {
    Object.defineProperties(loadedAtlases, Object.getOwnPropertyDescriptors(atlases));
}

export { layoutDraw as drawUI }
function layoutDraw(ui: UI[]) {

    beforeDraw(ui);

    const baseline = ctx.textBaseline;
    ctx.textBaseline = 'top';

    // update the `focusedInput` object on every draw cycle, as the element reference
    // might change; the element is replaced by an element with the same `id`
    const focusCache = focusedInput;
    focusedInput = undefined;

    calcBoxes(ui);
    layout(ui);
    drawUI(ui);

    if (!focusedInput && focusCache) {
        focusedInput = focusCache;
        loseFocus();
    }

    ctx.textBaseline = baseline;
}

function beforeDraw(ui: UI[]) {
    mouseDx = _mouseX - mouseX;
    mouseDy = _mouseY - mouseY;

    _mouseX = mouseX;
    _mouseY = mouseY;

    // TODO ...
    mouseDx;
    mouseDy;

    if (clickX !== undefined && _clickX === undefined) {
        handleMouseDown(ui);
    }

    handleMouseMove(ui);

    _clickX = clickX;
}

function calcBoxes(ui: UI[]) {
    for (const o of ui) {
        const ld = getOrCreateLayout(o);
        if (ld.display === 'none') {
            continue;
        }

        switch (o.kind) {
            case 'text':       calcTextBox(o);      break;
            case 'text-input': calcTextInputBox(o); break;

            case 'image':      calcImageBox(o);     break;
            case 'button':     calcButtonBox(o);    break;
            case 'container':  calcContainerBox(o); break;

            default: assertNever(o);
        }
    }
}

function calcTextBox(o: UIText) {
    const ld = getOrCreateLayout(o);

    ctx.font = ld.font;

    const dims = ctx.measureText(o.text);
    ld.textMetrics = dims;
    ld.$w = ld.style?.width ?? (dims.width + ld.padding.left + ld.padding.right);
    ld.$h = ld.style?.height ?? (dims.fontBoundingBoxDescent + ld.padding.top + ld.padding.bottom);
}

function calcTextInputBox(o: UITextInput) {
    const ld = getOrCreateLayout(o);

    // TODO: this might be better placed in `layout`
    if (ld.id === focusedId && o.kind === 'text-input') {
        focusedInput = o;
    }

    ctx.font = ld.font;

    const text = o.edit?.text ?? o.text;
    const dims = ctx.measureText(text);
    ld.textMetrics = dims;
    ld.$w = ld.style?.width ?? (dims.width + ld.padding.left + ld.padding.right);
    ld.$h = ld.style?.height ?? (dims.fontBoundingBoxDescent + ld.padding.top + ld.padding.bottom);
}

function calcImageBox(o: UIImage) {
    const ld = getOrCreateLayout(o);
    const img = loadedAtlases[o.src];

    ld.imageDimensions = img
        ? { width: img.naturalWidth, height: img.naturalHeight }
        : { width: 0, height: 0 };

    ld.$w = ld.style?.width ?? ((o.width ?? ld.imageDimensions.width) + ld.padding.left + ld.padding.right);
    ld.$h = ld.style?.height ?? ((o.height ?? ld.imageDimensions.height) + ld.padding.top + ld.padding.bottom);
}

function calcButtonBox(o: UIButton) {
    const ld = getOrCreateLayout(o);

    if (o.inner.kind === 'text') {
        ctx.font = ld.font;
        const dims = ctx.measureText(o.inner.text);

        ld.textMetrics = dims;
        ld.$w = ld.style?.width ?? (dims.width + ld.padding.left + ld.padding.right + 10);
        ld.$h = ld.style?.height ?? (dims.actualBoundingBoxDescent + ld.padding.top + ld.padding.bottom + 10);
    }

    if (o.inner.kind === 'image') {
        ld.$w = ld.style?.width ?? (o.inner.w + ld.padding.left + ld.padding.right);
        ld.$h = ld.style?.width ?? (o.inner.h + ld.padding.top + ld.padding.bottom);
    }
}

function calcContainerBox(o: UIContainer) {
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

    ld.$w = Math.min(
        ld.style?.width ?? (ld.scrollWidth + ld.padding.left + ld.padding.right),
        ld.style?.maxWidth ?? Infinity
    );
    ld.$h = Math.min(
        ld.style?.height ?? (ld.scrollHeight + ld.padding.top + ld.padding.bottom),
        ld.style?.maxHeight ?? Infinity
    );

    ld.scrollX = clamp(ld.scrollX, Math.min(ld.$w, ld.scrollWidth) - ld.scrollWidth, 0);
    ld.scrollY = clamp(ld.scrollY, Math.min(ld.$h, ld.scrollHeight) - ld.scrollHeight, 0);
}

function layout(ui: UI[]) {
    for (const o of ui) {
        const ld = getOrCreateLayout(o);
        if (ld.display === 'none') {
            continue;
        }

        switch (o.kind) {
            case 'text':       break;
            case 'image':      break;
            case 'button':     break;
            case 'text-input': break;
            case 'container':  layoutContainer(o); break;

            default: assertNever(o);
        }
    }
}

function layoutContainer(o: UIContainer) {
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
        } else {
            dy += childLd.$h + childLd.margin.top + childLd.margin.bottom + ld.gap.row;
        }
    }

    layout(o.children);
}

function drawUI(ui: UI[]) {
    for (const o of ui) {
        const ld = getOrCreateLayout(o);
        if (ld.display !== 'visible') {
            continue;
        }

        switch (o.kind) {
            case 'text':       drawText(o);      break;
            case 'text-input': drawTextInput(o); break;
            case 'image':      drawImage(o);     break;
            case 'button':     drawButton(o);    break;
            case 'container':  drawContainer(o); break;

            default: assertNever(o);
        }
    }
}

function drawText(o: UIText) {
    const ld = getOrCreateLayout(o);

    if (ld.backgroundColor) {
        ctx.fillStyle = ld.backgroundColor;
        ctx.fillRect(ld.$x, ld.$y, ld.$w, ld.$h);
    }

    ctx.fillStyle = ld.color;
    ctx.font = ld.font;
    ctx.fillText(o.text, ld.$x + ld.padding.left, ld.$y + ld.padding.top);

    drawBoundingBox(ld);
}

function drawTextInput(o: UITextInput) {
    const ld = getOrCreateLayout(o);

    if (ld.backgroundColor) {
        ctx.fillStyle = ld.backgroundColor;
        ctx.fillRect(ld.$x, ld.$y, ld.$w + 3, ld.$h);
    }

    // TODO: ...
    const clip = !!ld.scroll || ld.textMetrics!.width > ld.$w;
    if (clip) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(ld.$x, ld.$y, ld.$w, ld.$h);
        ctx.clip();
    }

    if (o === focusedInput && o.edit?.selection) {
        const prefix = o.edit.text.slice(0, o.edit.selection.start);
        const offset = ctx.measureText(prefix).width;

        const selected = o.edit.text.slice(o.edit.selection.start, o.edit.selection.end);
        const width = ctx.measureText(selected).width;

        ctx.fillStyle = '#b4d7ff';
        ctx.fillRect(
            ld.$x + ld.padding.left + offset,
            ld.$y + ld.padding.top - 2,
            width,
            ld.$h - 2
        );
    }

    const text = o.edit?.text ?? o.text;
    ctx.fillStyle = ld.color;
    ctx.font = ld.font;
    ctx.fillText(text, ld.$x + ld.padding.left, ld.$y + ld.padding.top);

    if (o === focusedInput && o.edit) {
        const prefix = o.edit.text.slice(0, o.edit.cursor);
        const offset = ctx.measureText(prefix).width;

        const isOdd = (lastT - o.edit.lastKeyT) / 500 & 1;
        if (isOdd === 0) {
            ctx.fillStyle = ld.color;
            ctx.fillRect(
                ld.$x + ld.padding.left + offset,
                ld.$y + ld.padding.top - 2,
                1,
                ld.$h - 2
            );
        }
    }

    if (clip) {
        ctx.restore();
    }

    drawBoundingBox(ld);
}

function drawImage(o: UIImage) {
    const ld = getOrCreateLayout(o);
    const atlas = loadedAtlases[o.src];

    if (atlas) {
        ctx.drawImage(atlas,
            o.x ?? 0,
            o.y ?? 0,
            o.width ?? ld.imageDimensions!.width,
            o.height ?? ld.imageDimensions!.height,
            ld.$x + ld.padding.left,
            ld.$y + ld.padding.top,
            ld.$w - ld.padding.left - ld.padding.right,
            ld.$h - ld.padding.top - ld.padding.bottom
        );
    }

    drawBorder(ld);
    drawBoundingBox(ld);
}

function drawButton(o: UIButton) {
    const ld = getOrCreateLayout(o);

    if (ld.backgroundColor) {
        ctx.fillStyle = ld.backgroundColor;
        ctx.fillRect(ld.$x, ld.$y, ld.$w, ld.$h);
    }

    if (o.inner.kind === 'text') {
        ctx.fillStyle = ld.color;
        ctx.font = ld.font;

        const dims = ld.textMetrics!;
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

        ctx.fillText(o.inner.text, ld.$x + wOffset, ld.$y + ch, ld.$w - 9);


        if (displayBoundingBoxes) {
            drawBoundingBox({ $x: ld.$x + ld.$w - dims.width - 4, $y: ld.$y, $w: dims.width, $h: dims.fontBoundingBoxDescent });
        }
    }

    if (o.inner.kind === 'image') {
        const atlas = loadedAtlases[o.inner.src];

        if (atlas) {
            ctx.drawImage(atlas, o.inner.dx, o.inner.dy, o.inner.w, o.inner.h, ld.$x, ld.$y, ld.$w, ld.$h);
        }
    }

    drawBorder(ld);
}

function drawContainer(o: UIContainer) {
    const ld = getOrCreateLayout(o);

    // TODO: this must be `content{Width, Height}` not `$h / $w`
    const clip = !!ld.scroll || ld.scrollHeight > ld.$h || ld.scrollWidth > ld.$w;
    if (clip) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(ld.$x - 0.5, ld.$y - 0.5, ld.$w + 0.5, ld.$h + 0.5);
        ctx.clip();
    }

    if (ld.backgroundColor) {
        ctx.fillStyle = ld.backgroundColor;
        ctx.fillRect(ld.$x, ld.$y, ld.$w, ld.$h);
    }

    drawUI(o.children);
    if (clip) {
        ctx.restore();
    }

    drawBorder(ld);
    drawBoundingBox(ld);
}

function drawBorder(ld: LayoutData) {
    const borderWidth = ld.borderWidth;
    const strokeStyle = ld.borderColor;

    drawLine(ld.$x,         ld.$y,         ld.$w, 0,     strokeStyle, borderWidth.top);
    drawLine(ld.$x + ld.$w, ld.$y,         0,     ld.$h, strokeStyle, borderWidth.right);
    drawLine(ld.$x,         ld.$y + ld.$h, ld.$w, 0,     strokeStyle, borderWidth.bottom);
    drawLine(ld.$x,         ld.$y,         0,     ld.$h, strokeStyle, borderWidth.left);
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

function drawBoundingBox({$x, $y, $w, $h}: { $x: number, $y: number, $w: number, $h: number }) {
    if (displayBoundingBoxes) {
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 1;
        ctx.strokeRect($x, $y, $w, $h);
    }
}

function getOrCreateLayout(o: UI): LayoutData {
    let id = o.id ?? idMap.get(o);
    if (id === undefined) {
        id = uuid();
        idMap.set(o, id);
    }

    const existing = layoutCache.get(id);
    if (existing && existing.style === o.style) {
        return existing.layout;
    }

    const style = typeof o.style === 'string'
        ? styles[o.style]
        : o.style;

    const ld = createLayoutData(id, style);
    layoutCache.set(id, { style: o.style, layout: ld });

    return ld;
}

const zeroTRBL: TRBL = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
};

type TRBLCacheCell = { key: string | number | Partial<TRBL>, value: TRBL }
function createLayoutData(id: string, style: UIStyle | undefined): LayoutData {
    const res: LayoutData & {
        $$x: number | undefined,
        $$y: number | undefined,

        $borderWidth: TRBLCacheCell,
        $margin: TRBLCacheCell,
        $padding: TRBLCacheCell,
        $gap: { key: string | number, value: { row: number, column: number } }
    } = {

        id,
        style,

        $$x: undefined,
        get $x() { return this.$$x ?? style?.left ?? defaultStyle.left; },
        set $x(val: number) { this.$$x = val; },

        $$y: undefined,
        get $y() { return this.$$y ?? style?.top ?? defaultStyle.top; },
        set $y(val: number) { this.$$y = val; },

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
        get maxWidth()        { return style?.maxWidth        || defaultStyle.maxWidth;        },
        get maxHeight()       { return style?.maxHeight       || defaultStyle.maxHeight;       },
        get color()           { return style?.color           || defaultStyle.color;           },
        get font()            { return style?.font            || defaultStyle.font;            },
        get align()           { return style?.align           || defaultStyle.align;           },
        get verticalAlign()   { return style?.verticalAlign   || defaultStyle.verticalAlign;   },
        get borderColor()     { return style?.borderColor     || defaultStyle.borderColor;     },
        get backgroundColor() { return style?.backgroundColor || defaultStyle.backgroundColor; },
        get display()         { return style?.display         || defaultStyle.display          },

        get layoutMode()      { return style?.layoutMode      || defaultStyle.layoutMode       },

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

function cacheTRBL(property: string, cache: TRBLCacheCell, key: TRBLCacheCell['key']): TRBL {
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
            get top() { return key.top ?? 0 },
            get right() { return key.right ?? 0 },
            get bottom() { return key.bottom ?? 0 },
            get left() { return key.left ?? 0 },
        };

        return cache.value;
    }

    let parsed = key.split(/\s+/g)
        .map(Number);

    if (parsed.length !== 2 && parsed.length !== 4) {
        console.warn(`Bad ${property} style: ${key}`);
        parsed = [0, 0, 0, 0];
    } else if (parsed.length === 2) {
        // top|bottom, left|right -> top,right,bottom,left
        parsed = [parsed[0]!, parsed[1]!, parsed[0]!, parsed[1]!];
    }

    cache.key = key;
    cache.value = { top: parsed[0]!, right: parsed[1]!, bottom: parsed[2]!, left: parsed[3]! };

    return cache.value;
}

function cacheGap(property: string, cache: { key: string | number, value: { row: number, column: number } }, key: string|number): { row: number, column: number } {
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
    cache.value = { row: parsed[0]!, column: parsed[1]! };

    return cache.value;
}

export function handleMouseDown(ui: UI[]): boolean {
    // losing focus should happend before the other events
    if (focusedInput && !isMouseInside(focusedInput)) {
        loseFocus();
    }

    return handleMouseDownWorker(ui);
}

function handleMouseDownWorker(ui: UI[]): boolean {
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

                if (focusedInput !== o) {
                    loseFocus();

                    focusedInput = o;
                    focusedId = o.id ?? idMap.get(o);

                    if (!focusedInput.edit) {
                        focusedInput.edit = {
                            text: focusedInput.text,
                            cursor: 0,
                            lastKeyT: lastT,
                            selection: undefined,
                            history: [],
                            historyIndex: 0
                        };
                    }
                }

                const edit = focusedInput.edit!;
                const saved = edit.cursor;

                edit.lastKeyT = lastT;
                edit.cursor = mousePositionToCursor(focusedInput, mouseX);

                if (pressedKeys.SHIFT) {
                    if (!edit.selection) {
                        edit.selection = {
                            start: Math.min(saved, edit.cursor),
                            end: Math.max(saved, edit.cursor)
                        };
                    } else if (edit.cursor < edit.selection.end && (edit.selection.start === saved || edit.cursor <= edit.selection.start)) {
                        edit.selection.start = edit.cursor;
                    } else {
                        edit.selection.end = edit.cursor;
                    }
                    if (edit.selection.start === edit.selection.end) {
                        edit.selection = undefined;
                    }
                } else {
                    edit.selection = undefined;
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

            default: assertNever(o);
        }
    }

    return false;
}

// TODO: fix me, currently quadratic
function mousePositionToCursor(o: UITextInput, mouseX: number) {
    const ld = getOrCreateLayout(o);

    const text = o.edit!.text;
    const x = mouseX - ld.$x - ld.padding.left;

    let lastMeasure = 0;
    for (let i = 1; i <= text.length; ++i) {
        const prefix = text.slice(0, i);
        const width = ctx.measureText(prefix).width;

        if (width > x) {
            return x - lastMeasure <= width - x
                ? i - 1
                : i;
        }

        lastMeasure = width;
    }

    return x > lastMeasure
        ? text.length
        : 0;
}

function handleMouseMove(_ui: UI[]) {
    if (clickX === undefined || !focusedInput) {
        return;
    }

    const edit = focusedInput.edit!;
    const saved = edit.cursor;

    edit.cursor = mousePositionToCursor(focusedInput, mouseX);
    if (edit.cursor === saved) {
        return;
    }

    edit.lastKeyT = lastT;
    if (edit.selection) {
        if (saved === edit.selection.start) {
            edit.selection.start = edit.cursor;
        } else if (saved === edit.selection.end) {
            edit.selection.end = edit.cursor;
        }
        if (edit.selection.end < edit.selection.start) {
            const tmp = edit.selection.start;
            edit.selection.start = edit.selection.end;
            edit.selection.end = tmp;
        }
        if (edit.selection.start === edit.selection.end) {
            edit.selection = undefined;
        }
    } else if (saved !== edit.cursor) {
        edit.selection = {
            start: Math.min(saved, edit.cursor),
            end: Math.max(saved, edit.cursor)
        }
    } else {
        edit.selection = undefined;
    }
}

export function loseFocus() {
    if (focusedInput?.edit) {
        focusedInput.edit = undefined;
    }

    focusedId = undefined;
    focusedInput = undefined;
}

export function handleClickUI(ui: UI[]): boolean {
    for (const o of ui) {
        switch (o.kind) {
            case 'text':
            case 'text-input':
            case 'image':
            case 'button': {
                if (o.onClick && isClickInside(o)) {
                    o.onClick(o as any); // TYH: ts can't figure out the relation, lol
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

            default: assertNever(o);
        }
    }

    return false;
}

export function isClickInside(o: UI) {
    const ld = getOrCreateLayout(o);

    // for a click to be valid, both the initial touch down and the current position need
    // to be inside the element
    return ld.display !== 'none'
        && clickX! >= ld.$x && clickX! <= ld.$x + ld.$w
        && clickY! >= ld.$y && clickY! <= ld.$y + ld.$h
        && mouseX >= ld.$x && mouseX <= ld.$x + ld.$w
        && mouseY >= ld.$y && mouseY <= ld.$y + ld.$h;
}

export function isMouseInside(o: UI) {
    const ld = getOrCreateLayout(o);

    return ld.display !== 'none'
        && mouseX >= ld.$x && mouseX <= ld.$x + ld.$w
        && mouseY >= ld.$y && mouseY <= ld.$y + ld.$h;
}

function isScrollInside(o: UI, isWheel: boolean) {
    const ld = getOrCreateLayout(o);

    if (isWheel) {
        return ld.display !== 'none'
            && mouseX >= ld.$x && mouseX <= ld.$x + ld.$w
            && mouseY >= ld.$y && mouseY <= ld.$y + ld.$h;
    }

    // touch devices: scroll should work for the element where the tap was initiated
    // even if the current position of the pointer is outside the scrolled element
    return ld.display !== 'none'
        && clickX! >= ld.$x && clickX! <= ld.$x + ld.$w
        && clickY! >= ld.$y && clickY! <= ld.$y + ld.$h;
}

export function handleScrollUI(ui: UI[], deltaX: number, deltaY: number, isWheel: boolean): boolean {
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
                } else {
                    ld.scrollY = ld.scrollY - deltaY;
                }

                return true;
            }

            default: assertNever(o);
        }
    }

    return false;
}

// todo:
// - history
// - scrolling
// - fix mouse to position, currently quadratic
// - fix mouse position, try `hellllooo? or slam the bee`
// - cleanup selection management as it's all over the place
// - add support for double and tripple click
// - add support for mouse selection via y up & y down
// - add tests?
// - mobile support?
export function handleKeyDown(_ui: UI[], key: KbKey): boolean {
    if (!focusedInput || !focusedInput.edit) {
        return false;
    }

    const sigil = keyToSigil(key);
    const edit = focusedInput.edit;

    edit.lastKeyT = lastT;

    switch (sigil) {
        case 'META+LEFT':
        case 'HOME':
        case 'UP': {
            edit.cursor = 0;
            edit.selection = undefined;
            return true;
        }

        case 'META+SHIFT+LEFT':
        case 'SHIFT+HOME':
        case 'SHIFT+UP': {
            if (edit.selection) {
                edit.selection.start = 0;
            } else if (edit.cursor !== 0) {
                edit.selection = {
                    start: 0,
                    end: edit.cursor
                };
            }

            edit.cursor = 0;
            return true;
        }

        case 'META+RIGHT':
        case 'END':
        case 'DOWN': {
            edit.cursor = edit.text.length;
            edit.selection = undefined;
            return true;
        }

        case 'META+SHIFT+RIGHT':
        case 'SHIFT+END':
        case 'SHIFT+DOWN': {
            if (edit.selection) {
                edit.selection.end = edit.text.length;
            } else if (edit.cursor !== edit.text.length) {
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
                } else if (edit.cursor === edit.selection.end) {
                    edit.cursor = Math.max(edit.cursor - 1, 0);
                    edit.selection.end = edit.cursor;
                }
                if (edit.selection.start === edit.selection.end) {
                    edit.selection = undefined;
                }
            } else {
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
        case 'CTRL+BACKSPACE':
        case 'CTRL+SHIFT+BACKSPACE':
        case 'ALT+LEFT':
        case 'ALT+SHIFT+LEFT':
        case 'ALT+BACKSPACE':
        case 'ALT+SHIFT+BACKSPACE': {
            const rx = key.altKey
                ? /[\p{L}_\p{N}]+\s*$/u
                : /(?:\p{Lu}?[\p{Ll}\p{N}]+|(?:\p{Lu}(?!\p{Ll}))+)_*\s*$/u;
            const prefix = edit.text.slice(0, edit.cursor);
            const offset = rx.exec(prefix)?.[0].length
                ?? /(?:\p{S}+|\p{P}+)\s*$/u.exec(prefix)?.[0].length
                ?? 1;

            const saved = edit.cursor;
            edit.cursor = Math.max(edit.cursor - offset, 0);

            if (KeyMap[key.code as keyof typeof KeyMap] === 'BACKSPACE') {
                const start = edit.selection ? edit.selection.start : edit.cursor;
                const end = edit.selection ? edit.selection.end : saved;

                const patch: HistoryEntry = {
                    cursor: start,
                    inserted: '',
                    deleted: edit.text.slice(start, end)
                };
                applyPatch(edit, patch);
            } else if (key.shiftKey) {
                if (edit.selection) {
                    if (edit.selection.end === saved && edit.cursor >= edit.selection.start) {
                        edit.selection.end = edit.cursor;
                    } else {
                        edit.selection.start = edit.cursor;
                    }
                    if (edit.selection.start === edit.selection.end) {
                        edit.selection = undefined;
                    }
                } else {
                    edit.selection = edit.cursor !== saved
                        ? { start: edit.cursor, end: saved }
                        : undefined;
                }
            } else {
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
                } else if (edit.cursor === edit.selection.end) {
                    edit.cursor = Math.min(edit.cursor + 1, edit.text.length);
                    edit.selection.end = edit.cursor;
                }
                if (edit.selection.start === edit.selection.end) {
                    edit.selection = undefined;
                }
            } else {
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
        case 'CTRL+DELETE':
        case 'CTRL+SHIFT+DELETE':
        case 'ALT+RIGHT':
        case 'ALT+SHIFT+RIGHT':
        case 'ALT+DELETE':
        case 'ALT+SHIFT+DELETE': {
            const rx = key.altKey
                ? /^\s*[\p{L}_\p{N}]+/u
                : /^\s*_*(?:\p{Lu}?[\p{Ll}\p{N}]+|(?:\p{Lu}(?!\p{Ll}))+)/u;
            const suffix = edit.text.slice(edit.cursor);
            const offset = rx.exec(suffix)?.[0].length
                ?? /^\s*(?:\p{S}+|\p{P}+)/u.exec(suffix)?.[0].length
                ?? 1;

            const saved = edit.cursor;
            edit.cursor = Math.min(edit.cursor + offset, edit.text.length);

            if (KeyMap[key.code as keyof typeof KeyMap] === 'DELETE') {
                const start = edit.selection ? edit.selection.start : saved;
                const end = edit.selection ? edit.selection.end : edit.cursor;

                const patch: HistoryEntry = {
                    cursor: start,
                    inserted: '',
                    deleted: edit.text.slice(start, end)
                };
                applyPatch(edit, patch);
            } else if (key.shiftKey) {
                if (edit.selection) {
                    if (edit.selection.start === saved && edit.cursor <= edit.selection.end) {
                        edit.selection.start = edit.cursor;
                    } else {
                        edit.selection.end = edit.cursor;
                    }
                    if (edit.selection.start === edit.selection.end) {
                        edit.selection = undefined;
                    }
                } else {
                    edit.selection = edit.cursor !== saved
                        ? { start: saved, end: edit.cursor }
                        : undefined;
                }
            } else {
                edit.selection = undefined;
            }

            return false;
        }

        case 'META+DELETE': {
            const patch: HistoryEntry = {
                cursor: edit.cursor,
                inserted: '',
                deleted: edit.text.slice(edit.cursor)
            };
            applyPatch(edit, patch);

            return false;
        }

        case 'META+BACKSPACE': {
            const patch: HistoryEntry = {
                cursor: 0,
                inserted: '',
                deleted: edit.text.slice(0, edit.cursor)
            };
            applyPatch(edit, patch);

            return false;
        }

        case 'DELETE':
        case 'BACKSPACE': {

            const start = edit.selection
                ? edit.selection.start
                : (sigil === 'BACKSPACE') ? Math.max(edit.cursor - 1, 0) : edit.cursor;
            const end = edit.selection
                ? edit.selection.end
                : (sigil === 'BACKSPACE') ? edit.cursor : Math.min(edit.cursor + 1, edit.text.length);

            const patch: HistoryEntry = {
                cursor: start,
                inserted: '',
                deleted: edit.text.slice(start, end)
            };
            applyPatch(edit, patch);

            return false;
        }

        case 'ESC': {
            loseFocus();
            return false;
        }

        case 'CTRL+C':
        case 'META+C': {
            if (edit.selection) {
                const selected = edit.text.slice(edit.selection.start, edit.selection.end);
                navigator.clipboard.writeText(selected);
            }
            return false;
        }

        case 'CTRL+V':
        case 'META+V': {
            // This is not entirely correct as it will happen sometime in the future due to the promise
            // i.e. there is a race condition, but I think it's good enough as is
            navigator.clipboard
                .readText()
                .then(text => {
                    const start = edit.selection ? edit.selection.start : edit.cursor;
                    const end = edit.selection ? edit.selection.end : edit.cursor;

                    const patch: HistoryEntry = {
                        cursor: start,
                        inserted: text,
                        deleted: edit.text.slice(start, end)
                    };
                    applyPatch(edit, patch);
                });

            return false;
        }

        case 'CTRL+X':
        case 'META+X': {
            if (edit.selection) {
                const selected = edit.text.slice(edit.selection.start, edit.selection.end);
                const patch: HistoryEntry = {
                    cursor: edit.selection!.start,
                    inserted: '',
                    deleted: selected
                };

                navigator.clipboard
                    .writeText(selected)
                    .then(() => {
                        applyPatch(edit, patch);
                    });
            }

            return false;
        }

        case 'CTRL+A':
        case 'META+A': {
            edit.selection = {
                start: 0,
                end: edit.text.length
            };
            edit.cursor = edit.text.length;

            return false;
        }

        case 'CTRL+Z':
        case 'META+Z': {
            historyUndo(edit);
            return true;
        }

        case 'CTRL+Y':
        case 'CTRL+SHIFT+Z':
        case 'META+SHIFT+Z': {
            historyRedo(edit, true);
            return true;
        }

        default: {
            // accept only characters
            if (key.key.length === 1) {
                const start = edit.selection ? edit.selection.start : edit.cursor;
                const end = edit.selection ? edit.selection.end : edit.cursor;

                const patch: HistoryEntry = {
                    cursor: start,
                    inserted: key.key,
                    deleted: edit.text.slice(start, end)
                };
                applyPatch(edit, patch);
            }

            return false;
        }
    }
}

function applyPatch(edit: EditData, patch: HistoryEntry) {
    // do not accummulate empty patches
    if (patch.inserted.length === 0 && patch.deleted.length === 0) {
        return;
    }

    if (edit.historyIndex !== edit.history.length) {
        edit.history.length = edit.historyIndex;
    }

    edit.history.push(patch);
    historyRedo(edit, false);
    historyAggregate(edit);
}

function historyUndo(edit: EditData) {
    if (edit.historyIndex === 0) {
        return;
    }

    const patch = edit.history[--edit.historyIndex]!;

    edit.cursor = patch.cursor;
    edit.text = edit.text.slice(0, edit.cursor) + patch.deleted + edit.text.slice(edit.cursor + patch.inserted.length);
    edit.cursor += patch.deleted.length;
    edit.selection = {
        start: edit.cursor - patch.deleted.length,
        end: edit.cursor
    };
}

function historyRedo(edit: EditData, selectInserted: boolean) {
    if (edit.historyIndex === edit.history.length) {
        return;
    }

    const patch = edit.history[edit.historyIndex++]!;

    edit.cursor = patch.cursor;
    edit.text = edit.text.slice(0, edit.cursor) + patch.inserted + edit.text.slice(edit.cursor + patch.deleted.length);
    edit.cursor += patch.inserted.length;
    edit.selection = selectInserted
        ? {
            start: edit.cursor - patch.inserted.length,
            end: edit.cursor
        }
        : undefined;
}

// Logic:
//  - aggergation is currently done only for the last 2 entries, a possible improvement can be time based aggregation of old entries
//  - when space (any whitespace) is encountered a new history entry is started
//  - deletions also starts a new entry, but multiple deletions should be aggregated
//  - copy pasting is aggregated (this is not the case in the browser)
//  - take notice of the cursor position, i.e. if the cursor position is not adjacent to the last edit no aggregation should take place
function historyAggregate(edit: EditData) {
    if (edit.historyIndex !== edit.history.length || edit.history.length < 2) {
        return;
    }

    const curr = edit.history[edit.history.length - 1]!;

    // if the last record contains deletions, the inserted text is whitespace or is copy/paste - start a new aggregation entry
    if (curr.deleted || /^\s+$/.test(curr.inserted) || isMultiChar(curr.inserted)) {
        return;
    }

    const acc = edit.history[edit.history.length - 2]!;
    if (acc.cursor + acc.inserted.length !== curr.cursor) {
        // the cursor has moved, create a new entry
        return;
    }

    edit.history.pop();
    edit.historyIndex -= 1;

    edit.history[edit.history.length - 1] = {
        cursor: acc.cursor,
        inserted: acc.inserted + curr.inserted,
        deleted: curr.deleted + acc.deleted,
    };
}

function isMultiChar(s: string) {
    let idx = 0;

    for (const _ of s) {
        idx++;
        if (idx > 1) {
            return true;
        }
    }

    return false;
}

export function debugBoundingBox(ui: UI[]) {
    const lds = ui.map(getOrCreateLayout);
    const x = Math.min(... lds.map(o => o.$x));
    const y = Math.min(... lds.map(o => o.$y));
    const right = Math.max(... lds.map(o => o.$x + o.$w));
    const bottom = Math.max(... lds.map(o => o.$y + o.$h));

    return { x, y, width: right - x, height: bottom - y };
}
