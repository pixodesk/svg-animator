/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { PxDefs, PxNode } from './PxAnimatorTypes';
import { camelCaseToKebabWordIfNeeded, COLOUR_ATTR_NAMES, toRGBA, TRANSFORM_FN_NAMES } from './PxAnimatorUtil';


const SVG_NS = 'http://www.w3.org/2000/svg';

// FIXME - do we need this?
// Attributes that should not be set on DOM elements (internal use only)
const INTERNAL_ATTRS = new Set(['type', 'children', 'animate', 'style', 'animator', 'defs', 'bindings']);

function createElement(
    tagName: string,
    props: { [k: string]: string },
    style?: Record<string, string | number>,
    children?: Array<Element>
) {
    const element = document.createElementNS(SVG_NS, tagName);

    for (const propName in props) {
        element.setAttribute(camelCaseToKebabWordIfNeeded(propName), props[propName]);
    }

    // Apply style properties directly (avoids kebab-case issues)
    if (style) {
        for (const styleProp in style) {
            (element as any).style[styleProp] = String(style[styleProp]);
        }
    }

    if (children) {
        for (const child of children) {
            element.appendChild(child);
        }
    }

    return element;
}


/** FIXME - do we need this?
 * Resolves a style reference to an actual style object.
 */
function resolveStyle(
    style: string | Record<string, string | number> | undefined,
    defs?: PxDefs
): Record<string, string | number> | undefined {
    if (!style) return undefined;

    if (typeof style === 'string') {
        // Look up named style in defs
        return defs?.styles?.[style];
    }

    return style;
}


/**
 * Renders a PxNode tree to DOM elements.
 */
export function renderNode(node: PxNode, defs?: PxDefs): Element | null {
    if (!node) return null;

    const { type, children, animate, style, ...props } = node;

    // Extract defs from root svg node
    const nodeDefs = (node as any).defs || defs;

    const propsCopy: Record<string, string> = {};

    // Process regular attributes
    for (const key of Object.keys(props)) {
        if (INTERNAL_ATTRS.has(key)) continue;

        let value = props[key];

        if (COLOUR_ATTR_NAMES.has(key) && Array.isArray(value)) {
            propsCopy[key] = toRGBA(value);
        } else if (TRANSFORM_FN_NAMES.has(key)) {
            if (Array.isArray(value)) {
                if (key === 'translate') value = value.map((v: number) => v + 'px');
                value = value.join(',');
            }
            if (key === 'rotate') value = value + 'deg';
            propsCopy['transform'] = key + '(' + value + ')';
        } else if (value !== undefined && value !== null) {
            propsCopy[key] = String(value);
        }
    }

    // Resolve style reference
    const resolvedStyle = resolveStyle(style, nodeDefs);

    // Process children
    let childElements: Array<Element> | undefined;
    if (children) {
        for (const ch of children) {
            const child = renderNode(ch, nodeDefs);
            if (child) {
                if (!childElements) childElements = [];
                childElements.push(child);
            }
        }
    }

    return createElement(type || 'g', propsCopy, resolvedStyle, childElements);
}
