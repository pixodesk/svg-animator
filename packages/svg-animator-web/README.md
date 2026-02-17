# animator-web

[![CI](https://github.com/pixodesk/pixodesk-svg-animator/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/pixodesk/pixodesk-svg-animator/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A lightweight JavaScript library for playing SVG animations in the browser. Pixodesk Animator runs animations created in the Pixodesk editor using the Web Animations API or requestAnimationFrame. It supports event triggers such as click, hover, and scroll. The library ships as ESM, CJS, and UMD bundles.


# 🚧 **Status - This project is currently under development.**

## Usage

### Embed/Inline SVG with animation

```html
<body>
  <svg width="200" height="200" viewBox="0 0 200 200">
    <!-- animation here -->
  </svg>
</body>
```

#### CSS Keyframes

```html
<body>
  <svg width="200" height="200" viewBox="0 0 200 200">
    <!-- animation here -->
  </svg>
</body>
```

#### JS


### Declarative (HTML)

Add a `data-px-animation-src` attribute to any element pointing to your animation JSON file, then call `loadTagAnimators()`:

```html
<div data-px-animation-src="/animation.json"></div>

<!-- UMD -->
<script src="pixodesk-svg-animator.umd.js"></script>
<script>
  PixodeskAnimator.loadTagAnimators();
</script>
```

Each element gets an animator instance stored on `element._px_animator`, which you can use for playback control.

### Programmatic

Use `createAnimator` for full control:

```js
import { createAnimator } from '@pixodesk/svg-animator-web';

// From a URL — returns a proxy that queues calls until the document is fetched
const animator = createAnimator('/animation.json', undefined, {
  onFinish: () => console.log('done'),
}, '#container');

// Or from an already-loaded document object
const animator = createAnimator(animationDoc, undefined, undefined, '#container');

animator.play();
animator.pause();
animator.setCurrentTime(500);   // seek to 500ms
animator.setPlaybackRate(2);    // 2x speed
animator.finish();              // jump to end
animator.destroy();             // cleanup
```

### API

`createAnimator(docOrUrl, adapter?, callbacks?, containerElement?)` returns a `PxAnimatorAPI`:

| Method                  | Description                                                       |
| ----------------------- | ----------------------------------------------------------------- |
| `play()`                | Start or resume playback                                          |
| `pause()`               | Pause at the current time                                         |
| `cancel()`              | Stop and reset to the start                                       |
| `finish()`              | Jump to the end                                                   |
| `setPlaybackRate(rate)` | Change speed (1 = normal, 2 = double, -1 = reverse)               |
| `getCurrentTime()`      | Current time in ms                                                |
| `setCurrentTime(ms)`    | Seek to a specific time                                           |
| `isPlaying()`           | Whether the animation is currently playing                        |
| `isReady()`             | Whether the document has loaded (relevant for URL-based creation) |
| `getRootElement()`      | The rendered SVG DOM element                                      |
| `destroy()`             | Remove the animation and clean up                                 |

### Callbacks

```js
createAnimator(doc, undefined, {
  onPlay:   () => { /* started/resumed */ },
  onPause:  () => { /* paused */ },
  onCancel: () => { /* cancelled */ },
  onFinish: () => { /* finished */ },
  onRemove: () => { /* cleaned up */ },
}, '#container');
```

