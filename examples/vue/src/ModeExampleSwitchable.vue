<script setup lang="ts">
import { ref } from 'vue';
import ModeExample from './ModeExample.vue';

type Mode = 'autoplay' | 'declarative' | 'imperative' | 'controlled';

const MODE_OPTIONS: { value: Mode; label: string }[] = [
    { value: 'autoplay',    label: 'Autoplay' },
    { value: 'declarative', label: 'Declarative play/pause' },
    { value: 'imperative',  label: 'Imperative' },
    { value: 'controlled',  label: 'Controlled time' },
];

const mode = ref<Mode>('autoplay');
</script>

<template>
    <div>
        <h2>Switchable mode</h2>
        <p>Single <code>&lt;PixodeskSvgAnimator/&gt;</code> — change mode via dropdown.</p>
        <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px">
            <label>
                Mode:&nbsp;
                <select v-model="mode">
                    <option v-for="opt in MODE_OPTIONS" :key="opt.value" :value="opt.value">
                        {{ opt.label }}
                    </option>
                </select>
            </label>
        </div>
        <ModeExample :mode="mode" />
    </div>
</template>
