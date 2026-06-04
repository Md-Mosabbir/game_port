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
    float,
    mx_noise_float
} from 'three/tsl';

export function createCanopyMaterial(
    uniforms: {
        cameraXZ: any;
        fieldSize: any;
    },
    noiseTex: THREE.Texture,
    alphaTex: THREE.Texture,
    config?: {
        windSpeed?: number;
        swayIntensity?: number;
    }
): MeshBasicNodeMaterial {

    const material = new MeshBasicNodeMaterial({
        side: THREE.DoubleSide,
    });

    // ─── VISIBILITY & ALPHA FIX ──────────────────────────────────────────
    material.transparent = true;
    material.depthWrite = true;

    // ─── WIND UNIFORMS ───────────────────────────────────────────────────
    const uSpeed = uniform(config?.windSpeed ?? 0.8);
    const uIntensity = uniform(config?.swayIntensity ?? 0.08);

    material.userData = { uSpeed, uIntensity };

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

    // ─── TURBULENT WIND ANIMATION ────────────────────────────────────────
    const t = time.mul(uSpeed);
    const baseWave = sin(t.add(wrappedX.mul(0.4)).add(wrappedZ.mul(0.3)));
    const microWave1 = sin(t.mul(2.5).add(wrappedX.mul(2.1)));
    const windAccumulator = baseWave.mul(0.6).add(microWave1.mul(0.25));
    const directionalGust = windAccumulator.add(1.0).mul(0.5);

    const swayX = directionalGust.mul(uIntensity).mul(2.0);
    const swayZ = directionalGust.mul(uIntensity).mul(0.4);

    const liftAmount = 4.0; 

    material.positionNode = vec3(
        positionLocal.x.add(swayX).add(wrappedX),
        positionLocal.y.add(liftAmount),
        positionLocal.z.add(swayZ).add(wrappedZ)
    );

    // ─── TEXTURES ────────────────────────────────────────────────────────
    const alphaSample = texture(alphaTex, uv());
    const noiseSample = texture(noiseTex, uv());

    // ─── ALPHA TESTING FIX (INVERTED CHANNEL) ────────────────────────────
    const invertedAlpha = float(1.0).sub(alphaSample.r);
    material.alphaTestNode = invertedAlpha.smoothstep(0.45, 0.55);

    // ─── PROCEDURAL PALETTE VARIATION (60% GREEN / 40% MIXED) ────────────
    const treeSeedNoise = mx_noise_float(aSpawnXZ.mul(0.05)).add(1.0).mul(0.5);

    // [CHANGED] Dynamic thresholds shifted up to guarantee 60% default Forest Green
    // 0.00 to 0.60 -> Deep Forest Green (60%)
    // 0.60 to 0.73 -> Bright Cherry Pink (13.3%)
    // 0.73 to 0.86 -> Ghibli Sunset Orange (13.3%)
    // 0.86 to 1.00 -> Golden Yellow-Green (13.3%)
    const selectCherry = treeSeedNoise.smoothstep(0.60, 0.64);
    const selectOrange = treeSeedNoise.smoothstep(0.73, 0.77);
    const selectYellow = treeSeedNoise.smoothstep(0.86, 0.90);

    // ─────────────────────────────────────────────────────────────────
    // 🌿 RE-ENGINEERED GHIBLI PALETTES
    // ─────────────────────────────────────────────────────────────────
    
    // 🌲 1. Deep Forest Green (Dominant Base Color)
    const forestDeep   = vec3(0.01, 0.04, 0.02);
    const forestMid    = vec3(0.04, 0.12, 0.05);
    const forestBright = vec3(0.08, 0.22, 0.10);

    // 🌸 2. Bright Cherry Pink
    const cherryDeep   = vec3(0.45, 0.05, 0.20);
    const cherryMid    = vec3(0.95, 0.25, 0.55);
    const cherryBright = vec3(1.00, 0.45, 0.70);

    // 🍊 3. Sunset Orange
    const orangeDeep   = vec3(0.30, 0.05, 0.00);
    const orangeMid    = vec3(0.85, 0.28, 0.02);
    const orangeBright = vec3(0.98, 0.48, 0.05);

    // 💛 4. Golden Yellow-Green
    const yellowDeep   = vec3(0.05, 0.08, 0.02);
    const yellowMid    = vec3(0.35, 0.42, 0.05);
    const yellowBright = vec3(0.68, 0.68, 0.12);

    // Blend everything sequentially based on our 60/40 split thresholds
    const finalDeep   = mix(mix(mix(forestDeep,   cherryDeep,   selectCherry), orangeDeep,   selectOrange), yellowDeep,   selectYellow);
    const finalMid    = mix(mix(mix(forestMid,    cherryMid,    selectCherry), orangeMid,    selectOrange), yellowMid,    selectYellow);
    const finalBright = mix(mix(mix(forestBright, cherryBright, selectCherry), orangeBright, selectOrange), yellowBright, selectYellow);

    // ─── HEIGHT MASK AND COLOR BREAKUP ───────────────────────────────────
    const h = smoothstep(0.0, 1.0, positionLocal.y);
    const internalNoise = noiseSample.r;

    let baseColor = mix(finalDeep, finalMid, h);
    baseColor = mix(baseColor, finalBright, h.mul(internalNoise.add(0.4)));

    // Micro leaf variation
    const variation = internalNoise.sub(0.5).mul(0.04);
    baseColor = baseColor.add(vec3(variation));

    // ─── STYLIZED DIFFUSE LIGHTING (Ghibli Shading) ──────────────────────
    const lightDirection = vec3(1.0, 1.0, 0.5).normalize();
    const lightIntensity = dot(normalWorld, lightDirection);
    
    const wrappedLight = lightIntensity.mul(0.5).add(0.5);
    const stylizedLight = wrappedLight.smoothstep(0.35, 0.65);

    // Atmospheric cool tint for shadowed fields
    const shadowTint = baseColor.mul(vec3(0.48, 0.52, 0.58)); 
    
    material.colorNode = mix(shadowTint, baseColor, stylizedLight);

    return material;
}