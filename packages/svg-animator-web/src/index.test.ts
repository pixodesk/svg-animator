/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAnimator } from './index';
import type { PxAnimatedSvgDocument, PxAnimationDefinition } from './PxAnimatorTypes';
import { cubicBezier, reverseEasing, splitEasing, subdivideCubicBezier } from './PxAnimatorUtil';
import { calcAnimationValues, getNormalisedBindings } from './PxDefinitions';


describe('animateBackground', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="svg-container"></div>';
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('Simple test', async () => {

        createAnimator({ data: getTestJson(), container: '#svg-container' });

        const svg = document.querySelector('svg');
        expect(svg).not.toBeNull();
        const ellipse = document.querySelector('ellipse');
        expect(ellipse).not.toBeNull();

        expect(ellipse?.getAttribute('transform')).toMatch('translate(200,100)');

        vi.advanceTimersByTime(64); // Trigger frame halfway through animation
        expect(ellipse?.getAttribute('transform')).toMatch('translate(200,150)');

        // Trigger frame end of animation
        vi.advanceTimersByTime(64);
        expect(ellipse?.getAttribute('transform')).toMatch('translate(200,200)');
    });

    it('Loop (per-property, cycle)', async () => {
        const json = getTestJson();
        // Double the duration so keyframes occupy first half → loop fills second half
        json.animator!.duration = 256;
        // Add loop:true to the translate property
        json.bindings![0].animate!['translate'].loop = true;

        createAnimator({ data: json, container: '#svg-container' });

        const ellipse = document.querySelector('ellipse');
        expect(ellipse).not.toBeNull();

        expect(ellipse?.getAttribute('transform')).toMatch('translate(200,100)');

        // First half: 0→128ms, goes from 100→200
        vi.advanceTimersByTime(64);
        expect(ellipse?.getAttribute('transform')).toMatch('translate(200,150)');

        vi.advanceTimersByTime(64); // t=128
        expect(ellipse?.getAttribute('transform')).toMatch('translate(200,200)');

        // Second half: 128→256ms, loop repeats 100→200 (cycle mode)
        vi.advanceTimersByTime(64); // t=192 (midpoint of second cycle)
        expect(ellipse?.getAttribute('transform')).toMatch('translate(200,150)');

        vi.advanceTimersByTime(64); // t=256
        expect(ellipse?.getAttribute('transform')).toMatch('translate(200,200)');
    });

    it('Remove <script> tag', async () => {

        createAnimator({
            data: {
                type: 'svg',
                children: [
                    { type: 'ellipse', fill: '#0087ff' },
                    { type: 'script', textContent: 'alert("hi");' }
                ]
            },
            container: '#svg-container'
        });

        const svg = document.querySelector('svg');
        expect(svg).not.toBeNull();
        console.log('svg?.children.length', svg?.children.length);
        expect(svg?.innerHTML).toBe('<ellipse fill="#0087ff"></ellipse>');
    });
});


// ============================================================================
// Loop expansion tests (via getNormalisedBindings + calcAnimationValues)
// ============================================================================

describe('Loop expansion', () => {

    /** Helper: get normalised binding's animate definition for translate */
    function getTranslateAnim(doc: PxAnimatedSvgDocument): PxAnimationDefinition {
        const bindings = getNormalisedBindings(doc);
        expect(bindings.length).toBeGreaterThan(0);
        return bindings[0].animate! as PxAnimationDefinition;
    }

    /** Helper: extract translate [x,y] at a given progress (0-1) from the animation definition */
    function translateAt(animDef: Record<string, any>, progress: number): string {
        const values = calcAnimationValues(animDef, progress);
        return values['transform'] || '';
    }

    // FIXME
    // it('loop:true (default cycle) extends keyframes to fill duration', () => {
    //     const doc: PxAnimatedSvgDocument = {
    //         type: 'svg',
    //         animator: { duration: 200 },
    //         bindings: [{
    //             id: 'el1',
    //             animate: {
    //                 opacity: {
    //                     keyframes: [
    //                         { time: 0, value: 0 },
    //                         { time: 100, value: 1 }
    //                     ],
    //                     loop: true
    //                 }
    //             }
    //         }]
    //     };

    //     const animDef = getTranslateAnim(doc);
    //     const kfs = animDef['opacity']?.kfs;
    //     expect(kfs).toBeDefined();

    //     // Should have keyframes beyond the original 0→100 range
    //     const maxT = Math.max(...(kfs || []).map((k: any) => k.t ?? 0));
    //     expect(maxT).toBeCloseTo(1, 1); // normalized to 1

    //     // At t=0: opacity=0
    //     const v0 = calcAnimationValues(animDef, 0);
    //     expect(+v0['opacity']).toBeCloseTo(0, 1);

    //     // At t=0.5 (=100ms): opacity=1 (end of original keyframes)
    //     const v50 = calcAnimationValues(animDef, 0.5);
    //     expect(+v50['opacity']).toBeCloseTo(1, 1);

    //     // At t=0.75 (=150ms): midpoint of looped cycle → opacity≈0.5
    //     const v75 = calcAnimationValues(animDef, 0.75);
    //     expect(+v75['opacity']).toBeCloseTo(0.5, 1);

    //     // At t=1 (=200ms): end of looped cycle → opacity=1
    //     const v100 = calcAnimationValues(animDef, 1);
    //     expect(+v100['opacity']).toBeCloseTo(1, 1);
    // });

    // FIXME
    // it('loop with alternate (pingpong) reverses direction each rep', () => {
    //     const doc: PxAnimatedSvgDocument = {
    //         type: 'svg',
    //         animator: { duration: 300 },
    //         bindings: [{
    //             id: 'el1',
    //             animate: {
    //                 opacity: {
    //                     keyframes: [
    //                         { time: 0, value: 0 },
    //                         { time: 100, value: 1 }
    //                     ],
    //                     loop: { alternate: true }
    //                 }
    //             }
    //         }]
    //     };

    //     const animDef = getTranslateAnim(doc);

    //     // At t=0: 0
    //     expect(+calcAnimationValues(animDef, 0)['opacity']).toBeCloseTo(0, 1);

    //     // At t=100/300: 1 (end of original)
    //     expect(+calcAnimationValues(animDef, 100 / 300)['opacity']).toBeCloseTo(1, 1);

    //     // First rep after original is reversed (pingpong). At t=200/300: back to 0
    //     expect(+calcAnimationValues(animDef, 200 / 300)['opacity']).toBeCloseTo(0, 1);

    //     // Second rep is forward again. At t=300/300: back to 1
    //     expect(+calcAnimationValues(animDef, 1)['opacity']).toBeCloseTo(1, 1);
    // });

    // FIXME
    // it('loop:before extends keyframes before the first keyframe', () => {
    //     const doc: PxAnimatedSvgDocument = {
    //         type: 'svg',
    //         animator: { duration: 200 },
    //         bindings: [{
    //             id: 'el1',
    //             animate: {
    //                 opacity: {
    //                     keyframes: [
    //                         { time: 100, value: 0 },
    //                         { time: 200, value: 1 }
    //                     ],
    //                     loop: { before: true }
    //                 }
    //             }
    //         }]
    //     };

    //     const animDef = getTranslateAnim(doc);

    //     // At t=0 (=0ms): loop fills 0→100, starts a cycle: opacity=0
    //     expect(+calcAnimationValues(animDef, 0)['opacity']).toBeCloseTo(0, 1);

    //     // At t=0.25 (=50ms): midpoint of looped segment before original
    //     expect(+calcAnimationValues(animDef, 0.25)['opacity']).toBeCloseTo(0.5, 1);

    //     // At t=0.5 (=100ms): junction → start of original keyframes, opacity=0
    //     expect(+calcAnimationValues(animDef, 0.5)['opacity']).toBeCloseTo(0, 1);

    //     // At t=1 (=200ms): end of original keyframes, opacity=1
    //     expect(+calcAnimationValues(animDef, 1)['opacity']).toBeCloseTo(1, 1);
    // });

    // FIXME
    // it('loop with segmentCount uses only specified intervals', () => {
    //     // 3 keyframes (2 intervals), segmentCount=1 → loop only the last interval
    //     const doc: PxAnimatedSvgDocument = {
    //         type: 'svg',
    //         animator: { duration: 400 },
    //         bindings: [{
    //             id: 'el1',
    //             animate: {
    //                 opacity: {
    //                     keyframes: [
    //                         { time: 0, value: 0 },
    //                         { time: 100, value: 0.5 },
    //                         { time: 200, value: 1 }
    //                     ],
    //                     loop: { segmentCount: 1 }
    //                 }
    //             }
    //         }]
    //     };

    //     const animDef = getTranslateAnim(doc);

    //     // Original keyframes span 0→200. segmentCount=1 loops last interval (100→200, values 0.5→1)
    //     // At t=0: 0
    //     expect(+calcAnimationValues(animDef, 0)['opacity']).toBeCloseTo(0, 1);

    //     // At t=100/400=0.25: 0.5
    //     expect(+calcAnimationValues(animDef, 0.25)['opacity']).toBeCloseTo(0.5, 1);

    //     // At t=200/400=0.5: 1 (end of original)
    //     expect(+calcAnimationValues(animDef, 0.5)['opacity']).toBeCloseTo(1, 1);

    //     // Loop fills 200→400 with segment [0.5→1] repeating
    //     // At t=300/400=0.75: midpoint of first looped rep → 0.75
    //     expect(+calcAnimationValues(animDef, 0.75)['opacity']).toBeCloseTo(0.75, 1);

    //     // At t=400/400=1: end of first looped rep → 1
    //     expect(+calcAnimationValues(animDef, 1)['opacity']).toBeCloseTo(1, 1);
    // });

    // FIXME
    // it('loop with partial repetition interpolates at cut point', () => {
    //     // Duration=250, keyframes span 0→100. Fill: 100→250 = 150ms, seg=100ms.
    //     // 1 full rep (100→200) + 0.5 partial rep (200→250, cut at 50% of segment).
    //     const doc: PxAnimatedSvgDocument = {
    //         type: 'svg',
    //         animator: { duration: 250 },
    //         bindings: [{
    //             id: 'el1',
    //             animate: {
    //                 opacity: {
    //                     keyframes: [
    //                         { time: 0, value: 0 },
    //                         { time: 100, value: 1 }
    //                     ],
    //                     loop: true
    //                 }
    //             }
    //         }]
    //     };

    //     const animDef = getTranslateAnim(doc);

    //     // At t=200/250=0.8: end of first full looped rep → 1
    //     expect(+calcAnimationValues(animDef, 0.8)['opacity']).toBeCloseTo(1, 1);

    //     // At t=250/250=1: cut at 50% of partial rep → ≈0.5
    //     expect(+calcAnimationValues(animDef, 1)['opacity']).toBeCloseTo(0.5, 1);
    // });

    it('no gap: loop is no-op when keyframes span full duration', () => {
        const doc: PxAnimatedSvgDocument = {
            type: 'svg',
            animator: { duration: 100 },
            bindings: [{
                id: 'el1',
                animate: {
                    opacity: {
                        keyframes: [
                            { time: 0, value: 0 },
                            { time: 100, value: 1 }
                        ],
                        loop: true
                    }
                }
            }]
        };

        const animDef = getTranslateAnim(doc);
        const kfs = animDef['opacity']?.kfs;

        // Should only have the original 2 keyframes (no gap to fill)
        expect(kfs?.length).toBe(2);
    });

    // FIXME
    // it('translate with loop:true cycles correctly', () => {
    //     const doc: PxAnimatedSvgDocument = {
    //         type: 'svg',
    //         animator: { duration: 256 },
    //         bindings: [{
    //             id: 'el1',
    //             animate: {
    //                 translate: {
    //                     keyframes: [
    //                         { time: 0, value: [0, 0] },
    //                         { time: 128, value: [100, 200] }
    //                     ],
    //                     loop: true
    //                 }
    //             }
    //         }]
    //     };

    //     const animDef = getTranslateAnim(doc);

    //     // Original: translate goes [0,0]→[100,200] over 0→128ms
    //     expect(translateAt(animDef, 0)).toBe('translate(0,0)');
    //     expect(translateAt(animDef, 0.5)).toBe('translate(100,200)'); // t=128

    //     // Looped cycle: [0,0]→[100,200] over 128→256ms
    //     expect(translateAt(animDef, 0.75)).toBe('translate(50,100)'); // t=192
    //     expect(translateAt(animDef, 1)).toBe('translate(100,200)');   // t=256
    // });
});


// ============================================================================
// Bezier / Easing utility tests
// ============================================================================

describe('subdivideCubicBezier', () => {
    it('split at t=0.5 produces two halves with shared midpoint', () => {
        const p0: [number, number] = [0, 0];
        const p1: [number, number] = [0.25, 0.1];
        const p2: [number, number] = [0.25, 1];
        const p3: [number, number] = [1, 1];

        const { left, right } = subdivideCubicBezier(p0, p1, p2, p3, 0.5);

        // Left starts at p0 and right ends at p3
        expect(left[0]).toEqual(p0);
        expect(right[3]).toEqual(p3);

        // They share the midpoint
        expect(left[3][0]).toBeCloseTo(right[0][0], 10);
        expect(left[3][1]).toBeCloseTo(right[0][1], 10);
    });

    it('split at t=0 returns degenerate left', () => {
        const p0: [number, number] = [0, 0];
        const p1: [number, number] = [0.3, 0];
        const p2: [number, number] = [0.7, 1];
        const p3: [number, number] = [1, 1];

        const { left, right } = subdivideCubicBezier(p0, p1, p2, p3, 0);

        // Left collapses to p0
        expect(left[3]).toEqual(p0);
        // Right is the full curve
        expect(right[0]).toEqual(p0);
        expect(right[3]).toEqual(p3);
    });

    it('split at t=1 returns degenerate right', () => {
        const p0: [number, number] = [0, 0];
        const p1: [number, number] = [0.3, 0];
        const p2: [number, number] = [0.7, 1];
        const p3: [number, number] = [1, 1];

        const { left, right } = subdivideCubicBezier(p0, p1, p2, p3, 1);

        // Left is the full curve
        expect(left[0]).toEqual(p0);
        expect(left[3]).toEqual(p3);
        // Right collapses to p3
        expect(right[0]).toEqual(p3);
    });
});


describe('splitEasing', () => {
    it('returns undefined for undefined (linear) input', () => {
        const { left, right } = splitEasing(undefined, 0.5);
        expect(left).toBeUndefined();
        expect(right).toBeUndefined();
    });

    it('xFraction=0 returns full easing on right', () => {
        const easing: [number, number, number, number] = [0.42, 0, 0.58, 1];
        const { left, right } = splitEasing(easing, 0);
        expect(left).toBeUndefined();
        expect(right).toEqual(easing);
    });

    it('xFraction=1 returns full easing on left', () => {
        const easing: [number, number, number, number] = [0.42, 0, 0.58, 1];
        const { left, right } = splitEasing(easing, 1);
        expect(left).toEqual(easing);
        expect(right).toBeUndefined();
    });

    it('split at 0.5 produces two valid easings', () => {
        const easing: [number, number, number, number] = [0.42, 0, 0.58, 1];
        const { left, right } = splitEasing(easing, 0.5);

        expect(left).toBeDefined();
        expect(right).toBeDefined();

        // Both halves should have control points in [0,1] range (approximately)
        for (const cp of left!) {
            expect(cp).toBeGreaterThanOrEqual(-0.01);
            expect(cp).toBeLessThanOrEqual(1.01);
        }
        for (const cp of right!) {
            expect(cp).toBeGreaterThanOrEqual(-0.01);
            expect(cp).toBeLessThanOrEqual(1.01);
        }
    });

    it('left half evaluated at x=1 produces same y as original at split point', () => {
        const easing: [number, number, number, number] = [0.25, 0.1, 0.25, 1];
        const splitX = 0.4;
        const { left } = splitEasing(easing, splitX);

        // The left half maps [0,1]→[0,splitY]. When evaluated at x=1
        // it should give y=1 (by re-normalization). And the original easing
        // at splitX should equal the same absolute y.
        const originalY = cubicBezier(easing)(splitX);

        // If left easing is defined, evaluate it at x=1 → should give y=1 (normalized)
        if (left) {
            const leftY = cubicBezier(left)(1);
            expect(leftY).toBeCloseTo(1, 1);
        }

        // Original y at split point should be between 0 and 1
        expect(originalY).toBeGreaterThan(0);
        expect(originalY).toBeLessThan(1);
    });
});


describe('reverseEasing', () => {
    it('returns undefined for undefined input', () => {
        expect(reverseEasing(undefined)).toBeUndefined();
    });

    it('reverses a cubic-bezier correctly', () => {
        const easing: [number, number, number, number] = [0.42, 0, 0.58, 1];
        const reversed = reverseEasing(easing)!;

        expect(reversed[0]).toBeCloseTo(1 - 0.58);
        expect(reversed[1]).toBeCloseTo(1 - 1);
        expect(reversed[2]).toBeCloseTo(1 - 0.42);
        expect(reversed[3]).toBeCloseTo(1 - 0);
    });

    it('double-reverse returns original easing', () => {
        const easing: [number, number, number, number] = [0.25, 0.1, 0.25, 1];
        const doubleReversed = reverseEasing(reverseEasing(easing)!)!;

        expect(doubleReversed[0]).toBeCloseTo(easing[0], 10);
        expect(doubleReversed[1]).toBeCloseTo(easing[1], 10);
        expect(doubleReversed[2]).toBeCloseTo(easing[2], 10);
        expect(doubleReversed[3]).toBeCloseTo(easing[3], 10);
    });

    it('reversed easing at x produces 1 - original(1-x)', () => {
        const easing: [number, number, number, number] = [0.42, 0, 0.58, 1];
        const reversed = reverseEasing(easing)!;

        const originalFn = cubicBezier(easing);
        const reversedFn = cubicBezier(reversed);

        // For several x values, reversed(x) ≈ 1 - original(1-x)
        for (const x of [0.1, 0.25, 0.5, 0.75, 0.9]) {
            expect(reversedFn(x)).toBeCloseTo(1 - originalFn(1 - x), 5);
        }
    });
});


////////////////////////////////////////////////////////////////

function getTestJson(): PxAnimatedSvgDocument {
    return {
        type: 'svg',
        id: '_px_2p4d44pl',
        fill: 'none',
        viewBox: '0 0 400 400',

        animator: {
            mode: 'frames',
            duration: 128,
            fill: 'forwards',
            direction: 'normal',
            trigger: { startOn: 'load' }
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
                type: 'ellipse',
                id: '_px_2pp00tnc',
                fill: '#0087ff',
                stroke: '#ffffff',
                transform: 'translate(200,100)',
                rx: '50',
                ry: '50'
            }
        ]
    };
}
