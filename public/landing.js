// Landing page carousel. Extracted from index.html so the page can ship
// under a strict Content-Security-Policy without 'unsafe-inline' for
// scripts. Plain ES5 — runs without a build step.
(function () {
  var track = document.getElementById('carouselTrack');
  var dots = document.querySelectorAll('.carousel-dot');
  var wrap = document.getElementById('carousel');
  var current = 0;
  var total = 3;
  var autoTimer;

  function goTo(i) {
    current = ((i % total) + total) % total;
    track.style.transform = 'translateX(-' + (current * 100) + '%)';
    dots.forEach(function (d, idx) { d.classList.toggle('active', idx === current); });
  }

  function startAuto() { autoTimer = setInterval(function () { goTo(current + 1); }, 4000); }
  function stopAuto() { clearInterval(autoTimer); }

  dots.forEach(function (d) {
    d.addEventListener('click', function () {
      stopAuto();
      goTo(parseInt(d.dataset.slide));
      startAuto();
    });
  });

  var startX = 0;
  var dragging = false;
  wrap.addEventListener('pointerdown', function (e) { startX = e.clientX; dragging = true; wrap.style.cursor = 'grabbing'; });
  wrap.addEventListener('pointerup', function (e) {
    if (!dragging) return;
    dragging = false;
    wrap.style.cursor = 'grab';
    var diff = e.clientX - startX;
    if (Math.abs(diff) > 40) { stopAuto(); goTo(current + (diff < 0 ? 1 : -1)); startAuto(); }
  });
  wrap.addEventListener('pointerleave', function () { dragging = false; wrap.style.cursor = 'grab'; });

  startAuto();
})();
