/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Tests for the 2D cubic-Bézier primitives in `PxAnimatorUtil.ts` —
// motion-along-path support. See `fix-motion-along-path--fix-plan.md`.

import { describe, expect, it } from 'vitest';
import { bezier2D_arcLengthLUT, bezier2D_derivativeAt, bezier2D_pointAt, bezier2D_tForDistance, bezier2D_tForDistancePct } from './PxAnimatorUtil';


type Point2 = [number, number];


// Reference curve used across tests. Classic horseshoe shape:
//   P0=(0,0)   P1=(0,100)   P2=(100,100)   P3=(100,0)
// Mid-point (t=0.5) by Bernstein:
//   B(0.5) = 0.125·P0 + 0.375·P1 + 0.375·P2 + 0.125·P3
//          = 0.125·[0,0] + 0.375·[0,100] + 0.375·[100,100] + 0.125·[100,0]
//          = [0+0+37.5+12.5, 0+37.5+37.5+0]
//          = [50, 75]
const HORSESHOE_P0: Point2 = [0, 0];
const HORSESHOE_P1: Point2 = [0, 100];
const HORSESHOE_P2: Point2 = [100, 100];
const HORSESHOE_P3: Point2 = [100, 0];


describe('bezier2D_pointAt', () => {

    it('t=0 returns P0', () => {
        expect(bezier2D_pointAt(HORSESHOE_P0, HORSESHOE_P1, HORSESHOE_P2, HORSESHOE_P3, 0))
            .toStrictEqual([0, 0]);
    });

    it('t=1 returns P3', () => {
        expect(bezier2D_pointAt(HORSESHOE_P0, HORSESHOE_P1, HORSESHOE_P2, HORSESHOE_P3, 1))
            .toStrictEqual([100, 0]);
    });

    it('t=0.5 matches hand-computed Bernstein midpoint', () => {
        const [x, y] = bezier2D_pointAt(HORSESHOE_P0, HORSESHOE_P1, HORSESHOE_P2, HORSESHOE_P3, 0.5);
        expect(x).toBeCloseTo(50, 9);
        expect(y).toBeCloseTo(75, 9);
    });

    it('straight-line bezier (all 4 points colinear, uniform spacing) — t=0.5 is the chord midpoint', () => {
        const P0: Point2 = [0,  0];
        const P1: Point2 = [10, 0];
        const P2: Point2 = [20, 0];
        const P3: Point2 = [30, 0];
        const [x, y] = bezier2D_pointAt(P0, P1, P2, P3, 0.5);
        expect(x).toBeCloseTo(15, 9);
        expect(y).toBeCloseTo(0, 9);
    });

    it('clamps out-of-range t (<0 → P0, >1 → P3)', () => {
        expect(bezier2D_pointAt(HORSESHOE_P0, HORSESHOE_P1, HORSESHOE_P2, HORSESHOE_P3, -0.5))
            .toStrictEqual([0, 0]);
        expect(bezier2D_pointAt(HORSESHOE_P0, HORSESHOE_P1, HORSESHOE_P2, HORSESHOE_P3, 1.5))
            .toStrictEqual([100, 0]);
    });
});


describe('bezier2D_derivativeAt', () => {

    it('horseshoe @ t=0 → 3·(P1-P0) = (0, 300)', () => {
        // B'(0) = 3 · (P1 - P0) = 3 · (0,100) = (0, 300)
        const [dx, dy] = bezier2D_derivativeAt(HORSESHOE_P0, HORSESHOE_P1, HORSESHOE_P2, HORSESHOE_P3, 0);
        expect(dx).toBeCloseTo(0, 9);
        expect(dy).toBeCloseTo(300, 9);
    });

    it('horseshoe @ t=1 → 3·(P3-P2) = (0, -300)', () => {
        // B'(1) = 3 · (P3 - P2) = 3 · (0,-100) = (0, -300)
        const [dx, dy] = bezier2D_derivativeAt(HORSESHOE_P0, HORSESHOE_P1, HORSESHOE_P2, HORSESHOE_P3, 1);
        expect(dx).toBeCloseTo(0, 9);
        expect(dy).toBeCloseTo(-300, 9);
    });

    it('horseshoe @ t=0.5 → tangent points purely along +X (left-right symmetric)', () => {
        // By symmetry of P0=(0,0), P1=(0,100), P2=(100,100), P3=(100,0):
        // B'(0.5) = 3·0.25·(P1-P0) + 6·0.5·0.5·(P2-P1) + 3·0.25·(P3-P2)
        //        = 0.75·(0,100) + 1.5·(100,0) + 0.75·(0,-100)
        //        = (0+150+0, 75+0-75) = (150, 0)
        const [dx, dy] = bezier2D_derivativeAt(HORSESHOE_P0, HORSESHOE_P1, HORSESHOE_P2, HORSESHOE_P3, 0.5);
        expect(dx).toBeCloseTo(150, 9);
        expect(dy).toBeCloseTo(0, 9);
    });

    it('straight-line tangent is constant 3·(P1-P0) at every t', () => {
        // For uniform-spacing colinear control points the derivative is constant.
        const P0: Point2 = [0,  0];
        const P1: Point2 = [10, 0];
        const P2: Point2 = [20, 0];
        const P3: Point2 = [30, 0];
        for (const t of [0, 0.25, 0.5, 0.75, 1]) {
            const [dx, dy] = bezier2D_derivativeAt(P0, P1, P2, P3, t);
            expect(dx).toBeCloseTo(30, 9);
            expect(dy).toBeCloseTo(0, 9);
        }
    });

    it('epsilon-nudge: degenerate endpoint (P1=P0) at t=0 still returns a finite tangent', () => {
        // P1 collapsed onto P0 — B'(0) = 0 exactly. Without the nudge the
        // caller would get a zero vector and `atan2` would be meaningless.
        // The nudge retries at t = +1e-4, which gives a non-zero tangent
        // pointing toward P2 (the next non-collapsed control point).
        const P0: Point2 = [0, 0];
        const P1: Point2 = [0, 0];  // collapsed onto P0
        const P2: Point2 = [100, 100];
        const P3: Point2 = [100, 0];
        const [dx, dy] = bezier2D_derivativeAt(P0, P1, P2, P3, 0);
        // Result should be non-zero and pointing roughly toward P2.
        expect(dx).not.toBe(0);
        expect(dy).not.toBe(0);
        expect(dx).toBeGreaterThan(0);  // toward P2.x > 0
        expect(dy).toBeGreaterThan(0);  // toward P2.y > 0
    });

    it('epsilon-nudge at t=1 (P2 = P3) nudges inward to a finite tangent', () => {
        const P0: Point2 = [0, 0];
        const P1: Point2 = [0, 100];
        const P2: Point2 = [100, 0];  // collapsed onto P3
        const P3: Point2 = [100, 0];
        const [dx, dy] = bezier2D_derivativeAt(P0, P1, P2, P3, 1);
        expect(dx).not.toBe(0);
        // No specific direction assertion — different curves will differ.
        // The contract is just "never returns the all-zero vector at exact t=1
        // when only one handle is collapsed."
    });
});


describe('bezier2D_arcLengthLUT', () => {

    it('builds a LUT with steps+1 entries; ts[0]=0, ts[steps]=1', () => {
        const lut = bezier2D_arcLengthLUT([0,0], [10,0], [20,0], [30,0], 10);
        expect(lut.ts.length).toBe(11);
        expect(lut.ds.length).toBe(11);
        expect(lut.ts[0]).toBe(0);
        expect(lut.ts[10]).toBe(1);
    });

    it('straight-line (0,0) → (30,0) with uniform-spacing handles — arc length ≈ 30 and ds grows linearly', () => {
        const lut = bezier2D_arcLengthLUT([0,0], [10,0], [20,0], [30,0], 100);
        // Total length is exactly 30 (chord length).
        expect(lut.ds[100]).toBeCloseTo(30, 6);
        // ds grows linearly with t (uniform-spacing parametrisation → uniform arc).
        for (let i = 0; i <= 100; i += 10) {
            expect(lut.ds[i]).toBeCloseTo(30 * (i / 100), 6);
        }
    });

    it('horseshoe curve — arc length > chord length (curve is not straight)', () => {
        // Horseshoe goes P0=(0,0) up to P1=(0,100) across to P2=(100,100) down to P3=(100,0).
        // Chord = |P3 - P0| = 100. Arc length should be substantially longer.
        const lut = bezier2D_arcLengthLUT([0,0], [0,100], [100,100], [100,0], 100);
        expect(lut.ds[100]).toBeGreaterThan(100);
        // Sanity bound: must be less than the sum of chord-via-handles (perimeter
        // of the convex hull at most).
        // |P0->P1| + |P1->P2| + |P2->P3| = 100 + 100 + 100 = 300.
        expect(lut.ds[100]).toBeLessThan(300);
    });

    it('ds is monotonically non-decreasing', () => {
        const lut = bezier2D_arcLengthLUT([0,0], [0,100], [100,100], [100,0], 100);
        for (let i = 1; i < lut.ds.length; i++) {
            expect(lut.ds[i]).toBeGreaterThanOrEqual(lut.ds[i - 1]);
        }
    });

    it('refining the step count refines the arc-length estimate (LUT100 vs LUT1000 close)', () => {
        const lut100 = bezier2D_arcLengthLUT([0,0], [0,100], [100,100], [100,0], 100);
        const lut1000 = bezier2D_arcLengthLUT([0,0], [0,100], [100,100], [100,0], 1000);
        // The 100-step estimate should agree with the 1000-step estimate to <0.5%.
        expect(Math.abs(lut100.ds[100] - lut1000.ds[1000])).toBeLessThan(lut1000.ds[1000] * 0.005);
    });
});


describe('bezier2D_tForDistance', () => {

    it('straight-line: distance=15 of total 30 → t=0.5 exactly', () => {
        const P0: Point2 = [0,  0];
        const P1: Point2 = [10, 0];
        const P2: Point2 = [20, 0];
        const P3: Point2 = [30, 0];
        const lut = bezier2D_arcLengthLUT(P0, P1, P2, P3, 100);
        expect(bezier2D_tForDistance(lut, 15)).toBeCloseTo(0.5, 6);
    });

    it('distance=0 → t=0', () => {
        const lut = bezier2D_arcLengthLUT([0,0], [0,100], [100,100], [100,0], 100);
        expect(bezier2D_tForDistance(lut, 0)).toBe(0);
    });

    it('distance=totalArcLength → t=1', () => {
        const lut = bezier2D_arcLengthLUT([0,0], [0,100], [100,100], [100,0], 100);
        const total = lut.ds[100];
        expect(bezier2D_tForDistance(lut, total)).toBe(1);
    });

    it('out-of-range distance clamps to t=0 / t=1', () => {
        const lut = bezier2D_arcLengthLUT([0,0], [0,100], [100,100], [100,0], 100);
        expect(bezier2D_tForDistance(lut, -50)).toBe(0);
        expect(bezier2D_tForDistance(lut, 1e9)).toBe(1);
    });

    it('round-trip: tForDistance ∘ "distance at known t" recovers the t (within ~1% tolerance)', () => {
        // Pick a horseshoe curve and a few target t values. Compute the
        // arc-length distance at each target by sampling, then run
        // tForDistance and check we recover the original t.
        const P0: Point2 = [0, 0], P1: Point2 = [0, 100], P2: Point2 = [100, 100], P3: Point2 = [100, 0];
        const lut = bezier2D_arcLengthLUT(P0, P1, P2, P3, 200);

        for (const targetT of [0.2, 0.4, 0.6, 0.8]) {
            // Walk the LUT to find ds at `targetT` (linear interp).
            const idxFloat = targetT * 200;
            const idxLo = Math.floor(idxFloat);
            const frac = idxFloat - idxLo;
            const distance = lut.ds[idxLo] + frac * (lut.ds[idxLo + 1] - lut.ds[idxLo]);

            const recoveredT = bezier2D_tForDistance(lut, distance);
            expect(Math.abs(recoveredT - targetT)).toBeLessThan(0.01); // ~1% (LUT-induced)
        }
    });

    it('ds is monotonic — tForDistance is monotonic too', () => {
        const lut = bezier2D_arcLengthLUT([0,0], [0,100], [100,100], [100,0], 100);
        const total = lut.ds[100];
        let prevT = 0;
        for (let pct = 0.05; pct <= 1; pct += 0.05) {
            const t = bezier2D_tForDistance(lut, pct * total);
            expect(t).toBeGreaterThan(prevT);
            prevT = t;
        }
    });
});


describe('bezier2D_tForDistancePct', () => {

    it('pct=0 → t=0, pct=1 → t=1', () => {
        const lut = bezier2D_arcLengthLUT([0,0], [0,100], [100,100], [100,0], 100);
        expect(bezier2D_tForDistancePct(lut, 0)).toBe(0);
        expect(bezier2D_tForDistancePct(lut, 1)).toBe(1);
    });

    it('equivalent to tForDistance(lut, pct * totalArcLength)', () => {
        const lut = bezier2D_arcLengthLUT([0,0], [0,100], [100,100], [100,0], 100);
        const total = lut.ds[100];
        for (const pct of [0.1, 0.25, 0.5, 0.75, 0.9]) {
            expect(bezier2D_tForDistancePct(lut, pct))
                .toBeCloseTo(bezier2D_tForDistance(lut, pct * total), 12);
        }
    });

    it('out-of-range pct clamps', () => {
        const lut = bezier2D_arcLengthLUT([0,0], [0,100], [100,100], [100,0], 100);
        expect(bezier2D_tForDistancePct(lut, -0.5)).toBe(0);
        expect(bezier2D_tForDistancePct(lut, 1.5)).toBe(1);
    });
});


// ============================================================================
// Cross-validation — player's primitives vs the editor's `BezierExtra` reference
// ============================================================================
//
// Reference numbers below were captured from a one-off editor-side spec
// (`_tmp_C7_bezierExtra_dump.spec.ts`) that ran `BezierExtra.fromXy(...).get(t)`
// / `.derivative(t)` / `.getDistance()` / `.getTForDistancePct(pct)` on the
// canonical horseshoe curve (P0=(0,0), P1=(0,100), P2=(100,100), P3=(100,0)).
// Editor uses `bezier-js` + paper.js under the hood; the player here re-derives
// every result with the hand-written primitives. Tight tolerance on point/
// derivative (1e-6 — both implementations are exact Bernstein math); loose on
// arc-length-based functions (~1% — LUT-induced approximation).

describe('cross-validation vs editor BezierExtra (horseshoe curve)', () => {
    const P0: Point2 = [0,   0];
    const P1: Point2 = [0,   100];
    const P2: Point2 = [100, 100];
    const P3: Point2 = [100, 0];

    // Reference values from `BezierExtra.get(t)`
    const POINT_REF: ReadonlyArray<{ t: number; pt: Point2 }> = [
        { t: 0.00, pt: [0,        0] },
        { t: 0.25, pt: [15.625,   56.25] },
        { t: 0.50, pt: [50,       75] },
        { t: 0.75, pt: [84.375,   56.25] },
        { t: 1.00, pt: [100,      0] },
    ];
    // Reference values from `BezierExtra.derivative(t)`
    const DERIV_REF: ReadonlyArray<{ t: number; d: Point2 }> = [
        { t: 0.00, d: [0,      300] },
        { t: 0.25, d: [112.5,  150] },
        { t: 0.50, d: [150,    0] },
        { t: 0.75, d: [112.5, -150] },
        { t: 1.00, d: [0,     -300] },
    ];
    // Reference total arc length: BezierExtra.getDistance() = 199.992146
    const ARC_LEN_REF = 199.992146;
    // Reference values from `BezierExtra.getTForDistancePct(pct)`
    const T_FOR_PCT_REF: ReadonlyArray<{ pct: number; t: number; pt: Point2 }> = [
        { pct: 0.00, t: 0,        pt: [0,         0] },
        { pct: 0.10, t: 0.071552, pt: [1.462641,  19.929687] },
        { pct: 0.25, t: 0.201974, pt: [10.590249, 48.354234] },
        { pct: 0.50, t: 0.500000, pt: [50,        75] },
        { pct: 0.75, t: 0.798026, pt: [89.409751, 48.354234] },
        { pct: 0.90, t: 0.928448, pt: [98.537359, 19.929687] },
        { pct: 1.00, t: 1,        pt: [100,       0] },
    ];

    it('bezier2D_pointAt matches editor reference exactly (Bernstein vs bezier-js)', () => {
        for (const { t, pt } of POINT_REF) {
            const [x, y] = bezier2D_pointAt(P0, P1, P2, P3, t);
            expect(x).toBeCloseTo(pt[0], 6);
            expect(y).toBeCloseTo(pt[1], 6);
        }
    });

    it('bezier2D_derivativeAt matches editor reference exactly (quadratic derivative)', () => {
        for (const { t, d } of DERIV_REF) {
            const [dx, dy] = bezier2D_derivativeAt(P0, P1, P2, P3, t);
            expect(dx).toBeCloseTo(d[0], 6);
            expect(dy).toBeCloseTo(d[1], 6);
        }
    });

    it('arcLengthLUT total arc length agrees with editor (1% tolerance — LUT approximation)', () => {
        const lut = bezier2D_arcLengthLUT(P0, P1, P2, P3, 100);
        const playerLen = lut.ds[lut.ds.length - 1];
        const relErr = Math.abs(playerLen - ARC_LEN_REF) / ARC_LEN_REF;
        expect(relErr).toBeLessThan(0.01);
    });

    it('tForDistancePct + pointAt round-trips to editor-reference points (~1% tolerance)', () => {
        const lut = bezier2D_arcLengthLUT(P0, P1, P2, P3, 200);
        for (const { pct, pt } of T_FOR_PCT_REF) {
            const t = bezier2D_tForDistancePct(lut, pct);
            const [x, y] = bezier2D_pointAt(P0, P1, P2, P3, t);
            // 1.5 units absolute tolerance is ~0.75% of curve scale (100 units).
            expect(x).toBeCloseTo(pt[0], 0);
            expect(y).toBeCloseTo(pt[1], 0);
            // Tighter check: within 1.5 units of the editor result.
            expect(Math.abs(x - pt[0])).toBeLessThan(1.5);
            expect(Math.abs(y - pt[1])).toBeLessThan(1.5);
        }
    });

    it('tForDistancePct(t) within 1% of editor reference t', () => {
        const lut = bezier2D_arcLengthLUT(P0, P1, P2, P3, 200);
        for (const { pct, t: refT } of T_FOR_PCT_REF) {
            const t = bezier2D_tForDistancePct(lut, pct);
            expect(Math.abs(t - refT)).toBeLessThan(0.01);
        }
    });
});
