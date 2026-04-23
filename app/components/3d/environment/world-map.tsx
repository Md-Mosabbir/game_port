import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { Grid } from "@react-three/drei";

export function WorldMap() {
	return (
		<RigidBody type="fixed" friction={1}>
			{/* PHYSICS: A 100x100 solid box, 0.2 units thick */}
			<CuboidCollider args={[50, 0.1, 50]} />

			{/* VISUAL: The Grid Material */}
			<Grid
				args={[100, 100]}
				sectionSize={10}
				cellColor="#705df2"
				sectionColor="#ffffff"
				infiniteGrid
			/>
		</RigidBody>
	);
}
