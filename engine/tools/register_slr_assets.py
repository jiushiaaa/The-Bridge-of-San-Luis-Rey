#!/usr/bin/env python3
"""Import reviewed image outputs, preserving originals outside the public tree.

Input: a local JSON array of id/source/file/prompt/review records. This tool only
copies bytes; it does not crop, retouch, invent or re-count derivative images.
"""
import argparse
import hashlib
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BOOK = ROOT / "engine/workspace/sanluisrey"


def read(path, default):
    return json.loads(path.read_text()) if path.exists() else default


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("manifest", type=Path)
    p.add_argument("--replace", action="store_true")
    args = p.parse_args()
    public_path = BOOK / "authoring/generated-images.json"
    records = read(public_path, [])
    # Cache paths belong to the local provenance record, never the public one.
    private_path = ROOT / "美术/完整工程重制/生成记录.json"
    private = read(private_path, [])
    for job in read(args.manifest, []):
        src = Path(job["source"])
        raw = src.read_bytes()
        sha = hashlib.sha256(raw).hexdigest()
        original = ROOT / "美术/完整工程重制/生成原图" / f"{job['id']}-{sha[:12]}.png"
        original.parent.mkdir(parents=True, exist_ok=True)
        if not original.exists():
            shutil.copy2(src, original)
        accepted = job.get("accepted", True)
        private.append({**job, "sha256": sha, "original": str(original)})
        if not accepted:
            print("REJECTED", job["id"], job["review"])
            continue
        dest = (BOOK / job["file"]).resolve()
        if not dest.is_relative_to(BOOK / "slr-assets"):
            raise ValueError("asset destination must be inside slr-assets")
        if dest.exists() and hashlib.sha256(dest.read_bytes()).hexdigest() != sha and not args.replace:
            raise FileExistsError(f"{dest.name}: use --replace after visual review")
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
        public = {k: v for k, v in job.items() if k not in ("source", "accepted")}
        public.update(generator="built-in image_gen", sha256=sha, bytes=len(raw))
        records = [r for r in records if r["id"] != job["id"]]
        records.append(public)
        print("IMPORTED", job["id"], len(raw))
    for item in records:
        item.pop("source", None)
    write(public_path, records)
    write(private_path, private)


if __name__ == "__main__":
    main()
