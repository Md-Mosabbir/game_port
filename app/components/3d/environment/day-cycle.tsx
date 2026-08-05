import { useFrame } from '@react-three/fiber';
import { updateDayCycles } from '@/app/systems/day-cycles';
import { refreshDayCycleControls } from '@/app/controls/dayCycleControls';

// Advances the day/night cycle. Runs at a negative priority so the interpolated
// values are ready before the fog and lighting read them this same frame.
export const DayCycle = () => {
	useFrame((_, delta) => {
		updateDayCycles(delta);
		refreshDayCycleControls();
	}, -1);

	return null;
};
