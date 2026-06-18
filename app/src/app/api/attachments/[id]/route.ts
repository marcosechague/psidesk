import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getStorage, type StorageDriverName } from "@/lib/storage";

// Descarga protegida: verifica que el adjunto pertenezca a un paciente del
// psicólogo logueado, y transmite los bytes desde el storage (bucket privado).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return new Response("No autorizado", { status: 401 });
  }

  const att = await prisma.attachment.findFirst({
    where: { id, patient: { userId: session.user.id } },
  });
  if (!att) {
    return new Response("No encontrado", { status: 404 });
  }

  try {
    const bytes = await getStorage(att.driver as StorageDriverName).getBytes(
      att.storageKey,
    );
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": att.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(att.fileName)}"`,
        "Content-Length": String(att.size),
      },
    });
  } catch {
    return new Response("No se pudo recuperar el archivo", { status: 502 });
  }
}
