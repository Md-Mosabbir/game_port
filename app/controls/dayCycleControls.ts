import { addFolder } from './pane';
import { DAY_CYCLE_CONFIG, DAY_CYCLE_PRESETS } from '@/app/systems/day-cycles';

// The live progress readout is refreshed on a timer rather than every frame —
// Tweakpane redraws the DOM slider on each refresh.
let progressBinding: { refresh: () => void } | null = null;
let lastRefresh = 0;

export const refreshDayCycleControls = () => {
	if (!progressBinding || DAY_CYCLE_CONFIG.manual) return;

	const now = performance.now();
	if (now - lastRefresh < 100) return;

	lastRefresh = now;
	progressBinding.refresh();
};

let initialized = false;

export const setupDayCycleControls = () => {
	if (initialized) return;

	const folder = addFolder('Day Cycles');
	if (folder) {
		folder.addBinding(DAY_CYCLE_CONFIG, 'enabled', { label: 'drive fog + light' });
		folder.addBinding(DAY_CYCLE_CONFIG, 'duration', { min: 5, max: 600, step: 1, label: 'duration (s)' });
		folder.addBinding(DAY_CYCLE_CONFIG, 'manual', { label: 'scrub by hand' });
		progressBinding = folder.addBinding(DAY_CYCLE_CONFIG, 'progress', { min: 0, max: 1, step: 0.001 });

		// Presets — editable so the keyframes can be retuned live.
		for (const presetKey of Object.keys(DAY_CYCLE_PRESETS) as (keyof typeof DAY_CYCLE_PRESETS)[]) {
			const preset = DAY_CYCLE_PRESETS[presetKey];
			const presetFolder = folder.addFolder({ title: presetKey, expanded: false });

			// Tweakpane cannot bind a THREE.Color directly, so bind a hex string
			// proxy and copy the value back on change.
			const addColorBinding = (key: 'lightColor' | 'shadowColor' | 'fogColorA' | 'fogColorB') => {
				const target = preset[key];
				const proxy = { value: `#${target.getHexString()}` };
				presetFolder.addBinding(proxy, 'value', { label: key }).on('change', (ev) => {
					target.set(ev.value);
				});
			};

			addColorBinding('lightColor');
			presetFolder.addBinding(preset, 'lightIntensity', { min: 0, max: 20, step: 0.01 });
			addColorBinding('shadowColor');
			addColorBinding('fogColorA');
			addColorBinding('fogColorB');
			presetFolder.addBinding(preset, 'fogNearRatio', { min: -2, max: 2, step: 0.001, label: 'fog near' });
			presetFolder.addBinding(preset, 'fogFarRatio', { min: -2, max: 2, step: 0.001, label: 'fog far' });
		}
	}

	initialized = true;
};
