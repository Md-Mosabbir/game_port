import { addFolder } from './pane';

export const GRASS_CONFIG = {
	clusterCount: 80,
	bladesPerCluster: 300,
	clusterSpread: 3.5,
	waveSpeed: 1.2,
	waveStrength: 0.22,
	bladeHeight: 0.8,
	bladeHeightVariance: 0.9,
	colorBase: '#5d7c3d', // Lighter warm green base
	colorTip: '#c2d66d',  // Bright sunny tip
};

export const DEBUG_CONFIG = {
    showDebugHUD: false,
    showTrackPlane: false,
    showAxes: false,
    showAxisDiag: false,
    showTrackCamera: false,
}

let initialized = false;
type Listener = () => void;
const listeners: Set<Listener> = new Set();

export const subscribeToGrassConfig = (listener: Listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

const notify = () => {
    listeners.forEach(l => l());
};

export const setupGrassControls = () => {
	if (initialized) return;
	const folder = addFolder('Grass');
	if (folder) {
        folder.addBinding(GRASS_CONFIG, 'clusterCount', { min: 20, max: 200, step: 1 }).on('change', notify);
        folder.addBinding(GRASS_CONFIG, 'bladesPerCluster', { min: 50, max: 800, step: 1 }).on('change', notify);
        folder.addBinding(GRASS_CONFIG, 'clusterSpread', { min: 1, max: 12, step: 0.1 }).on('change', notify);
        folder.addBinding(GRASS_CONFIG, 'waveSpeed', { min: 0.2, max: 3, step: 0.05 }).on('change', notify);
        folder.addBinding(GRASS_CONFIG, 'waveStrength', { min: 0.05, max: 0.5, step: 0.01 }).on('change', notify);
        folder.addBinding(GRASS_CONFIG, 'bladeHeight', { min: 0.1, max: 5.0, step: 0.1 }).on('change', notify);
        folder.addBinding(GRASS_CONFIG, 'bladeHeightVariance', { min: 0, max: 3.0, step: 0.1 }).on('change', notify);
        folder.addBinding(GRASS_CONFIG, 'colorBase', { view: 'color' }).on('change', notify);
        folder.addBinding(GRASS_CONFIG, 'colorTip', { view: 'color' }).on('change', notify);
    }

    const debugFolder = addFolder('World Debug');
    if (debugFolder) {
        debugFolder.addBinding(DEBUG_CONFIG, 'showDebugHUD').on('change', notify);
        debugFolder.addBinding(DEBUG_CONFIG, 'showTrackPlane').on('change', notify);
        debugFolder.addBinding(DEBUG_CONFIG, 'showAxes').on('change', notify);
        debugFolder.addBinding(DEBUG_CONFIG, 'showAxisDiag').on('change', notify);
        debugFolder.addBinding(DEBUG_CONFIG, 'showTrackCamera').on('change', notify);
    }

	initialized = true;
};

