#!/usr/bin/env bash
# contact.sh VIDEO OUT.png [every_seconds] [cols]
set -e
v=$1; out=$2; every=${3:-4}; cols=${4:-4}
n=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$v")
rows=$(python3 -c "import math;print(math.ceil(float('$n')/$every/$cols))")
ffmpeg -v error -y -i "$v" -vf "fps=1/$every,scale=480:-1,drawtext=text='%{pts\:hms}':x=6:y=6:fontsize=16:fontcolor=white:box=1:boxcolor=black@0.5,tile=${cols}x${rows}:padding=4" -frames:v 1 "$out"
echo "$out ($n s)"
