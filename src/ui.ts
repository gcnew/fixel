
import {
    ctx,
    mouseX, mouseY, pressedKeys
} from './engine'

import { compileStyle } from './mini-css'

import { clamp } from './util'


export type UI<T> = Button<T>
                  | AutoContainer<T>
                  | OldButton<T>

export type ImageSlice = { kind: 'image', src: string, dx: number, dy: number, w: number, h: number }
export type TextProps  = { kind: 'text', text: string, font: string, color: string }

export type Button<T> = {
    kind: 'button',
    id: string,
    data: T,
    style: string | undefined,
    inner: ImageSlice
        | { kind: 'text', text: string, font?: string, color?: string },
    onClick: (o: Button<T>) => void,
}

export type AutoContainer<T> = {
    kind: 'auto-container',
    id: string,
    mode: 'column' | 'row',
    children: Exclude<UI<T>, { kind: 'old-button' }>[],
    style: string | undefined,
}

export type OldButton<T> = {
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

export type UIStyle = {
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

const styles: ReturnType<typeof compileStyle<UIStyle>> = {};
const layoutDataCache: { [id: string]: LayoutData } = {};
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

export function handleClickUI(ui: UI<unknown>[]): boolean {
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

export function handleScrollUI(ui: UI<unknown>[], deltaX: number, deltaY: number): boolean {
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
                if (handleScrollUI(o.children, deltaX, deltaY)) {
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
