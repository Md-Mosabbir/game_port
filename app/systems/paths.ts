import { mx_noise_float } from 'three/tsl';
import { terrainVisualUniforms } from '@/app/controls/terrainControls';

// TSL node graphs are not meaningfully typeable across these helpers.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TSLNode = any;

// ─────────────────────────────────────────────────────────────────────────────
// Worn paths
//
// A path is the *level set* of a low-frequency noise field — the places where
// the noise crosses zero. That naturally gives long, winding, branching trails
// that never cross themselves awkwardly, which is much harder to get by drawing
// curves. A second, finer noise breaks the ribbon up so it fades in and out
// like a real worn track rather than a painted stripe.
//
// Shared between the ground colour and the vegetation mask: the same mask that
// paints the dirt is the one that stops grass growing on it. A path with grass
// still standing on it doesn't read as a path.
// ─────────────────────────────────────────────────────────────────────────────

export const pathMaskNode = (xz: TSLNode, normalY: TSLNode): TSLNode => {
	const field = mx_noise_float(xz.mul(terrainVisualUniforms.pathScale));

	// Distance from the zero crossing → the ribbon.
	const ribbon = field.abs().smoothstep(terrainVisualUniforms.pathWidth, 0);

	// Break it up, so the trail wears through in places.
	const wear = mx_noise_float(xz.mul(0.06)).mul(0.5).add(0.5);
	const broken = ribbon.mul(wear.smoothstep(0.2, 0.55));

	// Trails follow gentle ground — they do not run up cliff faces.
	const gentle = normalY.smoothstep(0.78, 0.94);

	return broken.mul(gentle).clamp(0, 1);
};
