// Draws press-on nail sets as SVG from a product's shape, length, pattern and colours.
// Used when a product has no photo yet. Once photos are uploaded in the admin panel, they are shown instead.
(function () {
  let uid = 0;
  const LEN = { Short: 1.2, Medium: 1.55, Long: 1.95 };

  function nailPath(shape, w, h) {
    const B = h - w * 0.22; // where the side walls meet the cuticle curve
    const bottom = `L ${w} ${B} Q ${w / 2} ${h + w * 0.2} 0 ${B} Z`;
    switch (shape) {
      case 'Square': {
        const r = w * 0.14;
        return `M 0 ${B} L 0 ${r} Q 0 0 ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} ${bottom}`;
      }
      case 'Oval':
        return `M 0 ${B} L 0 ${w / 2} A ${w / 2} ${w / 2} 0 0 1 ${w} ${w / 2} ${bottom}`;
      case 'Coffin': {
        const S = h * 0.42;
        return `M 0 ${B} L 0 ${S} L ${w * 0.2} ${w * 0.06} Q ${w * 0.23} 0 ${w * 0.3} 0 L ${w * 0.7} 0 Q ${w * 0.77} 0 ${w * 0.8} ${w * 0.06} L ${w} ${S} ${bottom}`;
      }
      case 'Stiletto': {
        const S = h * 0.55;
        return `M 0 ${B} L 0 ${S} C 0 ${h * 0.25} ${w * 0.42} ${h * 0.06} ${w / 2} 0 C ${w * 0.58} ${h * 0.06} ${w} ${h * 0.25} ${w} ${S} ${bottom}`;
      }
      default: { // Almond
        const S = h * 0.5;
        return `M 0 ${B} L 0 ${S} C 0 ${h * 0.14} ${w * 0.3} 0 ${w / 2} 0 C ${w * 0.7} 0 ${w} ${h * 0.14} ${w} ${S} ${bottom}`;
      }
    }
  }

  // deterministic pseudo-random so glitter looks the same on every render
  function rng(seed) { let s = seed; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); }

  function decorate(p, i, w, h, id) {
    const [c0, c1 = c0] = p.colors || ['#F4C9CF', '#FFFFFF'];
    const pat = p.pattern || 'solid';
    let defs = '', fill = c0, extra = '';
    if (pat === 'multi') fill = (p.colors || [])[i % (p.colors || []).length] || c0;
    if (pat === 'ombre') {
      defs = `<linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c0}"/></linearGradient>`;
      fill = `url(#${id}g)`;
    }
    if (pat === 'chrome') {
      defs = `<linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c0}"/><stop offset=".35" stop-color="${c1}"/><stop offset=".6" stop-color="${c0}"/><stop offset="1" stop-color="${c1}"/></linearGradient>`;
      fill = `url(#${id}g)`;
    }
    if (pat === 'cateye') {
      defs = `<linearGradient id="${id}g" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${c0}"/><stop offset=".45" stop-color="${c0}"/><stop offset=".55" stop-color="${c1}"/><stop offset=".68" stop-color="${c0}"/><stop offset="1" stop-color="${c0}"/></linearGradient>`;
      fill = `url(#${id}g)`;
    }
    if (pat === 'french') {
      extra = `<path d="M -2 -2 L ${w + 2} -2 L ${w + 2} ${h * 0.34} Q ${w / 2} ${h * 0.06} -2 ${h * 0.34} Z" fill="${c1}"/>`;
    }
    if (pat === 'glitter') {
      const r = rng(i * 17 + 3);
      for (let k = 0; k < 26; k++) {
        const y = Math.pow(r(), 1.8) * h * 0.75;
        extra += `<circle cx="${(r() * w).toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.5 + r() * 1.3).toFixed(1)}" fill="${c1}"/>`;
      }
    }
    if (pat === 'floral') {
      if (i === 1 || i === 3) {
        const cx = w / 2, cy = h * 0.42, pr = w * 0.13;
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2;
          extra += `<circle cx="${(cx + Math.cos(a) * pr).toFixed(1)}" cy="${(cy + Math.sin(a) * pr).toFixed(1)}" r="${(pr * 0.75).toFixed(1)}" fill="${c1}"/>`;
        }
        extra += `<circle cx="${cx}" cy="${cy}" r="${(pr * 0.55).toFixed(1)}" fill="${c0}"/>`;
      } else {
        [0.3, 0.5, 0.7].forEach((f) => { extra += `<circle cx="${w / 2}" cy="${h * f}" r="${w * 0.05}" fill="${c1}"/>`; });
      }
    }
    if (pat === 'marble') {
      extra = `<path d="M ${w * 0.1} ${h * 0.1} C ${w * 0.6} ${h * 0.3} ${w * 0.1} ${h * 0.5} ${w * 0.8} ${h * 0.8}" stroke="${c1}" stroke-width="1.4" fill="none" opacity=".7"/>
        <path d="M ${w * 0.7} ${h * 0.05} C ${w * 0.4} ${h * 0.35} ${w * 0.9} ${h * 0.45} ${w * 0.3} ${h * 0.7}" stroke="${c1}" stroke-width=".8" fill="none" opacity=".5"/>
        <path d="M ${w * 0.05} ${h * 0.55} C ${w * 0.4} ${h * 0.5} ${w * 0.5} ${h * 0.65} ${w} ${h * 0.6}" stroke="#C9A25A" stroke-width="1" fill="none"/>`;
    }
    return { defs, fill, extra };
  }

  // Draws a row of 5 nails (thumb -> pinky). opts.sizes draws a sizing tray instead.
  function renderSet(p, opts = {}) {
    const base = 26;
    const widths = opts.widths || [1.28, 1.0, 1.06, 0.95, 0.8].map((f) => f * base);
    const lenF = LEN[p.length] || LEN.Medium;
    const gap = opts.gap ?? 9;
    const maxH = Math.max(...widths) * lenF + 6;
    const totalW = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1);
    const pad = 6;
    let x = pad, out = '', defs = '';
    widths.forEach((w, i) => {
      const h = w * lenF;
      const id = `n${++uid}`;
      const d = nailPath(p.shape, w, h);
      const deco = decorate(p, opts.index ?? i, w, h, id);
      defs += deco.defs + `<clipPath id="${id}c"><path d="${d}"/></clipPath>`;
      const y = pad + (maxH - h) * (opts.align === 'top' ? 0 : 1);
      const gloss = p.finish === 'Matte' ? '' : `<path d="M ${w * 0.2} ${h * 0.25} Q ${w * 0.16} ${h * 0.5} ${w * 0.24} ${h * 0.7}" stroke="#fff" stroke-width="${(w * 0.08).toFixed(1)}" stroke-linecap="round" fill="none" opacity=".45"/>`;
      out += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
        <path d="${d}" fill="${deco.fill}"/>
        <g clip-path="url(#${id}c)">${deco.extra}${gloss}</g>
        <path d="${d}" fill="none" stroke="rgba(60,20,40,.18)" stroke-width=".8"/>
      </g>`;
      x += w + gap;
    });
    const vbW = totalW + pad * 2, vbH = maxH + pad * 2;
    return `<svg viewBox="0 0 ${vbW.toFixed(1)} ${vbH.toFixed(1)}" role="img" aria-label="${(p.name || 'Nail set').replace(/"/g, '')} — ${p.shape} ${p.length}"><defs>${defs}</defs>${out}</svg>`;
  }

  // One single nail (for sizing tray cells)
  function renderOne(p, widthMm, index) {
    return renderSet(p, { widths: [widthMm * 1.6], index, gap: 0 });
  }

  function productArt(p, i = 0) {
    const img = (p.images || [])[i] || (i === 0 ? p.image : '');
    if (img) return `<img src="${img}" alt="${String(p.name).replace(/"/g, '')}" loading="lazy" decoding="async">`;
    return renderSet(p);
  }

  window.NailArt = { renderSet, renderOne, productArt };
})();
