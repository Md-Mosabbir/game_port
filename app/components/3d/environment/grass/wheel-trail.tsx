import * as THREE from 'three';
import { useMemo } from 'react';
import { WheelTracker } from '../wheel-track';


export function WheelTrail({ tracker }: { tracker: WheelTracker }) {
    const geometry = useMemo(() => {
        const geo = new THREE.PlaneGeometry(1, 1, 128, 1);

        return geo;
    }, []);

const material = useMemo(() => {
    const mat = tracker.createTrailMaterial();
    mat.color.set(0x00aaff); 
    mat.transparent = true;
    
    // Set to true to enable wireframe
    mat.wireframe = true; 
    
    mat.opacity = 0.5;
    return mat;
}, [tracker]);


    return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}