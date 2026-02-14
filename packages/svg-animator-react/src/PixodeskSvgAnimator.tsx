import type { PxAnimatedSvgDocument, PxAnimatorAPI, PxNode, PxPlatformAdapter, PxTrigger } from '@pixodesk/svg-animator-web';
import { camelCaseToKebabWordIfNeeded, createAnimator, FillMode, generateNewIds, getNormalizedProps, STYLE_ATTR_NAMES } from '@pixodesk/svg-animator-web';
import type { CSSProperties, FC, ReactElement } from 'react';
import React, { createElement, useEffect, useImperativeHandle, useRef } from 'react';
import { useDepsVersion } from './Utils';


// -- Public types -----------------------------------------------------------

export interface ReactAnimatorApi {
    /** Returns true if the animation is currently running. */
    isPlaying(): boolean;

    /** Starts or resumes the animation. */
    play(): void;

    /** Pauses the animation at its current state. */
    pause(): void;

    /** Stops the animation and resets it to its initial state. */
    cancel(): void;

    /** Jumps to the end of the animation and holds the final state. */
    finish(): void;

    /** Returns the current playback time in milliseconds. */
    getCurrentTime(): number | null;

    /** Jumps to a specific time (in milliseconds) in the animation. */
    setCurrentTime(time: number): void;
}

export interface PixodeskSvgAnimatorImplProps {
    className?: string;
    style?: CSSProperties;
    doc: PxAnimatedSvgDocument;
    compMode: PixodeskSvgAnimatorCompMode;

    /** Imperative API handle populated by the inner component. */
    apiHolderRef: React.RefObject<PxAnimatorAPI | null>;
}

export interface PixodeskSvgAnimatorProps {

    className?: string;

    style?: CSSProperties;

    // -- Source ---------------------------------------------------------------

    /**
     * The animation document to render.
     *
     * TODO: Accept PxFileConfig | string to support URL-based loading, e.g.
     *   <PixodeskSvgAnimator doc="/animation.json" />
     */
    doc: PxAnimatedSvgDocument;

    // -- Timeline ------------------------------------------------------------

    timeline?: 'time' | 'scroll';

    // -- Rendering mode ------------------------------------------------------

    /** Forces a specific rendering engine. Defaults to 'auto'. */
    mode?: 'webapi' | 'frames' | 'auto';

    // -- Timing overrides ----------------------------------------------------

    /** Delay before the animation starts, in milliseconds. */
    delay?: number;

    /** Defines the element's style when the animation is not active. */
    fill?: FillMode;

    /** Number of iterations, or 'infinite' for endless looping. */
    iterations?: number | 'infinite';

    /** Duration of a single iteration in milliseconds. */
    duration?: number;

    /** Playback direction. */
    direction?: PlaybackDirection;

    /** Target frame rate (frames per second). */
    frameRate?: number;

    // -- Trigger overrides ---------------------------------------------------

    /** The event that starts the animation. When omitted, uses the value from the document config. */
    startOn?: 'load' | 'mouseOver' | 'click' | 'scrollIntoView' | 'programmatic';

    /** Behaviour when the trigger condition ends (e.g. mouse-out, second click). */
    outAction?: 'continue' | 'pause' | 'reset' | 'reverse';

    /** Visibility ratio (0.0–1.0) required to trigger a scrollIntoView animation. Defaults to 0.5. */
    scrollIntoViewThreshold?: number;

    // -- Declarative control -------------------------------------------------

    /** When true, uses triggers defined in the animation document. */
    autoplay?: boolean;

    /**
     * Starts the animation unconditionally, ignoring document triggers.
     * Equivalent to `startOn="load"` / `outAction="continue"`.
     */
    play?: boolean;

    /** Pauses current playback. Only meaningful when `play` or `autoplay` is set. */
    pause?: boolean;

    // -- Imperative control --------------------------------------------------

    /** Ref populated with the imperative playback API. */
    apiRef?: React.RefObject<ReactAnimatorApi | null>;

    // -- Controlled (external) time ------------------------------------------

    /** Seek to a specific point in the animation (fractional). */
    time?: number;

    /** Seek to a specific point in the animation (milliseconds). */
    timeMs?: number;

    // -- Callbacks -----------------------------------------------------------

    /** Called when the animation starts or resumes. */
    onPlay?: () => void;

    /** Called when the animation stops for any reason (pause / cancel / finish / removal). */
    onStop?: () => void; // FIXME: consider a more descriptive name

    /** Called when the animation is paused. */
    onPause?: () => void;

    /** Called when the animation is cancelled. */
    onCancel?: () => void;

    /** Called when the animation finishes naturally. */
    onFinish?: () => void;

    /** Called when the animation is removed. */
    onRemove?: () => void;

    // -- Diagnostics ---------------------------------------------------------

    onWarning?: (msg: string) => void;
    onError?: (msg: string) => void;
}


// -- Internal types ---------------------------------------------------------

enum PixodeskSvgAnimatorCompMode {
    static = 'static',
    autoplay = 'autoplay',
    play = 'play',
    imperativeApi = 'imperativeApi',
    fixedTime = 'fixedTime'
}


// -- React ↔ Animator bridge ------------------------------------------------

/**
 * Creates a platform adapter that routes animator attribute updates
 * to the corresponding React-managed DOM refs.
 */
export function createReactAdapter(elementRefs: React.RefObject<Map<string, any>>) {
    const warnedSelectors = new Set<string>();

    const adapter: PxPlatformAdapter = {
        isConnected: () => {
            return true;
        },
        setAttribute: (id, attrName, value) => {

            attrName = camelCaseToKebabWordIfNeeded(attrName);

            const selector = getSelector(id);

            const element = elementRefs.current.get(id);

            if (!element && !warnedSelectors.has(selector)) {
                warnedSelectors.add(selector);
                console.warn('setAttribute: No elements found for selector "' + selector + '"');
                console.warn(elementRefs.current);
            }

            if (element) {
                element.setAttribute(attrName, value);
                if (STYLE_ATTR_NAMES.has(attrName)) {
                    (element as HTMLElement).style[attrName as any] = value;
                }
            }
        },
    };
    return adapter;
}

export function getSelector(id: string) {
    return '#' + id;
}

// FIXME: add model validation (e.g. isElementFileJson check)


// -- Inner component (memoised, never re-renders) ---------------------------

const PixodeskSvgAnimatorImpl: FC<PixodeskSvgAnimatorImplProps> = ({
    className, style, doc, compMode, apiHolderRef
}) => {

    doc = generateNewIds(doc);

    const elementRefs = useRef(new Map<string, any>());

    const renderNode = (node: PxNode | undefined): ReactElement | null => {
        if (!node) return null;

        const { type, animate, meta, children, ...props } = node;

        const normProps = getNormalizedProps(props);

        normProps['ref'] = (domEl: any) => {
            console.log('MOUNTED');

            if (node['id']) elementRefs.current.set(node['id'], domEl);

            return () => {
                console.log('UN-MOUNTED');
            };
        };

        return createElement(type, normProps, children?.map(child => renderNode(child)));
    };

    const root = doc ? renderNode(doc) : null;

    // Create the animator once per document and tear it down on unmount.
    useEffect(() => {

        let api: PxAnimatorAPI | undefined = createAnimator(doc, createReactAdapter(elementRefs));
        apiHolderRef.current = api;

        return () => {
            api?.destroy();
            apiHolderRef.current = null;
        };
    }, [doc]);

    return root;
};

/** Memoised wrapper — the inner component never re-renders (props are stable by design). */
const PixodeskSvgAnimatorImplOnce = React.memo(
    PixodeskSvgAnimatorImpl,
    () => true // Don't re-render
);


// -- Main public component --------------------------------------------------

/**
 * React component for rendering and controlling Pixodesk SVG animations.
 *
 * Supports four mutually-exclusive control modes:
 *
 * 1. **Autoplay** – uses triggers from the animation document.
 *    ```tsx
 *    <PixodeskSvgAnimator doc={animation} autoplay />
 *    ```
 *
 * 2. **Declarative play/pause** – controlled via boolean props.
 *    ```tsx
 *    <PixodeskSvgAnimator doc={animation} play pause={false} />
 *    ```
 *
 * 3. **Imperative** – exposes a ref-based API for full programmatic control.
 *    ```tsx
 *    const api = useRef<ReactAnimatorApi>(null);
 *    <PixodeskSvgAnimator doc={animation} apiRef={api} />
 *    <button onClick={() => api.current?.play()}>Play</button>
 *    ```
 *
 * 4. **Controlled time** – renders a single frame at a given time.
 *    ```tsx
 *    <PixodeskSvgAnimator doc={animation} time={0.5} />
 *    <PixodeskSvgAnimator doc={animation} timeMs={500} />
 *    ```
 */
const PixodeskSvgAnimator: FC<PixodeskSvgAnimatorProps> = ({
    className, style,
    doc, autoplay, play, pause, time, timeMs, apiRef,
    timeline,

    // Overrides
    mode, delay, fill, iterations, duration, direction, frameRate,

    startOn, outAction, scrollIntoViewThreshold
}) => {

    // Determine which control mode is active.
    let compMode = PixodeskSvgAnimatorCompMode.static;
    if (apiRef) {
        compMode = PixodeskSvgAnimatorCompMode.imperativeApi;
    } else if (autoplay) {
        compMode = PixodeskSvgAnimatorCompMode.autoplay;
    } else if (time !== undefined || timeMs !== undefined) {
        compMode = PixodeskSvgAnimatorCompMode.fixedTime;
    } else {
        compMode = PixodeskSvgAnimatorCompMode.play;
    }

    // In non-autoplay modes, override the document trigger to 'programmatic'
    // so the component can manage playback itself.
    if (compMode !== PixodeskSvgAnimatorCompMode.autoplay) {
        const startOn = doc.animator?.trigger?.startOn;
        if (
            startOn &&
            startOn !== 'programmatic' // FIXME: use enum
        ) {
            doc = {
                ...doc,
                animator: {
                    ...doc.animator,
                    trigger: {
                        ...doc.animator?.trigger,
                        startOn: 'programmatic' // FIXME: use enum
                    }
                }
            };
        }
    }

    // Apply timing overrides from props onto the document config.
    if (
        mode !== undefined ||
        duration !== undefined ||
        delay !== undefined ||
        iterations !== undefined ||
        fill !== undefined ||
        direction !== undefined ||
        frameRate !== undefined
    ) {
        const animator = doc.animator || {};
        doc = {
            ...doc,
            animator: {
                ...animator,
                mode: mode !== undefined ? mode : animator.mode,
                duration: duration !== undefined ? duration : animator.duration,
                delay: delay !== undefined ? delay : animator.delay,
                iterations: iterations !== undefined ? iterations : animator.iterations,
                fill: fill !== undefined ? fill : animator.fill,
                direction: direction !== undefined ? direction : animator.direction,
                frameRate: frameRate !== undefined ? frameRate : animator.frameRate
            }
        };
    }

    // Apply trigger overrides from props.
    if (
        startOn !== undefined ||
        outAction !== undefined ||
        scrollIntoViewThreshold !== undefined
    ) {
        const trigger: PxTrigger = doc.animator?.trigger || {};
        doc = {
            ...doc,
            animator: {
                ...doc.animator,
                trigger: {
                    ...trigger,
                    startOn: startOn !== undefined ? startOn : trigger.startOn,
                    outAction: outAction !== undefined ? outAction : trigger.outAction,
                    scrollIntoViewThreshold: scrollIntoViewThreshold !== undefined ? scrollIntoViewThreshold : trigger.scrollIntoViewThreshold
                }
            }
        };
    }

    // In controlled-time mode, use a negative delay to seek to the given frame.
    if (compMode === PixodeskSvgAnimatorCompMode.fixedTime) {
        let delay = 0;
        if (time !== undefined) delay = -time; // FIXME: time as a fraction of total duration?
        if (timeMs !== undefined) delay = -timeMs;
        const animator = doc.animator || {};
        doc = {
            ...doc,
            animator: {
                ...animator,
                delay
            }
        };
    }

    console.log('doc', doc);

    const apiHolderRef = useRef<PxAnimatorAPI | null>(null);

    // Expose the imperative API via the consumer-provided ref.
    useImperativeHandle(apiRef, () => {
        return {
            isPlaying: () => apiHolderRef.current?.isPlaying() || false,
            play: () => apiHolderRef.current?.play(),
            pause: () => apiHolderRef.current?.pause(),
            cancel: () => apiHolderRef.current?.cancel(),
            finish: () => apiHolderRef.current?.finish(),
            getCurrentTime: () => apiHolderRef.current?.getCurrentTime() || null,
            setCurrentTime: (time: number) => apiHolderRef.current?.setCurrentTime(time),
        };
    }, []);

    // Sync declarative play/pause props with the animator.
    useEffect(() => {

        if (compMode === PixodeskSvgAnimatorCompMode.play) {
            if (play && !pause) {
                apiHolderRef.current?.play();
            } else if (pause) {
                apiHolderRef.current?.pause();
            } else {
                apiHolderRef.current?.finish();
            }
        }

        return () => {
            if (compMode === PixodeskSvgAnimatorCompMode.play) {
                apiHolderRef.current?.pause(); // FIXME - implement
            }
        };
    }, [compMode, play, pause]);

    // Increment key when the document or mode changes to force a full remount.
    const key = useDepsVersion(compMode, doc);

    return (
        <PixodeskSvgAnimatorImplOnce
            key={key}
            compMode={compMode}
            doc={doc}
            apiHolderRef={apiHolderRef}
        />
    );
};

export default PixodeskSvgAnimator;