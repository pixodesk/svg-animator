/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { PxBezierPath, PxTransformParts } from './PxAnimatorTypes';


/**
 * Converts a PxBezierPath to an SVG path string.
 * Control points (i, o) are treated as ABSOLUTE coordinates.
 * @param {PxBezierPath} path
 * @returns {string}
 */
export function bezierToSvgPath(path: PxBezierPath): string {
    const v = path.v;
    const i = path.i;
    const o = path.o;
    const c = path.c;

    if (!v.length) return "";

    const d: Array<string> = [];
    const len = v.length;
    d.push("M" + v[0][0] + "," + v[0][1]);

    for (let idx = 1; idx < len; idx++) {
        const prevV = v[idx - 1];
        const prevO = o?.[idx - 1] ?? prevV;
        const currI = i?.[idx] ?? v[idx];
        const currV = v[idx];

        // Check if it's a straight line (control points coincide with vertices)
        const isLine = (prevO[0] === prevV[0] && prevO[1] === prevV[1]) &&
            (currI[0] === currV[0] && currI[1] === currV[1]);

        if (isLine) {
            d.push("L" + currV[0] + "," + currV[1]);
        } else {
            // Control points are absolute coordinates
            d.push("C" + prevO[0] + "," + prevO[1] + "," + currI[0] + "," + currI[1] + "," + currV[0] + "," + currV[1]);
        }
    }

    if (c && len > 0) {
        const lastV = v[len - 1];
        const lastO = o?.[len - 1] ?? lastV;
        const firstI = i?.[0] ?? v[0];
        const firstV = v[0];

        // Check if closing segment is a straight line
        const isLine = (lastO[0] === lastV[0] && lastO[1] === lastV[1]) &&
            (firstI[0] === firstV[0] && firstI[1] === firstV[1]);

        if (!isLine) {
            d.push("C" + lastO[0] + "," + lastO[1] + "," + firstI[0] + "," + firstI[1] + "," + firstV[0] + "," + firstV[1]);
        }

        d.push("z");
    }

    return d.join("");
}

/**
 * @param {number} a 
 * @param {number} b 
 * @param {number} t 
 * @returns {number}
 */
export function interpolateNum(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}


/**
 * @param {Array<number>} a 
 * @param {Array<number>} b 
 * @param {number} t 
 * @returns {Array<number>}
 */
export function interpolateVec(a: Array<number>, b: Array<number>, t: number): Array<number> {
    const res: Array<number> = [];
    const count = Math.max(a.length, b.length);
    for (let i = 0; i < count; i++) {
        res[i] = interpolateNum(a[i] || 0, b[i] || 0, t);
    }
    return res;
}

/**
 * Interpolates between two color arrays [r, g, b] or [r, g, b, a].
 * Normalizes both colors to 4 elements, defaulting alpha to 1 if missing.
 */
export function interpolateColor(a: Array<number>, b: Array<number>, t: number): Array<number> {
    return [
        interpolateNum(a[0] || 0, b[0] || 0, t),
        interpolateNum(a[1] || 0, b[1] || 0, t),
        interpolateNum(a[2] || 0, b[2] || 0, t),
        interpolateNum(a[3] === undefined ? 1 : a[3], b[3] === undefined ? 1 : b[3], t)
    ];
}

/**
 * Interpolates between two arrays of bezier paths.
 * @param paths1 The starting array of paths.
 * @param paths2 The ending array of paths.
 * @param progress The interpolation progress from 0.0 to 1.0.
 */
export function interpolateBeziers(
    paths1: Array<PxBezierPath>,
    paths2: Array<PxBezierPath>,
    progress: number
): Array<PxBezierPath> {
    const count = Math.max(paths1.length, paths2.length);
    const res: Array<PxBezierPath> = [];
    for (let i = 0; i < count; i++) {
        res.push(interpolateBezier(paths1[i], paths2[i], progress));
    }
    return res;
}

/**
 * Interpolates between two bezier paths.
 * Control points (i, o) are treated as ABSOLUTE coordinates.
 * When control points are missing, they default to the vertex position.
 * @param {PxBezierPath} path1
 * @param {PxBezierPath} path2
 * @param {number} progress
 * @returns {PxBezierPath}
 */
export function interpolateBezier(
    path1: PxBezierPath | undefined,
    path2: PxBezierPath | undefined,
    progress: number
): PxBezierPath {
    if (!path1 || !path2) return path1 || path2 || { v: [] };

    const t = Math.min(Math.max(progress, 0), 1);
    const len = Math.min(path1.v.length, path2.v.length);

    const v: Array<Array<number>> = [];
    const i: Array<Array<number>> = [];
    const o: Array<Array<number>> = [];

    for (let idx = 0; idx < len; idx++) {
        const v1 = path1.v[idx];
        const v2 = path2.v[idx];
        v.push(interpolateVec(v1, v2, t));

        // For absolute control points, default to vertex position (straight line)
        const i1 = path1.i?.[idx] ?? v1;
        const i2 = path2.i?.[idx] ?? v2;
        i.push(interpolateVec(i1, i2, t));

        const o1 = path1.o?.[idx] ?? v1;
        const o2 = path2.o?.[idx] ?? v2;
        o.push(interpolateVec(o1, o2, t));
    }

    return { v, i: i.length ? i : undefined, o: o.length ? o : undefined, c: path1.c ?? path2.c };
}


/**
 * Remap a number from one range to another.
 *
 * @param {number} value - The input value.
 * @param {number} inMin - Lower bound of the input range.
 * @param {number} inMax - Upper bound of the input range.
 * @param {number} outMin - Lower bound of the output range.
 * @param {number} outMax - Upper bound of the output range.
 * @returns The remapped value.
 */
export function remap(
    value: number,
    inMin: number,
    inMax: number,
    outMin: number,
    outMax: number
): number {
    if (inMax === inMin) return outMin; // avoid divide-by-zero
    const t = (value - inMin) / (inMax - inMin);
    return outMin + t * (outMax - outMin);
}

/**
 * Solves for the parameter t such that the cubic bezier X(t) = x,
 * where the bezier has control point x-coordinates p1x and p2x
 * (endpoints are fixed at x=0 and x=1).
 * Uses Newton-Raphson with bisection fallback.
 */
export function solveCubicBezierX(p1x: number, p2x: number, x: number): number {
    if (x <= 0) return 0;
    if (x >= 1) return 1;

    const cx = 3 * p1x;
    const bx = 3 * (p2x - p1x) - cx;
    const ax = 1 - cx - bx;

    function sampleX(t: number) { return ((ax * t + bx) * t + cx) * t; }
    function sampleDX(t: number) { return (3 * ax * t + 2 * bx) * t + cx; }

    let t2 = x;
    let t0 = 0;
    let t1 = 1;

    for (let i = 0; i < 8; i++) {
        const x2 = sampleX(t2) - x;
        if (Math.abs(x2) < 1e-6) return t2;
        const d2 = sampleDX(t2);
        if (Math.abs(d2) < 1e-6) break;
        t2 -= x2 / d2;
    }

    t2 = x;
    while (t0 < t1) {
        const x2 = sampleX(t2);
        if (Math.abs(x2 - x) < 1e-6) return t2;
        if (x > x2) t0 = t2;
        else t1 = t2;
        t2 = (t1 + t0) / 2;
    }

    return t2;
}

/**
 * Creates a cubic-bezier easing function.
 * @param easing An array of four numbers [x1, y1, x2, y2] defining the bezier curve.
 * @returns A function that takes a progress value (0-1) and returns an eased value.
 */
export function cubicBezier(easing: [number, number, number, number]) {
    const [p1x, p1y, p2x, p2y] = easing;

    const cy = 3 * p1y;
    const by = 3 * (p2y - p1y) - cy;
    const ay = 1 - cy - by;

    function sampleCurveY(t: number) { return ((ay * t + by) * t + cy) * t; }

    return function (x: number) {
        return sampleCurveY(solveCubicBezierX(p1x, p2x, x));
    };
}

type Point2 = [number, number];

function lerp2(a: Point2, b: Point2, t: number): Point2 {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/**
 * Splits a cubic bezier curve at parameter t using De Casteljau's algorithm.
 * Returns the left and right sub-curves as 4-point tuples.
 */
export function subdivideCubicBezier(
    p0: Point2, p1: Point2, p2: Point2, p3: Point2, t: number
): { left: [Point2, Point2, Point2, Point2], right: [Point2, Point2, Point2, Point2] } {
    const q0 = lerp2(p0, p1, t);
    const q1 = lerp2(p1, p2, t);
    const q2 = lerp2(p2, p3, t);
    const r0 = lerp2(q0, q1, t);
    const r1 = lerp2(q1, q2, t);
    const s = lerp2(r0, r1, t);
    return {
        left: [p0, q0, r0, s],
        right: [s, r1, q2, p3]
    };
}

type Easing = [number, number, number, number];

/**
 * Splits a CSS cubic-bezier easing [x1,y1,x2,y2] at a given x-axis fraction.
 * Each half is re-normalized to map [0,0]→[1,1].
 * Returns undefined for either half if the input is undefined (linear) or the split is degenerate.
 */
export function splitEasing(
    easing: Easing | undefined,
    xFraction: number
): { left: Easing | undefined, right: Easing | undefined } {
    if (!easing) return { left: undefined, right: undefined };
    if (xFraction <= 0) return { left: undefined, right: easing };
    if (xFraction >= 1) return { left: easing, right: undefined };

    const [x1, y1, x2, y2] = easing;
    const t = solveCubicBezierX(x1, x2, xFraction);

    const p0: Point2 = [0, 0];
    const p1: Point2 = [x1, y1];
    const p2: Point2 = [x2, y2];
    const p3: Point2 = [1, 1];

    const { left, right } = subdivideCubicBezier(p0, p1, p2, p3, t);

    // Split point coordinates
    const sx = left[3][0];
    const sy = left[3][1];

    let leftEasing: Easing | undefined;
    if (sx > 1e-9 && Math.abs(sy) > 1e-9) {
        leftEasing = [
            left[1][0] / sx, left[1][1] / sy,
            left[2][0] / sx, left[2][1] / sy
        ];
    }

    let rightEasing: Easing | undefined;
    const rx = 1 - sx;
    const ry = 1 - sy;
    if (rx > 1e-9 && Math.abs(ry) > 1e-9) {
        rightEasing = [
            (right[1][0] - sx) / rx, (right[1][1] - sy) / ry,
            (right[2][0] - sx) / rx, (right[2][1] - sy) / ry
        ];
    }

    return { left: leftEasing, right: rightEasing };
}

/**
 * Reverses a cubic-bezier easing for backward playback.
 * [x1,y1,x2,y2] → [1-x2, 1-y2, 1-x1, 1-y1].
 */
export function reverseEasing(easing: Easing | undefined): Easing | undefined {
    if (!easing) return undefined;
    return [1 - easing[2], 1 - easing[3], 1 - easing[0], 1 - easing[1]];
}

/**
 * Converts a color from a [r, g, b, a] array (where values are 0-1) to an rgba() or rgb() CSS string.
 * @param color The color array.
 */
export function toRGBA(color: Array<number>): string {
    const r = Math.round(color[0] * 255);
    const g = Math.round(color[1] * 255);
    const b = Math.round(color[2] * 255);
    return color.length === 4 ?
        'rgba(' + r + ',' + g + ',' + b + ',' + color[3] + ')' :
        'rgb(' + r + ',' + g + ',' + b + ')';
}

/** Parse rgb/rgba string to normalized array */
export function parseRgba(s: string): number[] {
    const inner = s.match(/rgba?\((.*)\)/)?.[1];
    if (!inner) throw new Error('Invalid rgb/rgba format');
    const parts = inner.split(',').map(v => +v.trim());
    return [parts[0] / 255, parts[1] / 255, parts[2] / 255, ...(parts[3] !== undefined ? [parts[3]] : [])];
}

/** Parse hex string to normalized array (#RGB, #RGBA, #RRGGBB, #RRGGBBAA) */
function parseHex(s: string): number[] {
    const hex = s.slice(1); // Remove '#'
    const isShort = hex.length <= 4; // #RGB or #RGBA vs #RRGGBB or #RRGGBBAA

    const r = isShort ? hex[0] + hex[0] : hex.slice(0, 2);
    const g = isShort ? hex[1] + hex[1] : hex.slice(2, 4);
    const b = isShort ? hex[2] + hex[2] : hex.slice(4, 6);
    const a = hex.length === 4 ? hex[3] + hex[3] : hex.length === 8 ? hex.slice(6, 8) : null;

    const result = [
        parseInt(r, 16) / 255,
        parseInt(g, 16) / 255,
        parseInt(b, 16) / 255
    ];

    if (a !== null) {
        result.push(parseInt(a, 16) / 255);
    }

    return result;
}

//// FIXME - support normalisation of config from different formats
/** Parse color string (hex or rgb/rgba) to normalized [r, g, b] or [r, g, b, a] array (0-1 range) */
export function parseColor(s: any): number[] | undefined {
    if (!s) return undefined;
    if (Array.isArray(s)) return s;
    if (typeof s !== 'string') return undefined;
    if (s.startsWith('#')) {
        return parseHex(s);
    } else if (s.startsWith('rgb')) {
        return parseRgba(s);
    } else {
        // FIXME - come up with some solution how to report errors...
        console.warn('Unsupported color format: ' + s);
    }
    return undefined;
}

export const COLOUR_ATTR_NAMES = new Set(["color", "fill", "flood-color", "lighting-color", "stop-color", "stroke"]);
export const TRANSFORM_FN_NAMES = new Set(["translate", "rotate", "scale", "skew"]);
export const PCT_BASED_ATTR_NAMES = new Set(["offset-distance", "offsetDistance"]);

/**
 * Compose a `PxTransformParts` record into a single SVG/CSS transform string in
 * the canonical order:
 *
 *   translate, translate(+origin), rotate, scale, translate(-origin)
 *
 * Each part is omitted when not present. `origin` becomes a `translate(+o)` /
 * `translate(-o)` pair surrounding the rotate/scale segment — the SVG-native
 * way to render a transform-origin pivot.
 *
 * @param parts the parts record (translate / rotate / scale / origin)
 * @param opts.withUnits  when true (default), translates use `px` and rotate
 *   uses `deg` — required for CSS / WebAnimations keyframes. When false, no
 *   units are emitted — required for the SVG `transform` attribute.
 */
export function composeTransformParts(
    parts: PxTransformParts | null | undefined,
    opts?: { withUnits?: boolean }
): string {
    if (!parts) return '';
    const withUnits = opts?.withUnits ?? true;
    const segs: Array<string> = [];
    const t = parts.translate;
    const o = parts.origin;
    const r = parts.rotate;
    const s = parts.scale;
    const tu = withUnits ? 'px' : '';
    const ru = withUnits ? 'deg' : '';
    if (t) segs.push('translate(' + t[0] + tu + ',' + t[1] + tu + ')');
    if (o) segs.push('translate(' + o[0] + tu + ',' + o[1] + tu + ')');
    if (r !== undefined && r !== null) segs.push('rotate(' + r + ru + ')');
    if (s) segs.push('scale(' + s[0] + ',' + s[1] + ')');
    if (o) segs.push('translate(' + (-o[0]) + tu + ',' + (-o[1]) + tu + ')');
    return segs.join('');
}
export const STYLE_ATTR_NAMES = new Set(["offset-distance", "offsetDistance"]); // Props that need to go to style
export const DEFAULT_DURATION_MS = 1000;

/**
 * Converts a kebab-case string to camelCase.
 * @param kebab The kebab-case string.
 */
export function kebabToCamelCaseWord(kebab: string): string {
    return kebab.includes('-') ? kebab.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()) : kebab;
}

/**
 * Checks if a string is in camelCase.
 * @param word The string to check.
 */
export function isCamelCaseWord(word: string): boolean {
    return !word.includes('-') && /[a-z][A-Z]/.test(word);
}

// FIXME - docs, rename?
const SVG_CAMEL_CASE_ATTRS = new Set([
    // Transform/positioning
    'viewBox',
    'preserveAspectRatio',

    // Gradient
    'gradientUnits',
    'gradientTransform',
    'spreadMethod',

    // Pattern
    'patternUnits',
    'patternContentUnits',
    'patternTransform',

    // Clipping/masking
    'clipPathUnits',
    'maskUnits',
    'maskContentUnits',

    // Text
    'textLength',
    'lengthAdjust',
    'startOffset',

    // Filter
    'filterUnits',
    'primitiveUnits',
    'stdDeviation',
    'baseFrequency',
    'numOctaves',
    'surfaceScale',
    'diffuseConstant',
    'specularConstant',
    'specularExponent',
    'kernelMatrix',
    'kernelUnitLength',
    'edgeMode',
    'preserveAlpha',
    'targetX',
    'targetY',

    // // Animation
    // 'attributeName',
    // 'attributeType',
    // 'calcMode',
    // 'keyTimes',
    // 'keySplines',
    // 'repeatCount',
    // 'repeatDur'    
]);

/**
 * Converts a camelCase string to kebab-case.
 * @param camel The camelCase string.
 */
export function camelCaseToKebabWordIfNeeded(camel: string): string { // FIXME - docs, rename function?
    return SVG_CAMEL_CASE_ATTRS.has(camel) ?
        camel :
        camel.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Checks if a CSS property is set inline on an element's style.
 * 
 * @param {!CSSStyleDeclaration} style - element.style (CSSStyleDeclaration)
 * @param {string} propName - property name (camelCase or kebab-case)
 * @return {boolean}
 */
export function hasStyleProp(
    style: CSSStyleDeclaration,
    propName: string
): boolean {
    return style.getPropertyValue(propName) !== '';
}

/**
 * Clamps a number between a minimum and maximum value.
 * @param value The number to clamp.
 * @param min The minimum value.
 * @param max The maximum value.
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, max));
}


// ============================================================================
// 2D CUBIC BÉZIER PRIMITIVES — motion-along-path support
// ============================================================================
//
// Hand-written, dependency-free 2D Bézier maths used by the motion-along-path
// playback paths (both WAAPI normalisation and frames-mode direct compute).
// See `fix-motion-along-path--fix-plan.md` for the wider plan.
//
// Conventions:
//   - Points are `[x, y]` tuples (`Point2`) — matches the wire format.
//   - A cubic segment is `(P0, P1, P2, P3)` where `P0` and `P3` are the
//     endpoints and `P1`, `P2` are the control points in ABSOLUTE coordinates.
//   - Editor's tangent storage convention (Lottie-style) is `kf.to` =
//     outgoing-from-kf-as-a-delta, `kf.ti` = incoming-at-the-next-kf-as-a-delta.
//     The wire format re-attaches them to the natural endpoints as
//     `tangentOut` on the FROM keyframe and `tangentIn` on the TO keyframe.
//     Caller is responsible for the position-to-control-point lift, i.e.
//     `P1 = fromKf.value + fromKf.tangentOut`, `P2 = toKf.value + toKf.tangentIn`.


/**
 * Evaluate a 2D cubic Bézier at parameter `t ∈ [0, 1]` via Bernstein form:
 *
 *   B(t) = (1-t)³ P0 + 3t(1-t)² P1 + 3t²(1-t) P2 + t³ P3
 *
 * `t` is the curve PARAMETER, not arc-length. For arc-length (CSS Motion Path
 * / `offset-distance`) semantics, use `bezier2D_tForDistance` first to convert
 * a distance to its parameter, then call this. Out-of-range `t` is clamped.
 */
export function bezier2D_pointAt(
    P0: Point2, P1: Point2, P2: Point2, P3: Point2,
    t: number
): Point2 {
    if (t <= 0) return [P0[0], P0[1]];
    if (t >= 1) return [P3[0], P3[1]];
    const u = 1 - t;
    const u2 = u * u;
    const u3 = u2 * u;
    const t2 = t * t;
    const t3 = t2 * t;
    const w0 = u3;
    const w1 = 3 * t  * u2;
    const w2 = 3 * t2 * u;
    const w3 = t3;
    return [
        w0 * P0[0] + w1 * P1[0] + w2 * P2[0] + w3 * P3[0],
        w0 * P0[1] + w1 * P1[1] + w2 * P2[1] + w3 * P3[1],
    ];
}


/**
 * Evaluate the derivative `B'(t)` of a 2D cubic Bézier at parameter `t`.
 *
 *   B'(t) = 3(1-t)² (P1-P0) + 6t(1-t) (P2-P1) + 3t² (P3-P2)
 *
 * Returns the tangent VECTOR (not a unit vector). For auto-orient rotation,
 * caller computes `Math.atan2(d.y, d.x)`.
 *
 * Epsilon-nudge for degenerate endpoints: when a handle coincides with its
 * endpoint (e.g. `P1 === P0` and `t === 0`, common for the start/end of a
 * Lottie spatial-tangent path), the derivative collapses to zero. The
 * exact-endpoint value is then meaningless; we nudge `t` inward by `1e-4`
 * and retry. This mirrors the editor's `BezierExtra.derivative` workaround.
 */
const BEZIER_T_NUDGE = 1e-4;
export function bezier2D_derivativeAt(
    P0: Point2, P1: Point2, P2: Point2, P3: Point2,
    t: number
): Point2 {
    const result = _bezier2D_derivativeAtRaw(P0, P1, P2, P3, t);
    if (result[0] === 0 && result[1] === 0) {
        // Degenerate (handle = endpoint). Nudge inward and retry.
        const nudgedT = t < 0.5 ? t + BEZIER_T_NUDGE : t - BEZIER_T_NUDGE;
        return _bezier2D_derivativeAtRaw(P0, P1, P2, P3, nudgedT);
    }
    return result;
}

function _bezier2D_derivativeAtRaw(
    P0: Point2, P1: Point2, P2: Point2, P3: Point2,
    t: number
): Point2 {
    const u = 1 - t;
    const a = 3 * u * u;
    const b = 6 * t * u;
    const c = 3 * t * t;
    return [
        a * (P1[0] - P0[0]) + b * (P2[0] - P1[0]) + c * (P3[0] - P2[0]),
        a * (P1[1] - P0[1]) + b * (P2[1] - P1[1]) + c * (P3[1] - P2[1]),
    ];
}


/**
 * Arc-length lookup table for a 2D cubic Bézier.
 *
 * Samples the curve at `steps + 1` evenly-spaced parameter values
 * (`t = 0, 1/steps, 2/steps, …, 1`), computes the cumulative Euclidean
 * distance between consecutive samples, and returns parallel
 * `Float64Array`s for parameter (`ts`) and arc length (`ds`). `ds[steps]`
 * is the total arc length of the curve.
 *
 * The LUT shape is `{ts, ds}` with parallel Float64Arrays rather than
 * `Array<{t, d}>` because:
 *  - One contiguous allocation per array instead of `steps+1` objects.
 *  - Binary search in `bezier2D_tForDistance` reads `Float64Array` directly.
 *  - The structure is read-only after construction — no need for per-sample
 *    field access.
 *
 * Approximation error is roughly `O((1/steps)²)` for smooth curves; the
 * default 100 samples gives <1% error vs analytic arc length on typical
 * motion paths and matches the editor's `BezierExtra.getDLut` step count.
 */
export interface ArcLengthLUT {
    readonly ts: Float64Array;
    readonly ds: Float64Array;
}

export function bezier2D_arcLengthLUT(
    P0: Point2, P1: Point2, P2: Point2, P3: Point2,
    steps: number = 100
): ArcLengthLUT {
    const n = steps + 1;
    const ts = new Float64Array(n);
    const ds = new Float64Array(n);

    let prev = bezier2D_pointAt(P0, P1, P2, P3, 0);
    ts[0] = 0;
    ds[0] = 0;

    let cum = 0;
    for (let i = 1; i < n; i++) {
        const t = i / steps;
        const cur = bezier2D_pointAt(P0, P1, P2, P3, t);
        const dx = cur[0] - prev[0];
        const dy = cur[1] - prev[1];
        cum += Math.sqrt(dx * dx + dy * dy);
        ts[i] = t;
        ds[i] = cum;
        prev = cur;
    }
    return { ts, ds };
}


/**
 * Inverse of `bezier2D_arcLengthLUT` lookup: given a distance along the
 * curve, return the curve parameter `t` reached at that distance via
 * binary search on `lut.ds` + linear interpolation between adjacent
 * samples.
 *
 * Distance is clamped to `[0, lut.ds[last]]`. The returned `t` is in
 * `[0, 1]`. Pair with `bezier2D_pointAt` to get the point at that
 * arc-length distance:
 *
 *   const t = bezier2D_tForDistance(lut, distance);
 *   const point = bezier2D_pointAt(P0, P1, P2, P3, t);
 */
export function bezier2D_tForDistance(lut: ArcLengthLUT, distance: number): number {
    const { ts, ds } = lut;
    const last = ds.length - 1;
    if (distance <= 0)        return ts[0];
    if (distance >= ds[last]) return ts[last];

    // Binary search for the upper-bound index `hi` such that ds[hi-1] <= distance < ds[hi].
    let lo = 1;
    let hi = last;
    while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (ds[mid] < distance) lo = mid + 1;
        else                    hi = mid;
    }
    // Linear interpolate between the bracketing samples.
    const dPrev = ds[hi - 1];
    const dCur  = ds[hi];
    const span  = dCur - dPrev;
    const frac  = span > 0 ? (distance - dPrev) / span : 0;
    return ts[hi - 1] + frac * (ts[hi] - ts[hi - 1]);
}


/**
 * `bezier2D_tForDistance` convenience taking a fraction of the total arc
 * length instead of an absolute distance. `pct` is in `[0, 1]` (CSS Motion
 * Path `offset-distance` semantics — `offset-distance: 50%` ≡
 * `bezier2D_tForDistancePct(lut, 0.5)`). Out-of-range values clamp.
 */
export function bezier2D_tForDistancePct(lut: ArcLengthLUT, pct: number): number {
    const total = lut.ds[lut.ds.length - 1];
    return bezier2D_tForDistance(lut, pct * total);
}