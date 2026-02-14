<script setup lang="ts">
import ModeExample from './ModeExample.vue';
import ModeExampleSwitchable from './ModeExampleSwitchable.vue';
</script>

<template>
    <div>
        <h1>Pixodesk Animator Vue Examples</h1>
        <div style="padding: 20px; display: flex; flex-direction: row; flex-wrap: wrap; gap: 32px">
            <ModeExample mode="autoplay" />
            <ModeExample mode="declarative" />
            <ModeExample mode="imperative" />
            <ModeExample mode="controlled" />
            <ModeExampleSwitchable />
        </div>
    </div>
</template>
