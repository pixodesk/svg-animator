/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { KeysMatch, PxInfer, PxSchema } from './PxSchema';
import { implementsInterface, px } from './PxSchema';

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


// ============================================================================
// EASING
// ============================================================================

/**
 * Easing function definition.
 * Can be a named reference to a predefined easing or a cubic-bezier array [x1, y1, x2, y2].
 *
 * @example "ease-in" | [0.68, -0.55, 0.265, 1.55]
 *
 * `string | [x1, y1, x2, y2]`
 */
export const PxEasingOrRefSchema = px.union([
    px.string(),
    px.tuple([px.number(), px.number(), px.number(), px.number()] as const),
]);

/**
 * Easing function definition.
 * Can be a named reference to a predefined easing or a cubic-bezier array [x1, y1, x2, y2].
 *
 * @example "ease-in" | "easeOut" | [0.68, -0.55, 0.265, 1.55]
 */
export type PxEasingOrRef = PxInfer<typeof PxEasingOrRefSchema>;


// ============================================================================
// KEYFRAME
// ============================================================================

/**
 * A single animation keyframe defining the state at a specific point in time.
 * Supports both full property names and short aliases for compact notation.
 */
export interface _PxKeyframe {

    /** Timestamp in milliseconds from animation start */
    time?: number;

    /** Short alias for "time" */
    t?: number;

    /** The value of the animated property at this keyframe */
    value?: any;

    /** Short alias for "value" */
    v?: any;

    /** Easing function applied to the interval leading into this keyframe */
    easing?: PxEasingOrRef;

    /** Short alias for "easing" */
    e?: PxEasingOrRef;
}

// `{ time?:number, t?:number, value?:any, v?:any, easing?:Easing, e?:Easing }`
export const PxKeyframeSchema = implementsInterface<_PxKeyframe>()(px.object({
    time: px.number().optional(),
    t: px.number().optional(),
    value: px.any().optional(),
    v: px.any().optional(),
    easing: PxEasingOrRefSchema.optional(),
    e: PxEasingOrRefSchema.optional(),
}));

/** A single animation keyframe defining the state at a specific point in time. */
export type PxKeyframe = PxInfer<typeof PxKeyframeSchema>;
const _ck_PxKeyframe: KeysMatch<PxKeyframe, _PxKeyframe> = true; // the key sets are identical


// ============================================================================
// LOOP
// ============================================================================

/**
 * Defines how a property's keyframe animation is extended beyond its defined keyframe range
 * by continuously repeating a chosen segment of the sequence.
 *
 * The repeated segment is a contiguous run of keyframe *intervals* (gaps between consecutive
 * keyframes). Which end of the sequence is repeated is controlled by `before`, and whether
 * each repetition plays in the same direction or alternates is controlled by `alternate`.
 */
export interface _PxLoop {

    /**
     * Number of keyframe intervals (gaps between consecutive keyframes) that form the repeating
     * segment.
     *
     * - `undefined` → the entire keyframe sequence is used as the loop segment.
     * - `N`         → only the first `N` intervals (when `before: true`) or the last `N` intervals
     *                 (when `before: false`) are looped. Clamped to `[1, keyframes.length - 1]`.
     */
    segmentCount?: number;

    /**
     * Selects which end of the keyframe sequence is looped.
     *
     * - `true`  → the source segment is taken from the *start* of the keyframe sequence.
     *             The animation is extended *before* the first keyframe — useful for intro loops
     *             that run before the main timeline begins.
     *
     * - `false` (default) → the source segment is taken from the *end* of the keyframe sequence.
     *             The animation is extended *after* the last keyframe — useful for idle or outro
     *             loops that continue once the main timeline has finished.
     */
    before?: boolean;

    /**
     * Controls playback direction on each successive loop iteration.
     *
     * - `false` (default) → **cycle**: every iteration replays the segment in the same direction.
     *
     * - `true`  → **pingpong**: iterations alternate between forward and backward playback
     *             (even iterations play forward, odd iterations play in reverse).
     */
    alternate?: boolean;
}

// `{ segmentCount?:number, before?:boolean, alternate?:boolean }`
export const PxLoopSchema = implementsInterface<_PxLoop>()(px.object({
    segmentCount: px.number().optional(),
    before: px.boolean().optional(),
    alternate: px.boolean().optional(),
}));

/**
 * Defines how a property's keyframe animation is extended beyond its defined keyframe range
 * by continuously repeating a chosen segment of the sequence.
 */
export type PxLoop = PxInfer<typeof PxLoopSchema>;
const _ck_PxLoop: KeysMatch<PxLoop, _PxLoop> = true; // the key sets are identical


// ============================================================================
// PROPERTY ANIMATION
// ============================================================================

/**
 * Animation definition for a single CSS/SVG property.
 * Contains an array of keyframes that define how the property changes over time.
 */
export interface _PxPropertyAnimation {

    /** Array of keyframes defining the animation timeline */
    keyframes?: PxKeyframe[];

    /** Short alias for "keyframes" */
    kfs?: PxKeyframe[];

    /** Optional loop configuration. When set, the keyframe sequence is extended beyond its defined
     *  range by repeating a chosen segment. See {@link PxLoop} for details. */
    loop?: PxLoop | boolean;
}

// `{ keyframes?:Keyframe[], kfs?:Keyframe[], loop?:Loop|boolean }`
export const PxPropertyAnimationSchema = implementsInterface<_PxPropertyAnimation>()(px.object({
    keyframes: px.array(PxKeyframeSchema).optional(),
    kfs: px.array(PxKeyframeSchema).optional(),
    loop: px.union([PxLoopSchema, px.boolean()]).optional(),
}));

/** Animation definition for a single CSS/SVG property. */
export type PxPropertyAnimation = PxInfer<typeof PxPropertyAnimationSchema>;
const _ck_PxPropertyAnimation: KeysMatch<PxPropertyAnimation, _PxPropertyAnimation> = true; // the key sets are identical


// ============================================================================
// ANIMATION DEFINITION
// ============================================================================

/**
 * Complete animation definition containing one or more property animations.
 * Each key is a CSS/SVG property name (e.g., "opacity", "translate", "fill").
 *
 * @example
 * { "opacity": { keyframes: [...] }, "translate": { keyframes: [...] } }
 */
export interface _PxAnimationDefinition {
    [property: string]: PxPropertyAnimation;
}

// `Record<propName, PropertyAnimation>`
export const PxAnimationDefinitionSchema = implementsInterface<_PxAnimationDefinition>()(
    px.record(PxPropertyAnimationSchema)
);

/**
 * Complete animation definition containing one or more property animations.
 * Each key is a CSS/SVG property name (e.g., "opacity", "scale", "rotate").
 */
export type PxAnimationDefinition = PxInfer<typeof PxAnimationDefinitionSchema>;


// ============================================================================
// ELEMENT ANIMATION
// ============================================================================

/**
 * Element animation specification. Can be:
 * - A string referencing a named animation from `defs.animations`
 * - An array of named references
 * - An inline `AnimationDefinition` object
 * - A mixed array of references and inline definitions
 *
 * @example
 * "fadeIn"
 * ["fadeIn", "spin"]
 * { opacity: { keyframes: [...] } }
 * ["fadeIn", { scale: { keyframes: [...] } }]
 */
export type _PxElementAnimation =
    | string
    | string[]
    | PxAnimationDefinition
    | (string | PxAnimationDefinition)[];

// `string | Array<string|AnimationDefinition> | AnimationDefinition`
export const PxElementAnimationSchema = implementsInterface<_PxElementAnimation>()(px.union([
    px.string(),
    px.array(px.union([px.string(), PxAnimationDefinitionSchema])),
    PxAnimationDefinitionSchema,
]));

/**
 * Element animation specification.
 * Can be a string reference, array of references, inline definition, or a mixed array.
 */
export type PxElementAnimation = PxInfer<typeof PxElementAnimationSchema>;


// ============================================================================
// TRIGGER
// ============================================================================

type StartOnExtra = StartOn | 'programmatic';

/**
 * Defines when and how an animation should be triggered.
 */
export interface _PxTrigger {

    /** Event that starts the animation */
    startOn?: StartOnExtra;

    /** Action to take when the trigger condition is no longer met (e.g., mouse leaves) */
    outAction?: 'continue' | 'pause' | 'reset' | 'reverse';

    /** Percentage of element visibility required to trigger (0–1). Only applies to scrollIntoView. */
    scrollIntoViewThreshold?: number;
}

// `{ startOn?:'load'|'mouseOver'|'click'|'scrollIntoView'|'programmatic', outAction?:..., scrollIntoViewThreshold?:number }`
export const PxTriggerSchema = implementsInterface<_PxTrigger>()(px.object({
    startOn: px.enum(['load', 'mouseOver', 'click', 'scrollIntoView', 'programmatic'] as const).optional(),
    outAction: px.enum(['continue', 'pause', 'reset', 'reverse'] as const).optional(),
    scrollIntoViewThreshold: px.number().optional(),
}));

/** Defines when and how an animation should be triggered. */
export type PxTrigger = PxInfer<typeof PxTriggerSchema>;
const _ck_PxTrigger: KeysMatch<PxTrigger, _PxTrigger> = true; // the key sets are identical


// ============================================================================
// ANIMATOR CONFIG
// ============================================================================

/**
 * Global animation configuration that applies to all animations in the document.
 * Defines timing, playback behaviour, and rendering strategy.
 */
export interface _PxAnimatorConfig {

    /** JavaScript animation implementation strategy */
    mode?: JsMode;

    /** Total animation duration in milliseconds */
    duration?: number;

    /** Delay before animation starts in milliseconds */
    delay?: number;

    /** Number of times to repeat the animation. Use "infinite" for endless loop. */
    iterations?: number | "infinite";

    /**
     * Defines which values are applied before/after the active animation period
     * (maps directly to the Web Animations API `fill` option).
     * Defaults to `'forwards'` when not set so that elements hold their final
     * state after the animation ends — consistent with Lottie and other animation
     * runtimes. Without this default, seeking to the last frame would cause
     * elements to revert to their pre-animation state.
     */
    fill?: FillMode;

    /** Direction of animation playback */
    direction?: PlaybackDirection;

    /** Target frame rate for frame-based animations (only applicable when mode="frames") */
    frameRate?: number;

    /** Trigger configuration for when animation should start */
    trigger?: PxTrigger;

    debug?: boolean;         // FIXME - implement

    debugInstName?: string;  // FIXME - implement
}

// `{ mode?, duration?, delay?, iterations?, fill?, direction?, frameRate?, trigger?, debug?, debugInstName? }`
export const PxAnimatorConfigSchema = implementsInterface<_PxAnimatorConfig>()(px.object({
    mode: px.enum(['auto', 'webapi', 'frames'] as const).optional(),
    duration: px.number().optional(),
    delay: px.number().optional(),
    iterations: px.union([px.number(), px.literal('infinite')]).optional(),
    fill: px.enum(['forwards', 'backwards', 'both', 'none'] as const).optional(),
    direction: px.enum(['normal', 'reverse', 'alternate', 'alternate-reverse'] as const).optional(),
    frameRate: px.number().optional(),
    trigger: PxTriggerSchema.optional(),
    debug: px.boolean().optional(),
    debugInstName: px.string().optional(),
}));

/**
 * Global animation configuration that applies to all animations in the document.
 * Defines timing, playback behavior, and rendering strategy.
 */
export type PxAnimatorConfig = PxInfer<typeof PxAnimatorConfigSchema>;
const _ck_PxAnimatorConfig: KeysMatch<PxAnimatorConfig, _PxAnimatorConfig> = true; // the key sets are identical


// ============================================================================
// DEFS
// ============================================================================

/**
 * Reusable definitions library for easings, animations, and styles.
 * Defined once here, referenced by name on elements.
 */
export interface _PxDefs {

    /** Named cubic-bezier easing functions */
    easings?: { [name: string]: [number, number, number, number]; };

    /** Named animation definitions that can be referenced by elements */
    animations?: { [name: string]: PxAnimationDefinition; };

    /**
     * FIXME - do we need it?
     * Named style presets for common styling patterns
     */
    styles?: { [name: string]: Record<string, string | number>; };
}

// `{ easings?:Record<name,[x1,y1,x2,y2]>, animations?:Record<name,AnimationDefinition>, styles?:Record<string,any> }`
export const PxDefsSchema = implementsInterface<_PxDefs>()(px.object({
    easings: px.record(px.tuple([px.number(), px.number(), px.number(), px.number()] as const)).optional(),
    animations: px.record(PxAnimationDefinitionSchema).optional(),
    styles: px.record(px.any()).optional(),
}));

/** Reusable definitions library for easings, animations, and styles. */
export type PxDefs = PxInfer<typeof PxDefsSchema>;
const _ck_PxDefs: KeysMatch<PxDefs, _PxDefs> = true; // the key sets are identical


// ============================================================================
// BINDING
// ============================================================================

/**
 * Binds animations to existing DOM elements by ID.
 * Used when the SVG tree is pre-rendered and animations are applied separately.
 */
export interface _PxBinding {

    /** ID targeting elements in the DOM (data-px-id="...") */
    id: string;

    /** Animation to apply to matched elements */
    animate: PxElementAnimation;
}

// `{ id:string, animate:ElementAnimation }`
export const PxBindingSchema = implementsInterface<_PxBinding>()(px.object({
    id: px.string(),
    animate: PxElementAnimationSchema,
}));

/**
 * Binds animations to existing DOM elements via CSS selectors.
 * Used when the SVG tree is pre-rendered and animations are applied separately.
 */
export type PxBinding = PxInfer<typeof PxBindingSchema>;
const _ck_PxBinding: KeysMatch<PxBinding, _PxBinding> = true; // the key sets are identical


// ============================================================================
// NODE
// ============================================================================

/**
 * Base interface for all SVG elements.
 * Named properties take precedence over the index signature when accessed.
 */
export interface _PxNode {

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
 * Base shape for all SVG element nodes.
 * Open object: validated known keys + arbitrary SVG attributes passed through unchanged (cx, cy, r, fill, stroke, …).
 * Non-recursive — excludes `children` (circular reference). Used for type extraction via PxInfer.
 *
 * `{ type:string, animate?:ElementAnimation, style?:string|Record<string,string|number>, [key:string]:any }`
 */
export const PxNodeBase = px.openObject({
    type: px.string(),
    animate: PxElementAnimationSchema.optional(),
    style: px.union([px.string(), px.record(px.union([px.string(), px.number()]))]).optional(),
});

// `let` so the lazy closure can capture the variable reference after assignment.
// By the time the lazy resolves (first isValid/sanitize call), PxNodeSchema is assigned.
// `PxNodeBase & { children?:PxNode[] }`
let PxNodeSchema: PxSchema<any> = px.openObject({
    ...PxNodeBase._shape,
    children: px.lazy(() => px.array(PxNodeSchema), []).optional(),
});
export { PxNodeSchema };

/**
 * Base interface for all SVG elements.
 * Extends schema-derived typed fields; adds recursive children and the open
 * index signature for arbitrary SVG attributes (cx, cy, r, fill, etc.).
 * Named properties take precedence over the index signature when accessed.
 */
export interface PxNode extends PxInfer<typeof PxNodeBase> {
    children?: PxNode[];
    [key: string]: any;
}


// ============================================================================
// SVG NODE (ROOT)
// ============================================================================

/**
 * Root SVG element containing the entire animated graphic.
 * Extends PxNode with SVG-specific properties and global configuration.
 */
export interface _PxSvgNode extends PxNode {

    /** FIXME - do we need it? SVG viewport width */
    width?: number;

    /** FIXME - do we need it? SVG viewport height */
    height?: number;

    /** FIXME - do we need it? SVG viewBox attribute defining coordinate system */
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
 * Extra fields present on the root SVG node, on top of PxNode.
 * Excludes `design` (circular reference to PxNode). Used for type extraction via PxInfer.
 *
 * `{ width?:number, height?:number, viewBox?:string, animator?:AnimatorConfig, defs?:Defs, bindings?:Binding[] }`
 */
export const PxSvgNodeExtra = px.object({
    width: px.number().optional(),
    height: px.number().optional(),
    viewBox: px.string().optional(),
    animator: PxAnimatorConfigSchema.optional(),
    defs: PxDefsSchema.optional(),
    bindings: px.array(PxBindingSchema).optional(),
});

/**
 * Root SVG element containing the entire animated graphic.
 * Extends PxNode (inheriting the open index signature) plus schema-derived
 * SVG-root fields. Only `design` is declared manually due to the circular
 * PxNode reference.
 */
export interface PxSvgNode extends PxNode, PxInfer<typeof PxSvgNodeExtra> {
    design?: PxNode;
}


// ============================================================================
// DOCUMENT
// ============================================================================

/**
 * Root SVG document schema. Enforces `type === 'svg'` to distinguish from child nodes.
 * This is the root type for the entire file format.
 *
 * `{ type:'svg', animate?:ElementAnimation, style?:…, width?:number, height?:number,
 *    viewBox?:string, animator?:AnimatorConfig, defs?:Defs, bindings?:Binding[],
 *    children?:PxNode[], design?:PxNode }`
 */
export const PxAnimatedSvgDocumentSchema = px.object({
    ...PxNodeBase._shape,
    ...PxSvgNodeExtra._shape,
    type: px.literal('svg'),     // override string → literal to require 'svg'
    children: px.array(PxNodeSchema).optional(),
    design: PxNodeSchema.optional(),
});

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


// ============================================================================
// BEZIER PATH
// ============================================================================

/** Represents a vector path for SVG shape animations. */
export interface _PxBezierPath {

    /** An array of vertex points [[x, y], ...]. */
    v: Array<PxPoint2D>;

    /** An array of 'in' tangent handles for each vertex [[x, y], ...]. */
    i?: Array<PxPoint2D>;

    /** An array of 'out' tangent handles for each vertex [[x, y], ...]. */
    o?: Array<PxPoint2D>;
    
    /** A boolean indicating if the path is closed. */
    c?: boolean;
}

// `{ v:number[][], i?:number[][], o?:number[][], c?:boolean }`
export const PxBezierPathSchema = implementsInterface<_PxBezierPath>()(px.object({
    v: px.array(px.array(px.number())),
    i: px.array(px.array(px.number())).optional(),
    o: px.array(px.array(px.number())).optional(),
    c: px.boolean().optional(),
}));

/** Represents a vector path for SVG shape animations. */
export type PxBezierPath = PxInfer<typeof PxBezierPathSchema>;
const _ck_PxBezierPath: KeysMatch<PxBezierPath, _PxBezierPath> = true; // the key sets are identical


// ============================================================================
// ANIMATOR API
// ============================================================================

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
