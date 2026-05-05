import { Sky } from '@react-three/drei';
import { LIGHTING_CONFIG } from '@/app/controls/lightingControls';

export const WorldAtmosphere = () => {
	return (
		<>
			<color attach="background" args={[LIGHTING_CONFIG.fogColor]} />
			<fog attach="fog" args={[LIGHTING_CONFIG.fogColor, LIGHTING_CONFIG.fogNear, LIGHTING_CONFIG.fogFar]} />
			<Sky
				distance={450000}
				sunPosition={[100, 40, 30]}
				turbidity={5}
				rayleigh={1.6}
			/>
		</>
	);
};
