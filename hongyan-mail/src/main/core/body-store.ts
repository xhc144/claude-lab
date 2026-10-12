// Raw RFC 822 sources of downloaded messages, stored as .eml files under the data directory.
import fs from 'node:fs';
import path from 'node:path';

export class BodyStore {
  constructor(private root: string) {
    fs.mkdirSync(root, { recursive: true });
  }

  private file(accountId: number, id: number) {
    return path.join(this.root, String(accountId), `${id}.eml`);
  }

  has(accountId: number, id: number): boolean {
    return fs.existsSync(this.file(accountId, id));
  }

  read(accountId: number, id: number): Buffer | null {
    try { return fs.readFileSync(this.file(accountId, id)); } catch { return null; }
  }

  write(accountId: number, id: number, data: Buffer) {
    const f = this.file(accountId, id);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    const tmp = f + '.tmp';
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, f);
  }

  remove(accountId: number, ids: number[]) {
    for (const id of ids) {
      try { fs.unlinkSync(this.file(accountId, id)); } catch { /* not cached */ }
    }
  }

  removeAccount(accountId: number) {
    fs.rmSync(path.join(this.root, String(accountId)), { recursive: true, force: true });
  }
}
