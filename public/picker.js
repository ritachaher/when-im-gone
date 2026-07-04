(function () {
  // Book-cover image fallback. Previously an inline onerror= attribute,
  // which script-src 'self' (no 'unsafe-inline') silently blocks.
  document.querySelectorAll('.book-cover img').forEach(function (img) {
    function hide() {
      img.style.display = 'none';
      if (img.parentElement) img.parentElement.classList.add('no-image');
    }
    img.addEventListener('error', hide);
    // The image may already have failed before this script ran
    // (scripts load at the end of <body>).
    if (img.complete && img.naturalWidth === 0) hide();
  });

  var pickerRow = document.querySelector('.picker-row');
  if (!pickerRow) return;
  pickerRow.addEventListener('click', function (e) {
    var btn = e.target.closest('.picker-btn');
    if (!btn) return;
    var person = btn.dataset.person;
    document.querySelectorAll('.journal-pane').forEach(function (p) { p.classList.remove('visible'); });
    document.querySelectorAll('.picker-btn').forEach(function (b) { b.classList.remove('active'); });
    var pane = document.getElementById('pane-' + person);
    if (pane) pane.classList.add('visible');
    btn.classList.add('active');
    // On the standalone sample page, scroll back to the top of the samples
    var anchor = document.getElementById('samples');
    if (anchor) anchor.scrollIntoView({ behaviour: 'smooth', block: 'start' });
  });
})();
