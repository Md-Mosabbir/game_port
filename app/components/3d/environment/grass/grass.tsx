import * as THREE from 'three';
import { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame, extend } from '@react-three/fiber';
import { uniform } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';

import { GRASS_CONFIG, subscribeToGrassConfig } from '@/app/controls/grassControls';
import { GRASS_SETTINGS } from './grass-config';
import { useGrassGeometry } from './use-grass-geometry';
import { createGrassMaterial } from './grass-material';

import { WheelTrail } from './wheel-trail';
import { DebugHUD } from './debug-hud';
import { WheelTracker } from '../wheel-track';

extend({ MeshBasicNodeMaterial });

export function InfiniteGrass({ chasisBodyRef }: { chasisBodyRef?: any }) {
    const [config, setConfig] = useState(() => ({ ...GRASS_CONFIG }));
    const trackers = useMemo(() => Array.from({ length: 4 }, () => new WheelTracker()), []);
    const trackScene = useMemo(() => new THREE.Scene(), []);
    
    // ── Ping-Pong FBO Setup ──────────────────────────────────────────────────
    const pingTarget = useMemo(() => new THREE.WebGLRenderTarget(GRASS_SETTINGS.FBO_RES, GRASS_SETTINGS.FBO_RES, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
    }), []);
    const pongTarget = useMemo(() => new THREE.WebGLRenderTarget(GRASS_SETTINGS.FBO_RES, GRASS_SETTINGS.FBO_RES, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
    }), []);

    const readRef = useRef(pingTarget);
    const writeRef = useRef(pongTarget);

    // Quad for accumulation (merging previous frame with current trackers)
    const fboMeshes = useMemo(() => {
        const geo = new THREE.PlaneGeometry(2, 2);
        const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.99 });
        return new THREE.Mesh(geo, mat);
    }, []);

    const trackCamera = useMemo(() => {
        const h = GRASS_SETTINGS.FIELD_SIZE / 2;
        const cam = new THREE.OrthographicCamera(-h, h, h, -h, 0.1, 20);
        cam.position.set(0, 10, 0);
        cam.lookAt(0, 0, 0);
        cam.up.set(0, 0, 1); // Crucial for world Z+ to texture V+ mapping
        return cam;
    }, []);

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
        historyTex: uniform(pingTarget.texture), // Initial texture
        historySamples: uniform(0),
        trackRadiusSq: uniform(GRASS_SETTINGS.TRACK_RADIUS_SQ),
    }), [config, pingTarget]);

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
        trackers.forEach((tracker) => {
            const geo = new THREE.PlaneGeometry(1, 1, 128, 1);
            geo.translate(0.5, 0, 0);
            const mat = tracker.createTrailMaterial();
            mat.color.set(0xffffff); // FBO mask must be white
            const mesh = new THREE.Mesh(geo, mat);
            mesh.frustumCulled = false;
            trackScene.add(mesh);
        });

        return subscribeToGrassConfig(() => setConfig({ ...GRASS_CONFIG }));
    }, [trackScene, trackers]);

    useFrame((state) => {
        // 1. Update Camera
        uniforms.cameraXZ.value.set(state.camera.position.x, state.camera.position.z);
        const dir = new THREE.Vector3();
        state.camera.getWorldDirection(dir);
        uniforms.cameraRight.value.crossVectors(state.camera.up, dir).normalize();

        // 2. Physics & Tracker History
        if (chasisBodyRef?.current) {
            const body = chasisBodyRef.current;
            const t = body.translation();
            const r = body.rotation();
            const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);

            GRASS_SETTINGS.WHEEL_OFFSETS.forEach((offset, i) => {
                const worldPos = offset.clone().applyQuaternion(q).add(new THREE.Vector3(t.x, t.y, t.z));
                trackers[i].update(worldPos.x, worldPos.y, worldPos.z, true);
            });
        }

        // 3. FBO Render Pass (Ping-Pong Accumulation)
        trackCamera.position.set(state.camera.position.x, 10, state.camera.position.z);
        trackCamera.lookAt(state.camera.position.x, 0, state.camera.position.z);
        
        const gl = state.gl;
        const currentTarget = gl.getRenderTarget();

        // Render current trackers to write target
        gl.setRenderTarget(writeRef.current);
        // Blend with previous frame (ping-pong)
        fboMeshes.material.map = readRef.current.texture;
        // (Note: in a real accumulative system, we'd render the quad here first)
        gl.render(trackScene, trackCamera);
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


    });

    return (
        <>
            {grassMaterial && (
                <mesh geometry={geometry} material={grassMaterial} frustumCulled={false} />
            )}
            {trackers.map((t, i) => <WheelTrail key={i} tracker={t} />)}
            
            <DebugHUD texture={readRef.current.texture} />
        </>
    );
}