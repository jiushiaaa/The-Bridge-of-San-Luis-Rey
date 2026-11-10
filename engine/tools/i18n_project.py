"""Select the book for the inherited i18n tools: LUMI_GAME=slr (default: xdd)."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BOOKS = {'xdd': 'xidaduo', 'slr': 'sanluisrey'}
GAME_ID = os.environ.get('LUMI_GAME', 'xdd')
if GAME_ID not in BOOKS:
    raise ValueError(f'Unsupported translation project: {GAME_ID}')
BOOK = ROOT / 'workspace' / BOOKS[GAME_ID]
