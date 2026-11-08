#!/usr/bin/env python3
"""Read-only deployed root asset audit. Never invent source resources."""
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
import hashlib
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://jill0010.github.io/NewVPS"
PATTERNS = {
    "favicon.ico": "favicon-*.ico",
    "favicon-32-v2.png": "favicon-32-v2-*.png",
    "apple-touch-icon-v2.png": "apple-touch-icon-v2-*.png",
}
MISSING = ["manifest.json", ".well-known/agent.json", "AnonPort.webp", "assets/img/og-image.jpg"]
results = []
for name, pattern in PATTERNS.items():
    originals = sorted((ROOT / "extracted").glob(f"newvps*/cloned-page-*/assets/anonport_com/{pattern}"))
    expected = originals[0].read_bytes() if originals else None
    record = {"path": "/" + name, "original_capture": originals[0].relative_to(ROOT).as_posix() if originals else None}
    try:
        with urlopen(Request(BASE + "/" + name, headers={"User-Agent":"NewVPS-asset-audit/1.0"}), timeout=20) as response:
            actual = response.read()
            record["http_status"] = response.status
        record["byte_identical_to_capture"] = expected is not None and actual == expected
        record["sha256"] = hashlib.sha256(actual).hexdigest()
    except (HTTPError, URLError, OSError) as error:
        record["http_status"] = getattr(error, "code", None)
        record["error"] = str(error)[:250]
        record["byte_identical_to_capture"] = False
    results.append(record)
for name in MISSING:
    record = {"path": "/" + name, "status": "NOT_FOUND_IN_CAPTURE"}
    try:
        with urlopen(Request(BASE + "/" + name, headers={"User-Agent":"NewVPS-asset-audit/1.0"}), timeout=20) as response:
            record["http_status"] = response.status
    except (HTTPError, URLError, OSError) as error:
        record["http_status"] = getattr(error, "code", None)
    results.append(record)
report = {"preview_base_url": BASE, "original_icons_verified": sum(x.get("byte_identical_to_capture", False) for x in results), "original_icons_total": len(PATTERNS), "resources": results}
output = ROOT / "restoration/online-root-assets-audit.json"
output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, ensure_ascii=False, indent=2))
if report["original_icons_verified"] != len(PATTERNS):
    sys.exit("Captured original icon bytes differ from online deployment")
