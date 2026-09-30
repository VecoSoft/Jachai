// Node-only (node:fs + WASM) — used by src/lib/promo-render.tsx.
import { readFileSync } from "node:fs";
import path from "node:path";
import type { ShapeOpts, Shaped, Shaper } from "@/components/promo/templates";

/**
 * Real OpenType text shaping for creative PNGs (V58), via HarfBuzz (harfbuzzjs — the same shaping
 * engine browsers use). Satori places glyphs in logical order and can't do Indic reordering, so
 * Bangla like "বিরিয়ানি", "ক্ষ", "ন্ত", "শুক্রবার" would render broken. Instead, every text run is
 * shaped here, wrapped/clamped to its box, and emitted as an SVG of glyph outlines that Satori
 * embeds as an image. The browser preview keeps native text (browsers shape Bangla correctly).
 */

type Weight = 400 | 600 | 700;

interface HbGlyph {
  g: number;
  ax: number;
  dx: number;
  dy: number;
}

interface FontHandle {
  font: { glyphToPath: (g: number) => string; setScale: (x: number, y: number) => void };
  upem: number;
  ascender: number;
  descender: number;
  paths: Map<number, string>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Hb = any;

const FONT_FILES: Record<Weight, string> = {
  400: "HindSiliguri-Regular.ttf",
  600: "HindSiliguri-SemiBold.ttf",
  700: "HindSiliguri-Bold.ttf",
};

let shaperPromise: Promise<Shaper> | null = null;

export function fontFile(weight: Weight): Buffer {
  return readFileSync(path.join(process.cwd(), "public", "fonts", FONT_FILES[weight]));
}

/** hhea ascender/descender straight from the font's table directory (hbjs doesn't expose metrics). */
function verticalMetrics(buf: Buffer): { ascender: number; descender: number; upem: number } {
  const numTables = buf.readUInt16BE(4);
  let hhea = -1;
  let head = -1;
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    const tag = buf.toString("ascii", rec, rec + 4);
    if (tag === "hhea") hhea = buf.readUInt32BE(rec + 8);
    if (tag === "head") head = buf.readUInt32BE(rec + 8);
  }
  if (hhea < 0 || head < 0) throw new Error("font is missing hhea/head");
  return { ascender: buf.readInt16BE(hhea + 4), descender: buf.readInt16BE(hhea + 6), upem: buf.readUInt16BE(head + 18) };
}

export function getShaper(): Promise<Shaper> {
  if (!shaperPromise) {
    shaperPromise = (async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const hb: Hb = await require("harfbuzzjs");
      const fonts = new Map<Weight, FontHandle>();
      for (const weight of [400, 600, 700] as Weight[]) {
        const buf = fontFile(weight);
        const blob = hb.createBlob(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
        const face = hb.createFace(blob, 0);
        const font = hb.createFont(face);
        const m = verticalMetrics(buf);
        font.setScale(m.upem, m.upem);
        fonts.set(weight, { font, upem: m.upem, ascender: m.ascender, descender: m.descender, paths: new Map() });
      }

      function run(fh: FontHandle, text: string): { glyphs: HbGlyph[]; width: number } {
        const buffer = hb.createBuffer();
        buffer.addText(text);
        buffer.guessSegmentProperties();
        hb.shape(fh.font, buffer);
        const glyphs = buffer.json() as HbGlyph[];
        buffer.destroy();
        return { glyphs, width: glyphs.reduce((s, g) => s + g.ax, 0) };
      }

      function glyphPath(fh: FontHandle, g: number): string {
        let d = fh.paths.get(g);
        if (d === undefined) {
          d = fh.font.glyphToPath(g);
          fh.paths.set(g, d);
        }
        return d;
      }

      return function shape(text: string, o: ShapeOpts): Shaped | null {
        const clean = text.replace(/\s+/g, " ").trim();
        if (!clean) return null;
        const fh = fonts.get(o.weight ?? 400) ?? fonts.get(400)!;
        const scale = o.size / fh.upem;
        const maxUnits = o.maxWidth / scale;
        const maxLines = Math.max(1, o.lines ?? 1);

        // Greedy word wrap on shaped widths (a word is always shaped whole, so clusters never split).
        type Piece = { glyphs: HbGlyph[]; width: number };
        const space = run(fh, " ");
        const words = clean.split(" ").map((w) => run(fh, w));
        const lines: Piece[][] = [[]];
        let lineWidth = 0;
        for (const w of words) {
          const current = lines[lines.length - 1];
          const needed = (current.length ? space.width : 0) + w.width;
          if (current.length && lineWidth + needed > maxUnits) {
            lines.push([w]);
            lineWidth = w.width;
          } else {
            current.push(w);
            lineWidth += needed;
          }
        }

        // Clamp: keep maxLines, and end the last kept line with "…" that fits.
        let kept = lines;
        if (lines.length > maxLines) {
          kept = lines.slice(0, maxLines);
          const last = kept[maxLines - 1];
          const ellipsis = run(fh, "…");
          const widthOf = (ws: Piece[]) => ws.reduce((s, p, i) => s + p.width + (i ? space.width : 0), 0);
          while (last.length > 1 && widthOf(last) + ellipsis.width > maxUnits) last.pop();
          last.push(ellipsis);
        }

        const lineHeightPx = o.size * (o.lineHeight ?? 1.25);
        const lineWidths = kept.map((ws) => ws.reduce((s, p, i) => s + p.width + (i ? space.width : 0), 0) * scale);
        const contentWidth = Math.min(o.maxWidth, Math.max(...lineWidths));
        const align = o.align ?? "left";
        const boxWidth = Math.ceil(align === "left" ? contentWidth : o.maxWidth);
        const boxHeight = Math.ceil(lineHeightPx * kept.length);
        const glyphHeight = (fh.ascender - fh.descender) * scale;

        const parts: string[] = [];
        kept.forEach((ws, li) => {
          const lw = Math.min(lineWidths[li], o.maxWidth);
          let x = align === "center" ? (boxWidth - lw) / 2 : align === "right" ? boxWidth - lw : 0;
          const baseline = li * lineHeightPx + (lineHeightPx - glyphHeight) / 2 + fh.ascender * scale;
          const startX = x;
          ws.forEach((p, pi) => {
            if (pi) x += space.width * scale;
            for (const g of p.glyphs) {
              const d = glyphPath(fh, g.g);
              if (d) {
                const gx = (x + g.dx * scale).toFixed(2);
                const gy = (baseline - g.dy * scale).toFixed(2);
                parts.push(`<path transform="translate(${gx} ${gy}) scale(${scale.toFixed(5)} ${(-scale).toFixed(5)})" d="${d}"/>`);
              }
              x += g.ax * scale;
            }
          });
          if (o.strike) {
            const y = (baseline - o.size * 0.3).toFixed(2);
            parts.push(`<rect x="${startX.toFixed(2)}" y="${y}" width="${(x - startX).toFixed(2)}" height="${Math.max(1, o.size * 0.07).toFixed(2)}"/>`);
          }
        });

        const svg =
          `<svg xmlns="http://www.w3.org/2000/svg" width="${boxWidth}" height="${boxHeight}" viewBox="0 0 ${boxWidth} ${boxHeight}">` +
          `<g fill="${o.color}"${o.opacity != null && o.opacity < 1 ? ` fill-opacity="${o.opacity}"` : ""}>${parts.join("")}</g></svg>`;
        return { src: `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`, width: boxWidth, height: boxHeight };
      };
    })().catch((e) => {
      shaperPromise = null;
      throw e;
    });
  }
  return shaperPromise;
}
