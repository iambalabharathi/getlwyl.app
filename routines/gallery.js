// Routines & Plans: the program library — search with suggestions, filters,
// cards, a details sheet (week plan and workouts) and download — plus the
// AI prompt's Copy button. Programs come from /routines/programs/, built
// from the lwyl-routines repo by scripts/publish.py. The search and filters
// live in the address (?q=&goal=&level=&equipment=&exercise=&program=).
(function () {
  var LABELS = {
    goal: { strength: 'Strength', muscle: 'Muscle', 'fat-loss': 'Fat loss', general: 'General fitness', running: 'Running', mobility: 'Mobility' },
    level: { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' },
    equipment: { gym: 'Gym', barbell: 'Barbell', dumbbells: 'Dumbbells', kettlebell: 'Kettlebell', bodyweight: 'No equipment',
                 bands: 'Bands', 'pull-up-bar': 'Pull-up bar', 'cardio-machine': 'Cardio machine' }
  };
  var KEY_NAMES = { goal: 'Goal', level: 'Level', equipment: 'Equipment' };
  var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  var state = { q: '', goal: null, level: null, equipment: null, exercise: null };
  var programs = [];
  var cache = {};

  var list = document.getElementById('programs');
  var input = document.getElementById('search-input');
  var box = document.getElementById('suggestions');
  var count = document.getElementById('result-count');
  var clearButton = document.getElementById('clear');
  var hint = document.getElementById('browse');
  var sheet = document.getElementById('details');
  var sheetBody = document.getElementById('details-body');

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  // ---- Search ------------------------------------------------------------
  // Lower case, no accents, words only. "Run/Walk to 5K" → run walk to 5k.
  function norm(s) {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function words(s) { var n = norm(s); return n ? n.split(' ') : []; }

  // At most one edit apart (typo tolerance), for words of 4+ letters.
  function nearlyEqual(a, b) {
    if (Math.abs(a.length - b.length) > 1) return false;
    var i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
    }
    return edits + (a.length - i) + (b.length - j) <= 1;
  }

  // How well one typed word matches a list of words: 1 starts a word,
  // 0.7 inside a word, 0.5 a near miss ("kettlebel", "dumbell").
  function wordScore(token, ws) {
    var best = 0;
    for (var i = 0; i < ws.length; i++) {
      var w = ws[i];
      if (w.indexOf(token) === 0) return 1;
      if (token.length >= 3 && w.indexOf(token) > 0) best = Math.max(best, 0.7);
      else if (token.length >= 4 && (nearlyEqual(token, w) || nearlyEqual(token, w.slice(0, token.length)))) best = Math.max(best, 0.5);
    }
    return best;
  }

  function index(p) {
    var labels = [LABELS.goal[p.goal], LABELS.level[p.level]].concat(p.equipment.map(function (e) { return LABELS.equipment[e]; }));
    p._fields = [
      { w: 5, words: words(p.title) },
      { w: 3, words: words(labels.join(' ')) },
      { w: 2, words: words(p.routineNames.join(' ')) },
      { w: 2, words: words(p.exercises.join(' ')) },
      { w: 1, words: words(p.summary) }
    ];
  }

  // Every typed word has to match somewhere; better and earlier fields score higher.
  function score(p, tokens) {
    var total = 0;
    for (var i = 0; i < tokens.length; i++) {
      var best = 0;
      for (var f = 0; f < p._fields.length; f++) {
        best = Math.max(best, p._fields[f].w * wordScore(tokens[i], p._fields[f].words));
      }
      if (!best) return 0;
      total += best;
    }
    return total;
  }

  function matchesFilters(p) {
    return (!state.goal || p.goal === state.goal)
      && (!state.level || p.level === state.level)
      && (!state.equipment || p.equipment.indexOf(state.equipment) >= 0)
      && (!state.exercise || p.exercises.indexOf(state.exercise) >= 0);
  }

  function results() {
    var tokens = words(state.q);
    var shown = programs.filter(matchesFilters);
    if (!tokens.length) return shown;
    return shown.map(function (p) { return { p: p, s: score(p, tokens) }; })
      .filter(function (r) { return r.s > 0; })
      .sort(function (a, b) { return b.s - a.s; })
      .map(function (r) { return r.p; });
  }

  // Text with the words that start with a typed word in bold.
  function highlighted(text, tokens) {
    var span = el('span');
    text.split(/(\s+|[\/\-–·(),])/).forEach(function (part) {
      var n = norm(part);
      var hit = n && tokens.some(function (t) { return n.indexOf(t) === 0; });
      span.appendChild(hit ? el('b', null, part) : document.createTextNode(part));
    });
    return span;
  }

  // ---- Filters: chips inside the search bar ---------------------------------
  // Chosen filters, in the order they were added (Backspace removes the last).
  var chosen = [];
  var chipBox = document.getElementById('chips');
  var field = document.getElementById('search-field');
  var picks = document.getElementById('quick-picks');

  function chipLabel(key) { return key === 'exercise' ? state.exercise : LABELS[key][state[key]]; }

  function setFilter(key, value) {
    state[key] = value;
    chosen = chosen.filter(function (k) { return k !== key; });
    if (value) chosen.push(key);
    state.q = '';
    input.value = '';
    update();
  }

  function renderChips() {
    chosen = chosen.filter(function (k) { return state[k]; });
    ['goal', 'level', 'equipment', 'exercise'].forEach(function (k) { if (state[k] && chosen.indexOf(k) < 0) chosen.push(k); });
    chipBox.innerHTML = '';
    chosen.forEach(function (key) {
      var chip = el('span', 'token');
      chip.appendChild(el('span', null, chipLabel(key)));
      var x = el('button', 'token-remove', '✕');
      x.type = 'button';
      x.setAttribute('aria-label', 'Remove ' + chipLabel(key));
      x.addEventListener('mousedown', function (e) { e.preventDefault(); });
      x.addEventListener('click', function (e) { e.stopPropagation(); setFilter(key, null); input.focus(); });
      chip.appendChild(x);
      chipBox.appendChild(chip);
    });
    input.placeholder = chosen.length ? 'Add more…' : 'Search programs or exercises';
    field.classList.toggle('has-chips', chosen.length > 0);
    clearButton.hidden = !(state.q || chosen.length);
    // Quick picks: hide the ones already chosen.
    picks.querySelectorAll('button').forEach(function (b) { b.hidden = state[b.dataset.key] === b.dataset.value; });
    picks.hidden = !picks.querySelector('button:not([hidden])');
  }

  field.addEventListener('click', function (e) { if (e.target === field || e.target === chipBox) input.focus(); });
  picks.querySelectorAll('button').forEach(function (b) {
    b.addEventListener('click', function () { setFilter(b.dataset.key, b.dataset.value); });
  });
  clearButton.addEventListener('click', function () {
    state = { q: '', goal: null, level: null, equipment: null, exercise: null };
    chosen = [];
    input.value = '';
    update();
  });

  // ---- Suggestions -----------------------------------------------------------
  var options = [];
  var active = -1;

  // How many programs a filter would leave, with the other filters kept.
  function countWith(key, value) {
    var saved = state[key];
    state[key] = value;
    var n = programs.filter(matchesFilters).length;
    state[key] = saved;
    return n;
  }

  function filterItem(key, value, withKey) {
    var n = countWith(key, value);
    if (!n) return null;
    return { label: (withKey ? KEY_NAMES[key] + ': ' : '') + LABELS[key][value], note: plural(n, 'program', 'programs'),
             run: function () { setFilter(key, value); } };
  }

  function suggestions() {
    var tokens = words(state.q);
    var groups = [];

    // Empty box: every filter, to browse without typing.
    if (!tokens.length) {
      Object.keys(LABELS).forEach(function (key) {
        var items = Object.keys(LABELS[key]).filter(function (v) { return state[key] !== v; })
          .map(function (v) { return filterItem(key, v, false); }).filter(Boolean);
        if (items.length) groups.push({ title: KEY_NAMES[key], items: items });
      });
      return groups;
    }

    var progs = results().slice(0, 4);
    if (progs.length) groups.push({ title: 'Programs', items: progs.map(function (p) {
      return { label: p.title, note: LABELS.level[p.level] + ' · ' + plural(p.weeks, 'week', 'weeks'), run: function () { openDetails(p.id); } };
    }) });

    var filters = [];
    Object.keys(LABELS).forEach(function (key) {
      Object.keys(LABELS[key]).forEach(function (value) {
        var ws = words(LABELS[key][value]);
        if (state[key] === value || !tokens.every(function (t) { return wordScore(t, ws) >= 0.5; })) return;
        var item = filterItem(key, value, true);
        if (item) filters.push(item);
      });
    });
    if (filters.length) groups.push({ title: 'Filters', items: filters.slice(0, 3) });

    var uses = {};
    programs.filter(matchesFilters).forEach(function (p) { p.exercises.forEach(function (e) { uses[e] = (uses[e] || 0) + 1; }); });
    var exercises = Object.keys(uses).filter(function (e) {
      var ws = words(e);
      return e !== state.exercise && tokens.every(function (t) { return wordScore(t, ws) >= 0.5; });
    }).sort(function (a, b) { return uses[b] - uses[a] || a.localeCompare(b); }).slice(0, 4);
    if (exercises.length) groups.push({ title: 'Exercises', items: exercises.map(function (e) {
      return { label: e, note: plural(uses[e], 'program', 'programs'), run: function () { setFilter('exercise', e); } };
    }) });
    return groups;
  }

  function showSuggestions() {
    var tokens = words(state.q);
    var groups = suggestions();
    box.innerHTML = '';
    options = [];
    active = -1;
    input.removeAttribute('aria-activedescendant');
    if (document.activeElement !== input) { hideSuggestions(); return; }
    if (!groups.length) {
      if (!tokens.length) { hideSuggestions(); return; }
      box.appendChild(el('div', 'suggest-empty', 'No matches — try another word.'));
    }
    groups.forEach(function (g) {
      box.appendChild(el('div', 'suggest-group', g.title));
      g.items.forEach(function (item) {
        var o = el('div', 'suggest');
        o.id = 'suggest-' + options.length;
        o.setAttribute('role', 'option');
        o.setAttribute('aria-selected', 'false');
        o.appendChild(highlighted(item.label, tokens));
        o.appendChild(el('small', null, item.note));
        o.addEventListener('mousedown', function (e) { e.preventDefault(); });   // keep focus in the box
        o.addEventListener('click', function () { choose(options.indexOf(item)); });
        box.appendChild(o);
        item.node = o;
        options.push(item);
      });
    });
    box.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function hideSuggestions() {
    box.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  }

  function highlight(i) {
    if (active >= 0 && options[active]) options[active].node.setAttribute('aria-selected', 'false');
    active = i;
    if (i < 0) { input.removeAttribute('aria-activedescendant'); return; }
    var node = options[i].node;
    node.setAttribute('aria-selected', 'true');
    input.setAttribute('aria-activedescendant', node.id);
    node.scrollIntoView({ block: 'nearest' });
  }

  function choose(i) {
    var item = options[i];
    hideSuggestions();
    if (item) item.run();
    if (document.activeElement === input) showSuggestions();   // keep adding filters
  }

  input.addEventListener('input', function () {
    state.q = input.value;
    render();
    syncURL();
    showSuggestions();
  });
  input.addEventListener('focus', function () {
    // Phones: lift the bar to the top so the keyboard doesn't hide the suggestions.
    if (window.matchMedia('(max-width: 600px)').matches) field.scrollIntoView({ block: 'start', behavior: 'smooth' });
    showSuggestions();
  });
  input.addEventListener('blur', function () { setTimeout(hideSuggestions, 0); });
  input.addEventListener('keydown', function (e) {
    var open = !box.hidden && options.length;
    if (e.key === 'ArrowDown' && open) { e.preventDefault(); highlight((active + 1) % options.length); }
    else if (e.key === 'ArrowUp' && open) { e.preventDefault(); highlight(active <= 0 ? options.length - 1 : active - 1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && active >= 0) choose(active);
      else { hideSuggestions(); input.blur(); }   // the cards below already show the results
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (!box.hidden) hideSuggestions();
      else if (input.value) { input.value = ''; state.q = ''; update(); }
    } else if (e.key === 'Backspace' && !input.value && chosen.length) {
      e.preventDefault();
      setFilter(chosen[chosen.length - 1], null);
      showSuggestions();
    }
  });

  // ---- Cards -------------------------------------------------------------------
  function meta(p) {
    return plural(p.daysPerWeek, 'day', 'days') + ' a week · ' + plural(p.weeks, 'week', 'weeks') + ' · ' +
      p.equipment.map(function (e) { return LABELS.equipment[e]; }).join(', ');
  }

  function downloadButton(p) {
    var b = el('button', 'program-download', 'Download');
    b.type = 'button';
    b.addEventListener('click', function (e) { e.stopPropagation(); download(p.id, b); });
    return b;
  }

  function render() {
    var shown = results();
    var tokens = words(state.q);
    list.innerHTML = '';
    count.textContent = plural(shown.length, 'program', 'programs');
    hint.textContent = !shown.length ? 'No programs match'
      : (shown.length === programs.length ? 'Browse all ' : 'See ') + plural(shown.length, 'program', 'programs') + ' ↓';
    renderChips();
    if (!shown.length) {
      list.appendChild(el('p', 'muted small', 'No programs match — try fewer words or clear the filters.'));
      return;
    }
    shown.forEach(function (p) {
      var card = el('article', 'program');
      card.tabIndex = 0;
      card.setAttribute('aria-label', p.title + ', ' + LABELS.level[p.level] + ' ' + LABELS.goal[p.goal] + '. Show details');
      card.appendChild(el('p', 'program-eyebrow', LABELS.level[p.level] + ' · ' + LABELS.goal[p.goal]));
      var title = el('h3', 'program-title');
      title.appendChild(tokens.length ? highlighted(p.title, tokens) : document.createTextNode(p.title));
      card.appendChild(title);
      card.appendChild(el('p', 'program-summary', p.summary));
      card.appendChild(el('p', 'program-meta', meta(p)));
      var actions = el('div', 'program-actions');
      actions.appendChild(downloadButton(p));
      actions.appendChild(el('span', 'program-more', 'See the plan →'));
      card.appendChild(actions);
      card.addEventListener('click', function () { openDetails(p.id); });
      card.addEventListener('keydown', function (e) {
        if (e.target === card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openDetails(p.id); }
      });
      list.appendChild(card);
    });
  }

  function update() {
    render();
    syncURL();
  }

  // ---- Address -----------------------------------------------------------------
  var openId = null;

  function syncURL() {
    var params = new URLSearchParams();
    if (state.q.trim()) params.set('q', state.q.trim());
    ['goal', 'level', 'equipment', 'exercise'].forEach(function (k) { if (state[k]) params.set(k, state[k]); });
    if (openId) params.set('program', openId);
    var query = params.toString();
    history.replaceState(null, '', location.pathname + (query ? '?' + query : '') + location.hash);
  }

  function readURL() {
    var params = new URLSearchParams(location.search);
    state.q = params.get('q') || '';
    input.value = state.q;
    ['goal', 'level', 'equipment'].forEach(function (k) {
      var v = params.get(k);
      state[k] = v && LABELS[k][v] ? v : null;
    });
    var ex = params.get('exercise');
    state.exercise = ex && programs.some(function (p) { return p.exercises.indexOf(ex) >= 0; }) ? ex : null;
    return params.get('program');
  }

  // ---- Details sheet -------------------------------------------------------------
  function loadProgram(id) {
    if (!cache[id]) {
      cache[id] = fetch('/routines/programs/' + id + '.json?v=2').then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      }).catch(function (e) { delete cache[id]; throw e; });
    }
    return cache[id];
  }

  // "1–4, 6, 8–10"
  function ranges(ns) {
    var out = [], i = 0;
    while (i < ns.length) {
      var j = i;
      while (j + 1 < ns.length && ns[j + 1] === ns[j] + 1) j++;
      out.push(j > i ? ns[i] + '–' + ns[j] : String(ns[i]));
      i = j + 1;
    }
    return out.join(', ');
  }

  // Weeks with the same days and workouts, grouped: [{ weeks: [1, 3, …], days: [name|null × 7] }]
  function weekPlans(p) {
    var groups = {}, order = [];
    for (var w = 1; w <= p.weeks; w++) {
      var days = [null, null, null, null, null, null, null];
      p.pattern.forEach(function (entry) {
        if (!entry.weeks || entry.weeks.indexOf(w) >= 0) days[entry.weekday - 1] = entry.routine;
      });
      var key = JSON.stringify(days);
      if (!groups[key]) { groups[key] = { weeks: [], days: days }; order.push(key); }
      groups[key].weeks.push(w);
    }
    return order.map(function (k) { return groups[k]; });
  }

  function duration(s) {
    if (s >= 60 && s % 60 === 0) return (s / 60) + ' min';
    if (s > 60) return Math.floor(s / 60) + ' min ' + (s % 60) + ' s';
    return s + ' s';
  }

  // "5 × 5 · 20 kg", "3 × 45 s", "5 km", "8 × 1 km", "4 sets · 8–12 reps"
  function setSummary(sets, unit) {
    var list = Array.isArray(sets) ? sets : Array.apply(null, Array(sets.count || 1)).map(function () { return sets; });
    var n = list.length;
    var kind = list[0].km != null ? 'km' : list[0].seconds != null ? 'seconds' : 'reps';
    var values = list.map(function (s) { return s[kind]; });
    var lo = Math.min.apply(null, values), hi = Math.max.apply(null, values);
    var one = function (v) { return kind === 'km' ? v + ' km' : kind === 'seconds' ? duration(v) : v; };
    var text;
    if (lo === hi) {
      text = n === 1 && kind !== 'reps' ? one(lo) : n + ' × ' + one(lo);
    } else {
      text = n + ' sets · ' + (kind === 'km' ? lo + '–' + hi + ' km' : kind === 'seconds' ? duration(lo) + '–' + duration(hi) : lo + '–' + hi + ' reps');
    }
    var weights = list.map(function (s) { return s.weight || 0; }).filter(Boolean);
    if (weights.length) {
      var wl = Math.min.apply(null, weights), wh = Math.max.apply(null, weights);
      text += ' · ' + (wl === wh ? wl : wl + '–' + wh) + ' ' + unit;
    }
    return text;
  }

  function openDetails(id) {
    var summary = programs.filter(function (p) { return p.id === id; })[0];
    if (!summary) return;
    openId = id;
    syncURL();
    sheetBody.innerHTML = '';
    var close = el('button', 'sheet-close', '✕');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    close.addEventListener('click', function () { sheet.close(); });
    sheetBody.appendChild(close);
    sheetBody.appendChild(el('p', 'program-eyebrow', LABELS.level[summary.level] + ' · ' + LABELS.goal[summary.goal]));
    var h = el('h2', null, summary.title);
    h.id = 'details-title';
    sheetBody.appendChild(h);
    sheetBody.appendChild(el('p', 'program-summary', summary.summary));
    sheetBody.appendChild(el('p', 'program-meta', meta(summary)));
    sheetBody.appendChild(downloadButton(summary));
    var more = el('div');
    more.appendChild(el('p', 'muted small', 'Loading the plan…'));
    sheetBody.appendChild(more);
    if (!sheet.open) sheet.showModal();
    sheetBody.focus({ preventScroll: true });
    sheetBody.scrollTop = 0;
    sheet.scrollTop = 0;

    loadProgram(id).then(function (p) {
      if (openId !== id) return;
      more.innerHTML = '';
      var letters = {};
      p.templates.forEach(function (t, i) { letters[t.name] = String.fromCharCode(65 + i); });
      var lettered = p.templates.length > 1;

      more.appendChild(el('h3', null, 'Your week'));
      var plans = weekPlans(p);
      // Progressions (one workout per stage, same days): one week, no letters.
      var staged = plans.length > 1 && plans.every(function (plan) {
        var on = plan.days.filter(Boolean);
        return on.every(function (r) { return r === on[0]; })
          && plan.days.map(Boolean).join() === plans[0].days.map(Boolean).join();
      });
      if (staged) {
        plans = [{ weeks: [], days: plans[0].days }];
        lettered = false;
      }
      plans.forEach(function (plan) {
        var week = el('div', 'week');
        week.appendChild(el('p', 'week-label', plans.length === 1 ? 'Every week'
          : (plan.weeks.length === 1 ? 'Week ' : 'Weeks ') + ranges(plan.weeks)));
        var days = el('div', 'days');
        plan.days.forEach(function (routine, i) {
          var day = el('div', 'day');
          day.appendChild(el('span', 'day-name', DAYS[i]));
          var dot = el('span', 'day-dot' + (routine ? ' on' : ''), routine && lettered ? letters[routine] : '');
          dot.title = routine || 'Rest';
          day.appendChild(dot);
          day.setAttribute('aria-label', DAYS[i] + ': ' + (routine || 'rest'));
          days.appendChild(day);
        });
        week.appendChild(days);
        if (staged) week.appendChild(el('p', 'legend', 'The workout steps up every few weeks — see each stage below.'));
        if (lettered) {
          var used = [];
          plan.days.forEach(function (r) { if (r && used.indexOf(r) < 0) used.push(r); });
          var legend = el('p', 'legend');
          used.sort().forEach(function (r) {
            var item = el('span');
            item.appendChild(el('b', null, letters[r]));
            item.appendChild(document.createTextNode(' ' + r));
            legend.appendChild(item);
          });
          week.appendChild(legend);
        }
        more.appendChild(week);
      });

      more.appendChild(el('h3', null, p.templates.length === 1 ? 'The workout' : 'The workouts'));
      p.templates.forEach(function (t) {
        var card = el('div', 'routine');
        card.appendChild(el('h4', null, (lettered && !staged ? letters[t.name] + ' · ' : '') + t.name));
        if (t.notes) card.appendChild(el('p', 'routine-notes', t.notes));
        var ol = el('ol');
        t.exercises.forEach(function (e) {
          var li = el('li');
          li.appendChild(el('span', null, e.name));
          li.appendChild(el('span', null, setSummary(e.sets, p.unit)));
          ol.appendChild(li);
        });
        card.appendChild(ol);
        more.appendChild(card);
      });
    }).catch(function () {
      if (openId !== id) return;
      more.innerHTML = '';
      more.appendChild(el('p', 'muted small', 'The plan couldn’t load. Please try again.'));
    });
  }

  sheet.addEventListener('close', function () { openId = null; syncURL(); });
  sheet.addEventListener('click', function (e) { if (e.target === sheet) sheet.close(); });   // tap outside

  // ---- Download: weekly pattern → dates from next Monday -------------------
  function nextMonday() {
    var d = new Date(); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
    return d;
  }
  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function download(id, button) {
    button.disabled = true;
    loadProgram(id).then(function (p) {
      var monday = nextMonday();
      var days = {};
      for (var w = 1; w <= p.weeks; w++) {
        p.pattern.forEach(function (entry) {
          if (entry.weeks && entry.weeks.indexOf(w) < 0) return;
          var d = new Date(monday);
          d.setDate(d.getDate() + (w - 1) * 7 + (entry.weekday - 1));
          (days[entry.routine] = days[entry.routine] || []).push(iso(d));
        });
      }
      var file = {
        version: 1,
        unit: p.unit,
        templates: p.templates.map(function (t) {
          var copy = JSON.parse(JSON.stringify(t));
          copy.schedule = (days[t.name] || []).sort();
          return copy;
        })
      };
      var blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/vnd.lwyl.workout+json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = id + '.lwyl';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      button.textContent = 'Download';
    }).catch(function () {
      button.textContent = 'Try again';
    }).finally(function () { button.disabled = false; });
  }

  // ---- Start -------------------------------------------------------------------
  fetch('/routines/programs/index.json?v=2').then(function (r) { return r.json(); }).then(function (data) {
    programs = data.programs;
    programs.forEach(index);
    var program = readURL();
    render();
    if (program) openDetails(program);
  }).catch(function () {
    list.innerHTML = '';
    list.appendChild(el('p', 'muted small', 'The library couldn’t load. Please refresh the page.'));
  });

  // ---- AI prompt: Copy -----------------------------------------------------
  var copy = document.getElementById('copy-prompt');
  if (copy) copy.addEventListener('click', function () {
    navigator.clipboard.writeText(document.getElementById('prompt-text').textContent).then(function () {
      copy.textContent = 'Copied';
      setTimeout(function () { copy.textContent = 'Copy'; }, 1600);
    });
  });
})();
