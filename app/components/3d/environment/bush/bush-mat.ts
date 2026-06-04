import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
    attribute,
    mix,
    mod,
    positionLocal,
    sin,
    smoothstep,
    time,
    uniform,
    uv,
    vec3,
    normalWorld,
    dot,
    texture,
    float // Added float import for math inversion
} from 'three/tsl';

/**
 * createBushMaterial
 * Optimized for WebGPU with inverted alpha testing to handle leaf cutouts perfectly.
 */
export function createBushMaterial(
    uniforms: {
        cameraXZ: any;
        fieldSize: any;
    },
    noiseTex: THREE.Texture,
    alphaTex: THREE.Texture,
): { material: MeshBasicNodeMaterial } {

    const material = new MeshBasicNodeMaterial({
        side: THREE.DoubleSide,
    });

    // ─── VISIBILITY & ALPHA FIX ──────────────────────────────────────────
    material.transparent = true;
    material.depthWrite = true;

    // ─── WIND UNIFORMS ───────────────────────────────────────────────────
    const uSpeed = uniform(0.8);
    const uIntensity = uniform(0.08);

    material.userData.uSpeed = uSpeed;
    material.userData.uIntensity = uIntensity;

    // ─── INFINITE WRAP LOGIC ─────────────────────────────────────────────
    const aSpawnXZ = attribute('aSpawnXZ', 'vec2');
    const halfField = uniforms.fieldSize.mul(0.5);

    const wrappedX = mod(
        aSpawnXZ.x.sub(uniforms.cameraXZ.x).add(halfField),
        uniforms.fieldSize
    )
        .sub(halfField)
        .add(uniforms.cameraXZ.x);

    const wrappedZ = mod(
        aSpawnXZ.y.sub(uniforms.cameraXZ.y).add(halfField),
        uniforms.fieldSize
    )
        .sub(halfField)
        .add(uniforms.cameraXZ.y);

    // ─── WIND ANIMATION ──────────────────────────────────────────────────
    const heightMask = smoothstep(0.0, 1.0, positionLocal.y);

    const windWave = sin(
        time.mul(uSpeed)
            .add(wrappedX.mul(1.7))
            .add(wrappedZ.mul(1.2))
    );

    const secondaryWave = sin(
        time.mul(uSpeed.mul(0.6))
            .add(wrappedZ.mul(2.4))
    );

    const combinedWind = windWave.add(secondaryWave.mul(0.5));
    const windBend = combinedWind.mul(uIntensity).mul(heightMask);

    const swayX = windBend;
    const swayZ = windBend.mul(0.35);

    // ─── FINAL POSITION ──────────────────────────────────────────────────
    material.positionNode = vec3(
        positionLocal.x.add(swayX).add(wrappedX),
        positionLocal.y,
        positionLocal.z.add(swayZ).add(wrappedZ)
    );

    // ─── TEXTURES ────────────────────────────────────────────────────────
    const noiseSample = texture(noiseTex, uv());
    const alphaSample = texture(alphaTex, uv());

    // ─── ALPHA TESTING FIX (INVERTED CHANNEL) ────────────────────────────
    // [FIXED HERE] If leaves were vanishing and backgrounds were showing,
    // we subtract the alpha channel from 1.0 to flip the mask logic cleanly.
    const invertedAlpha = float(1.0).sub(alphaSample.r);
    const finalAlpha = invertedAlpha.smoothstep(0.45, 0.55);
    material.alphaTestNode = finalAlpha;

    // ─── GHIBLI DARK FOREST PALETTE ──────────────────────────────────────
    const noise = noiseSample.r;

    const deepShadow = vec3(0.03, 0.08, 0.04);
    const forestDark = vec3(0.06, 0.14, 0.07);
    const mossGreen = vec3(0.10, 0.22, 0.10);
    const softGreen = vec3(0.117, 0.195, 0.104);

    const h = smoothstep(-0.2, 1.0, positionLocal.y);

    const baseLow = mix(deepShadow, forestDark, smoothstep(0.0, 0.4, h));
    const baseHigh = mix(mossGreen, softGreen, smoothstep(0.4, 1.0, h));

    let base = mix(baseLow, baseHigh, h);
    
    const variation = noise.sub(0.5).mul(0.08);
    let finalColor = base.add(variation);

    // ─── STYLIZED DIFFUSE LIGHTING ───────────────────────────────────────
    const lightDirection = vec3(1.0, 1.0, 0.5).normalize();
    const lightIntensity = dot(normalWorld, lightDirection);
    
    const wrappedLight = lightIntensity.mul(0.5).add(0.5);
    const stylizedLight = wrappedLight.smoothstep(0.3, 0.7);

    const shadowTint = finalColor.mul(vec3(0.5, 0.6, 0.7)); 
    
    material.colorNode = mix(shadowTint, finalColor, stylizedLight);

    return { material };
}