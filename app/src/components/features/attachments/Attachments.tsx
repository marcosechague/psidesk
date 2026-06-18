"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Upload,
  Trash2,
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";

import { uploadAttachment, deleteAttachment } from "@/server/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export interface AttachmentData {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: Date | string;
}

interface AttachmentsProps {
  patientId: string;
  attachments: AttachmentData[];
}

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function Attachments({ patientId, attachments }: AttachmentsProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, startUpload] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("patientId", patientId);
    fd.set("file", file);
    startUpload(async () => {
      const res = await uploadAttachment(fd);
      if (fileRef.current) fileRef.current.value = "";
      if (res?.error) toast.error(res.error);
      else toast.success("Archivo subido");
    });
  }

  function remove(id: string) {
    setDeletingId(id);
    startDelete(async () => {
      const res = await deleteAttachment(id);
      setDeletingId(null);
      if (res?.error) toast.error(res.error);
      else toast.success("Adjunto eliminado");
    });
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept=".pdf,image/png,image/jpeg,image/webp,.txt,.doc,.docx"
        onChange={onPick}
      />
      <div className="flex flex-col items-end gap-1">
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Adjuntar archivo
        </Button>
        <p className="text-muted-foreground text-xs">
          PDF, imágenes, Word o texto · hasta 10 MB
        </p>
      </div>

      {attachments.length === 0 ? (
        <EmptyState>Sin adjuntos todavía.</EmptyState>
      ) : (
        <Card>
          <CardContent>
            <ul className="divide-border divide-y">
              {attachments.map((a) => {
                const isImage = a.mimeType.startsWith("image/");
                return (
                  <li key={a.id} className="flex items-center gap-3 py-3">
                <span className="bg-secondary text-secondary-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                  {isImage ? (
                    <ImageIcon className="h-4 w-4" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.fileName}</p>
                  <p className="text-muted-foreground text-xs">
                    {humanSize(a.size)} ·{" "}
                    {new Date(a.createdAt).toLocaleDateString("es-AR")}
                  </p>
                </div>
                <Button asChild variant="ghost" size="icon-sm">
                  <a
                    href={`/api/attachments/${a.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Descargar"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => remove(a.id)}
                  disabled={isDeleting && deletingId === a.id}
                  aria-label="Eliminar adjunto"
                >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
