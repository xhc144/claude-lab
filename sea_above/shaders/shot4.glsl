// SHOT 4 - "The Other Shore": the night side of the hanging sea; the world folds.
#include "above_render.glsl"

vec3 renderScene(vec3 ro, vec3 rd, vec2 px, out float depth) {
    initRng(px);
    return renderAbove(ro, rd, px, depth);
}
