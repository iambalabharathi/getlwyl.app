// Fade-up on scroll, once: elements with data-reveal get .in when they come
// into view; siblings in a data-stagger group follow each other (70 ms).
(function () {
  var root = document.documentElement;
  if (!root.classList.contains('motion') || !('IntersectionObserver' in window)) {
    document.querySelectorAll('[data-reveal]').forEach(function (el) { el.classList.add('in'); });
    return;
  }
  document.querySelectorAll('[data-stagger]').forEach(function (group) {
    var step = parseInt(group.getAttribute('data-stagger'), 10) || 70;
    // A group on screen at load waits for the hero (data-after, in ms).
    var after = window.scrollY < 10 && group.getBoundingClientRect().top < window.innerHeight
      ? parseInt(group.getAttribute('data-after') || '0', 10) : 0;
    Array.prototype.forEach.call(group.querySelectorAll('[data-reveal]'), function (el, i) {
      el.style.transitionDelay = (after + i * step) + 'ms';
    });
  });
  // The first touch or scroll settles the phones at once, so a quick swipe
  // right after loading never catches them mid-slide.
  function settle() {
    root.classList.add('motion-settled');
    document.querySelectorAll('.shot[data-reveal]').forEach(function (el) { el.style.transitionDelay = '0ms'; });
    removeEventListener('touchstart', settle);
    removeEventListener('wheel', settle);
  }
  addEventListener('touchstart', settle, { passive: true, once: true });
  addEventListener('wheel', settle, { passive: true, once: true });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  document.querySelectorAll('[data-reveal]').forEach(function (el) { io.observe(el); });

  // The title says the slogan in a few of the app's languages, once per
  // visit: English first, a short tour, back to English. Same size all the
  // way (longer ones are scaled to fit), never read out by screen readers.
  (function slogan() {
    var h1 = document.querySelector('.slogan'), text = h1 && h1.querySelector('.slogan-text');
    if (!text) return;
    try { if (sessionStorage.getItem('lwyl-slogan')) return; sessionStorage.setItem('lwyl-slogan', '1'); } catch (e) {}
    var lines = ['Jede Bewegung zählt.', 'Chaque effort compte.', 'Registra cada movimiento.',
                 'Κάθε κίνηση μετράει.', 'Записуй кожен рух.', 'Log Every Move.'];
    var english = text.textContent;
    h1.style.height = h1.offsetHeight + 'px';
    function show(line) {
      text.classList.add('out');
      setTimeout(function () {
        text.textContent = line;
        text.style.transform = '';
        var over = text.scrollWidth / h1.clientWidth;
        if (over > 1) text.style.transform = 'scale(' + (1 / over).toFixed(3) + ')';
        text.classList.remove('out');
      }, 180);
    }
    var i = 0;
    setTimeout(function next() {
      if (i >= lines.length) { h1.style.height = ''; text.textContent = english; return; }
      show(lines[i++]);
      setTimeout(next, i === lines.length ? 400 : 620);
    }, 1400);
  })();
})();
