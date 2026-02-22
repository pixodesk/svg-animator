/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { INTERNAL_ATTRS, TEXT_ATTR, TEXT_CONTENT_ATTR, type PxDefs, type PxNode } from './PxAnimatorTypes';
import { camelCaseToKebabWordIfNeeded, COLOUR_ATTR_NAMES, toRGBA, TRANSFORM_FN_NAMES } from './PxAnimatorUtil';


const SVG_NS = 'http://www.w3.org/2000/svg';


const ALLOWED_SVG_TAGS_LOWER_CASE = new Set([
    'svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon',
    'text', 'tspan', 'defs', 'clipPath', 'mask', 'pattern', 'linearGradient',
    'radialGradient', 'stop', 'use', 'symbol', 'marker', 'filter', 'feGaussianBlur',
    'feOffset', 'feBlend', 'feColorMatrix', 'feMerge', 'feMergeNode'
].map(tagName => tagName.toLowerCase()));


const ALLOWED_RESOURCE_ATTRIBUTES = [

    'href',           // <use>

    'src',            // <image>

    'filter',         // url(#filterId)
    'clipPath',      // clip-path="url(#clipPathId)"
    'mask',           // url(#maskId)
    'markerStart',   // marker-start="url(#markerId)"
    'markerMid',     // marker-mid="url(#markerId)"
    'markerEnd',     // marker-end="url(#markerId)"

    // 'fill',           // url(#gradientId) or url(#patternId)
    // 'stroke',         // url(#gradientId) or url(#patternId)

    // Don't allow 'cursor', can use external SVG,         // url(cursor.svg)
];
const ALLOWED_RESOURCE_ATTRIBUTES_SET = new Set(ALLOWED_RESOURCE_ATTRIBUTES);

const ALLOWED_ATTRIBUTES_SET = new Set([
    'href', 'src',

    // Presentation
    'fill', 'stroke', 'strokeWidth' /*stroke-width*/, 'opacity', 'transform',

    // Geometry
    'x', 'y', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'd',
    'x1', 'y1', 'x2', 'y2', 'points',

    // Text
    'fontSize' /*font-size*/, 'fontFamily' /*font-family*/, 'textAnchor' /*text-anchor*/,

    // Structure
    'id', 'class', 'viewBox', 'preserveAspectRatio',

    // Gradient/Pattern
    'offset', 'stopColor' /*stop-color*/, 'stopOpacity' /*stop-opacity*/, 'gradientTransform',

    // Clippath/Mask
    'clipPath' /*clip-path*/, 'mask',

    // Filter
    'filter', 'stdDeviation', 'in', 'in2', 'result', 'mode',

    ...ALLOWED_RESOURCE_ATTRIBUTES
]);

function sanitiseAttributeValue(name: string, value: any): any | undefined {
    const nameLower = name.toLowerCase();

    // Block dangerous attributes
    if (!ALLOWED_ATTRIBUTES_SET.has(nameLower)) {
        console.warn('Attribute not in whitelist: ', nameLower);
        return undefined;
    }

    // fill/stroke accept plain color values (e.g. "red", "#ff0000") in addition to
    // url(#id) references. If a url() is present it must reference an internal id.
    if (nameLower === 'fill' || nameLower === 'stroke' || nameLower === 'stopColor') {
        const str = String(value);
        if (str.includes('url(') && !/^url\(#[^)]+\)$/.test(str)) {
            console.warn('Attribute "' + nameLower + '" blocked: url() references must be internal url(#id), got:', value);
            return undefined;
        }
        return value;
    }

    if (ALLOWED_RESOURCE_ATTRIBUTES_SET.has(nameLower)) {
        const str = String(value);

        if (str.startsWith('#')) {
            // Allow internal fragment references: #id (e.g. href="#elementId")
            return value;
        }

        if (/^url\(#[^)]+\)$/.test(str)) {
            // Allow internal URL references: url(#id)
            return value;
        }

        return undefined;
    }

    

    return value;
}

function createElement(
    tagName: string,
    normalisedProps: { [k: string]: string },
    style: Record<string, string | number> | undefined,
    children: Array<Element> | undefined,
    textContent?: string
): SVGElement | null {
    if (!ALLOWED_SVG_TAGS_LOWER_CASE.has(tagName.toLowerCase())) return null;

    const element = document.createElementNS(SVG_NS, tagName);

    for (const propName in normalisedProps) {
        element.setAttribute(
            camelCaseToKebabWordIfNeeded(propName),
            sanitiseAttributeValue(propName, normalisedProps[propName])
        );
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

    if (textContent) element.textContent = textContent;

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


export function getNormalizedProps(props: Record<string, any>) {
    const propsCopy: Record<string, any> = {};

    // Process regular attributes
    for (const key of Object.keys(props)) {
        if (INTERNAL_ATTRS.has(key)) continue;
        if (key === 'style') continue;

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

    return propsCopy;
}

/**
 * Renders a PxNode tree to DOM elements.
 */
export function renderNode(node: PxNode, defs?: PxDefs): Element | null {
    if (!node) return null;

    const { type, children, animate, style, ...props } = node;

    // Extract defs from root svg node
    const nodeDefs = (node as any).defs || defs;

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

    return createElement(
        type || 'g',
        getNormalizedProps(props),
        resolvedStyle,
        childElements,
        props[TEXT_ATTR] || props[TEXT_CONTENT_ATTR]
    );
}