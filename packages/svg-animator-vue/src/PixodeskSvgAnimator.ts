import type { PxAnimatedSvgDocument, PxAnimatorAPI, PxNode, PxPlatformAdapter, PxTrigger } from '@pixodesk/svg-animator-web';
import { camelCaseToKebabWordIfNeeded, createAnimator, FillMode, generateNewIds, getNormalizedProps, STYLE_ATTR_NAMES } from '@pixodesk/svg-animator-web';
import {
    computed, defineComponent, h, onMounted, onUnmounted, ref, shallowRef, type PropType, type VNode,
    watch,
} from 'vue';


// -- Public types -----------------------------------------------------------

export interface VueAnimatorApi {
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


// -- Internal types ---------------------------------------------------------

enum CompMode {
    static = 'static',
    autoplay = 'autoplay',
    play = 'play',
    fixedTime = 'fixedTime'
}


// -- Vue ↔ Animator bridge --------------------------------------------------

/**
 * Creates a platform adapter that routes animator attribute updates
 * to the corresponding Vue-managed DOM element refs.
 */
function createVueAdapter(elementRefs: Map<string, Element>) {
    const warnedSelectors = new Set<string>();

    const adapter: PxPlatformAdapter = {
        isConnected: () => true,
        setAttribute: (id, attrName, value) => {
            attrName = camelCaseToKebabWordIfNeeded(attrName);

            const element = elementRefs.get(id);

            if (!element && !warnedSelectors.has(id)) {
                warnedSelectors.add(id);
                console.warn('setAttribute: No elements found for id "' + id + '"');
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

// FIXME: add model validation (e.g. isElementFileJson check)


// -- Helper: apply doc overrides --------------------------------------------

interface DocOverrideProps {
    mode?: 'webapi' | 'frames' | 'auto';
    delay?: number;
    fill?: FillMode;
    iterations?: number | 'infinite';
    duration?: number;
    direction?: PlaybackDirection;
    frameRate?: number;
    startOn?: 'load' | 'mouseOver' | 'click' | 'scrollIntoView' | 'programmatic';
    outAction?: 'continue' | 'pause' | 'reset' | 'reverse';
    scrollIntoViewThreshold?: number;
    time?: number;
    timeMs?: number;
}

function applyDocOverrides(
    doc: PxAnimatedSvgDocument,
    props: DocOverrideProps,
    compMode: CompMode,
): PxAnimatedSvgDocument {

    // In non-autoplay modes, override the document trigger to 'programmatic'
    // so the component can manage playback itself.
    if (compMode !== CompMode.autoplay) {
        const docStartOn = doc.animator?.trigger?.startOn;
        if (docStartOn && docStartOn !== 'programmatic') { // FIXME: use enum
            doc = {
                ...doc,
                animator: {
                    ...doc.animator,
                    trigger: { ...doc.animator?.trigger, startOn: 'programmatic' }
                }
            };
        }
    }

    // Apply timing overrides from props onto the document config.
    const { mode, duration, delay, iterations, fill, direction, frameRate } = props;
    if (
        mode !== undefined || duration !== undefined || delay !== undefined ||
        iterations !== undefined || fill !== undefined || direction !== undefined ||
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
                frameRate: frameRate !== undefined ? frameRate : animator.frameRate,
            }
        };
    }

    // Apply trigger overrides from props.
    const { startOn, outAction, scrollIntoViewThreshold } = props;
    if (startOn !== undefined || outAction !== undefined || scrollIntoViewThreshold !== undefined) {
        const trigger: PxTrigger = doc.animator?.trigger || {};
        doc = {
            ...doc,
            animator: {
                ...doc.animator,
                trigger: {
                    ...trigger,
                    startOn: startOn !== undefined ? startOn : trigger.startOn,
                    outAction: outAction !== undefined ? outAction : trigger.outAction,
                    scrollIntoViewThreshold: scrollIntoViewThreshold !== undefined ? scrollIntoViewThreshold : trigger.scrollIntoViewThreshold,
                }
            }
        };
    }

    // In controlled-time mode, use a negative delay to seek to the given frame.
    if (compMode === CompMode.fixedTime) {
        let seekDelay = 0;
        if (props.time !== undefined) seekDelay = -props.time; // FIXME: time as a fraction of total duration?
        if (props.timeMs !== undefined) seekDelay = -props.timeMs;
        const animator = doc.animator || {};
        doc = { ...doc, animator: { ...animator, delay: seekDelay } };
    }

    return doc;
}


// -- Main public component --------------------------------------------------

/**
 * Vue component for rendering and controlling Pixodesk SVG animations.
 *
 * Supports four mutually-exclusive control modes:
 *
 * 1. **Autoplay** – uses triggers from the animation document.
 *    ```vue
 *    <PixodeskSvgAnimator :doc="animation" autoplay />
 *    ```
 *
 * 2. **Declarative play/pause** – controlled via boolean props.
 *    ```vue
 *    <PixodeskSvgAnimator :doc="animation" play :pause="false" />
 *    ```
 *
 * 3. **Imperative** – exposes a ref-based API for full programmatic control.
 *    ```vue
 *    <PixodeskSvgAnimator :doc="animation" ref="animator" />
 *    <button @click="$refs.animator.play()">Play</button>
 *    ```
 *
 * 4. **Controlled time** – renders a single frame at a given time.
 *    ```vue
 *    <PixodeskSvgAnimator :doc="animation" :time="0.5" />
 *    <PixodeskSvgAnimator :doc="animation" :timeMs="500" />
 *    ```
 */
const PixodeskSvgAnimator = defineComponent({
    name: 'PixodeskSvgAnimator',

    props: {
        // -- Source
        doc: { type: Object as PropType<PxAnimatedSvgDocument>, required: true },

        // -- Timeline
        timeline: { type: String as PropType<'time' | 'scroll'> },

        // -- Rendering mode
        mode: { type: String as PropType<'webapi' | 'frames' | 'auto'> },

        // -- Timing overrides
        delay: { type: Number },
        fill: { type: String as PropType<FillMode> },
        iterations: { type: [Number, String] as PropType<number | 'infinite'> },
        duration: { type: Number },
        direction: { type: String as PropType<PlaybackDirection> },
        frameRate: { type: Number },

        // -- Trigger overrides
        startOn: { type: String as PropType<'load' | 'mouseOver' | 'click' | 'scrollIntoView' | 'programmatic'> },
        outAction: { type: String as PropType<'continue' | 'pause' | 'reset' | 'reverse'> },
        scrollIntoViewThreshold: { type: Number },

        // -- Declarative control
        autoplay: { type: Boolean, default: undefined },
        play: { type: Boolean, default: undefined },
        pause: { type: Boolean, default: undefined },

        // -- Controlled time
        time: { type: Number },
        timeMs: { type: Number },
    },

    emits: ['play', 'stop', 'pause', 'cancel', 'finish', 'remove', 'warning', 'error'],

    setup(props, { expose }) {
        const elementRefs = new Map<string, Element>();
        const apiRef = shallowRef<PxAnimatorAPI | null>(null);

        // -- Determine control mode ---------------------------------------------

        const compMode = computed<CompMode>(() => {
            if (props.autoplay) return CompMode.autoplay;
            if (props.time !== undefined || props.timeMs !== undefined) return CompMode.fixedTime;
            if (props.play !== undefined) return CompMode.play;
            return CompMode.static;
        });

        // -- Prepare the document with overrides --------------------------------

        const resolvedDoc = computed(() => {
            let doc = generateNewIds(props.doc);
            return applyDocOverrides(doc, props, compMode.value);
        });

        // -- Render the SVG node tree -------------------------------------------

        function renderNode(node: PxNode | undefined): VNode | null {
            if (!node) return null;

            const { type, animate, meta, children, ...attrs } = node;
            const normProps = getNormalizedProps(attrs);

            // Capture a ref to each element with an id.
            if (node['id']) {
                const nodeId = node['id'];
                normProps['ref'] = (el: Element | null) => {
                    if (el) {
                        elementRefs.set(nodeId, el);
                    } else {
                        elementRefs.delete(nodeId);
                    }
                };
            }

            const childVNodes = children?.map(child => renderNode(child)).filter(Boolean) as VNode[] | undefined;
            return h(type, normProps, childVNodes);
        }

        // -- Animator lifecycle -------------------------------------------------

        function createApi() {
            destroyApi();
            const doc = resolvedDoc.value;
            if (!doc) return;
            apiRef.value = createAnimator(doc, createVueAdapter(elementRefs));
        }

        function destroyApi() {
            apiRef.value?.destroy();
            apiRef.value = null;
        }

        // Create the animator once DOM refs are available.
        onMounted(() => createApi());

        // Recreate the animator when the resolved doc changes.
        watch(resolvedDoc, () => createApi());

        // Sync declarative play/pause props with the animator.
        watch([compMode, () => props.play, () => props.pause], () => {
            if (compMode.value === CompMode.play) {
                if (props.play && !props.pause) {
                    apiRef.value?.play();
                } else if (props.pause) {
                    apiRef.value?.pause();
                } else {
                    apiRef.value?.finish();
                }
            }
        });

        onUnmounted(() => {
            destroyApi();
        });

        // -- Expose imperative API ----------------------------------------------

        const publicApi: VueAnimatorApi = {
            isPlaying: () => apiRef.value?.isPlaying() || false,
            play: () => apiRef.value?.play(),
            pause: () => apiRef.value?.pause(),
            cancel: () => apiRef.value?.cancel(),
            finish: () => apiRef.value?.finish(),
            getCurrentTime: () => apiRef.value?.getCurrentTime() || null,
            setCurrentTime: (time: number) => apiRef.value?.setCurrentTime(time),
        };

        expose(publicApi);

        // -- Render -------------------------------------------------------------

        return () => {
            const doc = resolvedDoc.value;
            return doc ? renderNode(doc) : null;
        };
    },
});

export default PixodeskSvgAnimator;
