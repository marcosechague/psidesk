import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "@/components/features/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="bg-background flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="font-serif text-3xl">Psidesk</h1>
          <p className="text-muted-foreground text-sm">
            Tests psicológicos, corregidos automáticamente.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Ingresar</CardTitle>
            <CardDescription>Accedé a tu cuenta de psicólogo/a.</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
        <p className="text-muted-foreground text-center text-sm">
          ¿No tenés cuenta? Pedile el alta al administrador.
        </p>
      </div>
    </main>
  );
}
