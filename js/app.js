/* Shared course behavior. The V1 storage key and exercise identifiers are retained. */
(function () {
  'use strict';
  const DAY = Number(document.body.dataset.day || 0);
  const KEY = 'bisp-langgraph-v1';
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  let memoryState = {};
  const read = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || JSON.stringify(memoryState));
      const s = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
      s.completed = [...new Set((Array.isArray(s.completed) ? s.completed : []).filter(n => Number.isInteger(n) && n > 0 && n <= 25))];
      s.exercises = s.exercises && typeof s.exercises === 'object' ? s.exercises : {};
      s.last = Number.isInteger(s.last) && s.last > 0 && s.last <= 25 ? s.last : 0;
      return s;
    } catch (_) { return Object.assign({ completed: [], exercises: {}, last: 0 }, memoryState); }
  };
  const save = state => { state.updatedAt = Date.now(); memoryState = state; try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) { /* Keep progress for the current page if persistent storage is unavailable. */ } };
  // Browsers can isolate localStorage by file URL. Carry only course progress
  // through ordinary local HTML links so double-click navigation still works.
  const portable = location.protocol === 'file:';
  if (portable) {
    try {
      const incoming = JSON.parse(new URLSearchParams(location.search).get('bisp_progress') || 'null');
      const local = read();
      if (incoming && typeof incoming === 'object' && Number.isFinite(incoming.updatedAt) && incoming.updatedAt > (local.updatedAt || 0)) {
        const completed = [...new Set((Array.isArray(incoming.completed) ? incoming.completed : []).filter(n => Number.isInteger(n) && n >= 1 && n <= 25))];
        const exercises = {};
        Object.entries(incoming.exercises || {}).slice(0, 200).forEach(([key, value]) => { if (/^[a-zA-Z0-9_.-]{1,80}$/.test(key) && typeof value === 'boolean') exercises[key] = value; });
        const last = Number.isInteger(incoming.last) && incoming.last >= 1 && incoming.last <= 25 ? incoming.last : 0;
        save({completed,exercises,last});
      }
    } catch (_) { /* Ignore malformed or unrelated URL data. */ }
  }
  function carryProgress() {
    if (!portable) return;
    const state = read();
    const payload = JSON.stringify({completed:state.completed,exercises:state.exercises,last:state.last,updatedAt:state.updatedAt || 0});
    $$('a[href]').forEach(a => {
      const raw = a.getAttribute('href');
      if (raw.startsWith('#')) return;
      try {
        const url = new URL(raw, location.href);
        if (url.protocol !== 'file:' || !/(?:index|day-\d{2})\.html$/.test(url.pathname)) return;
        url.searchParams.set('bisp_progress', payload);
        // Keep a relative filename/path and the normal section fragment.
        a.setAttribute('href', raw.split(/[?#]/)[0] + url.search + url.hash);
      } catch (_) {}
    });
  }
  function paint() {
    const s = read(), completed = s.completed;
    $$('[data-day-link]').forEach(el => {
      const d = Number(el.dataset.dayLink), done = completed.includes(d);
      el.classList.toggle('completed', done);
      const n = $('.num', el); if (n) n.textContent = done ? '✓' : String(d).padStart(2, '0');
      if (d === DAY) el.setAttribute('aria-current', 'page');
      if (done) el.setAttribute('aria-label', 'Completed: ' + el.textContent.trim().replace(/^✓/, '').trim());
      else el.removeAttribute('aria-label');
    });
    $$('[data-progress]').forEach(el => el.textContent = completed.length);
    $$('[data-percent]').forEach(el => el.textContent = Math.round(completed.length / 25 * 100));
    $$('[data-progressbar]').forEach(el => el.style.width = completed.length / 25 * 100 + '%');
    $$('[data-mark]').forEach(mark => { const done = completed.includes(DAY); mark.textContent = done ? '✓ Lesson completed' : 'Mark lesson complete'; mark.setAttribute('aria-pressed', String(done)); });
    $$('[data-resume]').forEach(el => el.href = (DAY ? '' : 'lessons/') + 'day-' + String(s.last || 1).padStart(2, '0') + '.html');
    const banner = $('[data-continue]'); if (banner) banner.hidden = !s.last;
    const last = $('[data-last-title]');
    if (last && s.last) { const a = $('[data-day-link="' + s.last + '"]'); last.textContent = 'Day ' + String(s.last).padStart(2, '0') + ' · ' + (a ? a.textContent.replace(/^(✓|\d+)\s*/, '').trim() : 'Continue your lesson'); }
    $$('[data-module-progress]').forEach(el => {
      const [start, end] = el.dataset.moduleProgress.split('-').map(Number);
      const count = completed.filter(d => d >= start && d <= end).length;
      $('[data-module-count]', el).textContent = count + ' / ' + (end - start + 1) + ' complete';
      $('[data-module-bar]', el).style.width = count / (end - start + 1) * 100 + '%';
    });
    $$('.exercise').forEach(updateExercise);
    carryProgress();
  }
  function updateExercise(ex) {
    const checks = $$('[data-exercise-check]', ex), status = $('[data-exercise-status]', ex);
    if (status) status.textContent = checks.filter(c => c.checked).length + ' / ' + checks.length + ' checked';
  }
  if (DAY) { const s = read(); s.last = DAY; save(s); }
  $$('[data-exercise-check]').forEach(input => {
    input.checked = !!read().exercises[input.dataset.exerciseCheck];
    input.addEventListener('change', () => { const s = read(); s.exercises[input.dataset.exerciseCheck] = input.checked; save(s); carryProgress(); const ex = input.closest('.exercise'); if (ex) updateExercise(ex); });
  });
  paint();
  $$('[data-mark]').forEach(b => b.addEventListener('click', () => {
    const s = read(), done = new Set(s.completed);
    done.has(DAY) ? done.delete(DAY) : done.add(DAY);
    s.completed = [...done].sort((a, b) => a - b); save(s); paint();
  }));
  $$('[data-reset-progress]').forEach(b => b.addEventListener('click', () => {
    if (confirm('Reset all lesson and exercise progress saved in this browser? This cannot be undone.')) {
      save({completed:[],exercises:{},last:0}); location.reload();
    }
  }));
  window.addEventListener('storage', event => {
    if (event.key === KEY || event.key === null) {
      $$('[data-exercise-check]').forEach(input => input.checked = !!read().exercises[input.dataset.exerciseCheck]); paint();
    }
  });
  // Local Python highlighting: text tokens only, no third-party library or innerHTML.
  function highlight(code) {
    const source = code.textContent;
    const tokens = /#[^\n]*|"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:from|import|def|class|return|if|else|elif|for|while|in|is|not|and|or|try|except|raise|with|as|True|False|None|pass|assert|lambda)\b|\b(?:print|str|dict|list|int|bool|len|range|ValueError|NotImplementedError)\b|\b\d+(?:\.\d+)?\b/g;
    const frag = document.createDocumentFragment(); let cursor = 0;
    for (const match of source.matchAll(tokens)) {
      frag.append(document.createTextNode(source.slice(cursor, match.index)));
      const span = document.createElement('span'), t = match[0];
      span.className = t[0] === '#' ? 'comment' : /^['"]/.test(t) ? 'str' : /^\d/.test(t) ? 'number' : /^(print|str|dict|list|int|bool|len|range|ValueError|NotImplementedError)$/.test(t) ? 'builtin' : 'kw';
      span.textContent = t; frag.append(span); cursor = match.index + t.length;
    }
    frag.append(document.createTextNode(source.slice(cursor))); code.replaceChildren(frag);
  }
  $$('.codeblock pre code').forEach(highlight);
  $$('[data-copy]').forEach(b => b.addEventListener('click', async () => {
    const code = document.getElementById(b.dataset.copy); if (!code) return;
    const t = code.textContent;
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(t); b.textContent = '✓ Copied';
    } catch (_) {
      const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.top = '-9999px'; document.body.append(ta); ta.select();
      try { b.textContent = document.execCommand('copy') ? '✓ Copied' : 'Select code to copy'; } catch (_) { b.textContent = 'Select code to copy'; }
      ta.remove(); b.focus();
    }
    b.setAttribute('aria-live', 'polite');
  }));
  $$('[data-quiz]').forEach(q => {
    const choices = $$('[data-choice]', q), correct = Number(q.dataset.answer);
    choices.forEach(ch => ch.addEventListener('click', () => {
      const good = Number(ch.dataset.choice) === correct;
      choices.forEach(x => { x.disabled = true; x.classList.toggle('good', Number(x.dataset.choice) === correct); x.setAttribute('aria-pressed', String(x === ch)); });
      ch.classList.toggle('bad', !good);
      $('.feedback', q).textContent = (good ? 'Correct. ' : 'Not quite. ') + q.dataset.explanation;
      $('[data-retry]', q).focus();
    }));
    $('[data-retry]', q)?.addEventListener('click', () => { choices.forEach(x => { x.disabled = false; x.classList.remove('good', 'bad'); x.removeAttribute('aria-pressed'); }); $('.feedback', q).textContent = ''; choices[0]?.focus(); });
  });
  // Preserve existing diagrams on the 22 retained lesson pages.
  $$('[data-flow]').forEach(panel => {
    const nodes = $$('.flow-node', panel), status = $('.diagram-status', panel); let index = -1;
    function show() { nodes.forEach((n, i) => { n.classList.toggle('active', i === index); n.classList.toggle('done', i < index); }); status.textContent = index < 0 ? 'Choose Next step to explore the flow.' : nodes[index]?.dataset.desc || ''; }
    $('[data-next-step]', panel)?.addEventListener('click', () => { index = (index + 1) % nodes.length; show(); });
    $('[data-reset-step]', panel)?.addEventListener('click', () => { index = -1; show(); });
    nodes.forEach((node, i) => { node.setAttribute('role', 'button'); node.setAttribute('tabindex', '0'); node.setAttribute('aria-label', 'Inspect ' + node.textContent); const select = () => { index = i; show(); }; node.addEventListener('click', select); node.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); } }); }); show();
  });
  // Course path: open the current module, preserve every standard lesson URL.
  const side = $('.sidebar'), overlay = $('.overlay'), main = $('.main'), mobile = matchMedia('(max-width:900px)');
  if (side) {
    const close = document.createElement('button'); close.className = 'btn small ghost drawer-close'; close.setAttribute('aria-label', 'Close course menu'); close.textContent = '×'; close.addEventListener('click', () => toggle(false)); side.prepend(close);
    const brand = $('.brand', side);
    if (brand) { const p = document.createElement('div'); p.className = 'sidebar-course'; const cap = document.createElement('small'); cap.textContent = 'YOUR LEARNING STUDIO'; p.append(cap, document.createTextNode('LangGraph for Oracle EPM Planning Automation')); brand.after(p); }
    const back = document.createElement('a'); back.href = DAY ? '../index.html' : 'index.html'; back.className = 'sidebar-home'; back.textContent = '← Back to course home'; side.append(back);
  }
  $$('[data-module-toggle]').forEach((b, i) => {
    const p = b.nextElementSibling; if (!p) return;
    p.id = 'module-lessons-' + (i + 1); b.setAttribute('aria-controls', p.id);
    const active = !!$('.side-day.active', p); p.hidden = !active; b.setAttribute('aria-expanded', String(active));
    b.addEventListener('click', () => { p.hidden = !p.hidden; b.setAttribute('aria-expanded', String(!p.hidden)); });
  });
  let returnFocus = null;
  const menu = $('[data-menu]');
  function toggle(open) {
    if (!side) return;
    if (open && !mobile.matches) return;
    side.classList.toggle('open', open); overlay?.classList.toggle('open', open);
    menu?.setAttribute('aria-expanded', String(open));
    if (main) main.inert = open;
    side.inert = mobile.matches && !open;
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) { returnFocus = document.activeElement; ($('.active', side) || $('a,button', side))?.focus({preventScroll:true}); }
    else if (returnFocus) { returnFocus.focus({preventScroll:true}); returnFocus = null; }
  }
  if (side) { side.id = 'course-navigation'; side.inert = mobile.matches; }
  if (menu) { menu.setAttribute('aria-controls', 'course-navigation'); menu.setAttribute('aria-expanded', 'false'); menu.addEventListener('click', () => toggle(!side.classList.contains('open'))); }
  overlay?.addEventListener('click', () => toggle(false));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') toggle(false);
    if (e.key === 'Tab' && side?.classList.contains('open')) {
      const elements = $$('a, button', side).filter(el => !el.closest('[hidden]'));
      const first = elements[0], last = elements[elements.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  mobile.addEventListener('change', () => toggle(false));
  carryProgress();
  // Search indexes existing static anchors; results always use real course links.
  const search = $('[data-search]');
  if (search) {
    const links = $$('[data-day-link]').map(a => ({href:a.getAttribute('href'), label:'Day ' + String(a.dataset.dayLink).padStart(2,'0') + ' · ' + a.textContent.replace(/^(✓|\d+)\s*/, '').trim()}));
    search.addEventListener('input', () => {
      const query = search.value.toLowerCase().trim(), box = $('[data-search-results]'); box.replaceChildren(); if (!query) return;
      const matches = links.filter(a => a.label.toLowerCase().includes(query));
      matches.forEach(a => { const el = document.createElement('a'); el.href = a.href; el.textContent = a.label; box.append(el); });
      if (!matches.length) box.textContent = 'No matching lessons. Try another topic.';
      carryProgress();
    });
  }
  if ('IntersectionObserver' in window) {
    const toc = $$('.toc a');
    const observer = new IntersectionObserver(entries => { entries.forEach(entry => { if (entry.isIntersecting) toc.forEach(a => a.setAttribute('aria-current', String(a.getAttribute('href') === '#' + entry.target.id))); }); }, {rootMargin:'-125px 0px -60% 0px', threshold:0});
    $$('.section[id]').forEach(s => observer.observe(s));
  }
  $$('[data-source-exercise]').forEach(el => {
    const files = (window.BISP_SOURCE_LINKS || {})[el.dataset.sourceExercise]; if (!files) return;
    const valid = ['starter','solution','readme'].filter(k => { try { const u = new URL(files[k]); return u.protocol === 'https:' && u.hostname === 'github.com'; } catch (_) { return false; } });
    if (valid.length !== 3) return;
    el.replaceChildren(); valid.forEach(k => { const a = document.createElement('a'); a.href = files[k]; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = ({starter:'Starter Code',solution:'Solution',readme:'README'})[k] + ' ↗'; el.append(a); });
  });
})();
