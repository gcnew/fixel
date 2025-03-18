
import {
    ctx,
    mouseX, mouseY, clickX, clickY
} from './engine'

import { compileStyle } from './mini-css'

import { clamp } from './util'


export type UI<T> = Button<T>
                  | AutoContainer<T>

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

export type AutoContainer<T> = {
    kind: 'auto-container',
    id: string,
    mode: 'column' | 'row',
    children: Exclude<UI<T>, { kind: 'old-button' }>[],
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

    // Accessors
    maxWidth: number | undefined,
    maxHeight: number | undefined,

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

const defaultStyle: Required<UIStyle> = {
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    maxWidth: undefined,
    maxHeight: undefined,
    color: 'aqua',
    font: '12px monospace',
    borderW: 0,
    borderColor: 'aqua',
    gap: 0,
    scroll: undefined,
};

const styles: ReturnType<typeof compileStyle<UIStyle>> = {};
const layoutDataCache: { [id: string]: { style: UI<unknown>['style'], layout: LayoutData } } = {};
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

export function drawUI(ui: UI<unknown>[]) {
    for (const o of ui) {
        switch (o.kind) {
            case 'button': drawButton(o); break;
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

function drawAutoContainer(o: AutoContainer<unknown>) {
    const ld = getOrCreateLayout(o);

    const totalHeight = o.mode === 'row'
        ? o.children.reduce((acc, x) => Math.max(acc, getOrCreateLayout(x).h), 0)
        : o.children.reduce((acc, x) => acc + getOrCreateLayout(x).h + ld.gap, -ld.gap);
    const totalWidth = o.mode === 'row'
        ? o.children.reduce((acc, x) => acc + getOrCreateLayout(x).w + ld.gap, -ld.gap)
        : o.children.reduce((acc, x) => Math.max(acc, getOrCreateLayout(x).w), 0);

    if (!ld.style.h) {
        ld.h = totalHeight;
    }

    if (!ld.style.w) {
        ld.w = totalWidth;
    }

    const maxHeight = ld.style?.maxHeight;
    if (maxHeight) {
        ld.h = Math.min(maxHeight, totalHeight);
    }

    const maxWidth = ld.style?.maxWidth;
    if (maxWidth) {
        ld.w = Math.min(maxWidth, totalWidth);
    }

    const clip = !!ld.scroll || totalHeight > ld.h || totalWidth > ld.w;
    if (clip) {
        ld.scrollX = clamp(ld.scrollX, Math.min(ld.w, totalWidth) - totalWidth, 0);
        ld.scrollY = clamp(ld.scrollY, Math.min(ld.h, totalHeight) - totalHeight, 0);

        ctx.save();
        ctx.beginPath();
        ctx.rect(ld.x - 0.5, ld.y - 0.5, ld.w + 0.5, ld.h + 0.5);
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
    if (clip) {
        ctx.restore();
    }
    drawBorder(ld);

    if (displayBoundingBoxes) {
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 1;
        ctx.strokeRect(ld.x - 1, ld.y -1, ld.w + 1, ld.h + 1);
    }
}

function getOrCreateLayout(o: Button<unknown> | AutoContainer<unknown>): LayoutData {
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

        // Accessors
        get maxWidth()    { return style?.maxWidth    || defaultStyle.maxWidth;    },
        get maxHeight()   { return style?.maxHeight   || defaultStyle.maxHeight;   },
        get color()       { return style?.color       || defaultStyle.color;       },
        get font()        { return style?.font        || defaultStyle.font;        },
        get borderW()     { return style?.borderW     || defaultStyle.borderW;     },
        get borderColor() { return style?.borderColor || defaultStyle.borderColor; },
        get gap()         { return style?.gap         || defaultStyle.gap;         },
    };

    return res;
}

export function handleClickUI(ui: UI<unknown>[]): boolean {
    for (const o of ui) {
        switch (o.kind) {
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
        }
    }

    return false;
}

function isClickInside(o: UI<unknown>) {
    const ld = getOrCreateLayout(o);

    return clickX! >= ld.x && clickX! <= ld.x + ld.w
        && clickY! >= ld.y && clickY! <= ld.y + ld.h
        && mouseX >= ld.x && mouseX <= ld.x + ld.w
        && mouseY >= ld.y && mouseY <= ld.y + ld.h;
}

export function handleScrollUI(ui: UI<unknown>[], deltaX: number, deltaY: number): boolean {
    for (const o of ui) {
        switch (o.kind) {
            case 'button':
                break;

            case 'auto-container': {
                const ld = getOrCreateLayout(o);

                if (!(clickX! >= ld.x && clickX! <= ld.x + ld.w
                    && clickY! >= ld.y && clickY! <= ld.y + ld.h)) {
                    break;
                }

                // first try children
                if (handleScrollUI(o.children, deltaX, deltaY)) {
                    return true;
                }

                if (!ld.scroll) {
                    break;
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
