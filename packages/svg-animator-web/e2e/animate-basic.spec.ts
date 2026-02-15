import { expect, Page, test } from "@playwright/test";
import _animationJson from "./bouncing-ball-svga.json" with { type: "json" };
import { PxAnimatedSvgDocument, isPxElementFileFormat } from "../src/index";


const animationJson: PxAnimatedSvgDocument = _animationJson;

if (!isPxElementFileFormat(_animationJson)) {
    throw new Error("Animation does not match PxAnimatedSvgDocument format");
}


const START_TIME = 100000000;

async function sleep(t: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, t));
}

async function advanceTimeIncrementally(
    page: Page,
    fromTime: number,
    toTime: number,
    stepSize: number = 100,
    pauseBetweenSteps: number = 10
) {
    for (let time = fromTime; time <= toTime; time += stepSize) {
        await page.clock.setFixedTime(time);
        await sleep(stepSize);
        await page.waitForTimeout(pauseBetweenSteps);
    }
}

test.describe("animate-basic", () => {

    test.beforeEach(async ({ page }) => {

        // Log browser console to terminal
        page.on('console', msg => console.log('BROWSER:', msg.text()));

        // Install fake timers before navigating
        await page.clock.install({ time: START_TIME });
        await page.clock.setFixedTime(START_TIME);

        // Intercept animation.json requests before navigating
        await page.route('**/animation.json', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(animationJson),
            });
        });

        await page.goto("/animate-basic.html");
    });

    test("animation changes over time", async ({ page }) => {

        const svg = page.locator("svg").first();

        await expect(svg).toHaveScreenshot("animation-start.png");

        await advanceTimeIncrementally(page, START_TIME + 0, START_TIME + 500);

        await expect(svg).toHaveScreenshot("animation-middle.png");

        await advanceTimeIncrementally(page, START_TIME + 500, START_TIME + 1000);

        await expect(svg).toHaveScreenshot("animation-end.png");
    });
});
