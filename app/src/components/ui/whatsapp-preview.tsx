import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// Previsualización estilo WhatsApp: muestra el mensaje tal cual lo verá el
// paciente en el chat. Interpreta el formato de WhatsApp (NO markdown):
//   *negrita*  _itálica_  ~tachado~  ```monoespacio```
// Respeta los saltos de línea. Pensado para el "Mensaje para el paciente",
// que se envía por WhatsApp.

/** Inline: *negrita*, _itálica_, ~tachado~, ```mono```. Un solo asterisco = negrita (como WhatsApp). */
function renderInline(text: string, prefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /(```([^`]+)```|\*([^*\n]+)\*|_([^_\n]+)_|~([^~\n]+)~)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const key = `${prefix}-${i++}`;
    if (m[2] !== undefined)
      nodes.push(
        <code key={key} className="font-mono text-[0.9em]">
          {m[2]}
        </code>,
      );
    else if (m[3] !== undefined) nodes.push(<strong key={key}>{m[3]}</strong>);
    else if (m[4] !== undefined) nodes.push(<em key={key}>{m[4]}</em>);
    else if (m[5] !== undefined) nodes.push(<s key={key}>{m[5]}</s>);
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function WhatsappPreview({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const text = content.replace(/\r\n/g, "\n");
  return (
    // Área de chat (fondo tipo WhatsApp) con la burbuja saliente a la derecha.
    <div
      className={cn(
        "flex justify-end rounded-lg bg-[#efeae2] p-3 dark:bg-[#0b141a]",
        className,
      )}
    >
      <div className="relative max-w-[85%] rounded-xl rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-base leading-relaxed whitespace-pre-wrap text-neutral-900 shadow-sm dark:bg-[#005c4b] dark:text-neutral-50">
        {renderInline(text, "wa")}
      </div>
    </div>
  );
}
