# Dump remaining Hindi-todo slices for translation
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parents[1]
HI = json.loads((ROOT / "workspace/xidaduo/i18n/hi/final_game.json").read_text(encoding="utf-8"))
ZH = json.loads((ROOT / "workspace/xidaduo/final_game.json").read_text(encoding="utf-8"))
arg = sys.argv[1] if len(sys.argv) > 1 else "hints"
out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("_hi_slice.json")

rows = []
if arg == "hints":
    for i, c in enumerate(HI["cards"]):
        z = ZH["cards"][i]
        for j, h in enumerate(c.get("hints") or []):
            rows.append(
                {
                    "path": f"/cards/{i}/hints/{j}",
                    "id": c["id"],
                    "zh": z["hints"][j],
                    "en": h,
                }
            )
elif arg == "entries":
    for eid, e in HI["entries"].items():
        z = ZH["entries"][eid]
        if e.get("desc"):
            rows.append({"path": f"/entries/{eid}/desc", "zh": z.get("desc", ""), "en": e["desc"]})
        for ai, a in enumerate(e.get("archive") or []):
            za = z["archive"][ai]
            rows.append(
                {
                    "path": f"/entries/{eid}/archive/{ai}/title",
                    "zh": za["title"],
                    "en": a["title"],
                }
            )
            for fi, f in enumerate(a.get("fields") or []):
                zf = za["fields"][fi]
                if "label" in f:
                    rows.append(
                        {
                            "path": f"/entries/{eid}/archive/{ai}/fields/{fi}/label",
                            "zh": zf.get("label", ""),
                            "en": f["label"],
                        }
                    )
                if "text" in f:
                    rows.append(
                        {
                            "path": f"/entries/{eid}/archive/{ai}/fields/{fi}/text",
                            "zh": zf.get("text", ""),
                            "en": f["text"],
                        }
                    )
elif arg == "recaps":
    for lv, rec in HI["recaps"].items():
        zrec = ZH["recaps"][lv]
        for pi, page in enumerate(rec["pages"]):
            zp = zrec["pages"][pi]
            rows.append(
                {
                    "path": f"/recaps/{lv}/pages/{pi}/title",
                    "zh": zp["title"],
                    "en": page["title"],
                }
            )
            for si, seg in enumerate(page["segments"]):
                rows.append(
                    {
                        "path": f"/recaps/{lv}/pages/{pi}/segments/{si}/text",
                        "zh": zp["segments"][si]["text"],
                        "en": seg["text"],
                    }
                )
elif arg.startswith("cards"):
    # cards:0:16 meaning indices
    a, b = (int(x) for x in arg.split(":")[1:])
    for i in range(a, b):
        c = HI["cards"][i]
        z = ZH["cards"][i]
        rows.append({"path": f"/cards/{i}/title", "id": c["id"], "zh": z["title"], "en": c["title"]})
        for si, seg in enumerate(c["segments"]):
            zs = z["segments"][si]
            row = {
                "path": f"/cards/{i}/segments/{si}/text",
                "id": c["id"],
                "kind": seg.get("kind"),
                "zh": zs["text"],
                "en": seg["text"],
            }
            if "speaker" in seg:
                row["speaker_en"] = seg["speaker"]
                row["speaker_zh"] = zs.get("speaker", "")
                row["speaker_path"] = f"/cards/{i}/segments/{si}/speaker"
            rows.append(row)
        for j, h in enumerate(c.get("hints") or []):
            rows.append(
                {
                    "path": f"/cards/{i}/hints/{j}",
                    "id": c["id"],
                    "zh": z["hints"][j],
                    "en": h,
                }
            )

out.write_text(json.dumps(rows, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print(arg, len(rows), "chars", sum(len(r.get("en") or "") for r in rows), "->", out)
