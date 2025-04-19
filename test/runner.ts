
import puppeteer, { executablePath } from 'puppeteer-core';

import { UI } from '../src/ui'
import { allTests } from './cases/all-ui-tests'

declare function setUI(ui: UI[]): Promise<{ x: number, y: number, width: number, height: number }>;

async function main() {
    console.log('Executable path: ', executablePath('chrome'));

    // Launch the browser and open a new blank page
    const browser = await puppeteer.launch({
        // add this
        executablePath: executablePath('chrome'),
        dumpio: true
    });

    const page = await browser.newPage();

    page
        .on('console', message => console.log(`${message.type().substr(0, 3).toUpperCase()} ${message.text()}`))
        .on('pageerror', ({ message }) => console.log(message))
        .on('response', response => console.log(`${response.status()} ${response.url()}`))
        .on('requestfailed', request => console.log(`${request.failure()?.errorText} ${request.url()}`));

    // Set screen size.
    await page.setViewport({
        deviceScaleFactor: 2,
        width: 1728,
        height: 921
    });

    // Navigate the page to a URL.
    await page.goto('http://localhost:9090/test');

    for (const test of allTests) {
        const boundingBox = await page.evaluate((ui) => {
            return setUI(ui);
        }, test.ui);

        boundingBox.width += 5;
        boundingBox.height += 5;

        console.log('Bounding box: %o', boundingBox);
        await page.screenshot({
            clip: boundingBox,
            path: `./test-results/${test.name}.png`,
        });
    }

    console.log('Exiting');
    await browser.close();
}

main().catch(
    (e) => setTimeout(() => { throw e; }, 0)
);
