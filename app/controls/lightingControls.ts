import { addFolder } from './pane';

export const LIGHTING_CONFIG = {
	gammaEnabled: true,
	exposure: 1.1,
	
	// Helpers
	showHelpers: false,

	// Ambient Light
	ambientColor: '#ffe4b3',
	ambientIntensity: 1.2,

	// Directional Light
	dirColor: '#ffe2d4',
	dirIntensity: 2.0,
	dirPosition: { x: 50, y: 100, z: 50 },
	
	// Shadow
	shadowAmplitude: 1024, // Map size
	shadowNear: 1,
	shadowDepth: 300, // Far
	shadowBias: -0.0001,
	shadowNormalBias: 0.02,
};

let initialized = false;

export const setupLightingControls = () => {
	if (initialized) return;
	
	// Environment folder
	const envFolder = addFolder('Environment');
	if (envFolder) {
		envFolder.addBinding(LIGHTING_CONFIG, 'gammaEnabled');
		envFolder.addBinding(LIGHTING_CONFIG, 'exposure', { min: 0.6, max: 1.6, step: 0.01 });
	}

	// Ambient Light folder
	const ambientFolder = addFolder('Ambient Light');
	if (ambientFolder) {
		ambientFolder.addBinding(LIGHTING_CONFIG, 'ambientColor');
		ambientFolder.addBinding(LIGHTING_CONFIG, 'ambientIntensity', { min: 0, max: 5, step: 0.01 });
	}
	
	// Directional Light folder
	const dirFolder = addFolder('Directional Light');
	if (dirFolder) {
		dirFolder.addBinding(LIGHTING_CONFIG, 'showHelpers', { label: 'Helpers (Toggle)' });
		dirFolder.addBinding(LIGHTING_CONFIG, 'dirColor');
		dirFolder.addBinding(LIGHTING_CONFIG, 'dirIntensity', { min: 0, max: 10, step: 0.1 });
		dirFolder.addBinding(LIGHTING_CONFIG, 'dirPosition', { 
			x: { min: -500, max: 500, step: 1 }, 
			y: { min: -500, max: 500, step: 1 }, 
			z: { min: -500, max: 500, step: 1 } 
		});
		
		dirFolder.addBinding(LIGHTING_CONFIG, 'shadowAmplitude', { min: 256, max: 4096, step: 256, label: 'Map Size' });
		dirFolder.addBinding(LIGHTING_CONFIG, 'shadowNear', { min: 0.1, max: 50, step: 0.1 });
		dirFolder.addBinding(LIGHTING_CONFIG, 'shadowDepth', { min: 50, max: 1000, step: 1 });
		dirFolder.addBinding(LIGHTING_CONFIG, 'shadowBias', { min: -0.01, max: 0.01, step: 0.0001 });
		dirFolder.addBinding(LIGHTING_CONFIG, 'shadowNormalBias', { min: -0.1, max: 0.1, step: 0.001 });
	}

	initialized = true;
};
