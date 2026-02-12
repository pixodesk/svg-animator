/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAnimator } from "./index";
import type { PxAnimatedSvgDocument } from "./PxAnimatorTypes";


describe("animateBackground", () => {
    beforeEach(() => {
        document.body.innerHTML = '<svg id="aaa"></svg>';
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("createAnimator", async () => {
        createAnimator(getTestJson(), undefined, '#aaa');

        const ellipse = document.querySelector("ellipse");
        expect(ellipse).not.toBeNull();
        expect(ellipse?.getAttribute("transform")).toMatch("translate(200,100)");

        // Trigger frame halfway through animation
        vi.advanceTimersByTime(64);
        expect(ellipse?.getAttribute("transform")).toMatch("translate(200,150)");

        // Trigger frame end of animation
        vi.advanceTimersByTime(64);
        expect(ellipse?.getAttribute("transform")).toMatch("translate(200,200)");
    });
});


////////////////////////////////////////////////////////////////

function getTestJson(): PxAnimatedSvgDocument {
    return {
        type: "svg",
        "data-px-id": "_px_2p4d44pl",
        fill: "none",
        id: "_px_2p4d44pl",
        className: "px-anim-enabled px-anim-playing",
        viewBox: "0 0 400 400",

        animator: {
            mode: "frames",
            duration: 128,
            fill: "forwards",
            direction: "normal",
            trigger: { startOn: "load" }
        },

        bindings: [
            {
                id: '_px_2pp00tnc',
                animate: {
                    translate: {
                        keyframes: [
                            { time: 0, value: [200, 100], easing: [0.167, 0.167, 0.833, 0.833] },
                            { time: 128, value: [200, 200] }
                        ]
                    }
                }
            }
        ],

        children: [
            {
                type: "ellipse",
                className: "px-anim-element _px_2pp00tne",
                fill: "#0087ff",
                stroke: "#ffffff",
                transform: "translate(200,100)",
                "data-px-id": "_px_2pp00tnc",
                rx: "50",
                ry: "50"
            }
        ]
    };
}
