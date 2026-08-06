import { addFolder } from './pane';
import * as THREE from 'three';
import { uniform } from 'three/tsl';

// ─────────────────────────────────────────────────────────────────────────────
// Water
//
// There is no water geometry per lake. One flat grid follows the camera and
// discards every fragment where the terrain sits above the water line, so the
// lakes are exactly the terrain's low ground — they cost nothing to place and
// they can never disagree with the landscape.
// ─────────────────────────────────────────────────────────────────────────────

export const WATER_CONFIG = {
	// Sea level. The terrain bottoms out around -16, so this decides how much of
	// the world is lake.
	level: -4.5,

	shallowColor: '#5fbfa8',
	deepColor: '#123f52',
	foamColor: '#eaf7f4',
	deepDistance: 7, // depth at which the colour is fully "deep"
	opacity: 0.86,

	foamWidth: 1.1,
	waveHeight: 0.13,
	waveScale: 0.09,
	waveSpeed: 0.35,
	rippleStrength: 0.55,

	// How much the water drags on the car, per frame at 60fps, and how much
	// engine force still gets through.
	drag: 0.94,
	powerFactor: 0.35,
};

export const waterUniforms = {
	level: uniform(WATER_CONFIG.level),
	shallowColor: uniform(new THREE.Color(WATER_CONFIG.shallowColor)),
	deepColor: uniform(new THREE.Color(WATER_CONFIG.deepColor)),
	foamColor: uniform(new THREE.Color(WATER_CONFIG.foamColor)),
	deepDistance: uniform(WATER_CONFIG.deepDistance),
	opacity: uniform(WATER_CONFIG.opacity),
	foamWidth: uniform(WATER_CONFIG.foamWidth),
	waveHeight: uniform(WATER_CONFIG.waveHeight),
	waveScale: uniform(WATER_CONFIG.waveScale),
	waveSpeed: uniform(WATER_CONFIG.waveSpeed),
	rippleStrength: uniform(WATER_CONFIG.rippleStrength),
};

let initialized = false;

export const setupWaterControls = () => {
	if (initialized) return;

	const folder = addFolder('Water');
	if (folder) {
		folder.addBinding(WATER_CONFIG, 'level', { min: -20, max: 20, step: 0.1, label: 'sea level' }).on('change', (ev) => {
			waterUniforms.level.value = ev.value;
		});
		folder.addBinding(WATER_CONFIG, 'shallowColor').on('change', (ev) => {
			waterUniforms.shallowColor.value.set(ev.value);
		});
		folder.addBinding(WATER_CONFIG, 'deepColor').on('change', (ev) => {
			waterUniforms.deepColor.value.set(ev.value);
		});
		folder.addBinding(WATER_CONFIG, 'foamColor').on('change', (ev) => {
			waterUniforms.foamColor.value.set(ev.value);
		});
		folder.addBinding(WATER_CONFIG, 'deepDistance', { min: 0.5, max: 30, step: 0.1 }).on('change', (ev) => {
			waterUniforms.deepDistance.value = ev.value;
		});
		folder.addBinding(WATER_CONFIG, 'opacity', { min: 0, max: 1, step: 0.01 }).on('change', (ev) => {
			waterUniforms.opacity.value = ev.value;
		});
		folder.addBinding(WATER_CONFIG, 'foamWidth', { min: 0, max: 6, step: 0.05, label: 'shoreline foam' }).on('change', (ev) => {
			waterUniforms.foamWidth.value = ev.value;
		});
		folder.addBinding(WATER_CONFIG, 'waveHeight', { min: 0, max: 1, step: 0.01 }).on('change', (ev) => {
			waterUniforms.waveHeight.value = ev.value;
		});
		folder.addBinding(WATER_CONFIG, 'waveScale', { min: 0.01, max: 0.6, step: 0.005 }).on('change', (ev) => {
			waterUniforms.waveScale.value = ev.value;
		});
		folder.addBinding(WATER_CONFIG, 'waveSpeed', { min: 0, max: 2, step: 0.01 }).on('change', (ev) => {
			waterUniforms.waveSpeed.value = ev.value;
		});
		folder.addBinding(WATER_CONFIG, 'rippleStrength', { min: 0, max: 2, step: 0.01 }).on('change', (ev) => {
			waterUniforms.rippleStrength.value = ev.value;
		});
		folder.addBinding(WATER_CONFIG, 'drag', { min: 0.5, max: 1, step: 0.005, label: 'water drag' });
		folder.addBinding(WATER_CONFIG, 'powerFactor', { min: 0, max: 1, step: 0.01, label: 'power in water' });
	}

	initialized = true;
};
