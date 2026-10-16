// Claude Lab · progressive enhancement for the project index and film pages.
(() => {
  const root = document.documentElement;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };

  // Theme: explicit choice wins; otherwise follow the system.
  const media = matchMedia('(prefers-color-scheme: light)');
  const current = () => root.dataset.theme || (media.matches ? 'light' : 'dark');
  for (const btn of document.querySelectorAll('.theme-toggle')) {
    const sync = () => btn.setAttribute('aria-label', current() === 'light' ? '切换到深色模式' : '切换到浅色模式');
    sync();
    btn.addEventListener('click', () => {
      const next = current() === 'light' ? 'dark' : 'light';
      root.dataset.theme = next;
      store.set('lab-theme', next);
      sync();
    });
    media.addEventListener?.('change', sync);
  }

  // Header border + back-to-top.
  const header = document.querySelector('.site-header');
  const toTop = document.querySelector('.to-top');
  const onScroll = () => {
    const y = scrollY;
    header?.classList.toggle('scrolled', y > 8);
    toTop?.classList.toggle('show', y > 900);
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  toTop?.addEventListener('click', () => scrollTo({ top: 0 }));

  // Gentle reveal for cards as they scroll into view.
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealables = document.querySelectorAll('.reveal');
  if (!reduce && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -40px 0px' });
    revealables.forEach((el) => io.observe(el));
  } else revealables.forEach((el) => el.classList.add('in'));

  initIndex();
  initFilm();

  function initIndex() {
    const input = document.getElementById('q');
    if (!input) return;
    const box = input.closest('.search');
    const chips = [...document.querySelectorAll('.chip')];
    const cards = [...document.querySelectorAll('.card')];
    const sections = [...document.querySelectorAll('.cat')];
    const status = document.getElementById('results-status');
    const empty = document.getElementById('empty');
    const toolbar = document.querySelector('.toolbar');
    const norm = (s) => s.toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();
    const haystack = new Map(cards.map((c) => [c, norm(c.dataset.search || c.textContent)]));
    let cat = 'all';

    const params = new URLSearchParams(location.search);
    if (params.get('q')) input.value = params.get('q');
    if (params.get('c') && chips.some((c) => c.dataset.cat === params.get('c'))) cat = params.get('c');

    function apply({ fromUser = false } = {}) {
      const q = norm(input.value);
      const terms = q ? q.split(' ') : [];
      box.classList.toggle('has-value', !!input.value);
      let shown = 0;
      const perCat = {};
      for (const card of cards) {
        const text = haystack.get(card);
        const matchQ = terms.every((t) => text.includes(t));
        perCat[card.dataset.cat] = (perCat[card.dataset.cat] || 0) + (matchQ ? 1 : 0);
        const ok = matchQ && (cat === 'all' || card.dataset.cat === cat);
        card.hidden = !ok;
        if (ok) { shown++; card.classList.add('in'); }
      }
      for (const s of sections) {
        const n = s.querySelectorAll('.card:not([hidden])').length;
        s.hidden = n === 0;
        const count = s.querySelector('.count');
        if (count) count.textContent = `${n} 项`;
      }
      for (const chip of chips) {
        chip.setAttribute('aria-pressed', String(chip.dataset.cat === cat));
        const n = chip.querySelector('.n');
        if (n) n.textContent = chip.dataset.cat === 'all' ? Object.values(perCat).reduce((a, b) => a + b, 0) : (perCat[chip.dataset.cat] || 0);
      }
      empty.classList.toggle('show', shown === 0);
      status.textContent = terms.length || cat !== 'all'
        ? `找到 ${shown} 个项目${terms.length ? `，关键词“${input.value.trim()}”` : ''}`
        : `共 ${cards.length} 个项目，按类别浏览或输入关键词搜索`;
      const next = new URLSearchParams();
      if (input.value.trim()) next.set('q', input.value.trim());
      if (cat !== 'all') next.set('c', cat);
      const qs = next.toString();
      history.replaceState(null, '', (qs ? `?${qs}` : location.pathname) + location.hash);
      if (fromUser) keepResultsInView();
    }

    // After filtering, bring the top of the results under the sticky bars if the user scrolled past them.
    function keepResultsInView() {
      const anchor = document.getElementById('projects');
      const offset = (toolbar?.getBoundingClientRect().bottom || 0) + 4;
      const top = anchor.getBoundingClientRect().top;
      if (top < offset - 1) scrollTo({ top: scrollY + top - offset, behavior: reduce ? 'auto' : 'smooth' });
    }

    input.addEventListener('input', () => apply({ fromUser: true }));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { input.value = ''; apply(); input.blur(); }
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); keepResultsInView(); }
    });
    box.querySelector('.clear').addEventListener('click', () => { input.value = ''; apply(); input.focus(); });
    for (const chip of chips) chip.addEventListener('click', () => {
      cat = chip.dataset.cat;
      apply({ fromUser: true });
      chip.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    });
    document.getElementById('reset')?.addEventListener('click', () => { input.value = ''; cat = 'all'; apply({ fromUser: true }); });
    // Header links jump to a category: make sure a previous filter does not hide it.
    for (const a of document.querySelectorAll('a[data-jump]')) a.addEventListener('click', () => {
      if (cat !== 'all' || input.value) { input.value = ''; cat = 'all'; apply(); }
    });
    addEventListener('keydown', (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
      if ((e.key === '/' && !typing) || (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        input.focus({ preventScroll: true });
        input.select();
        keepResultsInView();
      }
    });
    apply();
  }

  function initFilm() {
    const video = document.querySelector('.player video');
    const dataEl = document.getElementById('film-data');
    if (!video || !dataEl) return;
    const versions = JSON.parse(dataEl.textContent);
    const buttons = [...document.querySelectorAll('.seg button')];
    const lists = [...document.querySelectorAll('.chapters')];
    const noteEl = document.querySelector('.version-note');
    const durEl = document.querySelector('[data-duration]');
    let active = versions[0].id;

    function select(id, { keepTime = false } = {}) {
      const v = versions.find((x) => x.id === id) || versions[0];
      if (v.id !== active || !video.currentSrc) {
        const wasPlaying = !video.paused;
        const t = keepTime ? video.currentTime : 0;
        video.src = v.src;
        video.load();
        if (t) video.currentTime = t;
        if (wasPlaying) video.play().catch(() => {});
      }
      active = v.id;
      for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset.v === v.id));
      for (const l of lists) l.hidden = l.dataset.v !== v.id;
      if (noteEl) noteEl.textContent = v.note || '';
      if (durEl) durEl.textContent = v.duration;
      const url = new URL(location.href);
      if (v.id === versions[0].id) url.searchParams.delete('v'); else url.searchParams.set('v', v.id);
      history.replaceState(null, '', url);
    }
    for (const b of buttons) b.addEventListener('click', () => select(b.dataset.v));
    const want = new URLSearchParams(location.search).get('v');
    if (want && want !== active && versions.some((v) => v.id === want)) select(want);

    for (const l of lists) l.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-t]');
      if (!btn) return;
      video.currentTime = Number(btn.dataset.t);
      mark();
      video.play().catch(() => {});
      video.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    });
    const mark = () => {
      const list = lists.find((l) => !l.hidden);
      if (!list) return;
      const items = [...list.querySelectorAll('li')];
      let cur = -1;
      items.forEach((li, i) => { if (Number(li.querySelector('button').dataset.t) <= video.currentTime + 0.25) cur = i; });
      items.forEach((li, i) => li.classList.toggle('current', i === cur));
    };
    video.addEventListener('timeupdate', mark);
    video.addEventListener('seeked', mark);
  }
})();
