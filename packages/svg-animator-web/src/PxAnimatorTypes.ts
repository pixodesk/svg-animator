/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import {
    PxAnimatedSvgDocumentSchema,
    PxAnimationDefinitionSchema,
    PxAnimatorConfigSchema,
    PxBezierPathSchema,
    PxBindingSchema,
    PxDefsSchema,
    PxEasingOrRefSchema,
    PxElementAnimationSchema,
    PxKeyframeSchema,
    PxLoopSchema,
    PxPropertyAnimationSchema,
    PxTriggerSchema,
} from './PxAnimatorSchemas';
import type { PxInfer } from './PxSchema';

export type FillMode = 'forwards' | 'backwards' | 'both' | 'none';

export type PlaybackDirection = 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';

export const PX_ANIM_SRC_ATTR_NAME = 'data-px-animation-src';

export const PX_ANIM_ATTR_NAME = '_px_animator';

export type StartOn = 'load' | 'mouseOver' | 'click' | 'scrollIntoView';

export type OutAction = 'continue' | 'pause' | 'reset' | 'reverse';

export type JsMode = "auto" | "webapi" | "frames";


export const ANIMATE_ATTR = 'animate';
export const TEXT_ATTR = 'text';
export const TEXT_CONTENT_ATTR = 'textContent';

// Attributes that should not be set on DOM elements (internal use only)
export const INTERNAL_ATTRS = new Set([
    'type', 'children', ANIMATE_ATTR, 'animator', 'meta', 'defs', 'bindings', TEXT_ATTR, TEXT_CONTENT_ATTR
]);


/**
 * Easing function definition.
 * Can be a named reference to a predefined easing or a cubic-bezier array [x1, y1, x2, y2].
 *
 * @example "ease-in" | "easeOut" | [0.68, -0.55, 0.265, 1.55]
 */
export type PxEasingOrRef = PxInfer<typeof PxEasingOrRefSchema>;

/**
 * A single animation keyframe defining the state at a specific point in time.
 * Supports both full property names and short aliases for compact notation.
 */
export type PxKeyframe = PxInfer<typeof PxKeyframeSchema>;

/**
 * Defines how a property's keyframe animation is extended beyond its defined keyframe range
 * by continuously repeating a chosen segment of the sequence.
 *
 * The repeated segment is a contiguous run of keyframe *intervals* (gaps between consecutive
 * keyframes). Which end of the sequence is repeated is controlled by `before`, and whether
 * each repetition plays in the same direction or alternates is controlled by `alternate`.
 */
export type PxLoop = PxInfer<typeof PxLoopSchema>;

/**
 * Animation definition for a single CSS/SVG property.
 * Contains an array of keyframes that define how the property changes over time.
 */
export type PxPropertyAnimation = PxInfer<typeof PxPropertyAnimationSchema>;

/**
 * Complete animation definition containing one or more property animations.
 * Each key is a CSS/SVG property name (e.g., "opacity", "scale", "rotate").
 *
 * @example
 * {
 *   "opacity": { keyframes: [...] },
 *   "scale": { keyframes: [...] }
 * }
 */
export type PxAnimationDefinition = PxInfer<typeof PxAnimationDefinitionSchema>;

/**
 * Element animation specification.
 * Can be:
 * - A string referencing a named animation from defs
 * - An array of named animation references
 * - An inline PxAnimationDefinition object
 * - A mixed array of references and inline definitions
 *
 * @example
 * "fadeIn"
 * ["fadeIn", "spin"]
 * { opacity: { keyframes: [...] } }
 * ["fadeIn", { scale: { keyframes: [...] } }]
 */
export type PxElementAnimation = PxInfer<typeof PxElementAnimationSchema>;

/**
 * Defines when and how an animation should be triggered.
 */
export type PxTrigger = PxInfer<typeof PxTriggerSchema>;

/**
 * Global animation configuration that applies to all animations in the document.
 * Defines timing, playback behavior, and rendering strategy.
 */
export type PxAnimatorConfig = PxInfer<typeof PxAnimatorConfigSchema>;

/**
 * Reusable definitions library for easings, animations, and styles.
 * Allows to define once and referencing by name.
 */
export type PxDefs = PxInfer<typeof PxDefsSchema>;

/**
 * Binds animations to existing DOM elements via CSS selectors.
 * Used when the SVG tree is pre-rendered and animations are applied separately.
 */
export type PxBinding = PxInfer<typeof PxBindingSchema>;

/**
 * Base interface for all SVG elements.
 * Represents a node in the SVG tree with optional animations and children.
 */
export interface PxNode {
    /** SVG element type (e.g., "circle", "rect", "path", "g") */
    type: string;

    /** Child elements (for container elements like <g>) */
    children?: PxNode[];

    /** Animation applied to this element */
    animate?: PxElementAnimation;

    /**
     * FIXME - do we need it?
     * Style applied to this element (named reference or inline object)
     */
    style?: string | Record<string, string | number>;

    /** All other SVG attributes (cx, cy, r, fill, stroke, etc.) */
    [key: string]: any;
}

/**
 * Root SVG element containing the entire animated graphic.
 * Extends PxNode with SVG-specific properties and global configuration.
 */
export interface PxSvgNode extends PxNode {

    /** FIXME - do we need it?
     * SVG viewport width */
    width?: number;

    /** FIXME - do we need it?
     * SVG viewport height */
    height?: number;

    /** FIXME - do we need it?
     * SVG viewBox attribute defining coordinate system */
    viewBox?: string;

    /** Global animation configuration */
    animator?: PxAnimatorConfig;

    /** Reusable definitions library */
    defs?: PxDefs;

    /** Animation bindings for pre-rendered DOM elements */
    bindings?: PxBinding[];

    design?: PxNode;
}

/**
 * The complete animated SVG document.
 * This is the root type for the entire file format.
 */
export interface PxAnimatedSvgDocument extends PxSvgNode {
}

// ============================================================================
// API INTERFACES
// ============================================================================

/** A configuration object for animation lifecycle callbacks. */
export interface PxAnimatorCallbacksConfig {

    /** Callback executed when the animation starts or resumes. */
    onPlay?: () => void;

    /** Callback executed when the animation is paused. */
    onPause?: () => void;

    /** Callback executed when the animation is cancelled. */
    onCancel?: () => void;

    /** Callback executed when the animation finishes naturally. */
    onFinish?: () => void;

    /** Callback executed when the animation is removed. */
    onRemove?: () => void;
}


export type PxPoint2D = Array<number>;

/** Represents a vector path for SVG shape animations. */
export type PxBezierPath = PxInfer<typeof PxBezierPathSchema>;

/** Basic animation controls common to all animator types. */
export interface PxBasicAnimatorAPI {

    isReady(): boolean;

    /** Returns the root HTML element for the animation. */
    getRootElement(): Element | null;

    /** Returns true if the animation is currently running. */
    isPlaying(): boolean;

    /** Starts or resumes the animation. */
    play(): void;

    /** Pauses the animation at its current state. */
    pause(): void;

    /** Stops the animation and resets it to its initial state. */
    cancel(): void;

}

/** The full programmatic control interface for an animation. */
export interface PxAnimatorAPI extends PxBasicAnimatorAPI {

    /** Jumps to the end of the animation and holds the final state. */
    finish(): void;

    /** Changes the speed of the animation. 1 is normal, 2 is double, -1 is reverse. */
    setPlaybackRate(rate: number): void;

    /** Returns the current playback time in milliseconds. */
    getCurrentTime(): number | null;

    /** Jumps to a specific time (in milliseconds) in the animation. */
    setCurrentTime(time: number): void;

    /** Stops the animation and cleans up all associated resources. */
    destroy(): void;
}


// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function isPxElementFileFormat(fileJson: any): fileJson is PxAnimatedSvgDocument {
    if (!(
        fileJson &&
        typeof fileJson === 'object' &&
        !Array.isArray(fileJson)
    )) {
        return false;
    }

    return fileJson['type'] === 'svg' || fileJson['tagName'] === 'svg';
}


// ============================================================================
// DEEP VALIDATION
// ============================================================================

export interface PxValidationResult {
    valid: boolean;
    errors: string[];
}

/**
 * Deep validation of PxAnimatedSvgDocument using the PxAnimatedSvgDocumentSchema.
 * @returns PxValidationResult with valid flag and array of error messages
 */
export function isPxElementFileFormatDeep(fileJson: any): PxValidationResult {
    const valid: boolean = PxAnimatedSvgDocumentSchema.isValid(fileJson);
    return { valid, errors: valid ? [] : ['Document failed schema validation'] };
}

export function getAnimatorConfig(doc: PxAnimatedSvgDocument): PxAnimatorConfig | undefined {
    return (
        doc?.animator || doc?.meta?.animator ||
        doc?.animation || doc?.meta?.animation // FIXME - decide on the name
    );
}

export function getDefs(doc: PxAnimatedSvgDocument): PxDefs | undefined {
    if (!doc) return undefined;
    return doc.defs || doc.meta?.defs;
}

export function getBindings(doc: PxAnimatedSvgDocument): PxBinding[] | undefined {
    if (!doc) return undefined;
    return doc.bindings || doc.meta?.bindings;
}

// FIXME - do we need it?
export function getChildren(doc: PxAnimatedSvgDocument): PxNode[] | undefined {
    return doc?.children;
}
