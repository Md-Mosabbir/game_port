import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { positionWorld, texture, uv } from 'three/tsl';

export const WorldGround = () => {
	const meshRef = useRef<THREE.Mesh>(null!);
	
	const fieldTexture = useMemo(() => {
		const canvas = document.createElement('canvas');
		canvas.width = 512;
		canvas.height = 512;
		const ctx = canvas.getContext('2d');
		if (!ctx) return null;

		// Base light grassfield green
		ctx.fillStyle = '#7db35b';
		ctx.fillRect(0, 0, 512, 512);

		// Add yellowish "fallen leaf" freckles
		for (let i = 0; i < 400; i++) {
			const x = Math.random() * 512;
			const y = Math.random() * 512;
			const size = Math.random() * 2.5 + 1;
			const opacity = Math.random() * 0.4 + 0.2;
			ctx.fillStyle = `rgba(227, 192, 77, ${opacity})`;
			ctx.beginPath();
			ctx.arc(x, y, size, 0, Math.PI * 2);
			ctx.fill();
		}

		const tex = new THREE.CanvasTexture(canvas);
		tex.wrapS = THREE.RepeatWrapping;
		tex.wrapT = THREE.RepeatWrapping;
		tex.anisotropy = 8;
		return tex;
	}, []);

	const material = useMemo(() => {
		const m = new MeshStandardNodeMaterial({
			roughness: 0.9,
			metalness: 0.02,
		});

		// Use TSL to map the texture using world coordinates
		// This makes the ground appear infinite as the mesh moves with the camera
		if (fieldTexture) {
			const worldUV = positionWorld.xz.mul(0.05); // Scale of the texture
			m.colorNode = texture(fieldTexture, worldUV);
		}

		return m;
	}, [fieldTexture]);

	useFrame((state) => {
		if (meshRef.current) {
			// Center the ground mesh on the camera's XZ position
			// This creates the illusion of an infinite plane
			meshRef.current.position.x = state.camera.position.x;
			meshRef.current.position.z = state.camera.position.z;
		}
	});

	return (
		<>
			{/* Physics ground: we keep this large but static for now, 
			    or we could move it, but static is usually better for performance 
				unless we need to go BEYOND 500 units. */}
			<RigidBody type="fixed" colliders="cuboid" friction={1.2}>
				<CuboidCollider args={[1000, 0.5, 1000]} position={[0, -0.5, 0]} />
			</RigidBody>

			{/* Visual plane: Moves with the camera, texture is world-mapped */}
			<mesh 
				ref={meshRef}
				rotation={[-Math.PI / 2, 0, 0]} 
				receiveShadow 
				position={[0, -0.01, 0]}
				material={material}
			>
				<planeGeometry args={[400, 400, 1, 1]} />
			</mesh>
		</>
	);
};