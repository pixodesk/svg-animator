# animator-react
React component for rendering and controlling Pixodesk SVG animations.


# 🚧 **Status - This project is currently under development.**

## Usage

```tsx
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-react';
import animationDoc from './animation.json';
```

### Autoplay

Uses triggers defined in the animation document (load, click, hover, scroll):

```tsx
<PixodeskSvgAnimator doc={animationDoc} autoplay />
```

### Declarative play/pause

Control playback with boolean props:

```tsx
const [paused, setPaused] = useState(false);

<PixodeskSvgAnimator doc={animationDoc} play pause={paused} />
<button onClick={() => setPaused(p => !p)}>Toggle</button>
```

### Imperative API

Use a ref for full programmatic control:

```tsx
import { useRef } from 'react';
import type { ReactAnimatorApi } from '@pixodesk/svg-animator-react';

const api = useRef<ReactAnimatorApi>(null);

<PixodeskSvgAnimator doc={animationDoc} apiRef={api} />
<button onClick={() => api.current?.play()}>Play</button>
<button onClick={() => api.current?.pause()}>Pause</button>
```

`ReactAnimatorApi` methods: `play()`, `pause()`, `cancel()`, `finish()`, `isPlaying()`, `getCurrentTime()`, `setCurrentTime(ms)`.

### Controlled time

Render a single frame at a specific point in time:

```tsx
<PixodeskSvgAnimator doc={animationDoc} time={0.5} />
<PixodeskSvgAnimator doc={animationDoc} timeMs={500} />
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