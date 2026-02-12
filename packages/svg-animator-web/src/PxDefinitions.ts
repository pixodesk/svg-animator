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
    type PxNode,
    type PxPropertyAnimation
} from './PxAnimatorTypes';
import { bezierToSvgPath, camelCaseToKebabWordIfNeeded, clamp, COLOUR_ATTR_NAMES, cubicBezier, interpolateBeziers, interpolateColor, interpolateNum, interpolateVec, isCamelCaseWord, parseColor, PCT_BASED_ATTR_NAMES, remap, toRGBA } from './PxAnimatorUtil';


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

/**
 * Normalizes keyframes from the new API format (time in ms) to internal format (time as 0-1 fraction).
 * Resolves easing references, normalizes times, and converts path strings for 'd' attribute.
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
    const easing = prevKf.e ?? prevKf.easing;
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
