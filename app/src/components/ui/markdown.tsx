import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// Renderer de markdown liviano (sin dependencias) para el subconjunto que produce
// la IA: **negrita**, *itálica*, `código`, títulos (#, ##, ###) y listas (-, *, 1.).
// No es un parser completo; cubre lo que generamos y se muestra lindo en la UI.

/** Inline: **negrita**, *itálica*, `código`. */
function renderInline(text: string, prefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const key = `${prefix}-${i++}`;
    if (m[2] !== undefined) nodes.push(<strong key={key}>{m[2]}</strong>);
    else if (m[3] !== undefined) nodes.push(<em key={key}>{m[3]}</em>);
    else if (m[4] !== undefined)
      nodes.push(
        <code
          key={key}
          className="bg-muted rounded px-1 py-0.5 font-mono text-[0.9em]"
        >
          {m[4]}
        </code>,
      );
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

const UL = /^\s*[-*]\s+/;
const OL = /^\s*\d+\.\s+/;
const H = /^(#{1,3})\s+(.*)$/;

export function Markdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }

    // Título
    const h = H.exec(line);
    if (h) {
      const level = h[1].length;
      const cls =
        level === 1
          ? "text-base font-semibold"
          : level === 2
            ? "text-base font-semibold"
            : "text-sm font-semibold";
      blocks.push(
        <p key={k} className={cls}>
          {renderInline(h[2], `h${k}`)}
        </p>,
      );
      k++;
      i++;
      continue;
    }

    // Lista no ordenada
    if (UL.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && UL.test(lines[i])) {
        items.push(
          <li key={items.length}>
            {renderInline(lines[i].replace(UL, ""), `ul${k}-${items.length}`)}
          </li>,
        );
        i++;
      }
      blocks.push(
        <ul key={k} className="list-disc space-y-0.5 pl-5">
          {items}
        </ul>,
      );
      k++;
      continue;
    }

    // Lista ordenada
    if (OL.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && OL.test(lines[i])) {
        items.push(
          <li key={items.length}>
            {renderInline(lines[i].replace(OL, ""), `ol${k}-${items.length}`)}
          </li>,
        );
        i++;
      }
      blocks.push(
        <ol key={k} className="list-decimal space-y-0.5 pl-5">
          {items}
        </ol>,
      );
      k++;
      continue;
    }

    // Párrafo (líneas consecutivas no especiales, con saltos blandos)
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !H.test(lines[i]) &&
      !UL.test(lines[i]) &&
      !OL.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    const children: ReactNode[] = [];
    para.forEach((l, idx) => {
      if (idx > 0) children.push(<br key={`br${k}-${idx}`} />);
      children.push(...renderInline(l, `p${k}-${idx}`));
    });
    blocks.push(<p key={k}>{children}</p>);
    k++;
  }

  return (
    <div className={cn("space-y-2 leading-relaxed", className)}>{blocks}</div>
  );
}
