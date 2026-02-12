/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { PxAnimatorAPI, PxTrigger } from './PxAnimatorTypes';


/**
 * Sets up event-based triggers for an animation.
 *
 * This function attaches event listeners to the animation's root element based on the
 * provided configuration, allowing animations to be started by user interactions
 * or visibility changes.
 *
 * ### Trigger Options (startOn):
 * - 'load': Starts after the page loads.
 * - 'mouseOver': Starts on mouse enter.
 * - 'click': Toggles play/end action on click.
 * - 'scrollIntoView': Starts when the element scrolls into the viewport.
 * - 'programmatic': No automatic start. Must be controlled via the API.
 *
 * ### End Action Options (outAction):
 * Defines behavior when the trigger condition ends (e.g., mouse leave).
 * - 'continue': Animation continues playing.
 * - 'pause': Pauses the animation.
 * - 'reset': Cancels the animation, resetting it to the start.
 * - 'reverse': Reverses the animation playback.
 *
 * @param {!PxAnimatorAPI} api The animator API instance to control.
 * @param {!PxTrigger} config The trigger configuration object.
 * @returns {!PxAnimatorAPI} The same animator API instance, for chaining.
 */
export function setupAnimationTriggers(
    api: PxAnimatorAPI,
    config: PxTrigger
): PxAnimatorAPI {
    const { startOn, outAction = 'continue', scrollIntoViewThreshold = 0.5 } = config;

    const root = api.getRootElement();

    if (!root) {
        console.warn('setupAnimationTriggers: No root element found for animation.');
        return api;
    }

    /** Ensures forward playback and starts or resumes the animation. */
    const start = () => {
        api.play();
    };

    /** Handles what to do when the element leaves the active trigger condition. */
    const handleEndAction = () => {
        switch (outAction) {
            case 'pause':
                api.pause();
                break;
            case 'reset':
                api.cancel();
                break;
            case 'reverse':
                // If reverse playback is implemented, this would set a negative playback rate.
                // For now we just call play() for compatibility.
                // api.setPlaybackRate(-1);
                api.play();
                break;
            case 'continue':
            default:
                // Do nothing
                break;
        }
    };

    // ---- Setup event-based start logic ----
    switch (startOn) {
        case 'load': {
            const startHandler = () => start();
            if (document.readyState === 'complete') {
                startHandler();
            } else {
                window.addEventListener('load', startHandler, { once: true });
            }
            break;
        }

        case 'mouseOver': {
            const mouseOverHandler = () => start();
            const mouseOutHandler = () => handleEndAction();

            root.addEventListener('mouseenter', mouseOverHandler);
            root.addEventListener('mouseleave', mouseOutHandler);
            break;
        }

        case 'click': {
            const clickHandler = () => {
                if (api.isPlaying()) {
                    handleEndAction();
                } else {
                    start();
                }
            };
            root.addEventListener('click', clickHandler);
            break;
        }

        case 'scrollIntoView': {
            const observer = new IntersectionObserver(
                entries => {
                    entries.forEach(entry => {
                        // If the element is at least partially visible
                        if (entry.isIntersecting && entry.intersectionRatio >= scrollIntoViewThreshold) {
                            start();
                        } else {
                            // Element scrolled off screen -> trigger handleEndAction
                            handleEndAction();
                        }
                    });
                },
                { threshold: scrollIntoViewThreshold }
            );
            observer.observe(root);
            break;
        }

        case 'programmatic':
            // No auto-start; external code must call play()
            break;
    }

    return api;
}
