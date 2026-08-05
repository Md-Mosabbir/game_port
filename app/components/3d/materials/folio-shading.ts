import * as THREE from 'three';
import { Fn, If, float, frontFacing, max, mix, normalWorld, positionWorld, vec3, vec4 } from 'three/tsl';
import { shadingUniforms } from '@/app/controls/shadingControls';
import { fogNodes } from '@/app/systems/fog-nodes';

// ─────────────────────────────────────────────────────────────────────────────
// applyFolioShading
//
// Port of folio-2025's `MeshDefaultMaterial` output pipeline. Instead of a new
// material class it patches an existing node material, so every material in
// this project opts in with a single call after building its `colorNode`.
//
// The pipeline, in order:
//   1. Re-orient the normal on double sided geometry.
//   2. Light bounce   — faces looking down, close to the ground, pick up the
//                       bounce colour.
//   3. Light          — flat multiply by the (day cycle driven) light colour.
//   4. Diffusion      — "core shadow": normal · light direction, smoothstepped
//                       between two edges, so the terminator is a hard stylised
//                       band instead of a Lambert ramp.
//   5. Drop shadow    — the shadow map value is caught out of the regular
//                       lighting pipeline and merged with the core shadow.
//   6. Shadow colour  — shadowed areas are tinted rather than darkened.
//   7. Fog            — applied by hand, because a custom `outputNode` bypasses
//                       the renderer's own `scene.fogNode` pass.
//
// Note: since the output is fully replaced, the material's PBR/Lambert result
// is discarded — the shading below is the whole lighting model.
// ─────────────────────────────────────────────────────────────────────────────

type NodeMaterialLike = {
	side?: THREE.Side;
	outputNode: unknown;
	receivedShadowNode: unknown;
};

// TSL node graphs are not meaningfully typeable across these helpers.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TSLNode = any;

export type FolioShadingOptions = {
	// The material's own albedo node (what you would assign to colorNode).
	colorNode: TSLNode;
	normalNode?: TSLNode;
	alphaNode?: TSLNode;
	// Extra shadowing (0..1) merged with the core and drop shadows.
	shadowNode?: TSLNode;
	hasCoreShadows?: boolean;
	hasDropShadows?: boolean;
	hasLightBounce?: boolean;
	hasFog?: boolean;
};

export const applyFolioShading = (material: NodeMaterialLike, options: FolioShadingOptions) => {
	const {
		colorNode,
		normalNode = normalWorld,
		alphaNode = float(1),
		shadowNode = float(0),
		hasCoreShadows = true,
		hasDropShadows = true,
		hasLightBounce = true,
		hasFog = true,
	} = options;

	// Shadow catcher: pull the shadow map value out as a float and neutralise it
	// in the regular pipeline, so it can be applied as a colour tint below.
	const catchedShadow = float(1).toVar();

	if (hasDropShadows) {
		material.receivedShadowNode = Fn(([shadow]: TSLNode) => {
			catchedShadow.mulAssign(shadow.r);
			return float(1);
		});
	}

	material.outputNode = Fn(() => {
		// vec3() coercion: colorNode may be a vec4 (a texture sample, say).
		const baseColor = vec3(colorNode).toVar();
		const outputColor = vec3(colorNode).toVar();

		// Normal orientation
		const reorientedNormal = vec3(normalNode).toVar();
		if (material.side === THREE.DoubleSide || material.side === THREE.BackSide) {
			If(frontFacing.not(), () => {
				reorientedNormal.mulAssign(-1);
			});
		}

		// Light bounce
		if (hasLightBounce) {
			const bounceOrientation = reorientedNormal
				.dot(vec3(0, -1, 0))
				.smoothstep(shadingUniforms.lightBounceEdgeLow, shadingUniforms.lightBounceEdgeHigh);
			const bounceDistance = shadingUniforms.lightBounceDistance
				.sub(max(0, positionWorld.y))
				.div(shadingUniforms.lightBounceDistance)
				.max(0)
				.pow(2);
			outputColor.assign(
				mix(
					outputColor,
					shadingUniforms.bounceColor,
					bounceOrientation.mul(bounceDistance).mul(shadingUniforms.lightBounceMultiplier)
				)
			);
		}

		// Light
		outputColor.mulAssign(shadingUniforms.lightColor.mul(shadingUniforms.lightIntensity));

		// Core shadow (diffusion)
		let coreShadowMix: TSLNode = float(0);
		if (hasCoreShadows) {
			coreShadowMix = reorientedNormal
				.dot(shadingUniforms.lightDirection)
				.smoothstep(shadingUniforms.coreShadowEdgeHigh, shadingUniforms.coreShadowEdgeLow);
		}

		// Cast shadow
		let dropShadowMix: TSLNode = float(0);
		if (hasDropShadows) {
			dropShadowMix = catchedShadow.oneMinus();
		}

		// Combined shadows
		if (hasCoreShadows || hasDropShadows) {
			const combinedShadowMix = max(coreShadowMix, dropShadowMix, shadowNode).clamp(0, 1);
			const shadowColor = baseColor.rgb.mul(shadingUniforms.shadowColor).rgb;
			outputColor.assign(mix(outputColor, shadowColor, combinedShadowMix));
		}

		// Fog
		if (hasFog) {
			outputColor.assign(fogNodes.strength.mix(outputColor, fogNodes.color));
		}

		return vec4(outputColor, alphaNode);
	})();
};
