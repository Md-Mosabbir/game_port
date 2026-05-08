import * as THREE from 'three';
import { 
	vec3, 
	vec4, 
	varying, 
	Fn, 
	uv, 
	float, 
	vec2, 
	texture, 
	sign, 
	positionGeometry,
} from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { extend } from '@react-three/fiber';

extend({ MeshBasicNodeMaterial });

export const TRACK_HISTORY_SIZE = 128;

export class WheelTracker {
	public data: Float32Array;
	public texture: THREE.DataTexture;
	private count: number = 0;

	constructor() {
		// Each texel stores [X, Z, Y, Active]
		this.data = new Float32Array(TRACK_HISTORY_SIZE * 4);
		
		this.texture = new THREE.DataTexture(
			this.data,
			TRACK_HISTORY_SIZE,
			1,
			THREE.RGBAFormat,
			THREE.FloatType
		);
		
		this.texture.minFilter = THREE.NearestFilter;
		this.texture.magFilter = THREE.NearestFilter;
		this.texture.needsUpdate = true;
	}

	/**
	 * Adds a new coordinate by shifting the existing data.
	 * This ensures the texture is always ordered from Oldest to Newest.
	 */
	update(x: number, y: number, z: number, active: boolean = true) {
		// Shift all existing data one step to the "left" (oldest direction)
		this.data.copyWithin(0, 4);

		// Add the new point at the very end (newest)
		const lastIndex = (TRACK_HISTORY_SIZE - 1) * 4;
		this.data[lastIndex + 0] = x;            // Red is X
		this.data[lastIndex + 1] = z;            // Green is Z
		this.data[lastIndex + 2] = y;            // Blue is Y
		this.data[lastIndex + 3] = active ? 1 : 0; 
		
		this.texture.needsUpdate = true;
		this.count++;
	}

	debugLog() {
		if (this.count === 0) return;
		const lastIndex = (TRACK_HISTORY_SIZE - 1) * 4;
		console.log(
			`%c WheelTrack %c X: ${this.data[lastIndex+0].toFixed(2)} | Z: ${this.data[lastIndex+1].toFixed(2)}`,
			'background: #222; color: #bada55; padding: 2px 5px;', 'color: #fff;'
		);
	}

	createTrailMaterial() {
		const mat = new MeshBasicNodeMaterial({ 
			side: THREE.DoubleSide, 
			transparent: true,
			color: 0x00ffff 
		});
		
		const trackData = varying(vec4());
		
		mat.positionNode = Fn(() => {
			const fragmentSize = float(1).div(TRACK_HISTORY_SIZE);
			// Simple UV mapping (Oldest at 0, Newest at 1)
			const ratio = uv().x.sub(fragmentSize.mul(0.5));
			const trackUV = vec2(ratio, 0.5);
			
			trackData.assign(texture(this.texture, trackUV));
			
			const sideSign = sign(positionGeometry.y).mul(-1);
			
			return vec3(
				trackData.x.add(sideSign.mul(0.25)), // X
				trackData.z.add(0.15),               // Y (Height)
				trackData.y.sub(sideSign.mul(0.25))  // Z (Depth)
			);
		})();

		mat.opacityNode = trackData.w.mul(0.5);

		return mat;
	}

	get activeSamples() {
		return Math.min(this.count, TRACK_HISTORY_SIZE);
	}
}
