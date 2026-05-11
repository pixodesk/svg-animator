/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { describe, expect, it } from 'vitest';
import { PxKeyframeSchema, PxPropertyAnimationSchema } from './PxAnimatorTypes';


// Round-trip coverage for the motion-along-path schema additions:
//   * PxKeyframeSchema.tangentIn / tangentOut  ([number, number] tuples)
//   * PxPropertyAnimationSchema.autoOrient     (boolean)
//
// See `fix-motion-along-path--fix-plan.md` for the wider plan and the
// canonical OUTPUT-B shape these fields participate in.


describe('PxKeyframeSchema — tangent fields', () => {

    it('accepts a keyframe with tangentOut', () => {
        expect(PxKeyframeSchema.isValid({
            time: 0,
            value: { translate: [60, 190] },
            tangentOut: [62.3495, 57.0257],
        })).toBe(true);
    });

    it('accepts a keyframe with tangentIn', () => {
        expect(PxKeyframeSchema.isValid({
            time: 1000,
            value: { translate: [60, 360] },
            tangentIn: [62.3495, -56.3075],
        })).toBe(true);
    });

    it('preserves tangentOut + tangentIn through sanitize', () => {
        const kf = {
            time: 0,
            value: { translate: [60, 190] },
            tangentOut: [62.3495, 57.0257],
            tangentIn:  [10, 20],
        };
        const out = PxKeyframeSchema.sanitize(kf) as { tangentOut: unknown; tangentIn: unknown };
        expect(out.tangentOut).toStrictEqual([62.3495, 57.0257]);
        expect(out.tangentIn).toStrictEqual([10, 20]);
    });

    it('drops a malformed tangent (wrong-arity tuple)', () => {
        const out = PxKeyframeSchema.sanitize({
            time: 0,
            value: { translate: [0, 0] },
            tangentOut: [62.3495], // missing y
        }) as { tangentOut?: unknown };
        expect(out.tangentOut).toBeUndefined();
    });

    it('coerces non-numeric tuple elements to 0 (graceful degradation — [0,0] = straight-line tangent)', () => {
        const out = PxKeyframeSchema.sanitize({
            time: 0,
            value: { translate: [0, 0] },
            tangentIn: ['a', 'b'],
        }) as { tangentIn?: unknown };
        expect(out.tangentIn).toStrictEqual([0, 0]);
    });

    it('tangents are optional (omitting them is fine)', () => {
        expect(PxKeyframeSchema.isValid({
            time: 0,
            value: { translate: [60, 190] },
        })).toBe(true);
    });
});


describe('PxPropertyAnimationSchema — autoOrient field', () => {

    it('accepts autoOrient: true', () => {
        expect(PxPropertyAnimationSchema.isValid({
            autoOrient: true,
            keyframes: [
                { time: 0,    value: { translate: [60, 190] }, tangentOut: [62.3495,  57.0257] },
                { time: 1000, value: { translate: [60, 360] }, tangentIn:  [62.3495, -56.3075] },
            ],
        })).toBe(true);
    });

    it('accepts autoOrient: false', () => {
        expect(PxPropertyAnimationSchema.isValid({
            autoOrient: false,
            keyframes: [{ time: 0, value: { translate: [0, 0] } }],
        })).toBe(true);
    });

    it('preserves autoOrient through sanitize', () => {
        const anim = {
            autoOrient: true,
            keyframes: [
                { time: 0,    value: { translate: [60, 190] }, tangentOut: [62.3495,  57.0257] },
                { time: 1000, value: { translate: [60, 360] }, tangentIn:  [62.3495, -56.3075] },
            ],
        };
        const out = PxPropertyAnimationSchema.sanitize(anim) as {
            autoOrient: boolean;
            keyframes: Array<{ tangentOut?: unknown; tangentIn?: unknown }>;
        };
        expect(out.autoOrient).toBe(true);
        expect(out.keyframes).toHaveLength(2);
        expect(out.keyframes[0].tangentOut).toStrictEqual([62.3495, 57.0257]);
        expect(out.keyframes[1].tangentIn).toStrictEqual([62.3495, -56.3075]);
    });

    it('drops a non-boolean autoOrient', () => {
        const out = PxPropertyAnimationSchema.sanitize({
            autoOrient: 'yes',
            keyframes: [{ time: 0, value: { translate: [0, 0] } }],
        }) as { autoOrient?: unknown };
        expect(out.autoOrient).toBeUndefined();
    });

    it('autoOrient is optional', () => {
        expect(PxPropertyAnimationSchema.isValid({
            keyframes: [{ time: 0, value: { translate: [0, 0] } }],
        })).toBe(true);
    });
});


describe('OUTPUT-B canonical body-transform shape — full round-trip', () => {

    it('the body-transform slot example from fix-motion-along-path plan validates and survives sanitize', () => {
        // Mirror of the canonical OUTPUT-B shape documented in
        // `fix-motion-along-path--fix-plan.md`.
        const bodyTransform = {
            autoOrient: true,
            keyframes: [
                { time: 0,    value: { translate: [60, 190] }, tangentOut: [62.3495,  57.0257] },
                { time: 1000, value: { translate: [60, 360] }, tangentIn:  [62.3495, -56.3075] },
            ],
        };

        expect(PxPropertyAnimationSchema.isValid(bodyTransform)).toBe(true);

        const out = PxPropertyAnimationSchema.sanitize(bodyTransform) as {
            autoOrient: boolean;
            keyframes: Array<{
                time: number;
                value: { translate: [number, number] };
                tangentOut?: [number, number];
                tangentIn?: [number, number];
            }>;
        };

        expect(out.autoOrient).toBe(true);
        expect(out.keyframes[0].time).toBe(0);
        expect(out.keyframes[0].value.translate).toStrictEqual([60, 190]);
        expect(out.keyframes[0].tangentOut).toStrictEqual([62.3495, 57.0257]);
        expect(out.keyframes[1].time).toBe(1000);
        expect(out.keyframes[1].value.translate).toStrictEqual([60, 360]);
        expect(out.keyframes[1].tangentIn).toStrictEqual([62.3495, -56.3075]);
    });
});
