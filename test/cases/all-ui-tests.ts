
import { UI } from '../../src/ui'

import * as ct from './container'

export type UITest = {
    name: string,
    ui: UI[]
}

export const allTests: UITest[] = [
    ct.basicTest
];
