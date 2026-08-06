import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
    float,
    mix,
    mx_noise_float,
    positionLocal,
    positionViewDirection,
    time,
    uniform,
    vec2,
    vec3,
    vec4,
} from 'three/tsl';
import { terrainHeightNode } from '@/app/systems/terrain';
import { fogNodes } from '@/app/systems/fog-nodes';
import { shadingUniforms } from '@/app/controls/shadingControls';
import { waterUniforms } from '@/app/controls/waterControls';

// One grid, camera-locked and snapped to whole cells like the ground. Every
// fragment where the terrain is above the water line is discarded, so the lakes
// are precisely the terrain's low ground.
const WATER_SIZE = 512;
const WATER_SEGMENTS = 128;
const WATER_CELL = WATER_SIZE / WATER_SEGMENTS;

export const Water = () => {
    const meshRef = useRef<THREE.Mesh>(null!);
    const waterOrigin = useMemo(() => uniform(new THREE.Vector2()), []);

    const geometry = useMemo(() => {
        const geo = new THREE.PlaneGeometry(WATER_SIZE, WATER_SIZE, WATER_SEGMENTS, WATER_SEGMENTS);
        geo.rotateX(-Math.PI / 2);
        return geo;
    }, []);

    const material = useMemo(() => {
        const m = new MeshBasicNodeMaterial({
            transparent: true,
            // Water writing depth would hide everything behind it through the
            // transparent surface.
            depthWrite: false,
            side: THREE.DoubleSide,
        });

        const worldXZ = vec2(positionLocal.x, positionLocal.z).add(waterOrigin);

        // ── Waves ────────────────────────────────────────────────────────────
        // Two layers at different scales and speeds so the surface never reads
        // as a single repeating pattern.
        const t = time.mul(waterUniforms.waveSpeed);
        const waveAt = (offset: ReturnType<typeof vec2>) => {
            const p = worldXZ.add(offset).mul(waterUniforms.waveScale);
            const a = mx_noise_float(vec3(p, t));
            const b = mx_noise_float(vec3(p.mul(2.3).add(17.3), t.mul(1.45)));
            return a.add(b.mul(0.5));
        };

        const wave = waveAt(vec2(0, 0));
        m.positionNode = vec3(positionLocal.x, wave.mul(waterUniforms.waveHeight), positionLocal.z);

        // ── Depth ────────────────────────────────────────────────────────────
        const groundY = terrainHeightNode(worldXZ);
        const depth = waterUniforms.level.sub(groundY);

        // No water where the ground is above the water line. This is what
        // carves the lakes out of one flat sheet.
        depth.lessThan(0).discard();

        const depthMix = depth.smoothstep(0, waterUniforms.deepDistance);

        // ── Surface normal from the wave slope ───────────────────────────────
        const step = 1.5;
        const slopeX = waveAt(vec2(step, 0)).sub(waveAt(vec2(step, 0).negate()));
        const slopeZ = waveAt(vec2(0, step)).sub(waveAt(vec2(0, step).negate()));
        const normal = vec3(slopeX.mul(waterUniforms.rippleStrength), 1, slopeZ.mul(waterUniforms.rippleStrength)).normalize();

        // ── Colour ───────────────────────────────────────────────────────────
        const baseColor = mix(waterUniforms.shallowColor, waterUniforms.deepColor, depthMix);

        // Glancing angles go pale and reflective, straight-down stays clear —
        // cheap stand-in for a real fresnel reflection.
        const facing = normal.dot(positionViewDirection).abs().clamp(0, 1);
        const fresnel = facing.oneMinus().pow(3);
        const litColor = baseColor
            .mul(shadingUniforms.lightColor.mul(shadingUniforms.lightIntensity.mul(0.5).add(0.5)))
            .add(waterUniforms.foamColor.mul(fresnel).mul(0.35));

        // Shoreline foam, broken up so the edge is not a clean ring.
        const foamNoise = mx_noise_float(vec3(worldXZ.mul(0.35), t.mul(1.6))).mul(0.5).add(0.75);
        const foam = depth.smoothstep(waterUniforms.foamWidth, 0).mul(foamNoise).clamp(0, 1);
        const withFoam = mix(litColor, waterUniforms.foamColor, foam);

        // Distant water has to fade into the same fog as everything else, or the
        // lakes stay sharp while the land dissolves behind them.
        const fogged = fogNodes.strength.mix(withFoam, fogNodes.color);

        // Shallow edges are see-through, deep water is not; foam is opaque.
        const alpha = mix(float(0.35), waterUniforms.opacity, depthMix).max(foam);

        m.colorNode = fogged;
        m.outputNode = vec4(fogged, alpha);

        return m;
    }, [waterOrigin]);

    useFrame((state) => {
        if (!meshRef.current) return;

        const x = Math.round(state.camera.position.x / WATER_CELL) * WATER_CELL;
        const z = Math.round(state.camera.position.z / WATER_CELL) * WATER_CELL;
        meshRef.current.position.set(x, waterUniforms.level.value, z);
        waterOrigin.value.set(x, z);
    });

    return <mesh ref={meshRef} geometry={geometry} material={material} frustumCulled={false} renderOrder={2} />;
};
