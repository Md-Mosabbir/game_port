import { addFolder } from './pane';

export const FOLIAGE_CONFIG = {
	// How far out trees and bushes are scattered. The grass field stays small
	// (it is only legible up close), but foliage was covering a 90 unit box
	// around the camera while the terrain and fog now run to several hundred —
	// which is what made the world feel like a small stage.
	foliageFieldSize: 320,

	// --- Ground Foliage Settings ---
	bushCount: 170,
	bushPlaneCount: 120,
	bushRadius: 1.75,
	innerDensity: 1.5,

	// --- Tree Generation Settings ---
	treeCount: 150,
	treePlaneCount: 210,
	treeBushRadius: 4.2,
	treeHeight: 12.0,
	// Where the canopy centre sits, as a multiple of trunk height. This used to
	// be a fixed "+5 units above the trunk top", which silently changes the tree's
	// proportions whenever treeHeight moves: at the original height of 7 that
	// worked out to 1.71x, but at 12 it collapsed to 1.42x and the canopy sank
	// into the branches. As a ratio it holds its shape at any tree height.
	canopyHeightFrac: 1.71,

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

	folder.addBinding(FOLIAGE_CONFIG, 'foliageFieldSize', { min: 60, max: 600, step: 10, label: 'scatter radius' }).on('change', notify);
	folder.addBinding(FOLIAGE_CONFIG, 'bushCount', { min: 10, max: 400, step: 5 }).on('change', notify);
	folder.addBinding(FOLIAGE_CONFIG, 'bushPlaneCount', { min: 5, max: 150, step: 1 }).on('change', notify);
	folder.addBinding(FOLIAGE_CONFIG, 'bushRadius', { min: 0.2, max: 4.0, step: 0.05 }).on('change', notify);

	folder.addBinding(FOLIAGE_CONFIG, 'treeCount', { min: 5, max: 400, step: 1 }).on('change', notify);
	folder.addBinding(FOLIAGE_CONFIG, 'treePlaneCount', { min: 10, max: 400, step: 5 }).on('change', notify);
	folder.addBinding(FOLIAGE_CONFIG, 'treeBushRadius', { min: 0.5, max: 5.0, step: 0.1 }).on('change', notify);
	folder.addBinding(FOLIAGE_CONFIG, 'treeHeight', { min: 2.0, max: 40.0, step: 0.5 }).on('change', notify);
	folder.addBinding(FOLIAGE_CONFIG, 'canopyHeightFrac', { min: 0.5, max: 3.0, step: 0.01, label: 'canopy height' }).on('change', notify);

	folder.addBinding(FOLIAGE_CONFIG, 'windSpeed', { min: 0.0, max: 2.0, step: 0.05 }).on('change', notify);
	folder.addBinding(FOLIAGE_CONFIG, 'swayIntensity', { min: 0.0, max: 1.0, step: 0.01 }).on('change', notify);

	initialized = true;
};
