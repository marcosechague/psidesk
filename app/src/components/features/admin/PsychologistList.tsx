"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  User,
  Search,
  MessageCircle,
  MoreVertical,
  KeyRound,
  CreditCard,
  SlidersHorizontal,
  LogIn,
  Ban,
  RotateCcw,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { BillingStatus } from "@prisma/client";

import {
  FEATURE_KEYS,
  FEATURES,
  isEntitled,
  platformOn,
  type FeatureKey,
  type FeatureFlags,
} from "@/lib/features";
import { Switch } from "@/components/ui/switch";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { professionalName } from "@/lib/users";
import {
  adminSetActive,
  adminResetPassword,
  adminSetBilling,
  adminSetFeatureEntitlements,
  startImpersonation,
  adminDeleteUser,
} from "@/server/actions";

/** Estado comercial → etiqueta + variante de Badge. */
const BILLING_META: Record<
  BillingStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  BETA: { label: "Beta", variant: "outline" },
  TRIAL: { label: "Prueba", variant: "secondary" },
  ACTIVE: { label: "Suscripto", variant: "default" },
  EXPIRED: { label: "Vencido", variant: "destructive" },
};

const BILLING_OPTIONS: { value: BillingStatus; label: string }[] = [
  { value: "BETA", label: "Beta (gratis, midiendo)" },
  { value: "TRIAL", label: "Prueba gratis" },
  { value: "ACTIVE", label: "Suscripto (pago al día)" },
  { value: "EXPIRED", label: "Vencido" },
];

/** "YYYY-MM-DD" para el input date, a partir de Date | string | null. */
function toDateInput(value: Date | string | null): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** Fecha corta para mostrar (dd/mm/aaaa). */
function formatDate(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("es-PY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export interface PsychologistListItem {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  prefix: string | null;
  email: string;
  active: boolean;
  billingStatus: BillingStatus;
  billingUntil: Date | string | null;
  /** funciones habilitadas por el admin: { [key]: boolean }; null = todas ON */
  entitlements: Record<string, boolean> | null;
  createdAt: Date | string;
  patientCount: number;
  /** conversaciones de WhatsApp enviadas en el mes en curso */
  whatsappThisMonth: number;
}

export function PsychologistList({
  psychologists,
  platform,
}: {
  psychologists: PsychologistListItem[];
  /** interruptores maestros de la plataforma (para mostrar lo apagado globalmente) */
  platform?: FeatureFlags;
}) {
  const [q, setQ] = useState("");
  const [resetTarget, setResetTarget] = useState<PsychologistListItem | null>(null);
  const [billingTarget, setBillingTarget] = useState<PsychologistListItem | null>(null);
  const [featuresTarget, setFeaturesTarget] = useState<PsychologistListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PsychologistListItem | null>(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return psychologists;
    return psychologists.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.email.toLowerCase().includes(term),
    );
  }, [q, psychologists]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o email…"
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          No hay psicólogos que coincidan con “{q}”.
        </p>
      ) : (
        <div className="grid gap-3">
          {filtered.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="bg-secondary text-secondary-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                  <User className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{professionalName(p)}</p>
                  <p className="text-muted-foreground truncate text-sm">
                    {p.email}
                  </p>
                </div>
                <div className="hidden shrink-0 items-center gap-3 sm:flex">
                  {!p.active && <Badge variant="destructive">Suspendido</Badge>}
                  <Badge
                    variant={BILLING_META[p.billingStatus].variant}
                    title={
                      p.billingUntil
                        ? `Vence el ${formatDate(p.billingUntil)}`
                        : "Sin vencimiento"
                    }
                  >
                    {BILLING_META[p.billingStatus].label}
                    {p.billingUntil ? ` · ${formatDate(p.billingUntil)}` : ""}
                  </Badge>
                  <span className="text-muted-foreground text-sm">
                    {p.patientCount}{" "}
                    {p.patientCount === 1 ? "paciente" : "pacientes"}
                  </span>
                  <span
                    className="text-muted-foreground flex items-center gap-1 text-sm"
                    title="Conversaciones de WhatsApp este mes"
                  >
                    <MessageCircle className="h-4 w-4" />
                    {p.whatsappThisMonth}
                  </span>
                </div>
                <RowActions
                  psychologist={p}
                  onReset={() => setResetTarget(p)}
                  onBilling={() => setBillingTarget(p)}
                  onFeatures={() => setFeaturesTarget(p)}
                  onDelete={() => setDeleteTarget(p)}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ResetPasswordDialog
        target={resetTarget}
        onClose={() => setResetTarget(null)}
      />
      <BillingDialog
        target={billingTarget}
        onClose={() => setBillingTarget(null)}
      />
      <FeaturesDialog
        target={featuresTarget}
        platform={platform}
        onClose={() => setFeaturesTarget(null)}
      />
      <DeleteDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function RowActions({
  psychologist: p,
  onReset,
  onBilling,
  onFeatures,
  onDelete,
}: {
  psychologist: PsychologistListItem;
  onReset: () => void;
  onBilling: () => void;
  onFeatures: () => void;
  onDelete: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  function toggleActive() {
    startTransition(async () => {
      const res = await adminSetActive(p.id, !p.active);
      if (res?.error) toast.error(res.error);
      else toast.success(p.active ? "Cuenta suspendida" : "Cuenta reactivada");
    });
  }

  function enterAs() {
    startTransition(async () => {
      // En éxito redirige (server action); solo manejamos el error.
      const res = await startImpersonation(p.id);
      if (res?.error) toast.error(res.error);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Más acciones">
            <MoreVertical className="h-4 w-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={enterAs} disabled={isPending}>
          <LogIn className="h-4 w-4" />
          Entrar como
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onBilling}>
          <CreditCard className="h-4 w-4" />
          Estado / plan
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onFeatures}>
          <SlidersHorizontal className="h-4 w-4" />
          Funciones
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onReset}>
          <KeyRound className="h-4 w-4" />
          Resetear contraseña
        </DropdownMenuItem>
        <DropdownMenuItem onClick={toggleActive} disabled={isPending}>
          {p.active ? (
            <>
              <Ban className="h-4 w-4" />
              Suspender
            </>
          ) : (
            <>
              <RotateCcw className="h-4 w-4" />
              Reactivar
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ResetPasswordDialog({
  target,
  onClose,
}: {
  target: PsychologistListItem | null;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    if (!target) return;
    startTransition(async () => {
      const res = await adminResetPassword({ userId: target.id, password });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Contraseña actualizada");
      setPassword("");
      onClose();
    });
  }

  return (
    <Dialog
      open={!!target}
      onOpenChange={(open) => {
        if (!open) {
          setPassword("");
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resetear contraseña</DialogTitle>
          <DialogDescription>
            {target ? professionalName(target) : ""}. Definí la nueva contraseña
            y pasásela al profesional.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Nueva contraseña</label>
          <Input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={isPending || password.length < 8}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BillingDialog({
  target,
  onClose,
}: {
  target: PsychologistListItem | null;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<BillingStatus>("BETA");
  const [until, setUntil] = useState("");
  const [isPending, startTransition] = useTransition();

  // Al abrir con un nuevo target, precargar sus valores actuales.
  const targetId = target?.id ?? null;
  useEffect(() => {
    if (target) {
      setStatus(target.billingStatus);
      setUntil(toDateInput(target.billingUntil));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId]);

  function submit() {
    if (!target) return;
    startTransition(async () => {
      const res = await adminSetBilling({ userId: target.id, status, until });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Estado actualizado");
      onClose();
    });
  }

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Estado / plan</DialogTitle>
          <DialogDescription>
            {target ? professionalName(target) : ""}. Definí el estado comercial
            y, si corresponde, hasta cuándo vale (beta o prueba). No corta el
            acceso —para eso usá Suspender.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Estado</label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as BillingStatus)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BILLING_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Vence el <span className="text-muted-foreground">(opcional)</span>
            </label>
            <Input
              type="date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Dejalo vacío si no tiene vencimiento.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FeaturesDialog({
  target,
  platform,
  onClose,
}: {
  target: PsychologistListItem | null;
  platform?: FeatureFlags;
  onClose: () => void;
}) {
  const [flags, setFlags] = useState<Record<FeatureKey, boolean>>(
    () => Object.fromEntries(FEATURE_KEYS.map((k) => [k, true])) as Record<FeatureKey, boolean>,
  );
  const [isPending, startTransition] = useTransition();

  // Al abrir, reflejar los entitlements actuales (ausente = ON).
  const targetId = target?.id ?? null;
  useEffect(() => {
    if (target) {
      setFlags(
        Object.fromEntries(
          FEATURE_KEYS.map((k) => [k, isEntitled(target.entitlements, k)]),
        ) as Record<FeatureKey, boolean>,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId]);

  function submit() {
    if (!target) return;
    startTransition(async () => {
      const res = await adminSetFeatureEntitlements({
        userId: target.id,
        entitlements: flags,
      });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Funciones actualizadas");
      onClose();
    });
  }

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Funciones</DialogTitle>
          <DialogDescription>
            {target ? professionalName(target) : ""}. Lo que apagues acá, el
            profesional ni lo ve.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {FEATURE_KEYS.map((k) => {
            // Si la plataforma la apagó, está off para todos: se muestra apagada
            // y bloqueada (no se pisa el entitlement guardado).
            const offByPlatform = !platformOn(platform, k);
            return (
              <label
                key={k}
                className={
                  "flex items-start justify-between gap-4 " +
                  (offByPlatform ? "opacity-60" : "cursor-pointer")
                }
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {FEATURES[k].label}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {offByPlatform
                      ? "Desactivada en la plataforma para todos."
                      : FEATURES[k].description}
                  </span>
                </span>
                <Switch
                  checked={offByPlatform ? false : flags[k]}
                  disabled={offByPlatform}
                  onCheckedChange={(checked) =>
                    setFlags((f) => ({ ...f, [k]: checked }))
                  }
                />
              </label>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  target,
  onClose,
}: {
  target: PsychologistListItem | null;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  function confirm() {
    if (!target) return;
    startTransition(async () => {
      const res = await adminDeleteUser(target.id);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Psicólogo eliminado");
      onClose();
    });
  }

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar psicólogo</DialogTitle>
          <DialogDescription>
            Se eliminará la cuenta de{" "}
            <span className="font-medium">
              {target ? professionalName(target) : ""}
            </span>{" "}
            y todos sus datos (pacientes, sesiones, tests). Esta acción no se
            puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
