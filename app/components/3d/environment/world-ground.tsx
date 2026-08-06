import { HeightfieldCollider, RigidBody, RapierRigidBody, useRapier } from '@react-three/rapier';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { mix, mx_noise_float, positionLocal, positionWorld, texture, uniform, vec2, vec3 } from 'three/tsl';
import { applyFolioShading } from '../materials/folio-shading';
import { TERRAIN_CONFIG, getTerrainHeight, sampleTerrainPatch, terrainHeightNode, terrainNormalNode } from '@/app/systems/terrain';
import { TERRAIN_VISUAL, subscribeToTerrainBake, terrainVisualUniforms } from '@/app/controls/terrainControls';
import { waterUniforms } from '@/app/controls/waterControls';

interface WorldGroundProps {
    chasisBodyRef?: React.RefObject<RapierRigidBody | null>;
}

// Visual mesh: a grid that follows the camera, displaced by the heightmap. It is
// snapped to whole cells so vertices always land on the same world positions —
// otherwise the surface ripples as you drive.
const GROUND_SIZE = 512;
const GROUND_SEGMENTS = 256;
const GROUND_CELL = GROUND_SIZE / GROUND_SEGMENTS;

// Physics patch: cells match the heightmap's own sample spacing so the surface
// the wheels ride is the surface you see.
const PATCH_CELLS = 144;

export const WorldGround = ({ chasisBodyRef }: WorldGroundProps) => {
    const meshRef = useRef<THREE.Mesh>(null!);
    const checkTimer = useRef(0);
    const { world, rapier } = useRapier();

    const patchStep = TERRAIN_CONFIG.period / TERRAIN_CONFIG.resolution;
    const patchSize = patchStep * PATCH_CELLS;
    const rebuildDistance = patchSize * 0.25;

    const [patch, setPatch] = useState(() => ({
        x: 0,
        z: 0,
        heights: sampleTerrainPatch(0, 0, patchSize, PATCH_CELLS),
    }));

    // A shape change rebakes the heightmap, so the collision patch has to be
    // resampled or the car would drive on the old terrain.
    useEffect(() => {
        return subscribeToTerrainBake(() => {
            setPatch((current) => ({
                ...current,
                heights: sampleTerrainPatch(current.x, current.z, patchSize, PATCH_CELLS),
            }));
        });
    }, [patchSize]);

    const fieldTexture = useMemo(() => {
        // Seeded, so the ground texture is identical every run (and so this
        // stays a pure render — rand() here is neither).
        let seed = 0x9e3779b9;
        const rand = () => {
            seed = (seed + 0x6d2b79f5) | 0;
            let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };

        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Meadow soil: a deep green base that reads as vegetated ground rather
        // than sand, speckled with darker undergrowth and a little warm earth
        // showing through.
        ctx.fillStyle = '#4a6b32';
        ctx.fillRect(0, 0, 512, 512);

        // Darker clumps of undergrowth
        for (let i = 0; i < 320; i++) {
            const x = rand() * 512;
            const y = rand() * 512;
            const size = rand() * 7 + 3;
            ctx.fillStyle = `rgba(42, 74, 30, ${rand() * 0.45 + 0.2})`;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }

        // Lighter growth catching the light
        for (let i = 0; i < 260; i++) {
            const x = rand() * 512;
            const y = rand() * 512;
            const size = rand() * 4 + 1.5;
            ctx.fillStyle = `rgba(124, 158, 74, ${rand() * 0.4 + 0.2})`;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }

        // Occasional bare earth
        for (let i = 0; i < 90; i++) {
            const x = rand() * 512;
            const y = rand() * 512;
            const size = rand() * 3 + 1;
            ctx.fillStyle = `rgba(122, 92, 58, ${rand() * 0.35 + 0.15})`;
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

    // The mesh origin, fed to the shader so it can turn local vertices into the
    // world coordinates the heightmap is keyed on.
    const groundOrigin = useMemo(() => uniform(new THREE.Vector2()), []);

    const geometry = useMemo(() => {
        const geo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, GROUND_SEGMENTS, GROUND_SEGMENTS);
        // Bake the lie-flat rotation in, so positionLocal.xz are the plane axes
        // and the displacement can simply be written into y.
        geo.rotateX(-Math.PI / 2);
        return geo;
    }, []);

    const material = useMemo(() => {
        const m = new MeshStandardNodeMaterial({
            roughness: 0.9,
            metalness: 0.02,
        });

        const worldXZ = vec2(positionLocal.x, positionLocal.z).add(groundOrigin);
        m.positionNode = vec3(positionLocal.x, terrainHeightNode(worldXZ), positionLocal.z);
        // Replaced below with a detail-perturbed normal when the ground texture
        // is available; this is the fallback.
        m.normalNode = terrainNormalNode(worldXZ);

        if (fieldTexture) {
            const worldUV = positionWorld.xz.mul(0.05);
            const dirtColor = texture(fieldTexture, worldUV);

            // ── Surface detail ───────────────────────────────────────────────
            // The heightmap resolves down to 2 units, so on its own the surface
            // reads as a smooth sheet. This adds grain finer than the heightmap
            // can carry, as a normal perturbation only — free of any physics or
            // bake cost, since it never changes where the ground actually is.
            const detailScale = terrainVisualUniforms.detailScale;
            const step = 0.35;
            const grainAt = (offset: ReturnType<typeof vec2>) =>
                mx_noise_float(positionWorld.xz.add(offset).mul(detailScale));
            const grainX = grainAt(vec2(step, 0)).sub(grainAt(vec2(step, 0).negate()));
            const grainZ = grainAt(vec2(0, step)).sub(grainAt(vec2(0, step).negate()));

            const baseNormal = terrainNormalNode(positionWorld.xz);
            const normal = baseNormal
                .add(vec3(grainX, 0, grainZ).mul(terrainVisualUniforms.detailStrength))
                .normalize();

            // oneMinus rather than reversed smoothstep edges — GLSL leaves
            // smoothstep undefined when edge0 > edge1.
            const slope = normal.y.smoothstep(terrainVisualUniforms.rockSlopeLow, terrainVisualUniforms.rockSlopeHigh).oneMinus();
            const altitude = positionWorld.y.smoothstep(terrainVisualUniforms.peakLow, terrainVisualUniforms.peakHigh);

            // ── Colour ───────────────────────────────────────────────────────
            // Broken up by two scales of noise so the ground is not one flat
            // tone: wide patches of dry grass over dirt, then fine grain.
            const patches = mx_noise_float(positionWorld.xz.mul(0.012)).add(1).mul(0.5);
            const tinted = mix(dirtColor.rgb, terrainVisualUniforms.dryColor, patches.smoothstep(0.45, 0.85));
            const grained = tinted.mul(grainAt(vec2(0, 0)).mul(0.12).add(1));

            const groundColor = mix(grained, terrainVisualUniforms.rockColor, slope);
            const withPeaks = mix(groundColor, terrainVisualUniforms.peakColor, altitude);

            // Shoreline: a wet band where the ground meets the water line, and
            // silt below it. Borrowed from folio, where the same band is what
            // makes its water read as water rather than a blue plane.
            const toWater = positionWorld.y.sub(waterUniforms.level);
            const wetBand = toWater.abs().smoothstep(waterUniforms.foamWidth.mul(1.6), 0);
            const submerged = toWater.smoothstep(0, -2.5);
            const shoreline = mix(withPeaks, terrainVisualUniforms.shoreColor, wetBand.mul(0.75));
            const finalColor = mix(shoreline, terrainVisualUniforms.siltColor, submerged);

            // Debug: show the height the shader actually samples, banded so it
            // is obvious whether it varies at all.
            const debugColor = vec3(
                positionWorld.y.mul(0.02).fract(),
                positionWorld.y.mul(0.005).fract(),
                terrainHeightNode(positionWorld.xz).mul(0.01).fract(),
            );
            const shownColor = mix(finalColor, debugColor, terrainVisualUniforms.debugHeight);

            m.colorNode = shownColor;
            m.normalNode = normal;
            applyFolioShading(m, { colorNode: shownColor, normalNode: normal, hasLightBounce: false });
        }

        return m;
    }, [fieldTexture, groundOrigin]);

    // Physics/visual agreement check. Casts a ray straight down onto the real
    // collider and compares it with the height the shaders displace by. These
    // are computed by completely different code paths, so a mismatch (a bad
    // heightfield layout, a stale patch) shows up here as a console warning
    // rather than as a car that drives on invisible ground.
    const verifyPatch = (world: ReturnType<typeof useRapier>['world'], x: number, z: number) => {
        const expected = getTerrainHeight(x, z);
        const ray = new rapier.Ray({ x, y: expected + 200, z }, { x: 0, y: -1, z: 0 });
        const hit = world.castRay(ray, 400, true);
        if (!hit) return;

        const actual = expected + 200 - hit.timeOfImpact;
        if (Math.abs(actual - expected) > 1.0) {
            console.warn(
                `[Terrain] Physics and visuals disagree at (${x.toFixed(1)}, ${z.toFixed(1)}): ` +
                `collider ${actual.toFixed(2)} vs heightmap ${expected.toFixed(2)}`
            );
        }
    };

    useFrame((state) => {
        // 1. Keep the visual grid centred on the camera, snapped to whole cells.
        if (meshRef.current) {
            const x = Math.round(state.camera.position.x / GROUND_CELL) * GROUND_CELL;
            const z = Math.round(state.camera.position.z / GROUND_CELL) * GROUND_CELL;
            meshRef.current.position.set(x, 0, z);
            groundOrigin.value.set(x, z);
        }

        // 2. Rebuild the physics patch when the car nears its edge. Centres are
        // snapped to the heightmap grid so patch corners land on real samples.
        const carPos = chasisBodyRef?.current?.translation();
        if (!carPos) return;

        if (Math.abs(carPos.x - patch.x) > rebuildDistance || Math.abs(carPos.z - patch.z) > rebuildDistance) {
            const x = Math.round(carPos.x / patchStep) * patchStep;
            const z = Math.round(carPos.z / patchStep) * patchStep;
            setPatch({ x, z, heights: sampleTerrainPatch(x, z, patchSize, PATCH_CELLS) });
            return;
        }

        // Check a spot off to the side of the car, where the terrain is least
        // likely to be flat, once every couple of seconds.
        checkTimer.current += 1;
        if (checkTimer.current > 120) {
            checkTimer.current = 0;
            verifyPatch(world, carPos.x + 12, carPos.z + 17);
        }
    });

    return (
        <>
            {/* Collision surface, following the car */}
            <RigidBody type="fixed" colliders={false} position={[patch.x, 0, patch.z]} friction={1.2}>
                <HeightfieldCollider
                    args={[
                        PATCH_CELLS,
                        PATCH_CELLS,
                        patch.heights as unknown as number[],
                        // Fresh object every time: the library mutates this.
                        { x: patchSize, y: 1, z: patchSize },
                    ]}
                />
            </RigidBody>

            {/* Visual terrain */}
            <mesh
                ref={meshRef}
                geometry={geometry}
                material={material}
                receiveShadow
                frustumCulled={false}
            />
        </>
    );
};
