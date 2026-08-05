import { addFolder } from './pane';

export const JEEP_CONFIG = {
    // Wheel offsets (physics placement)
    frontBack: 0.85,
    upDown: -0.5,
    width: 0.63,
    
    // Vehicle Physics
    accelerateForce: 15,
    brakeForce: 0.6,
    steerAngle: Math.PI / 8,

    // Boost (Shift). Multiplies engine force while there is charge left; the
    // charge drains while held and refills when released.
    boostMultiplier: 2.6,
    boostDuration: 2.5,   // seconds of boost from full
    boostRecharge: 1.6,   // seconds of charge gained per second released
    boostRechargeDelay: 0.6, // seconds after releasing before it refills

    // Grip — how hard the tyres hold before letting go.
    frictionSlip: 5.0,
    sideFrictionStiffness: 8.0,

    // Steering falls off with speed so full lock at speed cannot spin the car.
    steerFalloffSpeed: 20, // m/s at which the reduction is fully applied
    steerAtTopSpeed: 0.45, // fraction of steerAngle available at that speed

    // Mass properties. The chassis mass comes from the collider, NOT from a
    // `mass` prop on RigidBody — that one is ignored by @react-three/rapier.
    // Default matches the old implicit value (density 1 x box volume) so
    // acceleration feel is unchanged.
    mass: 5.35,
    centerOfMassY: -0.55, // Below the box centre: the main anti-roll fix
    rollResistance: 2.0,  // Multiplier on the roll axis inertia

    // Damping calms roll oscillation and yaw spin-out.
    linearDamping: 0.05,
    angularDamping: 0.5,

    // Scale
    scaleJeep: 1,
    scaleWheel: 1,

    // Nudge visual models
    chassisOffsetX: 0,
    chassisOffsetY: 0.018,
    chassisOffsetZ: 0,

    wheelOffsetX: -0.008,
    wheelOffsetY: 0.018,
    wheelOffsetZ: 0,

    // Debug
    showDebugHelpers: false,
};

let initialized = false;
type Listener = () => void;
const listeners: Set<Listener> = new Set();

export const subscribeToJeepConfig = (listener: Listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

const notify = () => {
    listeners.forEach(l => l());
};

export const setupJeepControls = () => {
    if (initialized) return;
    const folder = addFolder('Jeep');
    if (!folder) return;
    
    const wheelFolder = folder.addFolder({ title: 'Wheel Offsets (Physics)' });
    wheelFolder.addBinding(JEEP_CONFIG, 'frontBack', { min: 0.5, max: 2.5, step: 0.01 }).on('change', notify);
    wheelFolder.addBinding(JEEP_CONFIG, 'upDown', { min: -1.5, max: 1.5, step: 0.01 }).on('change', notify);
    wheelFolder.addBinding(JEEP_CONFIG, 'width', { min: 0.2, max: 1.5, step: 0.01 }).on('change', notify);

    const physicsFolder = folder.addFolder({ title: 'Vehicle Physics' });
    physicsFolder.addBinding(JEEP_CONFIG, 'accelerateForce', { min: 0, max: 30 }).on('change', notify);
    physicsFolder.addBinding(JEEP_CONFIG, 'brakeForce', { min: 0, max: 2.0, step: 0.01 }).on('change', notify);
    physicsFolder.addBinding(JEEP_CONFIG, 'steerAngle', { min: 0, max: Math.PI / 4 }).on('change', notify);

    const boostFolder = folder.addFolder({ title: 'Boost (Shift)' });
    boostFolder.addBinding(JEEP_CONFIG, 'boostMultiplier', { min: 1, max: 6, step: 0.05, label: 'multiplier' }).on('change', notify);
    boostFolder.addBinding(JEEP_CONFIG, 'boostDuration', { min: 0.2, max: 15, step: 0.1, label: 'duration (s)' }).on('change', notify);
    boostFolder.addBinding(JEEP_CONFIG, 'boostRecharge', { min: 0.05, max: 5, step: 0.05, label: 'recharge/s' }).on('change', notify);
    boostFolder.addBinding(JEEP_CONFIG, 'boostRechargeDelay', { min: 0, max: 5, step: 0.05, label: 'recharge delay' }).on('change', notify);

    const gripFolder = folder.addFolder({ title: 'Grip & Stability' });
    gripFolder.addBinding(JEEP_CONFIG, 'frictionSlip', { min: 0.5, max: 15, step: 0.1 }).on('change', notify);
    gripFolder.addBinding(JEEP_CONFIG, 'sideFrictionStiffness', { min: 0.5, max: 20, step: 0.1 }).on('change', notify);
    gripFolder.addBinding(JEEP_CONFIG, 'steerFalloffSpeed', { min: 1, max: 60, step: 1, label: 'falloff speed' }).on('change', notify);
    gripFolder.addBinding(JEEP_CONFIG, 'steerAtTopSpeed', { min: 0.05, max: 1, step: 0.01, label: 'steer at speed' }).on('change', notify);
    gripFolder.addBinding(JEEP_CONFIG, 'mass', { min: 0.5, max: 50, step: 0.05 }).on('change', notify);
    gripFolder.addBinding(JEEP_CONFIG, 'centerOfMassY', { min: -1.5, max: 1.5, step: 0.01, label: 'centre of mass Y' }).on('change', notify);
    gripFolder.addBinding(JEEP_CONFIG, 'rollResistance', { min: 0.5, max: 8, step: 0.05 }).on('change', notify);
    gripFolder.addBinding(JEEP_CONFIG, 'linearDamping', { min: 0, max: 2, step: 0.01 }).on('change', notify);
    gripFolder.addBinding(JEEP_CONFIG, 'angularDamping', { min: 0, max: 4, step: 0.01 }).on('change', notify);

    const scaleFolder = folder.addFolder({ title: 'Scale' });
    scaleFolder.addBinding(JEEP_CONFIG, 'scaleJeep', { min: 0.1, max: 5, step: 0.01 }).on('change', notify);
    scaleFolder.addBinding(JEEP_CONFIG, 'scaleWheel', { min: 0.1, max: 5, step: 0.01 }).on('change', notify);
    
    const nudgeFolder = folder.addFolder({ title: 'Nudge Models (Visual)' });
    nudgeFolder.addBinding(JEEP_CONFIG, 'chassisOffsetX', { min: -1, max: 1, step: 0.001 }).on('change', notify);
    nudgeFolder.addBinding(JEEP_CONFIG, 'chassisOffsetY', { min: -1, max: 1, step: 0.001 }).on('change', notify);
    nudgeFolder.addBinding(JEEP_CONFIG, 'chassisOffsetZ', { min: -1, max: 1, step: 0.001 }).on('change', notify);
    nudgeFolder.addBinding(JEEP_CONFIG, 'wheelOffsetX', { min: -1, max: 1, step: 0.001 }).on('change', notify);
    nudgeFolder.addBinding(JEEP_CONFIG, 'wheelOffsetY', { min: -1, max: 1, step: 0.001 }).on('change', notify);
    nudgeFolder.addBinding(JEEP_CONFIG, 'wheelOffsetZ', { min: -1, max: 1, step: 0.001 }).on('change', notify);

    const debugFolder = folder.addFolder({ title: 'Debug' });
    debugFolder.addBinding(JEEP_CONFIG, 'showDebugHelpers').on('change', notify);
    
    initialized = true;
};
