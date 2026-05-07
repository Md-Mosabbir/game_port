import { LIGHTING_CONFIG } from '@/app/controls/lightingControls';

export const WorldLighting = () => {
	return (
		<>
			{/* Warm autumn sunset lighting */}
			<ambientLight intensity={1.2} color="#ffe4b3" />
			<hemisphereLight intensity={0.6} color="#ffd180" groundColor="#4a3b22" />
			<directionalLight
				position={[100, 20, -50]}
				intensity={LIGHTING_CONFIG.keyLightIntensity + 0.5}
				color={LIGHTING_CONFIG.keyLightColor}
				castShadow
				shadow-mapSize-width={1024}
				shadow-mapSize-height={1024}
				shadow-camera-near={1}
				shadow-camera-far={300}
				shadow-camera-left={-150}
				shadow-camera-right={150}
				shadow-camera-top={150}
				shadow-camera-bottom={-150}
			/>
			<directionalLight
				position={[-50, 10, 50]}
				intensity={LIGHTING_CONFIG.fillLightIntensity}
				color="#ff8c00"
			/>
		</>
	);
};
