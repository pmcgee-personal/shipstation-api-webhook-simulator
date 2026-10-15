// Replay engine for the ShipStation API webhook simulator.
//
// Takes one of the real `API_TRACK` bodies in fixtures.js and re-times it so
// the newest scan happens "now", swaps in the tracking number, and gives
// `label_url` (where a carrier populates it) a fresh `se-` ID. Nothing else
// is changed, so every real quirk in the capture is preserved: key order,
// null vs "" values, the per-carrier timestamp encodings, and even the swapped
// DHL scan pair.
//
// No dependencies, no DOM. Works in the browser (window.Replay) and in Node
// (module.exports) so it can be tested without a browser.
(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Replay = api;
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";

  const DAY = 86400000;

  // Keys match fixtures.js and the carrier_code used in the v1 resource_url.
  const CARRIERS = [
    { code: "ups", label: "UPS" },
    { code: "usps", label: "USPS" },
    { code: "fedex", label: "FedEx" },
    { code: "dhl_global_mail", label: "DHL eCommerce" },
  ];

  const SCENARIOS = [
    { key: "label-created", label: "Label created" },
    { key: "in-transit", label: "In transit" },
    { key: "out-for-delivery", label: "Out for delivery" },
    { key: "delivered", label: "Delivered" },
  ];

  // ---- timestamps --------------------------------------------------------
  //
  // Fixtures use three encodings: `...Z`, `...-07:00` and naive (no suffix).
  // Every value is shifted on its own wall clock and keeps its own suffix, so
  // an encoding never changes and the gap between `occurred_at` and
  // `carrier_occurred_at` on each scan stays exactly as captured.

  const TS =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(Z|[+-]\d{2}:\d{2})?$/;

  function parseTs(s) {
    const m = TS.exec(s);
    if (!m) throw new Error("Unrecognised timestamp: " + s);
    return {
      wall: Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]),
      suffix: m[7] || "",
    };
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function formatTs(wall, suffix) {
    const d = new Date(wall);
    return (
      d.getUTCFullYear() +
      "-" +
      pad(d.getUTCMonth() + 1) +
      "-" +
      pad(d.getUTCDate()) +
      "T" +
      pad(d.getUTCHours()) +
      ":" +
      pad(d.getUTCMinutes()) +
      ":" +
      pad(d.getUTCSeconds()) +
      suffix
    );
  }

  function shiftTs(s, ms) {
    if (s == null) return s;
    const p = parseTs(s);
    return formatTs(p.wall + ms, p.suffix);
  }

  function isNaiveMidnight(s) {
    return typeof s === "string" && /T00:00:00$/.test(s);
  }

  // ---- tracking numbers --------------------------------------------------

  function digits(n, rnd) {
    let s = "";
    for (let i = 0; i < n; i++) s += Math.floor(rnd() * 10);
    return s;
  }

  function pick(str, rnd) {
    return str[Math.floor(rnd() * str.length)];
  }

  // UPS: 1Z + 16 characters, the last being a check digit. Letters count as
  // (ASCII code - 63) mod 10, odd positions x1, even positions x2.
  function upsCheckDigit(first15) {
    let sum = 0;
    for (let i = 0; i < first15.length; i++) {
      const c = first15[i];
      const v = /\d/.test(c) ? +c : (c.charCodeAt(0) - 63) % 10;
      sum += i % 2 === 0 ? v : v * 2;
    }
    return String((10 - (sum % 10)) % 10);
  }

  const ALNUM = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const UPS_SERVICES = ["01", "02", "03", "12", "14"];

  const TRACKING_FORMATS = {
    ups: {
      hint: "UPS: 18 characters, 1Z followed by 16 letters or digits",
      pattern: /^1Z[0-9A-Z]{16}$/,
      generate(rnd) {
        let shipper = "";
        for (let i = 0; i < 6; i++) shipper += pick(ALNUM, rnd);
        const body = shipper + pick(UPS_SERVICES, rnd) + digits(7, rnd);
        return "1Z" + body + upsCheckDigit(body);
      },
    },
    usps: {
      hint: "USPS: 20 to 22 digits, usually 22",
      pattern: /^\d{20,22}$/,
      generate(rnd) {
        // 22 digits with the common 9400 1 prefix. Plausible in shape, not
        // checksum-validated.
        return "94001" + digits(17, rnd);
      },
    },
    fedex: {
      hint: "FedEx: usually 12 digits (15, 20 and 22 also occur)",
      pattern: /^(\d{12}|\d{15}|\d{20}|\d{22})$/,
      generate(rnd) {
        return String(1 + Math.floor(rnd() * 9)) + digits(11, rnd);
      },
    },
    dhl_global_mail: {
      hint: "DHL eCommerce: letters or digits, the capture was 30 characters",
      pattern: /^[0-9A-Z]{10,34}$/,
      generate(rnd) {
        // ZIP-routed 30-digit form: 420 + ZIP + 22-digit number. Plausible in
        // shape, not checksum-validated.
        return "420" + digits(5, rnd) + "9261" + digits(18, rnd);
      },
    },
  };

  function defaultTrackingNumber(carrierCode, rnd) {
    const f = TRACKING_FORMATS[carrierCode];
    if (!f) throw new Error("Unknown carrier: " + carrierCode);
    return f.generate(rnd || Math.random);
  }

  // Non-blocking: returns a warning string, or null if the number looks right.
  function checkTrackingNumber(carrierCode, trackingNumber) {
    const f = TRACKING_FORMATS[carrierCode];
    if (!f || !trackingNumber) return null;
    return f.pattern.test(trackingNumber) ? null : f.hint;
  }

  // ---- build -------------------------------------------------------------

  function newestEvent(events) {
    return events.reduce((a, b) =>
      parseTs(b.occurred_at).wall > parseTs(a.occurred_at).wall ? b : a,
    );
  }

  /**
   * @param {object} opts
   * @param {string} opts.carrier         carrier_code: ups | usps | fedex | dhl_global_mail
   * @param {string} opts.scenario        label-created | in-transit | out-for-delivery | delivered
   * @param {string} [opts.trackingNumber] blank -> a plausible generated number
   * @param {Date|number} [opts.now]      moment the newest scan "happens"
   * @param {function} [opts.random]      () => [0,1), for tests
   * @param {object} [opts.fixtures]      defaults to window.FIXTURES
   * @returns {object} a new API_TRACK body; the fixtures are never modified
   */
  function build(opts) {
    const fixtures = opts.fixtures || root.FIXTURES;
    if (!fixtures) throw new Error("fixtures.js has not been loaded");
    const rnd = opts.random || Math.random;

    const carrier = fixtures[opts.carrier];
    if (!carrier) throw new Error("Unknown carrier: " + opts.carrier);
    const fixture = carrier.scenarios[opts.scenario];
    if (!fixture) throw new Error("Unknown scenario: " + opts.scenario);

    const body = JSON.parse(JSON.stringify(fixture));
    const d = body.data;

    // Tracking number: the two places it appears in every fixture.
    const tn =
      String(opts.trackingNumber == null ? "" : opts.trackingNumber).trim() ||
      defaultTrackingNumber(opts.carrier, rnd);
    d.tracking_number = tn;
    const url = body.resource_url.replace(
      /tracking_number=.*$/,
      "tracking_number=" + encodeURIComponent(tn),
    );
    if (url === body.resource_url && !/tracking_number=/.test(url)) {
      throw new Error("resource_url has no tracking_number parameter");
    }
    body.resource_url = url;

    // label_url is populated for FedEx and DHL only; give it a fresh se- ID.
    if (d.label_url != null) {
      const labelId = String(Math.floor(100000000 + rnd() * 900000000));
      d.label_url = d.label_url.replace(/se-[^/]*$/, "se-" + labelId);
    }

    // Re-time: the newest scan happens at `now`, everything else keeps its
    // original distance from it.
    const nowRaw = opts.now instanceof Date ? opts.now.getTime() : opts.now;
    const nowMs =
      Math.floor((nowRaw == null ? Date.now() : nowRaw) / 1000) * 1000;
    const newest = newestEvent(d.events);
    const delta = nowMs - parseTs(newest.occurred_at).wall;

    // How many calendar days the newest scan's wall clock moved. Used for
    // date-style fields (ETA, midnight ship dates) so they keep their
    // captured relationship to the delivery date instead of drifting to odd
    // times of day.
    const ref = parseTs(newest.carrier_occurred_at || newest.occurred_at).wall;
    const dayShiftMs =
      (Math.floor((ref + delta) / DAY) - Math.floor(ref / DAY)) * DAY;

    d.events.forEach((e) => {
      e.occurred_at = shiftTs(e.occurred_at, delta);
      e.carrier_occurred_at = shiftTs(e.carrier_occurred_at, delta);
    });

    // ship_date: the label date at midnight (UPS) moves by whole days; a
    // value derived from a scan (USPS, FedEx, DHL) moves with that scan.
    d.ship_date = shiftTs(
      d.ship_date,
      isNaiveMidnight(d.ship_date) ? dayShiftMs : delta,
    );
    d.estimated_delivery_date = shiftTs(d.estimated_delivery_date, dayShiftMs);
    d.actual_delivery_date = shiftTs(d.actual_delivery_date, delta);

    return body;
  }

  return {
    CARRIERS,
    SCENARIOS,
    TRACKING_FORMATS,
    build,
    defaultTrackingNumber,
    checkTrackingNumber,
    _internal: { parseTs, formatTs, shiftTs, upsCheckDigit },
  };
});
