import * as THREE from 'three';
import { int, ivec2, mix, textureLoad, uniform, vec2, vec3 } from 'three/tsl';

// ─────────────────────────────────────────────────────────────────────────────
// Endless terrain
//
// The world is infinite, so there is no baked world-sized heightmap the way
// folio does it (its terrain is a fixed 192-unit texture). Instead one tile of
// periodic noise is baked once and repeated forever.
//
// Everything that touches the ground has to agree on the height — the ground
// mesh, the physics heightfield, grass, trees, bushes, the camera. So the tile
// is baked on the CPU into a Float32Array AND uploaded as a texture, and both
// samplers use the same bilinear filter over the same data. The CPU array is
// stored after a half-float round trip, so it matches what the GPU reads to the
// bit rather than drifting by a few centimetres.
//
// Repetition: the tile is `period` units across (3072 by default, several
// minutes of driving). It repeats, but nothing about the world is bounded.
// ─────────────────────────────────────────────────────────────────────────────

export const TERRAIN_CONFIG = {
	// Bake settings. Changing these requires a rebake (the Tweakpane bindings do
	// it for you). period / resolution = world units per sample.
	// 2048 / 1024 = 2 units per sample. Finer than this and the bake gets slow;
	// coarser and the bumps alias away.
	period: 2048,
	resolution: 1024,
	seed: 1337,

	// Mountains. Ridged noise (not plain FBM) so ranges get sharp crests
	// instead of soft blobs, gated by a low-frequency mask so they form
	// ranges with open country between them.
	mountainHeight: 155,
	mountainCells: 9,
	mountainSharpness: 4.8,
	rangeCells: 4,
	// Narrow band = mountains are rare. Most of the world stays low and
	// drivable; only ~3% of the land rises above 20m, but where it does it
	// goes all the way up.
	rangeLow: 0.63,
	rangeHigh: 0.88,

	// Hills: the mid-scale rolling, flattened inside plains regions.
	hillHeight: 18,
	hillCells: 20,

	// Rough: mid-scale choppiness. This is what stops the ground reading as a
	// smooth sheet when you look across it.
	roughHeight: 4.5,
	roughCells: 60,

	// Bumps: what you actually feel through the suspension.
	bumpHeight: 2.2,
	bumpCells: 190,

	// Plains: a low-frequency mask marking flat, open regions.
	plainsCells: 6,
	plainsBias: 0.42,

	// Flat clearing so the spawn point is never inside a mountain. Small — a
	// large one reads as "the terrain is broken" when you start in the middle.
	flatRadius: 18,
	flatFalloff: 40,
};

// TSL node graphs are not meaningfully typeable across these helpers.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TSLNode = any;

// ── Noise ────────────────────────────────────────────────────────────────────
// Value noise on an integer lattice that wraps at `cells`, which is what makes
// the tile seamless. CPU only — it runs at bake time, never per frame.

const hash2 = (x: number, y: number, seed: number) => {
	let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(seed, 0x9e3779b1);
	h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
	h ^= h >>> 13;
	h = Math.imul(h, 0xc2b2ae35);
	h ^= h >>> 16;
	return (h >>> 0) / 4294967296;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const smoothstep = (edge0: number, edge1: number, x: number) => {
	if (edge0 === edge1) return x < edge0 ? 0 : 1;
	const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
	return t * t * (3 - 2 * t);
};

// u, v are normalised tile coordinates. Returns 0..1.
const valueNoise = (u: number, v: number, cells: number, seed: number) => {
	const fx = u * cells;
	const fy = v * cells;
	const i0 = Math.floor(fx);
	const j0 = Math.floor(fy);
	const tx = fx - i0;
	const ty = fy - j0;
	const sx = tx * tx * (3 - 2 * tx);
	const sy = ty * ty * (3 - 2 * ty);

	const wrap = (value: number) => ((value % cells) + cells) % cells;
	const ia = wrap(i0);
	const ib = wrap(i0 + 1);
	const ja = wrap(j0);
	const jb = wrap(j0 + 1);

	const n00 = hash2(ia, ja, seed);
	const n10 = hash2(ib, ja, seed);
	const n01 = hash2(ia, jb, seed);
	const n11 = hash2(ib, jb, seed);

	return lerp(lerp(n00, n10, sx), lerp(n01, n11, sx), sy);
};

const fbm = (u: number, v: number, cells: number, octaves: number, seed: number) => {
	let amplitude = 1;
	let total = 0;
	let norm = 0;
	let octaveCells = cells;

	for (let o = 0; o < octaves; o++) {
		total += valueNoise(u, v, octaveCells, seed + o * 101) * amplitude;
		norm += amplitude;
		amplitude *= 0.5;
		octaveCells *= 2;
	}

	return total / norm;
};

// The terrain shape itself, in world units.
const shapeHeight = (u: number, v: number, worldX: number, worldZ: number) => {
	const c = TERRAIN_CONFIG;

	// Mountains — ridged noise (fold the range about its middle so the crease
	// becomes a crest), gated to the regions the range mask picks out.
	const range = smoothstep(c.rangeLow, c.rangeHigh, fbm(u, v, c.rangeCells, 2, c.seed + 3));
	const ridge = 1 - Math.abs(fbm(u, v, c.mountainCells, 4, c.seed) * 2 - 1);
	const mountains = Math.pow(ridge, c.mountainSharpness) * c.mountainHeight * range;

	// Plains mask: 0 = flat plain, 1 = fully hilly.
	const plains = smoothstep(c.plainsBias - 0.12, c.plainsBias + 0.12, fbm(u, v, c.plainsCells, 2, c.seed + 7));

	// Never fully flat, even on the plains — 35% of the hill amplitude stays.
	const hills = (fbm(u, v, c.hillCells, 4, c.seed + 13) - 0.5) * 2 * c.hillHeight * (0.35 + 0.65 * plains);
	const rough = (fbm(u, v, c.roughCells, 3, c.seed + 41) - 0.5) * 2 * c.roughHeight;
	const bumps = (fbm(u, v, c.bumpCells, 2, c.seed + 29) - 0.5) * 2 * c.bumpHeight;

	let height = mountains + hills + rough + bumps;

	// Flatten the spawn clearing.
	const distance = Math.hypot(worldX, worldZ);
	height *= smoothstep(c.flatRadius, c.flatRadius + c.flatFalloff, distance);

	return height;
};

// ── Bake ─────────────────────────────────────────────────────────────────────

let heights: Float32Array = new Float32Array(1);
let heightTexture: THREE.DataTexture | null = null;
let resolution = 0;

export const terrainUniforms = {
	// World units covered by one repeat of the heightmap.
	period: uniform(TERRAIN_CONFIG.period),
	resolution: uniform(TERRAIN_CONFIG.resolution),
};

export const bakeTerrain = () => {
	const size = TERRAIN_CONFIG.resolution;
	const period = TERRAIN_CONFIG.period;
	const started = performance.now();

	const data = new Float32Array(size * size);
	const halfs = new Uint16Array(size * size);

	for (let j = 0; j < size; j++) {
		const v = j / size;
		const worldZ = v * period;

		for (let i = 0; i < size; i++) {
			const u = i / size;
			const height = shapeHeight(u, v, u * period, worldZ);

			// Round trip through half float so the CPU reads exactly what the
			// shaders read.
			const half = THREE.DataUtils.toHalfFloat(height);
			halfs[j * size + i] = half;
			data[j * size + i] = THREE.DataUtils.fromHalfFloat(half);
		}
	}

	heights = data;
	resolution = size;

	if (heightTexture && heightTexture.image.width === size) {
		// Reuse the texture object on a rebake. Materials captured it in their
		// node graphs at build time, so replacing it would leave every shader
		// pointing at a disposed texture.
		(heightTexture.image.data as Uint16Array).set(halfs);
		heightTexture.needsUpdate = true;
	} else {
		heightTexture?.dispose();
		heightTexture = new THREE.DataTexture(halfs, size, size, THREE.RedFormat, THREE.HalfFloatType);
		heightTexture.wrapS = THREE.RepeatWrapping;
		heightTexture.wrapT = THREE.RepeatWrapping;
		heightTexture.minFilter = THREE.LinearFilter;
		heightTexture.magFilter = THREE.LinearFilter;
		heightTexture.generateMipmaps = false;
		heightTexture.needsUpdate = true;
	}

	terrainUniforms.period.value = period;
	terrainUniforms.resolution.value = size;

	console.log(`[Terrain] Baked ${size}x${size} over ${period} units in ${Math.round(performance.now() - started)}ms`);

	return heightTexture;
};

export const getTerrainTexture = () => {
	if (!heightTexture) bakeTerrain();
	return heightTexture!;
};

// ── Sampling ─────────────────────────────────────────────────────────────────

/**
 * CPU height lookup. Matches the GPU's bilinear filter, including the half-texel
 * offset, so physics and visuals line up.
 */
export const getTerrainHeight = (x: number, z: number) => {
	if (!heightTexture) bakeTerrain();

	const size = resolution;
	const scale = size / TERRAIN_CONFIG.period;

	// Texture coordinates are texel centres, hence the -0.5.
	const fx = x * scale - 0.5;
	const fz = z * scale - 0.5;

	const i0 = Math.floor(fx);
	const j0 = Math.floor(fz);
	const tx = fx - i0;
	const tz = fz - j0;

	const wrap = (value: number) => ((value % size) + size) % size;
	const ia = wrap(i0);
	const ib = wrap(i0 + 1);
	const ja = wrap(j0);
	const jb = wrap(j0 + 1);

	const h00 = heights[ja * size + ia];
	const h10 = heights[ja * size + ib];
	const h01 = heights[jb * size + ia];
	const h11 = heights[jb * size + ib];

	return lerp(lerp(h00, h10, tx), lerp(h01, h11, tx), tz);
};

/**
 * Highest ground under a footprint around (x, z) — use this to place anything
 * that must not start inside the terrain. Sampling only the centre point drops
 * a vehicle through the ground on a slope, because the corners sit higher.
 */
export const getSpawnHeight = (x: number, z: number, radius = 2) => {
	let highest = getTerrainHeight(x, z);

	for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
		highest = Math.max(highest, getTerrainHeight(x + dx * radius, z + dz * radius));
	}

	return highest;
};

/**
 * Heights for a Rapier heightfield patch centred on (centerX, centerZ).
 *
 * Layout matters and is easy to get backwards: Rapier stores the heights as a
 * (cells + 1)^2 matrix in COLUMN-MAJOR order, where the ROW index runs along
 * local Z and the COLUMN index runs along local X. So the linear index is
 * `zIndex + xIndex * points`, not the other way round — filling it the obvious
 * way transposes the terrain, which on a square patch is invisible except that
 * you drive on different curvature than you see.
 */
export const sampleTerrainPatch = (centerX: number, centerZ: number, size: number, cells: number) => {
	const points = cells + 1;
	const out = new Float32Array(points * points);
	const step = size / cells;
	const originX = centerX - size * 0.5;
	const originZ = centerZ - size * 0.5;

	for (let xIndex = 0; xIndex < points; xIndex++) {
		const x = originX + xIndex * step;
		for (let zIndex = 0; zIndex < points; zIndex++) {
			out[zIndex + xIndex * points] = getTerrainHeight(x, originZ + zIndex * step);
		}
	}

	return out;
};

// ── TSL nodes ────────────────────────────────────────────────────────────────

/**
 * Terrain height at a world-space XZ node.
 *
 * Uses integer texel fetches and does the bilinear filter by hand rather than
 * letting the sampler do it. Two reasons: hardware filtering of half-float
 * textures in the *vertex* stage is not something every backend guarantees (and
 * this has to run in the vertex stage for every blade of grass), and doing the
 * interpolation explicitly means it is the same arithmetic as getTerrainHeight
 * above — so physics and visuals cannot drift apart.
 */
export const terrainHeightNode = (xz: TSLNode) => {
	const map = getTerrainTexture();
	const res = terrainUniforms.resolution;

	// Texel space, offset to texel centres to match the CPU sampler.
	const p = xz.div(terrainUniforms.period).mul(res).sub(0.5);
	const base = p.floor();
	const f = p.sub(base);

	const wrap = (value: TSLNode) => value.mod(res).add(res).mod(res);
	const x0 = wrap(base.x);
	const y0 = wrap(base.y);
	const x1 = wrap(base.x.add(1));
	const y1 = wrap(base.y.add(1));

	const texel = (x: TSLNode, y: TSLNode) => textureLoad(map, ivec2(int(x), int(y))).r;

	const h00 = texel(x0, y0);
	const h10 = texel(x1, y0);
	const h01 = texel(x0, y1);
	const h11 = texel(x1, y1);

	return mix(mix(h00, h10, f.x), mix(h01, h11, f.x), f.y);
};

/** Terrain normal at a world-space XZ node, via central differences. */
export const terrainNormalNode = (xz: TSLNode, epsilon = 1.5) => {
	const hL = terrainHeightNode(xz.sub(vec2(epsilon, 0)));
	const hR = terrainHeightNode(xz.add(vec2(epsilon, 0)));
	const hD = terrainHeightNode(xz.sub(vec2(0, epsilon)));
	const hU = terrainHeightNode(xz.add(vec2(0, epsilon)));

	return vec3(hL.sub(hR), epsilon * 2, hD.sub(hU)).normalize();
};
