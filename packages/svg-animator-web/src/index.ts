/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

export { createAnimator, createAnimatorImpl, loadTagAnimators } from './PxAnimator';

// Types
export type {
    FillMode,
    PlaybackDirection,
    PxAnimatedSvgDocument,
    PxAnimationDefinition,
    PxAnimatorAPI,
    PxAnimatorCallbacksConfig,
    PxAnimatorConfig,
    PxBezierPath,
    PxBinding,
    PxDefs,
    PxElementAnimation,
    PxKeyframe,
    PxNode,
    PxPropertyAnimation,
    PxSvgNode,
    PxTrigger,
    PxValidationResult
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
export { COLOUR_ATTR_NAMES, toRGBA, TRANSFORM_FN_NAMES } from './PxAnimatorUtil';



// Triggers
export { setupAnimationTriggers } from './PxAnimatorTriggers';

// Normalization utilities
export {
    calcAnimationValues,
    getNormalisedBindings as normalizeDocument
} from './PxDefinitions';

// Low-level APIs (for advanced usage)
export { renderNode } from './PxAnimatorDOM';
export { createBasicFrameLoopAnimator, createFrameLoopAnimator } from './PxAnimatorFrameLoop';
export type { PxPlatformAdapter } from './PxAnimatorFrameLoop';
export { createWebApiAnimator } from './PxAnimatorWebApi';
