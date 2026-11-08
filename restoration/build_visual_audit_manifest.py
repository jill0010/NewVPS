#!/usr/bin/env python3
"""Generate immutable visual-audit manifest for all original HTML captures.

Screenshots are generated separately by browser CI. Never synthesize reference screenshots.
"""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / "restoration/page-index.json").read_text(encoding="utf-8"))
rows = []
for page in data["pages"]:
    route = page["route"]
    if not route:
        continue
    rows.append({
        "route": route,
        "capture": page["capture"],
        "source": page["source"],
        "archive": page["archive"],
        "language": page["language"],
        "viewports": [
            {"name": "desktop", "width": 1440, "height": 900},
            {"name": "mobile", "width": 390, "height": 844}
        ]
    })
out = ROOT / "restoration/visual-audit-manifest.json"
out.write_text(json.dumps({"schema_version": 1, "captures": len(rows), "items": rows}, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
print(f"Visual audit manifest: {len(rows)} original captures; {len(rows)*2} capture/viewport combinations")
