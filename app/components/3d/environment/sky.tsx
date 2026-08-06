import { Fog } from './fog';
import { Motes } from './motes';

export const Sky = () => {
  return (
    <>
      <Fog />

      {/* Pollen drifting in the light */}
      <Motes />

    </>
  );
};
