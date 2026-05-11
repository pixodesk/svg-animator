/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Tests for `PxMotionPath` — motion-along-path normalisation (OUTPUT-B → OUTPUT-A).
// See `fix-motion-along-path--fix-plan.md`.

import { describe, expect, it } from 'vitest';
import type { PxAnimatedSvgDocument, PxNode } from './PxAnimatorTypes';
import { buildMotionPathD, emitMotionPathsToDefs, findMotionPathNodes, motionPathIdForNode, nodeNeedsMotionPathNormalisation, normaliseMotionPaths, rewriteSourceForMotionPath } from './PxMotionPath';


// ── Helpers to build test fixtures ────────────────────────────────────────────

function bodyTransformWithTangents(): PxNode {
    // Canonical OUTPUT-B body shape from the plan.
    return {
        type: 'ellipse',
        id: '_test_tangented',
        transform: {
            autoOrient: true,
            keyframes: [
                { time: 0,    value: { translate: [60, 190] }, tangentOut: [62.3495,  57.0257] },
                { time: 1000, value: { translate: [60, 360] }, tangentIn:  [62.3495, -56.3075] },
            ],
        },
    } as unknown as PxNode;
}

function bodyTransformPlain(): PxNode {
    // Unified transform without tangents or autoOrient — should NOT be normalised.
    return {
        type: 'rect',
        id: '_test_plain',
        transform: {
            keyframes: [
                { time: 0,    value: { translate: [0, 0] } },
                { time: 1000, value: { translate: [100, 0] } },
            ],
        },
    } as unknown as PxNode;
}

function bodyTransformAutoOrientNoTangents(): PxNode {
    // Edge case: autoOrient flag set but tangents missing. Still needs the
    // motion-path render (rotation along the implicit polyline).
    return {
        type: 'rect',
        id: '_test_ao_only',
        transform: {
            autoOrient: true,
            keyframes: [
                { time: 0,    value: { translate: [0,   0] } },
                { time: 1000, value: { translate: [100, 50] } },
            ],
        },
    } as unknown as PxNode;
}

function svgDoc(children: Array<PxNode>): PxAnimatedSvgDocument {
    return {
        type: 'svg',
        children,
    } as unknown as PxAnimatedSvgDocument;
}


describe('nodeNeedsMotionPathNormalisation', () => {

    it('returns true for body-transform with kf-level tangents', () => {
        expect(nodeNeedsMotionPathNormalisation(bodyTransformWithTangents())).toBe(true);
    });

    it('returns true for body-transform with autoOrient (no tangents)', () => {
        expect(nodeNeedsMotionPathNormalisation(bodyTransformAutoOrientNoTangents())).toBe(true);
    });

    it('returns false for plain unified transform (no tangents, no autoOrient)', () => {
        expect(nodeNeedsMotionPathNormalisation(bodyTransformPlain())).toBe(false);
    });

    it('returns false for a node without any transform', () => {
        const node = { type: 'ellipse', id: 'x' } as unknown as PxNode;
        expect(nodeNeedsMotionPathNormalisation(node)).toBe(false);
    });

    it('returns false for static transform (no keyframes)', () => {
        const node = {
            type: 'ellipse',
            id: 'x',
            transform: { value: { translate: [10, 20] } },
        } as unknown as PxNode;
        expect(nodeNeedsMotionPathNormalisation(node)).toBe(false);
    });

    it('returns false for a string transform attribute', () => {
        const node = {
            type: 'ellipse',
            id: 'x',
            transform: 'translate(10,20)',
        } as unknown as PxNode;
        expect(nodeNeedsMotionPathNormalisation(node)).toBe(false);
    });

    it('uses kfs (short alias) when keyframes is absent', () => {
        const node = {
            type: 'ellipse',
            id: 'x',
            transform: {
                kfs: [
                    { t: 0,    v: { translate: [0, 0] }, tangentOut: [10, 0] },
                    { t: 1000, v: { translate: [50, 50] } },
                ],
            },
        } as unknown as PxNode;
        expect(nodeNeedsMotionPathNormalisation(node)).toBe(true);
    });
});


describe('findMotionPathNodes', () => {

    it('returns an empty array when no node carries motion-path metadata', () => {
        const doc = svgDoc([bodyTransformPlain(), { type: 'rect', id: 'q' } as unknown as PxNode]);
        expect(findMotionPathNodes(doc)).toStrictEqual([]);
    });

    it('finds a single matching node at the top level', () => {
        const tangented = bodyTransformWithTangents();
        const doc = svgDoc([bodyTransformPlain(), tangented]);
        const found = findMotionPathNodes(doc);
        expect(found).toHaveLength(1);
        expect(found[0]).toBe(tangented);
    });

    it('finds deeply-nested matching nodes', () => {
        const tangentedDeep = bodyTransformWithTangents();
        const g: PxNode = {
            type: 'g',
            id: 'wrap',
            children: [
                { type: 'g', id: 'inner', children: [tangentedDeep] } as unknown as PxNode,
            ],
        } as unknown as PxNode;
        const doc = svgDoc([g]);
        const found = findMotionPathNodes(doc);
        expect(found).toHaveLength(1);
        expect(found[0]).toBe(tangentedDeep);
    });

    it('returns multiple matches in pre-order', () => {
        const a = bodyTransformWithTangents();
        a.id = 'first';
        const b = bodyTransformAutoOrientNoTangents();
        b.id = 'second';
        const doc = svgDoc([a, b]);
        const found = findMotionPathNodes(doc);
        expect(found).toHaveLength(2);
        expect(found[0].id).toBe('first');
        expect(found[1].id).toBe('second');
    });
});


describe('buildMotionPathD', () => {

    it('emits the canonical OUTPUT-A d-string for the canonical OUTPUT-B body shape', () => {
        // From the plan: canonical horseshoe arc between (60,190) and (60,360),
        // with tangents that bow out to x=122.3495.
        //
        //   OUTPUT-B kf[0]: translate=[60,190], tangentOut=[ 62.3495,  57.0257]
        //   OUTPUT-B kf[1]: translate=[60,360], tangentIn= [ 62.3495, -56.3075]
        //
        // Editor emits: M60,190C122.3495,247.0257,122.3495,303.6925,60,360
        const node = bodyTransformWithTangents();
        expect(buildMotionPathD(node)).toBe(
            'M60,190C122.3495,247.0257,122.3495,303.6925,60,360'
        );
    });

    it('emits L for a straight segment (both tangents missing)', () => {
        const node = bodyTransformAutoOrientNoTangents();
        // (0,0) → (100,50), no tangents.
        expect(buildMotionPathD(node)).toBe('M0,0L100,50');
    });

    it('emits L for a straight segment (both tangents are [0,0])', () => {
        const node: PxNode = {
            type: 'ellipse',
            id: 'x',
            transform: {
                keyframes: [
                    { time: 0,    value: { translate: [0, 0] },   tangentOut: [0, 0] },
                    { time: 1000, value: { translate: [50, 50] }, tangentIn:  [0, 0] },
                ],
            },
        } as unknown as PxNode;
        expect(buildMotionPathD(node)).toBe('M0,0L50,50');
    });

    it('emits C when only tangentOut is present (treats absent tangentIn as [0,0])', () => {
        const node: PxNode = {
            type: 'ellipse',
            id: 'x',
            transform: {
                keyframes: [
                    { time: 0,    value: { translate: [0, 0] },     tangentOut: [10, 20] },
                    { time: 1000, value: { translate: [100, 100] } },
                ],
            },
        } as unknown as PxNode;
        expect(buildMotionPathD(node)).toBe('M0,0C10,20,100,100,100,100');
    });

    it('emits C when only tangentIn is present (treats absent tangentOut as [0,0])', () => {
        const node: PxNode = {
            type: 'ellipse',
            id: 'x',
            transform: {
                keyframes: [
                    { time: 0,    value: { translate: [0, 0] } },
                    { time: 1000, value: { translate: [100, 100] }, tangentIn: [-30, -40] },
                ],
            },
        } as unknown as PxNode;
        expect(buildMotionPathD(node)).toBe('M0,0C0,0,70,60,100,100');
    });

    it('emits a multi-segment path for 3+ keyframes (one curve, one line)', () => {
        const node: PxNode = {
            type: 'ellipse',
            id: 'x',
            transform: {
                keyframes: [
                    { time: 0,    value: { translate: [0,   0] }, tangentOut: [20, 0] },
                    { time: 500,  value: { translate: [50,  0] }, tangentIn:  [-20, 0] },
                    { time: 1000, value: { translate: [50, 50] } },
                ],
            },
        } as unknown as PxNode;
        // Segment 0→1: curve (20,0) + (-20,0). Segment 1→2: straight (no tangents).
        expect(buildMotionPathD(node)).toBe('M0,0C20,0,30,0,50,0L50,50');
    });

    it('honours short aliases (kfs / v) used together', () => {
        const node: PxNode = {
            type: 'ellipse',
            id: 'x',
            transform: {
                kfs: [
                    { t: 0,    v: { translate: [60, 190] }, tangentOut: [62.3495,  57.0257] },
                    { t: 1000, v: { translate: [60, 360] }, tangentIn:  [62.3495, -56.3075] },
                ],
            },
        } as unknown as PxNode;
        expect(buildMotionPathD(node)).toBe(
            'M60,190C122.3495,247.0257,122.3495,303.6925,60,360'
        );
    });

    it('accepts composite per-part value shape (value: [x, y] directly)', () => {
        // Composite mini-meta: `value` is the bare pair, not a parts record.
        const node: PxNode = {
            type: 'g',
            id: 'x',
            transform: {
                autoOrient: true,
                keyframes: [
                    { time: 0,    value: [60, 190], tangentOut: [62.3495,  57.0257] },
                    { time: 1000, value: [60, 360], tangentIn:  [62.3495, -56.3075] },
                ],
            },
        } as unknown as PxNode;
        expect(buildMotionPathD(node)).toBe(
            'M60,190C122.3495,247.0257,122.3495,303.6925,60,360'
        );
    });

    it('strips trailing zeros in the formatted numbers', () => {
        const node: PxNode = {
            type: 'ellipse',
            id: 'x',
            transform: {
                keyframes: [
                    { time: 0,    value: { translate: [60.0, 190.00] }, tangentOut: [60, 0] },
                    { time: 1000, value: { translate: [120,  190] },    tangentIn:  [-60, 0] },
                ],
            },
        } as unknown as PxNode;
        // No decimals expected — 60 and 190, not "60.0".
        expect(buildMotionPathD(node)).toBe('M60,190C120,190,60,190,120,190');
    });

    it('rounds to 4 fractional digits (matches editor formatNum)', () => {
        const node: PxNode = {
            type: 'ellipse',
            id: 'x',
            transform: {
                keyframes: [
                    { time: 0,    value: { translate: [0.123456789, 0] },     tangentOut: [0, 0] },
                    { time: 1000, value: { translate: [100, 99.999999999] }, tangentIn:  [0, 0] },
                ],
            },
        } as unknown as PxNode;
        // 0.123456789 → 0.1235; 99.999999999 → 100.
        expect(buildMotionPathD(node)).toBe('M0.1235,0L100,100');
    });

    it('returns undefined when the node has fewer than 2 keyframes', () => {
        const node: PxNode = {
            type: 'ellipse',
            id: 'x',
            transform: { keyframes: [{ time: 0, value: { translate: [1, 2] } }] },
        } as unknown as PxNode;
        expect(buildMotionPathD(node)).toBeUndefined();
    });

    it('returns undefined when a keyframe has no translate part', () => {
        const node: PxNode = {
            type: 'ellipse',
            id: 'x',
            transform: {
                keyframes: [
                    { time: 0,    value: { rotate: 0 } },
                    { time: 1000, value: { rotate: 90 } },
                ],
            },
        } as unknown as PxNode;
        expect(buildMotionPathD(node)).toBeUndefined();
    });

    it('returns undefined when transform is not an object animation', () => {
        const node: PxNode = {
            type: 'ellipse',
            id: 'x',
            transform: 'translate(10,20)',
        } as unknown as PxNode;
        expect(buildMotionPathD(node)).toBeUndefined();
    });
});


describe('emitMotionPathsToDefs', () => {

    it('returns an empty array and does not mutate doc when no node matches', () => {
        const doc = svgDoc([bodyTransformPlain()]);
        const emissions = emitMotionPathsToDefs(doc);
        expect(emissions).toStrictEqual([]);
        // No <defs> was created.
        expect(doc.children?.find(ch => ch.type === 'defs')).toBeUndefined();
    });

    it('creates a <defs> child and a <path> entry when none exist', () => {
        const tangented = bodyTransformWithTangents();
        tangented.id = 'srcA';
        const doc = svgDoc([tangented]);
        const emissions = emitMotionPathsToDefs(doc);

        expect(emissions).toHaveLength(1);
        expect(emissions[0].node).toBe(tangented);
        expect(emissions[0].pathId).toBe('srcA_motion');

        // <defs> child created at top of doc.children.
        const defs = doc.children?.[0];
        expect(defs?.type).toBe('defs');
        expect(defs?.children).toHaveLength(1);

        const pathNode = defs?.children?.[0];
        expect(pathNode?.type).toBe('path');
        expect(pathNode?.id).toBe('srcA_motion');
        expect(pathNode?.d).toBe('M60,190C122.3495,247.0257,122.3495,303.6925,60,360');
    });

    it('appends to an existing <defs> rather than creating a new one', () => {
        const tangented = bodyTransformWithTangents();
        tangented.id = 'srcA';
        const preExistingDefs: PxNode = {
            type: 'defs',
            children: [{ type: 'path', id: 'unrelated', d: 'M0,0L1,1' } as unknown as PxNode],
        } as unknown as PxNode;
        const doc = svgDoc([preExistingDefs, tangented]);
        emitMotionPathsToDefs(doc);

        // Still only ONE <defs> in the tree.
        const defsList = doc.children?.filter(ch => ch.type === 'defs');
        expect(defsList).toHaveLength(1);
        // Pre-existing entry is preserved; new entry appended after it.
        expect(defsList?.[0].children).toHaveLength(2);
        expect(defsList?.[0].children?.[0].id).toBe('unrelated');
        expect(defsList?.[0].children?.[1].id).toBe('srcA_motion');
    });

    it('emits one entry per source node, in pre-order', () => {
        const a = bodyTransformWithTangents();
        a.id = 'A';
        const b = bodyTransformAutoOrientNoTangents();
        b.id = 'B';
        const doc = svgDoc([a, b]);
        const emissions = emitMotionPathsToDefs(doc);

        expect(emissions.map(e => e.pathId)).toStrictEqual(['A_motion', 'B_motion']);
        const defs = doc.children?.find(ch => ch.type === 'defs');
        expect(defs?.children?.map(c => c.id)).toStrictEqual(['A_motion', 'B_motion']);
    });

    it('is idempotent — calling twice does not duplicate <path> entries', () => {
        const tangented = bodyTransformWithTangents();
        tangented.id = 'idem';
        const doc = svgDoc([tangented]);

        emitMotionPathsToDefs(doc);
        emitMotionPathsToDefs(doc);

        const defs = doc.children?.find(ch => ch.type === 'defs');
        expect(defs?.children).toHaveLength(1);
        expect(defs?.children?.[0].id).toBe('idem_motion');
    });

    it('finds deeply-nested source nodes too', () => {
        const tangented = bodyTransformWithTangents();
        tangented.id = 'deep';
        const wrapper: PxNode = {
            type: 'g', id: 'wrap',
            children: [{ type: 'g', id: 'inner', children: [tangented] } as unknown as PxNode],
        } as unknown as PxNode;
        const doc = svgDoc([wrapper]);
        const emissions = emitMotionPathsToDefs(doc);

        expect(emissions).toHaveLength(1);
        expect(emissions[0].pathId).toBe('deep_motion');
        const defs = doc.children?.find(ch => ch.type === 'defs');
        expect(defs?.children?.[0].id).toBe('deep_motion');
    });

    it('derives ids via motionPathIdForNode (deterministic, suffix-based)', () => {
        const node = bodyTransformWithTangents();
        node.id = 'abc';
        expect(motionPathIdForNode(node)).toBe('abc_motion');
    });
});


describe('rewriteSourceForMotionPath', () => {

    it('rewrites the canonical 2-kf source node to OUTPUT-A body shape', () => {
        const node = bodyTransformWithTangents() as any;
        rewriteSourceForMotionPath(node, 'srcA_motion');

        // Body `transform` is gone.
        expect(node.transform).toBeUndefined();

        // `offsetDistance` keyframes 0 → 1 at the original times.
        expect(node.offsetDistance).toBeDefined();
        expect(node.offsetDistance.keyframes).toHaveLength(2);
        expect(node.offsetDistance.keyframes[0].time).toBe(0);
        expect(node.offsetDistance.keyframes[0].value).toBe(0);
        expect(node.offsetDistance.keyframes[1].time).toBe(1000);
        expect(node.offsetDistance.keyframes[1].value).toBe(1);

        // `style` populated with the WAAPI CSS Motion Path properties.
        expect(node.style.offsetPath).toBe('url(#srcA_motion)');
        expect(node.style.offsetAnchor).toBe('0 0');
        expect(node.style.offsetDistance).toBe('0%');
        // autoOrient is true on bodyTransformWithTangents.
        expect(node.style.offsetRotate).toBe('auto');
    });

    it('sets offsetRotate to "0deg" when the source has no autoOrient', () => {
        // Tangented but autoOrient absent — still motion-along-path because tangents are non-zero.
        const node = bodyTransformWithTangents() as any;
        delete node.transform.autoOrient;
        rewriteSourceForMotionPath(node, 'p_motion');
        expect(node.style.offsetRotate).toBe('0deg');
    });

    it('copies easing from the source kfs onto the offsetDistance kfs', () => {
        const node: any = bodyTransformWithTangents();
        node.transform.keyframes[0].easing = [0.1, 0.2, 0.3, 0.4];
        node.transform.keyframes[1].easing = [0.5, 0.6, 0.7, 0.8];
        rewriteSourceForMotionPath(node, 'e_motion');

        expect(node.offsetDistance.keyframes[0].easing).toStrictEqual([0.1, 0.2, 0.3, 0.4]);
        expect(node.offsetDistance.keyframes[1].easing).toStrictEqual([0.5, 0.6, 0.7, 0.8]);
    });

    it('computes arc-length-proportional intermediate offsetDistance for 3+ kfs', () => {
        // Two straight segments: first 100u long, second 50u long. Total = 150.
        // Expected offsets: 0, 100/150 ≈ 0.6667, 1.
        const node: any = {
            type: 'ellipse',
            id: 'x',
            transform: {
                keyframes: [
                    { time: 0,    value: { translate: [0,   0] } },
                    { time: 500,  value: { translate: [100, 0] } },
                    { time: 1000, value: { translate: [100, 50] } },
                ],
            },
        };
        // But — needs detection: with both tangents missing and no autoOrient,
        // `nodeNeedsMotionPathNormalisation` returns false, and the rewrite
        // becomes a no-op. Flip autoOrient on so the rewrite runs.
        node.transform.autoOrient = true;
        rewriteSourceForMotionPath(node, 'multi_motion');

        const vals = node.offsetDistance.keyframes.map((k: any) => k.value);
        expect(vals[0]).toBe(0);
        expect(vals[1]).toBeCloseTo(100 / 150, 3);
        expect(vals[2]).toBe(1);
    });

    it('is a no-op for a node that does not need normalisation', () => {
        const node: any = bodyTransformPlain();
        const before = JSON.stringify(node);
        rewriteSourceForMotionPath(node, 'noop_motion');
        expect(JSON.stringify(node)).toBe(before);
    });

    it('carries `loop` from the original animation to offsetDistance', () => {
        const node: any = bodyTransformWithTangents();
        node.transform.loop = true;
        rewriteSourceForMotionPath(node, 'loop_motion');
        expect(node.offsetDistance.loop).toBe(true);
    });

    it('preserves existing style entries (e.g. fill, stroke)', () => {
        const node: any = bodyTransformWithTangents();
        node.style = { fill: '#abc', opacity: '0.5' };
        rewriteSourceForMotionPath(node, 'style_motion');
        expect(node.style.fill).toBe('#abc');
        expect(node.style.opacity).toBe('0.5');
        expect(node.style.offsetPath).toBe('url(#style_motion)');
    });
});


describe('normaliseMotionPaths (D3 + D4 combined)', () => {

    it('produces the canonical OUTPUT-A shape end-to-end', () => {
        const ellipse: any = bodyTransformWithTangents();
        ellipse.id = '_px_canon';
        ellipse.fill = '#8d493b';
        ellipse.rx = 35;
        ellipse.ry = 35;
        const doc: any = svgDoc([ellipse]);
        normaliseMotionPaths(doc);

        // `<defs>` with one `<path>` was added.
        const defs = doc.children[0];
        expect(defs.type).toBe('defs');
        expect(defs.children).toHaveLength(1);
        expect(defs.children[0]).toMatchObject({
            type: 'path',
            id: '_px_canon_motion',
            d: 'M60,190C122.3495,247.0257,122.3495,303.6925,60,360',
        });

        // Ellipse rewritten.
        const out = doc.children[1];
        expect(out.transform).toBeUndefined();
        expect(out.fill).toBe('#8d493b');
        expect(out.rx).toBe(35);
        expect(out.offsetDistance.keyframes).toStrictEqual([
            { time: 0,    value: 0 },
            { time: 1000, value: 1 },
        ]);
        expect(out.style).toStrictEqual({
            offsetPath: 'url(#_px_canon_motion)',
            offsetAnchor: '0 0',
            offsetDistance: '0%',
            offsetRotate: 'auto',
        });
    });

    it('leaves a doc with no motion-path nodes untouched', () => {
        const doc: any = svgDoc([bodyTransformPlain()]);
        const before = JSON.stringify(doc);
        normaliseMotionPaths(doc);
        expect(JSON.stringify(doc)).toBe(before);
    });

    it('is idempotent — running it twice gives the same result', () => {
        const doc: any = svgDoc([bodyTransformWithTangents()]);
        normaliseMotionPaths(doc);
        const afterFirst = JSON.stringify(doc);
        normaliseMotionPaths(doc);
        expect(JSON.stringify(doc)).toBe(afterFirst);
    });

    // ── D5: B-normalised deep-equals a hand-crafted OUTPUT-A reference ────────

    it('normalised OUTPUT-B deep-equals a hand-crafted OUTPUT-A reference doc', () => {
        // Canonical OUTPUT-B input (from the plan: ellipse with autoOrient
        // translate from (60,190) to (60,360) along a horseshoe curve).
        const inputB: any = {
            type: 'svg',
            id: '_px_canon',
            viewBox: '0 0 400 400',
            fill: 'none',
            animator: {
                duration: 1000,
                mode: 'auto',
                direction: 'normal',
                timeline: 'time',
                trigger: { startOn: 'load', outAction: 'pause' },
            },
            children: [
                {
                    type: 'ellipse',
                    id: '_px_ell',
                    fill: '#8d493b',
                    stroke: '#0064ff',
                    rx: 35,
                    ry: 35,
                    transform: {
                        autoOrient: true,
                        keyframes: [
                            { time: 0,    value: { translate: [60, 190] }, tangentOut: [62.3495,  57.0257] },
                            { time: 1000, value: { translate: [60, 360] }, tangentIn:  [62.3495, -56.3075] },
                        ],
                    },
                },
            ],
        };

        // Hand-crafted OUTPUT-A reference for the exact same input — what we
        // expect the normalisation pass to produce.
        const expectedA: any = {
            type: 'svg',
            id: '_px_canon',
            viewBox: '0 0 400 400',
            fill: 'none',
            animator: {
                duration: 1000,
                mode: 'auto',
                direction: 'normal',
                timeline: 'time',
                trigger: { startOn: 'load', outAction: 'pause' },
            },
            children: [
                {
                    type: 'defs',
                    children: [
                        {
                            type: 'path',
                            id: '_px_ell_motion',
                            d: 'M60,190C122.3495,247.0257,122.3495,303.6925,60,360',
                        },
                    ],
                },
                {
                    type: 'ellipse',
                    id: '_px_ell',
                    fill: '#8d493b',
                    stroke: '#0064ff',
                    rx: 35,
                    ry: 35,
                    offsetDistance: {
                        keyframes: [
                            { time: 0,    value: 0 },
                            { time: 1000, value: 1 },
                        ],
                    },
                    style: {
                        offsetPath: 'url(#_px_ell_motion)',
                        offsetAnchor: '0 0',
                        offsetDistance: '0%',
                        offsetRotate: 'auto',
                    },
                },
            ],
        };

        normaliseMotionPaths(inputB);
        expect(inputB).toStrictEqual(expectedA);
    });

    // ── D6: edge cases ────────────────────────────────────────────────────────

    it('handles a 2-kf path with collapsed tangents (autoOrient only, no curve)', () => {
        // autoOrient triggers normalisation, but with both tangents [0,0] the
        // path is a straight line. buildMotionPathD emits `L`, not `C`;
        // arc-length is the chord length; offsetDistance is still [0, 1].
        const node: any = {
            type: 'rect',
            id: 'flat',
            transform: {
                autoOrient: true,
                keyframes: [
                    { time: 0,    value: { translate: [0,   0] }, tangentOut: [0, 0] },
                    { time: 1000, value: { translate: [100, 50] }, tangentIn:  [0, 0] },
                ],
            },
        };
        const doc: any = svgDoc([node]);
        normaliseMotionPaths(doc);

        const defs = doc.children[0];
        expect(defs.type).toBe('defs');
        expect(defs.children[0].d).toBe('M0,0L100,50');

        const out = doc.children[1];
        expect(out.transform).toBeUndefined();
        expect(out.offsetDistance.keyframes).toStrictEqual([
            { time: 0,    value: 0 },
            { time: 1000, value: 1 },
        ]);
        expect(out.style.offsetRotate).toBe('auto');
    });

    it('handles a 2-kf path with a single-sided tangent (tangentIn only)', () => {
        const node: any = {
            type: 'rect',
            id: 'half',
            transform: {
                keyframes: [
                    { time: 0,    value: { translate: [0,   0] } },
                    { time: 1000, value: { translate: [100, 0] }, tangentIn: [-50, 50] },
                ],
            },
        };
        const doc: any = svgDoc([node]);
        normaliseMotionPaths(doc);

        const defs = doc.children[0];
        expect(defs.children[0].d).toBe('M0,0C0,0,50,50,100,0');
    });

    it('handles a 3-kf multi-segment path with a curve + a straight line', () => {
        // Segment 0→1 curve through (20,40) and (40,-40); segment 1→2 straight.
        // (Curved segment is significantly longer than the straight 50u.)
        const node: any = {
            type: 'rect',
            id: 'multi',
            transform: {
                keyframes: [
                    { time: 0,    value: { translate: [0,   0] }, tangentOut: [20,  40] },
                    { time: 500,  value: { translate: [60,  0] }, tangentIn:  [-20, -40] },
                    { time: 1000, value: { translate: [60, 50] } },
                ],
            },
        };
        const doc: any = svgDoc([node]);
        normaliseMotionPaths(doc);

        const defs = doc.children[0];
        expect(defs.type).toBe('defs');
        expect(defs.children[0].d).toBe('M0,0C20,40,40,-40,60,0L60,50');

        const out = doc.children[1];
        const vals = out.offsetDistance.keyframes.map((k: any) => k.value);
        // Three offset distances: start, end-of-curve, end.
        expect(vals[0]).toBe(0);
        expect(vals[1]).toBeGreaterThan(0);
        expect(vals[1]).toBeLessThan(1);
        expect(vals[2]).toBe(1);

        // Strictly monotonic.
        expect(vals[1]).toBeGreaterThan(vals[0]);
        expect(vals[2]).toBeGreaterThan(vals[1]);
    });

    it('handles multiple motion-path elements at the same level', () => {
        const a: any = bodyTransformWithTangents();
        a.id = 'A';
        const b: any = bodyTransformAutoOrientNoTangents();
        b.id = 'B';
        const doc: any = svgDoc([a, b]);
        normaliseMotionPaths(doc);

        // <defs> created with both <path>s.
        const defs = doc.children[0];
        expect(defs.children.map((c: any) => c.id)).toStrictEqual(['A_motion', 'B_motion']);

        // Both elements rewritten.
        expect(doc.children[1].id).toBe('A');
        expect(doc.children[1].transform).toBeUndefined();
        expect(doc.children[1].style.offsetPath).toBe('url(#A_motion)');
        expect(doc.children[2].id).toBe('B');
        expect(doc.children[2].transform).toBeUndefined();
        expect(doc.children[2].style.offsetPath).toBe('url(#B_motion)');
    });
});
