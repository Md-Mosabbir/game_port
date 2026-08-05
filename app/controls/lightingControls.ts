import { addFolder } from './pane';

export const LIGHTING_CONFIG = {
	gammaEnabled: true,
	exposure: 1.1,
	
	// Helpers
	showHelpers: false,

	// Ambient Light
	ambientColor: '#ffe4b3',
	ambientIntensity: 1.2,

	// Directional Light (used when the day cycle is not driving it)
	dirColor: '#ffe2d4',
	dirIntensity: 2.0,

	// Sun placement — spherical coordinates around the camera focus point.
	// With useDayCycles on, theta/phi swing around these base angles.
	useDayCycles: true,
	phi: 0.63,
	theta: 0.72,
	phiAmplitude: 0.62,
	thetaAmplitude: 1.25,
	radius: 120,

	// Shadow
	// Texel size = (shadowExtent * 2) / shadowMapSize. Keep it small — a wide
	// extent is what makes shadows look blocky.
	shadowMapSize: 2048,
	shadowExtent: 60, // Ortho frustum half size
	shadowNear: 1,
	shadowDepth: 260, // Far = near + depth
	shadowBias: -0.0002,
	shadowNormalBias: 0.04,
	shadowRadius: 3,
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

		dirFolder.addBinding(LIGHTING_CONFIG, 'useDayCycles', { label: 'Animate w/ Day Cycle' });
		dirFolder.addBinding(LIGHTING_CONFIG, 'phi', { min: 0, max: Math.PI * 0.5, step: 0.001 });
		dirFolder.addBinding(LIGHTING_CONFIG, 'theta', { min: -Math.PI, max: Math.PI, step: 0.001 });
		dirFolder.addBinding(LIGHTING_CONFIG, 'phiAmplitude', { min: 0, max: Math.PI, step: 0.001 });
		dirFolder.addBinding(LIGHTING_CONFIG, 'thetaAmplitude', { min: -Math.PI, max: Math.PI, step: 0.001 });
		dirFolder.addBinding(LIGHTING_CONFIG, 'radius', { min: 10, max: 500, step: 1 });

		dirFolder.addBinding(LIGHTING_CONFIG, 'shadowMapSize', { min: 256, max: 4096, step: 256, label: 'Map Size' });
		dirFolder.addBinding(LIGHTING_CONFIG, 'shadowExtent', { min: 10, max: 400, step: 1 });
		dirFolder.addBinding(LIGHTING_CONFIG, 'shadowNear', { min: 0.1, max: 50, step: 0.1 });
		dirFolder.addBinding(LIGHTING_CONFIG, 'shadowDepth', { min: 50, max: 1000, step: 1 });
		dirFolder.addBinding(LIGHTING_CONFIG, 'shadowBias', { min: -0.01, max: 0.01, step: 0.0001 });
		dirFolder.addBinding(LIGHTING_CONFIG, 'shadowNormalBias', { min: -0.1, max: 0.1, step: 0.001 });
		dirFolder.addBinding(LIGHTING_CONFIG, 'shadowRadius', { min: 0, max: 10, step: 0.1 });
	}

	initialized = true;
};
