# pixodesk-svg-animator

[![CI](https://github.com/pixodesk/pixodesk-svg-animator/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/pixodesk/pixodesk-svg-animator/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A lightweight JavaScript library for playing SVG animations in the browser. Pixodesk Animator runs animations created in the Pixodesk editor using the Web Animations API or requestAnimationFrame. It supports event triggers such as click, hover, and scroll. The library ships as ESM, CJS, and UMD bundles.

# 🚧 **Status - This project is currently under development.**


Official players for running <a href="https://pixodesk.com">Pixodesk SVG Animation</a> on the web.


# Overview

![Pixodesk SVG Animator Diagram](pixodesk-svg-animator--flow.drawio.svg)


## Overview 2


![Pixodesk SVG Animator Diagram](pixodesk-svg-animator--overview.drawio.svg)



# Pixodesk SVG Animator

## 📦 Export Options

The Pixodesk SVG Animator app provides two export formats:

- **SVG File** - For static inline/embed animated SVG with no external dependencies
- **JSON File** - For framework integrations (React/Vue) or dynamic animation control

---

## 🎨 SVG File Export

### Option 1: CSS Keyframe Animation
**Best for:** Minimal JavaScript, simple animations  
**Limitations:** Shape morph and complex animations not supported
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="...">
  <style>
    @keyframes _px_2s602utm {
      0% {transform:translate(200.1185px,41.3612px);}
      100% {transform:translate(200.1185px,41.3612px);}
    }
  </style>
  <g class="px-anim-element _px_2s602utn" transform="...">
    <ellipse id="_px_2s602utl" fill="#0087ff" ... />
  </g>
  <script data-px-script="true">
    /* Small script fragment to control animation */
  </script>
</svg>
```

### Option 2: JavaScript Animation
**Best for:** Full animation control, all animation types  
**Powered by:** `@pixodesk/svg-animator-web`  
**Engine:** Web Animation API (native) or Animation frames
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="...">
  <g id="_px_2s60omse" transform="translate(...">
    <ellipse id="_px_2s60omsd" fill="#0087ff" ... />
  </g>
  <script data-px-script="true">
    var a = PixodeskAnimator.createAnimator({
      "defs": {
        "animations": {
          "0": {
            "translate": {
              "keyframes": [
                {"t":0,"v":[200.1185,41.3612],"e":[0.3333,...]},
                {"t":1000,"v":[200.1185,41.3612]}
              ]
            }
          }
        },
        "bindings": [{"id":"_px_2s60omse","animate":...}]
      }
    });
  </script>
</svg>
```

### Embedding SVG Files

**Manual:** Copy-paste SVG content into HTML

**Framework-specific (build-time static):**

| Framework | Code |
|-----------|------|
| **Next.js** | `import Logo from './animation.svg';`<br/>`<Logo />` // with @svgr/webpack |
| **Nuxt/Vue** | `<component :is="require('./animation.svg?inline')" />` |
| **Astro** | `import Logo from './animation.svg?raw';`<br/>`<Fragment set:html={Logo} />` |
| **Jekyll** | `{% include_relative assets/animation.svg %}` |
| **WordPress** | `<?php echo file_get_contents(get_template_directory() . '/assets/animation.svg'); ?>` |
| **SvelteKit** | `{@html await import('./animation.svg?raw')}` |
| **11ty** | `{% include "animation.svg" %}` |

---

## 📄 JSON File Export

**Format:** Follows SVG structure with animation and metadata
```json
{
  "type": "svg",
  "viewBox": "0 0 400 400",
  "animator": {
    "duration": 1000,
    "iterations": "infinite",
    "mode": "auto",
    "trigger": { "startOn": "load" }
  },
  "children": [
    {
      "type": "ellipse",
      "fill": "#007fff85",
      "stroke": "#003a73",
      "transform": "translate(139.6604,163.8499)",
      "animate": {
        "translate": {
          "keyframes": [
            { "t": 0, "v": [139.6604, 163.8499] },
            { "t": 1000, "v": [139.6604, 310.3879] }
          ]
        }
      },
      "rx": 64.0253,
      "ry": 64.0253
    }
  ]
}
```

---

## ⚙️ Framework Integration

### Vanilla JavaScript / DOM
**Package:** `@pixodesk/svg-animator-web`

**Option 1: Data attribute (auto-load)**
```html
<div data-px-animation-src="/animation.json"></div>
<script src="pixodesk-svg-animator.umd.js"></script>
<script>
  PixodeskAnimator.loadTagAnimators();
</script>
```

**Option 2: Programmatic**
```html
<div id="container"></div>
<script src="pixodesk-svg-animator.umd.js"></script>
<script>
  fetch('/animation.json')
    .then(r => r.json())
    .then(doc => {
      PixodeskAnimator.createAnimator(doc, {
        container: document.getElementById('container')
      });
    });
</script>
```

### React / Next.js
**Package:** `@pixodesk/svg-animator-react`
```tsx
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-react';
import animation from './animation.json';

export default function App() {
  return <PixodeskSvgAnimator doc={animation} autoplay />;
}
```

### Vue / Nuxt
**Package:** `@pixodesk/svg-animator-vue`
```vue
<template>
  <PixodeskSvgAnimator :doc="animationDoc" autoplay />
</template>

<script setup>
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-vue';
import animation from './animation.json';

const animationDoc = animation;
</script>
```

---

## 📚 Quick Decision Guide

| Use Case | Format | Package |
|----------|--------|---------|
| Static website, no framework | SVG (CSS) | None |
| Need all animation types | SVG (JS) | `@pixodesk/svg-animator-web` |
| React/Next.js app | JSON | `@pixodesk/svg-animator-react` |
| Vue/Nuxt app | JSON | `@pixodesk/svg-animator-vue` |
| Dynamic control needed | JSON | Framework-specific |
| Build-time static embed | SVG | Framework import |

# Packages

| Package                                                        | Description                                                            |
| -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **[@pixodesk/svg-animator-web](packages/svg-animator-web/README.md)**       | Web player — works in browser |
| **[@pixodesk/svg-animator-react](packages/svg-animator-react/README.md)**   | React component                                                        |
| **[@pixodesk/svg-animator-vue](packages/svg-animator-vue/README.md)**       | Vue component                                                          |


## Examples

Examples in [`examples/`](examples/):

| Example                        | Package                                  |
| ------------------------------ | ---------------------------------------- |
| [web](examples/web/)           | `@pixodesk/svg-animator-web`             |
| [react](examples/react/)       | `@pixodesk/svg-animator-react`           |
| [vue](examples/vue/)           | `@pixodesk/svg-animator-vue`             |


## Live Examples

TODO

## License

[MIT](LICENSE) © [Pixodesk](https://pixodesk.com)