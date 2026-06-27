import {
    attribute,
    mod,
    positionLocal,
    vec3,
    uniform,
    sin,
    time,
    smoothstep,
    dot,
    normalWorld,
    mx_noise_float,
    vec2,
    mix,
    float
} from 'three/tsl';
import { MeshStandardNodeMaterial } from 'three/webgpu';

export function createTrunkMaterial(uniforms: any, config: any) {
    const material = new MeshStandardNodeMaterial({ roughness: 0.8, metalness: 0.0 });

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

    // ─── DYNAMIC GEOMETRY HEIGHT SYSTEM ──────────────────────────────────
    // [FIXED] Updated standard layout bounds from 5.0 up to 9.0 to match your unified geometry
    const totalTrunkHeight = float(config.treeHeight || 9.0);
    const heightMask = smoothstep(0.0, totalTrunkHeight, positionLocal.y);

    // ─── WIND ACCUMULATION ──────────────────────────────────────────────
    const t = time.mul(uSpeed);
    const baseWave = sin(t.add(wrappedX.mul(0.4)).add(wrappedZ.mul(0.3)));
    const microWave1 = sin(t.mul(2.5).add(wrappedX.mul(2.1)));
    const microWave2 = sin(t.mul(4.0).add(wrappedZ.mul(3.7)));

    const windAccumulator = baseWave.mul(0.6).add(microWave1.mul(0.25)).add(microWave2.mul(0.15));
    const directionalGust = windAccumulator.add(1.0).mul(0.5);

    const swayX = directionalGust.mul(uIntensity).mul(2.0).mul(heightMask);
    const swayZ = directionalGust.mul(uIntensity).mul(0.4).mul(heightMask);

    const worldX = positionLocal.x.add(swayX).add(wrappedX);
    const worldY = positionLocal.y;
    const worldZ = positionLocal.z.add(swayZ).add(wrappedZ);

    material.positionNode = vec3(worldX, worldY, worldZ);

    // ─── PROCEDURAL BARK SEED SYSTEM (60/40 SPLIT) ──────────────────────
    const treeSeedNoise = mx_noise_float(aSpawnXZ.mul(0.05)).add(1.0).mul(0.5);

    const selectCherry = treeSeedNoise.smoothstep(0.60, 0.64);
    const selectOrange = treeSeedNoise.smoothstep(0.73, 0.77);
    const selectYellow = treeSeedNoise.smoothstep(0.86, 0.90);

    // ─── THE CONTRAST PALETTES ──────────────────────────────────────────
    // 🌲 1. Standard Green Trees -> Dark Forest Mahogany
    const barkForestDeep = vec3(0.03, 0.02, 0.015);
    const barkForestMain = vec3(0.14, 0.09, 0.06);

    // 🌸 2. Cherry Pink Trees -> Ghibli White Birch 
    const barkCherryDeep = vec3(0.42, 0.40, 0.45); 
    const barkCherryMain = vec3(0.88, 0.86, 0.88); 

    // 🍊 3. Sunset Orange Trees -> Rich Golden Medium Brown
    const barkOrangeDeep = vec3(0.16, 0.08, 0.03);
    const barkOrangeMain = vec3(0.42, 0.24, 0.12); 

    // 💛 4. Golden Yellow Trees -> Mossy Olive Ochre
    const barkYellowDeep = vec3(0.10, 0.11, 0.06);
    const barkYellowMain = vec3(0.36, 0.35, 0.22);

    // Cascade blend based on the shared seed
    const deepBark = mix(mix(mix(barkForestDeep, barkCherryDeep, selectCherry), barkOrangeDeep, selectOrange), barkYellowDeep, selectYellow);
    const mainBark = mix(mix(mix(barkForestMain, barkCherryMain, selectCherry), barkOrangeMain, selectOrange), barkYellowMain, selectYellow);

    // ─── STYLIZED WOOD GRAIN STRIPES ────────────────────────────────────
    const uniqueTrunkOffset = aSpawnXZ.x.add(aSpawnXZ.y);

    // For the white tree, we want tighter, cleaner knot markings
    const stripeScaleX = mix(float(2.5), float(4.5), selectCherry);
    const stripeScaleY = mix(float(2.0), float(4.0), selectCherry); // Adjusted for normalized ratios

    // [FIXED] Substituted raw local Y for a normalized scale ratio (positionLocal.y / totalTrunkHeight)
    // This stops scaling transformations from pulling wood lines completely out of visual focus!
    const normalizedY = positionLocal.y.div(totalTrunkHeight);

    const barkUV = vec2(
        worldX.add(worldZ).mul(stripeScaleX).add(uniqueTrunkOffset),
        normalizedY.mul(stripeScaleY).mul(8.0) // Fixed pattern matching
    );

    const noiseLine = mx_noise_float(barkUV);
    const barkStripeMask = smoothstep(0.18, 0.42, noiseLine);
    let finalBarkColor = mix(deepBark, mainBark, barkStripeMask);

    // Ground ambient occlusion shadow
    const rootOcclusion = smoothstep(0.2, 0.0, normalizedY).mul(0.6);
    finalBarkColor = mix(finalBarkColor, deepBark, rootOcclusion);

    material.colorNode = finalBarkColor;

    return material;
}