import { addFolder } from './pane';
import * as THREE from 'three';
import { uniform } from 'three/tsl';

export const FOG_CONFIG = {
	// Radial background gradient
	colorA: '#f8ead2',
	colorB: '#7fa6cc',
	radialCenter: { x: 0.5, y: 0.0 },
	radialStart: 0.0,
	radialEnd: 1.0,

	// Range fog
	near: 40,
	far: 180,
};

export const fogUniforms = {
	colorA: uniform(new THREE.Color(FOG_CONFIG.colorA)),
	colorB: uniform(new THREE.Color(FOG_CONFIG.colorB)),
	radialCenter: uniform(new THREE.Vector2(FOG_CONFIG.radialCenter.x, FOG_CONFIG.radialCenter.y)),
	radialStart: uniform(FOG_CONFIG.radialStart),
	radialEnd: uniform(FOG_CONFIG.radialEnd),
	near: uniform(FOG_CONFIG.near),
	far: uniform(FOG_CONFIG.far),
};

let initialized = false;

export const setupFogControls = () => {
	if (initialized) return;

	const folder = addFolder('Fog');
	if (folder) {
		folder.addBinding(FOG_CONFIG, 'colorA', { label: 'Color A' }).on('change', (ev) => {
			fogUniforms.colorA.value.set(ev.value);
		});
		folder.addBinding(FOG_CONFIG, 'colorB', { label: 'Color B' }).on('change', (ev) => {
			fogUniforms.colorB.value.set(ev.value);
		});
		folder.addBinding(FOG_CONFIG, 'radialCenter', {
			label: 'Gradient Center',
			x: { min: -1, max: 2, step: 0.01 },
			y: { min: -1, max: 2, step: 0.01 },
		}).on('change', (ev) => {
			fogUniforms.radialCenter.value.set(ev.value.x, ev.value.y);
		});
		folder.addBinding(FOG_CONFIG, 'radialStart', { min: 0, max: 2, step: 0.01, label: 'Gradient Start' }).on('change', (ev) => {
			fogUniforms.radialStart.value = ev.value;
		});
		folder.addBinding(FOG_CONFIG, 'radialEnd', { min: 0, max: 2, step: 0.01, label: 'Gradient End' }).on('change', (ev) => {
			fogUniforms.radialEnd.value = ev.value;
		});
		folder.addBinding(FOG_CONFIG, 'near', { min: 0, max: 400, step: 1 }).on('change', (ev) => {
			fogUniforms.near.value = ev.value;
		});
		folder.addBinding(FOG_CONFIG, 'far', { min: 1, max: 800, step: 1 }).on('change', (ev) => {
			fogUniforms.far.value = ev.value;
		});
	}

	initialized = true;
};
