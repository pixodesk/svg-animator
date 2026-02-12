/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { PxBezierPath } from './PxAnimatorTypes';


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
 * Creates a cubic-bezier easing function.
 * @param easing An array of four numbers [x1, y1, x2, y2] defining the bezier curve.
 * @returns A function that takes a progress value (0-1) and returns an eased value.
 */
export function cubicBezier(easing: [number, number, number, number]) {
    const [p1x, p1y, p2x, p2y] = easing;

    const cx = 3 * p1x;
    const bx = 3 * (p2x - p1x) - cx;
    const ax = 1 - cx - bx;
    const cy = 3 * p1y;
    const by = 3 * (p2y - p1y) - cy;
    const ay = 1 - cy - by;

    function sampleCurveX(t: number) { return ((ax * t + bx) * t + cx) * t; }
    function sampleCurveY(t: number) { return ((ay * t + by) * t + cy) * t; }
    function sampleCurveDerivativeX(t: number) { return (3 * ax * t + 2 * bx) * t + cx; }

    function solveCurveX(x: number) {
        // Handle edge cases
        if (x <= 0) return 0;
        if (x >= 1) return 1;

        // Use binary search as fallback when derivative is too small
        let t2 = x;
        let t0 = 0;
        let t1 = 1;

        // Try Newton-Raphson first
        for (let i = 0; i < 8; i++) {
            const x2 = sampleCurveX(t2) - x;
            if (Math.abs(x2) < 1e-6) return t2;

            const d2 = sampleCurveDerivativeX(t2);
            if (Math.abs(d2) < 1e-6) break; // Derivative too small, switch to bisection

            t2 -= x2 / d2;
        }

        // Fallback to binary search, e.g. solves such easings as [0, 0, 0, 1]
        t2 = x;
        while (t0 < t1) {
            const x2 = sampleCurveX(t2);
            if (Math.abs(x2 - x) < 1e-6) return t2;
            if (x > x2) t0 = t2;
            else t1 = t2;
            t2 = (t1 + t0) / 2;
        }

        return t2;
    }

    return function (x: number) {
        return sampleCurveY(solveCurveX(x));
    };
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

    // Animation
    'attributeName',
    'attributeType',
    'calcMode',
    'keyTimes',
    'keySplines',
    'repeatCount',
    'repeatDur',

    // Presentation (when used as attributes)
    'clipPath',
    'fillOpacity',
    'strokeOpacity',
    'strokeWidth',
    'strokeLinecap',
    'strokeLinejoin',
    'strokeMiterlimit',
    'strokeDasharray',
    'strokeDashoffset',
    'fontFamily',
    'fontSize',
    'fontStyle',
    'fontVariant',
    'fontWeight',
    'textAnchor',
    'textDecoration'
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