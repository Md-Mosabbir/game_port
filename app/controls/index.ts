import { setupCameraControls } from './cameraControls';
import { setupGrassControls } from './grassControls';
import { setupJeepControls } from './jeepControls';
import { setupLightingControls } from './lightingControls';
import { setupRoadControls } from './roadControls';
import { setupEnvironmentControls } from './environmentControls';
import { setupFoliageControls } from './foliageControls';
import { setupFogControls } from './fogControls';
import { setupDayCycleControls } from './dayCycleControls';
import { setupShadingControls } from './shadingControls';
import { setupTerrainControls } from './terrainControls';
import { setupWaterControls } from './waterControls';

let initialized = false;

export const initializeWorldControls = () => {
	if (initialized) return;
	setupGrassControls();
	setupRoadControls();
	setupCameraControls();
	setupLightingControls();
	setupJeepControls();
	setupEnvironmentControls();
	setupFoliageControls();
	setupFogControls();
	setupDayCycleControls();
	setupShadingControls();
	setupTerrainControls();
	setupWaterControls();
	initialized = true;
};
