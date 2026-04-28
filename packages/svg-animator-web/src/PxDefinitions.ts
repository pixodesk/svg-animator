/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import {
    getAnimatorConfig,
    getBindings,
    getDefs,
    type PxAnimatedSvgDocument,
    type PxAnimationDefinition,
    type PxBezierPath,
    type PxBinding,
    type PxDefs,
    type PxElementAnimation,
    type PxKeyframe,
    type PxLoop,
    type PxNode,
    type PxPropertyAnimation
} from './PxAnimatorTypes';
import { bezierToSvgPath, camelCaseToKebabWordIfNeeded, clamp, COLOUR_ATTR_NAMES, cubicBezier, interpolateBeziers, interpolateColor, interpolateNum, interpolateVec, isCamelCaseWord, parseColor, PCT_BASED_ATTR_NAMES, remap, reverseEasing, splitEasing, toRGBA, TRANSFORM_FN_NAMES } from './PxAnimatorUtil';


// ============================================================================
// PATH PARSING: Convert "path(...)" strings to PxBezierPath format
// ============================================================================

interface PathCommand {
    type: string;
    values: Array<number>;
}

/**
 * Parses an SVG path string into command tokens.
 * Supports M, L, C, Z commands (case-insensitive).
 */
function parsePathCommands(d: string): Array<PathCommand> {
    const tokens = d.split(/([MLCZmlcz]|[\s,]+)/).map(t => t.trim()).filter(t => t && t !== ',');

    const commands: Array<PathCommand> = [];
    let currentCommand: PathCommand | null = null;

    for (const token of tokens) {
        if (/[MLCZmlcz]/.test(token)) {
            currentCommand = { type: token, values: [] };
            commands.push(currentCommand);
        } else if (currentCommand) {
            const value = +token;
            currentCommand.values.push(Number.isNaN(value) ? 0 : value);
        }
    }

    return commands;
}

/**
 * Parses an internal SVG path string into PxBezierPath array.
 * Handles M (moveto), L (lineto), C (curveto), Z (close) commands.
 */
function parseSvgPathToBezier(d: string): Array<PxBezierPath> {
    const res: Array<PxBezierPath> = [];
    let currentPath: PxBezierPath | undefined;

    const commands = parsePathCommands(d);

    for (const command of commands) {
        const type = command.type;
        const values = command.values;

        if (type === 'M' || type === 'm') {
            const x = values[0] || 0;
            const y = values[1] || 0;
            currentPath = {
                v: [[x, y]],
                i: [[x, y]],
                o: [[x, y]],
                c: false
            };
            res.push(currentPath);
            continue;
        }

        // Ensure we have a current path
        if (!currentPath) {
            currentPath = {
                v: [[0, 0]],
                i: [[0, 0]],
                o: [[0, 0]],
                c: false
            };
            res.push(currentPath);
        }

        if (type === 'L') {
            const x = values[0] || 0;
            const y = values[1] || 0;
            currentPath.v.push([x, y]);
            currentPath.i!.push([x, y]);
            currentPath.o!.push([x, y]);

        } else if (type === 'C') {
            const outX = values[0] || 0;
            const outY = values[1] || 0;
            const inX2 = values[2] || 0;
            const inY2 = values[3] || 0;
            const x2 = values[4] || 0;
            const y2 = values[5] || 0;

            // Update out-point of previous vertex
            currentPath.o![currentPath.o!.length - 1] = [outX, outY];

            // Add new vertex with its in-point
            currentPath.v.push([x2, y2]);
            currentPath.i!.push([inX2, inY2]);
            currentPath.o!.push([x2, y2]);

        } else if (type === 'Z' || type === 'z') {
            currentPath.c = true;

        } else {
            console.warn('Unsupported path command "' + type + '"');
        }
    }

    return res;
}

/**
 * Extracts SVG path data from a string.
 * Handles both "path(M...)" wrapper format and raw "M..." format.
 * @returns The path data string, or undefined if not a valid path string
 */
function extractPathData(str: string): string | undefined {
    if (str.startsWith('path(') && str.endsWith(')')) {
        return str.slice(5, -1); // Remove "path(" and ")"
    }
    // Raw path string starting with a path command (M, m, or other commands)
    if (/^[MmZzLlHhVvCcSsQqTtAa]/.test(str)) {
        return str;
    }
    return undefined;
}

/**
 * Checks if the value is a path string (either "path(...)" or raw "M...").
 */
function isPathString(value: any): value is string {
    return typeof value === 'string' && extractPathData(value) !== undefined;
}

/**
 * Normalizes a 'd' attribute value to { paths: PxBezierPath[] } format.
 * Handles:
 * - { paths: ["path(...)"] } -> { paths: [PxBezierPath] }
 * - { paths: ["M..."] } -> { paths: [PxBezierPath] }
 * - ["path(...)"] -> { paths: [PxBezierPath] }
 * - ["M..."] -> { paths: [PxBezierPath] }
 * - "path(...)" -> { paths: [PxBezierPath] }
 * - "M..." -> { paths: [PxBezierPath] }
 * - { paths: [PxBezierPath] } -> as-is
 */
function normalizePathValue(value: any): { paths: Array<PxBezierPath> } | any {
    // If already in { paths: [...] } format
    if (value && typeof value === 'object' && 'paths' in value) {
        const pathsArray = value.paths;
        if (Array.isArray(pathsArray) && pathsArray.length > 0) {
            // Check if paths contain path strings that need parsing
            if (isPathString(pathsArray[0])) {
                const paths: Array<PxBezierPath> = [];
                for (const pathStr of pathsArray) {
                    const d = extractPathData(pathStr);
                    if (d) {
                        paths.push(...parseSvgPathToBezier(d));
                    }
                }
                return { paths };
            }
        }
        // Already in correct format
        return value;
    }

    // If it's an array of path strings
    if (Array.isArray(value)) {
        if (value.length > 0 && isPathString(value[0])) {
            const paths: Array<PxBezierPath> = [];
            for (const pathStr of value) {
                const d = extractPathData(pathStr);
                if (d) {
                    paths.push(...parseSvgPathToBezier(d));
                }
            }
            return { paths };
        }
        // Already an array of PxBezierPath - wrap in { paths: }
        return { paths: value };
    }

    // If it's a single path string
    if (isPathString(value)) {
        const d = extractPathData(value)!;
        return { paths: parseSvgPathToBezier(d) };
    }

    return value;
}


// ============================================================================
// NORMALIZATION: Convert new API format to internal normalized format
// ============================================================================

/**
 * Resolves an easing reference to a cubic-bezier array.
 * @param easing The easing reference (string name or bezier array)
 * @param defs The definitions containing named easings
 * @returns The resolved cubic-bezier array or undefined
 */
function resolveEasing(
    easing: string | [number, number, number, number] | undefined,
    defs?: PxDefs
): [number, number, number, number] | undefined {
    if (!easing) return undefined;

    if (Array.isArray(easing)) {
        return easing;
    }

    // Look up named easing in defs
    if (defs?.easings?.[easing]) {
        return defs.easings[easing];
    }

    // Unknown easing name - return undefined
    console.warn('Unknown easing name: ' + easing);
    return undefined;
}

/**
 * Resolves an animation reference to an AnimationDefinition.
 * @param animRef The animation reference (string name or inline definition)
 * @param defs The definitions containing named animations
 * @returns The resolved animation definition
 */
function resolveAnimation(
    animRef: string | PxAnimationDefinition,
    defs?: PxDefs
): PxAnimationDefinition | undefined {
    if (typeof animRef === 'string') {
        // Look up named animation in defs
        const resolved = defs?.animations?.[animRef];
        if (!resolved) {
            console.warn('Unknown animation name: ' + animRef);
        }
        return resolved;
    }

    // It's an inline definition
    return animRef;
}

/**
 * Resolves an element animation (which can be string, array, or inline) to an array of AnimationDefinitions.
 * @param animate The element animation specification
 * @param defs The definitions containing named animations
 * @returns Array of resolved animation definitions
 */
function resolveElementAnimation(
    animate: PxElementAnimation | undefined,
    defs?: PxDefs
): PxAnimationDefinition[] {
    if (!animate) return [];

    const results: PxAnimationDefinition[] = [];

    if (typeof animate === 'string') {
        const resolved = resolveAnimation(animate, defs);
        if (resolved) results.push(resolved);
    } else if (Array.isArray(animate)) {
        for (const item of animate) {
            const resolved = resolveAnimation(item, defs);
            if (resolved) results.push(resolved);
        }
    } else {
        // It's an inline AnimationDefinition
        results.push(animate);
    }

    return results;
}

// ============================================================================
// LOOP EXPANSION: Duplicate keyframe segments to fill gaps in the timeline
// ============================================================================

/**
 * Interpolates between two keyframe values based on property type.
 * Returns the raw interpolated value (not a CSS string).
 */
export function interpolateValue(propName: string, a: any, b: any, t: number): any {
    if (propName === 'd') {
        const aPaths = a?.paths ?? (Array.isArray(a) ? a : []);
        const bPaths = b?.paths ?? (Array.isArray(b) ? b : []);
        return { paths: interpolateBeziers(aPaths, bPaths, t) };
    }
    if (COLOUR_ATTR_NAMES.has(propName)) {
        return interpolateColor(a || [0, 0, 0, 1], b || [0, 0, 0, 1], t);
    }
    if (TRANSFORM_FN_NAMES.has(propName) || propName === 'stroke-dasharray' || propName === 'strokeDasharray') {
        return interpolateVec(a || [], b || [], t);
    }
    return interpolateNum(+(a || 0), +(b || 0), t);
}

interface LoopTemplateEntry {
    relT: number; // 0..1 relative position within segment
    v: any;
    e: [number, number, number, number] | undefined;
}

/**
 * Expands keyframes by repeating a segment to fill the gap between the keyframe
 * range and the global animation duration, implementing PxLoop "local loop" behavior.
 */
function expandLoopKeyframes(
    propName: string,
    keyframes: PxKeyframe[],
    loop: PxLoop,
    duration: number
): PxKeyframe[] {
    const totalIntervals = keyframes.length - 1;
    const segCount = clamp(loop.segmentCount ?? totalIntervals, 1, totalIntervals);

    // Extract segment keyframes
    let segKfs: PxKeyframe[];
    if (loop.before) {
        segKfs = keyframes.slice(0, segCount + 1);
    } else {
        segKfs = keyframes.slice(totalIntervals - segCount);
    }

    // Determine fill region
    const firstT = keyframes[0].t ?? 0;
    const lastT = keyframes[keyframes.length - 1].t ?? 0;

    let fillStart: number, fillEnd: number;
    if (loop.before) {
        fillStart = 0;
        fillEnd = firstT;
    } else {
        fillStart = lastT;
        fillEnd = duration;
    }

    const fillDuration = fillEnd - fillStart;
    if (fillDuration <= 0) return keyframes;

    // Segment timing
    const segStartT = segKfs[0].t ?? 0;
    const segEndT = segKfs[segKfs.length - 1].t ?? 0;
    const segDuration = segEndT - segStartT;
    if (segDuration <= 0) return keyframes;

    // Build template with relative offsets (0..1)
    const template: LoopTemplateEntry[] = segKfs.map(kf => ({
        relT: (kf.t! - segStartT) / segDuration,
        v: kf.v,
        e: kf.e as [number, number, number, number] | undefined
    }));

    const fullReps = Math.floor(fillDuration / segDuration);
    const remainder = fillDuration - fullReps * segDuration;
    const partialFraction = remainder / segDuration;

    const looped: PxKeyframe[] = [];

    // Helper: append one full or partial repetition
    function appendRep(repStart: number, isReversed: boolean, partial?: number) {
        let entries: LoopTemplateEntry[];
        if (isReversed) {
            // Reverse keyframe order and reverse easings
            entries = [];
            for (let i = template.length - 1; i >= 0; i--) {
                entries.push({
                    relT: 1 - template[i].relT,
                    v: template[i].v,
                    // Easing for reversed transition: use reversed easing from the forward "from" keyframe
                    e: i > 0 ? reverseEasing(template[i - 1].e) : undefined
                });
            }
        } else {
            entries = template;
        }

        const cutRelT = partial !== undefined ? partial : 1;

        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            if (entry.relT > cutRelT + 1e-9) {
                // Past the cut point — insert interpolated keyframe
                const prev = entries[i - 1];
                const intervalSpan = entry.relT - prev.relT;
                const localFrac = (cutRelT - prev.relT) / intervalSpan;

                // Apply easing to get the eased progress for value interpolation
                const easedFrac = prev.e ? cubicBezier(prev.e)(localFrac) : localFrac;
                const cutValue = interpolateValue(propName, prev.v, entry.v, easedFrac);

                // Split easing — use left portion for the truncated interval
                const { left: leftEasing } = splitEasing(prev.e, localFrac);

                // Update previous keyframe's easing to the left portion
                if (looped.length > 0 && prev.relT <= cutRelT) {
                    looped[looped.length - 1].e = leftEasing;
                }

                looped.push({ t: repStart + cutRelT * segDuration, v: cutValue, e: undefined });
                return;
            }

            looped.push({
                t: repStart + entry.relT * segDuration,
                v: entry.v,
                e: i < entries.length - 1 ? entry.e : undefined
            });
        }
    }

    // Generate repetitions.
    // The rep closest to the original keyframes boundary must be reversed first
    // in pingpong mode (the animation just finished going forward, so the next
    // iteration goes backward). For loopOut, rep 0 is closest; for loopIn, reps
    // are laid out left-to-right so the last rep is closest.
    for (let rep = 0; rep < fullReps; rep++) {
        const distFromBoundary = loop.before ? fullReps - 1 - rep : rep;
        const isReversed = !!loop.alternate && (distFromBoundary % 2 === 0);
        const repStart = fillStart + rep * segDuration;
        appendRep(repStart, isReversed);
    }

    // Partial repetition
    if (partialFraction > 1e-9) {
        const isReversed = !!loop.alternate && (fullReps % 2 === 0);
        const repStart = fillStart + fullReps * segDuration;
        appendRep(repStart, isReversed, partialFraction);
    }   

    // Assemble: looped keyframes go before or after the original keyframes.
    // No junction deduplication — cycle mode relies on value jumps at boundaries.
    if (loop.before) {
        return [...looped, ...keyframes];
    } else {
        return [...keyframes, ...looped];
    }
}


// ============================================================================
// KEYFRAME NORMALIZATION
// ============================================================================

/**
 * Normalizes keyframes from the new API format (time in ms) to internal format (time as 0-1 fraction).
 * Resolves easing references, normalizes times, and converts path strings for 'd' attribute.
 * If a loop configuration is present, expands the keyframes to fill the global duration.
 * @param propName The property name (e.g., 'd' for path)
 * @param propAnim The property animation with keyframes
 * @param duration The total animation duration in ms
 * @param defs The definitions containing named easings
 * @returns Array of normalized keyframes (same structure, resolved refs, normalized times)
 */
function normalizeKeyframes(
    propName: string,
    propAnim: PxPropertyAnimation,
    duration: number,
    defs?: PxDefs
): PxKeyframe[] {
    const keyframes = propAnim.keyframes || propAnim.kfs || [];

    const normalized: PxKeyframe[] = [];

    for (const kf of keyframes) {
        const timePct = kf.time ?? kf.t ?? 0;
        let value = kf.value ?? kf.v;
        const easing = kf.easing ?? kf.e;

        // Normalize path values for 'd' attribute
        if (propName === 'd') {
            value = normalizePathValue(value);
        }

        // Normalize color values (hex/rgb/rgba strings to [0-1] vectors)
        if (COLOUR_ATTR_NAMES.has(propName)) {
            value = parseColor(value) ?? value;
        }

        normalized.push({
            t: timePct,
            v: value,
            e: resolveEasing(easing, defs)
        });
    }

    // Sort by time
    normalized.sort((a, b) => (a.t ?? 0) - (b.t ?? 0));

    // Expand loop if configured (loop:true is shorthand for default PxLoop)
    const loopRaw = propAnim.loop;
    const loop: PxLoop | undefined = loopRaw === true ? {} : loopRaw || undefined;
    if (loop && normalized.length >= 2) {
        return expandLoopKeyframes(propName, normalized, loop, duration);
    }

    return normalized;
}

/**
 * Merges multiple animation definitions into a single combined definition.
 * Later definitions override earlier ones for the same property.
 */
function mergeAnimationDefinitions(
    animations: PxAnimationDefinition[]
): PxAnimationDefinition {
    const merged: PxAnimationDefinition = {};

    for (const anim of animations) {
        for (const [prop, propAnim] of Object.entries(anim)) {
            merged[prop] = propAnim;
        }
    }

    return merged;
}

/**
 * Generates a unique element ID for internal tracking during DOM rendering.
 */
let _elementIdCounter = 0;
export function generateElementId(): string {
    return '_px_el_' + (++_elementIdCounter);
}

/**
 * Resets the element ID counter (useful for testing).
 */
export function resetElementIdCounter(): void {
    _elementIdCounter = 0;
}

/**
 * Normalizes an animation definition by resolving easing references and normalizing keyframe times.
 * Keeps the key/value mapping structure.
 */
function normalizeAnimationDefinition(
    animDef: PxAnimationDefinition,
    duration: number,
    defs?: PxDefs
): PxAnimationDefinition {
    const normalized: PxAnimationDefinition = {};

    for (const [propName, propAnim] of Object.entries(animDef)) {
        const normalizedKfs = normalizeKeyframes(propName, propAnim, duration, defs);
        if (normalizedKfs.length > 0) {
            normalized[propName] = { kfs: normalizedKfs };
        }
    }

    return normalized;
}

/**
 * Normalizes a PxAnimatedSvgDocument to a PxAnimatorConfig for the animation engines.
 * This is the main entry point for converting the new API format to internal format.
 * Resolves animation/easing references.
 */
export function getNormalisedBindings(doc: PxAnimatedSvgDocument): PxBinding[] {
    const animatorConfig = getAnimatorConfig(doc) || {};
    const defs = getDefs(doc);
    const duration = animatorConfig.duration || 1000; // FIXME - get rid of 1000 here

    const bindings: PxBinding[] = [];

    // Helper to resolve and normalize animation for a binding
    const processAnimation = (
        id: string,
        animate: PxElementAnimation | undefined
    ): PxBinding | null => {
        if (!animate) return null;

        const animDefs = resolveElementAnimation(animate, defs);
        if (animDefs.length === 0) return null;

        const merged = mergeAnimationDefinitions(animDefs);
        const normalizedAnim = normalizeAnimationDefinition(merged, duration, defs);

        if (Object.keys(normalizedAnim).length === 0) return null;

        return {
            id,
            animate: normalizedAnim
        };
    };

    // Process bindings (for pre-rendered DOM)
    const docBindings = getBindings(doc);
    if (docBindings) {
        for (const binding of docBindings) {
            const normalized = processAnimation(binding.id, binding.animate);
            if (normalized) bindings.push(normalized);
        }
    }

    // Process children (for rendered DOM)
    const processNode = (node: PxNode) => {
        // Generate a selector for this node based on id
        if (node.animate) {
            const nodeId = node.id || generateElementId(); // FIXME - make sure that it wasn't in the config already
            node.id = nodeId; // Ensure the node has an ID
            const normalized = processAnimation(nodeId, node.animate);
            if (normalized) bindings.push(normalized);
        }

        // Process children
        if (node.children) {
            for (let i = 0; i < node.children.length; i++) {
                processNode(node.children[i]);
            }
        }
    };

    // Process children of the root
    if (doc.children) {
        for (let i = 0; i < doc.children.length; i++) {
            processNode(doc.children[i]);
        }
    }

    return bindings;
}


// ============================================================================
// ATTRIBUTE VALUE CALCULATION (used by frame loop animator)
// ============================================================================

/**
 * Finds prev/next keyframes for a given progress.
 */
function getKeyframesPair(keyframes: PxKeyframe[], progress: number) {
    let prevKf = keyframes[0];
    let nextKf = keyframes[keyframes.length - 1];

    for (let j = 0; j < keyframes.length - 1; j++) {
        const aOff = (keyframes[j].t ?? 0);
        const bOff = (keyframes[j + 1].t ?? 0);
        if (aOff <= progress && progress <= bOff) {
            prevKf = keyframes[j];
            nextKf = keyframes[j + 1];
            break;
        }
    }
    return { prevKf, nextKf };
}

/**
 * Calculates interpolated value for a single property animation.
 */
function calcPropertyValue(
    propName: string,
    propAnim: PxPropertyAnimation,
    progress: number
): { k: string, v: string } | null {
    const keyframes = propAnim.kfs || propAnim.keyframes || [];
    if (keyframes.length === 0) return null;

    const { prevKf, nextKf } = getKeyframesPair(keyframes, progress);

    // remap to local 0..1 within prevKf..nextKf
    let localProgress = (prevKf === nextKf) ? 0 : remap(progress, prevKf.t ?? 0, nextKf.t ?? 0, 0, 1);
    localProgress = clamp(localProgress, 0, 1);
    const easing = prevKf.e ?? prevKf.easing; // e is on the source keyframe: applied from this KF to the next
    if (easing && Array.isArray(easing)) {
        try {
            localProgress = cubicBezier(easing as [number, number, number, number])(localProgress);
        } catch (e) {
            // fallback: ignore easing if parsing fails
        }
    }

    let cssAttrName = isCamelCaseWord(propName) ? camelCaseToKebabWordIfNeeded(propName) : propName;
    let cssValue: string | number | null = null;

    const prevV = prevKf?.v ?? prevKf?.value;
    const nextV = nextKf?.v ?? nextKf?.value;

    if (cssAttrName === 'd') {
        // Extract paths from { paths: [...] } format
        const prevPaths = prevV?.paths ?? (Array.isArray(prevV) ? prevV : []);
        const nextPaths = nextV?.paths ?? (Array.isArray(nextV) ? nextV : []);
        cssValue = interpolateBeziers(
            prevPaths,
            nextPaths,
            localProgress
        ).map(bz => bezierToSvgPath(bz)).join('');
    } else if (COLOUR_ATTR_NAMES.has(cssAttrName)) {
        cssValue = toRGBA(interpolateColor(
            prevV || [0, 0, 0, 1],
            nextV || [0, 0, 0, 1],
            localProgress
        ));
        cssAttrName = propName;
    } else if (cssAttrName === 'stroke-dasharray') {
        cssValue = interpolateVec(
            prevV || [],
            nextV || [],
            localProgress
        ).join(' ');
        cssAttrName = propName;
    } else if (cssAttrName === 'translate') {
        const v = interpolateVec(
            prevV || [0, 0],
            nextV || [0, 0],
            localProgress
        );
        cssValue = 'translate(' + v.join(',') + ')';
        cssAttrName = 'transform';
    } else if (cssAttrName === 'rotate') {
        const v = interpolateNum(
            +(prevV || 0),
            +(nextV || 0),
            localProgress
        );
        cssValue = 'rotate(' + v + ')';
        cssAttrName = 'transform';
    } else if (cssAttrName === 'scale') {
        const v = interpolateVec(
            prevV || [1, 1],
            nextV || [1, 1],
            localProgress
        );
        cssValue = 'scale(' + v.join(',') + ')';
        cssAttrName = 'transform';
    } else {
        // numeric attr
        const num = interpolateNum(
            +(prevV || 0),
            +(nextV || 0),
            localProgress
        );
        cssValue = num;
    }

    if (PCT_BASED_ATTR_NAMES.has(cssAttrName) && typeof cssValue === 'number') {
        cssValue = (cssValue * 100) + '%';
    }

    return { k: cssAttrName, v: cssValue === null ? '' : '' + cssValue };
}

/**
 * Calculates interpolated attribute values for an animation definition.
 * @param animDef The animation definition (with resolved refs and normalized times)
 * @param progress The current animation progress (0-1)
 * @returns Object with computed attribute name/value pairs
 */
export function calcAnimationValues(
    animDef: PxAnimationDefinition,
    progress: number
): Record<string, string> {
    const result: Record<string, string> = {};

    for (const [propName, propAnim] of Object.entries(animDef)) {        
        const computed = calcPropertyValue(propName, propAnim, progress);
        if (computed) {
            result[computed.k] = computed.v;
        }
    }

    return result;
}
