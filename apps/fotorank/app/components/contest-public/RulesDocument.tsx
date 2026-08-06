import React, { type ReactNode } from "react";

type Block =
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul" | "ol"; items: string[] }
  | { type: "hr" };

/** Inline: **bold**, *italic*, `code`, [label](url) — sin HTML crudo. */
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const src = text;
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(src))) {
    if (m.index > last) {
      nodes.push(src.slice(last, m.index));
    }
    const token = m[0];
    if (token.startsWith("**")) {
      nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      nodes.push(<em key={key++}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("`")) {
      nodes.push(<code key={key++}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("[")) {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
      if (link?.[1] && link[2]) {
        const href = link[2];
        const safe =
          href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:")
            ? href
            : "#";
        nodes.push(
          <a key={key++} href={safe} rel="noopener noreferrer">
            {link[1]}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    }
    last = m.index + token.length;
  }
  if (last < src.length) nodes.push(src.slice(last));
  return nodes;
}

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      blocks.push({ type: "hr" });
      i += 1;
      continue;
    }

    const h = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (h?.[1] && h[2]) {
      const level = h[1].length;
      blocks.push({
        type: level === 1 ? "h1" : level === 2 ? "h2" : "h3",
        text: h[2].trim(),
      });
      i += 1;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length) {
        const t = (lines[i] ?? "").trim();
        const item = /^[-*]\s+(.+)$/.exec(t);
        if (!item?.[1]) break;
        items.push(item[1]);
        i += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length) {
        const t = (lines[i] ?? "").trim();
        const item = /^\d+\.\s+(.+)$/.exec(t);
        if (!item?.[1]) break;
        items.push(item[1]);
        i += 1;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    const para: string[] = [trimmed];
    i += 1;
    while (i < lines.length) {
      const t = (lines[i] ?? "").trim();
      if (!t || /^#{1,3}\s+/.test(t) || /^[-*]\s+/.test(t) || /^\d+\.\s+/.test(t) || /^---+$/.test(t)) {
        break;
      }
      para.push(t);
      i += 1;
    }
    blocks.push({ type: "p", text: para.join(" ") });
  }

  return blocks;
}

type Props = {
  content: string;
  className?: string;
  /** Si true, el primer h1 del documento no se renderiza (evita duplicar el título de sección). */
  skipLeadingH1?: boolean;
};

/**
 * Renderer semántico de bases en Markdown ligero.
 * No introduce dependencias nuevas; evita mostrar marcadores técnicos (`## 8. Cronograma`).
 */
export function RulesDocument({ content, className, skipLeadingH1 = true }: Props) {
  const blocks = parseBlocks(content || "");
  let skippedH1 = false;

  return (
    <div className={["fr-rules-document", className].filter(Boolean).join(" ")}>
      {blocks.map((block, idx) => {
        if (block.type === "h1" && skipLeadingH1 && !skippedH1) {
          skippedH1 = true;
          return null;
        }
        if (block.type === "h1") {
          return (
            <h3 key={idx} className="fr-rules-document__h1">
              {renderInline(block.text)}
            </h3>
          );
        }
        if (block.type === "h2") {
          return (
            <h3 key={idx} className="fr-rules-document__h2">
              {renderInline(block.text)}
            </h3>
          );
        }
        if (block.type === "h3") {
          return (
            <h4 key={idx} className="fr-rules-document__h3">
              {renderInline(block.text)}
            </h4>
          );
        }
        if (block.type === "p") {
          return (
            <p key={idx} className="fr-rules-document__p">
              {renderInline(block.text)}
            </p>
          );
        }
        if (block.type === "ul") {
          return (
            <ul key={idx} className="fr-rules-document__ul">
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        if (block.type === "ol") {
          return (
            <ol key={idx} className="fr-rules-document__ol">
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ol>
          );
        }
        return <hr key={idx} className="fr-rules-document__hr" />;
      })}
    </div>
  );
}
