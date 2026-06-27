import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { LIGHTING_CONFIG } from '@/app/controls/lightingControls';
import * as THREE from 'three';

export const WorldLighting = ({ mainLightRef }: { mainLightRef?: React.RefObject<THREE.DirectionalLight> }) => {
	const localMainLightRef = useRef<THREE.DirectionalLight>(null!);
	const activeMainLightRef = mainLightRef || localMainLightRef;
	const ambientLightRef = useRef<THREE.AmbientLight>(null!);
	
	const { scene } = useThree();
	const helperRef = useRef<THREE.DirectionalLightHelper | null>(null);
	const cameraHelperRef = useRef<THREE.CameraHelper | null>(null);

	useFrame(() => {
		if (ambientLightRef.current) {
			ambientLightRef.current.color.set(LIGHTING_CONFIG.ambientColor);
			ambientLightRef.current.intensity = LIGHTING_CONFIG.ambientIntensity;
		}

		if (activeMainLightRef.current) {
			const light = activeMainLightRef.current;
			
			// Cartesian Position
			light.position.set(
				LIGHTING_CONFIG.dirPosition.x,
				LIGHTING_CONFIG.dirPosition.y,
				LIGHTING_CONFIG.dirPosition.z
			);
			
			// Sync diffusion uniform so the surface normal shading matches the light source!
			import('@/app/controls/playgroundControls').then(({ diffusionUniforms }) => {
				// The light direction is from the object to the light.
				diffusionUniforms.lightDirection.value.copy(light.position).normalize();
			});
			
			light.intensity = LIGHTING_CONFIG.dirIntensity;
			light.color.set(LIGHTING_CONFIG.dirColor);
			
			// Shadow properties
			if (light.shadow) {
				light.shadow.bias = LIGHTING_CONFIG.shadowBias;
				light.shadow.normalBias = LIGHTING_CONFIG.shadowNormalBias;
				light.shadow.camera.near = LIGHTING_CONFIG.shadowNear;
				light.shadow.camera.far = LIGHTING_CONFIG.shadowDepth;
				
				light.shadow.camera.updateProjectionMatrix();
			}

			// Helpers
			if (LIGHTING_CONFIG.showHelpers) {
				if (!helperRef.current) {
					helperRef.current = new THREE.DirectionalLightHelper(light, 10, '#ff0000');
					scene.add(helperRef.current);
				} else {
					helperRef.current.update();
				}

				if (!cameraHelperRef.current && light.shadow) {
					cameraHelperRef.current = new THREE.CameraHelper(light.shadow.camera);
					scene.add(cameraHelperRef.current);
				} else if (cameraHelperRef.current) {
					cameraHelperRef.current.update();
				}
			} else {
				if (helperRef.current) {
					scene.remove(helperRef.current);
					helperRef.current.dispose();
					helperRef.current = null;
				}
				if (cameraHelperRef.current) {
					scene.remove(cameraHelperRef.current);
					cameraHelperRef.current.dispose();
					cameraHelperRef.current = null;
				}
			}
		}
	});

	// Initial render handles the base setup, useFrame updates the reactive parts.
	return (
		<>
			<ambientLight ref={ambientLightRef} intensity={1.2} color="#ffe4b3" />
			<directionalLight
				ref={activeMainLightRef}
				position={[0, 100, 0]}
				castShadow
				shadow-mapSize-width={LIGHTING_CONFIG.shadowAmplitude}
				shadow-mapSize-height={LIGHTING_CONFIG.shadowAmplitude}
				shadow-camera-left={-150}
				shadow-camera-right={150}
				shadow-camera-top={150}
				shadow-camera-bottom={-150}
			/>
		</>
	);
};
