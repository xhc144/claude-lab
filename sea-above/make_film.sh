#!/bin/bash
# Build the whole film from source: frames, soundtrack, edit + encode.
set -e
cd "$(dirname "$0")"
./render_all.sh                                   # HDR frames (resumable)
python3 -m audio.score out/score.wav              # music + sound design
python3 edit.py --audio out/score.wav --out out/the_sea_above_master.mp4   # ~29 Mb/s master
# two-pass ~9 Mb/s encode that fits under GitHub's 100 MB file limit
ffmpeg -y -i out/the_sea_above_master.mp4 -c:v libx264 -preset slow -tune grain -b:v 9200k -pass 1 -an -f null /dev/null
ffmpeg -y -i out/the_sea_above_master.mp4 -c:v libx264 -preset slow -tune grain -b:v 9200k -maxrate 16M -bufsize 24M \
       -pass 2 -pix_fmt yuv420p -c:a aac -b:a 224k -movflags +faststart out/the_sea_above.mp4
rm -f ffmpeg2pass-0.log ffmpeg2pass-0.log.mbtree
