import { addFolder } from './pane';

export const ENV_CONFIG = {
    physicsDebug: false,
    orbitControls: false,
};

let initialized = false;
type Listener = () => void;
const listeners: Set<Listener> = new Set();

export const subscribeToEnvConfig = (listener: Listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

const notify = () => {
    listeners.forEach(l => l());
};

export const setupEnvironmentControls = () => {
    if (initialized) return;
    const folder = addFolder('Environment');
    if (!folder) return;

    folder.addBinding(ENV_CONFIG, 'physicsDebug').on('change', notify);
    folder.addBinding(ENV_CONFIG, 'orbitControls').on('change', notify);

    initialized = true;
};
