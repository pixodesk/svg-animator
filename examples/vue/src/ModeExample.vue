<script setup lang="ts">
import { ref, computed } from 'vue';
import { PixodeskSvgAnimator, type VueAnimatorApi } from '@pixodesk/svg-animator-vue';
import type { PxAnimatedSvgDocument } from '@pixodesk/svg-animator-web';
import _animation from './animation.json';

type Mode = 'autoplay' | 'declarative' | 'imperative' | 'controlled';

const MODE_LABELS: Record<Mode, { title: string; description: string }> = {
    autoplay:    { title: 'Autoplay',              description: 'Uses triggers defined in the animation document.' },
    declarative: { title: 'Declarative play/pause', description: 'Controlled via boolean props.' },
    imperative:  { title: 'Imperative',             description: 'Full programmatic control via a ref-based API.' },
    controlled:  { title: 'Controlled time',        description: 'Renders a single frame at a given time.' },
};

const animation: PxAnimatedSvgDocument = _animation;

const props = defineProps<{ mode: Mode }>();

const label = computed(() => MODE_LABELS[props.mode]);

// Declarative state
const play = ref(false);
const pause = ref(false);

// Imperative state
const animatorRef = ref<VueAnimatorApi | null>(null);

// Controlled time state
const timeMs = ref(0);
</script>

<template>
    <div>
        <h2>{{ label.title }}</h2>
        <p>{{ label.description }}</p>

        <!-- Declarative controls -->
        <div v-if="mode === 'declarative'" style="display: flex; gap: 8px; margin-bottom: 8px">
            <button @click="play = !play">
                {{ play ? 'Play (on)' : 'Play (off)' }}
            </button>
            <button @click="pause = !pause">
                {{ pause ? 'Pause (on)' : 'Pause (off)' }}
            </button>
        </div>

        <!-- Imperative controls -->
        <div v-if="mode === 'imperative'" style="display: flex; gap: 8px; margin-bottom: 8px">
            <button @click="animatorRef?.play()">Play</button>
            <button @click="animatorRef?.pause()">Pause</button>
            <button @click="animatorRef?.cancel()">Cancel</button>
            <button @click="animatorRef?.finish()">Finish</button>
        </div>

        <!-- Controlled time controls -->
        <div v-if="mode === 'controlled'" style="margin-bottom: 8px">
            <label>
                Time (ms):&nbsp;
                <input
                    type="range"
                    :min="0"
                    :max="2000"
                    :value="timeMs"
                    @input="timeMs = Number(($event.target as HTMLInputElement).value)"
                />
                &nbsp;{{ timeMs }}ms
            </label>
        </div>

        <div style="width: 400px; height: 400px; border: 1px solid #ccc">
            <PixodeskSvgAnimator
                v-if="mode === 'autoplay'"
                :doc="animation"
                autoplay
            />
            <PixodeskSvgAnimator
                v-else-if="mode === 'declarative'"
                :doc="animation"
                :play="play"
                :pause="pause"
            />
            <PixodeskSvgAnimator
                v-else-if="mode === 'imperative'"
                ref="animatorRef"
                :doc="animation"
            />
            <PixodeskSvgAnimator
                v-else-if="mode === 'controlled'"
                :doc="animation"
                :timeMs="timeMs"
            />
        </div>
    </div>
</template>
