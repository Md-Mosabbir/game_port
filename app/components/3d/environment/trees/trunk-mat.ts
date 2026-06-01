import * as THREE from 'three';
import { attribute, mod, positionLocal, vec3, uniform, sin, time, smoothstep } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';

export function createTrunkMaterial(uniforms: any, config: any) {
    const material = new MeshBasicNodeMaterial();

    material.colorNode = vec3(0.24, 0.17, 0.12);

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

    // Height mask matches the 5-unit unified cylinder height
    const heightMask = smoothstep(0.0, 5.0, positionLocal.y);

    // Identical wind calculation matching canopy for unified structural bending
    const t = time.mul(uSpeed);
    const baseWave = sin(t.add(wrappedX.mul(0.4)).add(wrappedZ.mul(0.3)));
    const microWave1 = sin(t.mul(2.5).add(wrappedX.mul(2.1)));
    const microWave2 = sin(t.mul(4.0).add(wrappedZ.mul(3.7)));

    const windAccumulator = baseWave.mul(0.6).add(microWave1.mul(0.25)).add(microWave2.mul(0.15));
    const directionalGust = windAccumulator.add(1.0).mul(0.5);

    const swayX = directionalGust.mul(uIntensity).mul(2.0).mul(heightMask);
    const swayZ = directionalGust.mul(uIntensity).mul(0.4).mul(heightMask);

    material.positionNode = vec3(
        positionLocal.x.add(swayX).add(wrappedX),
        positionLocal.y,
        positionLocal.z.add(swayZ).add(wrappedZ)
    );

    return material;
}
