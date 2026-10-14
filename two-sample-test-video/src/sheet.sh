#!/bin/bash
# 抽帧拼图：sheet.sh 视频 输出.png 时间1 时间2 ...（最多 9 个，3×3）
v=$1; out=$2; shift 2
tmp=$(mktemp -d); i=0
for t in "$@"; do ffmpeg -loglevel error -ss $t -i "$v" -frames:v 1 -vf "scale=640:-1,drawtext=text='$t':x=8:y=8:fontsize=22:fontcolor=red" $tmp/f$(printf %02d $i).png; i=$((i+1)); done
ffmpeg -loglevel error -y -pattern_type glob -i "$tmp/f*.png" -vf "tile=3x3:padding=4:color=white" -frames:v 1 "$out"; rm -rf $tmp
