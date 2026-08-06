import { HeightfieldCollider, RigidBody, RapierRigidBody, useRapier } from '@react-three/rapier';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { cameraPosition, float, mix, mx_noise_float, positionLocal, positionWorld, uniform, vec2, vec3 } from 'three/tsl';
import { applyFolioShading } from '../materials/folio-shading';
import { TERRAIN_CONFIG, getTerrainHeight, sampleTerrainPatch, terrainHeightNode, terrainNormalNode } from '@/app/systems/terrain';
import { subscribeToTerrainBake, terrainVisualUniforms } from '@/app/controls/terrainControls';
import { waterUniforms } from '@/app/controls/waterControls';
import { pathMaskNode } from '@/app/systems/paths';

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
        const m = new MeshStandardNodeMaterial({ roughness: 0.95, metalness: 0.0 });

        const worldXZ = vec2(positionLocal.x, positionLocal.z).add(groundOrigin);
        m.positionNode = vec3(positionLocal.x, terrainHeightNode(worldXZ), positionLocal.z);
        m.normalNode = terrainNormalNode(worldXZ);

        // ── Terrain samples ──────────────────────────────────────────────────
        // Taken once and reused for the normal, the slope and the curvature,
        // rather than three separate sets of taps.
        const p = positionWorld.xz;
        const e = 1.5;
        const hC = terrainHeightNode(p);
        const hL = terrainHeightNode(p.sub(vec2(e, 0)));
        const hR = terrainHeightNode(p.add(vec2(e, 0)));
        const hD = terrainHeightNode(p.sub(vec2(0, e)));
        const hU = terrainHeightNode(p.add(vec2(0, e)));

        const surfaceNormal = vec3(hL.sub(hR), e * 2, hD.sub(hU)).normalize();

        // Curvature: the height here against the average of its neighbours.
        // Negative in hollows, positive on ridges. This is the single biggest
        // "expensive-looking" cue — it darkens creases and catches light on
        // edges the way real ground does, and it costs nothing extra because
        // the samples are already here.
        const curvature = hC.sub(hL.add(hR).add(hD).add(hU).mul(0.25));
        const cavity = curvature.smoothstep(-0.35, 0.35);

        // ── Detail, faded with distance ──────────────────────────────────────
        // Fine grain is only meaningful up close; left on at range it turns into
        // shimmer, which is exactly what makes ground look cheap.
        const viewDistance = positionWorld.distance(cameraPosition);
        const nearness = viewDistance.smoothstep(90, 18);

        const grainAt = (offset: ReturnType<typeof vec2>) =>
            mx_noise_float(p.add(offset).mul(terrainVisualUniforms.detailScale));
        const grainC = grainAt(vec2(0, 0));
        const step = 0.4;
        const grainX = grainAt(vec2(step, 0)).sub(grainC);
        const grainZ = grainAt(vec2(0, step)).sub(grainC);

        const normal = surfaceNormal
            .add(vec3(grainX, 0, grainZ).mul(terrainVisualUniforms.detailStrength.mul(nearness)))
            .normalize();

        // ── Colour ───────────────────────────────────────────────────────────
        // Three scales of variation, none of them tiling: broad biome drift,
        // meadow patches, then grain. Fully procedural, so there is no repeat
        // to spot however far you drive.
        const macro = mx_noise_float(p.mul(0.0035)).mul(0.5).add(0.5);
        const meso = mx_noise_float(p.mul(0.03)).mul(0.5).add(0.5);

        const lush = mix(terrainVisualUniforms.grassColor, terrainVisualUniforms.grassDryColor, macro.smoothstep(0.35, 0.75));
        const withPatches = mix(lush, terrainVisualUniforms.soilColor, meso.smoothstep(0.62, 0.9));
        const meadow = withPatches.mul(grainC.mul(0.13).mul(nearness).add(1));

        // Rock uses vertical banding rather than the flat XZ projection, so
        // cliffs get strata instead of a smeared top-down texture.
        const strata = mx_noise_float(vec3(p.mul(0.05), positionWorld.y.mul(0.35))).mul(0.5).add(0.5);
        const rock = mix(terrainVisualUniforms.rockColor, terrainVisualUniforms.rockDarkColor, strata);

        const slope = normal.y.smoothstep(terrainVisualUniforms.rockSlopeLow, terrainVisualUniforms.rockSlopeHigh).oneMinus();
        const altitude = positionWorld.y.smoothstep(terrainVisualUniforms.peakLow, terrainVisualUniforms.peakHigh);

        // Damp growth gathers in hollows, ridges dry out — driven by the same
        // curvature that does the cavity shading.
        const mossy = mix(meadow, terrainVisualUniforms.mossColor, cavity.oneMinus().mul(0.55));

        // Worn trails, matching the mask that keeps grass off them.
        const path = pathMaskNode(p, surfaceNormal.y);
        const withEdge = mix(mossy, terrainVisualUniforms.pathEdgeColor, path.smoothstep(0, 0.55).mul(0.7));
        const withPath = mix(withEdge, terrainVisualUniforms.pathColor, path.smoothstep(0.35, 0.95));

        const groundColor = mix(withPath, rock, slope);
        const withPeaks = mix(groundColor, terrainVisualUniforms.peakColor, altitude);

        // Shoreline: a wet band where the ground meets the water line, and silt
        // below it. Borrowed from folio, where the same band is what makes its
        // water read as water rather than a blue plane.
        const toWater = positionWorld.y.sub(waterUniforms.level);
        const wetBand = toWater.abs().smoothstep(waterUniforms.foamWidth.mul(1.6), 0);
        const submerged = toWater.smoothstep(0, -2.5);
        const shoreline = mix(withPeaks, terrainVisualUniforms.shoreColor, wetBand.mul(0.75));
        const bedded = mix(shoreline, terrainVisualUniforms.siltColor, submerged);

        // Cavity shading last, so it darkens whatever the surface turned out to
        // be rather than one particular layer.
        const occluded = bedded.mul(mix(terrainVisualUniforms.aoStrength.oneMinus(), float(1), cavity));

        const debugColor = vec3(positionWorld.y.mul(0.02).fract(), positionWorld.y.mul(0.005).fract(), cavity);
        const shownColor = mix(occluded, debugColor, terrainVisualUniforms.debugHeight);

        m.colorNode = shownColor;
        m.normalNode = normal;
        applyFolioShading(m, { colorNode: shownColor, normalNode: normal, hasLightBounce: false });

        return m;
    }, [groundOrigin]);

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
