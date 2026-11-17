// 320x180 offscreen buffer, scaled by whole numbers, letterboxed, nearest-neighbour.
// Text uses the game's bitmap font (src/platform/font.ts), drawn on the scaled display canvas
// in whole screen pixels: size 6 puts one font pixel on half an art pixel ("1x" body text) and
// size 12 on one art pixel ("2x", the prompt). Positions are always in internal pixels.
import { FONT_MIDDLE_ROW, FONT_ROWS, GLYPHS, glyphOf, measureText, MISSING, type Glyph } from './font';

export const VIEW_W = 320;
export const VIEW_H = 180;

export interface TextStyle {
  /** Internal-pixel font size. */
  size?: number;
  color?: string;
  align?: CanvasTextAlign;
  bold?: boolean;
  /** Shrink to fit this internal-pixel width. */
  maxWidth?: number;
  /** Draw a one-font-pixel outline in this colour first (high contrast on busy art). */
  outline?: string;
}

/** Font size whose font pixel is one art pixel. */
const FULL_SIZE = 12;

/** The glyph sheet: every glyph in one row, white, plus tinted copies made on demand. */
class GlyphSheet {
  private readonly base: HTMLCanvasElement;
  private readonly tinted = new Map<string, HTMLCanvasElement>();
  readonly at = new Map<Glyph, number>();

  constructor() {
    const glyphs = [...GLYPHS.values(), MISSING];
    let x = 0;
    for (const g of glyphs) {
      this.at.set(g, x);
      x += g.width + 1;
    }
    this.base = document.createElement('canvas');
    this.base.width = x;
    this.base.height = FONT_ROWS;
    const c = this.base.getContext('2d');
    if (!c) throw new Error('Canvas 2D not available');
    c.fillStyle = '#fff';
    for (const g of glyphs) {
      const gx = this.at.get(g) ?? 0;
      g.rows.forEach((row, y) => row.forEach((ink, i) => ink && c.fillRect(gx + i, g.top + y, 1, 1)));
    }
  }

  inColor(color: string): HTMLCanvasElement {
    let sheet = this.tinted.get(color);
    if (!sheet) {
      sheet = document.createElement('canvas');
      sheet.width = this.base.width;
      sheet.height = this.base.height;
      const c = sheet.getContext('2d');
      if (!c) throw new Error('Canvas 2D not available');
      c.drawImage(this.base, 0, 0);
      c.globalCompositeOperation = 'source-in';
      c.fillStyle = color;
      c.fillRect(0, 0, sheet.width, sheet.height);
      this.tinted.set(color, sheet);
    }
    return sheet;
  }
}

export class Renderer {
  readonly low: CanvasRenderingContext2D;
  private readonly display: CanvasRenderingContext2D;
  private readonly lowCanvas: HTMLCanvasElement;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private dpr = 1;
  private readonly glyphs = new GlyphSheet();
  /** Larger-text setting multiplies every text size (LARGE_TEXT_SCALE). */
  textScale = 1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.lowCanvas = document.createElement('canvas');
    this.lowCanvas.width = VIEW_W;
    this.lowCanvas.height = VIEW_H;
    const low = this.lowCanvas.getContext('2d');
    const display = canvas.getContext('2d');
    if (!low || !display) throw new Error('Canvas 2D not available');
    this.low = low;
    this.display = display;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    this.dpr = window.devicePixelRatio || 1;
    const w = Math.floor(window.innerWidth * this.dpr);
    const h = Math.floor(window.innerHeight * this.dpr);
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
    this.scale = Math.max(1, Math.floor(Math.min(w / VIEW_W, h / VIEW_H)));
    this.offsetX = Math.floor((w - VIEW_W * this.scale) / 2);
    this.offsetY = Math.floor((h - VIEW_H * this.scale) / 2);
  }

  /** Clears both layers. Call at the start of a frame. */
  begin(background: string): void {
    this.low.imageSmoothingEnabled = false;
    this.low.fillStyle = background;
    this.low.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  /** Blits the low-res buffer to the display. Text drawn after this sits on top. */
  present(): void {
    const d = this.display;
    d.setTransform(1, 0, 0, 1, 0, 0);
    d.fillStyle = '#000';
    d.fillRect(0, 0, this.canvas.width, this.canvas.height);
    d.imageSmoothingEnabled = false;
    d.drawImage(this.lowCanvas, this.offsetX, this.offsetY, VIEW_W * this.scale, VIEW_H * this.scale);
  }

  /** Screen pixels per font pixel for a text size, before fitting. */
  private fontPixel(size: number): number {
    return Math.max(1, Math.round((this.scale * size * this.textScale) / FULL_SIZE));
  }

  /** Font pixel after shrinking to fit `maxWidth` (internal px), never below one screen pixel. */
  private fitPixel(str: string, style: TextStyle): number {
    let p = this.fontPixel(style.size ?? 7);
    const w = measureText(str) + (style.bold ? 1 : 0);
    if (style.maxWidth !== undefined) {
      const max = style.maxWidth * this.scale;
      while (p > 1 && w * p > max) p -= 1;
    }
    return p;
  }

  /** Width of a line in internal pixels, as `text` would draw it. */
  measure(str: string, style: TextStyle = {}): number {
    return ((measureText(str) + (style.bold ? 1 : 0)) * this.fitPixel(str, style)) / this.scale;
  }

  /** Line pitch for a text size, in internal pixels (grows with larger text). */
  lineHeight(size: number): number {
    return (this.fontPixel(size) * 12) / this.scale;
  }

  /** Draws one line. `y` is the vertical middle of the capitals. */
  text(str: string, x: number, y: number, style: TextStyle = {}): void {
    const p = this.fitPixel(str, style);
    const width = (measureText(str) + (style.bold ? 1 : 0)) * p;
    const align = style.align ?? 'left';
    let left = this.offsetX + Math.round(x * this.scale);
    if (align === 'center') left -= Math.round(width / 2);
    else if (align === 'right' || align === 'end') left -= width;
    const top = this.offsetY + Math.round(y * this.scale - (FONT_MIDDLE_ROW + 0.5) * p);
    const d = this.display;
    d.imageSmoothingEnabled = false;
    if (style.outline) {
      const sheet = this.glyphs.inColor(style.outline);
      for (const [dx, dy] of [[-p, 0], [p, 0], [0, -p], [0, p]] as const) this.drawRun(sheet, str, left + dx, top + dy, p, style.bold ?? false);
    }
    this.drawRun(this.glyphs.inColor(style.color ?? '#e8e6df'), str, left, top, p, style.bold ?? false);
  }

  private drawRun(sheet: HTMLCanvasElement, str: string, left: number, top: number, p: number, bold: boolean): void {
    let cx = left;
    for (const ch of str) {
      const g = glyphOf(ch);
      const sx = this.glyphs.at.get(g) ?? 0;
      if (g.width > 0) {
        this.display.drawImage(sheet, sx, 0, g.width, FONT_ROWS, cx, top, g.width * p, FONT_ROWS * p);
        if (bold) this.display.drawImage(sheet, sx, 0, g.width, FONT_ROWS, cx + p, top, g.width * p, FONT_ROWS * p);
      }
      cx += g.advance * p;
    }
  }

  /** Fills a rectangle on the display layer (over text already drawn), in internal pixels. */
  panel(x: number, y: number, w: number, h: number, color: string): void {
    this.display.fillStyle = color;
    this.display.fillRect(this.offsetX + Math.round(x * this.scale), this.offsetY + Math.round(y * this.scale), Math.round(w * this.scale), Math.round(h * this.scale));
  }

  /** Converts a client (CSS pixel) point to internal pixels, or null if in the letterbox. */
  toInternal(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    const px = (clientX - rect.left) * this.dpr;
    const py = (clientY - rect.top) * this.dpr;
    const x = (px - this.offsetX) / this.scale;
    const y = (py - this.offsetY) / this.scale;
    if (x < 0 || y < 0 || x >= VIEW_W || y >= VIEW_H) return null;
    return { x, y };
  }
}
