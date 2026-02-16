import { expect, Page, test } from "@playwright/test";
import { isPxElementFileFormat, PxAnimatedSvgDocument } from "../src/index";
import _bouncingBallJson from "./bouncing-ball-svga.json" with { type: "json" };
import _animatedAttributeJson from "./03-animated-attribute.json" with { type: "json" };


if (!isPxElementFileFormat(_bouncingBallJson)) {
    throw new Error("Animation does not match PxAnimatedSvgDocument format");
}
const bouncingBallJson: PxAnimatedSvgDocument = _bouncingBallJson;

if (!isPxElementFileFormat(_animatedAttributeJson)) {
    throw new Error("Animation does not match PxAnimatedSvgDocument format");
}
const animatedAttributeJson: PxAnimatedSvgDocument = _animatedAttributeJson;


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
    });

    function testAnimation(name: string, animationJson: PxAnimatedSvgDocument) {
        test(name, async ({ page }) => {

            // Intercept animation.json requests before navigating
            await page.route('**/animation.json', async route => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(animationJson),
                });
            });

            await page.goto("/animate-basic.html");

            ////////////////////////////////////////////////////////////////

            const svg = page.locator("svg").first();

            await expect(svg).toHaveScreenshot(name + "-start.png");

            await advanceTimeIncrementally(page, START_TIME + 0, START_TIME + 500);

            await expect(svg).toHaveScreenshot(name + "-middle.png");

            await advanceTimeIncrementally(page, START_TIME + 500, START_TIME + 1000);

            await expect(svg).toHaveScreenshot(name + "-end.png");
        });
    }

    testAnimation('Bouncing ball', bouncingBallJson);
    testAnimation('Animated attribute', animatedAttributeJson);
});
