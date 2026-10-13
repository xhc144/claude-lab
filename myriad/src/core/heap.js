// Binary min-heap of integer items keyed by float priorities, backed by typed arrays.
// Used by the priority-flood hydrology, the territory Dijkstra and A* path finding.

export class MinHeap {
  constructor(capacity = 1024) {
    this.items = new Int32Array(capacity);
    this.keys = new Float64Array(capacity);
    this.size = 0;
  }

  clear() { this.size = 0; }

  push(item, key) {
    if (this.size === this.items.length) {
      const items = new Int32Array(this.items.length * 2);
      const keys = new Float64Array(this.keys.length * 2);
      items.set(this.items);
      keys.set(this.keys);
      this.items = items;
      this.keys = keys;
    }
    let i = this.size++;
    const it = this.items, ks = this.keys;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (ks[p] <= key) break;
      it[i] = it[p];
      ks[i] = ks[p];
      i = p;
    }
    it[i] = item;
    ks[i] = key;
  }

  /** key of the top item (call only when size > 0) */
  peekKey() { return this.keys[0]; }

  pop() {
    const it = this.items, ks = this.keys;
    const top = it[0];
    const n = --this.size;
    if (n > 0) {
      const item = it[n], key = ks[n];
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && ks[c + 1] < ks[c]) c++;
        if (ks[c] >= key) break;
        it[i] = it[c];
        ks[i] = ks[c];
        i = c;
      }
      it[i] = item;
      ks[i] = key;
    }
    return top;
  }
}
