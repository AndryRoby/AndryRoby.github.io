(function (root) {
  'use strict';
  function spring(response, damping) {
    return { response: response, damping: damping == null ? 0.86 : damping };
  }
  var PRESET = {
    snappy: spring(0.32, 0.86),
    smooth: spring(0.5, 0.86),
    morph: spring(0.56, 0.8),
    gentle: spring(0.7, 0.95),
    camera: spring(0.62, 1),
    exit: spring(0.2, 1),
    enter: spring(0.38, 0.9),
    press: spring(0.16, 0.9),
  };
  var SETTLE = 5e-5;
  function springDisp(sp, tau, d0, v0) {
    if (tau <= 0) return d0;
    var w = (2 * Math.PI) / sp.response;
    var z = sp.damping;
    var scale = Math.abs(d0) + Math.abs(v0) / w;
    var bound, val;
    if (Math.abs(z - 1) < 1e-6) {
      var ec = Math.exp(-w * tau);
      bound = ec * (Math.abs(d0) + Math.abs(v0 + w * d0) * tau);
      val = ec * (d0 + (v0 + w * d0) * tau);
    } else if (z < 1) {
      var wd = w * Math.sqrt(1 - z * z);
      var e = Math.exp(-z * w * tau);
      var c2 = (v0 + z * w * d0) / wd;
      bound = e * (Math.abs(d0) + Math.abs(c2));
      val = e * (d0 * Math.cos(wd * tau) + c2 * Math.sin(wd * tau));
    } else {
      var s = Math.sqrt(z * z - 1);
      var r1 = -w * (z - s);
      var r2 = -w * (z + s);
      var A = (v0 - r2 * d0) / (r1 - r2);
      var B = d0 - A;
      bound = Math.abs(A) * Math.exp(r1 * tau) + Math.abs(B) * Math.exp(r2 * tau);
      val = A * Math.exp(r1 * tau) + B * Math.exp(r2 * tau);
    }
    return bound < SETTLE * scale ? 0 : val;
  }
  function springStep(sp, tau) {
    if (tau <= 0) return 0;
    return 1 - springDisp(sp, tau, 1, 0);
  }
  function Track(initial, sp) {
    this.initial = initial;
    this.sp = sp || PRESET.smooth;
    this.ev = [];
  }
  Track.prototype._add = function (e) {
    e.i = this.ev.length;
    this.ev.push(e);
    this.ev.sort(function (a, b) { return a.t - b.t || a.i - b.i; });
    return this;
  };
  Track.prototype.to = function (t, target, sp) {
    return this._add({ k: 'to', t: t, target: target, sp: sp || this.sp });
  };
  Track.prototype.drag = function (t0, t1, fn, sp) {
    return this._add({ k: 'drag', t: t0, t1: t1, fn: fn, sp: sp || this.sp });
  };
  Track.prototype.target = function (t) {
    var target = this.initial;
    for (var i = 0; i < this.ev.length; i++) {
      var e = this.ev[i];
      if (e.t > t) break;
      if (e.k === 'to') target = e.target;
    }
    return target;
  };
  Track.prototype.at = function (t) {
    var base = { kind: 'rest', value: this.initial };
    var steps = [];
    var target = this.initial;
    for (var i = 0; i < this.ev.length; i++) {
      var e = this.ev[i];
      if (e.t > t) break;
      if (e.k === 'to') {
        steps.push({ t: e.t, delta: e.target - target, sp: e.sp });
        target = e.target;
      } else if (e.k === 'drag') {
        var grabValue = evalParts(base, steps, e.t);
        if (t < e.t1) return e.fn(t, grabValue);
        var h = 1 / 960;
        var p = e.fn(e.t1, grabValue);
        var v = (p - e.fn(e.t1 - h, grabValue)) / h;
        base = { kind: 'release', t: e.t1, from: p, v: v, target: target, sp: e.sp };
        steps = [];
      }
    }
    return evalParts(base, steps, t);
  };
  Track.prototype.vel = function (t) {
    var h = 1 / 2000;
    return (this.at(t + h) - this.at(t - h)) / (2 * h);
  };
  function evalParts(base, steps, t) {
    var v;
    if (base.kind === 'rest') v = base.value;
    else v = base.target + springDisp(base.sp, t - base.t, base.from - base.target, base.v);
    for (var i = 0; i < steps.length; i++) {
      var s = steps[i];
      v += s.delta * springStep(s.sp, t - s.t);
    }
    return v;
  }
  function track(initial, sp) { return new Track(initial, sp); }
  function hexToRgb(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
  }
  function toLin(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function fromLin(c) { return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; }
  function rgbToOklab(rgb) {
    var r = toLin(rgb[0]), g = toLin(rgb[1]), b = toLin(rgb[2]);
    var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    var m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    var s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ];
  }
  function oklabToRgb(lab) {
    var l = Math.pow(lab[0] + 0.3963377774 * lab[1] + 0.2158037573 * lab[2], 3);
    var m = Math.pow(lab[0] - 0.1055613458 * lab[1] - 0.0638541728 * lab[2], 3);
    var s = Math.pow(lab[0] - 0.0894841775 * lab[1] - 1.291485548 * lab[2], 3);
    return [
      fromLin(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
      fromLin(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
      fromLin(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    ];
  }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function ColorTrack(hex, sp) {
    var lab = rgbToOklab(hexToRgb(hex));
    sp = sp || spring(0.5, 1);
    this.ch = [track(lab[0], sp), track(lab[1], sp), track(lab[2], sp)];
  }
  ColorTrack.prototype.to = function (t, hex, sp) {
    var lab = rgbToOklab(hexToRgb(hex));
    for (var i = 0; i < 3; i++) this.ch[i].to(t, lab[i], sp);
    return this;
  };
  ColorTrack.prototype.at = function (t) {
    var rgb = oklabToRgb([this.ch[0].at(t), this.ch[1].at(t), this.ch[2].at(t)]);
    return 'rgb(' + rgb.map(function (c) { return Math.round(clamp01(c) * 255); }).join(',') + ')';
  };
  function color(hex, sp) { return new ColorTrack(hex, sp); }
  function Indicator(left, right, fast, slow) {
    this.fast = fast || spring(0.3, 0.9);
    this.slow = slow || spring(0.55, 0.95);
    this.l = track(left, this.slow);
    this.r = track(right, this.slow);
    this.last = [left, right];
  }
  Indicator.prototype.to = function (t, left, right) {
    var dir = (left + right) - (this.last[0] + this.last[1]);
    if (dir >= 0) { this.r.to(t, right, this.fast); this.l.to(t, left, this.slow); }
    else { this.l.to(t, left, this.fast); this.r.to(t, right, this.slow); }
    this.last = [left, right];
    return this;
  };
  Indicator.prototype.at = function (t) { return { left: this.l.at(t), right: this.r.at(t) }; };
  function indicator(l, r, fast, slow) { return new Indicator(l, r, fast, slow); }
  function Presence(visible, opts) {
    opts = opts || {};
    this.blur = opts.blur == null ? 10 : opts.blur;
    this.dyIn = opts.dyIn == null ? 14 : opts.dyIn;
    this.dyOut = opts.dyOut == null ? -8 : opts.dyOut;
    this.scaleFrom = opts.scaleFrom == null ? 0.94 : opts.scaleFrom;
    this.enterSp = opts.enter || PRESET.enter;
    this.exitSp = opts.exit || PRESET.exit;
    this.p = track(visible ? 1 : 0);
    this.marks = [];
  }
  Presence.prototype.enter = function (t, sp) { this.p.to(t, 1, sp || this.enterSp); this.marks.push([t, 'in']); return this; };
  Presence.prototype.exit = function (t, sp) { this.p.to(t, 0, sp || this.exitSp); this.marks.push([t, 'out']); return this; };
  Presence.prototype.at = function (t) {
    var phase = 'in';
    for (var i = 0; i < this.marks.length; i++) if (this.marks[i][0] <= t) phase = this.marks[i][1];
    var p = this.p.at(t);
    var q = clamp01(p);
    var dy = phase === 'out' ? this.dyOut : this.dyIn;
    return {
      opacity: q,
      blur: (1 - q) * this.blur,
      y: (1 - p) * dy,
      scale: this.scaleFrom + (1 - this.scaleFrom) * p,
      visible: q > 0.002,
    };
  };
  function presence(visible, opts) { return new Presence(visible, opts); }
  function params() {
    var q = {};
    if (typeof location === 'undefined') return q;
    location.search.replace(/^\?/, '').split('&').forEach(function (kv) {
      if (!kv) return;
      var p = kv.split('=');
      q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '1');
    });
    return q;
  }
  var TALL = { side: 0.12, top: 0.13, bottom: 0.73 };
  function isTall(W, H) { return H / W > 1.4; }
  function safeRect(W, H) {
    if (isTall(W, H)) return { x: W * TALL.side, y: H * TALL.top, w: W * (1 - 2 * TALL.side), h: H * (TALL.bottom - TALL.top) };
    var m = Math.min(W, H) * 0.07;
    return { x: m, y: m, w: W - 2 * m, h: H - 2 * m };
  }
  function layout(W, H) {
    if (W && typeof W === 'object') { H = W.H; W = W.W; }
    var S = safeRect(W, H);
    var tall = isTall(W, H);
    var fill = 0.96;
    return {
      tall: tall,
      safe: S,
      margin: S.x,
      fill: fill,
      push: 1,
      cardW: Math.floor(S.w * fill), // floor: mierka kamery vyjde nad 1, nie pod
      cardMaxH: Math.floor(S.h * fill),
      body: tall ? 42 : 34,
      label: tall ? 36 : 30,
      small: tall ? 34 : 28,
    };
  }
  function Stage(opts) {
    opts = opts || {};
    var q = params();
    this.q = q;
    this.W = +(q.w || opts.w || 1080);
    this.H = +(q.h || opts.h || 1920);
    this.render = !!q.render;
    this.tall = isTall(this.W, this.H);
    this.safe = safeRect(this.W, this.H);
    this.layout = layout(this.W, this.H);
    this.unit = Math.min(this.W, this.H) / 1080; // 1 pri 1080
    var d = document;
    d.documentElement.style.background = opts.bg || '#ECEAE6';
    var el = d.createElement('div');
    el.className = 'pohyb-stage';
    el.style.cssText = 'position:relative;overflow:hidden;width:' + this.W + 'px;height:' + this.H + 'px;background:' + (opts.bg || '#ECEAE6');
    var world = d.createElement('div');
    world.className = 'pohyb-world';
    world.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;transform-origin:0 0';
    var overlay = d.createElement('div');
    overlay.className = 'pohyb-overlay';
    overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    el.appendChild(world);
    el.appendChild(overlay);
    d.body.appendChild(el);
    this.el = el;
    this.world = world;
    this.overlay = overlay;
    if (q.guides) this._guides();
  }
  Stage.prototype._guides = function () {
    var g = document.createElement('div');
    var s = this.safe, W = this.W, H = this.H;
    g.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:50';
    var html = '';
    html += '<div style="position:absolute;left:0;top:0;width:' + W + 'px;height:' + s.y + 'px;background:rgba(220,40,40,.12)"></div>';
    html += '<div style="position:absolute;left:0;top:' + (s.y + s.h) + 'px;width:' + W + 'px;height:' + (H - s.y - s.h) + 'px;background:rgba(220,40,40,.12)"></div>';
    html += '<div style="position:absolute;left:' + (s.x + s.w) + 'px;top:' + s.y + 'px;width:' + (W - s.x - s.w) + 'px;height:' + s.h + 'px;background:rgba(220,40,40,.12)"></div>';
    html += '<div style="position:absolute;left:0;top:' + s.y + 'px;width:' + s.x + 'px;height:' + s.h + 'px;background:rgba(220,40,40,' + (this.tall ? '.12' : '.06') + ')"></div>';
    html += '<div style="position:absolute;left:' + (W / 2) + 'px;top:' + s.y + 'px;width:1px;height:' + s.h + 'px;background:rgba(0,90,255,.35)"></div>';
    for (var i = 0; i <= 8; i++) {
      var x = s.x + (s.w * i) / 8;
      html += '<div style="position:absolute;left:' + x + 'px;top:' + s.y + 'px;width:1px;height:' + s.h + 'px;background:rgba(0,90,255,' + (i % 4 === 0 ? '.35' : '.15') + ')"></div>';
    }
    html += '<div style="position:absolute;left:' + s.x + 'px;top:' + (s.y + s.h / 2) + 'px;width:' + s.w + 'px;height:1px;background:rgba(0,90,255,.35)"></div>';
    g.innerHTML = html;
    this.el.appendChild(g);
  };
  function frameOpts(fill) {
    if (fill && typeof fill === 'object') return { fill: fill.fill == null ? 0.8 : fill.fill, max: fill.max, detail: !!fill.detail };
    return { fill: fill == null ? 0.8 : fill, max: null, detail: false };
  }
  function Camera(stage, rect, fill, sp) {
    this.stage = stage;
    this.sp = sp || PRESET.camera;
    var o = frameOpts(fill);
    var f = this._fit(rect, o);
    this.cx = track(f.cx, this.sp);
    this.cy = track(f.cy, this.sp);
    this.ls = track(Math.log(f.s), this.sp);
    this.marks = [{ t: -Infinity, detail: o.detail }];
  }
  Camera.prototype._fit = function (r, o) {
    var S = this.stage.safe;
    var s = Math.min((S.w * o.fill) / r.w, (S.h * o.fill) / r.h);
    if (o.max != null) s = Math.min(s, o.max);
    return { cx: r.x + r.w / 2, cy: r.y + r.h / 2, s: s };
  };
  Camera.prototype._mark = function (t, detail) {
    this.marks.push({ t: t, detail: detail });
    this.marks.sort(function (a, b) { return a.t - b.t; });
  };
  Camera.prototype.frame = function (t, rect, fill, sp) {
    var o = frameOpts(fill);
    var f = this._fit(rect, o);
    sp = sp || this.sp;
    this.cx.to(t, f.cx, sp);
    this.cy.to(t, f.cy, sp);
    this.ls.to(t, Math.log(f.s), sp);
    this._mark(t, o.detail);
    return this;
  };
  Camera.prototype.fly = function (t, rect, fill, opts) {
    opts = opts || {};
    var o = frameOpts(fill);
    var f = this._fit(rect, o);
    var sp = opts.sp || spring(0.8, 1);
    var mid = opts.mid == null ? 0.32 : opts.mid;
    var dip = opts.dip == null ? 1.25 : opts.dip;
    var lsNow = this.ls.target(t);
    var low = Math.min(lsNow, Math.log(f.s)) - Math.log(dip);
    this.cx.to(t, f.cx, sp);
    this.cy.to(t, f.cy, sp);
    this.ls.to(t, low, spring(mid * 1.6, 1));
    this.ls.to(t + mid, Math.log(f.s), sp);
    this._mark(t, o.detail);
    return this;
  };
  Camera.prototype.detailAt = function (t) {
    var d = false;
    for (var i = 0; i < this.marks.length; i++) if (this.marks[i].t <= t) d = this.marks[i].detail;
    return d;
  };
  Camera.prototype.at = function (t) {
    var S = this.stage.safe;
    var s = Math.exp(this.ls.at(t));
    return { s: s, tx: S.x + S.w / 2 - this.cx.at(t) * s, ty: S.y + S.h / 2 - this.cy.at(t) * s };
  };
  Camera.prototype.toScreen = function (x, y, t) {
    var c = this.at(t);
    return { x: c.tx + x * c.s, y: c.ty + y * c.s };
  };
  Camera.prototype.apply = function (t) {
    var c = this.at(t);
    this.stage.world.style.transform = 'translate(' + r3(c.tx) + 'px,' + r3(c.ty) + 'px) scale(' + c.s.toFixed(5) + ')';
    var det = this.detailAt(t) ? '1' : '0';
    if (this.stage.world.getAttribute('data-detail') !== det) this.stage.world.setAttribute('data-detail', det);
    return c;
  };
  var CURSOR_SVG =
    '<svg viewBox="0 0 32 32" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M6 3.5 L6 25.5 L11.6 20.4 L15.2 28.6 L19 27 L15.5 19 L23 19 Z" fill="#111" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>' +
    '</svg>';
  function Cursor(stage, camera, x, y, sp) {
    this.stage = stage;
    this.camera = camera;
    this.sp = sp || spring(0.42, 0.92);
    this.x = track(x, this.sp);
    this.y = track(y, this.sp);
    this.press = track(0, PRESET.press);
    this.downs = [];
    var el = document.createElement('div');
    var size = Math.round(52 * stage.unit);
    this.size = size;
    el.style.cssText = 'position:absolute;left:0;top:0;width:' + size + 'px;height:' + size + 'px;z-index:40;transform-origin:' + (6 / 32) * size + 'px ' + (3.5 / 32) * size + 'px';
    el.innerHTML = CURSOR_SVG;
    stage.overlay.appendChild(el);
    this.el = el;
  }
  Cursor.prototype.move = function (t, x, y, sp) { this.x.to(t, x, sp); this.y.to(t, y, sp); return this; };
  Cursor.prototype.down = function (t) { this.press.to(t, 1); this.downs.push([t, 'down']); return this; };
  Cursor.prototype.up = function (t) { this.press.to(t, 0); this.downs.push([t, 'up']); return this; };
  Cursor.prototype.click = function (t, hold) { return this.down(t).up(t + (hold == null ? 0.08 : hold)); };
  Cursor.prototype.pos = function (t) { return { x: this.x.at(t), y: this.y.at(t) }; };
  Cursor.prototype.apply = function (t) {
    var p = this.camera.toScreen(this.x.at(t), this.y.at(t), t);
    var k = 1 - 0.14 * this.press.at(t);
    var hx = (6 / 32) * this.size, hy = (3.5 / 32) * this.size;
    this.el.style.transform = 'translate(' + r3(p.x - hx) + 'px,' + r3(p.y - hy) + 'px) scale(' + k.toFixed(4) + ')';
  };
  function Shape(stage, s) {
    this.x = track(s.x || 0, s.sp);
    this.y = track(s.y || 0, s.sp);
    this.w = track(s.w, s.sp || PRESET.morph);
    this.h = track(s.h, s.sp || PRESET.morph);
    this.r = track(s.r, s.sp || PRESET.morph);
    this.k = track(1, PRESET.press); // stlačenie / zdvihnutie
    this.bg = color(s.bg || '#111111', s.colorSp || spring(0.26, 1));
    var el = document.createElement('div');
    el.className = 'pohyb-shape' + (s.className ? ' ' + s.className : '');
    el.style.cssText = 'position:absolute;left:0;top:0;overflow:hidden;';
    var ink = document.createElement('div');
    ink.className = 'pohyb-ink';
    ink.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;border-radius:50%;visibility:hidden;';
    el.appendChild(ink);
    this.inkEl = ink;
    this.inks = [];
    (s.parent || stage.world).appendChild(el);
    this.el = el;
  }
  Shape.prototype.ink = function (t, hex, ox, oy, sp) {
    this.inks.push({ t: t, hex: hex, ox: ox || 0, oy: oy || 0, sp: sp || spring(0.5, 1) });
    this.inks.sort(function (a, b) { return a.t - b.t; });
    return this;
  };
  Shape.prototype.to = function (t, s, sp) {
    sp = sp || PRESET.morph;
    if (s.w != null) this.w.to(t, s.w, sp);
    if (s.h != null) this.h.to(t, s.h, sp);
    if (s.r != null) this.r.to(t, s.r, sp);
    if (s.x != null) this.x.to(t, s.x, sp);
    if (s.y != null) this.y.to(t, s.y, sp);
    if (s.bg != null) this.bg.to(t, s.bg);
    return this;
  };
  Shape.prototype.apply = function (t) {
    var w = Math.max(0, this.w.at(t)), h = Math.max(0, this.h.at(t));
    var r = Math.max(0, Math.min(this.r.at(t), w / 2, h / 2));
    var st = this.el.style;
    st.width = r3(w) + 'px';
    st.height = r3(h) + 'px';
    st.borderRadius = r3(r) + 'px';
    var base = this.bg.at(t), layer = null;
    for (var i = 0; i < this.inks.length; i++) {
      var ik = this.inks[i];
      if (ik.t > t) break;
      var p = springStep(ik.sp, t - ik.t);
      if (p >= 1) { base = ik.hex; layer = null; } // kritické tlmenie: 1 presne až po dobehnutí
      else layer = { ik: ik, p: p };
    }
    st.background = base;
    var ie = this.inkEl.style;
    if (layer && layer.p > 0) {
      var cx = w / 2 + layer.ik.ox, cy = h / 2 + layer.ik.oy;
      var far = Math.max(Math.hypot(cx, cy), Math.hypot(w - cx, cy), Math.hypot(cx, h - cy), Math.hypot(w - cx, h - cy));
      var R = layer.p * far * 1.12; // pokryje tvar pri asi 90 %, prepnutie farby potom nie je vidieť
      ie.visibility = 'visible';
      ie.background = layer.ik.hex;
      ie.width = r3(2 * R) + 'px';
      ie.height = r3(2 * R) + 'px';
      ie.transform = 'translate(' + r3(cx - R) + 'px,' + r3(cy - R) + 'px)';
    } else {
      ie.visibility = 'hidden';
      ie.background = 'none';
      ie.width = '0px';
      ie.height = '0px';
      ie.transform = 'none';
    }
    st.transform = 'translate(' + r3(this.x.at(t) - w / 2) + 'px,' + r3(this.y.at(t) - h / 2) + 'px) scale(' + this.k.at(t).toFixed(4) + ')';
    return { w: w, h: h, r: r };
  };
  function applyPresence(el, pr, t) {
    var v = pr.at(t);
    var st = el.style;
    if (!v.visible) {
      st.visibility = 'hidden';
      st.opacity = '0';
      st.filter = 'none';
      st.transform = 'translate(-50%,-50%)';
      return v;
    }
    st.visibility = 'visible';
    st.opacity = v.opacity.toFixed(4);
    st.filter = v.blur > 0.05 ? 'blur(' + v.blur.toFixed(2) + 'px)' : 'none';
    st.transform = 'translate(-50%,-50%) translateY(' + r3(v.y) + 'px) scale(' + v.scale.toFixed(4) + ')';
    return v;
  }
  function stagger(presences, t, step, sp) {
    return presences.map(function (p, i) { var ti = t + i * step; p.enter(ti, sp); return ti; });
  }
  function unfold(o) {
    var step = o.step == null ? 0.25 : o.step;
    var sp = o.sp || PRESET.morph;
    var lag = o.lag == null ? 0.06 : o.lag;
    var times = [];
    for (var i = 0; i < o.heights.length; i++) {
      var ti = o.t + i * step;
      var h = o.heights[i];
      o.shape.to(ti, { h: h, y: o.top + h / 2 }, sp);
      if (o.rows && o.rows[i]) o.rows[i].enter(ti + lag);
      if (o.cam && o.frameOf) o.cam.frame(ti, o.frameOf(h), o.fill);
      times.push(ti);
    }
    return times;
  }
  function r3(x) { return Math.round(x * 1000) / 1000; }
  function beats(bpm) { var b = 60 / bpm; return function (n) { return n * b; }; }
  function peak(fn, t0, t1, step) {
    step = step || 1 / 480;
    var best = t0, bv = -Infinity;
    for (var t = t0; t <= t1; t += step) {
      var v = fn(t);
      if (v > bv) { bv = v; best = t; }
    }
    return Math.round(best * 1000) / 1000;
  }
  function define(def) {
    var D = def.duration;
    var api = {
      duration: D,
      bpm: def.bpm || 120,
      seekRaw: function (t) { def.seek(t); },
      seek: function (t) { def.seek(((t % D) + D) % D); },
      meta: function () {
        var sounds = (def.sounds || []).map(function (s) {
          var t = typeof s.at === 'function' ? s.at() : s.t;
          return { t: Math.round(t * 1000) / 1000, type: s.type, gain: s.gain == null ? 1 : s.gain, note: s.note || '' };
        });
        return { duration: D, bpm: api.bpm, music: def.music || {}, sounds: sounds, title: def.title || '' };
      },
      ready: (typeof document !== 'undefined' && document.fonts ? document.fonts.ready : Promise.resolve()).then(function () {
        return typeof document !== 'undefined' && document.fonts ? document.fonts.check('600 40px "ARLing Sans"') : true;
      }),
    };
    root.__pohyb = api;
    api.seek(0);
    if (typeof location !== 'undefined' && !params().render && typeof requestAnimationFrame === 'function') {
      var t0 = null, paused = false, pausedAt = 0;
      root.addEventListener('keydown', function (e) {
        if (e.code === 'Space') { paused = !paused; if (!paused) t0 = null; }
      });
      var loop = function (now) {
        if (!paused) {
          if (t0 == null) t0 = now - pausedAt * 1000;
          pausedAt = (now - t0) / 1000;
          api.seek(pausedAt);
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
    return api;
  }
  var Pohyb = {
    spring: spring, PRESET: PRESET, springDisp: springDisp, springStep: springStep,
    track: track, Track: Track, color: color, indicator: indicator, presence: presence,
    applyPresence: applyPresence, Stage: Stage, Camera: Camera, Cursor: Cursor, Shape: Shape,
    safeRect: safeRect, layout: layout, isTall: isTall, TALL: TALL, beats: beats, peak: peak, define: define,
    stagger: stagger, unfold: unfold,
    _oklab: { rgbToOklab: rgbToOklab, oklabToRgb: oklabToRgb, hexToRgb: hexToRgb },
  };
  root.Pohyb = Pohyb;
  if (typeof module !== 'undefined' && module.exports) module.exports = Pohyb;
})(typeof window !== 'undefined' ? window : globalThis);
