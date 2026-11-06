/* SpeedLog speed converter: page wiring. Everything runs in this page. */
(function () {
  'use strict';
  var S = window.SpeedLogic;
  var $ = function (id) { return document.getElementById(id); };
  var UNITS = ['kmh', 'mph', 'kn', 'ms'];

  function onInput(unit) {
    var v = S.parseSpeed($(unit).value);
    var raw = $(unit).value.trim();
    $(unit).classList.toggle('bad', raw !== '' && v === null);
    UNITS.forEach(function (u) {
      if (u === unit) return;
      $(u).classList.remove('bad');
      $(u).value = v === null ? '' : S.fmt(S.convert(v, unit, u), 2);
    });
  }
  UNITS.forEach(function (u) {
    $(u).addEventListener('input', function () { onInput(u); });
  });

  var TEXT = {
    same: 'The two readings match, within what GPS can tell apart. Try a higher speed: the gap usually grows with speed.',
    over: 'The dashboard reads high, as most do. This is inside the UN R39 range for a car with its original tyre size.',
    under: 'The dashboard reads below GPS. UN R39 does not allow that on a new car, so check first: is the GPS accuracy good, and was your speed steady? If it repeats, larger tyres than the original size are a common cause.',
    'above-limit': 'The dashboard reads higher than UN R39 allows for a new car at this speed. Check the GPS fix and repeat at a steady speed. If it repeats, smaller or very worn tyres are a common cause.'
  };

  function check() {
    var unit = $('dunit').value;
    var dash = S.parseSpeed($('dash').value);
    var gps = S.parseSpeed($('gps').value);
    var out = $('result');
    var r = dash === null || gps === null ? null : S.compare(dash, gps, unit);
    if (!r) {
      out.hidden = true;
      return;
    }
    var sym = S.SYMBOL[unit];
    var sign = r.diff > 0 ? '+' : r.diff < 0 ? '−' : '';
    $('rdiff').textContent = sign + S.fmt(Math.abs(r.diff), 1) + ' ' + sym;
    $('rpct').textContent = sign + S.fmt(Math.abs(r.percent), 1) + '%';
    $('rmax').textContent = S.fmt(r.maxIndicated, 1) + ' ' + sym;
    $('rtext').textContent = TEXT[r.status];
    $('rfactor').textContent = 'To estimate true speed from this dashboard near this speed, multiply what it shows by ' + r.factor.toFixed(3) + '.';
    out.hidden = false;
  }
  ['dash', 'gps'].forEach(function (id) { $(id).addEventListener('input', check); });
  $('dunit').addEventListener('change', check);
})();
