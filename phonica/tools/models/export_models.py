"""Export the acoustic models Phonica uses to ONNX (fp32 + dynamic INT8).

Runs in CI (Hugging Face is reachable there). Every exported graph is checked
against the PyTorch forward pass before it is published.

usage: python export_models.py <hf_model_id> <short_name> <out_dir> [--no-fp32]
"""
import hashlib
import json
import os
import re
import sys

import numpy as np
import torch
from transformers import AutoConfig, AutoFeatureExtractor, AutoModelForCTC


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    model_id, short, out = sys.argv[1], sys.argv[2], sys.argv[3]
    keep_fp32 = "--no-fp32" not in sys.argv
    os.makedirs(out, exist_ok=True)

    config = AutoConfig.from_pretrained(model_id)
    # charsiu's frame classifiers share the Wav2Vec2ForCTC graph (backbone + lm_head)
    if any("FrameClassification" in a for a in (config.architectures or [])):
        config.architectures = ["Wav2Vec2ForCTC"]
    model, info = AutoModelForCTC.from_pretrained(
        model_id, config=config, output_loading_info=True, attn_implementation="eager"
    )
    missing = [k for k in info["missing_keys"] if "masked_spec_embed" not in k]
    if missing:
        raise SystemExit(f"missing weights for {model_id}: {missing}")
    model.eval()

    try:
        fe = AutoFeatureExtractor.from_pretrained(model_id)
        fe_cfg = {"sampling_rate": fe.sampling_rate, "do_normalize": bool(fe.do_normalize)}
    except Exception as e:  # noqa: BLE001
        print("no feature extractor config, using defaults:", e)
        fe_cfg = {"sampling_rate": 16000, "do_normalize": True}

    def real(v):
        s = str(v)
        return not re.fullmatch(r"LABEL_\d+", s) and not s.lstrip("-").isdigit()

    id2label = getattr(config, "id2label", None) or {}
    if id2label and any(real(v) for v in id2label.values()):
        labels = {int(k): v for k, v in id2label.items()}
    else:
        from transformers import AutoTokenizer

        tok = AutoTokenizer.from_pretrained(model_id)
        labels = {i: t for t, i in tok.get_vocab().items()}
    vocab = [labels.get(i, f"<{i}>") for i in range(config.vocab_size)]

    torch.manual_seed(0)
    t = np.arange(16000 * 3) / 16000.0
    # a harmonic sweep plus noise: exercises the feature encoder more than white noise
    wave = 0.3 * np.sin(2 * np.pi * (120 + 40 * t) * t) + 0.05 * np.random.RandomState(0).randn(t.size)
    wave = ((wave - wave.mean()) / np.sqrt(wave.var() + 1e-7)).astype(np.float32)
    x = torch.from_numpy(wave)[None]
    with torch.no_grad():
        ref = model(x).logits.numpy()

    fp32 = os.path.join(out, f"{short}.fp32.onnx")
    torch.onnx.export(
        model,
        (x,),
        fp32,
        input_names=["input_values"],
        output_names=["logits"],
        dynamic_axes={"input_values": {0: "batch", 1: "samples"}, "logits": {0: "batch", 1: "frames"}},
        opset_version=17,
        do_constant_folding=True,
        dynamo=False,
    )
    # fold any external data back into one file (all our models are < 2 GB)
    import onnx

    m = onnx.load(fp32, load_external_data=True)
    for f in os.listdir(out):
        if f.endswith(".data") or f.startswith("onnx__") or f.endswith(".weight") or f.endswith(".bias"):
            os.remove(os.path.join(out, f))
    onnx.save_model(m, fp32, save_as_external_data=False)
    del m

    import onnxruntime as ort
    from onnxruntime.quantization import QuantType, quantize_dynamic

    def run(path):
        s = ort.InferenceSession(path, providers=["CPUExecutionProvider"])
        return s.run(["logits"], {"input_values": wave[None]})[0]

    o32 = run(fp32)
    diff32 = float(np.max(np.abs(o32 - ref)))
    print(f"{short}: fp32 max|torch-onnx| = {diff32:.2e}, shape {o32.shape}")
    if diff32 > 1e-2:
        raise SystemExit("fp32 export does not match torch")

    int8 = os.path.join(out, f"{short}.int8.onnx")
    quantize_dynamic(fp32, int8, weight_type=QuantType.QInt8, op_types_to_quantize=["MatMul", "Gemm"])
    o8 = run(int8)
    agree = float(np.mean(o8.argmax(-1) == ref.argmax(-1)))
    print(f"{short}: int8 argmax agreement with torch = {agree:.3f}")

    meta = {
        "model_id": model_id,
        "revision": getattr(config, "_commit_hash", None),
        "vocab": vocab,
        "feature_extractor": fe_cfg,
        "frames_for_3s": int(o32.shape[1]),
        "fp32_max_abs_diff": diff32,
        "int8_argmax_agreement": agree,
        "files": {},
    }
    if not keep_fp32:
        os.remove(fp32)
    for f in sorted(os.listdir(out)):
        if f.startswith(short) and f.endswith(".onnx"):
            p = os.path.join(out, f)
            meta["files"][f] = {"bytes": os.path.getsize(p), "sha256": sha256(p)}
    with open(os.path.join(out, f"{short}.json"), "w", encoding="utf-8") as fh:
        json.dump(meta, fh, ensure_ascii=False, indent=1)
    print(json.dumps({k: v for k, v in meta.items() if k != "vocab"}, indent=1))


if __name__ == "__main__":
    main()
