import * as THREE from 'three';
import { Hud, OrthographicCamera } from '@react-three/drei';

export function DebugHUD({ texture }: { texture: THREE.Texture }) {
    if (!texture) return null;
    
    return (
        <Hud>
            {/* Dedicated Orthographic Camera for UI */}
            <OrthographicCamera 
                makeDefault 
                left={-10} 
                right={10} 
                top={10} 
                bottom={-10} 
                near={0.1} 
                far={100} 
                position={[0, 0, 50]} 
            />
            
            <group position={[0, -7.5, 0]}>
                {/* Dark Background Plate */}
                <mesh position={[0, 0, -0.1]}>
                    <planeGeometry args={[5.2, 5.2]} />
                    <meshBasicMaterial color="#111111" />
                </mesh>

                {/* The RenderTarget Texture */}
                <mesh position={[0, 0, 0]}>
                    <planeGeometry args={[5, 5]} />
                    <meshBasicMaterial map={texture} />
                </mesh>
                
                {/* Bold White Border */}
                <lineSegments>
                    <edgesGeometry args={[new THREE.PlaneGeometry(5.2, 5.2)]} />
                    <lineBasicMaterial color="#ffffff" linewidth={2} />
                </lineSegments>
            </group>
        </Hud>
    );
}
