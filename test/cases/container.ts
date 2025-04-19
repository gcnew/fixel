
import type { UI, UIStyle } from '../../src/ui'
import type { UITest } from './all-ui-tests'

function box(style?: UIStyle): UI {
    return {
        kind: 'container',
        children: [],
        style: { width: 50, height: 50, borderWidth: 1, borderColor: 'floralwhite', ... style }
    };
}

export const basicTest: UITest = {
    name: 'basic-container',
    ui: [

        // (0,0) anchor
        {
            kind: 'container',
            children: [],
            style: { top: 0, left: 0, width: 1, height: 1, backgroundColor: 'white' },
        },

        // simple container
        {
            kind: 'container',
            children: [],
            style: { top: 10, left: 10, width: 75, height: 50, borderWidth: 1, borderColor: 'aqua', backgroundColor: 'orange' },
        },

        // rows
        {
            kind: 'container',
            children: [
                {
                    kind: 'container',
                    children: [
                        {
                            kind: 'container',
                            children: [
                                box(), box(), box()
                            ],
                            style: { gap: 5, layoutMode: 'column', borderWidth: 1, borderColor: 'floralwhite', padding: 2 }
                        },

                        {
                            kind: 'container',
                            children: [
                                box(), box({ margin: { left: 10 } }), box({ margin: { left: 20, top: 10 } })
                            ],
                            style: { gap: 5, layoutMode: 'column', borderWidth: 1, borderColor: 'floralwhite', padding: 2 }
                        },

                        {
                            kind: 'container',
                            children: [
                                box(), box(), box()
                            ],
                            style: { gap: 5, layoutMode: 'column', borderWidth: 1, borderColor: 'floralwhite', padding: 2, margin: { left: 10, top: 10 } }
                        },

                    ],
                    style: { gap: 5, layoutMode: 'row', borderWidth: 1, borderColor: 'floralwhite', padding: 2 }
                },

                // container with text, margins, padding, etc
                {
                    kind: 'container',
                    children: [
                        {
                            kind: 'container',
                            children: [
                                {
                                    kind: 'text',
                                    text: 'w: 50, h: 50, bgc: darkgreen',
                                    style: { margin: { left: 10, top: 5, right: 15, bottom: 20 } }
                                },
                                {
                                    kind: 'text',
                                    text: 'bottom of the pit',
                                    style: { margin: { left: 10, top: 15, bottom: 5 }, padding: 5, backgroundColor: 'floralwhite', color: 'darkred' }
                                }
                            ],
                            style: { backgroundColor: 'darkgreen' },
                        },

                        {
                            kind: 'container',
                            children: [],
                            style: { width: 50, height: 50, backgroundColor: 'darkgreen', margin: { top: 10, left: 5 } },
                        }
                    ],
                    style: { borderWidth: 1, borderColor: 'aqua', backgroundColor: 'orange', padding: 10 },
                },

                box({ borderWidth: { top: 5, right: 10, bottom: 15, left: 20 }, borderColor: 'floralwhite' }),
            ],
            style: { top: 70, left: 10, gap: 10 },
        },
    ]
}
