/**
 * AxisDiagnosticHUD
 *
 * A React overlay (pure DOM, no Three.js) that shows the live values of every
 * coordinate system involved in the grass flatten pipeline each frame.
 *
 * Add to InfiniteGrass JSX:
 *
 *   <AxisDiagnosticHUD
 *     diagRef={diagRef}          // ref you pass into useFrame to fill each frame
 *     visible={debugConfig.showAxisDiag}
 *   />
 *
 * In useFrame, fill diagRef.current with:
 *
 *   if (diagRef.current) {
 *     diagRef.current = {
 *       orbitCamXZ:   [state.camera.position.x, state.camera.position.z],
 *       fboCamXZ:     [trackCamera.position.x,  trackCamera.position.z],
 *       carXZ:        [carWorldPos.x, carWorldPos.z],
 *       uniformsCamXZ:[uniforms.cameraXZ.value.x, uniforms.cameraXZ.value.y],
 *       delta:        [
 *         trackCamera.position.x - carWorldPos.x,
 *         trackCamera.position.z - carWorldPos.z,
 *       ],
 *       // UV where the car center would appear in the FBO texture
 *       carUVinFBO: [
 *         (carWorldPos.x - trackCamera.position.x) / GRASS_SETTINGS.FIELD_SIZE + 0.5,
 *         (carWorldPos.z - trackCamera.position.z) / GRASS_SETTINGS.FIELD_SIZE + 0.5,
 *       ],
 *       // UV where the grass shader THINKS the car is
 *       carUVinGrass: [
 *         (carWorldPos.x - uniforms.cameraXZ.value.x) / GRASS_SETTINGS.FIELD_SIZE + 0.5,
 *         (carWorldPos.z - uniforms.cameraXZ.value.y) / GRASS_SETTINGS.FIELD_SIZE + 0.5,
 *       ],
 *     };
 *   }
 */

import { useRef, useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DiagnosticData {
  /** Main 3D orbit camera X/Z */
  orbitCamXZ: [number, number];
  /** FBO top-down camera X/Z (what the FBO is actually centered on) */
  fboCamXZ: [number, number];
  /** Car chassis world X/Z */
  carXZ: [number, number];
  /** uniforms.cameraXZ — what the grass shader uses as its UV origin */
  uniformsCamXZ: [number, number];
  /** fboCamXZ - carXZ: how far off the FBO origin is from the car */
  delta: [number, number];
  /** UV coordinate of the car inside the FBO texture [should be ~0.5, 0.5] */
  carUVinFBO: [number, number];
  /** UV coordinate the grass shader computes for the car [should match carUVinFBO] */
  carUVinGrass: [number, number];
}

interface AxisDiagnosticHUDProps {
  /** A ref whose .current is set to DiagnosticData each frame in useFrame */
  diagRef: React.MutableRefObject<DiagnosticData | null>;
  visible?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toFixed(3).padStart(9, ' ');
}

function fmtPair(a: number, b: number) {
  return `(${fmt(a)}, ${fmt(b)})`;
}

function UVStatus({ uv }: { uv: [number, number] }) {
  const ok = uv[0] > 0.3 && uv[0] < 0.7 && uv[1] > 0.3 && uv[1] < 0.7;
  const color = ok ? '#4eff91' : '#ff4e4e';
  return (
    <span style={{ color, fontWeight: 700 }}>
      {fmtPair(uv[0], uv[1])} {ok ? '✓' : '⚠ OFF-CENTER'}
    </span>
  );
}

function DeltaStatus({ delta }: { delta: [number, number] }) {
  const mag = Math.sqrt(delta[0] ** 2 + delta[1] ** 2);
  const ok = mag < 0.5;
  const color = ok ? '#4eff91' : mag < 5 ? '#ffcc00' : '#ff4e4e';
  return (
    <span style={{ color, fontWeight: 700 }}>
      {fmtPair(delta[0], delta[1])} mag={fmt(mag)} {ok ? '✓' : '← ROOT CAUSE'}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AxisDiagnosticHUD({ diagRef, visible = true }: AxisDiagnosticHUDProps) {
  const [data, setData] = useState<DiagnosticData | null>(null);
  const rafRef = useRef<number>(0);

  // Poll the ref at 10 fps so we're not re-rendering every frame
  useEffect(() => {
    if (!visible) return;
    let running = true;
    let last = 0;

    function poll(now: number) {
      if (!running) return;
      if (now - last > 100) {
        last = now;
        if (diagRef.current) setData({ ...diagRef.current });
      }
      rafRef.current = requestAnimationFrame(poll);
    }

    rafRef.current = requestAnimationFrame(poll);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [diagRef, visible]);

  if (!visible || !data) return null;

  const uvMismatch = [
    data.carUVinFBO[0] - data.carUVinGrass[0],
    data.carUVinFBO[1] - data.carUVinGrass[1],
  ];

  const rows: [string, React.ReactNode, string?][] = [
    [
      'Orbit cam XZ',
      fmtPair(data.orbitCamXZ[0], data.orbitCamXZ[1]),
      '← 3D camera (follows car from behind/above)',
    ],
    [
      'FBO cam XZ',
      fmtPair(data.fboCamXZ[0], data.fboCamXZ[1]),
      '← top-down camera used for ping-pong render',
    ],
    [
      'Car XZ',
      fmtPair(data.carXZ[0], data.carXZ[1]),
      '← chassis body world position',
    ],
    [
      'uniforms.cameraXZ',
      fmtPair(data.uniformsCamXZ[0], data.uniformsCamXZ[1]),
      '← what grass shader uses as UV origin',
    ],
    ['─────────────────', '', ''],
    [
      'FBO origin Δ from car',
      <DeltaStatus key="d" delta={data.delta} />,
      '← should be (0, 0). Any offset = misalignment',
    ],
    ['─────────────────', '', ''],
    [
      'Car UV in FBO tex',
      <UVStatus key="fbo" uv={data.carUVinFBO} />,
      '← where the car is painted in the texture',
    ],
    [
      'Car UV in grass shader',
      <UVStatus key="grass" uv={data.carUVinGrass} />,
      '← where the shader samples for the car pos',
    ],
    [
      'UV mismatch',
      <span
        key="mm"
        style={{
          color:
            Math.abs(uvMismatch[0]) < 0.01 && Math.abs(uvMismatch[1]) < 0.01
              ? '#4eff91'
              : '#ff4e4e',
          fontWeight: 700,
        }}
      >
        {fmtPair(uvMismatch[0], uvMismatch[1])}{' '}
        {Math.abs(uvMismatch[0]) < 0.01 && Math.abs(uvMismatch[1]) < 0.01
          ? '✓ aligned'
          : '← THIS IS YOUR OFFSET'}
      </span>,
      '← (0, 0) = perfect alignment',
    ],
  ];

  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        right: 12,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.88)',
        border: '1px solid #333',
        borderRadius: 6,
        padding: '10px 14px',
        fontFamily: '"Fira Mono", "Cascadia Code", monospace',
        fontSize: 11,
        color: '#ccc',
        lineHeight: 1.7,
        maxWidth: 600,
        backdropFilter: 'blur(4px)',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          color: '#fff',
          fontSize: 12,
          fontWeight: 700,
          marginBottom: 6,
          letterSpacing: 1,
          borderBottom: '1px solid #333',
          paddingBottom: 4,
        }}
      >
        🎯 GRASS FLATTEN AXIS DIAGNOSTIC
      </div>

      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <tbody>
          {rows.map(([label, value, hint], i) =>
            label.startsWith('─') ? (
              <tr key={i}>
                <td
                  colSpan={3}
                  style={{
                    borderTop: '1px solid #333',
                    padding: '2px 0',
                    fontSize: 9,
                    color: '#444',
                  }}
                />
              </tr>
            ) : (
              <tr key={i}>
                <td
                  style={{
                    color: '#888',
                    paddingRight: 12,
                    whiteSpace: 'nowrap',
                    verticalAlign: 'top',
                  }}
                >
                  {label}
                </td>
                <td style={{ whiteSpace: 'pre', fontWeight: 500 }}>{value}</td>
                {hint && (
                  <td
                    style={{
                      color: '#555',
                      paddingLeft: 10,
                      fontSize: 10,
                      whiteSpace: 'nowrap',
                      verticalAlign: 'top',
                    }}
                  >
                    {hint}
                  </td>
                )}
              </tr>
            )
          )}
        </tbody>
      </table>

      <div
        style={{
          marginTop: 8,
          borderTop: '1px solid #333',
          paddingTop: 6,
          fontSize: 10,
          color: '#555',
        }}
      >
        FIX: set trackCamera.position to carXZ, not orbitCam.position
        <br />
        uniforms.cameraXZ must use the same anchor as the FBO camera
      </div>
    </div>
  );
}

// ─── How to wire it up in InfiniteGrass ──────────────────────────────────────
//
// 1. Create the ref at the top of InfiniteGrass:
//
//      const diagRef = useRef<DiagnosticData | null>(null);
//
// 2. At the END of useFrame, after all positions are known:
//
//      const carWorldPos = { x: 0, z: 0 }; // replace with actual car position
//      if (chasisBodyRef?.current) {
//        const t = chasisBodyRef.current.translation();
//        carWorldPos.x = t.x;
//        carWorldPos.z = t.z;
//      }
//
//      diagRef.current = {
//        orbitCamXZ:    [state.camera.position.x, state.camera.position.z],
//        fboCamXZ:      [trackCamera.position.x, trackCamera.position.z],
//        carXZ:         [carWorldPos.x, carWorldPos.z],
//        uniformsCamXZ: [uniforms.cameraXZ.value.x, uniforms.cameraXZ.value.y],
//        delta:         [
//          trackCamera.position.x - carWorldPos.x,
//          trackCamera.position.z - carWorldPos.z,
//        ],
//        carUVinFBO: [
//          (carWorldPos.x - trackCamera.position.x) / GRASS_SETTINGS.FIELD_SIZE + 0.5,
//          (carWorldPos.z - trackCamera.position.z) / GRASS_SETTINGS.FIELD_SIZE + 0.5,
//        ],
//        carUVinGrass: [
//          (carWorldPos.x - uniforms.cameraXZ.value.x) / GRASS_SETTINGS.FIELD_SIZE + 0.5,
//          (carWorldPos.z - uniforms.cameraXZ.value.y) / GRASS_SETTINGS.FIELD_SIZE + 0.5,
//        ],
//      };
//
// 3. In JSX:
//
//      <AxisDiagnosticHUD diagRef={diagRef} visible={debugConfig.showAxisDiag} />
//
// ─── What the numbers tell you ───────────────────────────────────────────────
//
// IF "FBO origin Δ from car" ≠ (0,0):
//   → trackCamera is following the orbit camera, not the car.
//   → FIX: trackCamera.position.set(carWorldPos.x, 10, carWorldPos.z)
//          uniforms.cameraXZ.value.set(carWorldPos.x, carWorldPos.z)
//
// IF "UV mismatch" ≠ (0,0) but delta IS (0,0):
//   → FBO cam and grass shader use different origins despite the same anchor.
//   → FIX: make sure uniforms.cameraXZ is set from the same variable as
//          trackCamera.position.
//
// IF both UVs are ~0.5 but flattening is still wrong:
//   → Axis flip. Check if carUVinFBO X/Z correspond to the right texture axes.
//   → FIX: swap trackU/trackV in grass-material.ts, or flip the FBO camera up.