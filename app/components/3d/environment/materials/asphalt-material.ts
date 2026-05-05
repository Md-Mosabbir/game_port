import { 
	color, uv, vec2, mix, float, clamp, 
	uniform, vec3, sin, floor, fract, dot, smoothstep, abs, length, step, pow
} from 'three/tsl';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import * as THREE from 'three';

/**
 * Premium Procedural Cobblestone Material using TSL
 */
export const createAsphaltMaterial = (config: any) => {
	const material = new MeshStandardNodeMaterial();

	// Uniforms for real-time tweaking
	const cobbleColor = uniform(new THREE.Color(config.cobbleColor));
	const mortarColor = uniform(new THREE.Color(config.mortarColor));
	const stoneScale = uniform(config.stoneScale);
	const roadRoughness = uniform(config.roughness);

	const vUv = uv();
	
	// Physical scaling to prevent stretching
	const worldPos = vec2(
		vUv.x.mul(config.roadWidth).mul(3.14159 / 2), 
		vUv.y.mul(config.chunkLength)
	);

	const st = worldPos.mul(stoneScale.div(10));
	
	// 1. Create the Cobblestone Grid (Running Bond)
	const offset = step(0.5, fract(st.y.mul(0.5))).mul(0.5);
	const gridUv = fract(vec2(st.x.add(offset), st.y));
	const gridId = floor(vec2(st.x.add(offset), st.y));
	
	// 2. Stone Shapes (Rounded Rectangles)
	// Distance from center of the cell
	const dist = abs(gridUv.sub(0.5)).mul(2.0);
	const stoneMask = smoothstep(0.95, 0.85, dist.x).mul(smoothstep(0.95, 0.85, dist.y));
	
	// 3. Procedural Variation (Color per stone)
	const hash = (p: any) => fract(sin(dot(p, vec2(12.9898, 78.233))).mul(43758.5453));
	const stoneIdNoise = hash(gridId);
	const finalStoneColor = mix(cobbleColor, cobbleColor.mul(0.7), stoneIdNoise);
	
	// 4. Combine Stones and Mortar
	const finalColor = mix(mortarColor, finalStoneColor, stoneMask);
	material.colorNode = finalColor;

	// 5. Procedural Normal Mapping (Beveled Stones)
	// We create a "dome" effect for each stone
	const dome = pow(clamp(float(1.0).sub(length(gridUv.sub(0.5)).mul(1.5))), 0.5);
	const grit = hash(worldPos.mul(20.0)).mul(0.1); // Surface grittiness
	const normalBump = dome.add(grit).mul(stoneMask);
	
	material.normalNode = vec3(normalBump.mul(2).sub(1), normalBump.mul(2).sub(1), 1.0).normalize();

	// 6. Roughness & Specular
	// Stones are shinier than mortar
	material.roughnessNode = mix(float(1.0), roadRoughness, stoneMask);
	material.metalnessNode = float(0.0);

	// Update logic
	const update = (newConfig: any) => {
		cobbleColor.value.set(newConfig.cobbleColor);
		mortarColor.value.set(newConfig.mortarColor);
		stoneScale.value = newConfig.stoneScale;
		roadRoughness.value = newConfig.roughness;
	};

	return { material, update };
};
