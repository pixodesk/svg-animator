/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { renderNode } from './PxAnimatorDOM';
import { createFrameLoopAnimator } from './PxAnimatorFrameLoop';
import { setupAnimationTriggers } from './PxAnimatorTriggers';
import { getAnimatorConfig, isPxElementFileFormat, PX_ANIM_ATTR_NAME, PX_ANIM_SRC_ATTR_NAME, type PxAnimatedSvgDocument, type PxAnimatorAPI, type PxAnimatorCallbacksConfig } from './PxAnimatorTypes';
import { createWebApiAnimator } from './PxAnimatorWebApi';


/**
 * Creates an animator instance from a normalized player config.
 * This is the internal implementation that both engines use.
 */
function createAnimatorFromConfig(
    doc: PxAnimatedSvgDocument,
    callbacks?: PxAnimatorCallbacksConfig,
    rootElement?: Element | null
): PxAnimatorAPI {

    const animatorConfig = getAnimatorConfig(doc) || {};

    let res: PxAnimatorAPI;
    if (animatorConfig.mode === 'frames') {
        // Forcing "frames", even if "webapi" can be used
        res = createFrameLoopAnimator(doc, callbacks, rootElement);
    } else {
        // Trying "webapi" first
        res = (
            createWebApiAnimator(doc, callbacks, rootElement,
                animatorConfig.mode === 'webapi' // Forcing "webapi"
            ) ||
            createFrameLoopAnimator(doc, callbacks, rootElement) // "webapi" has unsupported attrs and wasn't forced, returned null, fallback to "frames"
        );
    }

    if (animatorConfig.debugInstName) {
        (window as any)[animatorConfig.debugInstName] = res; // Exposing as global variable for debug
    }

    return res;
}


/**
 * Generates a unique ID with a random suffix.
 * Format: _px_{random base36 string}
 */
let _idCounter = 0;
function generateUniqueId(): string {
    const timestamp = Date.now().toString(36);
    const counter = (++_idCounter).toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return '_px_' + timestamp + counter + random;
}

/**
 * Deep clones a JSON-like value (objects, arrays, primitives).
 * Does not handle special types like Date, Map, Set, functions, etc.
 */
function deepClone<T>(value: T): T {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(item => deepClone(item)) as T;

    const cloned: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
        cloned[key] = deepClone(value[key]);
    }
    return cloned as T;
}

/**
 * Regenerates all IDs in the document and updates references.
 *
 * This function:
 * 1. Deep clones the document to avoid mutating the original
 * 2. Traverses all nodes and regenerates IDs, keeping a mapping of old → new
 * 3. Updates all references to old IDs in attributes:
 *    - Hash references: "#old-id" → "#new-id" (href, xlink:href)
 *    - URL references: "url(#old-id)" → "url(#new-id)" (fill, clip-path, mask, marker, etc.)
 *    - Style URL references: { offsetPath: "url(#old-id)" }
 *
 * @param doc - The animated SVG document to process
 * @returns A new document with regenerated IDs
 */
function generateNewIds(doc: PxAnimatedSvgDocument): PxAnimatedSvgDocument {
    // Deep clone the document
    const cloned: PxAnimatedSvgDocument = deepClone(doc);

    // Map of old ID → new ID
    const idMap = new Map<string, string>();

    // Attributes that contain hash references (#id)
    const hashRefAttrs = new Set(['href', 'xlink:href']);

    // Attributes that contain url(#id) references
    const urlRefAttrs = new Set([
        'fill', 'stroke', 'clip-path', 'clipPath', 'mask',
        'marker', 'marker-start', 'marker-mid', 'marker-end',
        'filter', 'flood-color', 'lighting-color'
    ]);

    // Attributes that contain direct ID references (no # or url())
    const directIdRefAttrs = new Set(['baseId', 'targetId', 'boundElementId']);

    // Phase 1: Collect all IDs and generate new ones
    function collectIds(node: any): void {
        if (!node || typeof node !== 'object') return;

        if (node.id && typeof node.id === 'string') {
            const oldId = node.id;
            const newId = generateUniqueId();
            idMap.set(oldId, newId);
            node.id = newId;
        }

        // Process children
        if (Array.isArray(node.children)) {
            for (const child of node.children) {
                collectIds(child);
            }
        }
    }

    // Phase 2: Update all references to old IDs
    function updateRefs(node: any): void {
        if (!node || typeof node !== 'object') return;

        for (const [key, value] of Object.entries(node)) {
            if (key === 'children') {
                if (Array.isArray(value)) {
                    for (const child of value) {
                        updateRefs(child);
                    }
                }
                continue;
            }

            if (typeof value === 'string') {
                // Check for hash references: href="#old-id"
                if (hashRefAttrs.has(key) && value.startsWith('#')) {
                    const oldId = value.slice(1);
                    const newId = idMap.get(oldId);
                    if (newId) {
                        node[key] = '#' + newId;
                    }
                }
                // Check for url() references: fill="url(#old-id)"
                else if (urlRefAttrs.has(key)) {
                    node[key] = replaceUrlRefs(value, idMap);
                }
                // Check for direct ID references: baseId="_px_xxx"
                else if (directIdRefAttrs.has(key)) {
                    const newId = idMap.get(value);
                    if (newId) {
                        node[key] = newId;
                    }
                }
                // Check for url() in any string value (e.g., in style strings)
                else if (value.includes('url(#')) {
                    node[key] = replaceUrlRefs(value, idMap);
                }
            }
            // Check style object for url() references
            else if (key === 'style' && typeof value === 'object' && value !== null) {
                for (const [styleProp, styleValue] of Object.entries(value)) {
                    if (typeof styleValue === 'string') {
                        (value as any)[styleProp] = replaceUrlRefs(styleValue, idMap);
                    }
                }
            }
            // Recursively process nested objects (meta contains baseId/targetId refs)
            // Skip 'animate' as it contains animation data, not ID references
            else if (typeof value === 'object' && value !== null && key !== 'animate') {
                updateRefs(value);
            }
        }
    }

    collectIds(cloned);
    updateRefs(cloned);

    return cloned;
}

/**
 * Replaces url(#old-id) references in a string with new IDs from the map.
 */
function replaceUrlRefs(value: string, idMap: Map<string, string>): string {
    return value.replace(/url\(#([^)]+)\)/g, (match, oldId) => {
        const newId = idMap.get(oldId);
        return newId ? 'url(#' + newId + ')' : match;
    });
}

/**
 * Creates an animator instance from an AnimatedSvgDocument.
 *
 * This function serves as the main entry point for the animation library. It automatically
 * chooses the best animation engine available ('webapi' or 'frames') or can be
 * forced to use a specific one.
 *
 * @param doc The animated SVG document.
 * @param callbacks Optional object with callback functions for animation lifecycle events (play, pause, finish, etc.).
 * @param containerElement Optional selector or element to render the SVG into.
 * @returns An PxAnimatorAPI instance to programmatically control the animation.
 */
export function createAnimatorImpl(
    doc: PxAnimatedSvgDocument,
    callbacks?: PxAnimatorCallbacksConfig,
    containerElement?: string | Element
): PxAnimatorAPI {

    // Normalize the document to internal format
    const animatorConfig = getAnimatorConfig(doc) || {};

    animatorConfig.debug = true; // FIXME

    let rootElement: Element | null = null;

    // Render the SVG content if we have a container and children
    if (containerElement && doc.children) {

        doc = generateNewIds(doc); // Regenerate IDs so repeated calls to createAnimator(...) produce different ids in elements

        const containerEl = typeof containerElement === 'string' ?
            document.querySelector(containerElement) : containerElement;

        if (containerEl) {
            rootElement = renderNode(doc);
            if (rootElement) {
                containerEl.replaceChildren(rootElement);
            }
        }
    }

    return createAnimatorFromConfig(doc, callbacks, rootElement);
}

/**
 * Creates an animator instance to control SVG animations.
 * Accepts either a document object or a URL to fetch.
 *
 * @param docOrUrl The animated SVG document or URL to fetch it from.
 * @param callbacks Optional object with callback functions for animation lifecycle events.
 * @param containerElement Optional selector or element to render the SVG into.
 * @returns An PxAnimatorAPI instance to programmatically control the animation.
 */
export function createAnimator(
    docOrUrl: PxAnimatedSvgDocument | string,
    callbacks?: PxAnimatorCallbacksConfig,
    containerElement?: string | Element
): PxAnimatorAPI {

    if (typeof docOrUrl === 'object') {
        return createAnimatorImpl(docOrUrl, callbacks, containerElement);
    }

    // URL provided - fetch and create animator
    let animator: PxAnimatorAPI | null = null;

    fetch(docOrUrl).then(res => res.json()).then(json => {
        if (isPxElementFileFormat(json)) {
            animator = createAnimatorImpl(json, callbacks, containerElement);
        } else {
            console.error('Invalid animation document format');
        }
    });

    // Return a proxy that forwards calls once loaded
    return {
        "isReady": () => !!animator,
        "getRootElement": () => animator ? animator.getRootElement() : null,
        "isPlaying": () => animator?.isPlaying() || false,
        "play": () => { animator?.play(); },
        "pause": () => { animator?.pause(); },
        "cancel": () => { animator?.cancel(); },
        "finish": () => { animator?.finish(); },
        "setPlaybackRate": (rate: number) => { animator?.setPlaybackRate(rate); },
        "getCurrentTime": () => animator?.getCurrentTime() || 0,
        "setCurrentTime": (time: number) => { animator?.setCurrentTime(time); },
        "destroy": () => { animator?.destroy(); }
    };
}

/**
 * Scan and load for tags, e.g.
 *  <div data-px-animation-src="animation.json"></div>
 */
export function loadTagAnimators() {
    const elements = document.querySelectorAll('[' + PX_ANIM_SRC_ATTR_NAME + ']');
    for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        if (!(element as any)[PX_ANIM_ATTR_NAME]) {
            const src = element.getAttribute(PX_ANIM_SRC_ATTR_NAME);
            if (src) {
                (element as any)[PX_ANIM_ATTR_NAME] = createAnimator(src, undefined, element);
            }
        }
    }
}

if (typeof window !== 'undefined') {
    (window as any)["loadTagAnimators"] = loadTagAnimators;
    (window as any)["createAnimator"] = createAnimator;
    (window as any)["setupAnimationTriggers"] = setupAnimationTriggers;
}