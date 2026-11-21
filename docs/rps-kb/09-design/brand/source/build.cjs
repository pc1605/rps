const fs = require("fs");
const sharp = require("sharp");
const opentype = require(process.env.OPENTYPE_JS || "opentype.js");
const { dirs, R, P, S } = require("./marks.cjs");
const AMBER = "#B45309",
  PAPER = "#FAFAF7",
  INK = "#1C1917",
  MUTED = "#6B6560",
  WHITE = "#FFFFFF";
const M = dirs.A; // mat plate 104 x 120 with the R cut out
const f = (n) => +n.toFixed(2);
const OUT = process.env.OUT || "out";
fs.mkdirSync(OUT, { recursive: true });
const svgDoc = (w, h, body, px) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"${px ? ` width="${px[0]}" height="${px[1]}"` : ""}><title>RPS</title>${body}</svg>`;
const markPath = (fill, tx = 0, ty = 0, sc = 1) =>
  `<path fill="${fill}" fill-rule="evenodd"${tx || ty || sc !== 1 ? ` transform="translate(${f(tx)} ${f(ty)}) scale(${f(sc)})"` : ""} d="${M.d}"/>`;
// Mark on a square canvas; its diagonal is `diag` of the canvas (0.56 keeps it inside Android's 66 % safe circle).
function square(size, diag, fill, bg, px) {
  const sc = (size * diag) / Math.hypot(M.w, M.h);
  return svgDoc(
    size,
    size,
    (bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : "") +
      markPath(fill, (size - M.w * sc) / 2, (size - M.h * sc) / 2, sc),
    px,
  );
}
// Mark filling the height of a square canvas with `pad` on top and bottom (small icons).
function tight(size, pad, fill, bg) {
  const sc = (size - 2 * pad) / M.h;
  return svgDoc(
    size,
    size,
    (bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : "") +
      markPath(fill, (size - M.w * sc) / 2, pad, sc),
    [size, size],
  );
}
const png = (svg, file, opts = {}) => {
  let p = sharp(Buffer.from(svg));
  if (opts.flatten) p = p.flatten({ background: opts.flatten }).removeAlpha();
  return p.png({ compressionLevel: 9 }).toFile(`${OUT}/${file}`);
};
(async () => {
  // 1-3 logo SVGs
  fs.writeFileSync(`${OUT}/logo-mark.svg`, svgDoc(M.w, M.h, markPath(AMBER)));
  fs.writeFileSync(`${OUT}/logo-mark-mono.svg`, svgDoc(M.w, M.h, markPath(INK)));
  const font = opentype.loadSync(
    require("path").resolve(
      __dirname,
      "../../../../../node_modules/@expo-google-fonts/ibm-plex-sans/500Medium/IBMPlexSans_500Medium.ttf",
    ),
  );
  const tag = "Riddhi Production System",
    tagSize = 20;
  const tx = 104 + 26,
    wmScale = 0.58,
    wmY = 10;
  const tagW = font.getAdvanceWidth(tag, tagSize);
  const tagPath = font.getPath(tag, tx, 112, tagSize).toPathData(2);
  const wm = R(tx, wmY, wmScale) + P(tx + 96 * wmScale, wmY, wmScale) + S(tx + 185 * wmScale, wmY, wmScale);
  const fullW = Math.ceil(tx + Math.max(tagW, 257 * wmScale) + 2);
  fs.writeFileSync(
    `${OUT}/logo-full.svg`,
    svgDoc(
      fullW,
      120,
      markPath(AMBER) +
        `<path fill="${INK}" fill-rule="evenodd" d="${wm}"/><path fill="${MUTED}" d="${tagPath}"/>`,
    ),
  );
  // 4-9 Android (Expo)
  await png(square(1024, 0.56, PAPER, AMBER, [1024, 1024]), "icon.png", { flatten: AMBER });
  await png(square(1024, 0.56, PAPER, null, [1024, 1024]), "android-icon-foreground.png");
  await png(
    svgDoc(1024, 1024, `<rect width="1024" height="1024" fill="${AMBER}"/>`, [1024, 1024]),
    "android-icon-background.png",
    { flatten: AMBER },
  );
  await png(square(1024, 0.56, WHITE, null, [1024, 1024]), "android-icon-monochrome.png");
  {
    // splash: mark with "RPS" under it, about the middle 40 %
    const gap = 22,
      wmS = 104 / 257,
      wmH = 100 * wmS,
      h = M.h + gap + wmH,
      sc = 410 / h;
    const x0 = (1024 - M.w * sc) / 2,
      y0 = (1024 - h * sc) / 2;
    const body =
      markPath(AMBER, x0, y0, sc) +
      `<path fill="${AMBER}" fill-rule="evenodd" transform="translate(${f(x0)} ${f(y0 + (M.h + gap) * sc)}) scale(${f(sc)})" d="${R(0, 0, wmS) + P(96 * wmS, 0, wmS) + S(185 * wmS, 0, wmS)}"/>`;
    await png(svgDoc(1024, 1024, body, [1024, 1024]), "splash-icon.png");
  }
  await png(tight(96, 8, WHITE), "notification-icon.png");
  // 10-12 admin web
  const icoParts = [];
  for (const s of [16, 32, 48])
    icoParts.push(
      await sharp(Buffer.from(tight(s, s === 16 ? 0 : s / 16, AMBER)))
        .png()
        .toBuffer(),
    );
  const head = Buffer.alloc(6 + 16 * icoParts.length);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(icoParts.length, 4);
  let off = head.length;
  icoParts.forEach((b, i) => {
    const s = [16, 32, 48][i],
      e = 6 + 16 * i;
    head.writeUInt8(s, e);
    head.writeUInt8(s, e + 1);
    head.writeUInt8(0, e + 2);
    head.writeUInt8(0, e + 3);
    head.writeUInt16LE(1, e + 4);
    head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(b.length, e + 8);
    head.writeUInt32LE(off, e + 12);
    off += b.length;
  });
  fs.writeFileSync(`${OUT}/favicon.ico`, Buffer.concat([head, ...icoParts]));
  {
    const sc = 32 / M.h;
    fs.writeFileSync(`${OUT}/icon.svg`, svgDoc(32, 32, markPath(AMBER, (32 - M.w * sc) / 2, 0, sc)));
  }
  await png(square(180, 0.62, PAPER, AMBER, [180, 180]), "apple-icon.png", { flatten: AMBER });
  console.log("done");
})();
