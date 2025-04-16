
import {
    ctx,
    mouseX, mouseY, clickX, clickY
} from './engine'

import { compileStyle } from './mini-css'

import { uuid, clamp, assertNever } from './util'

export type UI = UIText
               | UIImage
               | UIButton
               | UIContainer

export type UIContainer = {
    kind: 'container',
    id?: string,
    style?: string | UIStyle,
    children: UI[],
}

export type UIText = {
    kind: 'text',
    id?: string,
    style?: string | UIStyle,
    text: string,
}

export type UIImage = {
    kind: 'image',
    id?: string,
    style?: string | UIStyle,
    src: string,
    x?: number,
    y?: number,
    width?: number,
    height?: number
}

export type UIStyle = {
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

    borderWidth?: number | string,
    borderColor?: string,

    backgroundColor?: string | undefined,
    display?: 'none' | 'hidden' | 'visible',

    margin?: number | string,
    padding?: number | string,

    gap?: number | string,
    layoutMode?: 'column' | 'row',
    scroll?: 'x' | 'y' | undefined,
}

export type ImageSlice = { kind: 'image', src: string, dx: number, dy: number, w: number, h: number }
export type TextProps  = { kind: 'text', text: string }

export { UIButton as Button }
export type UIButton = {
    kind: 'button',
    id?: string,
    style?: string | UIStyle,
    inner: ImageSlice | TextProps,
    onClick: (self: UIButton) => void,
}

type LayoutData = {
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


export const styles: ReturnType<typeof compileStyle<UIStyle>> = {};

const loadedAtlases: { [k: string]: HTMLImageElement } = {};

const idMap = new WeakMap<UI, string>();
const layoutCache = new Map<string, { style: UI['style'], layout: LayoutData }>();

let displayBoundingBoxes = false;

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
    const baseline = ctx.textBaseline;
    ctx.textBaseline = 'top';

    calcBoxes(ui);
    layout(ui);
    drawUI(ui);

    ctx.textBaseline = baseline;
}

function calcBoxes(ui: UI[]) {
    for (const o of ui) {
        const ld = getOrCreateLayout(o);
        if (ld.display === 'none') {
            continue;
        }

        switch (o.kind) {
            case 'text':      calcTextBox(o);      break;
            case 'image':     calcImageBox(o);     break;
            case 'button':    calcButtonBox(o);    break;
            case 'container': calcContainerBox(o); break;

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
            return cl.display === 'none' ? acc : Math.max(acc, cl.$h);
        }, 0)
        : o.children.reduce((acc, x) => {
            const cl = getOrCreateLayout(x);
            return cl.display === 'none' ? acc : acc + cl.$h + (acc ? ld.gap.row : 0);
        }, 0);

    ld.scrollWidth = ld.layoutMode === 'row'
        ? o.children.reduce((acc, x) => {
            const cl = getOrCreateLayout(x);
            return cl.display === 'none' ? acc : acc + cl.$w + (acc ? ld.gap.column : 0);
        }, 0)
        : o.children.reduce((acc, x) => {
            const cl = getOrCreateLayout(x);
            return cl.display === 'none' ? acc : Math.max(acc, cl.$w);
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
            case 'text':      break;
            case 'image':     break;
            case 'button':    break;
            case 'container': layoutContainer(o); break;

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
            case 'text':      drawText(o);      break;
            case 'image':     drawImage(o);     break;
            case 'button':    drawButton(o);    break;
            case 'container': drawContainer(o); break;

            default: assertNever(o);
        }
    }
}

function drawText(o: UIText) {
    const ld = getOrCreateLayout(o);

    ctx.fillStyle = ld.color;
    ctx.font = ld.font;
    ctx.fillText(o.text, ld.$x + ld.padding.left, ld.$y + ld.padding.top);

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

    const ld = createLayoutData(style);
    layoutCache.set(id, { style: o.style, layout: ld });

    return ld;
}

const zeroTRBL: TRBL = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
};

function createLayoutData(style: UIStyle | undefined): LayoutData {
    const res: LayoutData & {
        $$x: number | undefined,
        $$y: number | undefined,

        $borderWidth: { key: string | number, value: TRBL },
        $margin: { key: string | number, value: TRBL },
        $padding: { key: string | number, value: TRBL },
        $gap: { key: string | number, value: { row: number, column: number } }
    } = {
        $$x: undefined,
        $$y: undefined,

        style,

        get $x() { return this.$$x ?? style?.left ?? defaultStyle.left; },
        set $x(val: number) { this.$$x = val; },

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

function cacheTRBL(property: string, cache: { key: string | number, value: TRBL }, key: string|number): TRBL {
    if (cache.key === key) {
        return cache.value;
    }

    if (typeof key === 'number') {
        cache.key = key;
        cache.value = { top: key, right: key, bottom: key, left: key };

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

export function handleClickUI(ui: UI[]): boolean {
    for (const o of ui) {
        switch (o.kind) {
            case 'text':
            case 'image':
                break;

            case 'button': {
                if (isClickInside(o)) {
                    o.onClick(o);
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
