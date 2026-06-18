import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUserId } from "@/server/session";
import { ChangePasswordForm } from "@/components/features/auth/ChangePasswordForm";

export default async function CambiarPasswordPage() {
  // Solo usuarios logueados (redirige a /login si no hay sesión).
  await requireUserId();

  return (
    <main className="bg-background flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="font-serif text-3xl">Psidesk</h1>
          <p className="text-muted-foreground text-sm">
            Definí tu contraseña para continuar.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Cambiar contraseña</CardTitle>
            <CardDescription>
              Tu cuenta usa una contraseña temporal. Elegí una nueva para seguir.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
