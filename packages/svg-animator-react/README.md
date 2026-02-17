# animator-react

[![CI](https://github.com/pixodesk/pixodesk-svg-animator/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/pixodesk/pixodesk-svg-animator/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

React component for rendering and controlling Pixodesk SVG animations.


# 🚧 **Status - This project is currently under development.**

## Usage

```tsx
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-react';
import { PxAnimatedSvgDocument } from '@pixodesk/svg-animator-web';
import _animation from './animation.json';

const animation: PxAnimatedSvgDocument = _animation;
```

### Autoplay

Uses triggers defined in the animation document (load, click, hover, scroll):

```tsx
<PixodeskSvgAnimator doc={animation} autoplay />
```

### Declarative play/pause

Control playback with boolean props:

```tsx
const [play, setPlay] = useState(false);
const [pause, setPause] = useState(false);

<PixodeskSvgAnimator doc={animation} play={play} pause={pause} />
<button onClick={() => setPlay(p => !p)}>
  {play ? 'Play (on)' : 'Play (off)'}
</button>
<button onClick={() => setPause(p => !p)}>
  {pause ? 'Pause (on)' : 'Pause (off)'}
</button>
```

### Imperative API

Use a ref for full programmatic control:

```tsx
import { useRef } from 'react';
import type { ReactAnimatorApi } from '@pixodesk/svg-animator-react';

const api = useRef<ReactAnimatorApi>(null);

<PixodeskSvgAnimator doc={animation} apiRef={api} />
<button onClick={() => api.current?.play()}>Play</button>
<button onClick={() => api.current?.pause()}>Pause</button>
<button onClick={() => api.current?.cancel()}>Cancel</button>
<button onClick={() => api.current?.finish()}>Finish</button>
```

`ReactAnimatorApi` methods: `play()`, `pause()`, `cancel()`, `finish()`, `isPlaying()`, `getCurrentTime()`, `setCurrentTime(ms)`.

### Controlled time

Scrub through the animation with a slider or set a fixed frame:

```tsx
const [timeMs, setTimeMs] = useState(0);

<PixodeskSvgAnimator doc={animation} timeMs={timeMs} />
<input
  type="range"
  min={0}
  max={2000}
  value={timeMs}
  onChange={e => setTimeMs(Number(e.target.value))}
/>
```


## Props

| Prop | Type | Description |
|---|---|---|
| `doc` | `PxAnimatedSvgDocument` | The animation document to render (required) |
| `autoplay` | `boolean` | Use triggers from the document |
| `play` | `boolean` | Start playback, ignoring document triggers |
| `pause` | `boolean` | Pause current playback |
| `apiRef` | `RefObject<ReactAnimatorApi>` | Ref for imperative control |
| `time` | `number` | Seek to a fractional position |
| `timeMs` | `number` | Seek to a time in milliseconds |
| `mode` | `'auto' \| 'webapi' \| 'frames'` | Animation engine |
| `duration` | `number` | Duration override (ms) |
| `delay` | `number` | Delay before start (ms) |
| `iterations` | `number \| 'infinite'` | Loop count |
| `fill` | `FillMode` | Fill behaviour |
| `direction` | `PlaybackDirection` | Playback direction |
| `frameRate` | `number` | Target FPS |
| `startOn` | `'load' \| 'mouseOver' \| 'click' \| 'scrollIntoView' \| 'programmatic'` | Trigger event override |
| `outAction` | `'continue' \| 'pause' \| 'reset' \| 'reverse'` | Behaviour when trigger ends |
| `onPlay` | `() => void` | Called on play/resume |
| `onPause` | `() => void` | Called on pause |
| `onFinish` | `() => void` | Called on natural finish |
| `onCancel` | `() => void` | Called on cancel |
| `className` | `string` | CSS class |
| `style` | `CSSProperties` | Inline styles |