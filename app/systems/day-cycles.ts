import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// Day cycles
//
// Port of folio-2025's `Cycles` / `DayCycles`: a set of presets (day, dusk,
// night, dawn) placed on keyframe stops along a normalised 0..1 timeline. Every
// frame the progress advances and each property is interpolated between the two
// surrounding stops with a smoothstep ratio.
//
// Consumers (fog, lighting, materials) read `dayCycle.properties` — they never
// read the presets directly, so a preset tweak in Tweakpane shows up instantly.
// ─────────────────────────────────────────────────────────────────────────────

export type DayCyclePreset = {
	lightColor: THREE.Color;
	lightIntensity: number;
	shadowColor: THREE.Color;
	fogColorA: THREE.Color;
	fogColorB: THREE.Color;
	fogNearRatio: number;
	fogFarRatio: number;
};

// Palette notes:
//   lightColor  multiplies the albedo, so it reads as the sun's warmth.
//   shadowColor multiplies it too — it is a tint, not a darkness. Keep it a
//               mid-tone complement of the light (cool when the light is warm)
//               so shadows go blue/violet instead of grey.
//   fogColorA   sits at the gradient centre (the horizon), fogColorB above it.
// Tuned against this scene: coral ground, green grass, warm canopies.
export const DAY_CYCLE_PRESETS: Record<'day' | 'dusk' | 'night' | 'dawn', DayCyclePreset> = {
	// Clear warm daylight, hazy sand horizon under a teal sky.
	day: {
		lightColor: new THREE.Color('#ffeccc'),
		lightIntensity: 1.15,
		shadowColor: new THREE.Color('#7d8ed4'),
		fogColorA: new THREE.Color('#ffd7a3'),
		fogColorB: new THREE.Color('#5fb3cf'),
		fogNearRatio: 0.315,
		fogFarRatio: 1.25,
	},
	// Golden hour burning into violet.
	dusk: {
		lightColor: new THREE.Color('#ff9d63'),
		lightIntensity: 1.3,
		shadowColor: new THREE.Color('#6d5bb0'),
		fogColorA: new THREE.Color('#ffab63'),
		fogColorB: new THREE.Color('#8a5bb5'),
		fogNearRatio: 0,
		fogFarRatio: 1.25,
	},
	// Moonlight: dim and blue, so the intensity carries it back up.
	night: {
		lightColor: new THREE.Color('#5570c8'),
		lightIntensity: 2.4,
		shadowColor: new THREE.Color('#2b3170'),
		fogColorA: new THREE.Color('#1e3a66'),
		fogColorB: new THREE.Color('#111a3d'),
		fogNearRatio: -0.85,
		fogFarRatio: 1,
	},
	// Soft peach light against a lilac sky.
	dawn: {
		lightColor: new THREE.Color('#ffc49e'),
		lightIntensity: 1.15,
		shadowColor: new THREE.Color('#8168b8'),
		fogColorA: new THREE.Color('#ffb9a5'),
		fogColorB: new THREE.Color('#9a92d6'),
		fogNearRatio: 0.3,
		fogFarRatio: 1.25,
	},
};

export const DAY_CYCLE_CONFIG = {
	// When off, fog and lighting fall back to their own Tweakpane values.
	enabled: true,
	// Seconds for a full day/night rotation. Short durations swing the sun fast,
	// which makes shadow edges visibly crawl — this is slow on purpose.
	duration: 300,
	// Scrub the cycle by hand instead of letting the clock drive it.
	manual: false,
	progress: 0,
};

type Keyframe = { properties: DayCyclePreset; stop: number };

const keyframes: Keyframe[] = [
	{ properties: DAY_CYCLE_PRESETS.day, stop: 0.0 },
	{ properties: DAY_CYCLE_PRESETS.day, stop: 0.15 },
	{ properties: DAY_CYCLE_PRESETS.dusk, stop: 0.25 },
	{ properties: DAY_CYCLE_PRESETS.night, stop: 0.35 },
	{ properties: DAY_CYCLE_PRESETS.night, stop: 0.6 },
	{ properties: DAY_CYCLE_PRESETS.dawn, stop: 0.8 },
	{ properties: DAY_CYCLE_PRESETS.day, stop: 0.9 },
	// Wrap-around step so the last stop interpolates back into the first one.
	{ properties: DAY_CYCLE_PRESETS.day, stop: 1.0 },
];

// Live, interpolated values. Read these, never the presets.
export const dayCycle = {
	progress: 0,
	properties: {
		lightColor: new THREE.Color(),
		lightIntensity: 1.2,
		shadowColor: new THREE.Color(),
		fogColorA: new THREE.Color(),
		fogColorB: new THREE.Color(),
		fogNearRatio: 0,
		fogFarRatio: 1,
	},
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const smoothstep = (value: number, min: number, max: number) => {
	if (min === max) return value < min ? 0 : 1;
	const x = Math.min(Math.max((value - min) / (max - min), 0), 1);
	return x * x * (3 - 2 * x);
};

let elapsed = 0;

export const updateDayCycles = (delta: number) => {
	if (!DAY_CYCLE_CONFIG.enabled) return;

	// Progress
	if (DAY_CYCLE_CONFIG.manual) {
		dayCycle.progress = Math.min(Math.max(DAY_CYCLE_CONFIG.progress, 0), 1);
		// Keep the clock in sync so releasing the scrub does not jump.
		elapsed = dayCycle.progress * DAY_CYCLE_CONFIG.duration;
	} else {
		elapsed += delta;
		dayCycle.progress = (elapsed / Math.max(DAY_CYCLE_CONFIG.duration, 0.001)) % 1;
		DAY_CYCLE_CONFIG.progress = dayCycle.progress;
	}

	// Surrounding keyframes
	let indexPrevious = 0;
	for (let i = 0; i < keyframes.length; i++) {
		if (keyframes[i].stop <= dayCycle.progress) indexPrevious = i;
	}
	const indexNext = (indexPrevious + 1) % keyframes.length;

	const previous = keyframes[indexPrevious];
	const next = keyframes[indexNext];
	const mixRatio = smoothstep(dayCycle.progress, previous.stop, next.stop);

	// Interpolate
	const properties = dayCycle.properties;
	properties.lightColor.lerpColors(previous.properties.lightColor, next.properties.lightColor, mixRatio);
	properties.shadowColor.lerpColors(previous.properties.shadowColor, next.properties.shadowColor, mixRatio);
	properties.fogColorA.lerpColors(previous.properties.fogColorA, next.properties.fogColorA, mixRatio);
	properties.fogColorB.lerpColors(previous.properties.fogColorB, next.properties.fogColorB, mixRatio);
	properties.lightIntensity = lerp(previous.properties.lightIntensity, next.properties.lightIntensity, mixRatio);
	properties.fogNearRatio = lerp(previous.properties.fogNearRatio, next.properties.fogNearRatio, mixRatio);
	properties.fogFarRatio = lerp(previous.properties.fogFarRatio, next.properties.fogFarRatio, mixRatio);
};

// Prime the values so the first frame is not black.
updateDayCycles(0);
