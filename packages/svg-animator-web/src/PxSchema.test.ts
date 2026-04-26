/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { describe, expect, it } from 'vitest';
import { px, PxInfer, PxSchema } from './PxSchema';

// ─────────────────────────────────────────────────────────────────────────────
// Schema declarations for PxAnimatedSvgDocument and its nested types.
// Each declaration both defines the schema and infers the TypeScript type.
// ─────────────────────────────────────────────────────────────────────────────

const PxEasingOrRefSchema = px.union([
    px.string(),
    px.array(px.number()),   // [x1, y1, x2, y2] cubic-bezier
]);

const PxKeyframeSchema = px.object({
    time:   px.number().optional(),
    t:      px.number().optional(),    // short alias
    value:  px.any().optional(),
    v:      px.any().optional(),       // short alias
    easing: PxEasingOrRefSchema.optional(),
    e:      PxEasingOrRefSchema.optional(), // short alias
});

const PxLoopSchema = px.union([
    px.boolean(),
    px.object({
        segmentCount: px.number().optional(),
        before:       px.boolean().optional(),
        alternate:    px.boolean().optional(),
    }),
]);

const PxPropertyAnimationSchema = px.object({
    keyframes: px.array(PxKeyframeSchema).optional(),
    kfs:       px.array(PxKeyframeSchema).optional(), // short alias
    loop:      PxLoopSchema.optional(),
});

// PxAnimationDefinition = Record<string, PxPropertyAnimation>
const PxAnimationDefinitionSchema = px.record(PxPropertyAnimationSchema);

// PxElementAnimation = string | string[] | PxAnimationDefinition | mixed[]
// Approximated as a union of the three most common forms.
const PxElementAnimationSchema: PxSchema<string | Array<string> | Record<string, PxInfer<typeof PxPropertyAnimationSchema>>> = px.union([
    px.string(),
    px.array(px.string()),
    PxAnimationDefinitionSchema,
]);

const PxTriggerSchema = px.object({
    startOn:                  px.enum(['load', 'mouseOver', 'click', 'scrollIntoView', 'programmatic'] as const).optional(),
    outAction:                px.enum(['continue', 'pause', 'reset', 'reverse'] as const).optional(),
    scrollIntoViewThreshold:  px.number().optional(),
});

const PxAnimatorConfigSchema = px.object({
    mode:          px.enum(['auto', 'webapi', 'frames'] as const).optional(),
    duration:      px.number().optional(),
    delay:         px.number().optional(),
    iterations:    px.union([px.number(), px.literal('infinite')]).optional(),
    fill:          px.enum(['forwards', 'backwards', 'both', 'none'] as const).optional(),
    direction:     px.enum(['normal', 'reverse', 'alternate', 'alternate-reverse'] as const).optional(),
    frameRate:     px.number().optional(),
    trigger:       PxTriggerSchema.optional(),
    debug:         px.boolean().optional(),
    debugInstName: px.string().optional(),
});

// Named easings are 4-element number tuples — approximated as number[].
const PxDefsSchema = px.object({
    easings:    px.record(px.array(px.number())).optional(),
    animations: px.record(PxAnimationDefinitionSchema).optional(),
    styles:     px.record(px.record(px.union([px.string(), px.number()]))).optional(),
});

// PxNode is recursive via children.
const PxNodeSchema: PxSchema<{
    type: string;
    children?: Array<unknown>;
    animate?: string | Array<string> | Record<string, PxInfer<typeof PxPropertyAnimationSchema>>;
    style?: string | Record<string, string | number>;
}> = px.lazy(
    () => px.object({
        type:     px.string('unknown'),
        children: px.array(PxNodeSchema as any).optional(),
        animate:  PxElementAnimationSchema.optional(),
        style:    px.union([
            px.string(),
            px.record(px.union([px.string(), px.number()])),
        ]).optional(),
    }),
    { type: 'unknown' }
);

const PxBindingSchema = px.object({
    id:      px.string(),
    animate: PxElementAnimationSchema,
});

// Root document schema.
const PxAnimatedSvgDocumentSchema = px.object({
    type:     px.string('svg'),
    width:    px.number().optional(),
    height:   px.number().optional(),
    viewBox:  px.string().optional(),
    animator: PxAnimatorConfigSchema.optional(),
    defs:     PxDefsSchema.optional(),
    bindings: px.array(PxBindingSchema).optional(),
    children: px.array(PxNodeSchema as any).optional(),
});

// Type inferred automatically from the schema — no separate interface needed.
type PxAnimatedSvgDocument = PxInfer<typeof PxAnimatedSvgDocumentSchema>;


// ─────────────────────────────────────────────────────────────────────────────
// Expected shape constants — reused across tests
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_KEYFRAME = {
    time: undefined, t: undefined, value: undefined,
    v: undefined, easing: undefined, e: undefined,
};

const EMPTY_TRIGGER = {
    startOn: undefined, outAction: undefined, scrollIntoViewThreshold: undefined,
};

const EMPTY_CONFIG = {
    mode: undefined, duration: undefined, delay: undefined, iterations: undefined,
    fill: undefined, direction: undefined, frameRate: undefined,
    trigger: undefined, debug: undefined, debugInstName: undefined,
};

const EMPTY_DOC: PxAnimatedSvgDocument = {
    type: 'svg', width: undefined, height: undefined, viewBox: undefined,
    animator: undefined, defs: undefined, bindings: undefined, children: undefined,
};

// NOTE: px.object() strips keys not declared in the schema shape.
// For PxNode this means SVG attributes (fill, cx, cy, r, stroke, …) are dropped.
// Only type, children, animate, and style are preserved.
const node = (type: string, extras?: Partial<{ children: unknown[]; animate: unknown; style: unknown }>) => ({
    type,
    children: undefined,
    animate: undefined,
    style: undefined,
    ...extras,
});


// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('PxSchema primitives', () => {

    it('string: valid passes through, invalid uses default', () => {
        expect(px.string().sanitize('hello')).toBe('hello');
        expect(px.string('fallback').sanitize(42)).toBe('fallback');
        expect(px.string().isValid('hello')).toBe(true);
        expect(px.string().isValid(null)).toBe(false);
    });

    it('number: rejects NaN and Infinity', () => {
        expect(px.number().isValid(NaN)).toBe(false);
        expect(px.number().isValid(Infinity)).toBe(false);
        expect(px.number(99).sanitize(NaN)).toBe(99);
        expect(px.number().sanitize(3.14)).toBe(3.14);
    });

    it('enum: valid member passes, unknown uses default', () => {
        const s = px.enum(['a', 'b', 'c'] as const);
        expect(s.sanitize('b')).toBe('b');
        expect(s.sanitize('z')).toBe('a');      // default = first value
        expect(s.isValid('a')).toBe(true);
        expect(s.isValid('x')).toBe(false);
    });

    it('literal: exact match only', () => {
        const s = px.literal('svg');
        expect(s.isValid('svg')).toBe(true);
        expect(s.isValid('div')).toBe(false);
        expect(s.sanitize('div')).toBe('svg'); // returns the literal as default
    });
});


describe('PxSchema optional', () => {

    it('returns undefined for null/undefined input', () => {
        expect(px.string().optional().sanitize(undefined)).toBeUndefined();
        expect(px.string().optional().sanitize(null)).toBeUndefined();
    });

    it('returns undefined when input is wrong primitive type (drops rubbish)', () => {
        expect(px.number().optional().sanitize('not-a-number')).toBeUndefined();
        expect(px.boolean().optional().sanitize(1)).toBeUndefined();
    });

    it('passes through a valid value', () => {
        expect(px.number().optional().sanitize(42)).toBe(42);
    });

    it('sanitizes a partially-valid object rather than dropping it entirely', () => {
        // An object with one invalid field is repaired; it is NOT dropped as undefined.
        const s = px.object({ x: px.number(0), label: px.string().optional() });
        expect(s.optional().sanitize({ x: 'bad', label: 'ok' })).toStrictEqual({ x: 0, label: 'ok' });
    });

    it('isValid accepts undefined/null and valid values, rejects wrong types', () => {
        const s = px.number().optional();
        expect(s.isValid(undefined)).toBe(true);
        expect(s.isValid(null)).toBe(true);
        expect(s.isValid(7)).toBe(true);
        expect(s.isValid('7')).toBe(false);
    });
});


describe('PxSchema union', () => {

    it('matches first valid schema', () => {
        const s = px.union([px.string(), px.number()]);
        expect(s.sanitize('hi')).toBe('hi');
        expect(s.sanitize(42)).toBe(42);
    });

    it('falls back to default when nothing matches', () => {
        const s = px.union([px.string(), px.number()], 'default');
        expect(s.sanitize(true)).toBe('default');
    });

    it('easing: accepts string or number array', () => {
        expect(PxEasingOrRefSchema.isValid('ease-in')).toBe(true);
        expect(PxEasingOrRefSchema.isValid([0.25, 0.1, 0.25, 1])).toBe(true);
        expect(PxEasingOrRefSchema.isValid(42)).toBe(false);
    });
});


describe('PxSchema object', () => {

    it('strips unknown keys', () => {
        const s = px.object({ x: px.number() });
        expect(s.sanitize({ x: 5, garbage: 'hello', extra: true })).toStrictEqual({ x: 5 });
    });

    it('replaces invalid required field with its default', () => {
        const s = px.object({ mode: px.string('auto') });
        expect(s.sanitize({ mode: 99 })).toStrictEqual({ mode: 'auto' });
        expect(s.sanitize({})).toStrictEqual({ mode: 'auto' });
    });

    it('drops invalid optional field', () => {
        const s = px.object({ label: px.string().optional() });
        expect(s.sanitize({ label: 42 })).toStrictEqual({ label: undefined });
        expect(s.sanitize({ label: 'ok' })).toStrictEqual({ label: 'ok' });
    });

    it('produces a minimum valid object from null or garbage input', () => {
        const s = px.object({ type: px.string('svg'), duration: px.number(1000) });
        expect(s.sanitize(null)).toStrictEqual({ type: 'svg', duration: 1000 });
        expect(s.sanitize('not-an-object')).toStrictEqual({ type: 'svg', duration: 1000 });
    });

    it('isValid requires all required fields to be present and correct type', () => {
        const s = px.object({ type: px.string(), count: px.number() });
        expect(s.isValid({ type: 'x', count: 1 })).toBe(true);
        expect(s.isValid({ type: 'x' })).toBe(false);        // count missing
        expect(s.isValid({ type: 'x', count: 'bad' })).toBe(false);
    });
});


describe('PxSchema array', () => {

    it('filters items whose type cannot even be attempted', () => {
        expect(px.array(px.number()).sanitize([1, 'bad', 2, null, 3])).toStrictEqual([1, 2, 3]);
    });

    it('repairs partially-valid objects rather than filtering them', () => {
        // Objects are passed through sanitize; only primitives of the wrong type are filtered.
        const s = px.array(px.object({ x: px.number(0) }));
        expect(s.sanitize([{ x: 1 }, { x: 'bad' }, { x: 3 }]))
            .toStrictEqual([{ x: 1 }, { x: 0 }, { x: 3 }]);
    });

    it('returns [] for non-array input', () => {
        expect(px.array(px.string()).sanitize(null)).toStrictEqual([]);
        expect(px.array(px.string()).sanitize('oops')).toStrictEqual([]);
    });

    it('isValid requires all items to be valid', () => {
        const s = px.array(px.number());
        expect(s.isValid([1, 2, 3])).toBe(true);
        expect(s.isValid([1, 'bad'])).toBe(false);
    });
});


describe('PxSchema record', () => {

    it('drops invalid values, keeps valid ones', () => {
        expect(px.record(px.number()).sanitize({ a: 1, b: 'bad', c: 3 }))
            .toStrictEqual({ a: 1, c: 3 });
    });

    it('returns {} for non-object input', () => {
        expect(px.record(px.string()).sanitize(null)).toStrictEqual({});
        expect(px.record(px.string()).sanitize([1, 2])).toStrictEqual({});
    });
});


describe('PxKeyframeSchema', () => {

    it('valid keyframe with aliases passes isValid', () => {
        expect(PxKeyframeSchema.isValid({ t: 0, v: 100 })).toBe(true);
        expect(PxKeyframeSchema.isValid({ time: 500, value: '#ff0000', easing: 'ease-in' })).toBe(true);
    });

    it('sanitizes: invalid easing dropped, valid time kept, unknown keys stripped', () => {
        expect(PxKeyframeSchema.sanitize({ t: 100, e: 42, unknownKey: 'x' })).toStrictEqual({
            ...EMPTY_KEYFRAME,
            t: 100,
            // e: 42 dropped — 42 is not string | number[]
            // unknownKey stripped
        });
    });

    it('sanitizes null to an all-undefined keyframe shape', () => {
        expect(PxKeyframeSchema.sanitize(null)).toStrictEqual(EMPTY_KEYFRAME);
    });

    it('sanitizes a full valid keyframe unchanged', () => {
        const kf = { t: 200, v: [0, 100, 200], e: 'ease-out' };
        expect(PxKeyframeSchema.sanitize(kf)).toStrictEqual({
            time: undefined, t: 200, value: undefined, v: [0, 100, 200],
            easing: undefined, e: 'ease-out',
        });
    });
});


describe('PxAnimatorConfigSchema', () => {

    it('valid config passes isValid', () => {
        expect(PxAnimatorConfigSchema.isValid({
            mode: 'webapi',
            duration: 1000,
            fill: 'forwards',
            trigger: { startOn: 'load' },
        })).toBe(true);
    });

    it('sanitizes: invalid mode dropped, valid duration kept', () => {
        expect(PxAnimatorConfigSchema.sanitize({ mode: 'turbo', duration: 500 })).toStrictEqual({
            ...EMPTY_CONFIG,
            duration: 500,
            // mode: 'turbo' dropped — not in enum
        });
    });

    it('sanitizes: Infinity duration dropped', () => {
        expect(PxAnimatorConfigSchema.sanitize({ duration: Infinity })).toStrictEqual(EMPTY_CONFIG);
    });

    it('sanitizes: nested trigger repaired, unknown trigger keys stripped', () => {
        expect(PxAnimatorConfigSchema.sanitize({
            trigger: { startOn: 'scrollIntoView', scrollIntoViewThreshold: 0.5, garbage: true },
        })).toStrictEqual({
            ...EMPTY_CONFIG,
            trigger: {
                startOn: 'scrollIntoView',
                outAction: undefined,
                scrollIntoViewThreshold: 0.5,
                // garbage stripped
            },
        });
    });

    it('sanitizes: unknown trigger startOn dropped', () => {
        expect(PxAnimatorConfigSchema.sanitize({ trigger: { startOn: 'hover' } })).toStrictEqual({
            ...EMPTY_CONFIG,
            trigger: EMPTY_TRIGGER,
        });
    });

    it('sanitizes: iterations accepts number or "infinite"', () => {
        expect(PxAnimatorConfigSchema.sanitize({ iterations: 3 })).toStrictEqual({
            ...EMPTY_CONFIG,
            iterations: 3,
        });
        expect(PxAnimatorConfigSchema.sanitize({ iterations: 'infinite' })).toStrictEqual({
            ...EMPTY_CONFIG,
            iterations: 'infinite',
        });
        expect(PxAnimatorConfigSchema.sanitize({ iterations: 'once' })).toStrictEqual(EMPTY_CONFIG);
    });
});


describe('PxAnimatedSvgDocumentSchema', () => {

    it('valid document passes isValid', () => {
        // Note: isValid ignores unknown keys (fill, cx etc.) so this passes
        // even though sanitize would strip them.
        expect(PxAnimatedSvgDocumentSchema.isValid({
            type: 'svg',
            animator: { duration: 500 },
            children: [{ type: 'rect', fill: '#f00' }],
        })).toBe(true);
    });

    it('sanitizes null to a minimum document with type default', () => {
        expect(PxAnimatedSvgDocumentSchema.sanitize(null)).toStrictEqual(EMPTY_DOC);
    });

    it('sanitizes: strips unknown top-level keys; SVG node attributes also stripped', () => {
        // px.object() only preserves declared fields — SVG attributes like fill are dropped.
        expect(PxAnimatedSvgDocumentSchema.sanitize({
            type: 'svg',
            animator: { duration: 500 },
            children: [{ type: 'rect', fill: '#f00' }],
            __internal: true,
        })).toStrictEqual({
            ...EMPTY_DOC,
            animator: { ...EMPTY_CONFIG, duration: 500 },
            children: [node('rect')], // fill '#f00' stripped — not in PxNode schema shape
        });
    });

    it('sanitizes: invalid type replaced with default, valid fields kept, partial animator repaired', () => {
        expect(PxAnimatedSvgDocumentSchema.sanitize({
            type: 99,             // invalid — replaced by default 'svg'
            width: 400,
            animator: { mode: 'bad-mode', duration: 300 }, // mode dropped, duration kept
        })).toStrictEqual({
            ...EMPTY_DOC,
            type: 'svg',
            width: 400,
            animator: { ...EMPTY_CONFIG, duration: 300 },
        });
    });

    it('sanitizes: missing required binding field gets default, binding objects are never filtered', () => {
        expect(PxAnimatedSvgDocumentSchema.sanitize({
            type: 'svg',
            bindings: [
                { id: 'el1', animate: 'fadeIn' },
                { animate: 'spin' },        // id missing → default ''
                { id: '', animate: 'slide' },
            ],
        })).toStrictEqual({
            ...EMPTY_DOC,
            bindings: [
                { id: 'el1', animate: 'fadeIn' },
                { id: '',    animate: 'spin' },  // id got default ''
                { id: '',    animate: 'slide' },
            ],
        });
    });

    it('sanitizes: deeply nested children repaired recursively, non-node items filtered', () => {
        // Note: SVG attributes (cx, cy) on child nodes are stripped by the schema.
        expect(PxAnimatedSvgDocumentSchema.sanitize({
            type: 'svg',
            children: [
                {
                    type: 'g',
                    children: [
                        { type: 'circle', cx: 50, cy: 50 }, // cx/cy stripped
                        'not-a-node',                        // filtered — string is not a node
                        { type: 'rect', animate: 'fadeIn' },
                    ],
                },
            ],
        })).toStrictEqual({
            ...EMPTY_DOC,
            children: [
                node('g', {
                    children: [
                        node('circle'),                       // cx, cy stripped
                        node('rect', { animate: 'fadeIn' }),
                    ],
                }),
            ],
        });
    });
});
