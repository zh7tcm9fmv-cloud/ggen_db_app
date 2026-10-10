/* Unit detail Holo Card — WebGL2 port of React Bits HoloCard (MIT).
 * Defaults match reactbits.dev preview: preset=shards, foilColor=#e2e6ec (silver).
 */
(function (global) {
  'use strict';

  var PERSPECTIVE = 1100;
  var PRESET_SHARDS = 2;
  var DEFAULT_FOIL = '#e2e6ec';
  var VERTEX = "#version 300 es\nin vec2 position;\nvoid main() {\n gl_Position = vec4(position, 0.0, 1.0);\n}\n";
  var FRAGMENT = "#version 300 es\nprecision highp float;\n\nuniform sampler2D uArt;\nuniform vec2 uSize;\nuniform float uAspect;\nuniform vec2 uTilt;\nuniform vec2 uLight;\nuniform float uDistance;\nuniform int uPreset;\nuniform float uIntensity;\nuniform float uScale;\nuniform float uEdge;\nuniform float uFrame;\nuniform float uRadius;\nuniform float uGlare;\nuniform vec3 uFoil;\nuniform float uReady;\n\nout vec4 outColor;\n\nconst float TAU = 6.28318530718;\n\nstruct Foil {\n float mask;\n float angle;\n float jitter;\n vec2 facet;\n};\n\nfloat hash(vec2 p) {\n p = fract(p * vec2(234.34, 435.345));\n p += dot(p, p + 34.23);\n return fract(p.x * p.y);\n}\n\nvec2 hash2(vec2 p) {\n return vec2(hash(p), hash(p + 17.31));\n}\n\nvec3 hue(float t) {\n t = abs(fract(t * 0.5) * 2.0 - 1.0);\n vec3 c = mix(vec3(0.1, 0.25, 1.0), vec3(0.0, 0.85, 1.0), smoothstep(0.0, 0.25, t));\n c = mix(c, vec3(0.25, 1.0, 0.2), smoothstep(0.25, 0.45, t));\n c = mix(c, vec3(1.0, 0.92, 0.05), smoothstep(0.45, 0.65, t));\n c = mix(c, vec3(1.0, 0.45, 0.05), smoothstep(0.65, 0.85, t));\n return mix(c, vec3(0.95, 0.12, 0.3), smoothstep(0.85, 1.0, t));\n}\n\nFoil bursts(vec2 p) {\n vec2 q = mat2(0.7071068, 0.7071068, -0.7071068, 0.7071068) * (p - vec2(0.5, 0.5 * uAspect)) / (0.283 / uScale);\n vec2 d = fract(q) - 0.5;\n float u = length(d) / 0.49;\n float angle = atan(d.y, d.x);\n if (u < 0.12) {\n float ring = min(floor(u / 0.045 + 0.5), 2.0);\n float count = max(1.0, ring * 6.0);\n float spot = (floor(angle / TAU * count) + 0.5) / count * TAU;\n vec2 dot = vec2(cos(spot), sin(spot)) * ring * 0.045;\n float m = smoothstep(0.024, 0.012, length(d / 0.49 - dot));\n return Foil(m, angle, 0.5, vec2(0.0));\n }\n bool inner = u < 0.66;\n float slot = angle / TAU * (inner ? 56.0 : 72.0);\n bool shifted = mod(floor(slot), 2.0) > 0.5;\n vec2 band = inner ? (shifted ? vec2(0.45, 0.61) : vec2(0.33, 0.49)) : (shifted ? vec2(0.84, 0.99) : vec2(0.7, 0.85));\n float across = abs(u - (band.x + band.y) * 0.5) / ((band.y - band.x) * 0.5);\n float along = abs(fract(slot) - 0.5) * 2.0;\n float width = inner ? 0.72 : 0.6;\n float m = smoothstep(1.0, 0.78, across) * smoothstep(width, width - 0.2, along);\n return Foil(m, angle, 0.5, vec2(0.0));\n}\n\nFoil stars(vec2 p) {\n Foil best = Foil(0.0, 0.0, 0.0, vec2(0.0));\n vec2 g = p / (0.08 / uScale);\n vec2 base = floor(g);\n for (int j = -1; j <= 1; j++) {\n for (int i = -1; i <= 1; i++) {\n vec2 id = base + vec2(float(i), float(j));\n float pick = hash(id + 1.3);\n vec2 d = g - (id + 0.5 + (hash2(id) - 0.5) * 0.55);\n float m = smoothstep(0.07, 0.035, length(d));\n if (pick < 0.62) {\n float size = mix(0.16, 0.5, pow(hash(id + 9.0), 1.8));\n float sector = TAU / (pick < 0.3 ? 4.0 : 5.0);\n float k = abs(fract((atan(d.y, d.x) + hash(id + 4.0) * TAU) / sector) - 0.5) * 2.0;\n float edge = size * mix(1.0, 0.36, pow(k, 0.6));\n m = smoothstep(edge, edge * 0.8, length(d));\n }\n if (m > best.mask) best = Foil(m, hash(id + 6.0) * TAU, hash(id + 8.0), (hash2(id + 2.0) - 0.5) * 0.6);\n }\n }\n return best;\n}\n\nFoil shards(vec2 p) {\n vec2 g = p * 19.0 * uScale;\n vec2 base = floor(g);\n float best = 9.0;\n float second = 9.0;\n vec2 id = base;\n for (int j = -1; j <= 1; j++) {\n for (int i = -1; i <= 1; i++) {\n vec2 cell = base + vec2(float(i), float(j));\n float d = length(cell + 0.08 + hash2(cell) * 0.84 - g);\n if (d < best) {\n second = best;\n best = d;\n id = cell;\n } else if (d < second) {\n second = d;\n }\n }\n }\n float crack = smoothstep(0.015, 0.07, second - best);\n float shine = 0.25 + 0.75 * pow(hash(id + 7.7), 2.0);\n return Foil((0.2 + 0.8 * crack) * shine, hash(id + 3.17) * TAU, hash(id + 11.73), (hash2(id + 5.0) - 0.5) * 0.5);\n}\n\nFoil cosmos(vec2 p) {\n Foil best = Foil(0.0, 0.0, 0.0, vec2(0.0));\n vec2 g = p / (0.16 / uScale);\n vec2 base = floor(g);\n for (int j = -1; j <= 1; j++) {\n for (int i = -1; i <= 1; i++) {\n vec2 id = base + vec2(float(i), float(j));\n vec2 d = g - (id + 0.5 + (hash2(id) - 0.5) * 0.7);\n float size = mix(0.16, 0.52, hash(id + 2.0));\n float r = length(d);\n float m = max(smoothstep(0.05, 0.0, abs(r - size)), smoothstep(size, size - 0.04, r) * 0.22);\n if (m > best.mask) best = Foil(m, hash(id + 6.0) * TAU + atan(d.y, d.x) * 0.5, hash(id + 1.0), (hash2(id + 4.0) - 0.5) * 0.5);\n }\n }\n vec2 fine = p / (0.035 / uScale);\n vec2 cell = floor(fine);\n float dots = smoothstep(0.2, 0.1, length(fine - cell - 0.5 - (hash2(cell + 9.0) - 0.5) * 0.6)) * step(0.55, hash(cell + 2.0));\n if (dots > best.mask) best = Foil(dots, hash(cell) * TAU, hash(cell + 3.0), (hash2(cell + 7.0) - 0.5) * 0.6);\n return best;\n}\n\nFoil rainbow(vec2 p) {\n return Foil(0.86 + 0.14 * hash(floor(p * 700.0 * uScale)), 0.2, 0.5, vec2(0.0));\n}\n\nFoil swirl(vec2 p) {\n vec2 d = p - vec2(0.5, 0.42 * uAspect);\n float angle = atan(d.y, d.x);\n float rays = 0.55 + 0.45 * smoothstep(0.3, 0.7, abs(fract(angle / TAU * 60.0 * uScale) - 0.5) * 2.0);\n return Foil(rays, angle, length(d), vec2(0.0));\n}\n\nFoil glitter(vec2 p) {\n vec2 g = p * 72.0 * uScale;\n vec2 cell = floor(g);\n float size = mix(0.18, 0.4, hash(cell + 3.0));\n float m = smoothstep(size, size * 0.55, length(fract(g) - 0.5 - (hash2(cell) - 0.5) * 0.5)) * step(0.25, hash(cell + 5.0));\n return Foil(m, hash(cell + 7.0) * TAU, hash(cell + 9.0), (hash2(cell + 11.0) - 0.5) * 0.9);\n}\n\nFoil gold(vec2 p) {\n Foil flake = glitter(p * 0.8);\n if (flake.mask > 0.5) return flake;\n float etch = 0.55 + 0.45 * smoothstep(0.2, 0.8, abs(fract((p.x * 0.6 + p.y) * 140.0 * uScale) - 0.5) * 2.0);\n return Foil(etch, 0.9, 0.4, vec2(0.0));\n}\n\nvec3 sparkles(vec2 p, vec3 halfway, vec2 sweep, float awake) {\n vec2 g = p * 62.0;\n vec2 cell = floor(g);\n vec2 d = fract(g) - 0.5 - (hash2(cell) - 0.5) * 0.36;\n float spin = hash(cell + 3.0) * TAU;\n d = mat2(cos(spin), -sin(spin), sin(spin), cos(spin)) * d;\n vec2 a = abs(d);\n float hexagon = max(a.x * 0.866 + a.y * 0.5, a.y);\n float size = mix(0.22, 0.38, hash(cell + 2.0));\n float piece = smoothstep(size, size - 0.07, hexagon) * step(0.42, hash(cell + 4.0));\n vec3 facet = normalize(vec3((hash2(cell + 6.0) - 0.5) * 0.9, 1.0));\n float flash = pow(max(dot(facet, halfway), 0.0), 6.0);\n vec3 tint = hue(dot(sweep, vec2(cos(spin), sin(spin))) * 1.2 + dot(sweep, vec2(0.8, 0.6)) * 0.8 + hash(cell + 8.0) * 0.5);\n vec3 color = piece * tint * (0.3 + 1.6 * flash) * awake;\n vec2 fine = p * 210.0;\n vec2 speckCell = floor(fine);\n float speck = smoothstep(0.24, 0.0, length(fract(fine) - 0.5 - (hash2(speckCell) - 0.5) * 0.5)) * step(0.72, hash(speckCell + 1.0));\n float speckFlash = pow(max(dot(normalize(vec3((hash2(speckCell + 2.0) - 0.5) * 0.9, 1.0)), halfway), 0.0), 10.0);\n return color + vec3(1.2) * speck * speckFlash * (1.0 - piece);\n}\n\nvoid main() {\n vec2 uv = vec2(gl_FragCoord.x / uSize.x, 1.0 - gl_FragCoord.y / uSize.y);\n vec2 p = vec2(uv.x, uv.y * uAspect);\n vec2 center = vec2(0.5, 0.5 * uAspect);\n vec2 q = abs(p - center) - center + uRadius;\n float outside = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;\n float pixel = 1.0 / uSize.x;\n float alpha = clamp(0.5 - outside / pixel, 0.0, 1.0);\n vec4 sampled = texture(uArt, uv);\n if (uReady > 0.5) alpha *= sampled.a;\n if (alpha <= 0.0) {\n outColor = vec4(0.0);\n return;\n }\n vec3 art = uReady > 0.5 ? pow(sampled.rgb, vec3(2.2)) : vec3(0.12);\n\n mat3 rx = mat3(1.0, 0.0, 0.0, 0.0, cos(uTilt.x), sin(uTilt.x), 0.0, -sin(uTilt.x), cos(uTilt.x));\n mat3 ry = mat3(cos(uTilt.y), 0.0, -sin(uTilt.y), 0.0, 1.0, 0.0, sin(uTilt.y), 0.0, cos(uTilt.y));\n mat3 turn = rx * ry;\n vec3 world = turn * vec3(p - center, 0.0);\n vec3 view = normalize(transpose(turn) * (vec3(0.0, 0.0, uDistance) - world));\n vec3 lamp = vec3((uLight - 0.5) * vec2(1.1, 1.1 * uAspect), 0.9);\n vec3 light = normalize(transpose(turn) * (lamp - world));\n vec3 halfway = normalize(light + view);\n vec2 sweep = light.xy + view.xy;\n float sheen = pow(max(halfway.z, 0.0), 10.0);\n float shine = pow(max(halfway.z, 0.0), 80.0);\n float frame = 1.0 - smoothstep(uFrame - pixel, uFrame + pixel, -outside);\n\n Foil f;\n if (uPreset == 0) f = bursts(p);\n else if (uPreset == 1) f = stars(p);\n else if (uPreset == 2) f = shards(p);\n else if (uPreset == 3) f = cosmos(p);\n else if (uPreset == 4) f = rainbow(p);\n else if (uPreset == 5) f = swirl(p);\n else if (uPreset == 6) f = glitter(p);\n else f = gold(p);\n\n vec3 metal = uPreset == 7 ? vec3(1.0, 0.74, 0.38) * dot(uFoil, vec3(0.3333)) * 1.15 : uFoil;\n vec4 look = uPreset == 0 ? vec4(0.25, 1.9, 0.12, 1.0)\n : uPreset == 1 ? vec4(0.6, 1.4, 0.3, 1.0)\n : uPreset == 2 ? vec4(0.9, 0.9, 0.6, 0.5)\n : uPreset == 3 ? vec4(0.7, 1.2, 0.35, 0.85)\n : uPreset == 4 ? vec4(0.0, 2.2, 0.0, 0.45)\n : uPreset == 5 ? vec4(1.6, 0.3, 0.0, 0.4)\n : uPreset == 6 ? vec4(0.9, 1.0, 0.6, 1.0)\n : vec4(0.3, 1.0, 0.2, 0.95);\n vec2 dir = vec2(cos(f.angle), sin(f.angle));\n float phase = dot(sweep, dir) * look.x + dot(sweep, vec2(0.8, 0.6)) * look.y + f.jitter * look.z;\n float spoke = 1.0;\n if (uPreset == 5) {\n float facing = dot(normalize(sweep + 0.0001), dir);\n phase = f.jitter * 2.4 + facing * 0.6 + length(sweep) * 0.8;\n spoke = 0.3 + 0.7 * smoothstep(0.25, 0.95, abs(facing));\n }\n vec3 tint = hue(phase);\n if (uPreset == 7) tint = mix(tint, metal, 0.65);\n float glint = pow(max(dot(normalize(vec3(f.facet, 1.0)), halfway), 0.0), 24.0) * step(0.001, length(f.facet));\n bool layered = uPreset == 2 || uPreset == 4 || uPreset == 5 || uPreset == 7;\n vec3 foil = (layered ? tint : mix(tint, vec3(1.0), 0.12)) * (1.15 + 0.3 * sheen) + metal * glint * 1.2;\n float tilted = smoothstep(0.02, 0.21, length(sin(uTilt)));\n float awake = mix(0.2, 1.0, tilted);\n float strength = uIntensity * f.mask * (1.0 - frame) * awake;\n float band = uPreset == 5 ? spoke : layered ? 0.25 + 0.75 * smoothstep(0.3, 0.95, 0.5 + 0.5 * cos(phase * TAU * 0.5 + 1.3)) : 1.0;\n vec3 color = layered\n ? 1.0 - (1.0 - art) * (1.0 - clamp(foil * look.w * band * strength, 0.0, 1.0))\n : mix(art, foil, clamp(strength * look.w, 0.0, 1.0));\n color += sparkles(p, halfway, sweep, mix(0.55, 1.0, tilted)) * uEdge * frame;\n color += uFoil * sheen * 0.12 * frame;\n color += vec3(sheen * 0.07 + shine * 0.3) * uGlare;\n color = pow(clamp(color, 0.0, 1.0), vec3(1.0 / 2.2));\n outColor = vec4(color * alpha, alpha);\n}\n";

  function clamp(n, a, b) {
    return n < a ? a : n > b ? b : n;
  }

  function parseFoilColor(value) {
    var fallback = [0.78, 0.8, 0.84];
    try {
      var ctx = document.createElement('canvas').getContext('2d');
      if (!ctx) return fallback;
      ctx.fillStyle = '#000000';
      ctx.fillStyle = value || DEFAULT_FOIL;
      var resolved = ctx.fillStyle;
      if (!resolved || resolved.charAt(0) !== '#' || resolved.length !== 7) return fallback;
      return [1, 3, 5].map(function (i) {
        return Math.pow(parseInt(resolved.slice(i, i + 2), 16) / 255, 2.2);
      });
    } catch (_) {
      return fallback;
    }
  }

  function compile(gl, type, source) {
    var shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    gl.deleteShader(shader);
    return null;
  }

  function spring(value, velocity, target, stiffness, damping, dt) {
    var next = velocity + ((target - value) * stiffness - velocity * damping) * dt;
    return [value + next * dt, next];
  }

  function drawContain(ctx, img, w, h) {
    ctx.clearRect(0, 0, w, h);
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    var scale = Math.min(w / iw, h / ih);
    var dw = iw * scale;
    var dh = ih * scale;
    var dx = (w - dw) * 0.5;
    var dy = (h - dh) * 0.5;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  /**
   * @param {HTMLElement} card .unit-holo-card
   * @param {{foilColor?: string, preset?: number, intensity?: number}} [opts]
   */
  function ensureStage(card) {
    var stage = card.querySelector('.unit-holo-card__stage');
    if (stage) return stage;
    var img = card.querySelector('img.detail-portrait, .detail-portrait-placeholder');
    stage = document.createElement('div');
    stage.className = 'unit-holo-card__stage';
    if (img && img.parentNode === card) {
      card.insertBefore(stage, img);
      stage.appendChild(img);
    } else if (img && img.parentNode) {
      img.parentNode.insertBefore(stage, img);
      stage.appendChild(img);
    } else {
      card.insertBefore(stage, card.firstChild);
    }
    return stage;
  }

  function ensureEdge(card) {
    if (card.querySelector('.border-glow-edge')) return;
    var edge = document.createElement('span');
    edge.className = 'border-glow-edge';
    edge.setAttribute('aria-hidden', 'true');
    card.appendChild(edge);
  }

  function unwrapStage(card, stage) {
    if (!stage || !card) return;
    try {
      var kids = stage.querySelectorAll('img.detail-portrait, .detail-portrait-placeholder');
      for (var ki = 0; ki < kids.length; ki++) {
        card.insertBefore(kids[ki], stage);
      }
      if (stage.parentNode) stage.parentNode.removeChild(stage);
    } catch (_) {}
    try {
      var eg = card.querySelector('.border-glow-edge');
      if (eg && eg.parentNode) eg.parentNode.removeChild(eg);
    } catch (_) {}
  }

  /** CSS border-glow only (no WebGL) — still returns destroy so toggle works on iOS. */
  function mountCssOnly(card, opts, reduced) {
    opts = opts || {};
    ensureEdge(card);
    var stage = ensureStage(card);
    var img = stage.querySelector('img.detail-portrait, img');
    if (!img) {
      unwrapStage(card, stage);
      return null;
    }
    var pointer = { x: 0.5, y: 0.5, inside: false };
    function readPointer(e) {
      var rect = card.getBoundingClientRect();
      var w = rect.width || 1;
      var h = rect.height || 1;
      pointer.x = clamp((e.clientX - rect.left) / w, 0, 1);
      pointer.y = clamp((e.clientY - rect.top) / h, 0, 1);
    }
    function syncGlow() {
      if (!pointer.inside) {
        card.style.setProperty('--edge-proximity', '0');
        card.classList.remove('is-holo-active');
        return;
      }
      var nx = Math.abs(pointer.x - 0.5) * 2;
      var ny = Math.abs(pointer.y - 0.5) * 2;
      var edge = Math.min(1, Math.max(nx, ny)) * 100;
      var deg = (Math.atan2(pointer.y - 0.5, pointer.x - 0.5) * 180) / Math.PI + 90;
      if (deg < 0) deg += 360;
      card.style.setProperty('--edge-proximity', edge.toFixed(2));
      card.style.setProperty('--cursor-angle', deg.toFixed(2) + 'deg');
      card.classList.add('is-holo-active');
    }
    function onDown(e) {
      if (e.isPrimary === false) return;
      if (e.button != null && e.button !== 0) return;
      readPointer(e);
      pointer.inside = true;
      syncGlow();
    }
    function onMove(e) {
      if (e.pointerType === 'touch' && !e.buttons) return;
      readPointer(e);
      pointer.inside = true;
      syncGlow();
    }
    function onUp() {
      pointer.inside = false;
      syncGlow();
    }
    card.addEventListener('pointerdown', onDown);
    card.addEventListener('pointermove', onMove, { passive: true });
    card.addEventListener('pointerup', onUp);
    card.addEventListener('pointercancel', onUp);
    card.addEventListener('pointerleave', onUp);
    function destroy() {
      card.removeEventListener('pointerdown', onDown);
      card.removeEventListener('pointermove', onMove);
      card.removeEventListener('pointerup', onUp);
      card.removeEventListener('pointercancel', onUp);
      card.removeEventListener('pointerleave', onUp);
      card.classList.remove('is-holo-active');
      unwrapStage(card, stage);
      card._ggenHolo = null;
    }
    var api = { destroy: destroy, reload: function () {}, settings: { cssOnly: true, reduced: !!reduced } };
    card._ggenHolo = api;
    return api;
  }

  function mount(card, opts) {
    opts = opts || {};
    if (!card || card._ggenHolo) return null;

    var reduced = false;
    try {
      reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (_) {}

    /* Probe WebGL2 before wrapping the portrait (failed probe used to leave a broken stage). */
    var probe = document.createElement('canvas');
    var glProbe = null;
    try {
      glProbe = probe.getContext('webgl2', {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false
      });
    } catch (_) {
      glProbe = null;
    }
    if (!glProbe) return mountCssOnly(card, opts, reduced);

    var stage = ensureStage(card);
    var img = stage.querySelector('img.detail-portrait, img');
    if (!stage || !img) return null;

    ensureEdge(card);

    var canvas = stage.querySelector('canvas.unit-holo-card__canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'unit-holo-card__canvas';
      canvas.setAttribute('aria-hidden', 'true');
      stage.appendChild(canvas);
    }

    var gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false
    });
    if (!gl) {
      try {
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      } catch (_) {}
      unwrapStage(card, stage);
      return mountCssOnly(card, opts, reduced);
    }

    var vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    var fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    if (!vertex || !fragment) {
      unwrapStage(card, stage);
      return mountCssOnly(card, opts, reduced);
    }
    var program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.bindAttribLocation(program, 0, 'position');
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      unwrapStage(card, stage);
      return mountCssOnly(card, opts, reduced);
    }

    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 0])
    );

    var uniforms = {};
    [
      'uArt',
      'uSize',
      'uAspect',
      'uTilt',
      'uLight',
      'uDistance',
      'uPreset',
      'uIntensity',
      'uScale',
      'uEdge',
      'uFrame',
      'uRadius',
      'uGlare',
      'uFoil',
      'uReady'
    ].forEach(function (name) {
      uniforms[name] = gl.getUniformLocation(program, name);
    });

    var foil = parseFoilColor(opts.foilColor || DEFAULT_FOIL);
    var settings = {
      preset: opts.preset != null ? opts.preset : PRESET_SHARDS,
      intensity: clamp(opts.intensity != null ? opts.intensity : 0.85, 0, 1),
      scale: clamp(opts.scale != null ? opts.scale : 1, 0.25, 4),
      edgeSparkle: clamp(opts.edgeSparkle != null ? opts.edgeSparkle : 0.8, 0, 1),
      frame: clamp(opts.frame != null ? opts.frame : 4, 0, 20) / 100,
      glare: clamp(opts.glare != null ? opts.glare : 0.5, 0, 1),
      foil: foil,
      radius: Math.max(0, opts.radius != null ? opts.radius : 10),
      /* Reduce Motion (common on iOS): keep foil, kill tilt/idle drift */
      tiltMax: reduced ? 0 : clamp(opts.tiltMax != null ? opts.tiltMax : 14, 0, 45),
      hoverScale: 1,
      idle: reduced ? false : opts.idle !== false
    };

    var state = {
      tiltX: 0,
      tiltY: 0,
      tiltVX: 0,
      tiltVY: 0,
      lightX: 0.36,
      lightY: 0.26,
      lightVX: 0,
      lightVY: 0,
      lift: 1,
      liftV: 0,
      clock: Math.random() * 40
    };
    var pointer = { x: 0.5, y: 0.5, inside: false };
    var textureReady = false;
    var raf = 0;
    var last = 0;
    var visible = true;
    var alive = true;
    var calm = 0;
    var bake = document.createElement('canvas');
    var bakeCtx = bake.getContext('2d', { alpha: true });

    function draw() {
      var w = canvas.width;
      var h = canvas.height;
      if (!w || !h) return;
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(uniforms.uArt, 0);
      gl.uniform2f(uniforms.uSize, w, h);
      gl.uniform1f(uniforms.uAspect, h / w);
      gl.uniform2f(uniforms.uTilt, (state.tiltX * Math.PI) / 180, (state.tiltY * Math.PI) / 180);
      gl.uniform2f(uniforms.uLight, state.lightX, state.lightY);
      gl.uniform1f(uniforms.uDistance, PERSPECTIVE / Math.max(1, canvas.clientWidth));
      gl.uniform1i(uniforms.uPreset, settings.preset);
      gl.uniform1f(uniforms.uIntensity, settings.intensity);
      gl.uniform1f(uniforms.uScale, settings.scale);
      gl.uniform1f(uniforms.uEdge, settings.edgeSparkle);
      gl.uniform1f(uniforms.uFrame, settings.frame);
      gl.uniform1f(uniforms.uRadius, settings.radius / Math.max(1, canvas.clientWidth));
      gl.uniform1f(uniforms.uGlare, settings.glare);
      gl.uniform3f(uniforms.uFoil, settings.foil[0], settings.foil[1], settings.foil[2]);
      gl.uniform1f(uniforms.uReady, textureReady ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function uploadFromImg(sourceImg) {
      if (!bakeCtx || !sourceImg) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var cw = Math.max(1, Math.round(canvas.clientWidth * dpr));
      var ch = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (bake.width !== cw || bake.height !== ch) {
        bake.width = cw;
        bake.height = ch;
      }
      drawContain(bakeCtx, sourceImg, cw, ch);
      try {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bake);
        gl.generateMipmap(gl.TEXTURE_2D);
        textureReady = true;
        card.classList.add('is-holo-webgl');
        draw();
        wake();
      } catch (_) {
        textureReady = false;
      }
    }

    function loadTexture() {
      textureReady = false;
      var src = img.currentSrc || img.src;
      if (!src) return;
      var loader = new Image();
      loader.crossOrigin = 'anonymous';
      loader.decoding = 'async';
      loader.onload = function () {
        if (!alive) return;
        uploadFromImg(loader);
      };
      loader.onerror = function () {
        /* Same-origin /static fallback without CORS reload */
        if (img.complete && img.naturalWidth) uploadFromImg(img);
      };
      loader.src = src;
    }

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      var h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      if (textureReady) {
        var src = img.currentSrc || img.src;
        if (src) {
          var loader = new Image();
          loader.crossOrigin = 'anonymous';
          loader.onload = function () {
            if (alive) uploadFromImg(loader);
          };
          loader.onerror = function () {
            if (img.complete && img.naturalWidth) uploadFromImg(img);
          };
          loader.src = src;
        }
      }
      draw();
      wake();
    }

    function tick(now) {
      raf = 0;
      if (!alive) return;
      var dt = Math.min(1 / 30, Math.max(1 / 240, (now - last) / 1000));
      last = now;
      var targetX = 0;
      var targetY = 0;
      var lightX = 0.36;
      var lightY = 0.26;
      var lift = 1;
      var drifting = settings.idle && !pointer.inside;
      if (pointer.inside) {
        targetX = (0.5 - pointer.y) * 2 * settings.tiltMax;
        targetY = (pointer.x - 0.5) * 2 * settings.tiltMax;
        lightX = pointer.x;
        lightY = pointer.y;
        lift = settings.hoverScale;
      } else if (drifting) {
        state.clock += dt;
        var t = state.clock;
        targetX = Math.sin(t * 0.7) * settings.tiltMax * 0.28;
        targetY = Math.sin(t * 0.53 + 1.2) * settings.tiltMax * 0.4;
        lightX = 0.5 + Math.sin(t * 0.41) * 0.42;
        lightY = 0.38 + Math.sin(t * 0.33 + 0.6) * 0.3;
      }
      var steps = Math.ceil(dt / (1 / 240));
      var h = dt / steps;
      var i;
      for (i = 0; i < steps; i++) {
        var a = spring(state.tiltX, state.tiltVX, targetX, 150, 16, h);
        state.tiltX = a[0];
        state.tiltVX = a[1];
        a = spring(state.tiltY, state.tiltVY, targetY, 150, 16, h);
        state.tiltY = a[0];
        state.tiltVY = a[1];
        a = spring(state.lightX, state.lightVX, lightX, 220, 30, h);
        state.lightX = a[0];
        state.lightVX = a[1];
        a = spring(state.lightY, state.lightVY, lightY, 220, 30, h);
        state.lightY = a[0];
        state.lightVY = a[1];
        a = spring(state.lift, state.liftV, lift, 320, 30, h);
        state.lift = a[0];
        state.liftV = a[1];
      }
      stage.style.transform =
        'perspective(' +
        PERSPECTIVE +
        'px) scale(' +
        state.lift +
        ') rotateX(' +
        state.tiltX +
        'deg) rotateY(' +
        state.tiltY +
        'deg)';
      draw();

      /* Border-glow CSS vars (edge cone) */
      var edge = 0;
      if (pointer.inside) {
        var nx = Math.abs(pointer.x - 0.5) * 2;
        var ny = Math.abs(pointer.y - 0.5) * 2;
        edge = Math.min(1, Math.max(nx, ny)) * 100;
        var deg = (Math.atan2(pointer.y - 0.5, pointer.x - 0.5) * 180) / Math.PI + 90;
        if (deg < 0) deg += 360;
        card.style.setProperty('--edge-proximity', edge.toFixed(2));
        card.style.setProperty('--cursor-angle', deg.toFixed(2) + 'deg');
        card.classList.add('is-holo-active');
      } else {
        card.style.setProperty('--edge-proximity', '0');
        card.classList.remove('is-holo-active');
      }

      var motion =
        Math.abs(state.tiltVX) +
        Math.abs(state.tiltVY) +
        Math.abs(state.liftV) * 40 +
        (Math.abs(state.lightVX) + Math.abs(state.lightVY)) * 60 +
        Math.abs(state.tiltX - targetX) +
        Math.abs(state.tiltY - targetY);
      calm = motion > 0.02 ? 0 : calm + dt;
      if (!visible || (!drifting && !pointer.inside && calm > 0.3)) return;
      raf = requestAnimationFrame(tick);
    }

    function wake() {
      if (raf || !alive) return;
      calm = 0;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }

    function readPointer(e) {
      var rect = card.getBoundingClientRect();
      var w = rect.width || 1;
      var h = rect.height || 1;
      pointer.x = clamp((e.clientX - rect.left) / w, 0, 1);
      pointer.y = clamp((e.clientY - rect.top) / h, 0, 1);
    }
    function onEnter(e) {
      readPointer(e);
      pointer.inside = true;
      wake();
    }
    function onDown(e) {
      if (e.isPrimary === false) return;
      if (e.button != null && e.button !== 0) return;
      readPointer(e);
      pointer.inside = true;
      try {
        card.setPointerCapture(e.pointerId);
      } catch (_) {}
      wake();
    }
    function onMove(e) {
      /* Touch: only track while finger is down (buttons) or captured */
      if (e.pointerType === 'touch' && e.type === 'pointermove' && !e.buttons) return;
      readPointer(e);
      pointer.inside = true;
      wake();
    }
    function onUp(e) {
      if (e.isPrimary === false) return;
      pointer.inside = false;
      try {
        if (card.hasPointerCapture && card.hasPointerCapture(e.pointerId)) {
          card.releasePointerCapture(e.pointerId);
        }
      } catch (_) {}
      wake();
    }
    function onLeave() {
      pointer.inside = false;
      wake();
    }

    /* Foil tracking: mouse enter/move + touch press/drag (not hover-only). */
    card.addEventListener('pointerenter', onEnter);
    card.addEventListener('pointerdown', onDown);
    card.addEventListener('pointermove', onMove, { passive: true });
    card.addEventListener('pointerup', onUp);
    card.addEventListener('pointercancel', onUp);
    card.addEventListener('pointerleave', onLeave);

    var ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(stage);
    var io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(function (entries) {
            visible = entries.some(function (en) {
              return en.isIntersecting;
            });
            if (visible) wake();
          })
        : null;
    if (io) io.observe(card);

    /* Seed foil light without pointer-inside (no hoverScale lift on activate). */
    pointer.x = 0.5;
    pointer.y = 0.42;
    pointer.inside = false;
    state.lightX = 0.5;
    state.lightY = 0.42;

    if (img.complete && img.naturalWidth) loadTexture();
    else img.addEventListener('load', loadTexture, { once: true });
    resize();
    wake();

    function destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      card.removeEventListener('pointerenter', onEnter);
      card.removeEventListener('pointerdown', onDown);
      card.removeEventListener('pointermove', onMove);
      card.removeEventListener('pointerup', onUp);
      card.removeEventListener('pointercancel', onUp);
      card.removeEventListener('pointerleave', onLeave);
      if (ro) ro.disconnect();
      if (io) io.disconnect();
      card.classList.remove('is-holo-webgl', 'is-holo-active');
      stage.style.transform = '';
      try {
        if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      } catch (_) {}
      try {
        /* Unwrap portrait so cold shell matches normal detail again */
        var kids = stage.querySelectorAll('img.detail-portrait, .detail-portrait-placeholder');
        for (var ki = 0; ki < kids.length; ki++) {
          card.insertBefore(kids[ki], stage);
        }
        if (stage.parentNode) stage.parentNode.removeChild(stage);
      } catch (_) {}
      try {
        var eg = card.querySelector('.border-glow-edge');
        if (eg && eg.parentNode) eg.parentNode.removeChild(eg);
      } catch (_) {}
      try {
        gl.deleteTexture(texture);
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
      } catch (_) {}
      card._ggenHolo = null;
    }

    var api = { destroy: destroy, reload: loadTexture, settings: settings };
    card._ggenHolo = api;
    return api;
  }

  global.GgenUnitHoloCard = {
    mount: mount,
    DEFAULT_FOIL: DEFAULT_FOIL,
    PRESET_SHARDS: PRESET_SHARDS
  };
})(typeof window !== 'undefined' ? window : this);

