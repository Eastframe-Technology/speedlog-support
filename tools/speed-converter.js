/* SpeedLog speed converter and speedometer check: logic only, no browser APIs,
   so it also runs under node (see test/speed-converter.test.js). Unit factors
   are the exact definitions; the node test checks them against the app's
   lib/utils/units.dart. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SpeedLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Metres per second in one of each unit. 1 mile = 1609.344 m, 1 nautical mile = 1852 m. */
  var MPS = { kmh: 1000 / 3600, mph: 1609.344 / 3600, kn: 1852 / 3600, ms: 1 };
  var SYMBOL = { kmh: 'km/h', mph: 'mph', kn: 'kn', ms: 'm/s' };

  function convert(value, from, to) { return value * MPS[from] / MPS[to]; }

  function all(value, from) {
    return {
      kmh: convert(value, from, 'kmh'), mph: convert(value, from, 'mph'),
      kn: convert(value, from, 'kn'), ms: convert(value, from, 'ms')
    };
  }

  /* Accepts "55", "55.5" and "55,5". Returns null for anything else, or below zero. */
  function parseSpeed(text) {
    var s = String(text === undefined || text === null ? '' : text).trim().replace(',', '.');
    if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return null;
    return Number(s);
  }

  /* At most `places` decimals, no trailing zeros. */
  function fmt(v, places) {
    var p = places === undefined ? 2 : places;
    var s = v.toFixed(p);
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s;
  }

  /* UN Regulation No. 39: the indicated speed V1 and true speed V2 (in km/h)
     must satisfy 0 <= V1 - V2 <= 0.1 V2 + 4. The 4 is in km/h, so it has to be
     converted for other units; it is not 4 mph. */
  function r39MaxIndicatedKmh(trueKmh) { return 1.1 * trueKmh + 4; }

  /* Reverse: the range of true speeds a compliant speedometer showing this
     number could be travelling at. */
  function r39TrueRangeKmh(indicatedKmh) {
    return { low: Math.max(0, (indicatedKmh - 4) / 1.1), high: indicatedKmh };
  }

  /* GPS speed from a phone is usually within about 1 km/h, so differences smaller
     than that say nothing about the speedometer. */
  var GPS_NOISE_KMH = 1;

  /* Compare a dashboard reading with GPS speed, both in `unit`. */
  function compare(dash, gps, unit) {
    if (!(dash > 0) || !(gps > 0)) return null;
    var dashKmh = convert(dash, unit, 'kmh');
    var gpsKmh = convert(gps, unit, 'kmh');
    var maxKmh = r39MaxIndicatedKmh(gpsKmh);
    var diffKmh = dashKmh - gpsKmh;
    var status;
    if (Math.abs(diffKmh) <= GPS_NOISE_KMH) status = 'same';
    else if (diffKmh < 0) status = 'under';
    else if (dashKmh > maxKmh + GPS_NOISE_KMH) status = 'above-limit';
    else status = 'over';
    return {
      diff: dash - gps,
      percent: (dash - gps) / gps * 100,
      maxIndicated: convert(maxKmh, 'kmh', unit),
      factor: gps / dash,
      status: status
    };
  }

  return {
    MPS: MPS, SYMBOL: SYMBOL, convert: convert, all: all, parseSpeed: parseSpeed, fmt: fmt,
    r39MaxIndicatedKmh: r39MaxIndicatedKmh, r39TrueRangeKmh: r39TrueRangeKmh, compare: compare
  };
});
