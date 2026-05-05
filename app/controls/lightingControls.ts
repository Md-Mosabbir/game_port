import { addFolder } from './pane';

export const LIGHTING_CONFIG = {
	fogNear: 40,
	fogFar: 180,
	fogColor: '#f8ead2',
	keyLightIntensity: 0.9,
	keyLightColor: '#ffe2d4',
	fillLightIntensity: 0.25,
	fillLightColor: '#fff4e6',
	bloomEnabled: true,
	bloomThreshold: 0.9,
	bloomStrength: 0.3,
	bloomRadius: 0.4,
	gammaEnabled: true,
	exposure: 1.1,
};

let initialized = false;

export const setupLightingControls = () => {
	if (initialized) return;
	const folder = addFolder('Lighting');
	if (!folder) return;
	folder.addBinding(LIGHTING_CONFIG, 'fogNear', { min: 10, max: 220, step: 1 });
	folder.addBinding(LIGHTING_CONFIG, 'fogFar', { min: 40, max: 420, step: 1 });
	folder.addBinding(LIGHTING_CONFIG, 'fogColor');
	folder.addBinding(LIGHTING_CONFIG, 'keyLightIntensity', { min: 0.1, max: 2, step: 0.01 });
	folder.addBinding(LIGHTING_CONFIG, 'keyLightColor');
	folder.addBinding(LIGHTING_CONFIG, 'fillLightIntensity', { min: 0, max: 1, step: 0.01 });
	folder.addBinding(LIGHTING_CONFIG, 'fillLightColor');
	folder.addBinding(LIGHTING_CONFIG, 'bloomEnabled');
	folder.addBinding(LIGHTING_CONFIG, 'bloomThreshold', { min: 0.6, max: 1.5, step: 0.01 });
	folder.addBinding(LIGHTING_CONFIG, 'bloomStrength', { min: 0, max: 1, step: 0.01 });
	folder.addBinding(LIGHTING_CONFIG, 'bloomRadius', { min: 0, max: 1, step: 0.01 });
	folder.addBinding(LIGHTING_CONFIG, 'gammaEnabled');
	folder.addBinding(LIGHTING_CONFIG, 'exposure', { min: 0.6, max: 1.6, step: 0.01 });
	initialized = true;
};
