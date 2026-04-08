import { useEffect, useRef } from "react";

const SCIENCE_DATASET = [
  { type: "text", content: "a² + b² = c²", font: "italic 16px serif", rough: 0.28 },
  { type: "text", content: "tan α = a/b", font: "italic 15px serif", rough: 0.28 },
  { type: "text", content: "S = 2(ab+bc+ca)", font: "italic 14px serif", rough: 0.22 },
  { type: "text", content: "Δx Δp ≥ ℏ/2", font: "13px monospace", rough: 0.30 },
  { type: "text", content: "e^(iπ) + 1 = 0", font: "15px monospace", rough: 0.34 },
  { type: "text", content: "∇ × E = -∂B/∂t", font: "16px monospace", rough: 0.42 },
  { type: "text", content: "H = Σpᵢq̇ᵢ - L", font: "15px monospace", rough: 0.32 },
  { type: "text", content: "Rᵤᵥ - 1/2 Rgᵤᵥ = 8πG/c⁴ Tᵤᵥ", font: "12px monospace", rough: 0.42 },
  { type: "cone", radius: 40, height: 90, segments: 8 },
  { type: "icosahedron", size: 60 },
  { type: "mobius", radius: 50 },
] as const;

type ElementData = (typeof SCIENCE_DATASET)[number];

class ChalkSketch {
  x = 0;
  y = 0;
  opacity = 0;
  speed = 0;
  drift = 0;
  scale = 1;
  rotation = 0;
  data: ElementData = SCIENCE_DATASET[0];

  constructor(private width: number, private height: number) {
    this.reset(true);
  }

  setBounds(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  reset(initial = false) {
    this.x = Math.random() * this.width;
    this.y = initial ? Math.random() * this.height : this.height + Math.random() * 120;
    this.data = SCIENCE_DATASET[Math.floor(Math.random() * SCIENCE_DATASET.length)];
    this.opacity = Math.random() * 0.24 + 0.08;
    this.speed = 0.02 + Math.random() * 0.07;
    this.drift = (Math.random() - 0.5) * 0.28;
    this.scale = 0.85 + Math.random() * 0.6;
    this.rotation = (Math.random() - 0.5) * 0.35;
  }

  roughLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
    const jiggle = 0.7;
    ctx.beginPath();
    ctx.moveTo(x1 + (Math.random() - 0.5) * jiggle, y1 + (Math.random() - 0.5) * jiggle);
    ctx.lineTo(x2 + (Math.random() - 0.5) * jiggle, y2 + (Math.random() - 0.5) * jiggle);
    ctx.stroke();

    const originalAlpha = ctx.globalAlpha;
    ctx.beginPath();
    ctx.moveTo(x1 + (Math.random() - 0.5) * jiggle * 1.6, y1 + (Math.random() - 0.5) * jiggle * 1.6);
    ctx.lineTo(x2 + (Math.random() - 0.5) * jiggle * 1.6, y2 + (Math.random() - 0.5) * jiggle * 1.6);
    ctx.globalAlpha = originalAlpha * 0.35;
    ctx.stroke();
    ctx.globalAlpha = originalAlpha;
  }

  drawCone(ctx: CanvasRenderingContext2D) {
    if (this.data.type !== "cone") return;
    const { radius: r, height: h, segments: s } = this.data;
    for (let i = 0; i < s; i++) {
      const a = (i / s) * Math.PI * 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * (r * 0.2);
      this.roughLine(ctx, x, y, 0, -h);
      if (i > 0) {
        const pa = ((i - 1) / s) * Math.PI * 2;
        this.roughLine(ctx, x, y, Math.cos(pa) * r, Math.sin(pa) * (r * 0.2));
      }
    }
  }

  drawIcosahedron(ctx: CanvasRenderingContext2D) {
    if (this.data.type !== "icosahedron") return;
    const sz = this.data.size;
    const phi = ((1 + Math.sqrt(5)) / 2) * sz;
    ctx.lineWidth = 1.05;
    this.roughLine(ctx, 0, sz, phi, 0);
    this.roughLine(ctx, 0, sz, 0, -sz);
    this.roughLine(ctx, phi, 0, 0, -sz);
    this.roughLine(ctx, -sz, 0, 0, phi);
    this.roughLine(ctx, sz, 0, 0, phi);
    this.roughLine(ctx, -sz * 0.7, -sz * 0.35, sz * 0.7, -sz * 0.35);
  }

  drawMobius(ctx: CanvasRenderingContext2D) {
    if (this.data.type !== "mobius") return;
    const r = this.data.radius;
    const thick = 10;
    const res = 24;
    for (let i = 0; i < res; i++) {
      const a1 = (i / res) * Math.PI * 2;
      const a2 = ((i + 1) / res) * Math.PI * 2;
      const t1 = (i / res) * Math.PI * 2;
      const t2 = ((i + 1) / res) * Math.PI * 2;
      const p1x = (r + thick * Math.cos(t1 / 2)) * Math.cos(a1);
      const p1y = (r + thick * Math.cos(t1 / 2)) * Math.sin(a1);
      const p2x = (r + thick * Math.cos(t2 / 2)) * Math.cos(a2);
      const p2y = (r + thick * Math.cos(t2 / 2)) * Math.sin(a2);
      this.roughLine(ctx, p1x, p1y, p2x, p2y);
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.scale(this.scale, this.scale);

    const baseAlpha = this.opacity;
    ctx.fillStyle = `rgba(255,255,255,${baseAlpha})`;
    ctx.strokeStyle = `rgba(255,255,255,${baseAlpha * 0.9})`;
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;

    if (this.data.type === "text") {
      ctx.font = this.data.font;
      ctx.fillText(this.data.content, 0, 0);
      ctx.fillStyle = `rgba(255,255,255,${baseAlpha * this.data.rough})`;
      ctx.fillText(this.data.content, 0.8, 0.7);
      ctx.fillText(this.data.content, -0.6, 0.4);
    } else if (this.data.type === "cone") {
      this.drawCone(ctx);
    } else if (this.data.type === "icosahedron") {
      this.drawIcosahedron(ctx);
    } else {
      this.drawMobius(ctx);
    }

    ctx.restore();
  }

  update() {
    this.y -= this.speed;
    this.x += this.drift;
    if (this.y < -140 || this.x < -220 || this.x > this.width + 220) {
      this.reset();
    }
  }
}

export function BackgroundFX({ brand = "Teach" }: { brand?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resize();
    const elements = Array.from({ length: 34 }, () => new ChalkSketch(canvas.width, canvas.height));
    let frame = 0;

    const draw = () => {
      frame = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      elements.forEach((el) => {
        el.setBounds(canvas.width, canvas.height);
        el.update();
        el.draw(ctx);
      });
    };

    draw();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none text-[28vw] font-black tracking-[-0.12em] leading-none blueprint-brand-text opacity-95">
          {brand}
        </div>
      </div>
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-[2] h-full w-full" />
    </>
  );
}
