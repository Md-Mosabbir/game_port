import { addFolder } from './pane';

export const GRASS_CONFIG = {
	clusterCount: 80,
	bladesPerCluster: 300,
	clusterSpread: 3.5,
	waveSpeed: 1.2,
	waveStrength: 0.22,
	colorBase: '#5d7c3d', // Lighter warm green base
	colorTip: '#c2d66d',  // Bright sunny tip
};

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
	if (!folder) return;
	folder.addBinding(GRASS_CONFIG, 'clusterCount', { min: 20, max: 200, step: 1 }).on('change', notify);
	folder.addBinding(GRASS_CONFIG, 'bladesPerCluster', { min: 50, max: 800, step: 1 }).on('change', notify);
	folder.addBinding(GRASS_CONFIG, 'clusterSpread', { min: 1, max: 12, step: 0.1 }).on('change', notify);
	folder.addBinding(GRASS_CONFIG, 'waveSpeed', { min: 0.2, max: 3, step: 0.05 }).on('change', notify);
	folder.addBinding(GRASS_CONFIG, 'waveStrength', { min: 0.05, max: 0.5, step: 0.01 }).on('change', notify);
	folder.addBinding(GRASS_CONFIG, 'colorBase', { view: 'color' }).on('change', notify);
	folder.addBinding(GRASS_CONFIG, 'colorTip', { view: 'color' }).on('change', notify);
	initialized = true;
};
