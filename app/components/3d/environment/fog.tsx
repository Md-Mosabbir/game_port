import { useFrame, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { fog } from 'three/tsl';
import { FOG_CONFIG, fogUniforms } from '@/app/controls/fogControls';
import { fogNodes } from '@/app/systems/fog-nodes';
import { DAY_CYCLE_CONFIG, dayCycle } from '@/app/systems/day-cycles';

// Scene node properties are only present on the WebGPU/node side of three,
// so they are not part of the core Scene typings.
type NodeScene = THREE.Scene & {
	backgroundNode: unknown;
	fogNode: unknown;
};

export const Fog = () => {
	const scene = useThree((state) => state.scene) as NodeScene;

	useEffect(() => {
		// Node background/fog take precedence, so clear the classic ones.
		scene.background = null;
		scene.fog = null;

		scene.backgroundNode = fogNodes.color;
		// Materials shaded by applyFolioShading() blend the fog themselves (a
		// custom outputNode bypasses this pass); this covers everything else.
		scene.fogNode = fog(fogNodes.color, fogNodes.strength);

		return () => {
			scene.backgroundNode = null;
			scene.fogNode = null;
		};
	}, [scene]);

	// Apply day cycle values — mirrors folio's Fog.update(). The configured
	// near/far act as the base range the cycle ratios are remapped into.
	useFrame(() => {
		if (!DAY_CYCLE_CONFIG.enabled) return;

		const amplitude = FOG_CONFIG.far - FOG_CONFIG.near;

		fogUniforms.colorA.value.copy(dayCycle.properties.fogColorA);
		fogUniforms.colorB.value.copy(dayCycle.properties.fogColorB);
		fogUniforms.near.value = FOG_CONFIG.near + dayCycle.properties.fogNearRatio * amplitude;
		fogUniforms.far.value = FOG_CONFIG.near + dayCycle.properties.fogFarRatio * amplitude;
	});

	return null;
};
