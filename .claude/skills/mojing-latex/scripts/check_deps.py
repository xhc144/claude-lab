#!/usr/bin/env python3
"""Read-only TeX preflight for a bundled Mojing template; no installations."""
from __future__ import annotations

import argparse
from pathlib import Path
import re
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
MODES = ("notes", "exercise", "exam", "paper", "book", "translation")
LATIN_FONTS = {
    "stix": ["STIXTwoText-Regular.otf", "STIXTwoText-SemiBold.otf", "STIXTwoText-Italic.otf", "STIXTwoText-SemiBoldItalic.otf", "STIXTwoMath-Regular.otf"],
    "termes": ["texgyretermes-regular.otf", "texgyretermes-bold.otf", "texgyretermes-italic.otf", "texgyretermes-bolditalic.otf", "texgyretermes-math.otf"],
    "pagella": ["texgyrepagella-regular.otf", "texgyrepagella-bold.otf", "texgyrepagella-italic.otf", "texgyrepagella-bolditalic.otf", "texgyrepagella-math.otf"],
    "libertinus": ["LibertinusSerif-Regular.otf", "LibertinusSerif-Semibold.otf", "LibertinusSerif-Italic.otf", "LibertinusSerif-SemiboldItalic.otf", "LibertinusMath-Regular.otf"],
    "newcm": ["NewCM10-Book.otf", "NewCM10-Bold.otf", "NewCM10-BookItalic.otf", "NewCM10-BoldItalic.otf", "NewCMMath-Book.otf"],
    "lm": ["lmroman10-regular.otf", "lmroman10-bold.otf", "lmroman10-italic.otf", "lmroman10-bolditalic.otf", "latinmodern-math.otf"],
}
SHARED_FONTS = ["STIXTwoMath-Regular.otf", "SourceSansPro-Regular.otf", "SourceSansPro-Semibold.otf", "SourceSansPro-RegularIt.otf", "SourceSansPro-SemiboldIt.otf", "SourceSansPro-Bold.otf", "SourceCodePro-Regular.otf", "SourceCodePro-Semibold.otf", "SourceCodePro-RegularIt.otf", "SourceCodePro-SemiboldIt.otf"]
FANDOL_FONTS = ["FandolSong-Regular.otf", "FandolSong-Bold.otf", "FandolHei-Regular.otf", "FandolHei-Bold.otf", "FandolKai-Regular.otf", "FandolFang-Regular.otf"]


def tex_lookup(name: str) -> bool:
    result = subprocess.run(["kpsewhich", name], capture_output=True, text=True, timeout=15, check=False)
    return result.returncode == 0 and bool(result.stdout.strip())


def required_packages(mode: str) -> list[str]:
    files = (ROOT / "assets" / "templates" / mode).glob("mojing-*.*")
    packages = {"ctex", "fontspec", "xeCJK"}
    for file in files:
        content = re.sub(r"(?m)%.*$", "", file.read_text(encoding="utf-8"))
        for match in re.finditer(r"\\RequirePackage\s*(?:\[[^\]]*\]\s*)?\{([^}]+)\}", content, flags=re.S):
            for package in match.group(1).split(","):
                package = package.strip()
                if package and not package.startswith("mojing-"):
                    packages.add(package)
    return sorted(f"{package}.sty" for package in packages)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("template", choices=MODES)
    parser.add_argument("--latin", choices=LATIN_FONTS, help="Font scheme to check; default follows the bundled document class")
    parser.add_argument("--cjk", choices=["auto", "fandol"], default="auto", help="auto reports Fandol fallback availability; fandol requires all fallback files")
    args = parser.parse_args()
    latin = args.latin or ("pagella" if args.template in {"book", "translation"} else "stix")
    tools = ["xelatex", "latexmk", "kpsewhich"]
    if args.template in {"paper", "book"}:
        tools.append("biber")
    if args.template == "book":
        tools.append("makeindex")
    missing_tools = [tool for tool in tools if shutil.which(tool) is None]
    print(f"Template: {args.template}; Latin: {latin}; CJK: {args.cjk}")
    print("Required tools: " + ", ".join(tools))
    missing_files = []
    if "kpsewhich" not in missing_tools:
        required = ["xelatex.fmt"] + required_packages(args.template)
        if args.template in {"paper", "book"}:
            required += ["gb7714-2015.bbx", "gb7714-2015.cbx"]
        required += sorted(set(LATIN_FONTS[latin] + SHARED_FONTS))
        if args.cjk == "fandol":
            required += FANDOL_FONTS
        try:
            missing_files = [file for file in required if not tex_lookup(file)]
            if args.cjk == "auto":
                fallback_missing = [file for file in FANDOL_FONTS if not tex_lookup(file)]
                if fallback_missing:
                    print("Warning: CJK auto cannot rely on the complete Fandol fallback; actual system CJK families need checking: " + ", ".join(fallback_missing))
                else:
                    print("CJK Fandol fallback files found; system-family detection is evaluated by XeLaTeX.")
        except (OSError, subprocess.TimeoutExpired) as error:
            print(f"Dependency lookup failed: {error}", file=sys.stderr)
            return 2
    if missing_tools:
        print("Missing tools: " + ", ".join(missing_tools))
    if missing_files:
        print("Missing TeX packages/fonts: " + ", ".join(missing_files))
    for optional in ["pdfinfo", "pdftoppm", "pdffonts", "pdftotext"]:
        if shutil.which(optional) is None:
            print(f"Optional PDF inspection tool missing: {optional}")
    print("This is a preflight, not a compilation or visual/font/link verification. It does not install software or alter system settings.")
    if missing_tools or missing_files:
        print("Dependencies are incomplete. Prefer TeX Live 2023+ with the required packages/fonts (upstream recommends scheme-full).")
        return 1
    print("Baseline dependencies found; compile the actual project to verify options and output.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
