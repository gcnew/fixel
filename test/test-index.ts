
import {
    setup as setupEngine, setGameObject, listen, toggleRun,

    ctx, width, height
} from '../src/engine'

import {
    UI, drawUI, debugBoundingBox
} from '../src/ui'

let ui: UI[] = [];

// define a global function to be used by the tests
(window as any).setUI = (newUI: UI[]) => {
    ui = newUI;

    return new Promise((resolve) => {
        requestAnimationFrame(() => {
            draw();
            const dimensions = debugBoundingBox(ui);
            resolve(dimensions);
        });
    });
};

function draw() {
    // clear the screen
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    drawUI(ui);
}

function setup() {
    // stop engine rendering
    toggleRun();

    listen('resize', () => {
        ctx.imageSmoothingEnabled = false;
        draw();
    });
}

window.onload = function() {
    setupEngine();

    setGameObject({
        setup,
        draw,
        tearDown: () => {}
    });
};
