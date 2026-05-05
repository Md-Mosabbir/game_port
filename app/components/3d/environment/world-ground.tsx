import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

export const WorldGround = () => {
	const marbleTileTexture = useMemo(() => {
		const canvas = document.createElement('canvas');
		canvas.width = 512;
		canvas.height = 512;
		const ctx = canvas.getContext('2d');
		if (!ctx) return null;

		const tileSize = 64;
		const grout = 4;

		ctx.fillStyle = '#f5f5f0';
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		for (let y = 0; y < canvas.height; y += tileSize) {
			for (let x = 0; x < canvas.width; x += tileSize) {
				const tone = 236 + ((x / tileSize + y / tileSize) % 4) * 4;
				ctx.fillStyle = `rgb(${tone}, ${tone}, ${tone + 6})`;
				ctx.fillRect(x + grout, y + grout, tileSize - grout * 2, tileSize - grout * 2);

				// Soft vein strokes to fake marble details per tile.
				ctx.strokeStyle = 'rgba(175, 175, 188, 0.28)';
				ctx.lineWidth = 1.2;
				ctx.beginPath();
				ctx.moveTo(x + grout + 8, y + grout + 12);
				ctx.bezierCurveTo(
					x + tileSize * 0.45,
					y + tileSize * 0.15,
					x + tileSize * 0.7,
					y + tileSize * 0.8,
					x + tileSize - grout - 8,
					y + tileSize - grout - 10
				);
				ctx.stroke();
			}
		}

		const texture = new THREE.CanvasTexture(canvas);
		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;
		texture.repeat.set(60, 60);
		texture.colorSpace = THREE.SRGBColorSpace;
		texture.anisotropy = 8;
		texture.needsUpdate = true;
		return texture;
	}, []);

	useEffect(() => {
		return () => {
			marbleTileTexture?.dispose();
		};
	}, [marbleTileTexture]);

	return (
		<>
			{/* Physics ground: invisible collider used by Rapier */}
			<RigidBody type="fixed" colliders="cuboid" friction={1.2}>
				<CuboidCollider args={[500, 0.5, 500]} position={[0, -0.5, 0]} />
			</RigidBody>

			{/* Visual plane: receives shadows and gives a natural horizon. */}
			<mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.01, 0]}>
				<planeGeometry args={[1200, 1200, 1, 1]} />
				{/* Faux marble look: bright base, low roughness, slight clear coat sheen. */}
				<meshPhysicalMaterial
					color="#f7f7fb"
					map={marbleTileTexture ?? undefined}
					roughness={0.24}
					metalness={0}
					clearcoat={0.65}
					clearcoatRoughness={0.32}
					reflectivity={0.6}
				/>
			</mesh>
		</>
	);
};
