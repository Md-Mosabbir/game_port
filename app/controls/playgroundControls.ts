import { addFolder } from './pane';
import * as THREE from 'three';
import { uniform } from 'three/tsl';

export const PLAYGROUND_CONFIG = {
    lightDirection: { x: 5, y: 10, z: 5 },
    diffusionLow: 0.25,
    diffusionHigh: 1.0,
    bounceColor: '#88cc44',
    bounceStrength: 0.4,
    bounceLow: 0.0,
    bounceHigh: 1.0,
    bounceMaxDist: 5.0,
    floorY: 0.0,
};

export const diffusionUniforms = {
    lightDirection: uniform(new THREE.Vector3(5, 10, 5).normalize()),
    diffusionLow: uniform(0.25),
    diffusionHigh: uniform(1.0),
    bounceColor: uniform(new THREE.Color(0x88cc44)),
    bounceStrength: uniform(0.4),
    bounceLow: uniform(0.0),
    bounceHigh: uniform(1.0),
    bounceMaxDist: uniform(5.0),
    floorY: uniform(0.0),
};

let initialized = false;

export const setupPlaygroundControls = () => {
    if (initialized) return;

    const diffFolder = addFolder('Stylized Diffusion');
    if (diffFolder) {
        diffFolder.addBinding(PLAYGROUND_CONFIG, 'lightDirection').on('change', (ev) => {
            const { x, y, z } = ev.value;
            diffusionUniforms.lightDirection.value.set(x, y, z).normalize();
        });
        diffFolder.addBinding(PLAYGROUND_CONFIG, 'diffusionLow', { min: -1, max: 1, step: 0.01 }).on('change', (ev) => {
            diffusionUniforms.diffusionLow.value = ev.value;
        });
        diffFolder.addBinding(PLAYGROUND_CONFIG, 'diffusionHigh', { min: 0, max: 2, step: 0.01 }).on('change', (ev) => {
            diffusionUniforms.diffusionHigh.value = ev.value;
        });
    }

    const bounceFolder = addFolder('Bounce Light');
    if (bounceFolder) {
        bounceFolder.addBinding(PLAYGROUND_CONFIG, 'bounceColor').on('change', (ev) => {
            diffusionUniforms.bounceColor.value.set(ev.value);
        });
        bounceFolder.addBinding(PLAYGROUND_CONFIG, 'bounceStrength', { min: 0, max: 2, step: 0.01 }).on('change', (ev) => {
            diffusionUniforms.bounceStrength.value = ev.value;
        });
        bounceFolder.addBinding(PLAYGROUND_CONFIG, 'bounceLow', { min: 0, max: 1, step: 0.01, label: 'Edge Low' }).on('change', (ev) => {
            diffusionUniforms.bounceLow.value = ev.value;
        });
        bounceFolder.addBinding(PLAYGROUND_CONFIG, 'bounceHigh', { min: 0, max: 2, step: 0.01, label: 'Edge High' }).on('change', (ev) => {
            diffusionUniforms.bounceHigh.value = ev.value;
        });
        bounceFolder.addBinding(PLAYGROUND_CONFIG, 'bounceMaxDist', { min: 0.5, max: 20, step: 0.1, label: 'Max Distance' }).on('change', (ev) => {
            diffusionUniforms.bounceMaxDist.value = ev.value;
        });
        bounceFolder.addBinding(PLAYGROUND_CONFIG, 'floorY', { min: -5, max: 5, step: 0.1, label: 'Floor Y' }).on('change', (ev) => {
            diffusionUniforms.floorY.value = ev.value;
        });
    }

    initialized = true;
};

