// Search over titles, English names, aliases, pinyin (全拼 / 首字母), tags, summaries and — once
// data/content.js has loaded — the full text of every card.

const strip = (html) => html.replace(/<span class="m">([^<]*)<\/span>/g, ' $1 ').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ');
const norm = (s) => s.toLowerCase().replace(/\s+/g, '');

export class Search {
  constructor(graph) {
    this.graph = graph;
    this.items = graph.nodes.map((n) => ({
      i: n.index,
      title: norm(n.t),
      en: (n.en || '').toLowerCase(),
      al: (n.al || []).map(norm),
      py: (n.py || '').split('|').filter(Boolean),
      pi: (n.pi || '').split('|').filter(Boolean),
      tg: (n.tg || []).map(norm),
      sum: norm(strip(n.s || '')),
      text: '',
    }));
  }
  addContent(content) {
    for (const it of this.items) {
      const c = content[this.graph.nodes[it.i].id];
      if (c) it.text = norm(c.x || '');
    }
  }
  query(q, limit = 40) {
    q = norm(q);
    if (!q) return [];
    const ascii = /^[a-z0-9]+$/.test(q);
    const res = [];
    for (const it of this.items) {
      let score = 0, field = '';
      const hit = (s, f) => { if (s > score) { score = s; field = f; } };
      if (it.title === q) hit(100, 'title');
      else if (it.title.startsWith(q)) hit(84 - Math.min(10, it.title.length - q.length), 'title');
      else if (it.title.includes(q)) hit(70 - Math.min(10, it.title.length - q.length), 'title');
      for (const a of it.al) { if (a === q) hit(80, 'alias'); else if (a.includes(q)) hit(56, 'alias'); }
      if (ascii) {
        for (const p of it.py) { if (p === q) hit(78, 'pinyin'); else if (p.startsWith(q)) hit(60, 'pinyin'); else if (q.length >= 3 && p.includes(q)) hit(44, 'pinyin'); }
        for (const p of it.pi) { if (p === q) hit(66, 'pinyin'); else if (q.length >= 2 && p.startsWith(q)) hit(50, 'pinyin'); }
        if (it.en) { const words = it.en.replace(/[^a-z0-9 ]/g, ' '); if (words.split(/\s+/).some((w) => w.startsWith(q))) hit(58, 'en'); else if (it.en.replace(/\s+/g, '').includes(q)) hit(46, 'en'); }
      } else if (it.en && it.en.replace(/\s+/g, '').includes(q)) hit(46, 'en');
      for (const t of it.tg) if (t.includes(q)) hit(t === q ? 40 : 32, 'tag');
      if (score < 30 && it.sum.includes(q)) hit(26, 'summary');
      if (score < 20 && q.length >= 2 && it.text.includes(q)) hit(14, 'text');
      if (score) res.push({ i: it.i, score: score + this.graph.nodes[it.i].w * 0.6, field });
    }
    res.sort((a, b) => b.score - a.score);
    return res.slice(0, limit);
  }
}
