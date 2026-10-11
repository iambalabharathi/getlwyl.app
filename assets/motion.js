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

  // The title rolls through the slogan in a few of the app's languages,
  // once per visit: English, a short tour, back to English. Each line slides
  // up out of a clipped window while the next slides in; all at full size
  // (phones get languages that fit). Never read out by screen readers.
  (function slogan() {
    var h1 = document.querySelector('.slogan'), text = h1 && h1.querySelector('.slogan-text');
    if (!text) return;
    try { if (sessionStorage.getItem('lwyl-slogan')) return; sessionStorage.setItem('lwyl-slogan', '1'); } catch (e) {}
    var narrow = window.matchMedia('(max-width: 640px)').matches;
    var tour = narrow
      ? ['Elke beweging telt.', 'Logga varje rörelse.', 'Zapisuj każdy ruch.', 'Записуй кожен рух.']
      : ['Jede Bewegung zählt.', 'Chaque effort compte.', 'Registra cada movimiento.', 'Κάθε κίνηση μετράει.', 'Записуй кожен рух.'];
    var english = text.textContent;
    // Leave out any line that wouldn't fit at full size on this screen.
    var probe = text.cloneNode(true);
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap';
    h1.appendChild(probe);
    tour = tour.filter(function (line) { probe.textContent = line; return probe.scrollWidth <= h1.clientWidth; });
    h1.removeChild(probe);
    if (!tour.length) return;
    tour.push(english);

    text.classList.add('rolling');
    var current = document.createElement('span');
    current.className = 'slogan-line';
    current.textContent = english;
    text.textContent = '';
    text.appendChild(current);

    function roll(line, done) {
      var next = document.createElement('span');
      next.className = 'slogan-line from-below';
      next.textContent = line;
      text.appendChild(next);
      next.getBoundingClientRect();   // start below, then animate
      current.classList.add('to-above');
      next.classList.remove('from-below');
      setTimeout(function () { text.removeChild(current); current = next; done(); }, 650);
    }
    var i = 0;
    setTimeout(function step() {
      if (i >= tour.length) { text.classList.remove('rolling'); text.textContent = english; return; }
      roll(tour[i++], function () { setTimeout(step, i === tour.length ? 0 : 500); });
    }, 1500);
  })();
})();
