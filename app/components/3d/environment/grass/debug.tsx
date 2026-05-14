/**
 * TrackDebugPlane
 *
 * A world-space ground plane that renders the FBO track texture using the
 * EXACT same UV math as the grass material's positionNode / trackU / trackV.
 *
 * Drop this into your scene alongside <InfiniteGrass /> and toggle with the
 * `visible` prop. The plane sits at y=0.05 (just above grass roots) and
 * follows the camera so it tiles the same way the grass does.
 *
 * HOW TO USE
 * ──────────
 * 1. In InfiniteGrass, expose readRef.current.texture via a ref or prop.
 * 2. Pass it here as `trackTexture`.
 * 3. Pass the same `fieldSize` you use in GRASS_SETTINGS.
 *
 * Example in InfiniteGrass JSX:
 *
 *   <TrackDebugPlane
 *     trackTexture={readRef.current.texture}
 *     fieldSize={GRASS_SETTINGS.FIELD_SIZE}
 *   />
 *
 * The plane will show:
 *   - White/bright areas = flattening pressure (R channel of FBO)
 *   - The overlay is 30% opaque so you can still see the grass under it
 *
 * COORDINATE ALIGNMENT
 * ─────────────────────
 * The FBO camera is orthographic, centered on (cameraX, 10, cameraZ),
 * looking straight down, with up=(0,0,1) so world Z+ → texture V+.
 *
 * UV formula (matching grass-material.ts exactly):
 *   U = (worldX - cameraX) / fieldSize + 0.5
 *   V = (worldZ - cameraZ) / fieldSize + 0.5
 *
 * This plane uses the same formula via a ShaderMaterial so any UV mismatch
 * will be immediately visible as the texture not lining up with where the
 * car actually drove.
 */

import * as THREE from 'three';
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrackDebugPlaneProps {
    /** The live ping-pong FBO texture (readRef.current.texture) */
    trackTexture: THREE.Texture;
    /** Must match GRASS_SETTINGS.FIELD_SIZE */
    fieldSize: number;
    /** Render the overlay (default: true) */
    visible?: boolean;
    /** Show world axes (default: true) */
    showAxes?: boolean;
    /** Y offset above ground (default: 0.05) */
    yOffset?: number;
    /** Opacity of the overlay (default: 0.55) */
    opacity?: number;
}


// ─── Vertex / Fragment Shaders ────────────────────────────────────────────────
//
// The vertex shader reconstructs the same UV math the grass uses, letting you
// immediately spot if there's an axis flip, scale mismatch, or origin offset.

const vertexShader = /* glsl */ `
    uniform vec2  cameraXZ;
    uniform float fieldSize;

    varying vec2 vTrackUV;
    varying vec2 vWorldXZ;

    void main() {
        // Reconstruct world position from the plane geometry
        vec4 worldPos = modelMatrix * vec4(position, 1.0);

        // ── EXACT same formula as grass-material.ts ──
        float u = (worldPos.x - cameraXZ.x) / fieldSize + 0.5;
        float v = (worldPos.z - cameraXZ.y) / fieldSize + 0.5;

        vTrackUV  = vec2(u, v);
        vWorldXZ  = worldPos.xz;

        gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
`;

const fragmentShader = /* glsl */ `
    uniform sampler2D trackTex;
    uniform float     opacity;
    // grid overlay toggle
    uniform float     showGrid;

    varying vec2 vTrackUV;
    varying vec2 vWorldXZ;

    void main() {
        // Out-of-bounds check — tint OOB magenta so you can see wrapping issues
        if (vTrackUV.x < 0.0 || vTrackUV.x > 1.0 ||
            vTrackUV.y < 0.0 || vTrackUV.y > 1.0) {
            gl_FragColor = vec4(1.0, 0.0, 1.0, opacity * 0.3);
            return;
        }

        vec4  fbo  = texture2D(trackTex, vTrackUV);
        float flat = fbo.r; // R channel = flatten intensity

        // Heat-map: black (no flatten) → orange → white (full flatten)
        vec3 cold = vec3(0.0, 0.0, 0.0);
        vec3 warm = vec3(1.0, 0.45, 0.0);
        vec3 hot  = vec3(1.0, 1.0, 1.0);

        vec3 color = mix(cold, warm, clamp(flat * 2.0,       0.0, 1.0));
             color = mix(color, hot,  clamp(flat * 2.0 - 1.0, 0.0, 1.0));

        // Faint 1-unit world grid overlay so you can gauge scale
        if (showGrid > 0.5) {
            vec2  grid  = abs(fract(vWorldXZ - 0.5) - 0.5) / fwidth(vWorldXZ);
            float lines = 1.0 - min(min(grid.x, grid.y), 1.0);
            color = mix(color, vec3(0.3, 0.8, 1.0), lines * 0.4);
        }

        gl_FragColor = vec4(color, opacity * (0.15 + flat * 0.85));
    }
`;

// ─── Component ────────────────────────────────────────────────────────────────

export function TrackDebugPlane({
    trackTexture,
    fieldSize,
    visible = true,
    showAxes = true,
    yOffset = 0.05,
    opacity = 0.55,
}: TrackDebugPlaneProps) {
    const meshRef  = useRef<THREE.Mesh>(null);
    const matRef   = useRef<THREE.ShaderMaterial>(null);

    const material = useMemo(() => new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        uniforms: {
            cameraXZ: { value: new THREE.Vector2() },
            fieldSize: { value: fieldSize },
            trackTex:  { value: trackTexture },
            opacity:   { value: opacity },
            showGrid:  { value: 1.0 },
        },
    }), [fieldSize, trackTexture, opacity]);

    // Plane covers exactly one field tile
    const geometry = useMemo(
        () => new THREE.PlaneGeometry(fieldSize, fieldSize, 64, 64),
        [fieldSize]
    );

    useFrame(({ camera, gl }) => {
        if (!meshRef.current || !matRef.current) return;

        // Follow camera (same as infinite grass tiling)
        meshRef.current.position.set(camera.position.x, yOffset, camera.position.z);

        // Keep uniforms in sync
        matRef.current.uniforms.cameraXZ.value.set(camera.position.x, camera.position.z);
        matRef.current.uniforms.trackTex.value  = trackTexture;
        matRef.current.uniforms.opacity.value   = opacity;

        // Suppress TS unused-var warning — gl is needed by useFrame signature
        void gl;
    });

    if (!visible && !showAxes) return null;

    return (
        <group ref={meshRef as any}>
            {visible && (
                <mesh
                    geometry={geometry}
                    material={material}
                    // @ts-ignore — ShaderMaterial ref typing
                    materialRef={matRef}
                    rotation={[-Math.PI / 2, 0, 0]}
                    frustumCulled={false}
                    renderOrder={1}
                >
                    {/* Attach the material ref the r3f way */}
                    <primitive object={material} ref={matRef} attach="material" />
                </mesh>
            )}
            {showAxes && <axesHelper args={[10]} />}
        </group>
    );
}



// ─── Usage notes ──────────────────────────────────────────────────────────────
//
// COMMON MISALIGNMENT SYMPTOMS & FIXES
// ─────────────────────────────────────
//
// Symptom: overlay tracks appear MIRRORED on X axis
//   → The FBO camera up vector may be flipping. Confirm trackCamera.up = (0,0,1)
//     is set BEFORE lookAt(), not after. THREE recomputes up during lookAt.
//
// Symptom: overlay tracks appear MIRRORED on Z axis  
//   → FBO ortho frustum top/bottom may be swapped.
//     new THREE.OrthographicCamera(-h, h, h, -h, ...) where top=+h, bottom=-h
//     with up=(0,0,1) means world Z+ → texture V+. If you see Z flip, try
//     new THREE.OrthographicCamera(-h, h, -h, h, ...)
//
// Symptom: overlay correct on X but shifted by fieldSize/2
//   → The grass wrapping mod() is shifting blade centers but the FBO UV origin
//     doesn't account for it. The UV formula uses raw worldX not wrappedX —
//     this is intentional (FBO sees true world coords), but double-check
//     that trackCamera is centred on camera.position, not origin.
//
// Symptom: tracks visible in HUD but NOT on debug plane
//   → readRef vs writeRef swap: you might be reading the wrong target.
//     Pass readRef.current.texture (the one you just wrote TO last frame).
//
// Symptom: debug plane correct but grass flatten still misaligned
//   → The grass positionNode uses wrappedCenterX/Z for the blade world position,
//     but trackU/trackV use bladeWorldPos.x/.z (post-wrap). That's correct.
//     If still off, log bladeWorldPos vs actual car position to find the delta.