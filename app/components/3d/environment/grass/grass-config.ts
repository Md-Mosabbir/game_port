import * as THREE from 'three';

export const GRASS_SETTINGS = {
    FIELD_SIZE: 90,
    HISTORY_SIZE: 128,
    WHEEL_OFFSETS: [
        new THREE.Vector3(-0.93, -0.5, -0.55),
        new THREE.Vector3(-0.93, -0.5, 0.55),
        new THREE.Vector3(0.93, -0.5, -0.55),
        new THREE.Vector3(0.93, -0.5, 0.55),
    ],
    FBO_RES: 512,
    TRACK_RADIUS_SQ: 0.95 * 0.95
};