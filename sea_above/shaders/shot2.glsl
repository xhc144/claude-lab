// SHOT 2 - "The Sea Above": rising with the drops, the sky turns out to be an ocean.
#include "below_render.glsl"

vec3 renderScene(vec3 ro, vec3 rd, vec2 px, out float depth) {
    initRng(px);
    return renderBelow(ro, rd, px, depth);
}
