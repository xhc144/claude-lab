// SHOT 3 - "Crossing": up a column of rising water, through the underside of
// the sea, and up through the water from day into night, past a whale.
#include "below_render.glsl"
#include "underwater.glsl"

vec3 renderScene(vec3 ro, vec3 rd, vec2 px, out float depth) {
    initRng(px);
    if (sdWater(ro) < 0.0) return renderUnderwater(ro, rd, px, depth);
    return renderBelow(ro, rd, px, depth);
}
