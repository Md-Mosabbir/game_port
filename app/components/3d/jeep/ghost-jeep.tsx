import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { useRef } from "react";

export function Jeep() {
	const jeepRef = useRef(null);

	return (
		<RigidBody
			ref={jeepRef}
			colliders={false} // We define our own shape manually
			position={[0, 5, 0]} // Start slightly above the grid
			mass={1500} // A heavy Jeep needs weight
		>
			{/* 1. THE MAIN CHASSIS BOX */}
			{/* Based on your previous dimensions: 1.96 wide, 1 high, 4.3 long */}
			<CuboidCollider args={[0.98, 0.5, 2.15]} />

			{/* 2. THE VISUAL PLACEHOLDER */}
			{/* While we wait to hook up the GLB, use a box to see if it falls/moves */}
			<mesh castShadow>
				<boxGeometry args={[1.96, 1, 4.3]} />
				<meshStandardMaterial color="#ff55bb" />
			</mesh>
		</RigidBody>
	);
}
