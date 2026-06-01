import * as THREE from 'three';
import { mix, mod, positionLocal, smoothstep, uv, vec3, texture, attribute, uniform, sin, time } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';

export function createCanopyMaterial(
    uniforms: { cameraXZ: any; fieldSize: any; },
    noiseTex: THREE.Texture,
    alphaTex: THREE.Texture,
    config: any
) {
    const material = new MeshBasicNodeMaterial({
        side: THREE.DoubleSide,
    });

    material.transparent = true;
    material.alphaTest = 0.5;

    const uSpeed = uniform(config?.windSpeed ?? 0.8);
    const uIntensity = uniform(config?.swayIntensity ?? 0.08);
    material.userData = { uSpeed, uIntensity };

    const aSpawnXZ = attribute('aSpawnXZ', 'vec2');
    const halfField = uniforms.fieldSize.mul(0.5);

    const wrappedX = mod(aSpawnXZ.x.sub(uniforms.cameraXZ.x).add(halfField), uniforms.fieldSize)
        .sub(halfField)
        .add(uniforms.cameraXZ.x);

    const wrappedZ = mod(aSpawnXZ.y.sub(uniforms.cameraXZ.y).add(halfField), uniforms.fieldSize)
        .sub(halfField)
        .add(uniforms.cameraXZ.y);

    // ─────────────────────────────────────────────
    // REALISTIC TURBULENT WIND MATH
    // ─────────────────────────────────────────────
    const t = time.mul(uSpeed);

    // Primary gust wave (slow, sweeping)
    const baseWave = sin(t.add(wrappedX.mul(0.4)).add(wrappedZ.mul(0.3)));

    // Secondary micro-turbulence (fast, chaotic ripples)
    const microWave1 = sin(t.mul(2.5).add(wrappedX.mul(2.1)));
    const microWave2 = sin(t.mul(4.0).add(wrappedZ.mul(3.7)));

    // Combine waves and bias them between 0.0 and 1.0 (so wind blows in ONE direction)
    const windAccumulator = baseWave.mul(0.6).add(microWave1.mul(0.25)).add(microWave2.mul(0.15));
    const directionalGust = windAccumulator.add(1.0).mul(0.5);

    // Define wind blowing primarily along the X axis, with a slight drift on Z
    const swayX = directionalGust.mul(uIntensity).mul(2.0);
    const swayZ = directionalGust.mul(uIntensity).mul(0.4);

    const liftAmount = 4.0;

    material.positionNode = vec3(
        positionLocal.x.add(swayX).add(wrappedX),
        positionLocal.y.add(liftAmount),
        positionLocal.z.add(swayZ).add(wrappedZ)
    );

    const alphaSample = texture(alphaTex, uv());
    const noiseSample = texture(noiseTex, uv());

    material.opacityNode = alphaSample.r.smoothstep(0.45, 0.55);


    const noise = noiseSample.r;

    // ─────────────────────────────
    // 🌿 SAFE COLOR PALETTE
    // ─────────────────────────────

    const deepShade = vec3(0.01, 0.04, 0.02);  // near-black forest floor green
    const midGreen = vec3(0.03, 0.12, 0.05);  // muted moss green
    const brightGreen = vec3(0.06, 0.18, 0.08);  // soft leaf highlight (NOT neon)
    const sunYellow = vec3(0.55, 0.50, 0.18);  // desaturated dry sunlight tint

    // ─────────────────────────────
    // 🌄 HEIGHT MASK
    // ─────────────────────────────

    const h = smoothstep(0.0, 1.0, positionLocal.y);

    // base layering (NO JS + / -)
    let base = mix(deepShade, midGreen, h);
    base = mix(base, brightGreen, h.mul(0.7));

    // ─────────────────────────────
    // 🌞 SUN MASK (SAFE)
    // ─────────────────────────────

    const sunMask = smoothstep(0.7, 1.0, uv().x).mul(h);

    // blend toward yellow instead of adding
    base = mix(base, sunYellow, sunMask.mul(0.15));

    // ─────────────────────────────
    // 🌿 VARIATION (SAFE NODE MATH)
    // ─────────────────────────────

    const variation = noise.sub(0.5).mul(0.05);

    // IMPORTANT: use add(), not +
    base = base.add(vec3(variation));

    // ─────────────────────────────
    // FINAL
    // ─────────────────────────────

    material.colorNode = base;
    return material;
}
