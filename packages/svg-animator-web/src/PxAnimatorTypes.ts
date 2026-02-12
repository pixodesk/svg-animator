/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

export type FillMode = 'forwards' | 'backwards' | 'both' | 'none';

export type PlaybackDirection = 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';

export const PX_ANIM_SRC_ATTR_NAME = 'data-px-animation-src';

export const PX_ANIM_ATTR_NAME = '_px_animator';


/**
 * Easing function definition.
 * Can be a named reference to a predefined easing or a cubic-bezier array [x1, y1, x2, y2].
 *
 * @example "ease-in" | "easeOut" | [0.68, -0.55, 0.265, 1.55]
 */
export type PxEasingOrRef = string | [number, number, number, number];

/**
 * A single animation keyframe defining the state at a specific point in time.
 * Supports both full property names and short aliases for compact notation.
 */
export interface PxKeyframe {
    /** Timestamp in milliseconds from animation start */
    time?: number;

    /** Short alias for "time" */
    t?: number;

    /** The value of the animated property at this keyframe */
    value?: any;

    /** Short alias for "value" */
    v?: any;

    /** Easing function to use when transitioning to this keyframe from the previous one */
    easing?: PxEasingOrRef;

    /** Short alias for "easing" */
    e?: PxEasingOrRef;
}

/**
 * Animation definition for a single CSS/SVG property.
 * Contains an array of keyframes that define how the property changes over time.
 */
export interface PxPropertyAnimation {
    /** Array of keyframes defining the animation timeline */
    keyframes?: PxKeyframe[];

    /** Short alias for "keyframes" */
    kfs?: PxKeyframe[];
}

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
export interface PxAnimationDefinition {
    [property: string]: PxPropertyAnimation;
}

/**
 * Defines when and how an animation should be triggered.
 */
export interface PxTrigger {
    /** Event that starts the animation */
    startOn: 'load' | 'mouseOver' | 'click' | 'scrollIntoView' | 'programmatic';

    /** Action to take when the trigger condition is no longer met (e.g., mouse leaves) */
    outAction?: 'continue' | 'pause' | 'reset' | 'reverse';

    /** Percentage of element visibility required to trigger (0-1). Only applies to scrollIntoView. */
    scrollIntoViewThreshold?: number;
}

/**
 * Global animation configuration that applies to all animations in the document.
 * Defines timing, playback behavior, and rendering strategy.
 */
export interface PxAnimatorConfig {
    /** JavaScript animation implementation strategy */
    mode?: "auto" | "webapi" | "frames";

    /** Total animation duration in milliseconds */
    duration?: number;

    /** Delay before animation starts in milliseconds */
    delay?: number;

    /** Number of times to repeat the animation. Use "infinite" for endless loop. */
    iterations?: number | "infinite";

    /** Defines which values are applied before/after the animation */
    fill?: FillMode;

    /** Direction of animation playback */
    direction?: PlaybackDirection;

    /** Target frame rate for frame-based animations (only applicable when mode="frames") */
    frameRate?: number;

    /** Trigger configuration for when animation should start */
    trigger?: PxTrigger;

    debug?: boolean; // FIXME - implement

    debugInstName?: string; // FIXME - implement
}

/**
 * Reusable definitions library for easings, animations, and styles.
 * Allows to define once and referencing by name.
 */
export interface PxDefs {
    /** Named cubic-bezier easing functions */
    easings?: {
        [name: string]: [number, number, number, number];
    };

    /** Named animation definitions that can be referenced by elements */
    animations?: {
        [name: string]: PxAnimationDefinition;
    };

    /** 
     * FIXME - do we need it?
     * Named style presets for common styling patterns 
     */
    styles?: {
        [name: string]: Record<string, string | number>;
    };
}

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
export type PxElementAnimation =
    | string
    | string[]
    | PxAnimationDefinition
    | (string | PxAnimationDefinition)[];

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
 * Binds animations to existing DOM elements via CSS selectors.
 * Used when the SVG tree is pre-rendered and animations are applied separately.
 */
export interface PxBinding {
    /** ID targeting elements in the DOM (data-px-id="...") */
    id: string;

    /** Animation to apply to matched elements */
    animate: PxElementAnimation;
}

/**
 * Root SVG element containing the entire animated graphic.
 * Extends PxNode with SVG-specific properties and global configuration.
 */
export interface PxSvgNode extends PxNode {
    /** FIXME - do we need it?
     * Must be "svg" for root element */
    type: 'svg';

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
    /** FIXME - do we need it?
     * Must be "svg" for root element */
    type: 'svg';
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
export interface PxBezierPath {

    /** An array of vertex points [[x, y], ...]. */
    v: Array<PxPoint2D>;

    /** An array of 'in' tangent handles for each vertex [[x, y], ...]. */
    i?: Array<PxPoint2D>;

    /** An array of 'out' tangent handles for each vertex [[x, y], ...]. */
    o?: Array<PxPoint2D>;

    /** A boolean indicating if the path is closed. */
    c?: boolean;
}

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

function isObject(v: any): v is Record<string, any> {
    return v && typeof v === 'object' && !Array.isArray(v);
}

function validateFillMode(v: any, path: string, errors: string[]): boolean {
    if (v === 'forwards' || v === 'backwards' || v === 'both' || v === 'none') return true;
    errors.push(path + ': invalid FillMode "' + v + '", expected \'forwards\'|\'backwards\'|\'both\'|\'none\'');
    return false;
}

function validatePlaybackDirection(v: any, path: string, errors: string[]): boolean {
    if (v === 'normal' || v === 'reverse' || v === 'alternate' || v === 'alternate-reverse') return true;
    errors.push(path + ': invalid PlaybackDirection "' + v + '", expected \'normal\'|\'reverse\'|\'alternate\'|\'alternate-reverse\'');
    return false;
}

function validatePxEasingOrRef(v: any, path: string, errors: string[]): boolean {
    if (typeof v === 'string') return true;
    if (Array.isArray(v) && v.length === 4 && v.every(n => typeof n === 'number')) return true;
    errors.push(path + ': invalid easing, expected string or [number, number, number, number]');
    return false;
}

function validatePxKeyframe(v: any, path: string, errors: string[]): boolean {
    if (!isObject(v)) {
        errors.push(path + ': expected object');
        return false;
    }
    let valid = true;
    if (v.time !== undefined && typeof v.time !== 'number') {
        errors.push(path + '.time: expected number, got ' + typeof v.time);
        valid = false;
    }
    if (v.t !== undefined && typeof v.t !== 'number') {
        errors.push(path + '.t: expected number, got ' + typeof v.t);
        valid = false;
    }
    if (v.easing !== undefined && !validatePxEasingOrRef(v.easing, path + '.easing', errors)) valid = false;
    if (v.e !== undefined && !validatePxEasingOrRef(v.e, path + '.e', errors)) valid = false;
    return valid;
}

function validatePxPropertyAnimation(v: any, path: string, errors: string[]): boolean {
    if (!isObject(v)) {
        errors.push(path + ': expected object');
        return false;
    }
    let valid = true;
    if (v.keyframes !== undefined) {
        if (!Array.isArray(v.keyframes)) {
            errors.push(path + '.keyframes: expected array');
            valid = false;
        } else {
            v.keyframes.forEach((kf: any, i: number) => {
                if (!validatePxKeyframe(kf, path + '.keyframes[' + i + ']', errors)) valid = false;
            });
        }
    }
    if (v.kfs !== undefined) {
        if (!Array.isArray(v.kfs)) {
            errors.push(path + '.kfs: expected array');
            valid = false;
        } else {
            v.kfs.forEach((kf: any, i: number) => {
                if (!validatePxKeyframe(kf, path + '.kfs[' + i + ']', errors)) valid = false;
            });
        }
    }
    return valid;
}

function validatePxAnimationDefinition(v: any, path: string, errors: string[]): boolean {
    if (!isObject(v)) {
        errors.push(path + ': expected object');
        return false;
    }
    let valid = true;
    for (const key of Object.keys(v)) {
        if (!validatePxPropertyAnimation(v[key], path + '.' + key, errors)) valid = false;
    }
    return valid;
}

function validatePxElementAnimation(v: any, path: string, errors: string[]): boolean {
    if (typeof v === 'string') return true;
    if (Array.isArray(v)) {
        let valid = true;
        v.forEach((item, i) => {
            if (typeof item !== 'string' && !validatePxAnimationDefinition(item, path + '[' + i + ']', errors)) {
                valid = false;
            }
        });
        return valid;
    }
    if (isObject(v)) return validatePxAnimationDefinition(v, path, errors);
    errors.push(path + ': expected string, array, or PxAnimationDefinition object');
    return false;
}

function validatePxTrigger(v: any, path: string, errors: string[]): boolean {
    if (!isObject(v)) {
        errors.push(path + ': expected object');
        return false;
    }
    let valid = true;
    const validStartOn = ['load', 'mouseOver', 'click', 'scrollIntoView', 'programmatic'];
    if (!validStartOn.includes(v.startOn)) {
        errors.push(path + '.startOn: invalid value "' + v.startOn + '", expected ' + validStartOn.join('|'));
        valid = false;
    }
    if (v.outAction !== undefined) {
        const validOutAction = ['continue', 'pause', 'reset', 'reverse'];
        if (!validOutAction.includes(v.outAction)) {
            errors.push(path + '.outAction: invalid value "' + v.outAction + '", expected ' + validOutAction.join('|'));
            valid = false;
        }
    }
    if (v.scrollIntoViewThreshold !== undefined && typeof v.scrollIntoViewThreshold !== 'number') {
        errors.push(path + '.scrollIntoViewThreshold: expected number, got ' + typeof v.scrollIntoViewThreshold);
        valid = false;
    }
    return valid;
}

function validatePxAnimatorConfig(v: any, path: string, errors: string[]): boolean {
    if (!isObject(v)) {
        errors.push(path + ': expected object');
        return false;
    }
    let valid = true;
    if (v.mode !== undefined && !['auto', 'webapi', 'frames'].includes(v.mode)) {
        errors.push(path + '.mode: invalid value "' + v.mode + '", expected \'auto\'|\'webapi\'|\'frames\'');
        valid = false;
    }
    if (v.duration !== undefined && typeof v.duration !== 'number') {
        errors.push(path + '.duration: expected number, got ' + typeof v.duration);
        valid = false;
    }
    if (v.delay !== undefined && typeof v.delay !== 'number') {
        errors.push(path + '.delay: expected number, got ' + typeof v.delay);
        valid = false;
    }
    if (v.iterations !== undefined && typeof v.iterations !== 'number' && v.iterations !== 'infinite') {
        errors.push(path + '.iterations: expected number or \'infinite\', got ' + typeof v.iterations);
        valid = false;
    }
    if (v.fill !== undefined && !validateFillMode(v.fill, path + '.fill', errors)) valid = false;
    if (v.direction !== undefined && !validatePlaybackDirection(v.direction, path + '.direction', errors)) valid = false;
    if (v.frameRate !== undefined && typeof v.frameRate !== 'number') {
        errors.push(path + '.frameRate: expected number, got ' + typeof v.frameRate);
        valid = false;
    }
    if (v.trigger !== undefined && !validatePxTrigger(v.trigger, path + '.trigger', errors)) valid = false;
    return valid;
}

function validatePxDefs(v: any, path: string, errors: string[]): boolean {
    if (!isObject(v)) {
        errors.push(path + ': expected object');
        return false;
    }
    let valid = true;
    if (v.easings !== undefined) {
        if (!isObject(v.easings)) {
            errors.push(path + '.easings: expected object');
            valid = false;
        } else {
            for (const key of Object.keys(v.easings)) {
                if (!validatePxEasingOrRef(v.easings[key], path + '.easings.' + key, errors)) valid = false;
            }
        }
    }
    if (v.animations !== undefined) {
        if (!isObject(v.animations)) {
            errors.push(path + '.animations: expected object');
            valid = false;
        } else {
            for (const key of Object.keys(v.animations)) {
                if (!validatePxAnimationDefinition(v.animations[key], path + '.animations.' + key, errors)) valid = false;
            }
        }
    }
    if (v.styles !== undefined && !isObject(v.styles)) {
        errors.push(path + '.styles: expected object');
        valid = false;
    }
    return valid;
}

function validatePxBinding(v: any, path: string, errors: string[]): boolean {
    if (!isObject(v)) {
        errors.push(path + ': expected object');
        return false;
    }
    let valid = true;
    if (typeof v.id !== 'string') {
        errors.push(path + '.id: expected string, got ' + typeof v.id);
        valid = false;
    }
    if (!validatePxElementAnimation(v.animate, path + '.animate', errors)) valid = false;
    return valid;
}

function validatePxNode(v: any, path: string, errors: string[]): boolean {
    if (!isObject(v)) {
        errors.push(path + ': expected object');
        return false;
    }
    let valid = true;
    if (typeof v.type !== 'string') {
        errors.push(path + '.type: expected string, got ' + typeof v.type);
        valid = false;
    }
    if (v.children !== undefined) {
        if (!Array.isArray(v.children)) {
            errors.push(path + '.children: expected array');
            valid = false;
        } else {
            v.children.forEach((child: any, i: number) => {
                if (!validatePxNode(child, path + '.children[' + i + ']', errors)) valid = false;
            });
        }
    }
    if (v.animate !== undefined && !validatePxElementAnimation(v.animate, path + '.animate', errors)) valid = false;
    return valid;
}

function validatePxSvgNode(v: any, path: string, errors: string[]): boolean {
    if (!validatePxNode(v, path, errors)) return false;
    let valid = true;
    if (v.type !== 'svg') {
        errors.push(path + '.type: expected \'svg\', got \'' + v.type + '\'');
        valid = false;
    }
    if (v.width !== undefined && typeof v.width !== 'number') {
        errors.push(path + '.width: expected number, got ' + typeof v.width);
        valid = false;
    }
    if (v.height !== undefined && typeof v.height !== 'number') {
        errors.push(path + '.height: expected number, got ' + typeof v.height);
        valid = false;
    }
    if (v.viewBox !== undefined && typeof v.viewBox !== 'string') {
        errors.push(path + '.viewBox: expected string, got ' + typeof v.viewBox);
        valid = false;
    }
    if (v.animator !== undefined && !validatePxAnimatorConfig(v.animator, path + '.animator', errors)) valid = false;
    if (v.defs !== undefined && !validatePxDefs(v.defs, path + '.defs', errors)) valid = false;
    if (v.bindings !== undefined) {
        if (!Array.isArray(v.bindings)) {
            errors.push(path + '.bindings: expected array');
            valid = false;
        } else {
            v.bindings.forEach((binding: any, i: number) => {
                if (!validatePxBinding(binding, path + '.bindings[' + i + ']', errors)) valid = false;
            });
        }
    }
    if (v.design !== undefined && !validatePxNode(v.design, path + '.design', errors)) valid = false;
    return valid;
}

/**
 * Deep validation of PxAnimatedSvgDocument.
 * Validates all nested properties against their type definitions.
 * @returns PxValidationResult with valid flag and array of error messages
 */
export function isPxElementFileFormatDeep(fileJson: any): PxValidationResult {
    const errors: string[] = [];
    const valid = validatePxSvgNode(fileJson, 'root', errors);
    return { valid, errors };
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
