import { Sky } from '@react-three/drei';

export const WorldAtmosphere = () => {
	return (
		<Sky
			distance={450000}
			sunPosition={[100, 40, 30]}
			turbidity={5}
			rayleigh={1.6}
		/>
	);
};
