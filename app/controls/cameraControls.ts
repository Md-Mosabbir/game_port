import { addFolder } from './pane';

export const CAMERA_CONFIG = {
	offsetX: -10,
	offsetY: 8,
	offsetZ: 10,
	lerpSpeed: 0.1,
};

let initialized = false;

export const setupCameraControls = () => {
	if (initialized) return;
	const folder = addFolder('Camera');
	if (!folder) return;
	folder.addBinding(CAMERA_CONFIG, 'offsetX', { min: -25, max: 5, step: 0.1 });
	folder.addBinding(CAMERA_CONFIG, 'offsetY', { min: 3, max: 20, step: 0.1 });
	folder.addBinding(CAMERA_CONFIG, 'offsetZ', { min: -5, max: 25, step: 0.1 });
	folder.addBinding(CAMERA_CONFIG, 'lerpSpeed', { min: 0.01, max: 0.25, step: 0.005 });
	initialized = true;
};
