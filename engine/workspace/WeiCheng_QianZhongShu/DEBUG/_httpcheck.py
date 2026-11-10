# -*- coding: utf-8 -*-
import urllib.request, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
for url in ("http://localhost:5174/?game=weicheng",
            "http://localhost:5174/wc-assets/avatars/e_fanghongjian.jpg",
            "http://localhost:5174/wc-assets/cg/c1_01.jpg"):
    try:
        r = urllib.request.urlopen(url, timeout=8)
        print(f"{r.status} {r.headers.get('Content-Type')}  {url}")
    except Exception as e:
        print(f"ERR {e}  {url}")
