import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
	abs,
	attribute,
	cos,
	float,
	mix,
	mod,
	positionLocal,
	sin,
	step,
	texture,
	time,
	vec2,
	vec3,
} from 'three/tsl';

// ─────────────────────────────────────────────────────────────────────────────
// createGrassMaterial
//
// Call this AFTER the ping-pong render targets are initialized (e.g. inside
// a useEffect or after first frame) so that trackTexture is a real GPU texture.
//
// uniforms shape:
//   cameraXZ:     UniformNode<THREE.Vector2>
//   cameraRight:  UniformNode<THREE.Vector3>
//   fieldSize:    UniformNode<number>
//   windStrength: UniformNode<number>
//   windFrequency:UniformNode<number>
//   windSpeed:    UniformNode<number>
//   colorBase:    UniformNode<THREE.Color>
//   colorTip:     UniformNode<THREE.Color>
//
// trackTexture: THREE.Texture  ← the LIVE ping-pong render target texture
//                                pass pingTarget.texture directly here
//
// Returns:
//   { material, setTrackTexture }
//   Call setTrackTexture(newTex) every frame after ping-pong swap.
// ─────────────────────────────────────────────────────────────────────────────

export function createGrassMaterial(
	uniforms: any,
	trackTexture: THREE.Texture
): { material: MeshBasicNodeMaterial; trackTexNode: any } {

	// ── Sanity check ────────────────────────────────────────────────────────
	if (!trackTexture || !trackTexture.isTexture) {
		
		throw new Error('createGrassMaterial: trackTexture must be a valid THREE.Texture');
	}

	
	const material = new MeshBasicNodeMaterial({ side: THREE.DoubleSide });

	// ── Vertex Attributes ──────────────────────────────────────────────────
	const aClusterCenter = attribute('aClusterCenter', 'vec3');
	const aBladeOffset   = attribute('aBladeOffset',   'vec3');
	const aTipness       = attribute('aTipness',       'float');
	const aPhase         = attribute('aPhase',         'float');

	// ── Infinite Tiling ────────────────────────────────────────────────────
	// Cluster centers are stored in world space. We wrap them around the
	// camera so the field tiles infinitely without moving the geometry.
	const halfField = uniforms.fieldSize.mul(0.5);

	const wrappedCenterX = mod(
		aClusterCenter.x.sub(uniforms.cameraXZ.x).add(halfField),
		uniforms.fieldSize
	).sub(halfField).add(uniforms.cameraXZ.x);

	const wrappedCenterZ = mod(
		aClusterCenter.z.sub(uniforms.cameraXZ.y).add(halfField),
		uniforms.fieldSize
	).sub(halfField).add(uniforms.cameraXZ.y);

	// bladeWorldPos = absolute world position of this blade vertex
	// (wrapping keeps it camera-relative internally but result is world space)
	const bladeWorldPos = vec3(
		wrappedCenterX.add(aBladeOffset.x),
		float(0),
		wrappedCenterZ.add(aBladeOffset.z)
	);

	// ── Track UV ───────────────────────────────────────────────────────────
	// Map blade world position to [0,1] UV space matching the ping-pong FBO.
	//
	// The FBO camera:
	//   - Positioned at (cameraX, 10, cameraZ) looking straight down
	//   - OrthographicCamera covering [-fieldSize/2, fieldSize/2] in both X and Z
	//   - up = (0, 0, 1) so world Z+ maps to texture V+
	//
	// Therefore:
	//   U = (worldX - cameraX) / fieldSize + 0.5
	//   V = (worldZ - cameraZ) / fieldSize + 0.5
	//
	// Both should be in [0,1] for blades within the camera's view.

	const trueWorldPos = vec3(
  aClusterCenter.x.add(aBladeOffset.x),
  0,
  aClusterCenter.z.add(aBladeOffset.z)
);
	
// const trackU = trueWorldPos.x
//   .sub(uniforms.cameraXZ.x)
//   .div(uniforms.fieldSize)
//   .mul(-1)
//   .add(0.5);

// const trackV = trueWorldPos.z
//   .sub(uniforms.cameraXZ.y)
//   .div(uniforms.fieldSize)
//   .mul(-1)
//   .add(0.5);

  const trackU = wrappedCenterX.add(aBladeOffset.x)
  .sub(uniforms.cameraXZ.x)
  .div(uniforms.fieldSize)
  .add(0.5);  // no mul(-1) — with up=(0,0,1) the axes already match

const trackV = wrappedCenterZ.add(aBladeOffset.z)
  .sub(uniforms.cameraXZ.y)
  .div(uniforms.fieldSize)
  .add(0.5);

const trackUV = vec2(float(1.0).sub(trackU), float(1.0).sub(trackV));

	// ── FBO Texture Lookup ─────────────────────────────────────────────────
	// Sample the ping-pong track texture.
	// R channel = flatten intensity (0=upright, 1=fully flat).
	const trackTexNode = texture(trackTexture, trackUV).clamp(0, 1);



const flattenStrength = trackTexNode.r; // amplify signal

	// flattenScale: 1 = fully upright, 0 = fully flat
	const flattenScale = float(1.0).sub(flattenStrength.smoothstep(0.01, 0.2)); 


	const relX = bladeWorldPos.x.sub(uniforms.carPosition.x);
	const relZ = bladeWorldPos.z.sub(uniforms.carPosition.z);

	const cosYaw = cos(uniforms.carYaw);
	const sinYaw = sin(uniforms.carYaw);

	const localX = cosYaw.mul(relX).add(sinYaw.mul(relZ));
	const localZ = sinYaw.negate().mul(relX).add(cosYaw.mul(relZ));

	const insideCar = float(1.0).sub(
		step(uniforms.carHalfX, abs(localX))
	).mul(
		float(1.0).sub(step(uniforms.carHalfZ, abs(localZ)))
	);

	const finalFlattenScale = flattenScale.mul(float(1.0).sub(insideCar));

  //const flattenScale = float(1.0).sub(flattenStrength);

	// ── Wind ───────────────────────────────────────────────────────────────
	const windWave = sin(
		time.mul(uniforms.windSpeed)
			.add(bladeWorldPos.x.mul(uniforms.windFrequency))
			.add(bladeWorldPos.z.mul(uniforms.windFrequency.mul(1.31)))
			.add(aPhase)
	);

	// Wind only affects tips (aTipness=1), and not flattened blades
	const windBend = windWave
		.mul(uniforms.windStrength)
		.mul(aTipness)
		.mul(finalFlattenScale);

	// ── Final Position ─────────────────────────────────────────────────────
	// 1. Start at blade world position
	// 2. Billboard: offset left/right by cameraRight so blades always face camera
	// 3. Flatten: crush height by flattenScale
	// 4. Wind: bend the tip
	const billboardOffset = uniforms.cameraRight.mul(positionLocal.x);
	const flattenedHeight = positionLocal.y.mul(finalFlattenScale);

	material.positionNode = bladeWorldPos
		.add(billboardOffset)
		.add(vec3(windBend, flattenedHeight, windBend.mul(0.5)));

	// ── Color ──────────────────────────────────────────────────────────────
	material.colorNode = mix(uniforms.colorBase, uniforms.colorTip, aTipness);
	


	// ── DEBUG MODE ─────────────────────────────────────────────────────────
	// Uncomment ONE of these lines to debug visually:
	//
	// Show UV coordinates as color (should be a smooth gradient, green at center)
	//material.colorNode = vec3(trackU, trackV, float(0));
	//
	// Show raw flatten strength as brightness (white = flattened, black = upright)
	 //material.colorNode = vec3(flattenStrength, flattenStrength, flattenStrength);
	//
	// Show flattenScale (inverted — white = upright, black = flattened)
	//material.colorNode = vec3(flattenScale, flattenScale, flattenScale);
	
	// Show amplified track influence (Neon Red = flattened area)
	//material.colorNode = mix(mix(uniforms.colorBase, uniforms.colorTip, aTipness), vec3(1, 0, 0), flattenStrength.mul(10.0).clamp(0, 1));

	
	return { material, trackTexNode };
}