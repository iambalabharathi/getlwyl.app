// Light / dark for the whole site (and the home page's screenshots).
// Starts from the visitor's own setting; the header switch overrides it and
// is remembered. Loaded in <head> so the page never flashes the wrong theme.
(function () {
  var root = document.documentElement;
  // Entrance motion: only with JS and without Reduce Motion. Set here, in
  // <head>, so nothing flashes before it hides; if motion.js never runs,
  // everything is revealed after 2.5 s anyway.
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.classList.add('motion');
    setTimeout(function () {
      document.querySelectorAll('[data-reveal]:not(.in)').forEach(function (el) { el.classList.add('in'); });
    }, 2500);
  }
  var key = 'lwyl-theme';
  var saved = null;
  try { saved = localStorage.getItem(key); } catch (e) {}
  if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;

  function isDark() {
    return root.dataset.theme ? root.dataset.theme === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var sw = document.getElementById('theme');
    if (!sw) return;
    function sync() { sw.setAttribute('aria-checked', isDark() ? 'true' : 'false'); }
    sync();
    sw.hidden = false;
    sw.addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem(key, next); } catch (e) {}
      sync();
    });
    // Following the system: keep the switch in step if it changes.
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
      if (!root.dataset.theme) sync();
    });
    requestAnimationFrame(function () { requestAnimationFrame(function () { sw.classList.add('ready'); }); });
  });
})();
