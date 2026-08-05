import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { fog, mix, rangeFogFactor, vec2, viewportUV } from 'three/tsl';
import { fogUniforms } from '@/app/controls/fogControls';

// Scene node properties are only present on the WebGPU/node side of three,
// so they are not part of the core Scene typings.
type NodeScene = THREE.Scene & {
	backgroundNode: unknown;
	fogNode: unknown;
};

export const Fog = () => {
	const scene = useThree((state) => state.scene) as NodeScene;

	useEffect(() => {
		// Radial screen-space gradient used for both the background and the fog color.
		const colorMix = vec2(viewportUV.xy)
			.sub(fogUniforms.radialCenter)
			.length()
			.smoothstep(fogUniforms.radialStart, fogUniforms.radialEnd);
		const fogColor = mix(fogUniforms.colorA, fogUniforms.colorB, colorMix);

		// Node background/fog take precedence, so clear the classic ones.
		scene.background = null;
		scene.fog = null;

		scene.backgroundNode = fogColor;
		scene.fogNode = fog(fogColor, rangeFogFactor(fogUniforms.near, fogUniforms.far));

		return () => {
			scene.backgroundNode = null;
			scene.fogNode = null;
		};
	}, [scene]);

	return null;
};
