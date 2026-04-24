/**
 * Lightweight Markdown renderer for Spark AI responses.
 * Supports: **bold**, *italic*, `inline code`, ```code blocks```,
 *           # headings, - bullet lists, 1. numbered lists,
 *           > blockquotes, --- horizontal rules, ~~strikethrough~~
 */
import React from "react";
import { F } from "./types.tsx";

/* ── Inline renderer ────────────────────────────────────
   Converts inline markdown tokens to React nodes.
   Priority order: **bold** → ~~strike~~ → `code` → *italic*
   (bold before italic so ** is consumed first)
──────────────────────────────────────────────────────── */
function renderInline(text: string): React.ReactNode {
  if (!text) return null;

  // Split on inline markdown markers, preserving the matched tokens.
  // ** before * so that **bold** doesn't get split on a single *.
  const parts = text.split(
    /(\*\*[^*\n]+?\*\*|~~[^~\n]+?~~|`[^`\n]+`|\*[^*\n]+?\*)/g,
  );

  // No formatting found — fast path
  if (parts.length === 1) return text;

  return (
    <>
      {parts.map((seg, idx) => {
        if (!seg) return null;
        if (seg.startsWith("**") && seg.endsWith("**"))
          return <strong key={idx}>{seg.slice(2, -2)}</strong>;
        if (seg.startsWith("~~") && seg.endsWith("~~"))
          return <del key={idx} style={{ opacity: 0.65 }}>{seg.slice(2, -2)}</del>;
        if (seg.startsWith("`") && seg.endsWith("`"))
          return (
            <code
              key={idx}
              style={{
                fontFamily: F.mono,
                fontSize: "0.85em",
                padding: "1px 5px",
                borderRadius: "4px",
                background: "rgba(0,0,0,0.09)",
                letterSpacing: 0,
              }}
            >
              {seg.slice(1, -1)}
            </code>
          );
        if (seg.startsWith("*") && seg.endsWith("*"))
          return <em key={idx}>{seg.slice(1, -1)}</em>;
        return seg;
      })}
    </>
  );
}

/* ── Block renderer ─────────────────────────────────────
   Processes a chunk of plain text (between code fences)
   line-by-line into headings, lists, blockquotes, etc.
──────────────────────────────────────────────────────── */
function renderTextBlock(
  content: string,
  compact: boolean,
  baseKey: number,
): { nodes: React.ReactNode[]; nextKey: number } {
  const nodes: React.ReactNode[] = [];
  let key = baseKey;
  const fs = compact ? "0.78rem" : "0.86rem";
  const lines = content.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line  = lines[i];
    const trimmed = line.trim();

    /* Empty line → just advance */
    if (!trimmed) { i++; continue; }

    /* ── Heading: # / ## / ### */
    const hm = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (hm) {
      const level = hm[1].length;
      const sizes  = ["1.06rem", "0.97rem", "0.9rem"];
      const topGap = level === 1 ? "10px" : "6px";
      nodes.push(
        <div
          key={key++}
          style={{
            fontFamily: F.heading,
            fontWeight: 800,
            fontSize: compact ? "0.84rem" : sizes[level - 1],
            color: "var(--text-primary)",
            marginTop: topGap,
            marginBottom: "1px",
            lineHeight: 1.35,
          }}
        >
          {renderInline(hm[2])}
        </div>,
      );
      i++;
      continue;
    }

    /* ── Horizontal rule: --- / *** / ___ */
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      nodes.push(
        <hr
          key={key++}
          style={{ border: "none", borderTop: "1px solid var(--border)", margin: "6px 0" }}
        />,
      );
      i++;
      continue;
    }

    /* ── Blockquote: > text */
    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      nodes.push(
        <blockquote
          key={key++}
          style={{
            margin: "4px 0",
            paddingLeft: "12px",
            borderLeft: "3px solid var(--accent)",
            color: "var(--text-secondary)",
            fontStyle: "italic",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
        >
          {quoteLines.map((ql, qi) => (
            <span key={qi} style={{ fontFamily: F.body, fontSize: fs }}>
              {renderInline(ql)}
            </span>
          ))}
        </blockquote>,
      );
      continue;
    }

    /* ── Bullet list: - / * / + */
    if (/^[-*+]\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().slice(2));
        i++;
      }
      nodes.push(
        <ul
          key={key++}
          style={{
            margin: "2px 0",
            paddingLeft: compact ? "16px" : "20px",
            display: "flex",
            flexDirection: "column",
            gap: compact ? "1px" : "3px",
          }}
        >
          {items.map((item, li) => (
            <li key={li} style={{ fontFamily: F.body, fontSize: fs, lineHeight: 1.65 }}>
              {renderInline(item)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    /* ── Numbered list: 1. / 2. / … */
    if (/^\d+\.\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s/, ""));
        i++;
      }
      nodes.push(
        <ol
          key={key++}
          style={{
            margin: "2px 0",
            paddingLeft: compact ? "18px" : "22px",
            display: "flex",
            flexDirection: "column",
            gap: compact ? "1px" : "3px",
          }}
        >
          {items.map((item, li) => (
            <li key={li} style={{ fontFamily: F.body, fontSize: fs, lineHeight: 1.65 }}>
              {renderInline(item)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    /* ── Regular paragraph line */
    nodes.push(
      <span
        key={key++}
        style={{ display: "block", fontFamily: F.body, fontSize: fs, lineHeight: 1.68 }}
      >
        {renderInline(line)}
      </span>,
    );
    i++;
  }

  return { nodes, nextKey: key };
}

/* ── Public component ───────────────────────────────── */
export function MarkdownText({
  text,
  compact,
}: {
  text: string;
  compact?: boolean;
}) {
  if (!text) return null;

  /* Split on fenced code blocks first — they're immune to inline parsing */
  const CODE_FENCE = /```([^\n]*)\n([\s\S]*?)```/g;
  const segments: Array<
    | { kind: "text"; content: string }
    | { kind: "code"; lang: string; code: string }
  > = [];

  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = CODE_FENCE.exec(text)) !== null) {
    if (m.index > lastIdx) {
      segments.push({ kind: "text", content: text.slice(lastIdx, m.index) });
    }
    segments.push({ kind: "code", lang: m[1].trim(), code: m[2] });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) {
    segments.push({ kind: "text", content: text.slice(lastIdx) });
  }

  /* Render all segments */
  const nodes: React.ReactNode[] = [];
  let key = 0;

  for (const seg of segments) {
    if (seg.kind === "code") {
      nodes.push(
        <pre
          key={key++}
          style={{
            fontFamily: F.mono,
            fontSize: compact ? "0.71rem" : "0.77rem",
            background: "var(--bg-primary)",
            border: "1px solid var(--border)",
            borderRadius: "9px",
            padding: "10px 14px",
            overflowX: "auto",
            whiteSpace: "pre",
            margin: "4px 0",
          }}
        >
          {seg.lang && (
            <div
              style={{
                fontFamily: F.body,
                fontSize: "0.65rem",
                color: "var(--text-muted)",
                marginBottom: "6px",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {seg.lang}
            </div>
          )}
          <code style={{ color: "var(--text-primary)" }}>{seg.code.trimEnd()}</code>
        </pre>,
      );
    } else {
      const { nodes: blockNodes, nextKey } = renderTextBlock(seg.content, !!compact, key);
      nodes.push(...blockNodes);
      key = nextKey;
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: compact ? "5px" : "7px",
      }}
    >
      {nodes}
    </div>
  );
}
