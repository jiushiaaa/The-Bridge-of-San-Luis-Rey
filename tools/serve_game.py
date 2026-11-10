#!/usr/bin/env python3
"""Serve only the compiled game, never the private source library."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description='在本机启动《圣路易斯雷大桥》')
parser.add_argument('--port', type=int, default=4186)
args = parser.parse_args()
public = root / 'dist'
if not (public / 'index.html').is_file():
    parser.exit(1, '尚未构建当前工程。请在工程目录运行：npm --prefix engine/frontend ci && npm run build\n')

class Handler(SimpleHTTPRequestHandler):
    def list_directory(self, path):
        self.send_error(404)

try:
    server = ThreadingHTTPServer(('127.0.0.1', args.port), partial(Handler, directory=str(public)))
except OSError as error:
    parser.exit(1, f'无法使用端口 {args.port}：{error}\n若游戏已启动，可直接打开 http://127.0.0.1:{args.port}/\n')
print(f'《圣路易斯雷大桥》：http://127.0.0.1:{args.port}/\n保持此窗口打开。按 Ctrl+C 关闭。', flush=True)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
