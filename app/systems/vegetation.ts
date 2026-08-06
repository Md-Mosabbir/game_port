import { float, vec2 } from 'three/tsl';
import { terrainHeightNode } from './terrain';
import { terrainVisualUniforms } from '@/app/controls/terrainControls';
import { waterUniforms } from '@/app/controls/waterControls';

// ─────────────────────────────────────────────────────────────────────────────
// Where plants are allowed to grow.
//
// Returns 0..1: 1 on flat, low ground, falling to 0 on cliffs and above the
// tree line. Grass collapses by it, trees and bushes scale by it.
//
// The slope is measured with two extra height taps rather than a full normal
// (four), because this runs per vertex on every blade of grass.
// ─────────────────────────────────────────────────────────────────────────────

// TSL node graphs are not meaningfully typeable across these helpers.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TSLNode = any;

const SLOPE_EPSILON = 2.0;

export const vegetationMaskNode = (xz: TSLNode, height: TSLNode) => {
	const hx = terrainHeightNode(xz.add(vec2(SLOPE_EPSILON, 0)));
	const hz = terrainHeightNode(xz.add(vec2(0, SLOPE_EPSILON)));

	// Gradient of the surface, converted to the same measure the terrain
	// material uses for rock: the Y component of the normal.
	const gradient = vec2(hx.sub(height), hz.sub(height)).div(SLOPE_EPSILON);
	const normalY = float(1).div(gradient.lengthSq().add(1).sqrt());

	const slopeMask = normalY.smoothstep(terrainVisualUniforms.slopeLimitLow, terrainVisualUniforms.slopeLimitHigh);
	const altitudeMask = height
		.smoothstep(terrainVisualUniforms.treeLineLow, terrainVisualUniforms.treeLineHigh)
		.oneMinus();

	// Nothing grows below the water line, and it thins out just above it.
	const shoreMask = height.smoothstep(waterUniforms.level, waterUniforms.level.add(1.5));

	return slopeMask.mul(altitudeMask).mul(shoreMask);
};
