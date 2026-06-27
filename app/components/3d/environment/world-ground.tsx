import { CuboidCollider, RigidBody, RapierRigidBody } from '@react-three/rapier';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { positionWorld, texture } from 'three/tsl';

interface WorldGroundProps {
    chasisBodyRef?: React.RefObject<RapierRigidBody | null>;
}

export const WorldGround = ({ chasisBodyRef }: WorldGroundProps) => {
    const meshRef = useRef<THREE.Mesh>(null!);
    const colliderRef = useRef<RapierRigidBody>(null!);
    
    // Track the current center of our physics collider grid segment
    const lastGridPos = useRef({ x: 0, z: 0 });
    const GRID_SIZE = 200; // How far the car travels before we snap the floor forward

    const fieldTexture = useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // A warm, earthy Ghibli-style dirt/path color instead of green
        ctx.fillStyle = '#f77f6c';
        ctx.fillRect(0, 0, 512, 512);

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

        if (fieldTexture) {
            const worldUV = positionWorld.xz.mul(0.05);
            m.colorNode = texture(fieldTexture, worldUV);
        }

        return m;
    }, [fieldTexture]);

    useFrame((state) => {
        // 1. Keep visual mesh locked to camera
        if (meshRef.current) {
            meshRef.current.position.x = state.camera.position.x;
            meshRef.current.position.z = state.camera.position.z;
        }

        // 2. Safely shift physics floor using discrete grid jumps based on car position
        if (chasisBodyRef?.current && colliderRef.current) {
            const carPos = chasisBodyRef.current.translation();

            // Calculate which grid sector the car is currently in
            const targetGridX = Math.round(carPos.x / GRID_SIZE) * GRID_SIZE;
            const targetGridZ = Math.round(carPos.z / GRID_SIZE) * GRID_SIZE;

            // Only update Rapier if the car has crossed into a new sector
            if (targetGridX !== lastGridPos.current.x || targetGridZ !== lastGridPos.current.z) {
                lastGridPos.current.x = targetGridX;
                lastGridPos.current.z = targetGridZ;

                // Teleport the physics body instantly without generating artificial velocity vectors
                colliderRef.current.setTranslation(
                    { x: targetGridX, y: -0.5, z: targetGridZ }, 
                    true
                );
            }
        }
    });

    return (
        <>
            {/* Dynamic Kinematic/Fixed Floor that leaps forward with the car */}
            <RigidBody 
                ref={colliderRef}
                type="fixed" 
                colliders={false} 
                friction={1.2}
                position={[0, -0.5, 0]}
            >
                {/* 1000x1000 radius gives plenty of headroom so the edge is never reached within a sector */}
                <CuboidCollider args={[500, 0.5, 500]} />
            </RigidBody>

            {/* Visual Plane */}
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