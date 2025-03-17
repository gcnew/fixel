
import * as Game from './editor'

import { Shortcut } from './keyboard'
import { setup, setGameObject, registerShortcuts, toggleDebug } from './engine'

let KbShortcuts: Shortcut[] = [
    [toggleDebug,  'D'],
];

window.onload = function() {
    setup();
    registerShortcuts(KbShortcuts);
    setGameObject(Game);
};
