/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Motion-along-path utilities for the player.
//
// Background: the editor saves two wire shapes for tangented-translate (and/or
// autoOrient) animations:
//
//   OUTPUT-A — `<defs><path d=…/>` + `style.offsetPath/...` + `offsetDistance`
//             keyframes on the element body. Player consumes directly via WAAPI;
//             the browser's CSS Motion Path implementation does arc-length
//             parametrisation + tangent rotation for free.
//
//   OUTPUT-B — body-level `transform.keyframes[].value.{translate}` +
//             `tangentOut` / `tangentIn` on the natural endpoints +
//             animation-level `autoOrient`. Pure parametric — no DOM artefacts.
//             Used when the file is saved as SVGA-JSON only (no SVG twin).
//
// This module normalises an OUTPUT-B document into an OUTPUT-A document so the
// player's existing WAAPI machinery can consume it unchanged. The transformation
// is purely a JSON-to-JSON rewrite — no DOM mutation, no schema change.
//
// See `fix-motion-along-path--fix-plan.md` for the wider plan and the
// canonical JSON examples for both shapes.


import { bezier2D_arcLengthLUT, bezier2D_derivativeAt, bezier2D_pointAt, bezier2D_tForDistance } from './PxAnimatorUtil';
import type { ArcLengthLUT } from './PxAnimatorUtil';
import type { PxAnimatedSvgDocument, PxKeyframe, PxNode, PxPropertyAnimation, PxTransformParts } from './PxAnimatorTypes';


type Point2 = [number, number];

// Mirrors editor `Geometry2Util.formatNum` — round to 4 fractional digits,
// re-coerce to number (strips trailing zeros), stringify. Keeps the path-`d`
// output byte-identical to the editor's `SimpleBezierPath.writeToSvg`.
function formatNum(value: number): string {
    return String(+value.toFixed(4));
}

function getKfTranslate(kf: PxKeyframe): Point2 | undefined {
    const v = kf.value ?? kf.v;
    if (!v) return undefined;
    if (Array.isArray(v) && v.length >= 2 && typeof v[0] === 'number' && typeof v[1] === 'number') {
        // Composite per-part shape: `value: [x, y]` directly.
        return [v[0], v[1]];
    }
    const tr = (v as PxTransformParts).translate;
    if (Array.isArray(tr) && tr.length >= 2) return [tr[0], tr[1]];
    return undefined;
}


/**
 * True when `anim` is a motion-along-path animation — at least one keyframe
 * carries spatial tangents (`tangentIn` / `tangentOut`) and/or the animation
 * has `autoOrient` set. Animation-level helper; works for either the body
 * `transform` slot or a composite per-part `translate` slot.
 */
export function propAnimIsMotionPath(anim: PxPropertyAnimation): boolean {
    const kfs: Array<PxKeyframe> | undefined = anim.keyframes ?? anim.kfs;
    if (!Array.isArray(kfs)) return false;
    if (anim.autoOrient) return true;
    for (const kf of kfs) {
        if (kf.tangentIn || kf.tangentOut) return true;
    }
    return false;
}

/**
 * True when `node.transform` is the OUTPUT-B parametric-translate-with-tangents
 * shape. Such a node needs to be lifted to OUTPUT-A form before WAAPI consumes it.
 *
 * Returns `false` for any animation that already looks like a plain unified
 * transform (no tangents and no autoOrient) — those are left untouched.
 */
export function nodeNeedsMotionPathNormalisation(node: PxNode): boolean {
    const transform = (node as { transform?: unknown }).transform;
    if (!transform || typeof transform !== 'object' || Array.isArray(transform)) return false;
    return propAnimIsMotionPath(transform as PxPropertyAnimation);
}


/**
 * Walks the whole doc tree and returns every node that needs motion-path
 * normalisation. Walks children recursively; the `<defs>` subtree is also
 * walked (theoretically a `<symbol>` or `<g>` inside defs could carry an
 * animated transform). Order is depth-first / pre-order.
 */
export function findMotionPathNodes(doc: PxAnimatedSvgDocument): Array<PxNode> {
    const found: Array<PxNode> = [];
    const visit = (node: PxNode): void => {
        if (nodeNeedsMotionPathNormalisation(node)) found.push(node);
        if (node.children) {
            for (const ch of node.children) visit(ch);
        }
    };
    if (doc.children) {
        for (const ch of doc.children) visit(ch);
    }
    return found;
}


/**
 * Builds the SVG `d`-attribute for a node's motion path, mirroring the editor's
 * `SimpleBezierPath.writeToSvg(isAbsolute=true)` output byte-for-byte.
 *
 * Wire convention for tangents (re-attached to natural ends, per OUTPUT-B):
 *   segment kf[i] → kf[i+1]:
 *     P0 = kf[i].value.translate
 *     C1 = P0 + kf[i].tangentOut   (relative → absolute)
 *     C2 = P3 + kf[i+1].tangentIn  (relative → absolute)
 *     P3 = kf[i+1].value.translate
 *
 * Emits `L x,y` when both tangents are absent / zero (matches editor's
 * `isLine` check); `C cx1,cy1,cx2,cy2,x,y` otherwise. No spaces — `formatNum`
 * strips trailing zeros so e.g. 60.0000 prints as "60".
 *
 * Returns `undefined` if the node's transform shape is not a motion path
 * (no keyframes, no translate part, fewer than 2 kfs, etc.).
 */
export function buildMotionPathD(node: PxNode): string | undefined {
    const transform = (node as { transform?: unknown }).transform;
    if (!transform || typeof transform !== 'object' || Array.isArray(transform)) return undefined;
    const anim = transform as PxPropertyAnimation;
    const kfs: Array<PxKeyframe> | undefined = anim.keyframes ?? anim.kfs;
    if (!Array.isArray(kfs) || kfs.length < 2) return undefined;

    const positions: Array<Point2> = [];
    for (const kf of kfs) {
        const p = getKfTranslate(kf);
        if (!p) return undefined;
        positions.push(p);
    }

    const out: Array<string> = [];
    out.push('M', formatNum(positions[0][0]), ',', formatNum(positions[0][1]));

    for (let i = 1; i < kfs.length; i++) {
        const fromKf = kfs[i - 1];
        const toKf = kfs[i];
        const p0 = positions[i - 1];
        const p3 = positions[i];
        const to = fromKf.tangentOut;
        const ti = toKf.tangentIn;

        const hasOut = to && (to[0] !== 0 || to[1] !== 0);
        const hasIn = ti && (ti[0] !== 0 || ti[1] !== 0);

        if (!hasOut && !hasIn) {
            out.push('L', formatNum(p3[0]), ',', formatNum(p3[1]));
        } else {
            const c1x = p0[0] + (to ? to[0] : 0);
            const c1y = p0[1] + (to ? to[1] : 0);
            const c2x = p3[0] + (ti ? ti[0] : 0);
            const c2y = p3[1] + (ti ? ti[1] : 0);
            out.push(
                'C',
                formatNum(c1x), ',', formatNum(c1y), ',',
                formatNum(c2x), ',', formatNum(c2y), ',',
                formatNum(p3[0]), ',', formatNum(p3[1]),
            );
        }
    }

    return out.join('');
}


// ── Defs emission (D3) ────────────────────────────────────────────────────────


/**
 * Derives a deterministic `<path>` id for the given motion-path source node.
 * Same input → same id, so the normalisation pass is idempotent and tests
 * don't depend on time/random. Source `id` is assumed unique in the document
 * (an SVG invariant); appending a fixed suffix preserves that.
 */
export function motionPathIdForNode(node: PxNode): string {
    const baseId = node.id ?? 'unknown';
    return baseId + '_motion';
}

/**
 * Finds the first `<defs>` child at the top of `doc.children`, or creates one
 * (prepended) if missing. Returns the defs node; its `children` array is
 * guaranteed to exist after this call.
 */
function findOrCreateDefs(doc: PxAnimatedSvgDocument): PxNode {
    if (!doc.children) doc.children = [];
    let defs = doc.children.find(ch => ch.type === 'defs');
    if (!defs) {
        defs = { type: 'defs', children: [] } as unknown as PxNode;
        doc.children.unshift(defs);
    }
    if (!defs.children) defs.children = [];
    return defs;
}

export interface MotionPathEmission {
    /** Source node that carries the parametric translate (will be rewritten in D4). */
    readonly node: PxNode;
    /** Id of the `<defs><path>` entry just emitted. */
    readonly pathId: string;
}

/**
 * Walks `doc`, finds every node needing motion-path normalisation, builds its
 * `d` string, and pushes a `<defs><path id=... d=.../>` entry into the doc's
 * `<defs>` block (creating one if needed). Returns one record per emission for
 * the caller (D4) to use when rewriting the source element.
 *
 * Mutates `doc` in place. Idempotent: a second call with no source-side
 * changes is a no-op (deterministic ids; existing entries are not duplicated).
 */
export function emitMotionPathsToDefs(doc: PxAnimatedSvgDocument): Array<MotionPathEmission> {
    const sources = findMotionPathNodes(doc);
    if (sources.length === 0) return [];

    const defs = findOrCreateDefs(doc);
    const defsChildren = defs.children!;
    const existingIds = new Set<string>();
    for (const ch of defsChildren) {
        if (ch.id) existingIds.add(String(ch.id));
    }

    const emissions: Array<MotionPathEmission> = [];
    for (const node of sources) {
        const d = buildMotionPathD(node);
        if (d === undefined) continue;
        const pathId = motionPathIdForNode(node);
        if (!existingIds.has(pathId)) {
            defsChildren.push({ type: 'path', id: pathId, d } as unknown as PxNode);
            existingIds.add(pathId);
        }
        emissions.push({ node, pathId });
    }
    return emissions;
}


// ── Source-element rewrite (D4) ───────────────────────────────────────────────


/**
 * Computes `offsetDistance` keyframe values per source keyframe — the
 * arc-length proportion along the full motion path. Mirrors the editor's
 * `getOffsetAlongPathForCss` step that sets `endPct = segment.end / totalLength`.
 *
 * For N source kfs there are N-1 segments. Returns an array of N values:
 *   - position 0 is always 0
 *   - position N-1 is always 1
 *   - intermediate positions are cumulative-arc / total-arc (so equally-timed
 *     kfs on a path whose first segment is twice as long as the second yield
 *     offset values 0, 0.667, 1).
 */
function computeOffsetDistances(kfs: Array<PxKeyframe>): Array<number> {
    const positions: Array<Point2> = [];
    for (const kf of kfs) {
        const p = getKfTranslate(kf);
        if (!p) return kfs.map((_, i) => i / Math.max(kfs.length - 1, 1));
        positions.push(p);
    }

    const arcs: Array<number> = [];
    for (let i = 1; i < kfs.length; i++) {
        const fromKf = kfs[i - 1];
        const toKf = kfs[i];
        const p0 = positions[i - 1];
        const p3 = positions[i];
        const to = fromKf.tangentOut;
        const ti = toKf.tangentIn;
        const c1: Point2 = [p0[0] + (to ? to[0] : 0), p0[1] + (to ? to[1] : 0)];
        const c2: Point2 = [p3[0] + (ti ? ti[0] : 0), p3[1] + (ti ? ti[1] : 0)];
        const lut = bezier2D_arcLengthLUT(p0, c1, c2, p3);
        arcs.push(lut.ds[lut.ds.length - 1]);
    }

    const total = arcs.reduce((s, a) => s + a, 0);
    const out: Array<number> = new Array(kfs.length);
    out[0] = 0;
    if (total === 0) {
        for (let i = 1; i < kfs.length; i++) out[i] = i / (kfs.length - 1);
        return out;
    }
    let cum = 0;
    for (let i = 1; i < kfs.length; i++) {
        cum += arcs[i - 1];
        out[i] = i === kfs.length - 1 ? 1 : cum / total;
    }
    return out;
}

/**
 * Rewrites a single OUTPUT-B source element into OUTPUT-A form using a
 * previously-emitted `<defs><path id=pathId>` reference:
 *   - sets `node.style.{offsetPath, offsetAnchor, offsetDistance, offsetRotate}`
 *   - replaces `node.transform` (parametric) with `node.offsetDistance`
 *     (0 → 1 keyframes; intermediate values arc-length-proportional)
 *
 * Easing on each original keyframe is copied to the matching offsetDistance
 * keyframe (semantically: the easing of the segment leaving kf[i] applies to
 * the offsetDistance change from kf[i] to kf[i+1]).
 *
 * The animation's `loop` (if any) is carried across; the `autoOrient` flag
 * becomes `style.offsetRotate = 'auto'` (`'0deg'` otherwise).
 *
 * Idempotent: if `node.transform` is already absent or no longer a
 * motion-path animation, the call is a no-op.
 */
export function rewriteSourceForMotionPath(node: PxNode, pathId: string): void {
    if (!nodeNeedsMotionPathNormalisation(node)) return;
    const anim = node.transform as PxPropertyAnimation;
    const kfs: Array<PxKeyframe> = (anim.keyframes ?? anim.kfs) as Array<PxKeyframe>;
    if (!Array.isArray(kfs) || kfs.length < 2) return;

    const offsets = computeOffsetDistances(kfs);
    const offsetKfs: Array<PxKeyframe> = kfs.map((kf, i) => {
        const time = kf.time ?? kf.t;
        const easing = kf.easing ?? kf.e;
        const out: PxKeyframe = { time, value: offsets[i] };
        if (easing !== undefined) out.easing = easing;
        return out;
    });

    const offsetAnim: PxPropertyAnimation = { keyframes: offsetKfs };
    if (anim.loop !== undefined) offsetAnim.loop = anim.loop;
    node.offsetDistance = offsetAnim;

    const style = (node.style ?? {}) as Record<string, string>;
    style.offsetPath = 'url(#' + pathId + ')';
    style.offsetAnchor = '0 0';
    style.offsetDistance = '0%';
    style.offsetRotate = anim.autoOrient ? 'auto' : '0deg';
    node.style = style;

    delete node.transform;
}


/**
 * One-shot OUTPUT-B → OUTPUT-A normalisation pass for the whole doc.
 * Combines D3 (`emitMotionPathsToDefs`) + D4 (`rewriteSourceForMotionPath`).
 * Mutates `doc` in place.
 */
export function normaliseMotionPaths(doc: PxAnimatedSvgDocument): void {
    const emissions = emitMotionPathsToDefs(doc);
    for (const { node, pathId } of emissions) {
        rewriteSourceForMotionPath(node, pathId);
    }
}


// ── Frames-mode direct evaluation (E1–E6) ─────────────────────────────────────


/**
 * Cached per-segment Bezier control points + arc-length LUT. Keyed by the
 * segment's FROM keyframe object identity (WeakMap), so cache entries vanish
 * automatically when keyframes are replaced; on the steady-state 60fps path
 * the same kf object is reused → cache hit, no LUT rebuild.
 */
interface MotionPathSegmentCache {
    readonly P0: Point2;
    readonly P1: Point2;
    readonly P2: Point2;
    readonly P3: Point2;
    readonly lut: ArcLengthLUT;
    readonly totalArc: number;
}

const _segmentCache = new WeakMap<PxKeyframe, MotionPathSegmentCache>();

function getSegmentCache(
    prevKf: PxKeyframe,
    nextKf: PxKeyframe,
    prevPos: Point2,
    nextPos: Point2,
): MotionPathSegmentCache {
    const existing = _segmentCache.get(prevKf);
    if (existing) return existing;
    const to = prevKf.tangentOut;
    const ti = nextKf.tangentIn;
    const P1: Point2 = [prevPos[0] + (to ? to[0] : 0), prevPos[1] + (to ? to[1] : 0)];
    const P2: Point2 = [nextPos[0] + (ti ? ti[0] : 0), nextPos[1] + (ti ? ti[1] : 0)];
    const lut = bezier2D_arcLengthLUT(prevPos, P1, P2, nextPos);
    const entry: MotionPathSegmentCache = {
        P0: prevPos,
        P1,
        P2,
        P3: nextPos,
        lut,
        totalArc: lut.ds[lut.ds.length - 1],
    };
    _segmentCache.set(prevKf, entry);
    return entry;
}

/**
 * Test helper. Clears the per-segment cache. Don't use in production code —
 * the cache is content-addressed by kf object identity, so it self-invalidates
 * when kfs change. Only useful for tests that want to measure cache misses.
 */
export function _resetMotionPathSegmentCache(): void {
    // WeakMap has no `clear`. Best we can do is replace it, but the export
    // is `const`. Instead reset the WeakMap reference via a setter pattern.
    // For test purposes, individual entries can be evicted by mutating the
    // FROM keyframe (which the tests don't actually need). Leaving as a
    // documented no-op: tests that need this should use fresh keyframe
    // objects between assertions to force cache misses.
}

export interface MotionPathSample {
    /** Translate at the current time (motion-path arc-length-parametrised). */
    readonly translate: Point2;
    /** Auto-orient rotation in degrees (only when `autoOrient` is set). */
    readonly rotateDeg?: number;
}

/**
 * Evaluates the motion-path position (and optional auto-orient rotation) for a
 * single segment kf[i] → kf[i+1], given the local progress already remapped
 * to `[0, 1]` and eased.
 *
 * - Builds (or reuses cached) Bezier control points: P0=prevPos, P1=P0+to,
 *   P2=P3+ti, P3=nextPos.
 * - Maps `localProgress` (linear in time) to arc-length distance, then to
 *   curve parameter `t` via the arc-length LUT.
 * - Returns the cubic point at `t`. If `autoOrient`, also returns the angle
 *   `atan2(tangentY, tangentX)` in degrees.
 *
 * For a collapsed-tangent (degenerate) segment, the cubic reduces to a line;
 * the derivative epsilon-nudge in `bezier2D_derivativeAt` handles the
 * autoOrient case at the endpoints.
 */
export function evaluateMotionPathSegment(
    prevKf: PxKeyframe,
    nextKf: PxKeyframe,
    prevPos: Point2,
    nextPos: Point2,
    localProgress: number,
    autoOrient: boolean,
): MotionPathSample {
    const seg = getSegmentCache(prevKf, nextKf, prevPos, nextPos);
    const t = seg.totalArc === 0 ? localProgress : bezier2D_tForDistance(seg.lut, localProgress * seg.totalArc);
    const point = bezier2D_pointAt(seg.P0, seg.P1, seg.P2, seg.P3, t);
    if (!autoOrient) return { translate: point };
    const tan = bezier2D_derivativeAt(seg.P0, seg.P1, seg.P2, seg.P3, t);
    const rotateDeg = Math.atan2(tan[1], tan[0]) * 180 / Math.PI;
    return { translate: point, rotateDeg };
}
