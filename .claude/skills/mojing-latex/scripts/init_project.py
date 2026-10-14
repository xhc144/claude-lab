#!/usr/bin/env python3
"""Copy a bundled Mojing template into a new directory; never overwrite."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
MODES = ("notes", "exercise", "exam", "paper", "book", "translation")
VARIANTS = {
    "notes": {"default": ""},
    "exercise": {
        "teacher": "",
        "student": r"\def\MojingAnswers{none}",
        "key": r"\def\MojingAnswers{end}",
    },
    "exam": {"questions": "", "answers": r"\def\MojingAnswers{true}"},
    "paper": {"default": ""},
    "book": {"default": ""},
    "translation": {
        "facing": "",
        "columns": r"\def\MojingLayout{columns}",
        "interleave": r"\def\MojingLayout{interleave}",
        "target": r"\def\MojingLayout{target}",
    },
}
DEFAULTS = {mode: next(iter(variants)) for mode, variants in VARIANTS.items()}


def validate_assets(mode: str) -> tuple[Path, dict, list[Path]]:
    source = ROOT / "assets" / "templates" / mode
    if not source.is_dir() or source.is_symlink():
        raise ValueError(f"Template assets missing or unsafe: {mode}")
    manifest = json.loads((ROOT / "references" / "source-manifest.json").read_text(encoding="utf-8"))
    expected = manifest["archives"][mode]["files"]
    files = []
    for path in sorted(source.rglob("*")):
        if path.is_symlink():
            raise ValueError(f"Refusing symlink in template: {path}")
        if not path.is_file() and not path.is_dir():
            raise ValueError(f"Refusing special file in template: {path}")
        if path.is_file():
            relative = path.relative_to(source).as_posix()
            if relative not in expected:
                raise ValueError(f"Untracked asset: {relative}")
            actual = hashlib.sha256(path.read_bytes()).hexdigest()
            if actual != expected[relative]:
                raise ValueError(f"Asset checksum mismatch: {relative}")
            files.append(path)
    actual_names = {p.relative_to(source).as_posix() for p in files}
    if actual_names != set(expected):
        raise ValueError("Template is incomplete; missing: " + ", ".join(sorted(set(expected) - actual_names)))
    return source, manifest, files


def destination_path(raw: str) -> Path:
    requested = Path(os.path.abspath(os.path.expanduser(raw)))
    if os.path.lexists(requested):
        raise ValueError(f"Destination already exists; nothing was changed: {requested}")
    # Require a real existing parent. Do not create an arbitrary parent tree.
    parent = requested.parent.resolve(strict=True)
    if not parent.is_dir():
        raise ValueError(f"Destination parent is not a directory: {parent}")
    target = parent / requested.name
    if target == ROOT or ROOT in target.parents:
        raise ValueError("Create the project outside the installed skill directory.")
    if os.path.lexists(target):
        raise ValueError(f"Destination already exists; nothing was changed: {target}")
    return target


def initialize(mode: str, raw_dest: str, variant: str | None) -> Path:
    variant = variant or DEFAULTS[mode]
    if variant not in VARIANTS[mode]:
        raise ValueError(f"Variant '{variant}' is not valid for {mode}; choose: {', '.join(VARIANTS[mode])}")
    source, manifest, files = validate_assets(mode)
    target = destination_path(raw_dest)
    # Exclusive directory creation also refuses a file/symlink created after the check.
    target.mkdir(exist_ok=False)
    try:
        for directory in sorted(p for p in source.rglob("*") if p.is_dir()):
            (target / directory.relative_to(source)).mkdir(exist_ok=False)
        for path in files:
            output = target / path.relative_to(source)
            data = path.read_bytes()
            pretex = VARIANTS[mode][variant]
            if path.name == "main.tex" and pretex:
                prefix = f"% Mojing initialized variant: {variant}\n{pretex}\n"
                data = prefix.encode("utf-8") + data
            with output.open("xb") as handle:
                handle.write(data)
        metadata = {
            "template": mode,
            "variant": variant,
            "source_repository": manifest["repository"],
            "source_commit": manifest["commit"],
            "archive_sha256": manifest["archives"][mode]["sha256"],
        }
        with (target / "mojing-project.json").open("x", encoding="utf-8") as handle:
            json.dump(metadata, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
    except Exception as error:
        # Do not recursively delete on failure: a concurrent writer may own new files.
        raise RuntimeError(f"Initialization incomplete at {target}; files were not overwritten. Inspect this directory before retrying. Cause: {error}") from error
    return target


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("template", choices=MODES)
    parser.add_argument("destination", help="New project directory; parent must already exist")
    parser.add_argument("--variant", help="exercise: teacher/student/key; exam: questions/answers; translation: facing/columns/interleave/target; others: default")
    args = parser.parse_args()
    try:
        target = initialize(args.template, args.destination, args.variant)
    except (OSError, ValueError, KeyError, RuntimeError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    print(f"Created {args.template} ({args.variant or DEFAULTS[args.template]}): {target}")
    print("Only files were copied; no compiler, network request, data script, or upload was run.")
    print("Next: check dependencies, then run in this directory:")
    print("  latexmk -xelatex -interaction=nonstopmode -file-line-error -halt-on-error main.tex")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
