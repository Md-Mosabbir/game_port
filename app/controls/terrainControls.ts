import { addFolder } from './pane';
import * as THREE from 'three';
import { uniform } from 'three/tsl';
import { TERRAIN_CONFIG, bakeTerrain } from '@/app/systems/terrain';

// Purely visual terrain settings — these are live uniforms, no rebake needed.
export const TERRAIN_VISUAL = {
	// Ground palette. Fully procedural now — no texture, so no tiling.
	grassColor: '#4c7838',    // Lush meadow
	grassDryColor: '#87914a', // Sun-bleached drift
	soilColor: '#5c4a34',     // Bare earth patches
	rockColor: '#6f6a5e',
	rockDarkColor: '#464236', // Darker strata band on cliffs
	aoStrength: 0.45,         // How dark hollows and creases go
	mossColor: '#38512a',     // Damp growth collecting in hollows
	pathColor: '#8f7d5e',     // Worn dirt trail
	pathEdgeColor: '#6b6244', // Scuffed grass at the edge of a trail
	pathWidth: 0.06,          // Half-width of the ribbon in noise units
	pathScale: 0.005,         // Lower = longer, lazier trails
	rockSlopeLow: 0.45,  // normal.y below this is fully rock
	rockSlopeHigh: 0.78, // above this is fully ground
	peakColor: '#c8c6bd',
	shoreColor: '#b9a888', // Wet sand at the water's edge
	siltColor: '#3d4a3a',  // Darker bed under the water
	detailScale: 0.9,
	detailStrength: 0.35,
	peakLow: 55,
	peakHigh: 90,

	// Vegetation limits. Grass and trees thin out on steep ground and high up,
	// which is what stops mountains looking like carpeted cones.
	slopeLimitLow: 0.62,
	slopeLimitHigh: 0.86,
	treeLineLow: 40,
	treeLineHigh: 62,

	// Paints the ground by sampled height instead of its normal colour. If this
	// shows a gradient while the ground stays flat, height sampling works in the
	// fragment stage but not the vertex stage.
	debugHeight: false,
};

export const terrainVisualUniforms = {
	grassColor: uniform(new THREE.Color(TERRAIN_VISUAL.grassColor)),
	grassDryColor: uniform(new THREE.Color(TERRAIN_VISUAL.grassDryColor)),
	soilColor: uniform(new THREE.Color(TERRAIN_VISUAL.soilColor)),
	rockColor: uniform(new THREE.Color(TERRAIN_VISUAL.rockColor)),
	rockDarkColor: uniform(new THREE.Color(TERRAIN_VISUAL.rockDarkColor)),
	aoStrength: uniform(TERRAIN_VISUAL.aoStrength),
	mossColor: uniform(new THREE.Color(TERRAIN_VISUAL.mossColor)),
	pathColor: uniform(new THREE.Color(TERRAIN_VISUAL.pathColor)),
	pathEdgeColor: uniform(new THREE.Color(TERRAIN_VISUAL.pathEdgeColor)),
	pathWidth: uniform(TERRAIN_VISUAL.pathWidth),
	pathScale: uniform(TERRAIN_VISUAL.pathScale),
	rockSlopeLow: uniform(TERRAIN_VISUAL.rockSlopeLow),
	rockSlopeHigh: uniform(TERRAIN_VISUAL.rockSlopeHigh),
	peakColor: uniform(new THREE.Color(TERRAIN_VISUAL.peakColor)),
	shoreColor: uniform(new THREE.Color(TERRAIN_VISUAL.shoreColor)),
	siltColor: uniform(new THREE.Color(TERRAIN_VISUAL.siltColor)),
	detailScale: uniform(TERRAIN_VISUAL.detailScale),
	detailStrength: uniform(TERRAIN_VISUAL.detailStrength),
	peakLow: uniform(TERRAIN_VISUAL.peakLow),
	peakHigh: uniform(TERRAIN_VISUAL.peakHigh),
	debugHeight: uniform(0),
	slopeLimitLow: uniform(TERRAIN_VISUAL.slopeLimitLow),
	slopeLimitHigh: uniform(TERRAIN_VISUAL.slopeLimitHigh),
	treeLineLow: uniform(TERRAIN_VISUAL.treeLineLow),
	treeLineHigh: uniform(TERRAIN_VISUAL.treeLineHigh),
};

// Shape changes have to be re-baked into the heightmap, which also invalidates
// the physics patch — so listeners can rebuild.
type Listener = () => void;
const listeners: Set<Listener> = new Set();

export const subscribeToTerrainBake = (listener: Listener) => {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
};

let rebakeTimer: ReturnType<typeof setTimeout> | null = null;

const scheduleRebake = () => {
	// Debounced: dragging a slider would otherwise bake on every frame.
	if (rebakeTimer) clearTimeout(rebakeTimer);
	rebakeTimer = setTimeout(() => {
		bakeTerrain();
		listeners.forEach((l) => l());
	}, 250);
};

let initialized = false;

export const setupTerrainControls = () => {
	if (initialized) return;

	const shapeFolder = addFolder('Terrain Shape');
	if (shapeFolder) {
		shapeFolder.addBinding(TERRAIN_CONFIG, 'mountainHeight', { min: 0, max: 250, step: 1 }).on('change', scheduleRebake);
		shapeFolder.addBinding(TERRAIN_CONFIG, 'mountainCells', { min: 1, max: 16, step: 1, label: 'mountain freq' }).on('change', scheduleRebake);
		shapeFolder.addBinding(TERRAIN_CONFIG, 'mountainSharpness', { min: 1, max: 8, step: 0.1 }).on('change', scheduleRebake);
		shapeFolder.addBinding(TERRAIN_CONFIG, 'rangeCells', { min: 1, max: 20, step: 1, label: 'range freq' }).on('change', scheduleRebake);
		shapeFolder.addBinding(TERRAIN_CONFIG, 'rangeLow', { min: 0, max: 1, step: 0.01, label: 'range spread' }).on('change', scheduleRebake);
		shapeFolder.addBinding(TERRAIN_CONFIG, 'rangeHigh', { min: 0, max: 1, step: 0.01, label: 'range falloff' }).on('change', scheduleRebake);
		shapeFolder.addBinding(TERRAIN_CONFIG, 'hillHeight', { min: 0, max: 60, step: 0.5 }).on('change', scheduleRebake);
		shapeFolder.addBinding(TERRAIN_CONFIG, 'hillCells', { min: 2, max: 80, step: 1, label: 'hill freq' }).on('change', scheduleRebake);
		shapeFolder.addBinding(TERRAIN_CONFIG, 'roughHeight', { min: 0, max: 25, step: 0.5 }).on('change', scheduleRebake);
		shapeFolder.addBinding(TERRAIN_CONFIG, 'roughCells', { min: 10, max: 200, step: 5, label: 'rough freq' }).on('change', scheduleRebake);
		shapeFolder.addBinding(TERRAIN_CONFIG, 'bumpHeight', { min: 0, max: 6, step: 0.05 }).on('change', scheduleRebake);
		shapeFolder.addBinding(TERRAIN_CONFIG, 'bumpCells', { min: 20, max: 400, step: 5, label: 'bump freq' }).on('change', scheduleRebake);
		shapeFolder.addBinding(TERRAIN_CONFIG, 'plainsBias', { min: 0, max: 1, step: 0.01, label: 'plains amount' }).on('change', scheduleRebake);
		shapeFolder.addBinding(TERRAIN_CONFIG, 'plainsCells', { min: 1, max: 30, step: 1, label: 'plains freq' }).on('change', scheduleRebake);
		shapeFolder.addBinding(TERRAIN_CONFIG, 'seed', { min: 1, max: 9999, step: 1 }).on('change', scheduleRebake);
		shapeFolder.addBinding(TERRAIN_CONFIG, 'flatRadius', { min: 0, max: 200, step: 1, label: 'spawn clearing' }).on('change', scheduleRebake);
	}

	const lookFolder = addFolder('Terrain Look');
	if (lookFolder) {
		lookFolder.addBinding(TERRAIN_VISUAL, 'grassColor', { label: 'meadow' }).on('change', (ev) => {
			terrainVisualUniforms.grassColor.value.set(ev.value);
		});
		lookFolder.addBinding(TERRAIN_VISUAL, 'grassDryColor', { label: 'dry drift' }).on('change', (ev) => {
			terrainVisualUniforms.grassDryColor.value.set(ev.value);
		});
		lookFolder.addBinding(TERRAIN_VISUAL, 'soilColor', { label: 'bare soil' }).on('change', (ev) => {
			terrainVisualUniforms.soilColor.value.set(ev.value);
		});
		lookFolder.addBinding(TERRAIN_VISUAL, 'rockDarkColor', { label: 'rock strata' }).on('change', (ev) => {
			terrainVisualUniforms.rockDarkColor.value.set(ev.value);
		});
		lookFolder.addBinding(TERRAIN_VISUAL, 'aoStrength', { min: 0, max: 1, step: 0.01, label: 'cavity shading' }).on('change', (ev) => {
			terrainVisualUniforms.aoStrength.value = ev.value;
		});
		lookFolder.addBinding(TERRAIN_VISUAL, 'rockColor').on('change', (ev) => {
			terrainVisualUniforms.rockColor.value.set(ev.value);
		});
		lookFolder.addBinding(TERRAIN_VISUAL, 'rockSlopeLow', { min: 0, max: 1, step: 0.01 }).on('change', (ev) => {
			terrainVisualUniforms.rockSlopeLow.value = ev.value;
		});
		lookFolder.addBinding(TERRAIN_VISUAL, 'rockSlopeHigh', { min: 0, max: 1, step: 0.01 }).on('change', (ev) => {
			terrainVisualUniforms.rockSlopeHigh.value = ev.value;
		});
		lookFolder.addBinding(TERRAIN_VISUAL, 'peakColor').on('change', (ev) => {
			terrainVisualUniforms.peakColor.value.set(ev.value);
		});
		lookFolder.addBinding(TERRAIN_VISUAL, 'peakLow', { min: 0, max: 250, step: 1 }).on('change', (ev) => {
			terrainVisualUniforms.peakLow.value = ev.value;
		});
		lookFolder.addBinding(TERRAIN_VISUAL, 'peakHigh', { min: 0, max: 250, step: 1 }).on('change', (ev) => {
			terrainVisualUniforms.peakHigh.value = ev.value;
		});

		lookFolder.addBinding(TERRAIN_VISUAL, 'shoreColor', { label: 'shoreline' }).on('change', (ev) => {
			terrainVisualUniforms.shoreColor.value.set(ev.value);
		});
		lookFolder.addBinding(TERRAIN_VISUAL, 'siltColor', { label: 'lake bed' }).on('change', (ev) => {
			terrainVisualUniforms.siltColor.value.set(ev.value);
		});
		lookFolder.addBinding(TERRAIN_VISUAL, 'detailScale', { min: 0.05, max: 4, step: 0.01, label: 'grain scale' }).on('change', (ev) => {
			terrainVisualUniforms.detailScale.value = ev.value;
		});
		lookFolder.addBinding(TERRAIN_VISUAL, 'detailStrength', { min: 0, max: 2, step: 0.01, label: 'grain strength' }).on('change', (ev) => {
			terrainVisualUniforms.detailStrength.value = ev.value;
		});
		lookFolder.addBinding(TERRAIN_VISUAL, 'debugHeight', { label: 'debug: height as colour' }).on('change', (ev) => {
			terrainVisualUniforms.debugHeight.value = ev.value ? 1 : 0;
		});
	}

	const pathFolder = addFolder('Paths');
	if (pathFolder) {
		pathFolder.addBinding(TERRAIN_VISUAL, 'pathColor', { label: 'dirt' }).on('change', (ev) => {
			terrainVisualUniforms.pathColor.value.set(ev.value);
		});
		pathFolder.addBinding(TERRAIN_VISUAL, 'pathEdgeColor', { label: 'scuffed edge' }).on('change', (ev) => {
			terrainVisualUniforms.pathEdgeColor.value.set(ev.value);
		});
		pathFolder.addBinding(TERRAIN_VISUAL, 'pathWidth', { min: 0, max: 0.3, step: 0.005, label: 'width' }).on('change', (ev) => {
			terrainVisualUniforms.pathWidth.value = ev.value;
		});
		pathFolder.addBinding(TERRAIN_VISUAL, 'pathScale', { min: 0.001, max: 0.03, step: 0.0005, label: 'winding' }).on('change', (ev) => {
			terrainVisualUniforms.pathScale.value = ev.value;
		});
		pathFolder.addBinding(TERRAIN_VISUAL, 'mossColor', { label: 'hollow moss' }).on('change', (ev) => {
			terrainVisualUniforms.mossColor.value.set(ev.value);
		});
	}

	const vegFolder = addFolder('Vegetation Limits');
	if (vegFolder) {
		vegFolder.addBinding(TERRAIN_VISUAL, 'slopeLimitLow', { min: 0, max: 1, step: 0.01, label: 'slope cutoff' }).on('change', (ev) => {
			terrainVisualUniforms.slopeLimitLow.value = ev.value;
		});
		vegFolder.addBinding(TERRAIN_VISUAL, 'slopeLimitHigh', { min: 0, max: 1, step: 0.01, label: 'slope full' }).on('change', (ev) => {
			terrainVisualUniforms.slopeLimitHigh.value = ev.value;
		});
		vegFolder.addBinding(TERRAIN_VISUAL, 'treeLineLow', { min: 0, max: 200, step: 1, label: 'tree line start' }).on('change', (ev) => {
			terrainVisualUniforms.treeLineLow.value = ev.value;
		});
		vegFolder.addBinding(TERRAIN_VISUAL, 'treeLineHigh', { min: 0, max: 200, step: 1, label: 'tree line end' }).on('change', (ev) => {
			terrainVisualUniforms.treeLineHigh.value = ev.value;
		});
	}

	initialized = true;
};
