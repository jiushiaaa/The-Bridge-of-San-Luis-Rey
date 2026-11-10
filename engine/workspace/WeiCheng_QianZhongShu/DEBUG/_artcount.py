# -*- coding: utf-8 -*-
import os, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "wc-assets")
for sub in ("avatars", "images", "cg"):
    p = os.path.join(ROOT, sub)
    n = len([f for f in os.listdir(p) if f.endswith(".jpg")]) if os.path.isdir(p) else 0
    print(f"{sub}: {n} 张 .jpg")
for f in ("images/scene_icon.jpg", "images/favicon.png", "images/npc_unknown.png", "images/title.jpg", "images/ending.jpg"):
    p = os.path.join(ROOT, f)
    print(f"{f}: {'存在' if os.path.exists(p) else '缺失'}")
