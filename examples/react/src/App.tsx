import { PixodeskSvgAnimator, ReactAnimatorApi } from '@pixodesk/svg-animator-react';
import { FC, useRef, useState } from 'react';
import _animation from './animation.json';
import { PxAnimatedSvgDocument } from '@pixodesk/svg-animator-web';


const animation: PxAnimatedSvgDocument = _animation;

const boxStyle = { width: 400, height: 400, border: '1px solid #ccc' };

type Mode = 'autoplay' | 'declarative' | 'imperative' | 'controlled';

const MODE_LABELS: Record<Mode, { title: string; description: string }> = {
    autoplay:    { title: 'Autoplay',              description: 'Uses triggers defined in the animation document.' },
    declarative: { title: 'Declarative play/pause', description: 'Controlled via boolean props.' },
    imperative:  { title: 'Imperative',             description: 'Full programmatic control via a ref-based API.' },
    controlled:  { title: 'Controlled time',        description: 'Renders a single frame at a given time.' },
};

// -- Mode-specific controls ---------------------------------------------------

const DeclarativeControls: FC<{ play: boolean; pause: boolean; setPlay: (fn: (p: boolean) => boolean) => void; setPause: (fn: (p: boolean) => boolean) => void }> = ({ play, pause, setPlay, setPause }) => (
    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button onClick={() => setPlay(p => !p)}>
            {play ? 'Play (on)' : 'Play (off)'}
        </button>
        <button onClick={() => setPause(p => !p)}>
            {pause ? 'Pause (on)' : 'Pause (off)'}
        </button>
    </div>
);

const ImperativeControls: FC<{ api: React.RefObject<ReactAnimatorApi | null> }> = ({ api }) => (
    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button onClick={() => api.current?.play()}>Play</button>
        <button onClick={() => api.current?.pause()}>Pause</button>
        <button onClick={() => api.current?.cancel()}>Cancel</button>
        <button onClick={() => api.current?.finish()}>Finish</button>
    </div>
);

const ControlledTimeControls: FC<{ timeMs: number; setTimeMs: (v: number) => void }> = ({ timeMs, setTimeMs }) => (
    <div style={{ marginBottom: 8 }}>
        <label>
            Time (ms):&nbsp;
            <input
                type="range"
                min={0}
                max={2000}
                value={timeMs}
                onChange={e => setTimeMs(Number(e.target.value))}
            />
            &nbsp;{timeMs}ms
        </label>
    </div>
);

// -- ModeExample --------------------------------------------------------------

const ModeExample: FC<{ mode: Mode }> = ({ mode }) => {
    // Declarative state
    const [play, setPlay] = useState(false);
    const [pause, setPause] = useState(false);

    // Imperative state
    const api = useRef<ReactAnimatorApi | null>(null);

    // Controlled time state
    const [timeMs, setTimeMs] = useState(0);

    // Build props based on selected mode
    const modeProps =
        mode === 'autoplay'    ? { autoplay: true } :
        mode === 'declarative' ? { play, pause } :
        mode === 'imperative'  ? { apiRef: api } :
                                 { timeMs };

    const { title, description } = MODE_LABELS[mode];

    return (
        <div>
            <h2>{title}</h2>
            <p>{description}</p>

            {mode === 'declarative' && <DeclarativeControls play={play} pause={pause} setPlay={setPlay} setPause={setPause} />}
            {mode === 'imperative' && <ImperativeControls api={api} />}
            {mode === 'controlled' && <ControlledTimeControls timeMs={timeMs} setTimeMs={setTimeMs} />}

            <div style={boxStyle}>
                <PixodeskSvgAnimator doc={animation as any} {...modeProps} />
            </div>
        </div>
    );
};

// -- ModeExampleSwitchable ----------------------------------------------------

const ModeExampleSwitchable: FC = () => {
    const [mode, setMode] = useState<Mode>('autoplay');

    return (
        <div>
            <h2>Switchable mode</h2>
            <p>Single <code>&lt;PixodeskSvgAnimator/&gt;</code> — change mode via dropdown.</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <label>
                    Mode:&nbsp;
                    <select value={mode} onChange={e => setMode(e.target.value as Mode)}>
                        {Object.entries(MODE_LABELS).map(([key, { title }]) => (
                            <option key={key} value={key}>{title}</option>
                        ))}
                    </select>
                </label>
            </div>
            <ModeExample mode={mode} />
        </div>
    );
};

// -- App ----------------------------------------------------------------------

const App: FC<{}> = () => {
    return (
        <div>
            <h1>Pixodesk Animator React Examples</h1>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 32 }}>
                <ModeExample mode="autoplay" />                
                <ModeExample mode="declarative" />                
                <ModeExample mode="imperative" />
                <ModeExample mode="controlled" />
                <ModeExampleSwitchable />
            </div>
        </div>
    );
}

export default App;