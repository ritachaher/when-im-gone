(function () {
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
