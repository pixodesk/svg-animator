/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { setupAnimationTriggers } from './PxAnimatorTriggers';
import { getAnimatorConfig, type PxAnimatedSvgDocument, type PxAnimatorAPI, type PxAnimatorCallbacksConfig } from './PxAnimatorTypes';
import { camelCaseToKebabWordIfNeeded, clamp, DEFAULT_DURATION_MS, STYLE_ATTR_NAMES } from './PxAnimatorUtil';
import { calcAnimationValues, getNormalisedBindings } from './PxDefinitions';


/**
 * Platform adapter interface for abstracting DOM-specific operations.
 */
export interface PxPlatformAdapter {

    /** Check if the root element is still connected/mounted */
    isConnected(): boolean;

    /** Set an attribute on an element by id */
    setAttribute(id: string, attrName: string, value: string): void;
}

export function getSelector(id: string) {
    // return `[data-px-id="${id}"]`; FIXME
    return '#' + id;
}


/**
 * Creates an animator instance that uses a frame loop for animations.
 * This is the abstract/platform-agnostic version.
 *
 * @param adapter Platform adapter for DOM/environment operations.
 * @param callbacks Optional lifecycle callbacks.
 * @returns A PxAnimatorAPI instance.
 */
export function createBasicFrameLoopAnimator(
    doc: PxAnimatedSvgDocument,
    adapter: PxPlatformAdapter,
    callbacks?: PxAnimatorCallbacksConfig
): PxAnimatorAPI {

    const config = getAnimatorConfig(doc) || {};

    const bindings = getNormalisedBindings(doc);

    // iterations: either number or Infinity
    const _iterations = config.iterations;
    let iterations: number = 1;
    if (typeof _iterations === 'number') iterations = _iterations || 1;
    if (_iterations === 'infinite') iterations = Infinity;
    if (iterations < 1) iterations = 1;

    const duration = +(config.duration || DEFAULT_DURATION_MS); // per-iteration duration (ms), cannot be 0!
    const totalDuration = duration && iterations ?
        duration * (iterations === Infinity ? Infinity : iterations) :
        (duration ? (iterations ?? 1) * duration : 0);

    // direction handling
    const direction = config.direction || 'normal'; // 'normal' | 'reverse' | 'alternate' | 'alternate-reverse'

    ////////////////////////////////////////////////////////////////

    let timerId: number | null = null;
    let playing = false;

    let timeBeforeLastStartMs = (config.delay || 0); // accumulated time before current run (ms)
    let lastStartedTs = 0; // timestamp when last started/resumed
    let playbackRate = 1;

    let finishCalled = false; // ensures onFinish called once

    // Frame rate throttling
    const frameRate = config.frameRate;
    const minFrameIntervalMs = frameRate && frameRate > 0 ? 1000 / frameRate : 0;
    let lastRenderTs = 0; // timestamp of last render

    const getAnimCurrentTime = () => {
        // compute effective elapsed time (ms), taking playbackRate into account
        const runningElapsed = lastStartedTs ? (Date.now() - lastStartedTs) * playbackRate : 0;
        let time = timeBeforeLastStartMs + runningElapsed;

        // clamp to totalDuration if finite
        if (Number.isFinite(totalDuration) && time > (totalDuration as number)) time = totalDuration as number;
        if (time < 0) time = 0;
        return time;
    };


    ////////////////////////////////////////////////////////////////


    // separate render function that uses a given currentTime (ms)
    function renderFrame(currentTimeMs: number) {

        function getEffectiveProgress() {
            // If no duration or duration === 0, set iteration/progress accordingly
            const safeDuration = duration > 0 ? duration : 1; // avoid division by zero

            let rawProgress = 0;
            let iteration = 0;
            if (duration > 0) {

                // rawProgress is normalized progress within the current iteration:
                // - first iteration: [0 .. 1]
                // - following iterations: (0 .. 1]
                //
                // iteration is the zero-based iteration index
                //
                // Examples (safeDuration = 3):
                // currentTimeMs = 0       → rawProgress = 0       , iteration = 0
                // currentTimeMs = 3       → rawProgress = 1       , iteration = 0
                // currentTimeMs = 3.0001  → rawProgress = 0.0001  , iteration = 1

                currentTimeMs = clamp(currentTimeMs, 0, iterations * safeDuration);

                iteration = Math.max(0, Math.ceil(currentTimeMs / safeDuration) - 1);
                iteration = Math.min(iteration, iterations - 1);

                // Time elapsed since the start of the current iteration
                const iterationTime = currentTimeMs - iteration * safeDuration;

                // Normalized progress (preserves fractional overflow after boundaries)
                rawProgress = clamp(iterationTime / safeDuration, 0, 1);
            } else {
                rawProgress = currentTimeMs; // We shouldn't be here
            }


            // compute per-iteration directional progress
            // start with baseProgress = rawProgress in [0,1)

            let baseProgress = rawProgress;
            // apply direction rules:
            // - normal: as is
            // - reverse: progress = 1 - baseProgress
            // - alternate: reverse on odd iterations
            // - alternate-reverse: reverse on even iterations
            const dir = direction || 'normal';
            let effectiveProgress = baseProgress;
            if (dir === 'reverse') {
                effectiveProgress = 1 - baseProgress;
            } else if (dir === 'alternate') {
                if (iteration % 2 === 1) effectiveProgress = 1 - baseProgress;
            } else if (dir === 'alternate-reverse') {
                // alternate-reverse: start reversed on iteration 0
                if (iteration % 2 === 0) effectiveProgress = 1 - baseProgress;
            } // else 'normal' -> keep
            return effectiveProgress;
        }
        let effectiveProgress = getEffectiveProgress(); // else 'normal' -> keep

        ////////////////////////////////////////////////////////////////

        // FIXME - pre-calc defs, then use

        for (const binding of bindings || []) {
            const animDef = binding.animate;
            if (!animDef || typeof animDef !== 'object' || Array.isArray(animDef)) {
                console.warn('Empty or unresolved binding', binding);
                continue;
            }

            // Calculate interpolated values for this binding's animation
            const computedValues = calcAnimationValues(animDef, effectiveProgress * duration);

            // Apply each computed attribute
            for (const [attrName, value] of Object.entries(computedValues)) {
                adapter.setAttribute(binding.id, attrName, value);
            }
        }
    }


    ////////////////////////////////////////////////////////////////

    const tick = () => {

        // if root element provided and detached, stop
        if (!adapter.isConnected()) {
            // stop animation loop (we'll let external code call play/resume)
            // do not call onFinish here. It's a detach situation.
            pauseAnim();
            return;
        }

        const currentTime = getAnimCurrentTime();

        // Frame rate throttling: skip render if not enough time has passed
        if (minFrameIntervalMs > 0) {
            const now = Date.now();
            if (lastRenderTs && (now - lastRenderTs) < minFrameIntervalMs) {
                // Not enough time elapsed, skip this frame but continue the loop
                return;
            }
            lastRenderTs = now;
        }

        // If animation duration is zero or iterations zero, apply final or initial frames depending
        // duration=0 handling: treat as progress 0 and iteration 0, but if totalDuration === 0 and iterations>0, consider finished.
        if (duration <= 0) {
            // Apply initial keyframe or final depending on configuration.
            // We'll treat it as single-frame animation: apply keyframes with progress 0, then finish.
            // loop through animations and apply first keyframe (progress=0)
        }

        // Detect finished (natural end)
        if (totalDuration && Number.isFinite(totalDuration) && currentTime >= (totalDuration as number)) {
            // render final frame at the very end and then stop
            renderFrame(totalDuration);
            // call onFinish once
            if (!finishCalled) {
                finishCalled = true;
                callbacks?.onFinish?.();
            }
            pauseAnim();
            return;
        }

        // Otherwise render normal frame
        renderFrame(currentTime);
    };


    ////////////////////////////////////////////////////////////////


    if (config.delay) {
        // If startTime provided, we start paused but with that offset; render first frame.
        renderFrame(getAnimCurrentTime());
    }

    ////////////////////////////////////////////////////////////////

    const _isPlaying = () => {
        if (!playing) return false;
        if (!adapter.isConnected()) { return false; }
        if (Number.isFinite(totalDuration) && getAnimCurrentTime() >= (totalDuration as number)) return false;
        return true;
    };

    const loopAnim = (isFirst?: boolean) => {
        if (timerId !== null) {
            cancelAnimationFrame(timerId);
            timerId = null;
        }

        if (!(isFirst || _isPlaying())) {
            // finished or not playing
            return;
        }

        timerId = requestAnimationFrame(() => {
            timerId = null;
            tick();
            loopAnim();
        });
    };

    const startAnim = () => {
        if (playing) return;
        playing = true;
        lastStartedTs = Date.now();
        loopAnim(true);
    };

    const pauseAnim = () => {
        if (!playing) return;
        // capture current time
        timeBeforeLastStartMs = getAnimCurrentTime();
        lastStartedTs = 0;
        playing = false;

        if (timerId !== null) {
            cancelAnimationFrame(timerId);
            timerId = null;
        }
        // render a final frame at the paused time to ensure DOM consistent
        renderFrame(timeBeforeLastStartMs);
    };

    const cancelAnim = () => {
        pauseAnim();

        timeBeforeLastStartMs = 0;
        lastStartedTs = 0;
        playing = false;
        finishCalled = false;

        renderFrame(timeBeforeLastStartMs);

        callbacks?.onCancel?.();
    };

    const finishAnim = (callOnFinish = true) => {
        // jump to the end
        if (Number.isFinite(totalDuration)) {
            timeBeforeLastStartMs = totalDuration as number;
        } else {
            // infinity animations: set to current time (no-op)
            timeBeforeLastStartMs = getAnimCurrentTime();
        }
        lastStartedTs = 0;
        playing = false;
        // render final frame
        renderFrame(timeBeforeLastStartMs);

        if (callOnFinish && !finishCalled) {
            finishCalled = true;
            callbacks?.onFinish?.();
        }
    };

    ////////////////////////////////////////////////////////////////

    const api: PxAnimatorAPI = {

        "isReady": () => true,

        "getRootElement": () => null,

        "isPlaying": (): boolean => { return _isPlaying(); },

        "play": () => {
            startAnim();
            callbacks?.onPlay?.();
        },
        "pause": () => {
            pauseAnim();
            callbacks?.onPause?.();
        },
        "cancel": () => {
            cancelAnim();
            // onCancel already called in cancelAnim
        },
        "finish": () => {
            finishAnim(true);
        },

        "setPlaybackRate": (rate: number) => {
            if (!isFinite(rate) || rate === 0) {
                console.warn('setPlaybackRate: rate must be finite and non-zero');
                return;
            }
            // preserve current logical time when changing rate
            const current = getAnimCurrentTime();
            playbackRate = rate;
            timeBeforeLastStartMs = current;
            if (playing) lastStartedTs = Date.now();
        },

        "getCurrentTime": (): number | null => { return getAnimCurrentTime(); },

        "setCurrentTime": (newTime: number) => {
            // clamp newTime
            if (newTime < 0) newTime = 0;
            if (Number.isFinite(totalDuration) && newTime > (totalDuration as number)) newTime = totalDuration as number;

            timeBeforeLastStartMs = newTime;
            if (playing) lastStartedTs = Date.now();
            // render immediately to reflect the change
            renderFrame(getAnimCurrentTime());
        },

        "destroy": () => { api.cancel(); }
    };

    ////////////////////////////////////////////////////////////////

    return api;
}


////////////////////////////////////////////////////////////////
// Browser DOM implementation
////////////////////////////////////////////////////////////////



/**
 * Creates an animator instance that uses a requestAnimationFrame loop for animations.
 * This is the browser DOM-specific version.
 *
 * @param {PxAnimatorCallbacksConfig=} callbacks Optional lifecycle callbacks.
 * @param {Element=} rootElement Optional pre-rendered root element.
 * @returns {PxAnimatorAPI} A PxAnimatorAPI instance.
 */
export function createFrameLoopAnimator(
    doc: PxAnimatedSvgDocument,
    callbacks?: PxAnimatorCallbacksConfig,
    rootElement?: Element | null
): PxAnimatorAPI {

    const config = getAnimatorConfig(doc) || {};

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

    // Track warnings to avoid spamming console
    const warnedSelectors = new Set<string>();

    const adapter: PxPlatformAdapter = {
        isConnected: () => {
            if (!rootElement) return true; // No root element means we're always "connected"
            return rootElement.isConnected;
        },
        setAttribute: (id, attrName, value) => {

            attrName = camelCaseToKebabWordIfNeeded(attrName);

            const selector = getSelector(id);

            // Query elements by selector within root (or document if no root)
            const elements = rootElement?.querySelectorAll(selector) || document.querySelectorAll(selector);

            if (elements.length === 0 && !warnedSelectors.has(selector)) {
                warnedSelectors.add(selector);
                console.warn('setAttribute: No elements found for selector "' + selector + '"');
            }

            for (let i = 0; i < elements.length; i++) {
                const element = elements[i];
                element.setAttribute(attrName, value);
                if (STYLE_ATTR_NAMES.has(attrName)) {
                    (element as HTMLElement).style[attrName as any] = value;
                }
            }
        },
    };


    let api = createBasicFrameLoopAnimator(doc, adapter, callbacks);
    api = {
        ...api,
        "getRootElement": () => rootElement || null
    };
    if (config.trigger) setupAnimationTriggers(api, config.trigger);
    return api;
}
