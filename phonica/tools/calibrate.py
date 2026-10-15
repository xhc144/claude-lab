"""Fit Phonica's score regressors on speechocean762 (train split) and report
Pearson correlation with the human ratings on the held-out test split.

usage:
  calibrate.py phone <train.json> <test.json> <out-scoring.json>
  calibrate.py word  <train.json> <test.json> <scoring.json>     (adds the word model)
  calibrate.py sent  <train.json> <test.json> <scoring.json> <model-name>
"""
import json
import sys

import numpy as np
from scipy.stats import pearsonr
from sklearn.linear_model import Ridge
from sklearn.model_selection import GroupKFold
from sklearn.neural_network import MLPRegressor
from sklearn.preprocessing import StandardScaler


def to_json(scaler, mlp, features, lo, hi):
    layers = []
    acts = [mlp.activation] * (len(mlp.coefs_) - 1) + ["identity"]
    for W, b, act in zip(mlp.coefs_, mlp.intercepts_, acts):
        layers.append({"W": np.round(W.T, 6).tolist(), "b": np.round(b, 6).tolist(), "act": act})
    return {
        "type": "mlp",
        "features": features,
        "mean": np.round(scaler.mean_, 6).tolist(),
        "scale": np.round(scaler.scale_, 6).tolist(),
        "layers": layers,
        "min": lo,
        "max": hi,
    }


def ridge_as_mlp(scaler, ridge, features, lo, hi):
    return {
        "type": "mlp",
        "features": features,
        "mean": np.round(scaler.mean_, 6).tolist(),
        "scale": np.round(scaler.scale_, 6).tolist(),
        "layers": [{"W": [np.round(ridge.coef_, 6).tolist()], "b": [round(float(ridge.intercept_), 6)], "act": "identity"}],
        "min": lo,
        "max": hi,
    }


def stretch(pred_tr, ytr):
    """Affine map that matches the mean/std of training predictions to the labels.
    Regression shrinks toward the mean; this restores the human score range
    without changing the ranking (Pearson correlation is invariant)."""
    a = float(np.std(ytr) / max(1e-6, np.std(pred_tr)))
    b = float(np.mean(ytr) - a * np.mean(pred_tr))
    return [round(a, 6), round(b, 6)]


def fit(Xtr, ytr, Xte, yte, lo, hi, hidden=(32,), alpha=1e-3, seeds=(0, 1, 2)):
    sc = StandardScaler().fit(Xtr)
    A, B = sc.transform(Xtr), sc.transform(Xte)
    best = None
    for seed in seeds:
        m = MLPRegressor(hidden_layer_sizes=hidden, activation="relu", alpha=alpha, max_iter=400,
                         early_stopping=True, validation_fraction=0.1, random_state=seed, learning_rate_init=1e-3)
        m.fit(A, ytr)
        # model selection on a slice of the training data only (test stays untouched)
        r = pearsonr(np.clip(m.predict(A), lo, hi), ytr)[0]
        if best is None or r > best[0]:
            best = (r, m)
    m = best[1]
    pte = np.clip(m.predict(B), lo, hi)
    rd = Ridge(alpha=1.0).fit(A, ytr)
    pr = np.clip(rd.predict(B), lo, hi)
    return sc, m, rd, pearsonr(pte, yte)[0], pearsonr(pr, yte)[0], float(np.mean((pte - yte) ** 2))


def cv_choice(X, y, groups, lo, hi, hidden=(16,), alpha=1e-2):
    """Choose ridge vs MLP by speaker-grouped 5-fold CV on the training data only."""
    pm, pr = np.zeros(len(y)), np.zeros(len(y))
    for a, b in GroupKFold(n_splits=5).split(X, y, groups):
        sc = StandardScaler().fit(X[a])
        m = MLPRegressor(hidden_layer_sizes=hidden, activation="relu", alpha=alpha, max_iter=400,
                         early_stopping=True, validation_fraction=0.1, random_state=0, learning_rate_init=1e-3)
        m.fit(sc.transform(X[a]), y[a])
        pm[b] = np.clip(m.predict(sc.transform(X[b])), lo, hi)
        pr[b] = np.clip(Ridge(alpha=1.0).fit(sc.transform(X[a]), y[a]).predict(sc.transform(X[b])), lo, hi)
    return pearsonr(pm, y)[0], pearsonr(pr, y)[0]


def main():
    mode = sys.argv[1]
    tr = json.load(open(sys.argv[2]))
    te = json.load(open(sys.argv[3]))
    out = sys.argv[4]
    if mode == "phone":
        Xtr, ytr = np.array(tr["X"]), np.array(tr["Y"])
        Xte, yte = np.array(te["X"]), np.array(te["Y"])
        # baseline: the raw GOP (log posterior ratio) alone
        print(f"baseline PCC(lpr, human) test = {pearsonr(Xte[:, 1], yte)[0]:.3f}")
        sc, m, rd, r_mlp, r_ridge, mse = fit(Xtr, ytr, Xte, yte, 0, 2, hidden=(48,))
        print(f"phone  MLP PCC={r_mlp:.3f} MSE={mse:.3f} | ridge PCC={r_ridge:.3f}")
        res = {"phone": to_json(sc, m, tr.get("features", []), 0, 2), "metrics": {"phone_pcc": round(r_mlp, 4), "phone_mse": round(mse, 4), "phone_pcc_ridge": round(r_ridge, 4), "phone_pcc_raw_gop": round(float(pearsonr(Xte[:, 1], yte)[0]), 4)}}
        json.dump(res, open(out, "w"))
    elif mode == "word":
        res = json.load(open(out))
        Xtr, ytr = np.array(tr["WX"]), np.array(tr["WY"], dtype=float)
        Xte, yte = np.array(te["WX"]), np.array(te["WY"], dtype=float)
        sc, m, rd, r_mlp, r_ridge, mse = fit(Xtr, ytr, Xte, yte, 0, 10, hidden=(16,))
        print(f"word   MLP PCC={r_mlp:.3f} MSE={mse:.3f} | ridge PCC={r_ridge:.3f}")
        res["word"] = to_json(sc, m, [], 0, 10)
        res["word"]["affine"] = stretch(m.predict(sc.transform(Xtr)), ytr)
        res["metrics"]["word_pcc"] = round(r_mlp, 4)
        if "WF" in te:
            # as shipped: words with a reported learner substitution are capped at 7.9
            a, b = res["word"]["affine"]
            p = np.clip(a * m.predict(sc.transform(Xte)) + b, 0, 10)
            f = np.array(te["WF"], dtype=bool)
            p[f] = np.minimum(p[f], 7.9)
            res["metrics"]["word_pcc_model"] = round(r_mlp, 4)
            res["metrics"]["word_pcc"] = round(float(pearsonr(p, yte)[0]), 4)
            print(f"word   with substitution cap ({f.sum()} words): PCC={res['metrics']['word_pcc']:.3f}")
        json.dump(res, open(out, "w"))
    elif mode == "sent":
        res = json.load(open(out))
        Xtr, Ytr = np.array(tr["SX"]), np.array(tr["SY"], dtype=float)
        Xte, Yte = np.array(te["SX"]), np.array(te["SY"], dtype=float)
        res["sentence"] = {}
        # speechocean762 utterance ids start with the 5-digit speaker id
        groups = np.array([str(i)[:5] for i in tr["ids"]])
        for k, name in enumerate(["accuracy", "fluency", "prosody", "completeness", "total"]):
            sc, m, rd, r_mlp, r_ridge, mse = fit(Xtr, Ytr[:, k], Xte, Yte[:, k], 0, 10, hidden=(16,), alpha=1e-2)
            cv_mlp, cv_ridge = cv_choice(Xtr, Ytr[:, k], groups, 0, 10)
            use_ridge = cv_ridge > cv_mlp
            print(f"{name:12s} train-CV MLP={cv_mlp:.3f} ridge={cv_ridge:.3f} -> {'ridge' if use_ridge else 'mlp'} | test MLP PCC={r_mlp:.3f} ridge PCC={r_ridge:.3f}")
            res["sentence"][name] = ridge_as_mlp(sc, rd, [], 0, 10) if use_ridge else to_json(sc, m, [], 0, 10)
            model = rd if use_ridge else m
            if name != "completeness":
                res["sentence"][name]["affine"] = stretch(model.predict(sc.transform(Xtr)), Ytr[:, k])
                a, b = res["sentence"][name]["affine"]
                p_te = np.clip(a * model.predict(sc.transform(Xte)) + b, 0, 10)
                print(f"{'':12s} after range matching: PCC={pearsonr(p_te, Yte[:, k])[0]:.3f} MAE={np.mean(np.abs(p_te - Yte[:, k])):.2f} pred std {p_te.std():.2f} vs human {Yte[:, k].std():.2f}")
            res["metrics"][f"sentence_{name}_pcc"] = round(r_ridge if use_ridge else r_mlp, 4)
        res["meta"] = {"trainedOn": "speechocean762 train (2500 utt), evaluated on test (2500 utt)", "model": sys.argv[5], "metrics": res["metrics"]}
        json.dump(res, open(out, "w"))


if __name__ == "__main__":
    main()
