#!/usr/bin/env python3
"""Rank judged math-item difficulty from a connected pairwise comparison graph.

Usage: python rank_pairs.py comparisons.json ranking.json [--l2 0.01]
Input: {"comparisons": [{"left": "A", "right": "B",
        "outcome": "left_harder" | "right_harder" | "tie" | "uncertain"}]}
Other fields are treated as metadata, not weights. Each retained row has unit weight.

This is an original implementation of an L2-penalized Bradley--Terry maximum
likelihood estimator, using SciPy's L-BFGS-B optimizer. It does not reproduce the
ILSR procedure used in the referenced research. Ties contribute half a win to
each item: this is a fractional-outcome approximation, not a full tie model.
The fitted preference is about the supplied judgments, NOT human solve rates.
No absolute difficulty scale, uncertainty interval, or human calibration is fitted.
"""

from __future__ import annotations

import argparse
import json
import math
import os
from pathlib import Path
import sys
import tempfile

try:
    import numpy as np
    from scipy.optimize import minimize
    from scipy.sparse import csr_matrix
    from scipy.sparse.csgraph import connected_components
    from scipy.special import expit
except ImportError as exc:
    raise SystemExit("rank_pairs: numpy and scipy are required; install them in the Python runtime.") from exc


class InputError(ValueError):
    """An input cannot support the requested global ranking."""


OUTCOMES = {"left_harder": 1.0, "right_harder": 0.0, "tie": 0.5, "uncertain": None}


def unique_keys(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise InputError(f"Duplicate JSON key: {key!r}.")
        result[key] = value
    return result


def reject_constant(value):
    raise InputError(f"Non-finite JSON value {value!r} is not allowed.")


def validate(data):
    if not isinstance(data, dict):
        raise InputError("Input must be an object containing a 'comparisons' array.")
    rows = data.get("comparisons")
    if not isinstance(rows, list) or not rows:
        raise InputError("'comparisons' must be a nonempty array.")
    items, retained, excluded = set(), [], []
    for number, row in enumerate(rows, 1):
        prefix = f"Comparison {number}"
        if not isinstance(row, dict):
            raise InputError(f"{prefix} must be an object.")
        for key in ("left", "right", "outcome"):
            if key not in row:
                raise InputError(f"{prefix} is missing required field {key!r}.")
        left, right, outcome = row["left"], row["right"], row["outcome"]
        for key, item in (("left", left), ("right", right)):
            if not isinstance(item, str) or not item or item != item.strip():
                raise InputError(f"{prefix}: '{key}' must be a nonempty string without surrounding whitespace.")
        if left == right:
            raise InputError(f"{prefix} compares {left!r} with itself.")
        if not isinstance(outcome, str) or outcome not in OUTCOMES:
            raise InputError(f"{prefix}: invalid outcome; use {', '.join(OUTCOMES)}.")
        if "weight" in row or "count" in row:
            raise InputError(f"{prefix}: weight/count fields are unsupported; supply one row per judgment.")
        items.update((left, right))
        record = (left, right, outcome)
        (excluded if outcome == "uncertain" else retained).append(record)
    if not retained:
        raise InputError("No usable comparisons remain after excluding 'uncertain'.")
    names = sorted(items)
    indices = {name: i for i, name in enumerate(names)}
    adjacency = [set() for _ in names]
    for left, right, _ in retained:
        i, j = indices[left], indices[right]
        adjacency[i].add(j)
        adjacency[j].add(i)
    unseen, components = set(range(len(names))), []
    while unseen:
        stack, component = [min(unseen)], []
        unseen.remove(stack[0])
        while stack:
            current = stack.pop()
            component.append(names[current])
            for neighbor in sorted(adjacency[current]):
                if neighbor in unseen:
                    unseen.remove(neighbor)
                    stack.append(neighbor)
        components.append(sorted(component))
    if len(components) != 1:
        raise InputError(
            "Comparison graph is disconnected after excluding 'uncertain'; global ranking is unidentified. "
            "Add non-uncertain cross-component comparisons. Components: "
            + json.dumps(components, ensure_ascii=False)
        )
    return names, indices, retained, excluded, adjacency


def fit_ranking(data, l2=0.01):
    if (isinstance(l2, bool) or not isinstance(l2, (float, int))
            or not math.isfinite(l2) or not 1e-4 <= l2 <= 1.0):
        raise InputError("L2 regularization must be finite and positive in the supported range [0.0001, 1].")
    names, indices, rows, excluded, adjacency = validate(data)
    left = np.array([indices[row[0]] for row in rows], dtype=int)
    right = np.array([indices[row[1]] for row in rows], dtype=int)
    target = np.array([OUTCOMES[row[2]] for row in rows], dtype=float)

    def objective(beta):
        difference = beta[left] - beta[right]
        loss = np.sum(target * np.logaddexp(0.0, -difference)
                      + (1.0 - target) * np.logaddexp(0.0, difference))
        loss += 0.5 * l2 * np.dot(beta, beta)
        residual = expit(difference) - target
        gradient = l2 * beta.copy()
        np.add.at(gradient, left, residual)
        np.add.at(gradient, right, -residual)
        return float(loss), gradient

    fitted = minimize(objective, np.zeros(len(names)), jac=True, method="L-BFGS-B",
                      options={"gtol": 1e-7, "ftol": 1e-15, "maxiter": 10000, "maxls": 50})
    if not fitted.success or not np.all(np.isfinite(fitted.x)):
        raise InputError(f"Optimization failed; no ranking was written: {fitted.message}")
    beta = fitted.x - fitted.x.mean()
    loss, gradient = objective(beta)
    if not math.isfinite(loss) or np.max(np.abs(gradient)) > 1e-5:
        raise InputError("Optimization did not reach a sufficiently stationary solution; no ranking was written.")

    counts = {name: {"comparisons": 0, "harder": 0, "easier": 0, "ties": 0,
                     "uncertain_excluded": 0} for name in names}
    pairs = {}
    for first, second, outcome in rows:
        counts[first]["comparisons"] += 1
        counts[second]["comparisons"] += 1
        if outcome == "tie":
            counts[first]["ties"] += 1
            counts[second]["ties"] += 1
        else:
            winner, loser = (first, second) if outcome == "left_harder" else (second, first)
            counts[winner]["harder"] += 1
            counts[loser]["easier"] += 1
        a, b = sorted((first, second))
        entry = pairs.setdefault((a, b), {"comparisons": 0, "left_harder": 0, "right_harder": 0, "ties": 0})
        entry["comparisons"] += 1
        if outcome == "tie":
            entry["ties"] += 1
        else:
            entry["left_harder" if winner == a else "right_harder"] += 1
    for first, second, _ in excluded:
        counts[first]["uncertain_excluded"] += 1
        counts[second]["uncertain_excluded"] += 1

    pair_diagnostics, cycle_rows, cycle_cols = [], [], []
    for (a, b), entry in sorted(pairs.items()):
        observed = entry["left_harder"] + 0.5 * entry["ties"]
        expected = entry["comparisons"] * expit(beta[indices[a]] - beta[indices[b]])
        pair_diagnostics.append({"left": a, "right": b, **entry,
                                 "harder_credit_residual": round(float(observed - expected), 8),
                                 "residual_per_comparison": round(float((observed - expected) / entry["comparisons"]), 8)})
        if entry["left_harder"] != entry["right_harder"]:
            winner, loser = (a, b) if entry["left_harder"] > entry["right_harder"] else (b, a)
            cycle_rows.append(indices[winner])
            cycle_cols.append(indices[loser])
    majority_graph = csr_matrix((np.ones(len(cycle_rows)), (cycle_rows, cycle_cols)),
                               shape=(len(names), len(names)))
    number_components, labels = connected_components(majority_graph, directed=True, connection="strong")
    cycle_groups = [[names[i] for i in range(len(names)) if labels[i] == label]
                    for label in range(number_components)]
    cycle_groups = sorted(group for group in cycle_groups if len(group) > 1)

    order = sorted(range(len(names)), key=lambda i: (-float(beta[i]), names[i]))
    ranking, group_beta, rank = [], None, 0
    for position, i in enumerate(order, 1):
        if group_beta is None or abs(float(beta[i]) - group_beta) > 1e-7:
            rank, group_beta = position, float(beta[i])
        ranking.append({"item": names[i], "rank": rank, "relative_beta": round(float(beta[i]), 8),
                        "distinct_opponents": len(adjacency[i]), **counts[names[i]]})
    residual_pairs = sorted(pair_diagnostics,
                            key=lambda item: (-abs(item["residual_per_comparison"]), item["left"], item["right"]))[:20]
    return {
        "method": "Bradley-Terry logistic model; local L2-penalized maximum likelihood (L-BFGS-B), not ILSR",
        "l2": float(l2),
        "objective": "sum(log(1+exp(beta_left-beta_right)) - outcome_credit*(beta_left-beta_right)) + l2/2*sum(beta^2)",
        "interpretation": "Higher relative_beta means judged harder within this input set; beta is centered at zero. Rank 1 is hardest.",
        "limits": [
            "Relative judgment scale only: no human solve probability or absolute difficulty level is estimated.",
            "Tie rows use outcome_credit=0.5; this is a half-win approximation, not a full model of ties.",
            "Uncertain rows are excluded before fitting and connectivity checks; other metadata does not alter unit row weights.",
            "L2 regularization keeps all-win/all-loss estimates finite; magnitudes depend on l2 and the comparison set. Supported l2 range is [0.0001, 1].",
            "Ranks sharing beta within 1e-7 share a rank; this is numerical equivalence, not an uncertainty test.",
            "No confidence intervals are fitted. Repeated or correlated model judgments do not constitute independent human evidence."
        ],
        "items": len(names), "comparisons_used": len(rows), "uncertain_excluded": len(excluded),
        "ties_used": int(np.count_nonzero(target == 0.5)),
        "optimizer": {"converged": True, "iterations": int(fitted.nit),
                      "max_abs_gradient": float(np.max(np.abs(gradient))), "penalized_loss": loss},
        "ranking": ranking,
        "diagnostics": {
            "pairs_with_opposing_decisive_judgments": sum(entry["left_harder"] > 0 and entry["right_harder"] > 0 for entry in pairs.values()),
            "majority_cycle_groups": cycle_groups,
            "largest_residual_pairs": residual_pairs,
            "residual_definition": "Observed harder credits for alphabetically first item minus fitted expected harder credits; divided by comparison count for per-comparison residual.",
            "caution": "Opposing judgments, majority cycles and large residuals signal disagreement or mismatch with a single ordering; none alone establishes an incorrect judgment."
        }
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("input", type=Path, help="JSON file with a comparisons array")
    parser.add_argument("output", type=Path, help="Destination JSON file")
    parser.add_argument("--l2", type=float, default=0.01, help="L2 penalty in [0.0001, 1], default 0.01")
    args = parser.parse_args(argv)
    temporary = None
    try:
        if args.input.resolve() == args.output.resolve():
            raise InputError("Input and output paths must differ.")
        with args.input.open(encoding="utf-8-sig") as handle:
            data = json.load(handle, object_pairs_hook=unique_keys, parse_constant=reject_constant)
        result = fit_ranking(data, args.l2)
        # Replace atomically only after a valid fit; leave an existing output untouched on error.
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=args.output.parent,
                                         prefix=f".{args.output.name}.", suffix=".tmp", delete=False) as handle:
            temporary = Path(handle.name)
            json.dump(result, handle, indent=2, ensure_ascii=False, allow_nan=False)
            handle.write("\n")
        os.replace(temporary, args.output)
    except (InputError, OSError, ValueError, TypeError) as exc:
        print(f"rank_pairs: {exc}", file=sys.stderr)
        return 2
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    print(f"Ranked {result['items']} items from {result['comparisons_used']} comparisons -> {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
