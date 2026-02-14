import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import PixodeskSvgAnimator from './PixodeskSvgAnimator
import { PxAnimatedSvgDocument } from '@pixodesk/svg-animator-web';


describe("ReactAnimator", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    it("renders and animates", async () => {
        render(<PixodeskSvgAnimator doc={getTestJson()} />);

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
        "type": "svg", "version": "1.0",
        "player": {
            "jsMode": "frames",
            "timing": {
                "duration": 128, "fill": "forwards", "direction": "normal"
            },
            "definitions": {
                "attributes": [
                    {
                        "n": "translate",
                        "kfs": [
                            { "t": 0, "v": [200, 100], "e": [0.167, 0.167, 0.833, 0.833] },
                            { "t": 1, "v": [200, 200] }
                        ]
                    }
                ],
                "bindings": [{ "id": "_px_2pp00tnc", "attributes": [0] }]
            },
            "content": {
                "type": "svg", "data-px-id": "_px_2p4d44pl", "fill": "none",
                "id": "_px_2p4d44pl", "className": "px-anim-enabled px-anim-playing", "viewBox": "0 0 400 400",
                "children": [
                    {
                        "type": "ellipse", "className": "px-anim-element  _px_2pp00tne", "fill": "#0087ff", "stroke": "#ffffff",
                        "transform": "translate(200,100)", "data-px-id": "_px_2pp00tnc", "rx": "50", "ry": "50"
                    }
                ]
            },
            "triggers": { "startOn": "load" }, "debug": true, "rootPxId": "_px_2p4d44pl"
        }
    };
}
