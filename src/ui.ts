
import {
    ctx,
    mouseX, mouseY, clickX, clickY
} from './engine'

import { compileStyle } from './mini-css'

import { clamp, assertNever } from './util'


export type UI = Button<any>
               | AutoContainer
               | UIText

export type ImageSlice = { kind: 'image', src: string, dx: number, dy: number, w: number, h: number }
export type TextProps  = { kind: 'text', text: string }

export type Button<T> = {
    kind: 'button',
    id: string,
    data: T,
    style: string | UIStyle | undefined,
    inner: ImageSlice | TextProps,
    onClick: (o: Button<T>) => void,
}

export type AutoContainer = {
    kind: 'auto-container',
    id: string,
    mode: 'column' | 'row',
    children: UI[],
    style: string | UIStyle | undefined,
}

export type UIText = {
    kind: 'text',
    id: string,
    text: string,
    style: string | UIStyle | undefined,
}

export type UIStyle = {
    x?: number,
    y?: number,

    w?: number,
    h?: number,

    maxWidth?: number | undefined,
    maxHeight?: number | undefined,

    color?: string,
    font?: string,
    textAlign?: 'left' | 'right' | 'center',
    borderW?: number | string,
    borderColor?: string,

    gap?: number,
    scroll?: 'x' | 'y' | undefined,
}

type LayoutData = {
    style: UIStyle,

    x: number,
    y: number,

    w: number,
    h: number,

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
    textAlign: 'left' | 'right' | 'center',
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

const defaultStyle: Required<UIStyle> = {
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    maxWidth: undefined,
    maxHeight: undefined,
    color: 'aqua',
    font: '12px monospace',
    textAlign: 'left',
    borderW: 0,
    borderColor: 'aqua',
    gap: 0,
    scroll: undefined,
};

const styles: ReturnType<typeof compileStyle<UIStyle>> = {};
const layoutDataCache: { [id: string]: { style: UI['style'], layout: LayoutData } } = {};
const loadedAtlases: { [k: string]: HTMLImageElement } = {};

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

function drawUI(ui: UI[]) {
    for (const o of ui) {
        switch (o.kind) {
            case 'text': drawText(o); break;
            case 'button': drawButton(o); break;
            case 'auto-container': drawAutoContainer(o); break;

            default: assertNever(o);
        }
    }
}

function calcBoxes(ui: UI[]) {
    for (const o of ui) {
        switch (o.kind) {
            case 'button':         break;
            case 'text':           calcBoxText(o); break;
            case 'auto-container': calcBoxAutoContainer(o); break;

            default: assertNever(o);
        }
    }
}

function layout(ui: UI[]) {
    for (const o of ui) {
        switch (o.kind) {
            case 'button':
            case 'text':           break;
            case 'auto-container': layoutAutoContainer(o); break;

            default: assertNever(o);
        }
    }
}

function calcBoxText(o: UIText) {
    const ld = getOrCreateLayout(o);

    ctx.font = ld.font;
    const dims = ctx.measureText(o.text);

    if (ld.style.w === undefined) {
        ld.w = dims.width;
    }
    if (ld.style.h === undefined) {
        ld.h = dims.actualBoundingBoxDescent;
    }

    if (!displayBoundingBoxes) {
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 1;
        ctx.strokeRect(ld.x, ld.y, ld.w, ld.h);
    }
}

function calcBoxAutoContainer(o: AutoContainer) {
    const ld = getOrCreateLayout(o);

    // first, layout its children to obtain accurate (w,h)
    calcBoxes(o.children);

    ld.scrollHeight = o.mode === 'row'
        ? o.children.reduce((acc, x) => Math.max(acc, getOrCreateLayout(x).h), 0)
        : o.children.reduce((acc, x) => acc + getOrCreateLayout(x).h + ld.gap, 0) + (o.children.length > 0 ? -ld.gap : 0);
    ld.scrollWidth = o.mode === 'row'
        ? o.children.reduce((acc, x) => acc + getOrCreateLayout(x).w + ld.gap, 0) + (o.children.length > 0 ? -ld.gap : 0)
        : o.children.reduce((acc, x) => Math.max(acc, getOrCreateLayout(x).w), 0);

    ld.scrollX = clamp(ld.scrollX, Math.min(ld.w, ld.scrollWidth) - ld.scrollWidth, 0);
    ld.scrollY = clamp(ld.scrollY, Math.min(ld.h, ld.scrollHeight) - ld.scrollHeight, 0);

    if (!ld.style.h) {
        ld.h = ld.scrollHeight;
    }

    if (!ld.style.w) {
        ld.w = ld.scrollWidth;
    }

    const maxHeight = ld.style?.maxHeight;
    if (maxHeight) {
        ld.h = Math.min(maxHeight, ld.scrollHeight);
    }

    const maxWidth = ld.style?.maxWidth;
    if (maxWidth) {
        ld.w = Math.min(maxWidth, ld.scrollWidth);
    }
}

function layoutAutoContainer(o: AutoContainer) {
    const ld = getOrCreateLayout(o);

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

    layout(o.children);
}

function drawText(o: UIText) {
    const ld = getOrCreateLayout(o);
    ctx.textBaseline = 'top';

    ctx.fillStyle = ld.color;
    ctx.font = ld.font;

    ctx.fillText(o.text, ld.x, ld.y);

    if (displayBoundingBoxes) {
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 1;
        ctx.strokeRect(ld.x, ld.y, ld.w, ld.h);
    }
}

function drawButton(o: Button<unknown>) {
    const ld = getOrCreateLayout(o);

    if (o.inner.kind === 'text') {
        ctx.fillStyle = ld.color;
        ctx.font = ld.font;

        const dims = ctx.measureText(o.inner.text);
        const ch = (ld.h - dims.actualBoundingBoxDescent) / 2 | 0;

        let wOffset;
        switch (ld.textAlign) {
            case 'left': {
                wOffset = 5;
                break;
            }
            case 'right': {
                wOffset = Math.max(ld.w - dims.width - 4 | 0, 5);
                break;
            }
            case 'center': {
                wOffset = (ld.w - dims.width) / 2 | 0;
                break;
            }
        }

        ctx.fillText(o.inner.text, ld.x + wOffset, ld.y + ch, ld.w - 9);

        if (displayBoundingBoxes) {
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 1;
            ctx.strokeRect(ld.x + ld.w - dims.width - 4, ld.y, dims.width, dims.fontBoundingBoxDescent);
        }
    }

    if (o.inner.kind === 'image') {
        const atlas = loadedAtlases[o.inner.src];

        if (atlas) {
            ctx.drawImage(atlas, o.inner.dx, o.inner.dy, o.inner.w, o.inner.h, ld.x, ld.y, ld.w, ld.h);
        }
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
                parsed = [parsed[0]!, parsed[1]!, parsed[0]!, parsed[1]!];
            }

            drawLine(ld.x, ld.y, ld.w, 0, strokeStyle, parsed[0]!);
            drawLine(ld.x + ld.w, ld.y, 0, ld.h, strokeStyle, parsed[1]!);
            drawLine(ld.x, ld.y + ld.h, ld.w, 0, strokeStyle, parsed[2]!);
            drawLine(ld.x, ld.y, 0, ld.h, strokeStyle, parsed[3]!);
            return;
        }

        default: assertNever(borderW);
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

function drawAutoContainer(o: AutoContainer) {
    const ld = getOrCreateLayout(o);

    const clip = !!ld.scroll || ld.scrollHeight > ld.h || ld.scrollWidth > ld.w;
    if (clip) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(ld.x - 0.5, ld.y - 0.5, ld.w + 0.5, ld.h + 0.5);
        ctx.clip();
    }

    drawUI(o.children);
    if (clip) {
        ctx.restore();
    }

    drawBorder(ld);

    if (displayBoundingBoxes) {
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 1;
        ctx.strokeRect(ld.x, ld.y, ld.w, ld.h);
    }
}

function getOrCreateLayout(o: UI): LayoutData {
    const existing = layoutDataCache[o.id];
    if (existing && existing.style === o.style) {
        return existing.layout;
    }

    const style = typeof o.style === 'string'
        ? styles[o.style]
        : o.style;

    const ld = createLayoutData(style);
    layoutDataCache[o.id] = { style: o.style, layout: ld };

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
        scrollHeight: 0,
        scrollWidth: 0,

        // Accessors
        get maxWidth()    { return style?.maxWidth    || defaultStyle.maxWidth;    },
        get maxHeight()   { return style?.maxHeight   || defaultStyle.maxHeight;   },
        get color()       { return style?.color       || defaultStyle.color;       },
        get font()        { return style?.font        || defaultStyle.font;        },
        get textAlign()   { return style?.textAlign   || defaultStyle.textAlign;   },
        get borderW()     { return style?.borderW     || defaultStyle.borderW;     },
        get borderColor() { return style?.borderColor || defaultStyle.borderColor; },
        get gap()         { return style?.gap         || defaultStyle.gap;         },
    };

    return res;
}

export function handleClickUI(ui: UI[]): boolean {
    for (const o of ui) {
        switch (o.kind) {
            case 'text':
                break;

            case 'auto-container': {
                if (!isClickInside(o)) {
                    break;
                }

                if (handleClickUI(o.children)) {
                    return true;
                }

                break;
            }

            case 'button': {
                if (isClickInside(o)) {
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

function isClickInside(o: UI) {
    const ld = getOrCreateLayout(o);

    // for a click to be valid, both the initial touch down and the current position need
    // to be inside the element
    return clickX! >= ld.x && clickX! <= ld.x + ld.w
        && clickY! >= ld.y && clickY! <= ld.y + ld.h
        && mouseX >= ld.x && mouseX <= ld.x + ld.w
        && mouseY >= ld.y && mouseY <= ld.y + ld.h;
}

function isScrollInside(o: UI, isWheel: boolean) {
    const ld = getOrCreateLayout(o);

    if (isWheel) {
        return mouseX >= ld.x && mouseX <= ld.x + ld.w
            && mouseY >= ld.y && mouseY <= ld.y + ld.h;
    }

    // touch devices: scroll should work for the element where the tap was initiated
    // even if the current position of the pointer is outside the scrolled element
    return clickX! >= ld.x && clickX! <= ld.x + ld.w
        && clickY! >= ld.y && clickY! <= ld.y + ld.h;
}

export function handleScrollUI(ui: UI[], deltaX: number, deltaY: number, isWheel: boolean): boolean {
    for (const o of ui) {
        switch (o.kind) {
            case 'text':
            case 'button':
                break;

            case 'auto-container': {
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
