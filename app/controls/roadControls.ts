import { addFolder } from './pane';

export const ROAD_CONFIG = {
	chunkLength: 80,
	roadWidth: 12,
	curveStrength: 14,
	laneMarkingVisible: false,
	cobbleColor: '#7a7a7a',
	mortarColor: '#3a3a3a',
	stoneScale: 6,
	roughness: 0.8,
};

let initialized = false;

export const setupRoadControls = () => {
	if (initialized) return;
	const folder = addFolder('Road');
	if (!folder) return;

	folder.addBinding(ROAD_CONFIG, 'chunkLength', { min: 50, max: 140, step: 5 });
	folder.addBinding(ROAD_CONFIG, 'roadWidth', { min: 4, max: 16, step: 0.5 });
	folder.addBinding(ROAD_CONFIG, 'curveStrength', { min: 3, max: 24, step: 0.5 });
	folder.addBinding(ROAD_CONFIG, 'laneMarkingVisible', { label: 'Lane Markings' });
	
	const cobbleFolder = folder.addFolder({ title: 'Cobblestone Look', expanded: true });
	cobbleFolder.addBinding(ROAD_CONFIG, 'cobbleColor', { label: 'Stone Color' });
	cobbleFolder.addBinding(ROAD_CONFIG, 'mortarColor', { label: 'Mortar Color' });
	cobbleFolder.addBinding(ROAD_CONFIG, 'stoneScale', { min: 1, max: 20, step: 0.5, label: 'Stone Size' });
	cobbleFolder.addBinding(ROAD_CONFIG, 'roughness', { min: 0, max: 1, step: 0.05, label: 'Roughness' });
	
	initialized = true;
};
