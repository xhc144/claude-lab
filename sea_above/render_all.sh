#!/bin/bash
# Render every shot's HDR frames at full resolution (resumable: existing frames are skipped).
cd "$(dirname "$0")"
for shot in s1_drop s3_cross s4_above s5_return; do
    python3 render.py frames "$shot" --w 1920 --spp 4
done
echo ALL_DONE
