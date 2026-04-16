import { useEffect, useRef } from "react";

const SCIENCE_DATASET = [
  { type: "text", content: "a² + b² = c²",               font: "italic 16px serif",    rough: 0.28 },
  { type: "text", content: "tan α = a/b",                  font: "italic 15px serif",    rough: 0.28 },
  { type: "text", content: "e^(iπ) + 1 = 0",              font: "15px monospace",       rough: 0.34 },
  { type: "text", content: "∇ × E = -∂B/∂t",              font: "16px monospace",       rough: 0.42 },
  { type: "text", content: "Δx Δp ≥ ℏ/2",                font: "13px monospace",       rough: 0.30 },
  { type: "text", content: "Rᵤᵥ - ½ Rgᵤᵥ = 8πG/c⁴ Tᵤᵥ", font: "11px monospace",       rough: 0.42 },
  { type: "text", content: "H = Σpᵢq̇ᵢ - L",              font: "15px monospace",       rough: 0.32 },
  { type: "cone"        },
  { type: "icosahedron" },
  { type: "mobius"      },
] as const;

type ElementData = (typeof SCIENCE_DATASET)[number];

class ChalkSketch {
  x = 0; y = 0; opacity = 0; speed = 0; drift = 0;
  scale = 1; rotation = 0;
  data: ElementData = SCIENCE_DATASET[0];

  constructor(private width: number, private height: number) { this.reset(true); }

  setBounds(w: number, h: number) { this.width = w; this.height = h; }

  reset(initial = false) {
    this.x        = Math.random() * this.width;
    this.y        = initial ? Math.random() * this.height : this.height + Math.random() * 120;
    this.data     = SCIENCE_DATASET[Math.floor(Math.random() * SCIENCE_DATASET.length)];
    this.opacity  = Math.random() * 0.28 + 0.16;
    this.speed    = 0.02 + Math.random() * 0.07;
    this.drift    = (Math.random() - 0.5) * 0.28;
    this.scale    = 0.85 + Math.random() * 0.55;
    this.rotation = (Math.random() - 0.5) * 0.35;
  }

  roughLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
    const j = 0.7;
    ctx.beginPath();
    ctx.moveTo(x1 + (Math.random() - 0.5) * j, y1 + (Math.random() - 0.5) * j);
    ctx.lineTo(x2 + (Math.random() - 0.5) * j, y2 + (Math.random() - 0.5) * j);
    ctx.stroke();
    const a = ctx.globalAlpha;
    ctx.beginPath();
    ctx.moveTo(x1 + (Math.random() - 0.5) * j * 1.6, y1 + (Math.random() - 0.5) * j * 1.6);
    ctx.lineTo(x2 + (Math.random() - 0.5) * j * 1.6, y2 + (Math.random() - 0.5) * j * 1.6);
    ctx.globalAlpha = a * 0.35; ctx.stroke(); ctx.globalAlpha = a;
  }

  draw(ctx: CanvasRenderingContext2D, accentColor: string) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.scale(this.scale, this.scale);
    ctx.fillStyle   = `${accentColor}${Math.round(this.opacity * 255).toString(16).padStart(2, "0")}`;
    ctx.strokeStyle = `${accentColor}${Math.round(this.opacity * 0.9 * 255).toString(16).padStart(2, "0")}`;
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;

    if (this.data.type === "text") {
      const d = this.data as { type: "text"; content: string; font: string; rough: number };
      ctx.font = d.font;
      ctx.fillText(d.content, 0, 0);
      ctx.fillStyle = `${accentColor}${Math.round(this.opacity * d.rough * 255).toString(16).padStart(2, "0")}`;
      ctx.fillText(d.content, 0.8, 0.7);
      ctx.fillText(d.content, -0.6, 0.4);
    } else if (this.data.type === "cone") {
      const r = 40, h = 80, s = 8;
      for (let i = 0; i < s; i++) {
        const a = (i / s) * Math.PI * 2;
        const x = Math.cos(a) * r, y = Math.sin(a) * (r * 0.2);
        this.roughLine(ctx, x, y, 0, -h);
        if (i > 0) { const pa = ((i - 1) / s) * Math.PI * 2; this.roughLine(ctx, x, y, Math.cos(pa) * r, Math.sin(pa) * (r * 0.2)); }
      }
    } else if (this.data.type === "icosahedron") {
      const sz = 55, phi = ((1 + Math.sqrt(5)) / 2) * sz;
      this.roughLine(ctx, 0, sz, phi, 0); this.roughLine(ctx, 0, sz, 0, -sz);
      this.roughLine(ctx, phi, 0, 0, -sz); this.roughLine(ctx, -sz, 0, 0, phi);
      this.roughLine(ctx, sz, 0, 0, phi); this.roughLine(ctx, -sz * 0.7, -sz * 0.35, sz * 0.7, -sz * 0.35);
    } else {
      const r = 48, thick = 10, res = 24;
      for (let i = 0; i < res; i++) {
        const a1 = (i / res) * Math.PI * 2, a2 = ((i + 1) / res) * Math.PI * 2;
        const t1 = (i / res) * Math.PI * 2, t2 = ((i + 1) / res) * Math.PI * 2;
        const p1x = (r + thick * Math.cos(t1 / 2)) * Math.cos(a1);
        const p1y = (r + thick * Math.cos(t1 / 2)) * Math.sin(a1);
        const p2x = (r + thick * Math.cos(t2 / 2)) * Math.cos(a2);
        const p2y = (r + thick * Math.cos(t2 / 2)) * Math.sin(a2);
        this.roughLine(ctx, p1x, p1y, p2x, p2y);
      }
    }
    ctx.restore();
  }

  update() {
    this.y -= this.speed; this.x += this.drift;
    if (this.y < -140 || this.x < -220 || this.x > this.width + 220) this.reset();
  }
}

export function BackgroundFX({ brand = "Learn" }: { brand?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();

    const elements = Array.from({ length: 30 }, () => new ChalkSketch(canvas.width, canvas.height));
    let frame = 0;

    const draw = () => {
      frame = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Read accent color from CSS variable
      const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#66B539";
      elements.forEach((el) => { el.setBounds(canvas.width, canvas.height); el.update(); el.draw(ctx, accent); });
    };

    draw();
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", resize); };
  }, []);

  return (
    <>
      {/* fixed so it never moves during scroll or mode transitions */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 0 }}>
        <div
          className="select-none blueprint-brand-text"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            lineHeight: 1,
          }}
        >
          {brand}
        </div>
      </div>
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 h-full w-full"
        style={{ zIndex: 1 }}
      />
    </>
  );
}
