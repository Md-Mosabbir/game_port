import { normalWorld, dot, positionWorld, float, shadow, mix } from 'three/tsl';

export const stylizedDiffusion = (
    baseColorNode: any,
    lightDirectionNode: any,
    wrapLowNode: any,
    wrapHighNode: any
) => {
    const nDotL = dot(normalWorld, lightDirectionNode);
    const wrappedDiffuse = nDotL.remapClamp(-1.0, 1.0, wrapLowNode, wrapHighNode);
    return baseColorNode.mul(wrappedDiffuse);
};

// Simulates light bouncing off the floor.
// - dot(normal, down) picks faces that look toward the ground.
// - remapClamp on the facing gives soft/hard edge control (like diffusion).
// - distToFloor attenuated by maxDistance: beyond that distance = 0 bounce.
// - bounceColor is added, scaled by the combined intensity.
export const stylizedBounce = (
    baseColorNode: any,
    bounceColorNode: any,      // uniform Color — warm ground-reflected tint
    bounceStrengthNode: any,   // uniform float — overall multiplier 0..1+
    bounceLowNode: any,        // uniform float — where bounce starts  (like diffusionLow)
    bounceHighNode: any,       // uniform float — where bounce maxes out (like diffusionHigh)
    bounceMaxDistNode: any,    // uniform float — max distance from floor for bounce
    floorYNode: any            // uniform float — world-space Y of the floor plane
) => {
    // (1 - normalWorld.y): top=0, sides=1, bottom=clamped to 1
    const rawFacing = float(1.0).sub(normalWorld.y).clamp(0.0, 1.0);

    // Soft/hard edge control — same idea as diffusion's remapClamp
    const downFacing = rawFacing.remapClamp(bounceLowNode, bounceHighNode, 0.0, 1.0);

    // Distance from current vertex to floor, normalised 0..1 by maxDist
    const distToFloor = positionWorld.y.sub(floorYNode).max(0.0);
    const distAtten = distToFloor.div(bounceMaxDistNode.max(0.001)).oneMinus().clamp(0.0, 1.0);

    const bounceIntensity = downFacing.mul(distAtten).mul(bounceStrengthNode);

    return baseColorNode.add(bounceColorNode.mul(bounceIntensity));
};


// --- ADDED STYLIZED SHADOW FUNCTION ---
export const stylizedShadow = (
    baseColorNode: any,
    shadowColorNode: any,
    lightNode: any
) => {
    // shadow() extracts the raw shadow map factor (0.0 inside shadow, 1.0 in light)
    const shadowMask = shadow(lightNode);

    // FIX: Instead of shadowMask.mix(), use the global mix() function
    // Syntax: mix( valueWhenZero, valueWhenOne, interpolationFactor )
    return mix(shadowColorNode, baseColorNode, shadowMask);
};


