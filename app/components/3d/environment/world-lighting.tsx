import { LIGHTING_CONFIG } from '@/app/controls/lightingControls';

export const WorldLighting = () => {
	return (
		<>
			{/* Dreamy key/fill setup inspired by anime-style two-light palettes. */}
			<ambientLight intensity={0.3} color="#f4eefe" />
			<hemisphereLight intensity={0.18} color="#d4d9ff" groundColor="#7f8bb5" />
			<directionalLight
				position={[40, 60, 20]}
				intensity={LIGHTING_CONFIG.keyLightIntensity}
				color={LIGHTING_CONFIG.keyLightColor}
				castShadow
				shadow-mapSize-width={1024}
				shadow-mapSize-height={1024}
				shadow-camera-near={1}
				shadow-camera-far={220}
				shadow-camera-left={-100}
				shadow-camera-right={100}
				shadow-camera-top={100}
				shadow-camera-bottom={-100}
			/>
			<directionalLight
				position={[-30, 16, -35]}
				intensity={LIGHTING_CONFIG.fillLightIntensity}
				color={LIGHTING_CONFIG.fillLightColor}
			/>
		</>
	);
};
