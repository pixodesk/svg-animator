/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

export { createAnimator, createAnimatorImpl, generateNewIds, loadTagAnimators, PX_ANIMATOR_DATA_KEY } from './PxAnimator';

export { px, schemaKeys, describeSchema } from './PxSchema';
export type { KeysMatch, PxInfer, PxSchema, PxSchemaDesc, PxValidationContext, RemoveIndex } from './PxSchema';

export type { PxAnimatorOptions } from './PxAnimator';
export {
    PX_TRANSFORM_PART_KEYS,
    PxAnimatedSvgDocumentSchema,
    PxAnimationDefinitionSchema,
    PxAnimatorConfigSchema,
    PxAttrValueSchema,
    PxBezierPathSchema,
    PxBindingSchema,
    PxDefsSchema,
    PxEasingOrRefSchema,
    PxElementAnimationSchema,
    PxKeyframeSchema,
    PxLoopSchema,
    PxNodeBase,
    PxNodeSchema,
    PxPropertyAnimationSchema,
    PxSvgNodeExtra,
    PxTransformPartsSchema,
    PxTransformValueSchema,
    PxTriggerSchema
} from './PxAnimatorTypes';

// Types
export type {
    FillMode, JsMode, OutAction, PlaybackDirection,
    PxAnimatedSvgDocument,
    PxAnimationDefinition,
    PxAnimatorAPI,
    PxAnimatorCallbacksConfig,
    PxAnimatorConfig,
    PxAttrValue,
    PxBezierPath,
    PxBinding,
    PxDefs,
    PxElementAnimation,
    PxKeyframe,
    PxNode,
    PxPropertyAnimation,
    PxSvgNode,
    PxTransformPartKey,
    PxTransformParts,
    PxTransformValue,
    PxTrigger,
    PxValidationResult,
    StartOn
} from './PxAnimatorTypes';

export {
    getAnimatorConfig,
    getBindings,
    getChildren,
    getDefs,
    isPxElementFileFormat,
    isPxElementFileFormatDeep
} from './PxAnimatorTypes';

export { PX_ANIM_ATTR_NAME, PX_ANIM_SRC_ATTR_NAME } from './PxAnimatorTypes';
export { camelCaseToKebabWordIfNeeded, COLOUR_ATTR_NAMES, STYLE_ATTR_NAMES, toRGBA, TRANSFORM_FN_NAMES } from './PxAnimatorUtil';



// Triggers
export { setupAnimationTriggers } from './PxAnimatorTriggers';

// Normalization utilities
export {
    calcAnimationValues,
    getNormalisedBindings as normalizeDocument
} from './PxDefinitions';

// Low-level APIs (for advanced usage)
export { getNormalizedProps, renderNode } from './PxAnimatorDOM';
export { createBasicFrameLoopAnimator, createFrameLoopAnimator } from './PxAnimatorFrameLoop';
export type { PxPlatformAdapter } from './PxAnimatorFrameLoop';
export { createWebApiAnimator } from './PxAnimatorWebApi';

