import { addFolder } from './pane';

export const FOLIAGE_CONFIG = {
	// --- Ground Foliage Settings ---
	bushCount: 60,
	bushPlaneCount: 120,
	bushRadius: 1.75,
	innerDensity: 1.5,

	// --- Tree Generation Settings ---
	treeCount: 10,
	treePlaneCount: 150,
	treeBushRadius: 2.2,

	// --- Global Wind Environment ---
	windSpeed: 0.5,
	swayIntensity: 0.25,
};

let initialized = false;
type Listener = () => void;
const listeners: Set<Listener> = new Set();

export const subscribeToFoliageConfig = (listener: Listener) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

const notify = () => {
	listeners.forEach(l => l());
};

export const setupFoliageControls = () => {
	if (initialized) return;
	const folder = addFolder('Foliage');
	if (!folder) return;

	folder.addBinding(FOLIAGE_CONFIG, 'bushCount', { min: 10, max: 200, step: 5 }).on('change', notify);
	folder.addBinding(FOLIAGE_CONFIG, 'bushPlaneCount', { min: 5, max: 150, step: 1 }).on('change', notify);
	folder.addBinding(FOLIAGE_CONFIG, 'bushRadius', { min: 0.2, max: 4.0, step: 0.05 }).on('change', notify);

	folder.addBinding(FOLIAGE_CONFIG, 'treeCount', { min: 5, max: 100, step: 1 }).on('change', notify);
	folder.addBinding(FOLIAGE_CONFIG, 'treePlaneCount', { min: 10, max: 200, step: 5 }).on('change', notify);
	folder.addBinding(FOLIAGE_CONFIG, 'treeBushRadius', { min: 0.5, max: 5.0, step: 0.1 }).on('change', notify);

	folder.addBinding(FOLIAGE_CONFIG, 'windSpeed', { min: 0.0, max: 2.0, step: 0.05 }).on('change', notify);
	folder.addBinding(FOLIAGE_CONFIG, 'swayIntensity', { min: 0.0, max: 1.0, step: 0.01 }).on('change', notify);

	initialized = true;
};
