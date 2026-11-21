// Geometry for the three directions. Units: letter cap height = 100.
const f = (n) => +n.toFixed(2);
function R(x, y, s) {
  // 86 x 100
  const X = (v) => f(x + v * s),
    Y = (v) => f(y + v * s),
    r = (v) => f(v * s);
  return (
    `M${X(0)} ${Y(0)}H${X(50)}A${r(29)} ${r(29)} 0 0 1 ${X(62)} ${Y(55.4)}L${X(86)} ${Y(100)}H${X(62)}L${X(41)} ${Y(58)}H${X(22)}V${Y(100)}H${X(0)}Z` +
    `M${X(22)} ${Y(20)}H${X(48)}A${r(9)} ${r(9)} 0 0 1 ${X(48)} ${Y(38)}H${X(22)}Z`
  );
}
function P(x, y, s) {
  // 79 x 100
  const X = (v) => f(x + v * s),
    Y = (v) => f(y + v * s),
    r = (v) => f(v * s);
  return (
    `M${X(0)} ${Y(0)}H${X(50)}A${r(29)} ${r(29)} 0 0 1 ${X(50)} ${Y(58)}H${X(22)}V${Y(100)}H${X(0)}Z` +
    `M${X(22)} ${Y(20)}H${X(48)}A${r(9)} ${r(9)} 0 0 1 ${X(48)} ${Y(38)}H${X(22)}Z`
  );
}
function S(x, y, s) {
  // 72 x 100
  const X = (v) => f(x + v * s),
    Y = (v) => f(y + v * s),
    r = (v) => f(v * s);
  return `M${X(72)} ${Y(0)}V${Y(20)}H${X(30)}A${r(10)} ${r(10)} 0 0 0 ${X(30)} ${Y(40)}H${X(42)}A${r(30)} ${r(30)} 0 0 1 ${X(42)} ${Y(100)}H${X(0)}V${Y(80)}H${X(42)}A${r(10)} ${r(10)} 0 0 0 ${X(42)} ${Y(60)}H${X(30)}A${r(30)} ${r(30)} 0 0 1 ${X(30)} ${Y(0)}Z`;
}
// Car floor mat: rounded plate, top-right corner cut where the mat meets the centre console.
function mat(x, y, w, h, rad, cut) {
  // Cut on the top-left: on a driver-side mat that is the edge against the centre console.
  return `M${x + cut} ${y}H${x + w - rad}A${rad} ${rad} 0 0 1 ${x + w} ${y + rad}V${y + h - rad}A${rad} ${rad} 0 0 1 ${x + w - rad} ${y + h}H${x + rad}A${rad} ${rad} 0 0 1 ${x} ${y + h - rad}V${y + cut}Z`;
}
const dirs = {
  A: { name: "Mat", w: 104, h: 120, d: mat(0, 0, 104, 120, 16, 30) + R(52 - 25.8, 64 - 30, 0.6) },
  B: { name: "Seam", w: 86, h: 128, d: R(0, 0, 1) + "M0 114H22V128H0ZM32 114H54V128H32ZM64 114H86V128H64Z" },
  C: { name: "Monogram", w: 257, h: 100, d: R(0, 0, 1) + P(96, 0, 1) + S(185, 0, 1) },
};
const svg = (w, h, inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${inner}</svg>`;
function markSvg(k, fill) {
  const m = dirs[k];
  return svg(m.w, m.h, `<path fill="${fill}" fill-rule="evenodd" d="${m.d}"/>`);
}
// Mark placed on a square canvas so it fits inside a circle of `circle` (fraction of canvas).
function placed(k, size, circle, fill, bg) {
  const m = dirs[k],
    diag = Math.hypot(m.w, m.h),
    sc = (size * circle) / diag;
  const tx = (size - m.w * sc) / 2,
    ty = (size - m.h * sc) / 2;
  return svg(
    size,
    size,
    (bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : "") +
      `<path fill="${fill}" fill-rule="evenodd" transform="translate(${f(tx)} ${f(ty)}) scale(${f(sc)})" d="${m.d}"/>`,
  );
}
module.exports = { dirs, markSvg, placed, svg, R, P, S };
