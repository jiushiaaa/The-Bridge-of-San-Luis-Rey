import type { Book, Save } from './types';
import { validateSave } from './engine';
export interface HostSdk {
  ready(): Promise<{ ready: boolean; error?: string }>;
  readSave(): Promise<ArrayBuffer | null>;
  writeSave(data: string): Promise<void>;
  requireLogin(): Promise<void>;
}
declare global { interface Window { LumiMakerSdk?: HostSdk } }
export interface StorageAdapter { read(): Promise<unknown>; write(save: Save): Promise<void>; mode: string }

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('san-luis-rey', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('saves');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(new Error('浏览器未能打开本机存档。可下载进度文件保存。'));
    r.onblocked = () => reject(new Error('另一窗口正在升级存档，请关闭它后重试。'));
  });
}
export async function browserAdapter(sdk?: HostSdk): Promise<StorageAdapter> {
  if (sdk) {
    const ready = await sdk.ready();
    if (!ready.ready) throw new Error('云存档尚未连接。请重试；现有云端进度不会被覆盖。');
    return {
      mode: '幻光云存档',
      async read() {
        let bytes: ArrayBuffer | null;
        try { bytes = await sdk.readSave(); }
        catch (err) {
          if ((err as { code?: string })?.code !== 'NOT_LOGGED_IN') throw err;
          await sdk.requireLogin(); bytes = await sdk.readSave();
        }
        return bytes === null ? null : JSON.parse(new TextDecoder().decode(bytes));
      },
      async write(s) { await sdk.writeSave(JSON.stringify(s)); },
    };
  }
  // A separately selected standalone mode, never a fallback for failed platform reads.
  const db = await database();
  return {
    mode: '本机自动存档',
    read: () => new Promise((resolve, reject) => {
      const tx = db.transaction('saves', 'readonly');
      const r = tx.objectStore('saves').get('main');
      r.onsuccess = () => resolve(r.result ?? null);
      r.onerror = () => reject(r.error);
    }),
    write: save => new Promise((resolve, reject) => {
      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').put(save, 'main');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('存档写入被中断。'));
    }),
  };
}

/** One read/write at a time. Coalesce queued snapshots, never apply a late read over newer play. */
export class SaveCoordinator {
  private generation = 0;
  private ready = false;
  private pending: Save | null = null;
  private flushing: Promise<void> | null = null;
  private loading: Promise<Save | null> | null = null;
  constructor(private book: Book, private adapter: StorageAdapter, private status: (message: string) => void = () => {}) {}
  async load(): Promise<Save | null> {
    if (this.loading) return this.loading;
    this.loading = this.readOnce().finally(() => { this.loading = null; });
    return this.loading;
  }
  private async readOnce(): Promise<Save | null> {
    if (this.flushing) await this.flushing;
    const at = this.generation;
    this.ready = false;
    try {
      const raw = await this.adapter.read();
      const save = raw === null ? null : validateSave(this.book, raw);
      this.ready = true;
      return at === this.generation ? save : null;
    } catch (err) {
      this.status('读取失败，自动写入已暂停。请重试或下载当前进度。'); throw err;
    }
  }
  persist(save: Save): void {
    this.generation++;
    if (!this.ready) { this.status('自动存档未就绪，请下载进度文件。'); return; }
    this.pending = structuredClone(save);
    this.beginFlush();
  }
  private beginFlush(): void {
    if (this.flushing || !this.pending) return;
    this.flushing = this.flush().finally(() => { this.flushing = null; if (this.pending) this.beginFlush(); });
  }
  private async flush(): Promise<void> {
    while (this.pending) {
      const next = this.pending; this.pending = null;
      this.status('正在保存…');
      try { await this.adapter.write(next); this.status(`${this.adapter.mode} · 已保存`); }
      catch { this.status('自动保存失败；可下载进度文件，再重试保存。'); }
    }
  }
  async settled(): Promise<void> { await this.flushing; }
}

export function downloadSave(save: Save) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url;
  const d = new Date(); const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  a.download = `圣路易斯雷大桥-卷${save.chapter}-${date}.json`;
  a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
