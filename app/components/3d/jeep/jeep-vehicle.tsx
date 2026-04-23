import { useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/Addons.js'

export function JeepVehicle() {
	let result = useLoader(GLTFLoader, '/jeep.glb').scene

	return (
		<group>
			<group>
				<primitive object={result} position={[0, 1, 0]} />
			</group>


		</group>
	)
}
