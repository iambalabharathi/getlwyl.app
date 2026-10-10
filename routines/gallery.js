// Routines & Plans: the program library (filters, cards, download) and the
// AI prompt's Copy button. Programs come from /routines/programs/, built
// from the lwyl-routines repo by scripts/publish.py.
(function () {
  var LABELS = {
    goal: { strength: 'Strength', muscle: 'Muscle', 'fat-loss': 'Fat loss', general: 'General fitness', running: 'Running', mobility: 'Mobility' },
    level: { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' },
    equipment: { gym: 'Gym', barbell: 'Barbell', dumbbells: 'Dumbbells', kettlebell: 'Kettlebell', bodyweight: 'No equipment',
                 bands: 'Bands', 'pull-up-bar': 'Pull-up bar', 'cardio-machine': 'Cardio machine' }
  };
  var ALL = { goal: 'Any goal', level: 'Any level', equipment: 'Any equipment' };
  var chosen = { goal: null, level: null, equipment: null };
  var programs = [];
  var list = document.getElementById('programs');

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // ---- Filters ---------------------------------------------------------
  function buildFilters() {
    var box = document.getElementById('filters');
    box.querySelectorAll('.filter-row').forEach(function (row) {
      var key = row.dataset.key;
      var present = {};
      programs.forEach(function (p) {
        (key === 'equipment' ? p.equipment : [p[key]]).forEach(function (v) { present[v] = true; });
      });
      var values = Object.keys(LABELS[key]).filter(function (v) { return present[v]; });
      [null].concat(values).forEach(function (v) {
        var b = el('button', 'chip', v ? LABELS[key][v] : ALL[key]);
        b.type = 'button';
        b.setAttribute('aria-pressed', v === chosen[key] ? 'true' : 'false');
        b.addEventListener('click', function () {
          chosen[key] = v;
          row.querySelectorAll('.chip').forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
          b.setAttribute('aria-pressed', 'true');
          render();
        });
        row.appendChild(b);
      });
    });
    box.hidden = false;
  }

  function matches(p) {
    return (!chosen.goal || p.goal === chosen.goal)
      && (!chosen.level || p.level === chosen.level)
      && (!chosen.equipment || p.equipment.indexOf(chosen.equipment) >= 0);
  }

  // ---- Cards -------------------------------------------------------------
  function render() {
    list.innerHTML = '';
    var shown = programs.filter(matches);
    if (!shown.length) { list.appendChild(el('p', 'muted small', 'No programs match — try another filter.')); return; }
    shown.forEach(function (p) {
      var card = el('article', 'program');
      card.appendChild(el('p', 'program-eyebrow',
        LABELS.level[p.level] + ' · ' + LABELS.goal[p.goal]));
      card.appendChild(el('h3', 'program-title', p.title));
      card.appendChild(el('p', 'program-summary', p.summary));
      card.appendChild(el('p', 'program-meta',
        p.daysPerWeek + ' days a week · ' + p.weeks + ' weeks · ' +
        p.equipment.map(function (e) { return LABELS.equipment[e]; }).join(', ')));
      var b = el('button', 'program-download', 'Download');
      b.type = 'button';
      b.addEventListener('click', function () { download(p.id, b); });
      card.appendChild(b);
      list.appendChild(card);
    });
  }

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
    fetch('/routines/programs/' + id + '.json?v=1').then(function (r) { return r.json(); }).then(function (p) {
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
    }).catch(function () {
      button.textContent = 'Try again';
    }).finally(function () { button.disabled = false; });
  }

  fetch('/routines/programs/index.json?v=1').then(function (r) { return r.json(); }).then(function (data) {
    programs = data.programs;
    buildFilters();
    render();
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
