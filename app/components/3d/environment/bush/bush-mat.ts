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
    dot
} from 'three/tsl';

import { texture } from 'three/tsl';

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

    material.transparent = true;

    // ─────────────────────────────
    // WIND UNIFORMS
    // ─────────────────────────────

    const uSpeed = uniform(0.8);
    const uIntensity = uniform(0.08);

    material.userData.uSpeed = uSpeed;
    material.userData.uIntensity = uIntensity;

    // ─────────────────────────────
    // INFINITE WRAP
    // ─────────────────────────────

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

    // ─────────────────────────────
    // WIND
    // ─────────────────────────────

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

    // ─────────────────────────────
    // POSITION
    // ─────────────────────────────

    material.positionNode = vec3(
        positionLocal.x.add(swayX).add(wrappedX),
        positionLocal.y,
        positionLocal.z.add(swayZ).add(wrappedZ)
    );

    // ─────────────────────────────
    // TEXTURES
    // ─────────────────────────────

    const noiseSample = texture(noiseTex, uv());
    const alphaSample = texture(alphaTex, uv());

    // ─────────────────────────────
    // ALPHA
    // ─────────────────────────────

    material.opacityNode = alphaSample.r.smoothstep(0.45, 0.55);


    // ─────────────────────────────
    // 🌿 GHIBLI DARK FOREST PALETTE
    // ─────────────────────────────

    const noise = noiseSample.r;

    // deep forest greens (low saturation, earthy)
    const deepShadow = vec3(0.03, 0.08, 0.04);
    const forestDark = vec3(0.06, 0.14, 0.07);
    const mossGreen = vec3(0.10, 0.22, 0.10);
    const softGreen = vec3(0.117, 0.195, 0.104);

    // subtle warm life (barely visible sun kiss)

    // height shaping (very soft, no sharp bands)
    const h = smoothstep(-0.2, 1.0, positionLocal.y);

    // layered depth
    const baseLow = mix(deepShadow, forestDark, smoothstep(0.0, 0.4, h));
    const baseHigh = mix(mossGreen, softGreen, smoothstep(0.4, 1.0, h));

    let base = mix(baseLow, baseHigh, h);

    // gentle breakup (keep it subtle, Ghibli is calm)
    const variation = noise.sub(0.5).mul(0.08);



    // final base color with noise
    let finalColor = base.add(variation);

    // ─────────────────────────────
    // STEP 1: CUSTOM DIFFUSE LIGHTING
    // ─────────────────────────────
    
    // 1. Define the Light Direction (pointing towards the sun)
    const lightDirection = vec3(1.0, 1.0, 0.5).normalize();

    // 2. Calculate the Dot Product between surface normal and light direction
    const lightIntensity = dot(normalWorld, lightDirection);

    // 3. Remap the Intensity (Half-Lambert wrap: * 0.5 + 0.5)
    const wrappedLight = lightIntensity.mul(0.5).add(0.5);

    // 4. Stylize the Transition
    const stylizedLight = wrappedLight.smoothstep(0.3, 0.7);

    // 5. Mix between a shadow tint and the base color based on lighting
    // We create a deeper, cooler shadow by darkening and slightly blue-shifting
    const shadowTint = finalColor.mul(vec3(0.5, 0.6, 0.7)); 
    
    // Apply lighting to final color
    finalColor = mix(shadowTint, finalColor, stylizedLight);

    material.colorNode = finalColor;

    return { material };
}
