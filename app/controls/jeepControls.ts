import { addFolder } from './pane';

export const JEEP_CONFIG = {
    // Wheel offsets (physics placement)
    frontBack: 0.85,
    upDown: -0.5,
    width: 0.63,
    
    // Vehicle Physics
    accelerateForce: 4,
    brakeForce: 0.1,
    steerAngle: Math.PI / 8,

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
    physicsFolder.addBinding(JEEP_CONFIG, 'accelerateForce', { min: 0, max: 20 }).on('change', notify);
    physicsFolder.addBinding(JEEP_CONFIG, 'brakeForce', { min: 0, max: 1.0, step: 0.01 }).on('change', notify);
    physicsFolder.addBinding(JEEP_CONFIG, 'steerAngle', { min: 0, max: Math.PI / 4 }).on('change', notify);

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
