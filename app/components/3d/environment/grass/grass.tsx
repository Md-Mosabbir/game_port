import * as THREE from 'three';
import { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame, extend } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { MeshStandardNodeMaterial, MeshBasicNodeMaterial } from 'three/webgpu';
import { attribute, mod, positionLocal, vec3, vec4, uv, float, texture, uniform, color } from 'three/tsl';

import { GRASS_CONFIG, subscribeToGrassConfig, DEBUG_CONFIG } from '@/app/controls/grassControls';
import { GRASS_SETTINGS } from './grass-config';
import { useGrassGeometry } from './use-grass-geometry';
import { createGrassMaterial } from './grass-material';

import { WheelTrail } from './wheel-trail';
import { DebugHUD } from './debug-hud';
import { WheelTracker } from '../wheel-track';
import { TrackDebugPlane } from './debug';
import { AxisDiagnosticHUD, DiagnosticData } from './axis';

extend({ MeshStandardNodeMaterial });

export function InfiniteGrass({ chasisBodyRef }: { chasisBodyRef?: any }) {
    const [config, setConfig] = useState(() => ({ ...GRASS_CONFIG }));
    const [debugConfig, setDebugConfig] = useState(() => ({ ...DEBUG_CONFIG }));
    const trackers = useMemo(() => Array.from({ length: 4 }, () => new WheelTracker()), []);
    const trackScene = useMemo(() => new THREE.Scene(), []);
    const diagRef = useRef<DiagnosticData | null>(null);
    
    // ── Ping-Pong FBO Setup ──────────────────────────────────────────────────
    const pingTarget = useMemo(() => new THREE.WebGLRenderTarget(GRASS_SETTINGS.FBO_RES, GRASS_SETTINGS.FBO_RES, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.HalfFloatType,
    }), []);
    const pongTarget = useMemo(() => new THREE.WebGLRenderTarget(GRASS_SETTINGS.FBO_RES, GRASS_SETTINGS.FBO_RES, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.HalfFloatType,
    }), []);

    const readRef = useRef(pingTarget);
    const writeRef = useRef(pongTarget);

    // Quad for accumulation (merging previous frame with current trackers)
    const fboMeshes = useMemo(() => {
        const geo = new THREE.PlaneGeometry(2, 2);
        const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.999 });
        return new THREE.Mesh(geo, mat);
    }, []);

    const trackCamera = useMemo(() => {
        const h = GRASS_SETTINGS.FIELD_SIZE / 2;
        const cam = new THREE.OrthographicCamera(-h, h, h, -h, 0.1, 20);
        cam.position.set(0, 10, 0);
        cam.lookAt(0, 0, 0);
        //cam.up.set(0, 0, 1); // Crucial for world Z+ to texture V+ mapping
        return cam;
    }, []);

    const trackCameraHelper = useMemo(() => new THREE.CameraHelper(trackCamera), [trackCamera]);

    const count = config.clusterCount * config.bladesPerCluster;
    const geometry = useGrassGeometry(count, config);

    const uniforms = useMemo(() => ({
        cameraXZ: uniform(new THREE.Vector2()),
        cameraRight: uniform(new THREE.Vector3()),
        fieldSize: uniform(GRASS_SETTINGS.FIELD_SIZE),
        windStrength: uniform(config.waveStrength),
        windFrequency: uniform(0.24),
        windSpeed: uniform(config.waveSpeed),
        colorBase: uniform(new THREE.Color(config.colorBase)),
        colorTip: uniform(new THREE.Color(config.colorTip)),
        historyTex: uniform(texture(pingTarget.texture)),  // Initial texture
        historySamples: uniform(0),
        trackRadiusSq: uniform(GRASS_SETTINGS.TRACK_RADIUS_SQ),
        carPosition: uniform(new THREE.Vector3()),
        carYaw: uniform(0),
        carHalfX: uniform(1.1),
        carHalfZ: uniform(1.84),
    }), [config, pingTarget]);

    // ── Dark Ground Patches for Grass Clusters ──
    const patchGeometry = useMemo(() => {
        const geo = new THREE.PlaneGeometry(1, 1);
        geo.rotateX(-Math.PI / 2); // Lay flat
        
        const spawnXZ = new Float32Array(config.clusterCount * 2);
        for (let i = 0; i < config.clusterCount; i++) {
            const cR0 = ((Math.sin((i + 73) * 21.97) * 43758.5453) % 1 + 1) % 1;
            const cR1 = ((Math.sin((i + 311) * 56.11) * 43758.5453) % 1 + 1) % 1;
            spawnXZ[i * 2] = (cR0 - 0.5) * GRASS_SETTINGS.FIELD_SIZE;
            spawnXZ[i * 2 + 1] = (cR1 - 0.5) * GRASS_SETTINGS.FIELD_SIZE;
        }
        geo.setAttribute('aSpawnXZ', new THREE.InstancedBufferAttribute(spawnXZ, 2));
        return geo;
    }, [config.clusterCount]);

    const patchMaterial = useMemo(() => {
        const mat = new MeshBasicNodeMaterial({
            transparent: true,
            depthWrite: false,
        });

        const aSpawnXZ = attribute('aSpawnXZ', 'vec2');
        const halfField = uniforms.fieldSize.mul(0.5);

        const wrappedX = mod(
            aSpawnXZ.x.sub(uniforms.cameraXZ.x).add(halfField),
            uniforms.fieldSize
        ).sub(halfField).add(uniforms.cameraXZ.x);

        const wrappedZ = mod(
            aSpawnXZ.y.sub(uniforms.cameraXZ.y).add(halfField),
            uniforms.fieldSize
        ).sub(halfField).add(uniforms.cameraXZ.y);

        mat.positionNode = vec3(
            positionLocal.x.mul(config.clusterSpread * 2.5).add(wrappedX),
            positionLocal.y.add(0.05), // Slightly above the main ground
            positionLocal.z.mul(config.clusterSpread * 2.5).add(wrappedZ)
        );

        // Soft circular fade out
        const dist = uv().sub(0.5).length();
        const alpha = float(1.0).sub(dist.mul(2.0)).smoothstep(0.0, 0.5);
        
        // Dark, rich forest shadow color
        mat.outputNode = vec4(color('#384227'), alpha.mul(0.85));

        return mat;
    }, [uniforms, config.clusterSpread]);

    // ── Integration Rules ──
    const trackTexNodeRef = useRef<any>(null);
    const [grassMaterial, setGrassMaterial] = useState<any>(null);

    useEffect(() => {
        const { material, trackTexNode } = createGrassMaterial(uniforms, pingTarget.texture);
        trackTexNodeRef.current = trackTexNode;
        setGrassMaterial(material);
    }, []);

    // Setup FBO brushes (invisible white ribbons)
useEffect(() => {
    // 1. Create a reference to the meshes added so we can clean them up
    const meshes: THREE.Mesh[] = [];

    trackers.forEach((tracker) => {
        const geo = new THREE.PlaneGeometry(1, 1, 128, 1);
        geo.translate(0.5, 0, 0);
        const mat = tracker.createTrailMaterial();
        mat.color.set(0xffffff); 
        const mesh = new THREE.Mesh(geo, mat);
        mesh.frustumCulled = false;
        
        trackScene.add(mesh);
        meshes.push(mesh); // Keep track for cleanup
    });

    // 2. Get the unsubscribe function
    const unsubscribe = subscribeToGrassConfig(() => {
        setConfig({ ...GRASS_CONFIG });
        setDebugConfig({ ...DEBUG_CONFIG });
    });

    // 3. Return a clean "void" function for React
    return () => {
        // Stop the listener
        unsubscribe();

        // Clean up Three.js objects to prevent memory leaks/duplicates
        meshes.forEach((mesh) => {
            trackScene.remove(mesh);
            mesh.geometry.dispose();
            if (Array.isArray(mesh.material)) {
                mesh.material.forEach(m => m.dispose());
            } else {
                mesh.material.dispose();
            }
        });
    };
}, [trackScene, trackers]);


    useFrame((state) => {
        // 2. Physics & Tracker History
        const carWorldPos = { x: 0, y: 0, z: 0 };
        if (chasisBodyRef?.current) {
            const body = chasisBodyRef.current;
            const t = body.translation();
            const r = body.rotation();
            const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);

            carWorldPos.x = t.x;
            carWorldPos.y = t.y;
            carWorldPos.z = t.z;

            GRASS_SETTINGS.WHEEL_OFFSETS.forEach((offset, i) => {
                const worldPos = offset.clone().applyQuaternion(q).add(new THREE.Vector3(t.x, t.y, t.z));
                trackers[i].update(worldPos.x, worldPos.y, worldPos.z, true);
            });

            uniforms.carPosition.value.set(t.x, t.y, t.z);
            uniforms.carYaw.value = Math.atan2(
                2 * (q.w * q.y + q.x * q.z),
                1 - 2 * (q.y * q.y + q.z * q.z)
            );

          
            
            
        }

        // 1. Update Camera
        uniforms.cameraXZ.value.set(carWorldPos.x, carWorldPos.z);
        const dir = new THREE.Vector3();
        state.camera.getWorldDirection(dir);
        uniforms.cameraRight.value.crossVectors(state.camera.up, dir).normalize();

        // 3. FBO Render Pass (Ping-Pong Accumulation)
        //trackCamera.position.set(carWorldPos.x, 10, carWorldPos.z);
        //trackCamera.lookAt(carWorldPos.x, 0, carWorldPos.z);
        // CRITICAL: lookAt() recomputes the camera's orientation matrix and can
        // reset the up vector. Re-set it AFTER lookAt to guarantee world Z+ → texture V+.
        trackCamera.position.set(0, 10, 0);
        trackCamera.lookAt(0,0,0);
        trackCamera.up.set(0, 0, 1);
        trackCamera.position.set(carWorldPos.x, 10, carWorldPos.z);
trackCamera.lookAt(carWorldPos.x, 0, carWorldPos.z);
trackCamera.updateMatrixWorld(true);

        trackCameraHelper.update();
        
        const gl = state.gl;
        const currentTarget = gl.getRenderTarget();

        // ── Step A: Render previous frame (accumulation) onto write target ────
        // The fullscreen quad samples the READ target and draws it at 99% opacity,
        // creating the fade/persistence effect.
        fboMeshes.material.map = readRef.current.texture;
        
        gl.setRenderTarget(writeRef.current);
        gl.clear();
        gl.render(fboMeshes, trackCamera);

        // ── Step B: Overlay current wheel positions on top ────────────────────
        // The track ribbons are rendered additively on top of the accumulated history.
        gl.autoClear = false;
        gl.render(trackScene, trackCamera);
        gl.autoClear = true;
        gl.setRenderTarget(currentTarget);

        // Swap ping-pong targets
        const temp = readRef.current;
        readRef.current = writeRef.current;
        writeRef.current = temp;

        // Integration rule: Update trackTexNode
        if (trackTexNodeRef.current) {
            trackTexNodeRef.current.value = readRef.current.texture;
        }
        uniforms.historySamples.value = trackers[0].activeSamples;

        // Diagnostic Data Population
        diagRef.current = {
            orbitCamXZ: [state.camera.position.x, state.camera.position.z],
            fboCamXZ: [trackCamera.position.x, trackCamera.position.z],
            carXZ: [carWorldPos.x, carWorldPos.z],
            uniformsCamXZ: [uniforms.cameraXZ.value.x, uniforms.cameraXZ.value.y],
            delta: [
                trackCamera.position.x - carWorldPos.x,
                trackCamera.position.z - carWorldPos.z,
            ],
            carUVinFBO: [
                (carWorldPos.x - trackCamera.position.x) / GRASS_SETTINGS.FIELD_SIZE + 0.5,
                (carWorldPos.z - trackCamera.position.z) / GRASS_SETTINGS.FIELD_SIZE + 0.5,
            ],
            carUVinGrass: [
                (carWorldPos.x - uniforms.cameraXZ.value.x) / GRASS_SETTINGS.FIELD_SIZE + 0.5,
                (carWorldPos.z - uniforms.cameraXZ.value.y) / GRASS_SETTINGS.FIELD_SIZE + 0.5,
            ],
        };

    });

    return (
        <>
            {grassMaterial && (
                <mesh geometry={geometry} material={grassMaterial} frustumCulled={false} castShadow receiveShadow />
            )}
            
            {/* Dark ground patches beneath grass clusters */}
            <instancedMesh 
                args={[patchGeometry, patchMaterial, config.clusterCount]} 
                frustumCulled={false} 
                receiveShadow
            />
            
            {/* {trackers.map((t, i) => <WheelTrail key={i} tracker={t} />)} */}
            {debugConfig.showTrackCamera && <primitive object={trackCameraHelper} />}
            
            {debugConfig.showDebugHUD && <DebugHUD texture={readRef.current.texture} />}
            <TrackDebugPlane
                trackTexture={readRef.current.texture}
                fieldSize={GRASS_SETTINGS.FIELD_SIZE}
                visible={debugConfig.showTrackPlane}
                showAxes={debugConfig.showAxes}
            />

            <Html>
                <AxisDiagnosticHUD diagRef={diagRef} visible={debugConfig.showAxisDiag} />
            </Html>
        </>
    );
}