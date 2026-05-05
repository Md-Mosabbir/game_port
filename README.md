# Infinite Jeep World (Learning Project)

This project is a real-time Three.js driving sandbox focused on **learning modern 3D scene architecture** with performance constraints in mind.  
You drive a jeep through an infinite world with clustered grass, a procedural winding road, dreamy anime-inspired lighting, and tweakable runtime controls.

## Tech Stack

- [Three.js](https://threejs.org/) - 3D engine and core math/geometry classes
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/getting-started/introduction) - React renderer for Three.js
- [@react-three/drei](https://github.com/pmndrs/drei) - helper components (like Sky)
- [React Three Rapier](https://pmndrs.github.io/react-three-rapier/) - physics integration
- [Tweakpane](https://tweakpane.github.io/docs/) - runtime control panel for tuning values
- [Three.js TSL](https://threejs.org/docs/#api/en/materials/nodes/NodeMaterial) - node-based material logic for grass wind/deformation

## Project Systems

### Grass System

**What it does**
- Generates an infinite grass field around the camera.
- Uses cluster-based distribution (dense patches + bare spaces) instead of uniform randomness.
- Applies wind movement and jeep tire flattening.
- Avoids spawning close to road center.

**Key concepts**
- BufferGeometry attributes for per-blade data
- Infinite wrapping around camera position
- Wind animation in material graph

**Docs**
- [BufferGeometry](https://threejs.org/docs/#api/en/core/BufferGeometry)
- [InstancedMesh (instancing concept)](https://threejs.org/docs/#api/en/objects/InstancedMesh)

### Road System

**What it does**
- Builds an infinite winding road in chunks.
- Keeps 3+ chunks ahead and recycles behind.
- Adds optional center lane marking.

**Key concepts**
- [CatmullRomCurve3](https://threejs.org/docs/#api/en/extras/curves/CatmullRomCurve3) for smooth path interpolation
- [TubeGeometry](https://threejs.org/docs/#api/en/geometries/TubeGeometry) for extruding geometry along curve
- Chunk pool reuse and geometry disposal for memory safety

### Camera System

**What it does**
- Uses an isometric toy-car angle (`-10, 8, 10` style offset).
- Smoothly follows jeep with lerp to avoid snap movement.

**Key concepts**
- [Vector3.lerp](https://threejs.org/docs/#api/en/math/Vector3.lerp)

### Lighting + Atmosphere

**What it does**
- Dreamy key light (warm pastel) + cool low-intensity fill light.
- Fog palette tied to sky for cohesive anime-like mood.
- Subtle bloom and gamma correction pass.

**Key concepts**
- [DirectionalLight](https://threejs.org/docs/#api/en/lights/DirectionalLight)
- [Fog](https://threejs.org/docs/#api/en/scenes/Fog)
- [UnrealBloomPass](https://threejs.org/docs/pages/UnrealBloomPass.html)
- [ShaderPass](https://threejs.org/docs/pages/ShaderPass.html)
- [GammaCorrectionShader](https://threejs.org/docs/pages/module-GammaCorrectionShader.html)

### Controls System (`src/controls`)

**What it does**
- Centralizes runtime tweak values in one place.
- One file per subsystem:
  - `grassControls.ts`
  - `roadControls.ts`
  - `cameraControls.ts`
  - `lightingControls.ts`
- `src/controls/index.ts` initializes all panes.

**Key concepts**
- shared config objects used across scene modules
- collapsed folders to keep UI compact

## Performance Notes (Low-end PC Friendly)

- No new geometries/materials are created inside frame loops.
- Road uses chunk pool strategy and disposes old geometries.
- Grass deformation CPU pass is throttled (not every frame).
- Postprocessing is optional (currently disabled).

## How To Tweak

1. Run the app.
2. Open the Tweakpane control panel.
3. Expand one section at a time (`Grass`, `Road`, `Camera`, `Lighting`).
4. Start with these beginner changes:
   - `Grass -> waveStrength`
   - `Road -> curveStrength`
   - `Camera -> lerpSpeed`
   - `Lighting -> keyLightColor / bloomStrength`

## Learning Order (Recommended)

1. `app/components/3d/experience.tsx` (scene wiring)
2. `app/components/3d/environment/world-atmosphere.tsx`
3. `app/components/3d/environment/world-lighting.tsx`
4. `app/components/3d/environment/infinite-road.tsx`
5. `app/components/3d/environment/grass.tsx`
6. `app/components/3d/jeep/vehicle.tsx`
