import * as THREE from 'three';
import { RefObject, useMemo, useRef, useState } from 'react';
import { useEffect } from 'react';
import { RapierRigidBody } from '@react-three/rapier';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
	attribute,
	float,
	Loop,
	max,
	mix,
	mod,
	positionLocal,
	sin,
	textureLoad,
	time,
	uniform,
	uvec2,
	vec3,
	vec4,
	uint,
} from 'three/tsl';
import { extend, useFrame } from '@react-three/fiber';
import { GRASS_CONFIG, subscribeToGrassConfig } from '@/app/controls/grassControls';
import { WheelTracker } from './wheel-track';


extend({ MeshBasicNodeMaterial });

type InfiniteGrassProps = {
	fieldSize?: number;
	chasisBodyRef?: RefObject<RapierRigidBody>;
};

const _wheelOffsets = [
	new THREE.Vector3(-0.93, -0.5, -0.55),
	new THREE.Vector3(-0.93, -0.5, 0.55),
	new THREE.Vector3(0.93, -0.5, -0.55),
	new THREE.Vector3(0.93, -0.5, 0.55),
];

const _tmpQuat = new THREE.Quaternion();
const _tmpWheel = new THREE.Vector3();

const HISTORY_SIZE = 128;

export function InfiniteGrass({ fieldSize = 90, chasisBodyRef }: InfiniteGrassProps) {
	const trackers = useMemo(() => [
		new WheelTracker(),
		new WheelTracker(),
		new WheelTracker(),
		new WheelTracker(),
	], []);

	// ── FBO Tracking System Initialization ────────────────────────────────────
	// This scene is private and only used to render the "mask" texture
	const trackScene = useMemo(() => new THREE.Scene(), []);
	const trackCamera = useMemo(() => {
		const cam = new THREE.OrthographicCamera(-fieldSize / 2, fieldSize / 2, fieldSize / 2, -fieldSize / 2, 0.1, 20);
		cam.position.set(0, 10, 0);
		cam.lookAt(0, 0, 0);
		return cam;
	}, [fieldSize]);

	const renderTarget = useMemo(() => new THREE.WebGLRenderTarget(512, 512, {
		minFilter: THREE.LinearFilter,
		magFilter: THREE.LinearFilter,
	}), []);

	// Brushes: 4 "Ribbon Brushes" that follow the 4 wheel histories in the trackScene
	const brushMaterials = useMemo(() => {
		return trackers.map(tracker => tracker.createTrailMaterial());
	}, [trackers]);

	useEffect(() => {
		// Add 4 ribbons to the trackScene for the GPU to "see"
		trackers.forEach((tracker, i) => {
			const geo = new THREE.PlaneGeometry(1, 1, 128, 1);
			geo.translate(0.5, 0, 0);
			const mat = brushMaterials[i];
			// Make them pure white for the mask
			mat.color.set(0xffffff);
			mat.opacity = 1.0;
			const mesh = new THREE.Mesh(geo, mat);
			mesh.frustumCulled = false;
			trackScene.add(mesh);
		});
	}, [trackScene, trackers, brushMaterials]);

	const frameRef = useRef(0);

	const [config, setConfig] = useState(() => ({ ...GRASS_CONFIG }));
	useEffect(() => {
		return subscribeToGrassConfig(() => {
			setConfig({ ...GRASS_CONFIG });
		});
	}, []);

	const count = config.clusterCount * config.bladesPerCluster;
	
	// For the grass flattening shader, we'll use the first tracker for now
	// We will combine them once we move to the GPU FBO system.
	const historyTexture = trackers[0].texture;

	// ── Uniforms ──────────────────────────────────────────────────────────────
	const uniforms = useMemo(
		() => ({
			cameraXZ: uniform(new THREE.Vector2()),
			cameraRight: uniform(new THREE.Vector3(1, 0, 0)),
			fieldSize: uniform(fieldSize),
			windStrength: uniform(config.waveStrength),
			windFrequency: uniform(0.24),
			windSpeed: uniform(config.waveSpeed),
			colorBase: uniform(new THREE.Color(config.colorBase)),
			colorTip: uniform(new THREE.Color(config.colorTip)),
			// GPU flatten uniforms
			historyTex: uniform(historyTexture),
			historySamples: uniform(0), // updated each frame with real cursor count
			trackRadiusSq: uniform(0.95 * 0.95),
		}),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[fieldSize, config.waveStrength, config.waveSpeed, config.colorBase, config.colorTip]
	);

	// ── Geometry ──────────────────────────────────────────────────────────────
	const grassData = useMemo(() => {
		const geo = new THREE.BufferGeometry();
		const positions = new Float32Array(count * 9);
		const clusterCenters = new Float32Array(count * 9);
		const bladeOffsets = new Float32Array(count * 9);
		const tipness = new Float32Array(count * 3);
		const phases = new Float32Array(count * 3);

		for (let i = 0; i < count; i++) {
			const i9 = i * 9;
			const i3 = i * 3;

			const r0 = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
			const r1 = ((Math.sin((i + 101) * 78.233) * 43758.5453) % 1 + 1) % 1;
			const r2 = ((Math.sin((i + 503) * 39.425) * 43758.5453) % 1 + 1) % 1;
			const r3 = ((Math.sin((i + 997) * 15.891) * 43758.5453) % 1 + 1) % 1;

			const clusterIndex = i % config.clusterCount;
			const cR0 = ((Math.sin((clusterIndex + 73) * 21.97) * 43758.5453) % 1 + 1) % 1;
			const cR1 = ((Math.sin((clusterIndex + 311) * 56.11) * 43758.5453) % 1 + 1) % 1;
			const centerX = (cR0 - 0.5) * fieldSize;
			const centerZ = (cR1 - 0.5) * fieldSize;

			const angle = r0 * Math.PI * 2;
			const radius = Math.sqrt(r1) * config.clusterSpread;
			let absoluteX = centerX + Math.cos(angle) * radius;
			let absoluteZ = centerZ + Math.sin(angle) * radius;
			absoluteX = THREE.MathUtils.clamp(absoluteX, -fieldSize * 0.5, fieldSize * 0.5);
			absoluteZ = THREE.MathUtils.clamp(absoluteZ, -fieldSize * 0.5, fieldSize * 0.5);


			const finalOffsetX = absoluteX - centerX;
			const finalOffsetZ = absoluteZ - centerZ;

			const width = 0.05 + r2 * 0.08;
			const patchNoise = Math.sin(absoluteX * 0.18) * Math.cos(absoluteZ * 0.14) * 0.5 + 0.5;
			const height = 0.8 + r3 * 0.9 + patchNoise * 0.8;

			positions[i9 + 0] = -width; positions[i9 + 1] = 0; positions[i9 + 2] = 0;
			positions[i9 + 3] =  width; positions[i9 + 4] = 0; positions[i9 + 5] = 0;
			positions[i9 + 6] =  0;     positions[i9 + 7] = height; positions[i9 + 8] = 0;

			for (let j = 0; j < 9; j += 3) {
				clusterCenters[i9 + j + 0] = centerX;
				clusterCenters[i9 + j + 1] = 0;
				clusterCenters[i9 + j + 2] = centerZ;

				bladeOffsets[i9 + j + 0] = finalOffsetX;
				bladeOffsets[i9 + j + 1] = 0;
				bladeOffsets[i9 + j + 2] = finalOffsetZ;
			}

			tipness[i3 + 0] = 0; tipness[i3 + 1] = 0; tipness[i3 + 2] = 1;

			const phase = r2 * Math.PI * 2.0;
			phases[i3 + 0] = phase; phases[i3 + 1] = phase; phases[i3 + 2] = phase;
		}

		geo.setAttribute('position',       new THREE.BufferAttribute(positions,      3));
		geo.setAttribute('aClusterCenter', new THREE.BufferAttribute(clusterCenters, 3));
		geo.setAttribute('aBladeOffset',   new THREE.BufferAttribute(bladeOffsets,   3));
		geo.setAttribute('aTipness',       new THREE.BufferAttribute(tipness,        1));
		geo.setAttribute('aPhase',         new THREE.BufferAttribute(phases,         1));

		return { geometry: geo };
	}, [count, fieldSize, config.clusterCount, config.clusterSpread]);

	// ── TSL Material ──────────────────────────────────────────────────────────
	const grassMaterial = useMemo(() => {
		const material = new MeshBasicNodeMaterial({ side: THREE.DoubleSide });

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const aClusterCenter = attribute('aClusterCenter', 'vec3') as any;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const aBladeOffset = attribute('aBladeOffset', 'vec3') as any;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const aTipness = attribute('aTipness', 'float') as any;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const aPhase = attribute('aPhase', 'float') as any;

		// ── Infinite tiling: wrap cluster centers around the camera ───────────
		const halfField = uniforms.fieldSize.mul(0.5);
		const wrappedCenterX = mod(
			aClusterCenter.x.sub(uniforms.cameraXZ.x).add(halfField),
			uniforms.fieldSize
		).sub(halfField).add(uniforms.cameraXZ.x);
		const wrappedCenterZ = mod(
			aClusterCenter.z.sub(uniforms.cameraXZ.y).add(halfField),
			uniforms.fieldSize
		).sub(halfField).add(uniforms.cameraXZ.y);

		const bladeWorldPos = vec3(
			wrappedCenterX.add(aBladeOffset.x),
			float(0),
			wrappedCenterZ.add(aBladeOffset.z)
		);

		// ── GPU flatten: sample history texture, accumulate max influence ─────
		// Each texel in historyTex: (worldX, worldZ, 0, active).
		// We loop over historySamples texels and compute exp(-d²/r²) per blade.
		// This replaces the entire CPU flatten loop — runs fully in parallel.
		const flattenAcc = float(0).toVar('flattenAcc');

		Loop(uniforms.historySamples, ({ i }) => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const texel = textureLoad(uniforms.historyTex, uvec2(i, 0)) as any as ReturnType<typeof vec4>;
			const active = texel.w; // 1.0 = valid stamp, 0.0 = empty slot
			const dx = bladeWorldPos.x.sub(texel.x);
			const dz = bladeWorldPos.z.sub(texel.y);
			const d2 = dx.mul(dx).add(dz.mul(dz));
			const influence = active.mul(
				// exp approximation: clamp(1 - d²/r², 0, 1)² — cheaper than true exp, GPU-friendly
				float(1.0).sub(d2.div(uniforms.trackRadiusSq)).clamp(0, 1).pow(2)
			);
			flattenAcc.assign(max(flattenAcc, influence));
		});

		const flattenScale = float(1.0).sub(flattenAcc).max(float(0.0));

		// ── Billboard + wind ──────────────────────────────────────────────────
		const billboardOffset = uniforms.cameraRight.mul(positionLocal.x);
		const flattenedHeight = positionLocal.y.mul(flattenScale);

		const windTime = time.mul(uniforms.windSpeed);
		const windWave = sin(
			windTime
				.add(bladeWorldPos.x.mul(uniforms.windFrequency))
				.add(bladeWorldPos.z.mul(uniforms.windFrequency.mul(1.31)))
				.add(aPhase)
		);
		const windBend = windWave
			.mul(uniforms.windStrength)
			.mul(aTipness)
			.mul(flattenScale);

		material.positionNode = bladeWorldPos
			.add(billboardOffset)
			.add(vec3(windBend, flattenedHeight, windBend.mul(0.5)));

		material.colorNode = mix(uniforms.colorBase, uniforms.colorTip, aTipness);

		return material;
	}, [uniforms]);

	// ── Per-frame: write wheel stamps into CPU array, upload texture ──────────
	// CPU work is now O(4 wheels) per frame instead of O(count × HISTORY_SIZE).
	useFrame((state) => {
		// Update camera uniforms
		uniforms.cameraXZ.value.set(state.camera.position.x, state.camera.position.z);
		state.camera.getWorldDirection(_tmpWheel);
		_tmpWheel.crossVectors(state.camera.up, _tmpWheel).normalize();
		uniforms.cameraRight.value.copy(_tmpWheel);

		if (!chasisBodyRef?.current) return;

		const body = chasisBodyRef.current;
		const translation = body.translation();
		const rotation = body.rotation();
		_tmpQuat.set(rotation.x, rotation.y, rotation.z, rotation.w);

		// Update trackers (CPU history)
		_wheelOffsets.forEach((offset, i) => {
			_tmpWheel.copy(offset).applyQuaternion(_tmpQuat);
			const worldX = translation.x + _tmpWheel.x;
			const worldZ = translation.z + _tmpWheel.z;
			const worldY = translation.y + _tmpWheel.y;
			trackers[i].update(worldX, worldY, worldZ, true);
		});

		// ── Render Full History to FBO ──────────────────────────────────────────
		const gl = state.gl;
		const currentRenderTarget = gl.getRenderTarget();
		
		// Synchronize the Track Camera with the car
		trackCamera.position.set(state.camera.position.x, 10, state.camera.position.z);
		trackCamera.lookAt(state.camera.position.x, 0, state.camera.position.z);

		// Clear target with black
		gl.setRenderTarget(renderTarget);
		gl.clear(); 
		
		// Render all 4 history ribbons into the target
		gl.render(trackScene, trackCamera);
		
		// Reset to main screen
		gl.setRenderTarget(currentRenderTarget);

		// Update uniforms for the grass flattening (using the GPU track map!)
		uniforms.historyTex.value = renderTarget.texture;
		uniforms.historySamples.value = trackers[0].activeSamples;

		// Debug log every 60 frames
		if (state.clock.elapsedTime * 60 % 60 < 1) {
			trackers[0].debugLog();
		}

		// No more frameRef throttle needed — GPU handles it every frame for free
	});

	return (
		<>
			<mesh geometry={grassData.geometry} material={grassMaterial} frustumCulled={false} />
			{trackers.map((tracker, i) => (
				<WheelTrail key={i} tracker={tracker} />
			))}
			
			{/* Debug HUD: Shows the RenderTarget texture in the corner */}
			<DebugHUD texture={renderTarget.texture} />
		</>
	);
}

/**
 * Small HUD element to visualize what the GPU is seeing in the RenderTarget.
 */
function DebugHUD({ texture }: { texture: THREE.Texture }) {
	return (
		<mesh position={[10, 10, -20]} rotation={[0, 0, 0]}>
			<planeGeometry args={[5, 5]} />
			<meshBasicMaterial map={texture} />
		</mesh>
	);
}

/**
 * Visual debug component that creates a ribbon trail using 
 * the exact geometry and TSL logic from the sample.
 */
function WheelTrail({ tracker }: { tracker: WheelTracker }) {
	const geometry = useMemo(() => {
		// Plane width 1, height 1, with 128 segments along width
		const geo = new THREE.PlaneGeometry(1, 1, 128, 1);
		// Translate by 0.5 on X so the left edge is at the origin
		geo.translate(0.5, 0, 0);
		return geo;
	}, []);

	// Use the material logic we moved to the WheelTracker class
	const material = useMemo(() => tracker.createTrailMaterial(), [tracker]);

	return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}

