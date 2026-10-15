#!/usr/bin/env bash
# 下载离线中文语音模型（sherpa-onnx 发布的 Matcha 标贝女声 + Vocos 声码器），约 130 MB。
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build/models && cd build/models
base=https://github.com/k2-fsa/sherpa-onnx/releases/download
[ -d matcha-icefall-zh-baker ] || { curl -sSL -O "$base/tts-models/matcha-icefall-zh-baker.tar.bz2"; tar xjf matcha-icefall-zh-baker.tar.bz2; rm matcha-icefall-zh-baker.tar.bz2; }
[ -f vocos-22khz-univ.onnx ] || curl -sSL -O "$base/vocoder-models/vocos-22khz-univ.onnx"
echo "models ready: $(pwd)"
