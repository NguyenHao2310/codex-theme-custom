/* Pixel engine: aqua2409z, MIT. See LICENSE. Codex Pixel Studio V2. */
(()=>{
'use strict';
// Pixel Chat Themes engine by aqua2409z, MIT. See LICENSE and THIRD_PARTY_NOTICES.md.
  const rnd = (a, b) => a + Math.random() * (b - a);
  const rint = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

  // Stable pseudo-random number in [0, 1) for integer coordinates.
  function hash(x, y, s) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1103515245);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function vgrad(c, w, h, stops) {
    const g = c.createLinearGradient(0, 0, 0, h);
    stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s));
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  }

  function rglow(c, x, y, r, hex, a) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(hex, a));
    g.addColorStop(1, rgba(hex, 0));
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // A sprite is ASCII art: every non-space char is a key into a palette of
  // [tileColor, glyphColor, fixedGlyph?, alpha?].
  function sprite(rows, pal) {
    const w = Math.max(...rows.map((r) => r.length));
    return { rows: rows.map((r) => r.padEnd(w)), w, h: rows.length, pal };
  }

  const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase().trim();

  /* ------------------------------------------------------------------ world */

  const FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

  class World {
    constructor(canvas) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      this.tiles = new Map();
      this.glows = new Map();
      this.s = {};
      this.t = 0;
      this.veil = 0;
      this.veilColor = '#ffffff';
    }

    resize(w, h, cell, dpr) {
      this.w = w;
      this.h = h;
      this.cell = cell;
      this.dpr = dpr;
      this.cv.width = Math.max(1, Math.round(w * dpr));
      this.cv.height = Math.max(1, Math.round(h * dpr));
      this.cols = Math.ceil(w / cell);
      this.rows = Math.ceil(h / cell);
      this.glyphsOn = cell >= 8;
      this.tiles.clear();
      this.under = this.over = null;
    }

    setTheme(th) {
      this.th = th;
      this.s = {};
      this.t = 0;
      this.tiles.clear();
      this.under = this.over = null;
      th.init(this);
    }

    // Static parts of a scene are drawn once into an offscreen layer.
    layer(fn) {
      const c = document.createElement('canvas');
      c.width = this.cv.width;
      c.height = this.cv.height;
      const x = c.getContext('2d');
      x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const prev = this.ctx;
      this.ctx = x;
      try {
        fn(x);
      } finally {
        this.ctx = prev;
      }
      return c;
    }

    draw(dt) {
      const th = this.th;
      const ctx = this.ctx;
      if (!th) return;
      this.t += dt;
      if (!this.under) {
        this.under = this.layer((c) => {
          th.bg(c, this.w, this.h, this);
          if (th.under) th.under(this);
        });
      }
      if (th.over && !this.over) this.over = this.layer(() => th.over(this));

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(this.under, 0, 0);
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      th.frame(this, dt);
      if (this.over) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(this.over, 0, 0);
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      }
      if (this.veil > 0) {
        ctx.globalAlpha = this.veil;
        ctx.fillStyle = this.veilColor;
        ctx.fillRect(0, 0, this.w, this.h);
        ctx.globalAlpha = 1;
      }
    }

    // One tile = rounded square + glyph, rendered once and reused.
    img(bg, fg, ch) {
      const key = bg + '|' + fg + '|' + ch;
      let c = this.tiles.get(key);
      if (c) return c;
      if (this.tiles.size > 900) this.tiles.clear();
      const s = this.cell;
      const px = Math.max(1, Math.ceil(s * this.dpr));
      c = document.createElement('canvas');
      c.width = c.height = px;
      const x = c.getContext('2d');
      x.scale(px / s, px / s);
      if (bg) {
        const gap = s > 6 ? Math.max(1, s * 0.09) : 0.5;
        const r = s > 6 ? s * 0.16 : 0;
        x.fillStyle = bg;
        if (r && x.roundRect) {
          x.beginPath();
          x.roundRect(gap / 2, gap / 2, s - gap, s - gap, r);
          x.fill();
        } else {
          x.fillRect(gap / 2, gap / 2, s - gap, s - gap);
        }
      }
      if (ch && fg && this.glyphsOn) {
        x.fillStyle = fg;
        x.font = `600 ${Math.round(s * 0.7)}px ${FONT}`;
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.fillText(ch, s / 2, s / 2 + s * 0.05);
      } else if (ch && fg && !bg) {
        const d = Math.max(1, s * 0.4);
        x.fillStyle = fg;
        x.fillRect((s - d) / 2, (s - d) / 2, d, d);
      }
      this.tiles.set(key, c);
      return c;
    }

    tile(x, y, bg, fg, ch, a = 1) {
      x = Math.round(x);
      y = Math.round(y);
      if (a <= 0.01 || x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
      const ctx = this.ctx;
      ctx.globalAlpha = a > 1 ? 1 : a;
      ctx.drawImage(this.img(bg, fg, ch), x * this.cell, y * this.cell, this.cell, this.cell);
      ctx.globalAlpha = 1;
    }

    glyph(x, y, ch, fg, a) {
      this.tile(x, y, null, fg, ch, a);
    }

    ch(i, j, seed) {
      const g = this.th.glyphs;
      return g[(hash(i, j, seed) * g.length) | 0];
    }

    sprite(sp, x, y, o = {}) {
      const X = Math.round(x);
      const Y = Math.round(y);
      const pal = o.pal || sp.pal;
      const a = o.a == null ? 1 : o.a;
      const seed = o.seed || 0;
      for (let j = 0; j < sp.h; j++) {
        const row = sp.rows[j];
        for (let i = 0; i < sp.w; i++) {
          const p = pal[row[i]];
          if (!p) continue;
          const gx = X + (o.flip ? sp.w - 1 - i : i);
          this.tile(gx, Y + j, p[0], p[1], p[2] != null ? p[2] : this.ch(i, j, seed), a * (p[3] == null ? 1 : p[3]));
        }
      }
    }

    glow(x, y, r, hex, a) {
      if (a <= 0.01) return;
      let g = this.glows.get(hex);
      if (!g) {
        g = document.createElement('canvas');
        g.width = g.height = 64;
        rglow(g.getContext('2d'), 32, 32, 32, hex, 1);
        this.glows.set(hex, g);
      }
      const c = this.cell;
      const R = r * c;
      this.ctx.globalAlpha = clamp(a, 0, 1);
      this.ctx.drawImage(g, (x + 0.5) * c - R, (y + 0.5) * c - R, R * 2, R * 2);
      this.ctx.globalAlpha = 1;
    }

    dot(x, y, color, a, size = 0.3) {
      if (a <= 0.01) return;
      const c = this.cell;
      const d = Math.max(1, c * size);
      this.ctx.globalAlpha = clamp(a, 0, 1);
      this.ctx.fillStyle = color;
      this.ctx.fillRect(Math.round(x) * c + (c - d) / 2, Math.round(y) * c + (c - d) / 2, d, d);
      this.ctx.globalAlpha = 1;
    }
  }

  /* ---------------------------------------------------------------- sprites */

  const CLOUD_DAY = { c: ['#ffffff', '#a9c1d6'], e: ['#eef6fd', '#c3d5e5'] };
  const CLOUD_NIGHT = { c: ['#27306e', '#323d86'], e: ['#222a61', '#2c3678'] };

  // Flat-bottomed cloud made of a few overlapping ellipses.
  function cloudRows(w, h) {
    const E = [{ x: w / 2, y: h - h * 0.32, rx: w / 2, ry: h * 0.34 }];
    for (let k = rint(2, 4); k > 0; k--) {
      const rx = rnd(w * 0.16, w * 0.3);
      E.push({ x: rnd(rx * 0.9, w - rx * 0.9), y: h - h * 0.4 - rnd(0, h * 0.2), rx, ry: Math.min(rx * 0.8, h * 0.6) });
    }
    const inside = (i, j) => E.some((e) => ((i + 0.5 - e.x) / e.rx) ** 2 + ((j + 0.5 - e.y) / e.ry) ** 2 <= 1);
    const rows = [];
    for (let j = 0; j < h; j++) {
      let r = '';
      for (let i = 0; i < w; i++) {
        if (!inside(i, j)) r += ' ';
        else r += !inside(i - 1, j) || !inside(i + 1, j) || !inside(i, j - 1) || !inside(i, j + 1) ? 'e' : 'c';
      }
      rows.push(r);
    }
    return rows;
  }

  function cloud(w, anywhere, pal) {
    const z = Math.random();
    const cw = Math.round(clamp(w.cols * 0.12, 7, 16) + z * clamp(w.cols * 0.14, 4, 16));
    const ch = Math.max(3, Math.round(cw * rnd(0.3, 0.42)));
    return {
      sp: sprite(cloudRows(cw, ch), pal),
      z,
      x: anywhere ? rnd(-cw, w.cols) : -cw - rnd(0, w.cols * 0.3),
      y: rnd(-1, w.rows * 0.85 - ch),
      v: 0.35 + z * 1.2,
      a: 0.55 + z * 0.45,
      seed: rint(1, 1e6),
    };
  }

  const TURTLE_PAL = {
    S: ['#2f8a58', '#1f6a42'],
    s: ['#a3d06c', '#78a847'],
    h: ['#8dd27f', '#5ba454'],
    f: ['#72bf76', '#4d9a52'],
    e: ['#17322a', null, ''],
  };
  const TURTLE = [
    sprite(['      ff      ', '    SSSSSf    ', '  SsSSsSSS he ', ' SSsSSsSSSShhh', '  SsSSsSSS hh ', '    SSSSSf    ', '      ff      '], TURTLE_PAL),
    sprite(['        ff    ', '    SSSSSff   ', '  SsSSsSSS he ', ' SSsSSsSSSShhh', '  SsSSsSSS hh ', '    SSSSSff   ', '        ff    '], TURTLE_PAL),
  ];

  const FISH = sprite(['t yyy ', 'tyyyey', 't yyy '], {
    y: ['#ffd23f', '#f2a900'],
    t: ['#ffb000', '#d98a00'],
    e: ['#1b2f4a', null, ''],
  });

  const CORALS = [
    ['#ff7d8c', '#d6566a', '#ffb3bd'],
    ['#ff9f5a', '#d77a33', '#ffc79c'],
    ['#c79bff', '#9c70e0', '#e2cdff'],
    ['#ff6fb3', '#d9468d', '#ffacd4'],
  ];

  const KOI = [
    sprite(['     f     ', 't  ooWWoo  ', 'ttoWWooWWoo', '   ooWWoo  ', '     f     '], null),
    sprite(['     f     ', '   ooWWoo  ', 'ttoWWooWWoo', 't  ooWWoo  ', '     f     '], null),
  ];
  const koiPal = (o, W, t) => ({ o, W, t: [t, o[1], '', 0.85], f: [W[0], W[1], '', 0.6] });
  const KOI_PALS = [
    koiPal(['#e8533a', '#b83a25'], ['#fff6ec', '#e3d2bf'], '#ff8a6b'),
    koiPal(['#ffb21f', '#d98e00'], ['#ffe39a', '#e2c066'], '#ffc94d'),
    koiPal(['#ff7b2e', '#cf5617'], ['#2b2b2b', '#4a4a4a'], '#ff9a5c'),
    koiPal(['#f4f3ee', '#cfcdc4'], ['#ffffff', '#dddddd'], '#ffffff'),
  ];

  const JELLY = [
    sprite(['   bbb   ', ' bBBBBBb ', 'bBBbBbBBb', 'b b b b b', ' t  t  t ', '  t  t  t', ' t  t  t ', '  t  t   '], null),
    sprite(['   bbb   ', '  bBBBb  ', ' bBbBbBb ', '  b b b  ', '  t t t  ', '  t t t  ', '   t t t ', '  t t t  ', '   t t   '], null),
  ];
  const JELLY_COLS = [
    ['#ff8fc8', '#ffd1e8'],
    ['#b49cff', '#e0d6ff'],
    ['#74dcff', '#c9f2ff'],
    ['#ffb08a', '#ffe0cf'],
  ];
  const jellyPal = (m, l) => ({ B: [m, l, null, 0.9], b: [l, m, null, 0.8], t: [null, l, '|', 0.7] });

  const BOAT = sprite(['    m    ', '    mM   ', '   mmMM  ', '  mmmMMM ', 'hhhhhhhhh', ' hhhhhhh ', '  hhhhh  '], null);
  const boatPal = (a, b, c) => ({ m: [a, c], M: [b, c], h: [a, c] });
  const BOAT_PALS = [
    boatPal('#ffffff', '#e4ecef', '#b9c7ce'),
    boatPal('#fff3c4', '#f0e0a0', '#cdb877'),
    boatPal('#ffe1ea', '#f4c8d6', '#d39bb0'),
  ];

  const CODE_LINES = [
    'const theme = "pixel";',
    '$ npm run dev',
    '=> ready in 312ms',
    'git commit -m "wip"',
    '<Chat theme={t} />',
    'fn render() {',
    '}',
    '// TODO: sleep',
    'ok',
    '[ok] 42 tests passed',
  ];

  /* ----------------------------------------------------------------- themes */

  const THEMES = [];

  THEMES.push({
    id: 'code',
    name: 'Claude Code',
    dark: true,
    alias: ['claude', 'terminal', 'spark'],
    glyphs: '{}<>/$_;:=+*',
    bg(c, w, h) {
      vgrad(c, w, h, ['#24211f', '#1b1a18', '#141312']);
      rglow(c, w * 0.7, h * 0.42, Math.max(w, h) * 0.45, '#d97757', 0.13);
    },
    init(w) {
      const s = w.s;
      const line = (any) => {
        const txt = pick(CODE_LINES);
        return { txt, x: rint(0, Math.max(0, w.cols - txt.length)), y: any ? rnd(0, w.rows) : w.rows + rnd(0, 4), v: rnd(0.3, 0.8), a: rnd(0.25, 0.6) };
      };
      s.line = line;
      s.lines = Array.from({ length: Math.round(clamp((w.cols * w.rows) / 220, 3, 26)) }, () => line(true));
      s.embers = Array.from({ length: Math.round(clamp((w.cols * w.rows) / 260, 4, 30)) }, () => ({ x: rnd(0, w.cols), y: rnd(0, w.rows), v: rnd(0.6, 1.6), ph: rnd(0, 6) }));
    },
    frame(w, dt) {
      const s = w.s;
      for (let i = 0; i < s.lines.length; i++) {
        const l = s.lines[i];
        l.y -= l.v * dt;
        if (l.y < -1) s.lines[i] = s.line(false);
        for (let k = 0; k < l.txt.length; k++) if (l.txt[k] !== ' ') w.glyph(l.x + k, l.y, l.txt[k], '#6b625a', l.a);
      }
      for (const e of s.embers) {
        e.y -= e.v * dt;
        e.x += Math.sin(w.t * 1.5 + e.ph) * 0.4 * dt;
        if (e.y < -1) {
          e.y = w.rows + 1;
          e.x = rnd(0, w.cols);
        }
        w.dot(e.x, e.y, '#ff9a66', 0.25 + 0.45 * Math.abs(Math.sin(w.t * 2 + e.ph)), 0.32);
      }
      // Pulsing pixel spark.
      const cx = Math.round(w.cols * 0.7);
      const cy = Math.round(w.rows * 0.42);
      const R = clamp(Math.round(Math.min(w.cols, w.rows) * 0.12), 3, 9);
      const rot = w.t * 0.06;
      const seen = new Set();
      w.glow(cx, cy, R * 2.4, '#d97757', 0.32 + 0.08 * Math.sin(w.t * 2));
      for (let k = 0; k < 10; k++) {
        const a = rot + (k / 10) * Math.PI * 2;
        const L = R + Math.round(Math.sin(w.t * 1.7 + k * 2.1) * 1.3) - (k % 2);
        for (let i = 1; i <= L; i++) {
          const x = cx + Math.round(Math.cos(a) * i);
          const y = cy + Math.round(Math.sin(a) * i);
          const key = x * 4096 + y;
          if (seen.has(key)) continue;
          seen.add(key);
          w.tile(x, y, i === L ? '#f4a27e' : '#d97757', '#a24e2f', w.ch(k, i, 3));
        }
      }
      w.tile(cx, cy, '#e98a63', '#a24e2f', '*');
    },
  });

  THEMES.push({
    id: 'cloud',
    name: 'Cloud Drift',
    dark: false,
    alias: ['may', 'troi', 'sky', 'clouds'],
    glyphs: 't%i:;tt%',
    bg(c, w, h) {
      vgrad(c, w, h, ['#86c3f2', '#b3dbf8', '#d9eefc']);
      const g = c.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.3)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    },
    init(w) {
      const s = w.s;
      s.clouds = Array.from({ length: Math.round(clamp((w.cols * w.rows) / 700, 3, 10)) }, () => cloud(w, true, CLOUD_DAY));
      s.dust = Array.from({ length: Math.round(clamp((w.cols * w.rows) / 200, 6, 40)) }, () => ({ x: rnd(0, w.cols), y: rnd(0, w.rows), v: rnd(0.2, 0.6), ph: rnd(0, 6) }));
    },
    frame(w, dt) {
      const s = w.s;
      for (const d of s.dust) {
        d.y -= d.v * dt;
        if (d.y < -1) {
          d.y = w.rows + 1;
          d.x = rnd(0, w.cols);
        }
        w.dot(d.x + Math.sin(w.t * 0.7 + d.ph) * 0.8, d.y, '#ffffff', 0.5, 0.22);
      }
      s.clouds.sort((a, b) => a.z - b.z);
      for (let i = 0; i < s.clouds.length; i++) {
        const c = s.clouds[i];
        c.x += c.v * dt;
        if (c.x > w.cols + 1) s.clouds[i] = cloud(w, false, CLOUD_DAY);
        w.sprite(c.sp, c.x, c.y, { a: c.a, seed: c.seed });
      }
    },
  });

  function sandH(x, seed) {
    return 2 + Math.round(0.8 + Math.sin(x * 0.13 + seed) * 0.9 + hash(x, 0, seed) * 0.8);
  }

  function turtle(w, any) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    return { dir, x: any ? rnd(0, w.cols) : dir > 0 ? -15 : w.cols + 1, y0: rnd(2, w.rows * 0.6), v: rnd(1.2, 2), ph: rnd(0, 6) };
  }

  function school(w, any) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    return {
      dir,
      x: any ? rnd(0, w.cols) : dir > 0 ? -12 : w.cols + 8,
      y: rnd(3, w.rows * 0.7),
      v: rnd(2.5, 4),
      fish: Array.from({ length: rint(3, 6) }, () => ({ dx: rnd(-6, 6), dy: rnd(-3, 3), ph: rnd(0, 6) })),
    };
  }

  THEMES.push({
    id: 'lagoon',
    name: 'Honu Lagoon',
    dark: false,
    alias: ['rua', 'honu', 'bien', 'sea', 'turtle'],
    glyphs: '~o.:*',
    bg(c, w, h) {
      vgrad(c, w, h, ['#6fdad4', '#34b6c4', '#1b86a3']);
      rglow(c, w * 0.5, -h * 0.1, h * 0.9, '#ffffff', 0.25);
    },
    init(w) {
      const s = w.s;
      const C = w.cols;
      const R = w.rows;
      s.seed = rint(1, 1e5);
      s.coral = Array.from({ length: Math.round(clamp(C / 12, 2, 10)) }, () => {
        const x0 = rint(1, C - 2);
        const cells = [];
        for (let b = rint(2, 4); b > 0; b--) {
          let x = x0 + rint(-2, 2);
          const L = rint(2, 6);
          for (let i = 0; i < L; i++) {
            cells.push([x, i, i === L - 1]);
            if (Math.random() < 0.3) x += pick([-1, 1]);
          }
        }
        return { x0, cells, col: pick(CORALS) };
      });
      s.weed = Array.from({ length: Math.round(clamp(C / 8, 3, 16)) }, () => ({ x: rint(0, C - 1), h: rint(3, Math.max(4, Math.round(R * 0.28))), ph: rnd(0, 6) }));
      s.turtles = Array.from({ length: C > 70 ? 2 : 1 }, () => turtle(w, true));
      s.schools = Array.from({ length: C > 70 ? 3 : 2 }, () => school(w, true));
      s.bubbles = Array.from({ length: Math.round(clamp(C / 5, 5, 30)) }, () => ({ x: rnd(0, C), y: rnd(0, R), v: rnd(1, 2.5), ph: rnd(0, 6) }));
    },
    under(w) {
      const s = w.s;
      for (let x = 0; x < w.cols; x++) {
        const top = w.rows - sandH(x, s.seed);
        for (let y = top; y < w.rows; y++) w.tile(x, y, y === top ? '#fae8bf' : '#f5dda4', '#dfc07c', w.ch(x, y, 5));
      }
      for (const c of s.coral) {
        const base = w.rows - sandH(c.x0, s.seed) - 1;
        for (const [x, up, tip] of c.cells) w.tile(x, base - up, tip ? c.col[2] : c.col[0], c.col[1], tip ? 'o' : w.ch(x, up, 6));
      }
    },
    frame(w, dt) {
      const s = w.s;
      const ctx = w.ctx;
      // Soft light rays.
      ctx.fillStyle = '#ffffff';
      for (let k = 0; k < 4; k++) {
        const x0 = ((k + 0.5) / 4) * w.w + Math.sin(w.t * 0.2 + k) * 30;
        const sp = w.w * 0.04;
        ctx.globalAlpha = 0.05 + 0.035 * Math.sin(w.t * 0.5 + k * 2);
        ctx.beginPath();
        ctx.moveTo(x0 - sp, 0);
        ctx.lineTo(x0 + sp, 0);
        ctx.lineTo(x0 + sp * 3 - w.h * 0.3, w.h);
        ctx.lineTo(x0 - sp * 2 - w.h * 0.3, w.h);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      for (const g of s.weed) {
        const base = w.rows - sandH(g.x, s.seed) - 1;
        for (let k = 0; k < g.h; k++) {
          const off = Math.round(Math.sin(w.t * 1.2 + g.ph + k * 0.5) * (k / g.h) * 1.6);
          w.tile(g.x + off, base - k, k > g.h - 2 ? '#6fd08c' : '#3daa6a', '#2a8752', w.ch(g.x, k, 8));
        }
      }
      for (let i = 0; i < s.schools.length; i++) {
        const sc = s.schools[i];
        sc.x += sc.dir * sc.v * dt;
        if (sc.x > w.cols + 10 || sc.x < -16) s.schools[i] = school(w, false);
        for (const f of sc.fish) w.sprite(FISH, sc.x + f.dx, sc.y + f.dy + Math.sin(w.t * 2 + f.ph) * 0.5, { flip: sc.dir < 0, seed: 2 });
      }
      for (let i = 0; i < s.turtles.length; i++) {
        const t = s.turtles[i];
        t.x += t.dir * t.v * dt;
        if (t.x > w.cols + 2 || t.x < -16) s.turtles[i] = turtle(w, false);
        const fr = Math.floor(w.t * 2 + t.ph) % 2;
        w.sprite(TURTLE[fr], t.x, t.y0 + Math.sin(w.t * 0.5 + t.ph) * 1.5, { flip: t.dir < 0, seed: 9 });
      }
      for (const b of s.bubbles) {
        b.y -= b.v * dt;
        if (b.y < -1) {
          b.y = w.rows + rnd(0, 5);
          b.x = rnd(0, w.cols);
        }
        w.glyph(b.x + Math.sin(w.t * 2 + b.ph) * 0.6, b.y, b.v > 1.8 ? 'o' : '°', '#effffd', 0.65);
      }
    },
  });

  THEMES.push({
    id: 'koi',
    name: 'Koi Pond',
    dark: true,
    alias: ['ca', 'ca koi', 'ho', 'pond'],
    glyphs: '~:.o',
    bg(c, w, h) {
      vgrad(c, w, h, ['#13706a', '#0d5458', '#093b42']);
      rglow(c, w * 0.3, h * 0.3, Math.max(w, h) * 0.5, '#3fd1b4', 0.12);
    },
    init(w) {
      const s = w.s;
      const C = w.cols;
      const R = w.rows;
      s.koi = Array.from({ length: Math.round(clamp((C * R) / 700, 2, 9)) }, () => ({
        x: rnd(4, Math.max(5, C - 14)),
        y: rnd(2, Math.max(3, R - 6)),
        a: rnd(0, 6.28),
        v: rnd(1.3, 2.4),
        turn: 0,
        pal: pick(KOI_PALS),
        ph: rnd(0, 6),
      }));
      s.pads = Array.from({ length: Math.round(clamp((C * R) / 500, 3, 12)) }, () => ({
        x: Math.round(rnd(0, C)),
        y: Math.round(rnd(0, R)),
        r: rint(2, C > 60 ? 4 : 3),
        n: rnd(0, 6.28),
        lotus: Math.random() < 0.3,
      }));
      s.ripples = [];
      s.next = 0.5;
      s.specks = Array.from({ length: Math.round(clamp((C * R) / 120, 10, 60)) }, () => ({ x: rnd(0, C), y: rnd(0, R), ph: rnd(0, 6) }));
    },
    over(w) {
      for (const p of w.s.pads) {
        for (let pass = 0; pass < 2; pass++) {
          for (let dy = -p.r; dy <= p.r; dy++) {
            for (let dx = -p.r; dx <= p.r; dx++) {
              const d = Math.hypot(dx, dy);
              if (d > p.r + 0.35) continue;
              if (d > 0.8 && Math.abs(angDiff(Math.atan2(dy, dx), p.n)) < 0.45) continue;
              if (pass === 0) {
                w.tile(p.x + dx + 1, p.y + dy + 1, '#04262a', null, '', 0.35);
              } else {
                const edge = d > p.r - 0.65;
                w.tile(p.x + dx, p.y + dy, edge ? '#57ba68' : '#3f9c51', edge ? '#3f9c51' : '#2d7a3d', w.ch(dx, dy, 13));
              }
            }
          }
        }
        if (p.lotus) {
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) w.tile(p.x + dx, p.y + dy, '#ff9fcb', '#e0679d', w.ch(dx, dy, 4));
          w.tile(p.x, p.y, '#ffe27a', '#e0b93f', '*');
        }
      }
    },
    frame(w, dt) {
      const s = w.s;
      for (const p of s.specks) w.dot(p.x, p.y, '#a6efe0', 0.15 + 0.2 * Math.sin(w.t * 1.3 + p.ph), 0.25);

      s.next -= dt;
      if (s.next <= 0) {
        s.ripples.push({ x: rnd(0, w.cols), y: rnd(0, w.rows), r: 0, m: rnd(3, 6) });
        s.next = rnd(0.8, 2.2);
      }
      s.ripples = s.ripples.filter((r) => (r.r += 2.2 * dt) < r.m);
      for (const r of s.ripples) {
        const n = Math.max(6, Math.round(r.r * 6.3));
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          w.dot(r.x + Math.cos(a) * r.r, r.y + Math.sin(a) * r.r, '#c8f7ee', 0.55 * (1 - r.r / r.m), 0.35);
        }
      }

      for (const k of s.koi) {
        k.turn = clamp(k.turn + rnd(-1, 1) * dt * 1.2, -0.7, 0.7);
        k.a += k.turn * dt;
        if (k.x < 3 || k.x > w.cols - 14 || k.y < 1 || k.y > w.rows - 6) {
          k.a += angDiff(Math.atan2(w.rows / 2 - k.y, w.cols / 2 - k.x), k.a) * Math.min(1, dt * 2);
        }
        k.x += Math.cos(k.a) * k.v * dt;
        k.y += Math.sin(k.a) * k.v * dt * 0.7;
        w.sprite(KOI[Math.floor(w.t * 3 + k.ph) % 2], k.x, k.y, { flip: Math.cos(k.a) < 0, pal: k.pal, seed: 5 });
      }
    },
  });

  function jelly(w, any) {
    const col = pick(JELLY_COLS);
    return { x: rnd(0, Math.max(1, w.cols - 9)), y: any ? rnd(0, w.rows) : w.rows + rnd(0, 6), v: rnd(0.6, 1.2), ph: rnd(0, 1), pal: jellyPal(col[0], col[1]), col: col[0] };
  }

  THEMES.push({
    id: 'jelly',
    name: 'Jellyfish',
    dark: true,
    alias: ['sua', 'jellyfish', 'deep', 'dai duong'],
    glyphs: '~*.:o',
    bg(c, w, h) {
      vgrad(c, w, h, ['#0b3c6b', '#072a52', '#030f24']);
      rglow(c, w * 0.5, -h * 0.15, h, '#5bb6ff', 0.2);
    },
    init(w) {
      const s = w.s;
      s.j = Array.from({ length: Math.round(clamp((w.cols * w.rows) / 600, 2, 10)) }, () => jelly(w, true));
      s.snow = Array.from({ length: Math.round(clamp((w.cols * w.rows) / 90, 10, 80)) }, () => ({ x: rnd(0, w.cols), y: rnd(0, w.rows), v: rnd(0.2, 0.6), ph: rnd(0, 6) }));
    },
    frame(w, dt) {
      const s = w.s;
      for (const p of s.snow) {
        p.y += p.v * dt;
        if (p.y > w.rows + 1) {
          p.y = -1;
          p.x = rnd(0, w.cols);
        }
        w.dot(p.x + Math.sin(w.t * 0.5 + p.ph), p.y, '#bfe6ff', 0.35, 0.22);
      }
      for (let i = 0; i < s.j.length; i++) {
        const j = s.j[i];
        const push = (w.t * 0.7 * j.v + j.ph) % 1 < 0.3;
        j.y -= (push ? 2.4 : 0.45) * j.v * dt;
        j.x += Math.sin(w.t * 0.35 + j.ph * 6) * 0.3 * dt;
        if (j.y < -10) s.j[i] = jelly(w, false);
        w.glow(j.x + 4, j.y + 1.5, 5.5, j.col, 0.28);
        w.sprite(JELLY[push ? 1 : 0], j.x, j.y, { pal: j.pal, seed: 3 });
      }
    },
  });

  function boat(w, any) {
    return { x: any ? rnd(-9, w.cols) : -10, base: rint(Math.round(w.rows * 0.25), Math.max(Math.round(w.rows * 0.25), w.rows - 8)), v: rnd(0.5, 1.1), ph: rnd(0, 6), pal: pick(BOAT_PALS) };
  }

  THEMES.push({
    id: 'boats',
    name: 'Paper Boats',
    dark: false,
    alias: ['thuyen', 'thuyen giay', 'boat'],
    glyphs: '~-.',
    bg(c, w, h) {
      vgrad(c, w, h, ['#d4f4ee', '#9fdfd8', '#63c2c4']);
      rglow(c, w * 0.8, h * 0.05, h * 0.6, '#ffffff', 0.35);
    },
    init(w) {
      const s = w.s;
      const top = Math.round(w.rows * 0.22);
      s.bands = [];
      for (let y = top; y < w.rows; y += rint(3, 5)) s.bands.push({ y, k: s.bands.length, v: rnd(0.4, 1.2) * (s.bands.length % 2 ? -1 : 1), off: rnd(0, 100) });
      s.boats = Array.from({ length: Math.round(clamp((w.cols * w.rows) / 900, 2, 8)) }, () => boat(w, true)).sort((a, b) => a.base - b.base);
      s.glints = Array.from({ length: Math.round(clamp((w.cols * w.rows) / 200, 6, 40)) }, () => ({ x: rint(0, w.cols), y: rint(top, w.rows), ph: rnd(0, 6) }));
    },
    frame(w, dt) {
      const s = w.s;
      for (const b of s.bands) {
        b.off += b.v * dt;
        for (let x = 0; x < w.cols; x++) {
          const u = Math.floor(x + b.off);
          if (hash(u, b.k, 9) > 0.3) continue;
          w.tile(x, b.y + Math.round(Math.sin(u * 0.4 + w.t * 0.8) * 0.5), 'rgba(255,255,255,0.32)', '#ffffff', '~', 0.9);
        }
      }
      for (const g of s.glints) w.glyph(g.x, g.y, '+', '#ffffff', Math.max(0, Math.sin(w.t * 2 + g.ph)) * 0.8);
      for (const b of s.boats) {
        b.x += b.v * dt;
        if (b.x > w.cols + 1) b.x = -10;
        const y = b.base + Math.sin(w.t * 1.3 + b.ph) * 0.6;
        for (let i = 1; i < 8; i++) w.tile(b.x + i, y + 7, '#145a64', null, '', 0.18);
        w.sprite(BOAT, b.x, y, { pal: b.pal, seed: 4 });
      }
    },
  });

  THEMES.push({
    id: 'fireflies',
    name: 'Fireflies',
    dark: true,
    alias: ['dom dom', 'domdom', 'firefly', 'rung', 'forest'],
    glyphs: '|/\\^.',
    bg(c, w, h) {
      vgrad(c, w, h, ['#061210', '#0a1c16', '#0f2a1e']);
      rglow(c, w * 0.15, h * 0.1, h * 0.5, '#9bd88a', 0.07);
    },
    init(w) {
      const s = w.s;
      s.seed = rint(1, 1e5);
      s.f = Array.from({ length: Math.round(clamp((w.cols * w.rows) / 140, 8, 60)) }, () => ({
        x: rnd(0, w.cols),
        y: rnd(0, w.rows * 0.9),
        vx: rnd(-0.5, 0.5),
        vy: rnd(-0.3, 0.3),
        ph: rnd(0, 6),
        f: rnd(0.8, 2),
      }));
    },
    under(w) {
      const C = w.cols;
      const R = w.rows;
      const seed = w.s.seed;
      for (let x = 0; x < C; x++) {
        const hf = Math.round(R * 0.26 + Math.sin(x * 0.08 + seed) * 2.2 + Math.sin(x * 0.21) * 1.2 + hash(x, 1, seed) * 1.4);
        for (let y = R - hf; y < R; y++) w.tile(x, y, '#0e261a', '#133222', w.ch(x, y, 3));
      }
      for (let k = Math.round(clamp(C / 10, 3, 14)); k > 0; k--) {
        const px = Math.round(hash(k, 2, seed) * C);
        const ph = Math.round(R * (0.3 + hash(k, 3, seed) * 0.18));
        for (let j = 0; j < ph; j++) {
          const half = Math.floor(j * 0.32);
          for (let dx = -half; dx <= half; dx++) w.tile(px + dx, R - ph + j, '#0b2016', '#10291b', w.ch(dx, j, 7));
        }
      }
      for (let x = 0; x < C; x++) {
        const hn = Math.round(R * 0.1 + Math.sin(x * 0.3 + seed) + hash(x, 4, seed) * 1.5);
        for (let y = R - hn; y < R; y++) w.tile(x, y, '#08150e', '#0c1f14', w.ch(x, y, 9));
      }
    },
    frame(w, dt) {
      for (const f of w.s.f) {
        f.vx = clamp(f.vx + rnd(-1, 1) * dt, -0.7, 0.7);
        f.vy = clamp(f.vy + rnd(-1, 1) * dt, -0.5, 0.5);
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        if (f.x < 0 || f.x > w.cols) {
          f.vx = -f.vx;
          f.x = clamp(f.x, 0, w.cols);
        }
        if (f.y < 1 || f.y > w.rows - 2) {
          f.vy = -f.vy;
          f.y = clamp(f.y, 1, w.rows - 2);
        }
        let b = Math.sin(w.t * f.f + f.ph);
        b = b > 0 ? b * b : 0;
        w.glow(f.x, f.y, 2.8, '#d9ff6e', b * 0.5);
        w.tile(f.x, f.y, '#f1ffa6', '#a9cf3a', '·', 0.2 + 0.8 * b);
      }
    },
  });

  function moonGeo(w) {
    return {
      sea: Math.round(w.rows * 0.8),
      mx: Math.round(w.cols * 0.78),
      my: Math.max(3, Math.round(w.rows * 0.2)),
      mr: clamp(Math.round(Math.min(w.cols, w.rows) * 0.08), 2, 7),
    };
  }

  THEMES.push({
    id: 'moon',
    name: 'Moonlit',
    dark: true,
    alias: ['trang', 'dem', 'night', 'moonlit'],
    glyphs: '+*.:',
    bg(c, w, h, W) {
      const g = moonGeo(W);
      vgrad(c, w, h, ['#0a1036', '#141c50', '#26306e']);
      const sy = g.sea * W.cell;
      const sea = c.createLinearGradient(0, sy, 0, h);
      sea.addColorStop(0, '#111a4c');
      sea.addColorStop(1, '#070b28');
      c.fillStyle = sea;
      c.fillRect(0, sy, w, h - sy);
      rglow(c, (g.mx + 0.5) * W.cell, (g.my + 0.5) * W.cell, g.mr * W.cell * 5, '#fff2c4', 0.22);
    },
    init(w) {
      const s = w.s;
      const g = moonGeo(w);
      s.stars = [];
      for (let i = Math.round(clamp((w.cols * w.rows) / 70, 15, 160)); i > 0; i--) {
        const x = rint(0, w.cols - 1);
        const y = rint(0, Math.max(0, g.sea - 2));
        if (Math.hypot(x - g.mx, y - g.my) < g.mr + 2) continue;
        s.stars.push({ x, y, ch: pick(['.', '+', '*', ':']), ph: rnd(0, 6), f: rnd(0.6, 2) });
      }
      s.clouds = Array.from({ length: Math.round(clamp(w.cols / 25, 2, 5)) }, () => {
        const c = cloud(w, true, CLOUD_NIGHT);
        c.y = rnd(0, g.sea * 0.6);
        c.v *= 0.4;
        c.a *= 0.75;
        return c;
      });
      s.shoot = null;
      s.next = rnd(2, 6);
    },
    under(w) {
      const g = moonGeo(w);
      for (let dy = -g.mr; dy <= g.mr; dy++) {
        for (let dx = -g.mr; dx <= g.mr; dx++) {
          const d = Math.hypot(dx, dy);
          if (d > g.mr + 0.3) continue;
          const crater = hash(dx, dy, 11) < 0.16 && d < g.mr - 0.8;
          w.tile(g.mx + dx, g.my + dy, crater ? '#eadb9f' : d > g.mr - 0.7 ? '#fff9e3' : '#fff2c7', '#e0cf8e', crater ? 'o' : w.ch(dx, dy, 2));
        }
      }
    },
    frame(w, dt) {
      const s = w.s;
      const g = moonGeo(w);
      for (const st of s.stars) w.glyph(st.x, st.y, st.ch, '#e8ecff', 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(w.t * st.f + st.ph)));
      for (const c of s.clouds) {
        c.x += c.v * dt;
        if (c.x > w.cols + 1) c.x = -c.sp.w - rnd(0, 10);
        w.sprite(c.sp, c.x, c.y, { a: c.a, seed: c.seed });
      }

      s.next -= dt;
      if (!s.shoot && s.next <= 0) s.shoot = { x: rnd(w.cols * 0.3, w.cols), y: rnd(0, g.sea * 0.4), vx: -rnd(16, 24), vy: rnd(6, 10), life: 0 };
      if (s.shoot) {
        const sh = s.shoot;
        sh.life += dt;
        sh.x += sh.vx * dt;
        sh.y += sh.vy * dt;
        const len = Math.hypot(sh.vx, sh.vy);
        for (let i = 0; i < 9; i++) w.tile(sh.x - (sh.vx / len) * i, sh.y - (sh.vy / len) * i, i ? '#cfd8ff' : '#ffffff', '#9fb0ff', '', (1 - i / 9) * (1 - sh.life / 1.4));
        if (sh.life > 1.4 || sh.y > g.sea) {
          s.shoot = null;
          s.next = rnd(4, 10);
        }
      }

      const tick = Math.floor(w.t * 4);
      for (let y = g.sea + 1; y < w.rows; y++) {
        const d = y - g.sea;
        const dir = y % 2 ? 1 : -1;
        for (let x = 0; x < w.cols; x++) {
          if (hash(Math.floor(x + w.t * 0.7 * dir), y, 21) < 0.07) w.glyph(x, y, '~', '#4a57a8', 0.7);
        }
        const spread = 1 + d * 0.7;
        for (let x = Math.floor(g.mx - spread); x <= g.mx + spread; x++) {
          if (hash(x, y, tick) < 0.32) w.tile(x, y, '#fff0b8', '#e2cf86', '~', 0.6 - d * 0.03);
        }
      }
    },
  });

  // Vietnam's flag: 2:3, red field, a yellow five-pointed star in the middle
  // whose centre-to-tip radius is 1/5 of the flag's length, one point up.
  const FLAG_RED = [
    ['#9e1712', '#7f120e'],
    ['#b31b15', '#921611'],
    ['#c72019', '#a51a14'],
    ['#da251d', '#b51f18'],
    ['#e8382c', '#c52c22'],
    ['#f2503f', '#d23e31'],
    ['#fa6a55', '#dc5545'],
  ];
  const FLAG_YELLOW = [
    ['#c7b000', '#9c8900'],
    ['#dac400', '#ac9800'],
    ['#ecd800', '#bda800'],
    ['#ffea00', '#cfb800'],
    ['#fff23d', '#dcc81a'],
    ['#fff76b', '#e4d244'],
    ['#fffa99', '#ebdc6e'],
  ];

  function inStar(x, y, cx, cy, R) {
    const r = R * 0.381966;
    let inside = false;
    for (let k = 0, j = 9; k < 10; j = k++) {
      const ak = -Math.PI / 2 + (k * Math.PI) / 5;
      const aj = -Math.PI / 2 + (j * Math.PI) / 5;
      const rk = k % 2 ? r : R;
      const rj = j % 2 ? r : R;
      const xk = cx + Math.cos(ak) * rk;
      const yk = cy + Math.sin(ak) * rk;
      const xj = cx + Math.cos(aj) * rj;
      const yj = cy + Math.sin(aj) * rj;
      if (yk > y !== yj > y && x < ((xj - xk) * (y - yk)) / (yj - yk) + xk) inside = !inside;
    }
    return inside;
  }

  function flagGeo(w) {
    const horizon = Math.round(w.rows * 0.8);
    const top = Math.max(2, Math.round(w.rows * 0.12));
    // Phones get a bigger share of the width so the star stays readable.
    const narrow = w.cols < 60;
    const L = Math.round(clamp(Math.min(w.cols * (narrow ? 0.55 : 0.34), ((horizon - top - 3) * 3) / 2), 9, 48));
    const H = Math.round((L * 2) / 3);
    const px = Math.round(clamp(narrow ? w.cols - L - 3 : w.cols * 0.62, 2, w.cols - L - 2));
    return { horizon, top, L, H, px };
  }

  // Limestone karst towers (Ha Long style): steep sides, rounded tops.
  function karstHeights(cols, peaks) {
    const hs = new Array(cols).fill(0);
    for (const p of peaks) {
      for (let x = Math.floor(p.x - p.w * 1.3); x <= Math.ceil(p.x + p.w * 1.3); x++) {
        if (x < 0 || x >= cols) continue;
        // Lean: the left and right flanks fall at different rates.
        const dx = x + 0.5 - p.x;
        const d = Math.abs(dx) / (p.w * (dx < 0 ? 1 + p.lean : 1 - p.lean));
        if (d >= 1) continue;
        // Steep flanks, a broad rounded crown.
        hs[x] = Math.max(hs[x], Math.round(p.h * Math.pow(1 - Math.pow(d, 2.6), 0.55)));
      }
    }
    return hs;
  }

  THEMES.push({
    id: 'vn',
    name: 'Việt Nam',
    dark: false,
    veilScale: 0.5,
    alias: ['co', 'co do', 'co viet nam', 'co do sao vang', 'viet nam', 'vietnam', 'quoc ky', 'to quoc', 'flag'],
    glyphs: ':.;',
    bg(c, w, h, W) {
      const g = flagGeo(W);
      const hy = g.horizon * W.cell;
      const sky = c.createLinearGradient(0, 0, 0, hy);
      sky.addColorStop(0, '#4f9fe0');
      sky.addColorStop(0.55, '#9fd2f2');
      sky.addColorStop(1, '#ffe0b0');
      c.fillStyle = sky;
      c.fillRect(0, 0, w, hy);
      const sea = c.createLinearGradient(0, hy, 0, h);
      sea.addColorStop(0, '#6fb7cc');
      sea.addColorStop(1, '#2c7896');
      c.fillStyle = sea;
      c.fillRect(0, hy, w, h - hy);
      rglow(c, w * 0.82, hy, Math.max(w, h) * 0.45, '#ffd27a', 0.55);
    },
    init(w) {
      const s = w.s;
      const g = flagGeo(w);
      s.mask = [];
      for (let j = 0; j < g.H; j++) {
        const row = [];
        for (let i = 0; i < g.L; i++) {
          // Area coverage (6x6 samples per cell) keeps the thin star points from breaking up.
          let n = 0;
          for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) if (inStar(i + (a + 0.5) / 6, j + (b + 0.5) / 6, g.L / 2, g.H / 2, g.L / 5)) n++;
          row.push(n / 36 >= 0.22);
        }
        s.mask.push(row);
      }
      const cluster = (n, wMin, wMax, hMax) => {
        const out = [];
        for (let c = 0; c < n; c++) {
          const x = rnd(0, w.cols);
          const h = rnd(hMax * 0.55, hMax);
          const wd = rnd(wMin, wMax);
          out.push({ x, w: wd, h, lean: rnd(-0.25, 0.25) });
          if (Math.random() < 0.7) out.push({ x: x + wd * rnd(0.8, 1.3) * (Math.random() < 0.5 ? -1 : 1), w: wd * 0.7, h: h * rnd(0.45, 0.7), lean: rnd(-0.25, 0.25) });
        }
        return out;
      };
      s.far = cluster(Math.round(clamp(w.cols / 14, 2, 8)), 3, 6, Math.max(4, w.rows * 0.16));
      s.near = cluster(Math.round(clamp(w.cols / 22, 1, 5)), 3.5, 7, Math.max(5, w.rows * 0.24));
      s.clouds = Array.from({ length: Math.round(clamp(w.cols / 30, 2, 5)) }, () => {
        const c = cloud(w, true, CLOUD_DAY);
        c.y = rnd(-1, g.horizon * 0.45);
        c.v *= 0.5;
        return c;
      });
      s.birds = Array.from({ length: Math.round(clamp(w.cols / 14, 3, 9)) }, () => ({ x: rnd(0, w.cols), y: rnd(2, g.horizon * 0.5), v: rnd(0.8, 1.8), ph: rnd(0, 6) }));
      s.dust = Array.from({ length: Math.round(clamp(w.cols / 4, 6, 30)) }, () => ({ x: rnd(w.cols * 0.55, w.cols), y: rnd(0, g.horizon), ph: rnd(0, 6), v: rnd(0.1, 0.4) }));
    },
    under(w) {
      const s = w.s;
      const g = flagGeo(w);
      // Rising sun, half behind the mountains.
      const sx = Math.round(w.cols * 0.82);
      const sr = clamp(Math.round(w.rows * 0.07), 2, 5);
      for (let dy = -sr; dy <= 0; dy++) {
        for (let dx = -sr; dx <= sr; dx++) {
          if (Math.hypot(dx, dy) <= sr + 0.3) w.tile(sx + dx, g.horizon - 1 + dy, '#fff0b8', '#f5d27a', w.ch(dx, dy, 31));
        }
      }
      const far = karstHeights(w.cols, s.far);
      const near = karstHeights(w.cols, s.near);
      // Far towers fade into the morning haze; near ones are darker with green crowns.
      for (let x = 0; x < w.cols; x++) {
        for (let k = 0; k < far[x]; k++) w.tile(x, g.horizon - 1 - k, '#a9c4cf', '#97b5c2', w.ch(x, k, 32), 0.8);
      }
      for (let x = 0; x < w.cols; x++) {
        const hgt = near[x];
        for (let k = 0; k < hgt; k++) {
          const crown = k >= hgt - 2 && hgt > 2;
          w.tile(x, g.horizon - 1 - k, crown ? '#6f9e7c' : '#5b8b92', crown ? '#557f62' : '#46737a', w.ch(x, k, 33));
        }
      }
      // Reflections of the near towers on the water.
      for (let x = 0; x < w.cols; x++) {
        for (let k = 0; k < Math.min(near[x], w.rows - g.horizon) * 0.5; k++) w.tile(x, g.horizon + k, '#3f7f8f', null, '', 0.35 - k * 0.06);
      }
    },
    frame(w, dt) {
      const s = w.s;
      const g = flagGeo(w);
      const t = w.t;

      for (const c of s.clouds) {
        c.x += c.v * dt;
        if (c.x > w.cols + 1) c.x = -c.sp.w - rnd(0, 10);
        w.sprite(c.sp, c.x, c.y, { a: c.a * 0.9, seed: c.seed });
      }
      for (const d of s.dust) w.dot(d.x + Math.sin(t * 0.6 + d.ph), d.y - ((t * d.v) % g.horizon), '#fff4c8', 0.25 + 0.25 * Math.sin(t * 2 + d.ph), 0.22);
      for (const b of s.birds) {
        b.x -= b.v * dt;
        if (b.x < -2) {
          b.x = w.cols + rnd(1, 10);
          b.y = rnd(2, g.horizon * 0.5);
        }
        w.glyph(b.x, b.y + Math.sin(t * 1.3 + b.ph) * 0.6, Math.floor(t * 4 + b.ph) % 2 ? 'v' : '-', '#33475b', 0.85);
      }

      // Water: drifting ripples and the sun's glittering path.
      const tick = Math.floor(t * 4);
      const sx = Math.round(w.cols * 0.82);
      for (let y = g.horizon; y < w.rows; y++) {
        const d = y - g.horizon;
        const dir = y % 2 ? 1 : -1;
        for (let x = 0; x < w.cols; x++) {
          if (hash(Math.floor(x + t * 0.8 * dir), y, 41) < 0.08) w.glyph(x, y, '~', '#e6f6fb', 0.55);
        }
        const spread = 1 + d * 0.8;
        for (let x = Math.floor(sx - spread); x <= sx + spread; x++) {
          if (hash(x, y, tick) < 0.3) w.tile(x, y, '#fff0b8', '#f0d27a', '~', 0.65 - d * 0.03);
        }
      }

      // Flagpole with a gold finial and a stone base.
      for (let y = g.top - 1; y <= g.horizon + 1; y++) w.tile(g.px, y, '#ece6d8', '#bdb5a3', '|');
      w.tile(g.px, g.top - 2, '#ffd34d', '#c99a1c', 'o');
      for (let dx = -1; dx <= 1; dx++) w.tile(g.px + dx, g.horizon + 2, '#8d99a6', '#6d7884', '=');

      // The flag: each column rides a sine wave that grows from the pole to the
      // free end, snapped to whole cells; the slope picks one of seven shades.
      const A = Math.max(1, g.H * 0.14);
      const k = (Math.PI * 2.2) / g.L;
      for (let i = 0; i < g.L; i++) {
        const f = Math.pow((i + 1) / g.L, 0.8);
        const ph = i * k - t * 3.4;
        const dy = Math.round((Math.sin(ph) + 0.18 * Math.sin(ph * 2.1 + 1)) * A * f);
        const shade = clamp(Math.round(Math.cos(ph) * (0.6 + f) * 2), -3, 3) + 3;
        const x = g.px + 1 + i;
        for (let j = 0; j < g.H; j++) {
          const star = s.mask[j] && s.mask[j][i];
          const p = (star ? FLAG_YELLOW : FLAG_RED)[shade];
          w.tile(x, g.top + j + dy, p[0], p[1], star ? '*' : w.ch(i, j, 34));
        }
      }
    },
  });

  const ITEMS = THEMES.map((t) => t.id).concat('off');
  const byId = (id) => THEMES.find((t) => t.id === id);


// Pixel Studio: local customization and local video library. No network requests.
window.__codexPixel?.destroy();
const KEY='codex-pixel-studio:v2';
const BASE={enabled:true,kind:'pixel',theme:'koi',videoId:null,paused:false,dim:30,glass:68,brightness:100,saturation:100,blur:0,speed:100,cell:14,tint:'#12171a',fit:'cover'};
let cfg={...BASE};
try{
  const s=JSON.parse(localStorage.getItem(KEY)||'null');
  if(s&&typeof s==='object'){
    for(const k of['enabled','paused'])if(typeof s[k]==='boolean')cfg[k]=s[k];
    if(['pixel','video'].includes(s.kind))cfg.kind=s.kind;
    if(THEMES.some(t=>t.id===s.theme))cfg.theme=s.theme;
    if(typeof s.videoId==='string')cfg.videoId=s.videoId;
    if(/^#[a-f0-9]{6}$/i.test(s.tint))cfg.tint=s.tint;
    if(['cover','contain','fill'].includes(s.fit))cfg.fit=s.fit;
    for(const[k,min,max]of[['dim',0,85],['glass',0,100],['brightness',40,150],['saturation',0,200],['blur',0,12],['speed',25,200],['cell',8,24]])if(Number.isFinite(s[k]))cfg[k]=clamp(s[k],min,max);
  }
}catch{}
const E=(tag,p={},children=[])=>{const n=document.createElement(tag);for(const[k,v]of Object.entries(p)){if(k==='text')n.textContent=v;else if(k==='class')n.className=v;else n.setAttribute(k,String(v))}n.append(...children);return n};
const PATH={tiles:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',close:'M6 6l12 12M6 18L18 6',play:'M8 5l11 7-11 7z',pause:'M8 5v14M16 5v14',upload:'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5',tune:'M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-6 0v6',video:'M3 5h13v14H3zM16 9l5-3v12l-5-3',check:'M5 12l4 4L19 6',power:'M12 2v10M6 5a9 9 0 1 0 12 0',reset:'M3 10a9 9 0 1 1 2 9M3 4v6h6'};
function I(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');for(const[k,v]of Object.entries({viewBox:'0 0 24 24',width:18,height:18,fill:'none',stroke:'currentColor','stroke-width':1.7,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':true}))svg.setAttribute(k,String(v));const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',PATH[name]);svg.append(p);return svg}
const names={code:'Terminal',cloud:'Mây trôi',lagoon:'Đầm rùa',koi:'Hồ cá Koi',jelly:'Sứa biển',boats:'Thuyền giấy',fireflies:'Đom đóm',moon:'Trăng sao',vn:'Việt Nam'};
const bg=E('div',{id:'codex-pixel-background','aria-hidden':true});bg.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden';
const canvas=E('canvas'),video=E('video',{loop:'',muted:'',playsinline:''}),shade=E('div');video.muted=true;video.loop=true;video.playsInline=true;
for(const n of[canvas,video,shade])n.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';bg.append(canvas,video,shade);document.body.prepend(bg);
const pageStyle=E('style',{text:'html[data-codex-pixel] #root{position:relative;z-index:1}html[data-codex-pixel] #root,html[data-codex-pixel] #root main,html[data-codex-pixel] [data-codex-pixel-clear]{background-color:transparent!important;background-image:none!important}html[data-codex-pixel] #root main{background-color:var(--codex-pixel-glass)!important}html[data-codex-pixel] [data-codex-pixel-footer-bg],html[data-codex-pixel] [data-codex-pixel-footer-bg]::before,html[data-codex-pixel] [data-codex-pixel-footer-bg]::after{background:transparent!important;box-shadow:none!important}'});document.head.append(pageStyle);
const launcher=E('div',{id:'codex-pixel-launcher',class:'no-drag'});launcher.style.cssText='display:flex;align-items:center;flex:0 0 auto;position:relative;z-index:30;pointer-events:auto;-webkit-app-region:no-drag';
const ls=launcher.attachShadow({mode:'open'});const launchButton=E('button',{'aria-label':'Tùy chỉnh nền',title:'Tùy chỉnh nền','aria-expanded':false,'aria-haspopup':'dialog'});launchButton.append(I('tiles'));
ls.append(E('style',{text:':host{color:inherit;-webkit-app-region:no-drag}button{pointer-events:auto;-webkit-app-region:no-drag;width:32px;height:32px;border:0;border-radius:9px;background:transparent;color:inherit;display:grid;place-items:center;cursor:pointer}button:hover,button[aria-expanded=true]{background:#8caca326;color:#a0e7c9}button:focus-visible{outline:2px solid #a0e7c9}'}),launchButton);
const host=E('div',{id:'codex-pixel-studio'});host.style.cssText='pointer-events:auto;position:fixed;z-index:2147483646;top:90px;right:16px;display:none;max-width:calc(100vw - 24px)';const sh=host.attachShadow({mode:'open'});
sh.append(E('style',{text:`
:host{font:13px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#ecf3f0;color-scheme:dark;--mint:#a0e7c9;--muted:#91a59d;--line:#ffffff12}*{box-sizing:border-box}button,input,select{font:inherit}button{cursor:pointer}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--mint);outline-offset:3px}button:disabled{opacity:.5;cursor:wait}
.panel{width:424px;max-width:calc(100vw - 24px);max-height:calc(100vh - 106px);overflow:auto;background:#151c1a;border:1px solid #ffffff20;border-radius:18px;box-shadow:0 18px 70px #0009;padding:22px;scrollbar-width:thin;scrollbar-color:#476356 transparent}.head,.row,.foot{display:flex;align-items:center;justify-content:space-between;gap:10px}.head{align-items:flex-start}.eyebrow{font-size:10px;letter-spacing:2px;color:var(--mint);font-weight:700}h2{font-size:22px;line-height:1.2;letter-spacing:-.6px;margin:6px 0 8px;font-weight:650}p{margin:0;color:var(--muted);font-size:12px}.icon{background:transparent;border:0;color:#a7bab0;width:29px;height:29px;display:grid;place-items:center;border-radius:7px}.icon:hover{background:#ffffff0c;color:white}.live{margin-top:18px;display:flex;align-items:center;gap:7px;color:#c9ddd2;font-size:11px}.dot{width:6px;height:6px;border-radius:50%;background:var(--mint);box-shadow:0 0 10px #a0e7c944}.live.off .dot{background:#82918a;box-shadow:none}.live span:last-child{margin-left:auto;color:var(--muted)}
.tabs{display:flex;gap:3px;background:#0d1411;border:1px solid var(--line);border-radius:10px;padding:4px;margin:16px 0 18px}.tab{display:flex;justify-content:center;align-items:center;gap:6px;flex:1;border:0;background:transparent;color:var(--muted);border-radius:7px;padding:8px 6px;font-size:11px;font-weight:600}.tab svg{width:14px;height:14px}.tab[aria-selected=true]{background:#283b31;color:#ccf4df;box-shadow:0 2px 6px #0003}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.card{padding:0;background:#101713;border:1px solid #ffffff10;border-radius:10px;overflow:hidden;color:#b5c7be;text-align:left;transition:border-color .15s,transform .15s;position:relative}.card:hover{border-color:#77998b;transform:translateY(-1px)}.card[aria-pressed=true]{border-color:var(--mint);box-shadow:0 0 0 1px #a0e7c92b}.thumb{height:66px;width:100%;object-fit:cover;display:block}.name{display:block;padding:8px 7px;font-size:10px;font-weight:550;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.badge{position:absolute;top:5px;right:5px;width:17px;height:17px;display:grid;place-items:center;border-radius:50%;background:var(--mint);color:#10271a}.badge svg{width:12px;height:12px}.hint{margin-top:13px;font-size:11px;line-height:1.5}.foot{border-top:1px solid var(--line);margin-top:19px;padding-top:15px}.action{display:flex;gap:7px;align-items:center;justify-content:center;border:1px solid #ffffff15;border-radius:9px;background:#ffffff06;color:#c7d9d0;padding:8px 10px;font-size:11px}.action svg{width:14px;height:14px}.action:hover{background:#ffffff10}.action.primary{background:var(--mint);color:#143222;border-color:var(--mint);font-weight:650}.foot .action{flex:1}.title{font-size:11px;text-transform:uppercase;letter-spacing:1.3px;color:#a6bdb0;font-weight:650;margin:0 0 13px}.setting{margin-bottom:17px}.setting label{font-size:12px;color:#d2e1d9;display:flex;align-items:center;justify-content:space-between;margin-bottom:9px}.setting output{font:11px ui-monospace,monospace;color:var(--mint)}input[type=range]{width:100%;height:4px;accent-color:var(--mint);cursor:pointer;display:block}select{background:#0e1612;border:1px solid #ffffff20;border-radius:7px;color:#d6e6dd;padding:7px;width:100%}input[type=color]{width:42px;height:28px;padding:2px;border:1px solid #ffffff20;background:#101713;border-radius:6px;cursor:pointer}.divider{height:1px;background:var(--line);margin:19px 0}.swatches{display:flex;gap:7px;align-items:center}.swatch{width:23px;height:23px;border:1px solid #ffffff30;border-radius:50%;padding:0}.reset{font-size:11px;background:transparent;color:var(--muted);border:0;display:flex;align-items:center;gap:6px;margin:16px auto 0}.reset svg{width:13px;height:13px}
.upload{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;width:100%;padding:25px 15px;border:1px dashed #557364;border-radius:12px;background:linear-gradient(150deg,#22392b44,#101914);color:#d9eee1;cursor:pointer}.upload svg{width:25px;height:25px;color:var(--mint)}.upload strong{font-size:13px;font-weight:600}.upload span{font-size:11px;color:var(--muted)}.upload.drag{background:#294d37;border-color:var(--mint)}.privacy{font-size:10px;color:#7f998a;text-align:center;margin:12px 0 18px}.empty{font-size:12px;color:var(--muted);padding:15px 0;text-align:center}.video-row{display:flex;gap:8px;align-items:center;padding:10px;border:1px solid #ffffff12;border-radius:9px;margin-top:8px}.video-row.selected{border-color:#a0e7c97a;background:#a0e7c909}.video-name{display:block;width:100%;border:0;color:#d4e4db;background:transparent;text-align:left;padding:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.meta{font-size:10px;color:var(--muted);margin-top:3px}.message{font-size:11px;margin-top:12px;color:#f0c389}.hidden{display:none!important}@media(prefers-reduced-motion:reduce){*{transition:none!important}}@media(max-width:460px){.panel{padding:17px}.grid{gap:7px}.thumb{height:58px}}
`}));
const panel=E('section',{class:'panel',role:'dialog','aria-label':'Pixel Studio — tùy chỉnh nền','aria-modal':false});
const close=E('button',{class:'icon','aria-label':'Đóng bảng nền',title:'Đóng'});close.append(I('close'));
const header=E('div',{class:'head'},[E('div',{},[E('div',{class:'eyebrow',text:'PIXEL STUDIO'}),E('h2',{text:'Không gian của bạn'}),E('p',{text:'Một chút chuyển động, một chút riêng bạn.'})]),close]);
const status=E('div',{class:'live'},[E('i',{class:'dot'}),E('span'),E('span',{text:'Lưu trên máy'})]);const tabs=E('div',{class:'tabs',role:'tablist','aria-label':'Loại tùy chỉnh'}),content=E('div'),message=E('p',{class:'message',role:'status','aria-live':'polite'});
const pause=E('button',{class:'action'}),power=E('button',{class:'action primary'});panel.append(header,status,tabs,content,message,E('div',{class:'foot'},[pause,power]));sh.append(panel);document.body.append(host);
let active='pixel',opened=false,destroyed=false,raf=0,last=0,mediaUrl=null,mediaName='',library=[],mountTimer=0,resizeTimer=0,saveTimer=0,token=0;
const marked=new Set(),footerDecorations=new Set(),world=new World(canvas),tabButtons=new Map();
function notice(text=''){message.textContent=text}
function save(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(KEY,JSON.stringify(cfg))}catch{}},100)}
function rgb(hex){const n=parseInt(hex.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255].join(',')}
function update(){
  document.documentElement.toggleAttribute('data-codex-pixel',cfg.enabled);document.documentElement.style.setProperty('--codex-pixel-glass',`rgba(${rgb(cfg.tint)},${cfg.glass/100})`);
  bg.style.display=cfg.enabled?'block':'none';bg.style.background=cfg.tint;canvas.style.display=cfg.kind==='pixel'?'block':'none';video.style.display=cfg.kind==='video'?'block':'none';
  for(const n of[canvas,video])n.style.filter=`brightness(${cfg.brightness/100}) saturate(${cfg.saturation/100}) blur(${cfg.blur}px)`;
  shade.style.background=`rgba(${rgb(cfg.tint)},${cfg.dim/100})`;video.style.objectFit=cfg.fit;video.playbackRate=cfg.speed/100;
  if(!cfg.enabled||cfg.paused||document.hidden)video.pause();else if(cfg.kind==='video'&&video.src)video.play().catch(()=>notice('Video chưa phát được. Thử MP4 H.264 hoặc WebM.'));
  if(cfg.kind==='pixel')world.draw(0);status.classList.toggle('off',!cfg.enabled);status.children[1].textContent=!cfg.enabled?'Nền đang tắt':cfg.kind==='video'?(mediaName||'Video cá nhân'):names[cfg.theme];
  pause.replaceChildren(I(cfg.paused?'play':'pause'),document.createTextNode(cfg.paused?'Tiếp tục':'Tạm dừng'));pause.setAttribute('aria-pressed',String(cfg.paused));power.replaceChildren(I('power'),document.createTextNode(cfg.enabled?'Tắt nền':'Bật nền'));power.setAttribute('aria-pressed',String(cfg.enabled));save();
}
function resize(){world.resize(innerWidth,innerHeight,cfg.cell,Math.min(devicePixelRatio||1,1.5));world.setTheme(THEMES.find(t=>t.id===cfg.theme));world.veil=0;world.draw(0)}
function loop(now){if(destroyed)return;raf=requestAnimationFrame(loop);if(document.hidden||!cfg.enabled||cfg.paused||cfg.kind!=='pixel'){last=0;return}if(now-last<1000/12)return;const dt=last?Math.min((now-last)/1000,.15):1/12;last=now;world.draw(dt*cfg.speed/100)}
function position(){if(!opened)return;const r=launcher.getBoundingClientRect();host.style.top=`${Math.max(48,Math.min(r.bottom+10,innerHeight-150))}px`;host.style.right=`${Math.max(12,innerWidth-r.right)}px`}
function clearComposerBackdrop(root){
  // The footer has a wide decorative sibling behind the composer, not an ancestor.
  // Leave the input surface and all interactive descendants untouched.
  for(const editor of root?.querySelectorAll('[contenteditable="true"][role="textbox"],textarea')||[]){
    const footer=editor.closest('[class*="footer-"]');
    if(!footer)continue;
    if(!footer.hasAttribute('data-codex-pixel-clear')){footer.setAttribute('data-codex-pixel-clear','');marked.add(footer)}
    const width=footer.getBoundingClientRect().width;
    for(const child of footer.children){
      if(child.contains(editor))continue;
      const style=getComputedStyle(child);
      if(style.pointerEvents!=='none'||style.position!=='absolute')continue;
      if(!child.classList.contains('bg-surface')&&!(width>0&&child.getBoundingClientRect().width>=width*.6))continue;
      if(!child.hasAttribute('data-codex-pixel-footer-bg')){child.setAttribute('data-codex-pixel-footer-bg','');footerDecorations.add(child)}
    }
  }
}
function mount(){
  const root=document.getElementById('root');const toolbar=[...document.querySelectorAll('#root [role=toolbar]')].find(t=>/chat|trò chuyện/i.test(t.getAttribute('aria-label')||''));
  let actions=toolbar?.querySelector('button')?.parentElement;
  while(actions&&actions!==toolbar&&!(actions.tagName==='DIV'&&getComputedStyle(actions).display==='flex'))actions=actions.parentElement;
  if(actions&&actions!==toolbar){if(launcher.parentElement!==actions)actions.append(launcher);Object.assign(launcher.style,{position:'relative',top:'',right:'',width:'32px',height:'32px'})}else{if(launcher.parentElement!==document.body)document.body.append(launcher);Object.assign(launcher.style,{position:'fixed',top:'52px',right:'112px',zIndex:'2147483645',width:'32px',height:'32px'})}
  const main=root?.querySelector('main');if(main)for(let n=main.parentElement;n&&n!==root;n=n.parentElement)if(!n.hasAttribute('data-codex-pixel-clear')){n.setAttribute('data-codex-pixel-clear','');marked.add(n)}clearComposerBackdrop(root);position();
}
function open(value){opened=value;host.style.display=value?'block':'none';launchButton.setAttribute('aria-expanded',String(value));if(value){mount();render();close.focus()}else launchButton.focus()}
launchButton.onclick=()=>open(!opened);close.onclick=()=>open(false);pause.onclick=()=>{cfg.paused=!cfg.paused;last=0;update()};power.onclick=()=>{cfg.enabled=!cfg.enabled;update()};
for(const[id,label,image]of[['pixel','Cảnh Pixel','tiles'],['video','Video','video'],['adjust','Tinh chỉnh','tune']]){const b=E('button',{class:'tab',role:'tab',id:`px-tab-${id}`,'aria-controls':'px-tab-panel','aria-selected':id===active});b.append(I(image),document.createTextNode(label));b.onclick=()=>{active=id;render()};tabs.append(b);tabButtons.set(id,b)}
tabs.onkeydown=e=>{if(!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;e.preventDefault();const ids=[...tabButtons.keys()];let i=ids.indexOf(active);i=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;active=ids[i];render();tabButtons.get(active).focus()};
function thumbnail(t){const c=E('canvas',{class:'thumb','aria-hidden':true});const w=new World(c);w.resize(144,84,5,1);w.setTheme(t);for(let i=0;i<12;i++)w.draw(.1);return c}
function render(){
  content.replaceChildren();notice();for(const[id,b]of tabButtons){b.setAttribute('aria-selected',String(id===active));b.tabIndex=id===active?0:-1}content.id='px-tab-panel';content.setAttribute('role','tabpanel');content.setAttribute('aria-labelledby',`px-tab-${active}`);
  if(active==='pixel'){const grid=E('div',{class:'grid'});for(const t of THEMES){const selected=cfg.kind==='pixel'&&cfg.theme===t.id;const card=E('button',{class:'card','aria-pressed':selected,'aria-label':names[t.id]},[thumbnail(t),E('span',{class:'name',text:names[t.id]})]);if(selected)card.append(E('span',{class:'badge'},[I('check')]));card.onclick=()=>{++token;cfg.kind='pixel';cfg.theme=t.id;cfg.enabled=true;video.pause();resize();update();render()};grid.append(card)}content.append(grid,E('p',{class:'hint',text:'9 cảnh vẽ trực tiếp bằng pixel và ký tự. Chọn một cảnh để áp dụng ngay.'}))}else if(active==='video')renderVideo();else renderAdjust();update();position();
}
function slider(label,key,min,max,suffix='%'){const output=E('output',{for:`px-${key}`,text:cfg[key]+suffix}),caption=E('label',{for:`px-${key}`,text:label});caption.append(output);const input=E('input',{id:`px-${key}`,type:'range',min,max,step:1,value:cfg[key],'aria-label':label});input.oninput=()=>{cfg[key]=Number(input.value);output.textContent=cfg[key]+suffix;if(key==='cell')resize();update()};return E('div',{class:'setting'},[caption,input])}
function renderAdjust(){
  content.append(E('h3',{class:'title',text:'Ánh sáng & màu sắc'}),slider('Làm tối nền','dim',0,85),slider('Độ sáng','brightness',40,150),slider('Độ rực màu','saturation',0,200),slider('Làm mờ nền','blur',0,12,' px'),E('div',{class:'divider'}),E('h3',{class:'title',text:'Khung chat & chuyển động'}),slider('Độ đục khung chat','glass',0,100),slider('Tốc độ chuyển động','speed',25,200));if(cfg.kind==='pixel')content.append(slider('Kích thước pixel','cell',8,24,' px'));
  const color=E('input',{type:'color',value:cfg.tint,'aria-label':'Màu phủ nền'}),swatches=E('div',{class:'swatches'});color.oninput=()=>{cfg.tint=color.value;update()};for(const[hex,name]of[['#12171a','Than chì'],['#10281e','Xanh rừng'],['#231832','Tím đêm'],['#10263b','Xanh biển'],['#302018','Nâu ấm']]){const b=E('button',{class:'swatch','aria-label':name,title:name});b.style.background=hex;b.onclick=()=>{cfg.tint=hex;color.value=hex;update()};swatches.append(b)}swatches.append(color);content.append(E('div',{class:'row'},[E('span',{text:'Màu phủ nền'}),swatches]));const reset=E('button',{class:'reset'},[I('reset'),document.createTextNode('Đặt lại các tinh chỉnh')]);reset.onclick=()=>{const{kind,videoId,theme,enabled}=cfg;cfg={...BASE,kind,videoId,theme,enabled};resize();update();render()};content.append(reset);
}
async function dbTask(mode,fn){const db=await new Promise((r,j)=>{const q=indexedDB.open('codex-pixel-media-v1',1);q.onupgradeneeded=()=>q.result.createObjectStore('videos',{keyPath:'id'});q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)});try{return await new Promise((r,j)=>{const tx=db.transaction('videos',mode);let result;const q=fn(tx.objectStore('videos'));q.onsuccess=()=>{result=q.result};tx.oncomplete=()=>r(result);tx.onerror=()=>j(tx.error);tx.onabort=()=>j(tx.error||Error('Không thể lưu video'))})}finally{db.close()}}
async function refreshLibrary(){library=(await dbTask('readonly',s=>s.getAll())).map(({id,name,size})=>({id,name,size}));if(opened&&active==='video')render()}
async function useVideo(id){const run=++token;try{const item=await dbTask('readonly',s=>s.get(id));if(run!==token||destroyed)return;if(!item)throw Error('Video không còn trong thư viện. Hãy thêm lại.');video.pause();video.removeAttribute('src');video.load();if(mediaUrl)URL.revokeObjectURL(mediaUrl);mediaUrl=URL.createObjectURL(item.blob);video.src=mediaUrl;mediaName=item.name;cfg.videoId=id;cfg.kind='video';cfg.enabled=true;update();if(opened)render()}catch(e){if(run===token)notice(e.message)}}
async function addVideo(file){
  if(!file)return;if(file.size>200*1024*1024){notice('Chọn video dưới 200 MB để lưu trong thư viện cục bộ.');return}if(!file.type.startsWith('video/')&&!/\.(mp4|webm|mov|m4v|ogv)$/i.test(file.name)){notice('Vui lòng chọn tệp video MP4, WebM hoặc định dạng được hỗ trợ.');return}notice('Đang kiểm tra video…');
  const testUrl=URL.createObjectURL(file),probe=E('video');probe.muted=true;probe.preload='metadata';probe.src=testUrl;
  try{await new Promise((r,j)=>{const timer=setTimeout(()=>j(Error('Video mất quá lâu để đọc. Thử MP4 hoặc WebM khác.')),12000);probe.onloadedmetadata=()=>{clearTimeout(timer);probe.videoWidth?r():j(Error('Video không có hình ảnh.'))};probe.onerror=()=>{clearTimeout(timer);j(Error('Không đọc được video. Thử MP4 H.264 hoặc WebM.'))}});const id=crypto.randomUUID();await dbTask('readwrite',s=>s.put({id,name:file.name,size:file.size,blob:file,added:Date.now()}));await refreshLibrary();await useVideo(id)}catch(e){notice(`Chưa thêm video: ${e.message}`)}finally{probe.removeAttribute('src');probe.load();URL.revokeObjectURL(testUrl)}
}
function renderVideo(){
  const input=E('input',{type:'file',accept:'video/*,.mp4,.webm,.mov,.m4v',class:'hidden','aria-label':'Chọn video nền từ máy'});input.onchange=()=>addVideo(input.files[0]);const upload=E('button',{class:'upload','aria-label':'Thêm video nền từ máy'},[I('upload'),E('strong',{text:'Thả video hoặc bấm để chọn'}),E('span',{text:'MP4, WebM · Tối đa 200 MB · Phát không tiếng'})]);upload.onclick=()=>input.click();upload.ondragover=e=>{e.preventDefault();upload.classList.add('drag')};upload.ondragleave=()=>upload.classList.remove('drag');upload.ondrop=e=>{e.preventDefault();e.stopPropagation();upload.classList.remove('drag');addVideo(e.dataTransfer.files[0])};content.append(input,upload,E('p',{class:'privacy',text:'Video được lưu ngay trong ứng dụng trên máy bạn.'}),E('h3',{class:'title',text:'Thư viện của bạn'}));
  if(!library.length)content.append(E('p',{class:'empty',text:'Chưa có video. Thêm một cảnh bạn yêu thích.'}));
  for(const item of library){const name=E('button',{class:'video-name',text:item.name,title:item.name});name.onclick=()=>useVideo(item.id);const info=E('div',{},[name,E('div',{class:'meta',text:`${(item.size/1024/1024).toFixed(1)} MB · Lưu cục bộ`})]);info.style.cssText='flex:1;min-width:0';const remove=E('button',{class:'icon','aria-label':`Xóa video ${item.name}`,title:'Xóa khỏi thư viện'},[I('close')]);remove.onclick=async()=>{try{if(cfg.videoId===item.id){++token;video.pause();video.removeAttribute('src');video.load();if(mediaUrl){URL.revokeObjectURL(mediaUrl);mediaUrl=null}cfg.kind='pixel';cfg.videoId=null;resize();update()}await dbTask('readwrite',s=>s.delete(item.id));await refreshLibrary()}catch(e){notice(e.message)}};content.append(E('div',{class:`video-row${cfg.kind==='video'&&cfg.videoId===item.id?' selected':''}`},[I('video'),info,remove]))}
  const fit=E('select',{'aria-label':'Cách hiển thị video',id:'px-fit'});for(const[value,text]of[['cover','Lấp đầy khung hình'],['contain','Hiện toàn bộ video'],['fill','Kéo giãn theo cửa sổ']])fit.append(E('option',{value,text}));fit.value=cfg.fit;fit.onchange=()=>{cfg.fit=fit.value;update()};const box=E('div',{class:'setting'},[E('label',{for:'px-fit',text:'Cách hiển thị'}),fit]);box.style.marginTop='18px';content.append(box);
}
video.onerror=()=>{if(cfg.kind==='video')notice('Không phát được video. Thử MP4 H.264 hoặc WebM khác.')};
function onResize(){clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{resize();position()},100)}function onVisibility(){last=0;update()}function outside(e){if(opened&&!e.composedPath().includes(host)&&!e.composedPath().includes(launcher))open(false)}function onKey(e){if(opened&&e.key==='Escape'){e.preventDefault();open(false)}}
const observer=new MutationObserver(()=>{if(!mountTimer)mountTimer=setTimeout(()=>{mountTimer=0;mount()},120)});observer.observe(document.getElementById('root')||document.body,{childList:true,subtree:true});
function destroy(){destroyed=true;++token;cancelAnimationFrame(raf);observer.disconnect();clearTimeout(mountTimer);clearTimeout(resizeTimer);clearTimeout(saveTimer);removeEventListener('resize',onResize);document.removeEventListener('visibilitychange',onVisibility);document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',onKey);video.pause();video.removeAttribute('src');video.load();if(mediaUrl)URL.revokeObjectURL(mediaUrl);bg.remove();host.remove();launcher.remove();pageStyle.remove();for(const n of marked)n.removeAttribute('data-codex-pixel-clear');for(const n of footerDecorations)n.removeAttribute('data-codex-pixel-footer-bg');document.documentElement.removeAttribute('data-codex-pixel');document.documentElement.style.removeProperty('--codex-pixel-glass');delete window.__codexPixel}
window.__codexPixel={destroy,open:()=>open(true),close:()=>open(false),get theme(){return cfg.kind==='video'?'video':cfg.theme},get settings(){return{...cfg}}};
resize();mount();update();raf=requestAnimationFrame(loop);addEventListener('resize',onResize);document.addEventListener('visibilitychange',onVisibility);document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',onKey);
refreshLibrary().then(()=>{if(cfg.kind==='video'&&cfg.videoId)useVideo(cfg.videoId)}).catch(()=>notice('Không truy cập được bộ nhớ video. Các cảnh pixel vẫn dùng được.'));
return{installed:true,version:2,themes:THEMES.length,theme:cfg.kind==='video'?'video':cfg.theme,launcher:'Tùy chỉnh nền'};

})()
