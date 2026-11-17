// 320x180 offscreen buffer, scaled by whole numbers, letterboxed, nearest-neighbour.
// Text is drawn on the scaled display canvas so accents stay crisp until a pixel font
// is chosen in milestone 4 (DECISIONS #31). Positions are always in internal pixels.

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
}

export class Renderer {
  readonly low: CanvasRenderingContext2D;
  private readonly display: CanvasRenderingContext2D;
  private readonly lowCanvas: HTMLCanvasElement;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private dpr = 1;

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

  text(str: string, x: number, y: number, style: TextStyle = {}): void {
    const d = this.display;
    const size = (style.size ?? 7) * this.scale;
    d.font = `${style.bold ? 'bold ' : ''}${size}px ui-monospace, Menlo, Consolas, monospace`;
    d.fillStyle = style.color ?? '#e8e6df';
    d.textAlign = style.align ?? 'left';
    d.textBaseline = 'middle';
    const px = this.offsetX + x * this.scale;
    const py = this.offsetY + y * this.scale;
    if (style.maxWidth !== undefined) {
      const max = style.maxWidth * this.scale;
      const w = d.measureText(str).width;
      if (w > max) d.font = `${style.bold ? 'bold ' : ''}${Math.floor((size * max) / w)}px ui-monospace, Menlo, Consolas, monospace`;
    }
    d.fillText(str, px, py);
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
