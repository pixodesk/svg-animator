/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { px, type PxSchema } from './PxSchema';

export const PxEasingOrRefSchema = px.union([
    px.string(),
    px.tuple([px.number(), px.number(), px.number(), px.number()] as const),
]);

export const PxKeyframeSchema = px.object({
    time:   px.number().optional(),
    t:      px.number().optional(),
    value:  px.any().optional(),
    v:      px.any().optional(),
    easing: PxEasingOrRefSchema.optional(),
    e:      PxEasingOrRefSchema.optional(),
});

export const PxLoopSchema = px.object({
    segmentCount: px.number().optional(),
    before:       px.boolean().optional(),
    alternate:    px.boolean().optional(),
});

export const PxPropertyAnimationSchema = px.object({
    keyframes: px.array(PxKeyframeSchema).optional(),
    kfs:       px.array(PxKeyframeSchema).optional(),
    loop:      px.union([PxLoopSchema, px.boolean()]).optional(),
});

export const PxAnimationDefinitionSchema = px.record(PxPropertyAnimationSchema);

export const PxElementAnimationSchema = px.union([
    px.string(),
    px.array(px.union([px.string(), PxAnimationDefinitionSchema])),
    PxAnimationDefinitionSchema,
]);

export const PxTriggerSchema = px.object({
    startOn:                 px.enum(['load', 'mouseOver', 'click', 'scrollIntoView', 'programmatic'] as const).optional(),
    outAction:               px.enum(['continue', 'pause', 'reset', 'reverse'] as const).optional(),
    scrollIntoViewThreshold: px.number().optional(),
});

export const PxAnimatorConfigSchema = px.object({
    mode:          px.enum(['auto', 'webapi', 'frames'] as const).optional(),
    duration:      px.number().optional(),
    delay:         px.number().optional(),
    iterations:    px.union([px.number(), px.literal('infinite')]).optional(),
    fill:          px.enum(['forwards', 'backwards', 'both', 'none'] as const).optional(),
    direction:     px.enum(['normal', 'reverse', 'alternate', 'alternate-reverse'] as const).optional(),
    frameRate:     px.number().optional(),
    trigger:       PxTriggerSchema.optional(),
    debug:         px.boolean().optional(),
    debugInstName: px.string().optional(),
});

export const PxDefsSchema = px.object({
    easings:    px.record(px.tuple([px.number(), px.number(), px.number(), px.number()] as const)).optional(),
    animations: px.record(PxAnimationDefinitionSchema).optional(),
    styles:     px.record(px.any()).optional(),
});

export const PxBezierPathSchema = px.object({
    v: px.array(px.array(px.number())),
    i: px.array(px.array(px.number())).optional(),
    o: px.array(px.array(px.number())).optional(),
    c: px.boolean().optional(),
});

// `let` so the lazy closure can capture the variable reference after assignment.
// By the time the lazy resolves (first isValid/sanitize call), PxNodeSchema is assigned.
// eslint-disable-next-line prefer-const
let PxNodeSchema: PxSchema<any> = px.openObject({
    type:     px.string(),
    children: px.lazy(() => px.array(PxNodeSchema), []).optional(),
    animate:  PxElementAnimationSchema.optional(),
    style:    px.union([px.string(), px.record(px.union([px.string(), px.number()]))]).optional(),
});
export { PxNodeSchema };

export const PxBindingSchema = px.object({
    id:      px.string(),
    animate: PxElementAnimationSchema,
});

/** Root document schema; enforces type === 'svg' to distinguish from child nodes. */
export const PxAnimatedSvgDocumentSchema = px.object({
    type:     px.literal('svg'),
    children: px.array(PxNodeSchema).optional(),
    animate:  PxElementAnimationSchema.optional(),
    style:    px.union([px.string(), px.record(px.union([px.string(), px.number()]))]).optional(),
    width:    px.number().optional(),
    height:   px.number().optional(),
    viewBox:  px.string().optional(),
    animator: PxAnimatorConfigSchema.optional(),
    defs:     PxDefsSchema.optional(),
    bindings: px.array(PxBindingSchema).optional(),
    design:   PxNodeSchema.optional(),
});
