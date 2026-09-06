// paper-motion.js: pohyb pre stranky ARLing Asistent podla ops/design/paper-v2.md.
// Samostatny subor, lebo CSP stranky nedovoluje inline <script>. Rovnaky kod ako
// referencna implementacia products/arling-sk/nahlad/index.html.
/* Pohyb podľa ops/design/paper-v2.md, sekcia 7. Kreslí sa raz, jediná trvalá
   slučka je blikajúci kurzor v scéne, prefers-reduced-motion vypína všetko.
   Žiadna knižnica, žiadny externý skript, žiadny requestAnimationFrame. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // nadpis príde po slovách; na stránkach s prekladom sa prekreslí po výmene jazyka
  function paintH1() {
    var h1 = document.getElementById('h1');
    if (!h1) return;
    var lines = h1.querySelectorAll('.l');
    if (!lines.length) {
      var only = document.createElement('span');
      only.className = 'l';
      only.textContent = h1.textContent;
      h1.textContent = '';
      h1.appendChild(only);
      lines = h1.querySelectorAll('.l');
    }
    h1.classList.remove('in');
    var i = 0;
    Array.prototype.forEach.call(lines, function (line) {
      var words = line.textContent.split(' ').filter(function (w) { return w !== ''; });
      line.textContent = '';
      words.forEach(function (w, k) {
        var s = document.createElement('span');
        s.className = 'w';
        s.style.transitionDelay = (i++ * 0.06).toFixed(2) + 's';
        s.textContent = w;
        line.appendChild(s);
        if (k < words.length - 1) line.appendChild(document.createTextNode(' '));
      });
    });
    setTimeout(function () { h1.classList.add('in'); }, 30);
  }

  function wireScene() {
    var scene = document.getElementById('scene');
    if (!scene) return;
    scene.querySelectorAll('.looks button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        scene.setAttribute('data-look', btn.getAttribute('data-look'));
        scene.querySelectorAll('.looks button').forEach(function (o) {
          o.setAttribute('aria-pressed', o === btn ? 'true' : 'false');
        });
      });
    });
  }

  function start() {
    wireScene();
    document.addEventListener('arling:langchange', function () { setTimeout(paintH1, 0); });

    if (reduce) {
      document.querySelectorAll('.r, section').forEach(function (e) { e.classList.add('in'); });
      var h = document.getElementById('h1');
      if (h) h.classList.add('in');
      return;
    }

    var hero = document.getElementById('hero');
    if (hero) hero.querySelectorAll('.r').forEach(function (e) { e.classList.add('in'); });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.1 });
    document.querySelectorAll('section').forEach(function (s) { io.observe(s); });

    paintH1();

    // bočný register: vie, v ktorej sekcii ste
    var rail = document.querySelector('.rail');
    if (rail) {
      var links = Array.prototype.slice.call(rail.querySelectorAll('a'));
      var targets = links.map(function (a) { return document.querySelector(a.getAttribute('href')); });
      var railIo = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var i = targets.indexOf(en.target);
          if (i < 0 || !en.isIntersecting) return;
          links.forEach(function (a, j) { a.setAttribute('aria-current', j === i ? 'true' : 'false'); });
        });
        rail.classList.add('on');
      }, { rootMargin: '-45% 0px -45% 0px' });
      targets.forEach(function (t) { if (t) railIo.observe(t); });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 0); });
  } else {
    setTimeout(start, 0);
  }
})();
