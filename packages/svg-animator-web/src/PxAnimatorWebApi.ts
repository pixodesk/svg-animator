/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { getSelector } from './PxAnimatorFrameLoop';
import { setupAnimationTriggers } from './PxAnimatorTriggers';
import { getAnimatorConfig, PxAnimatedSvgDocument, PxAnimatorConfig, type PxAnimationDefinition, type PxAnimatorAPI, type PxAnimatorCallbacksConfig } from './PxAnimatorTypes';
import { clamp, COLOUR_ATTR_NAMES, kebabToCamelCaseWord, toRGBA, TRANSFORM_FN_NAMES } from './PxAnimatorUtil';
import { getNormalisedBindings } from './PxDefinitions';


/**
 * Converts an animation definition to Web Animation API keyframes.
 * Returns an array of keyframes for each property.
 */
function convertToWebApiKeyframes(
    animDef: PxAnimationDefinition,
    unsupportedSet: Set<string>,
    config: PxAnimatorConfig
): Map<string, Keyframe[]> {
    const result = new Map<string, Keyframe[]>();

    for (const [propName, propAnim] of Object.entries(animDef)) {
        const keyframes = propAnim.kfs || propAnim.keyframes || [];
        const cssKeyframes: Keyframe[] = [];

        for (const kf of keyframes) {
            let t = kf.t ?? kf.time ?? 0;
            t = clamp(t / (config.duration || 1), 0, 1);
            let value = kf.v ?? kf.value;
            const e = kf.e ?? kf.easing;

            const cssKf: Keyframe = {
                offset: t,
                easing: e && Array.isArray(e) ? "cubic-bezier(" + e.join(',') + ")" : undefined
            };

            let cssValue: any;
            let cssKey = propName;

            if (COLOUR_ATTR_NAMES.has(propName) && Array.isArray(value)) {
                cssValue = toRGBA(value);
            } else if (TRANSFORM_FN_NAMES.has(propName)) {
                if (Array.isArray(value)) {
                    if (propName === 'translate') value = value.map(v => v + 'px');
                    value = value.join(',');
                }
                if (propName === 'rotate') value = value + 'deg';
                cssValue = propName + '(' + value + ')';
                cssKey = 'transform';
            } else {
                cssValue = '' + value;
            }

            if (!CSS.supports(cssKey, cssValue)) unsupportedSet.add(cssKey);

            cssKey = kebabToCamelCaseWord(cssKey);
            cssKf[cssKey] = cssValue;
            cssKeyframes.push(cssKf);
        }

        if (cssKeyframes.length > 0) {
            result.set(propName, cssKeyframes);
        }
    }

    return result;
}


/**
 * Creates an animator instance that uses the native Web Animations API.
 *
 * This is the preferred, more performant animator. It will return null if the
 * animation configuration contains properties not supported by the browser's
 * Web Animations API implementation, unless forceEvenIfHasUnsupportedAttrs is true.
 *
 * @param callbacks Optional lifecycle callbacks.
 * @param rootElement Root element.
 * @param forceEvenIfHasUnsupportedAttrs If true, an animator will be created even if some CSS properties are not supported.
 * @returns An PxAnimatorAPI instance, or null if unsupported features are used and not forced.
 */
export function createWebApiAnimator(
    doc: PxAnimatedSvgDocument,
    callbacks?: PxAnimatorCallbacksConfig,
    rootElement?: Element | null,
    forceEvenIfHasUnsupportedAttrs?: boolean
): PxAnimatorAPI | null {

    const config = getAnimatorConfig(doc) || {};

    const bindings = getNormalisedBindings(doc);

    // Use provided root element or try to find by selector
    if (!rootElement) {
        if (doc.id) {
            const rootSelector = getSelector(doc.id);
            rootElement = document.querySelector(rootSelector);
            if (!rootElement) console.warn("createFrameLoopAnimator: No root element found for selector: ", rootSelector);
        } else {
            console.warn("createFrameLoopAnimator: No root element provided");
        }
    }

    const animations: Array<Animation> = [];

    const _iterations = config.iterations;
    let iterations: number | undefined;
    if (typeof _iterations === 'number') iterations = _iterations;
    if (_iterations === 'infinite') iterations = Infinity;

    const unsupportedSet = new Set<string>();

    ////////////////////////////////////////////////////////////////

    // Warn if no bindings defined
    if (!bindings?.length) {
        console.warn('createWebApiAnimator: No animation bindings defined');
    }

    for (const binding of bindings || []) {
        const animDef = binding.animate;
        if (!animDef || typeof animDef !== 'object' || Array.isArray(animDef)) {
            console.warn('createWebApiAnimator: Empty or unresolved binding', binding);
            continue;
        }

        const selector = getSelector(binding.id);

        // Use CSS selector to find elements
        const elements = rootElement?.querySelectorAll(selector) || document.querySelectorAll(selector);

        if (elements.length === 0) {
            console.warn('createWebApiAnimator: No elements found for selector "' + selector + '"');
        }

        // Convert animation definition to Web API keyframes
        const keyframesMap = convertToWebApiKeyframes(animDef, unsupportedSet, config);

        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];

            // Delay handling:
            // - Positive delay (e.g., 500): Wait before starting → use `delay` option
            // - Negative delay (e.g., -500): Start mid-animation → use `currentTime` to seek
            //   (Web Animations API doesn't reliably support negative delay values)
            // - Negative delay is wrapped to duration (e.g., -5000 with duration 2000 → seek to 1000)
            const positiveDelay = config.delay && config.delay > 0 ? config.delay : undefined;
            const seekPosition = config.delay && config.delay < 0 && config.duration
                ? (-config.delay) % config.duration
                : undefined;

            const effectOptions: KeyframeEffectOptions = {
                duration: config.duration,
                delay: positiveDelay,
                fill: config.fill,
                direction: config.direction,
                iterations: iterations
            };

            for (const [, keyframes] of keyframesMap) {
                if (keyframes.length > 0) {
                    try {
                        const effect = new KeyframeEffect(element, keyframes, effectOptions);
                        const anim = new Animation(effect, document.timeline);

                        if (callbacks?.onFinish) anim.onfinish = () => callbacks.onFinish?.();
                        if (callbacks?.onRemove) anim.onremove = () => callbacks.onRemove?.();

                        // Seek forward for negative delay (e.g., delay=-500 → seek to 500ms)
                        if (seekPosition) {
                            anim.currentTime = seekPosition;
                        }

                        animations.push(anim);
                    } catch (e) {
                        console.warn(e);
                    }
                }
            }
        }
    }

    ////////////////////////////////////////////////////////////////

    if (!forceEvenIfHasUnsupportedAttrs && unsupportedSet.size) {
        console.warn('Unsupported CSS attrs: ' + [...unsupportedSet].join(', '));
        return null;
    }

    ////////////////////////////////////////////////////////////////

    const api: PxAnimatorAPI = {

        "isReady": () => true,

        "getRootElement": () => rootElement || null,

        "isPlaying": (): boolean => { return animations[0]?.playState === 'running'; },

        "play": () => {
            animations.forEach(a => a.play());
            callbacks?.onPlay?.();
        },
        "pause": () => {
            animations.forEach(a => a.pause());
            callbacks?.onPause?.();
        },
        "cancel": () => {
            animations.forEach(a => a.cancel());
            callbacks?.onCancel?.(); // FIXME onFinished needs to be called when animation finishes, e.g. from animations, and some flag that it was triggered by user
        },
        "finish": () => {
            animations.forEach(a => a.finish()); // FIXME onFinished needs to be called when animation finishes, e.g. from animations, not only when you call finish manually
        },

        "setPlaybackRate": (rate: number) => {
            animations.forEach(a => (a.playbackRate = rate));
            return api;
        },
        "getCurrentTime": (): number | null => {
            const res = animations[0]?.currentTime ?? null;
            return res !== null ? +res : null;
        },
        "setCurrentTime": (time: number) => {
            animations.forEach(a => {
                a.currentTime = time;
            });
        },

        "destroy": () => {
            api.cancel();
            animations.splice(0, animations.length);
        }
    };

    ////////////////////////////////////////////////////////////////

    if (config.trigger) {
        setupAnimationTriggers(api, config.trigger);
    }

    return api;
}
