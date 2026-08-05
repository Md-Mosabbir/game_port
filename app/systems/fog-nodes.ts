import { mix, rangeFogFactor, vec2, viewportUV } from 'three/tsl';
import { fogUniforms } from '@/app/controls/fogControls';

// Radial screen-space gradient shared by the background and the fog colour.
const colorMix = vec2(viewportUV.xy)
	.sub(fogUniforms.radialCenter)
	.length()
	.smoothstep(fogUniforms.radialStart, fogUniforms.radialEnd);

export const fogNodes = {
	color: mix(fogUniforms.colorA, fogUniforms.colorB, colorMix),
	// 0 = fully visible, 1 = fully fogged
	strength: rangeFogFactor(fogUniforms.near, fogUniforms.far),
};
