import { setupCameraControls } from './cameraControls';
import { setupGrassControls } from './grassControls';
import { setupJeepControls } from './jeepControls';
import { setupLightingControls } from './lightingControls';
import { setupRoadControls } from './roadControls';
import { setupEnvironmentControls } from './environmentControls';

let initialized = false;

export const initializeWorldControls = () => {
	if (initialized) return;
	setupGrassControls();
	setupRoadControls();
	setupCameraControls();
	setupLightingControls();
	setupJeepControls();
	setupEnvironmentControls();
	initialized = true;
};
