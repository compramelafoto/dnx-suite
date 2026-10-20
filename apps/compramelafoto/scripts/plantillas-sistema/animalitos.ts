/** Caritas de animales con formas simples (círculos y elipses), para los modelos de jardín. */

const OJOS = (cx: number, cy: number, s: number, sep = 0.32) =>
  `<circle cx="${cx - s * sep}" cy="${cy}" r="${s * 0.075}" fill="#3b2f2f"/><circle cx="${cx + s * sep}" cy="${cy}" r="${s * 0.075}" fill="#3b2f2f"/>` +
  `<circle cx="${cx - s * sep + s * 0.025}" cy="${cy - s * 0.025}" r="${s * 0.025}" fill="#fff"/><circle cx="${cx + s * sep + s * 0.025}" cy="${cy - s * 0.025}" r="${s * 0.025}" fill="#fff"/>`;

const CACHETES = (cx: number, cy: number, s: number) =>
  `<ellipse cx="${cx - s * 0.55}" cy="${cy}" rx="${s * 0.13}" ry="${s * 0.08}" fill="#ff9fb5" opacity="0.8"/><ellipse cx="${cx + s * 0.55}" cy="${cy}" rx="${s * 0.13}" ry="${s * 0.08}" fill="#ff9fb5" opacity="0.8"/>`;

/** Osito. `s` = radio de la cabeza. */
export function oso(cx: number, cy: number, s: number): string {
  return `<g>
    <circle cx="${cx - s * 0.72}" cy="${cy - s * 0.72}" r="${s * 0.34}" fill="#b98b62"/><circle cx="${cx + s * 0.72}" cy="${cy - s * 0.72}" r="${s * 0.34}" fill="#b98b62"/>
    <circle cx="${cx - s * 0.72}" cy="${cy - s * 0.72}" r="${s * 0.18}" fill="#e7c3a0"/><circle cx="${cx + s * 0.72}" cy="${cy - s * 0.72}" r="${s * 0.18}" fill="#e7c3a0"/>
    <circle cx="${cx}" cy="${cy}" r="${s}" fill="#c99a6e"/>
    <ellipse cx="${cx}" cy="${cy + s * 0.32}" rx="${s * 0.42}" ry="${s * 0.32}" fill="#f0d6bb"/>
    <ellipse cx="${cx}" cy="${cy + s * 0.2}" rx="${s * 0.14}" ry="${s * 0.1}" fill="#3b2f2f"/>
    ${OJOS(cx, cy - s * 0.15, s)}${CACHETES(cx, cy + s * 0.3, s)}
  </g>`;
}

/** Conejito. */
export function conejo(cx: number, cy: number, s: number): string {
  return `<g>
    <ellipse cx="${cx - s * 0.38}" cy="${cy - s * 1.2}" rx="${s * 0.26}" ry="${s * 0.75}" fill="#f4f1f6"/><ellipse cx="${cx + s * 0.38}" cy="${cy - s * 1.2}" rx="${s * 0.26}" ry="${s * 0.75}" fill="#f4f1f6"/>
    <ellipse cx="${cx - s * 0.38}" cy="${cy - s * 1.2}" rx="${s * 0.13}" ry="${s * 0.55}" fill="#ffc1d3"/><ellipse cx="${cx + s * 0.38}" cy="${cy - s * 1.2}" rx="${s * 0.13}" ry="${s * 0.55}" fill="#ffc1d3"/>
    <circle cx="${cx}" cy="${cy}" r="${s}" fill="#f4f1f6"/>
    <ellipse cx="${cx}" cy="${cy + s * 0.18}" rx="${s * 0.11}" ry="${s * 0.08}" fill="#ff8fab"/>
    ${OJOS(cx, cy - s * 0.12, s)}${CACHETES(cx, cy + s * 0.3, s)}
  </g>`;
}

/** Gatito. */
export function gato(cx: number, cy: number, s: number): string {
  const oreja = (dx: number) =>
    `<polygon points="${cx + dx * s * 0.95},${cy - s * 0.25} ${cx + dx * s * 0.75},${cy - s * 1.25} ${cx + dx * s * 0.2},${cy - s * 0.8}" fill="#ffb366"/>`;
  return `<g>
    ${oreja(-1)}${oreja(1)}
    <circle cx="${cx}" cy="${cy}" r="${s}" fill="#ffb366"/>
    <path d="M ${cx - s * 0.2} ${cy - s * 0.95} q ${s * 0.2} ${s * 0.3} ${s * 0.4} 0" stroke="#e8893a" stroke-width="${s * 0.08}" fill="none"/>
    <polygon points="${cx - s * 0.1},${cy + s * 0.12} ${cx + s * 0.1},${cy + s * 0.12} ${cx},${cy + s * 0.25}" fill="#e85d75"/>
    <path d="M ${cx - s * 0.5} ${cy + s * 0.2} l -${s * 0.45} -${s * 0.06} M ${cx - s * 0.5} ${cy + s * 0.3} l -${s * 0.45} ${s * 0.06} M ${cx + s * 0.5} ${cy + s * 0.2} l ${s * 0.45} -${s * 0.06} M ${cx + s * 0.5} ${cy + s * 0.3} l ${s * 0.45} ${s * 0.06}" stroke="#8a5a2b" stroke-width="${s * 0.03}"/>
    ${OJOS(cx, cy - s * 0.12, s)}
  </g>`;
}

/** Pollito. */
export function pollito(cx: number, cy: number, s: number): string {
  return `<g>
    <path d="M ${cx - s * 0.1} ${cy - s * 0.95} q ${s * 0.1} -${s * 0.35} ${s * 0.25} -${s * 0.05} q ${s * 0.1} -${s * 0.3} ${s * 0.15} ${s * 0.05}" fill="#ffd43b"/>
    <circle cx="${cx}" cy="${cy}" r="${s}" fill="#ffe066"/>
    <polygon points="${cx - s * 0.16},${cy + s * 0.08} ${cx + s * 0.16},${cy + s * 0.08} ${cx},${cy + s * 0.3}" fill="#ff922b"/>
    ${OJOS(cx, cy - s * 0.15, s, 0.3)}${CACHETES(cx, cy + s * 0.25, s)}
  </g>`;
}

/** Nube blanca hecha de círculos, con base plana. */
export function nube(x: number, y: number, w: number, h: number, color = "#ffffff", opacidad = 1): string {
  const r = h * 0.5;
  return `<g fill="${color}" opacity="${opacidad}">
    <rect x="${x + r * 0.6}" y="${y + h * 0.45}" width="${w - r * 1.2}" height="${h * 0.55}" rx="${h * 0.27}"/>
    <circle cx="${x + w * 0.3}" cy="${y + h * 0.5}" r="${r * 0.75}"/>
    <circle cx="${x + w * 0.55}" cy="${y + h * 0.4}" r="${r}"/>
    <circle cx="${x + w * 0.78}" cy="${y + h * 0.58}" r="${r * 0.65}"/>
  </g>`;
}
