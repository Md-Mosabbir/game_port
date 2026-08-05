import { Sparkles } from '@react-three/drei';
import { Fog } from './fog';

export const Sky = () => {
  return (
    <>
      <Fog />

      {/* Floating particles to catch the 'light' */}
      <Sparkles
        count={200}
        scale={100}
        size={2}
        speed={0.4}
        color="#ffccaa"
        opacity={0.5}
      />
    </>
  );
};
