import { addFolder } from './pane';
import * as THREE from 'three';
import { float, uniform } from 'three/tsl';

// ─────────────────────────────────────────────────────────────────────────────
// Shading uniforms — port of folio-2025's `Lighting.setNodes()`.
//
// These feed `applyFolioShading()`: the stylised diffusion (core shadow), the
// bounce light coming off the ground, and the tinted shadow colour. The light
// direction / colour / intensity are written every frame by WorldLighting.
// ─────────────────────────────────────────────────────────────────────────────

export const SHADING_CONFIG = {
	// Light bounce — warm, picked off the coral ground so it reads as bounced
	// ground light rather than a coloured rim.
	bounceColor: '#e8926b',
	lightBounceEdgeLow: -1,
	lightBounceEdgeHigh: 1,
	lightBounceDistance: 1.5,
	lightBounceMultiplier: 1,

	// Core shadow (the stylised diffusion term)
	coreShadowEdgeLow: -0.25,
	coreShadowEdgeHigh: 1,

	// Shadow colour when the day cycle is not driving it
	shadowColor: '#7d8ed4',

	// Cloud shadows drifting across the world. Applied inside the shared shading
	// pass, so ground, grass, trees and bushes all darken together — which is
	// what sells it as cloud rather than a texture.
	cloudScale: 0.0035,
	cloudSpeed: 0.55,
	cloudCoverage: 0.52,
	cloudSoftness: 0.22,
	cloudDarkness: 0.62,

	// Foliage catching light from behind, the way real leaves do.
	translucencyColor: '#c8ff8a',
	translucencyStrength: 0.85,
};

export const shadingUniforms = {
	// Written by WorldLighting
	lightDirection: uniform(new THREE.Vector3(0, 1, 0)),
	lightColor: uniform(new THREE.Color('#ffffff')),
	lightIntensity: uniform(1),
	shadowColor: uniform(new THREE.Color(SHADING_CONFIG.shadowColor)),

	// Light bounce
	bounceColor: uniform(new THREE.Color(SHADING_CONFIG.bounceColor)),
	lightBounceEdgeLow: uniform(float(SHADING_CONFIG.lightBounceEdgeLow)),
	lightBounceEdgeHigh: uniform(float(SHADING_CONFIG.lightBounceEdgeHigh)),
	lightBounceDistance: uniform(float(SHADING_CONFIG.lightBounceDistance)),
	lightBounceMultiplier: uniform(float(SHADING_CONFIG.lightBounceMultiplier)),

	// Clouds
	cloudScale: uniform(SHADING_CONFIG.cloudScale),
	cloudSpeed: uniform(SHADING_CONFIG.cloudSpeed),
	cloudCoverage: uniform(SHADING_CONFIG.cloudCoverage),
	cloudSoftness: uniform(SHADING_CONFIG.cloudSoftness),
	cloudDarkness: uniform(SHADING_CONFIG.cloudDarkness),

	// Translucency
	translucencyColor: uniform(new THREE.Color(SHADING_CONFIG.translucencyColor)),
	translucencyStrength: uniform(SHADING_CONFIG.translucencyStrength),

	// Core shadow
	coreShadowEdgeLow: uniform(float(SHADING_CONFIG.coreShadowEdgeLow)),
	coreShadowEdgeHigh: uniform(float(SHADING_CONFIG.coreShadowEdgeHigh)),
};

let initialized = false;

export const setupShadingControls = () => {
	if (initialized) return;

	const bounceFolder = addFolder('Light Bounce');
	if (bounceFolder) {
		bounceFolder.addBinding(SHADING_CONFIG, 'bounceColor', { label: 'color' }).on('change', (ev) => {
			shadingUniforms.bounceColor.value.set(ev.value);
		});
		bounceFolder.addBinding(SHADING_CONFIG, 'lightBounceEdgeLow', { min: -1, max: 1, step: 0.01, label: 'edge low' }).on('change', (ev) => {
			shadingUniforms.lightBounceEdgeLow.value = ev.value;
		});
		bounceFolder.addBinding(SHADING_CONFIG, 'lightBounceEdgeHigh', { min: -1, max: 1, step: 0.01, label: 'edge high' }).on('change', (ev) => {
			shadingUniforms.lightBounceEdgeHigh.value = ev.value;
		});
		bounceFolder.addBinding(SHADING_CONFIG, 'lightBounceDistance', { min: 0, max: 20, step: 0.01, label: 'distance' }).on('change', (ev) => {
			shadingUniforms.lightBounceDistance.value = ev.value;
		});
		bounceFolder.addBinding(SHADING_CONFIG, 'lightBounceMultiplier', { min: 0, max: 1, step: 0.01, label: 'multiplier' }).on('change', (ev) => {
			shadingUniforms.lightBounceMultiplier.value = ev.value;
		});
	}

	const diffusionFolder = addFolder('Diffusion');
	if (diffusionFolder) {
		diffusionFolder.addBinding(SHADING_CONFIG, 'coreShadowEdgeLow', { min: -1, max: 1, step: 0.01, label: 'core shadow low' }).on('change', (ev) => {
			shadingUniforms.coreShadowEdgeLow.value = ev.value;
		});
		diffusionFolder.addBinding(SHADING_CONFIG, 'coreShadowEdgeHigh', { min: -1, max: 1, step: 0.01, label: 'core shadow high' }).on('change', (ev) => {
			shadingUniforms.coreShadowEdgeHigh.value = ev.value;
		});
		diffusionFolder.addBinding(SHADING_CONFIG, 'shadowColor', { label: 'shadow color' }).on('change', (ev) => {
			shadingUniforms.shadowColor.value.set(ev.value);
		});
	}

	const cloudFolder = addFolder('Cloud Shadows');
	if (cloudFolder) {
		cloudFolder.addBinding(SHADING_CONFIG, 'cloudScale', { min: 0.0005, max: 0.02, step: 0.0005, label: 'size' }).on('change', (ev) => {
			shadingUniforms.cloudScale.value = ev.value;
		});
		cloudFolder.addBinding(SHADING_CONFIG, 'cloudSpeed', { min: 0, max: 5, step: 0.01, label: 'drift' }).on('change', (ev) => {
			shadingUniforms.cloudSpeed.value = ev.value;
		});
		cloudFolder.addBinding(SHADING_CONFIG, 'cloudCoverage', { min: 0, max: 1, step: 0.01, label: 'coverage' }).on('change', (ev) => {
			shadingUniforms.cloudCoverage.value = ev.value;
		});
		cloudFolder.addBinding(SHADING_CONFIG, 'cloudSoftness', { min: 0.01, max: 0.6, step: 0.01, label: 'edge softness' }).on('change', (ev) => {
			shadingUniforms.cloudSoftness.value = ev.value;
		});
		cloudFolder.addBinding(SHADING_CONFIG, 'cloudDarkness', { min: 0, max: 1, step: 0.01, label: 'depth' }).on('change', (ev) => {
			shadingUniforms.cloudDarkness.value = ev.value;
		});
		cloudFolder.addBinding(SHADING_CONFIG, 'translucencyColor', { label: 'leaf glow' }).on('change', (ev) => {
			shadingUniforms.translucencyColor.value.set(ev.value);
		});
		cloudFolder.addBinding(SHADING_CONFIG, 'translucencyStrength', { min: 0, max: 3, step: 0.01, label: 'leaf glow amount' }).on('change', (ev) => {
			shadingUniforms.translucencyStrength.value = ev.value;
		});
	}

	initialized = true;
};
