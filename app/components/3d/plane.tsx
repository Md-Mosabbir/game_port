import { useFrame, useThree } from '@react-three/fiber'
import { RapierRigidBody } from '@react-three/rapier'
import { RefObject, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import {
	color, mix, Fn, hash, If, instancedArray, instanceIndex,
	positionLocal, sin, cos, time, uniform, vec3, vec4, mat3
} from 'three/tsl'
import { MeshLambertNodeMaterial } from 'three/webgpu'

export const LeafSystem = ({ jeepRef }: { jeepRef: RefObject<RapierRigidBody> }) => {
	const count = Math.pow(2, 14)
	const size = 100

	const jeepPosUniform = useMemo(() => uniform(new THREE.Vector3()), [])

	const { positionBuffer, velocityBuffer, rotationBuffer, initCompute, updateCompute } = useMemo(() => {
		const posBuffer = instancedArray(count, 'vec3')
		const velBuffer = instancedArray(count, 'vec3')
		const rotBuffer = instancedArray(count, 'float') // rotation angle per leaf

		const init = Fn(() => {
			const pos = posBuffer.element(instanceIndex)
			const vel = velBuffer.element(instanceIndex)
			const rot = rotBuffer.element(instanceIndex)

			const noiseX = hash(instanceIndex).sub(0.5).mul(size)
			const noiseZ = hash(instanceIndex.add(1000)).sub(0.5).mul(size)
			pos.assign(vec3(noiseX, 0, noiseZ))
			vel.assign(vec3(0, 0, 0))
			// random initial rotation 0 - 2PI
			rot.assign(hash(instanceIndex.add(3000)).mul(Math.PI * 2))
		})

		const update = Fn(() => {
			const pos = posBuffer.element(instanceIndex)
			const vel = velBuffer.element(instanceIndex)
			const rot = rotBuffer.element(instanceIndex)

			// Drag
			vel.mulAssign(0.95)
			// Gravity
			vel.y.subAssign(0.01)

			// Jeep proximity burst
			const diff = pos.sub(jeepPosUniform)
			const dist = diff.length()
			If(dist.lessThan(2), () => {
				vel.x.addAssign(diff.x.mul(0.05))
				vel.z.addAssign(diff.z.mul(0.05))
				vel.y.addAssign(0.08)
			})


			// Integrate
			pos.addAssign(vel)

			// Floor clamp
			If(pos.y.lessThan(0), () => {
				pos.y.assign(0)
				vel.y.assign(0)
			})
		})

		return {
			positionBuffer: posBuffer,
			velocityBuffer: velBuffer,
			rotationBuffer: rotBuffer,
			initCompute: init().compute(count),
			updateCompute: update().compute(count)
		}
	}, [count, size, jeepPosUniform])

	const leafGeo = useMemo(() => {
		const geo = new THREE.PlaneGeometry(0.5, 0.5)
		const position = geo.attributes.position.array as Float32Array
		position[0] += 0.15
		position[3] += 0.15
		position[6] -= 0.15
		position[9] -= 0.15
		geo.rotateX(-Math.PI * 0.5)
		return geo
	}, [])

	const material = useMemo(() => {
		const mat = new MeshLambertNodeMaterial({ side: THREE.DoubleSide, depthWrite: false })

		// Autumn colors: yellow → orange → red → brown
		const autumnColors = [
			color('#f5c518'), // yellow
			color('#e8820c'), // orange
			color('#c0392b'), // red
			color('#8B4513'), // brown
		]

		// Pick color per instance using hash
		const t = hash(instanceIndex.add(5000))
		const col = mix(
			mix(autumnColors[0], autumnColors[1], hash(instanceIndex.add(5001))),
			mix(autumnColors[2], autumnColors[3], hash(instanceIndex.add(5002))),
			t
		)
		mat.colorNode = col

		// Random scale per instance (0.5x to 1.5x)
		const scale = hash(instanceIndex.add(6000)).mul(1.0).add(0.5)

		// Rotation from buffer
		const angle = rotationBuffer.element(instanceIndex)
		const cosA = cos(angle)
		const sinA = sin(angle)

		// Build rotation matrix around Y axis
		const rotatedPos = vec3(
			positionLocal.x.mul(cosA).add(positionLocal.z.mul(sinA)),
			positionLocal.y,
			positionLocal.x.mul(sinA.negate()).add(positionLocal.z.mul(cosA))
		)

		// Scale + translate to instance position
		mat.positionNode = rotatedPos.mul(scale).add(positionBuffer.element(instanceIndex))

		return mat
	}, [positionBuffer, rotationBuffer])

	const { gl } = useThree()

	useEffect(() => {
		gl.computeAsync(initCompute)
	}, [initCompute])

	useFrame(() => {
		if (jeepRef.current) {
			const pos = jeepRef.current.translation()
			jeepPosUniform.value.set(pos.x, pos.y, pos.z)
		}
		gl.compute(updateCompute)
	})

	return (
		<instancedMesh args={[leafGeo, material, count]} frustumCulled={false} />
	)
}
