"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Check,
} from "lucide-react";

import { submitPatientResponse } from "@/server/actions";
import type { TestItem } from "@/lib/testItems";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PatientTestFormProps {
  token: string;
  items: TestItem[];
}

export function PatientTestForm({ token, items }: PatientTestFormProps) {
  const total = items.length;
  const reviewStep = total; // el paso N es la pantalla de revisión/envío
  const storageKey = `psidesk:answers:${token}`;

  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [isPending, setPending] = useState(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cargar progreso guardado y posicionarse en la primera sin responder.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as Record<number, number>;
        setAnswers(saved);
        let first = 0;
        while (first < total && saved[first + 1] !== undefined) first++;
        setStep(Math.min(first, total));
      }
    } catch {
      // ignorar storage no disponible
    }
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const answeredCount = Object.keys(answers).length;
  const isReview = step >= reviewStep;
  const itemNumber = step + 1; // 1-based
  const current = answers[itemNumber];
  const currentOptions = items[step]?.options ?? [];

  const persist = useCallback(
    (next: Record<number, number>) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // ignorar
      }
    },
    [storageKey],
  );

  const goTo = useCallback(
    (s: number) => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      setStep(Math.max(0, Math.min(s, reviewStep)));
    },
    [reviewStep],
  );

  const selectOption = useCallback(
    (value: number) => {
      const next = { ...answers, [itemNumber]: value };
      setAnswers(next);
      persist(next);
      // auto-avance con un pequeño delay para que se vea la selección
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      advanceTimer.current = setTimeout(() => {
        setStep((s) => Math.min(s + 1, reviewStep));
      }, 220);
    },
    [answers, itemNumber, persist, reviewStep],
  );

  async function submit() {
    if (answeredCount < total) {
      toast.error("Faltan ítems por responder");
      return;
    }
    const payload: Record<string, number> = {};
    for (const [k, v] of Object.entries(answers)) payload[k] = v;

    setPending(true);
    const res = await submitPatientResponse(token, payload);
    setPending(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo enviar");
      return;
    }
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignorar
    }
    setDone(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Atajos de teclado: 1..N selecciona opción, ←/→ navega.
  useEffect(() => {
    if (done) return;
    function onKey(e: KeyboardEvent) {
      if (isReview) return;
      const n = Number(e.key);
      if (n >= 1 && n <= currentOptions.length) {
        selectOption(currentOptions[n - 1].value);
      } else if (e.key === "ArrowLeft") {
        goTo(step - 1);
      } else if (e.key === "ArrowRight" && current !== undefined) {
        goTo(step + 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, isReview, currentOptions, selectOption, goTo, step, current]);

  if (done) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <CheckCircle2 className="text-primary h-12 w-12" />
          <h2 className="text-xl">¡Gracias por responder!</h2>
          <p className="text-muted-foreground max-w-sm text-sm">
            Tus respuestas fueron enviadas correctamente. Ya podés cerrar esta
            ventana.
          </p>
        </CardContent>
      </Card>
    );
  }

  const progressPct = Math.round(((isReview ? total : step) / total) * 100);

  return (
    <div className="space-y-5">
      {/* Progreso */}
      <div>
        <div className="text-muted-foreground mb-1 flex justify-between text-xs">
          <span>
            {isReview ? "Revisión final" : `Pregunta ${itemNumber} de ${total}`}
          </span>
          <span>
            {answeredCount}/{total} respondidas
          </span>
        </div>
        <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
          <div
            className="bg-primary h-full rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {isReview ? (
        <ReviewStep
          answers={answers}
          total={total}
          answeredCount={answeredCount}
          isPending={isPending}
          onEdit={(n) => goTo(n - 1)}
          onBack={() => goTo(total - 1)}
          onSubmit={submit}
        />
      ) : (
        <Card
          key={step}
          className="animate-in fade-in slide-in-from-right-2 duration-300"
        >
          <CardContent className="space-y-5 py-6">
            <p className="text-lg leading-snug font-medium">
              <span className="text-muted-foreground mr-2">{itemNumber}.</span>
              {items[step].text}
            </p>

            <div className="space-y-2.5">
              {currentOptions.map((o, i) => {
                const checked = current === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => selectOption(o.value)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border p-4 text-left text-[0.95rem] transition-colors",
                      checked
                        ? "border-primary bg-secondary"
                        : "hover:bg-muted/60 active:bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                        checked
                          ? "border-primary bg-primary text-primary-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {checked ? <Check className="h-4 w-4" /> : i + 1}
                    </span>
                    <span>{o.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => goTo(step - 1)}
                disabled={step === 0}
              >
                <ArrowLeft className="h-4 w-4" />
                Atrás
              </Button>
              {current !== undefined && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => goTo(step + 1)}
                >
                  Siguiente
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface ReviewStepProps {
  answers: Record<number, number>;
  total: number;
  answeredCount: number;
  isPending: boolean;
  onEdit: (itemNumber: number) => void;
  onBack: () => void;
  onSubmit: () => void;
}

function ReviewStep({
  answers,
  total,
  answeredCount,
  isPending,
  onEdit,
  onBack,
  onSubmit,
}: ReviewStepProps) {
  const missing: number[] = [];
  for (let i = 1; i <= total; i++) {
    if (answers[i] === undefined) missing.push(i);
  }
  const complete = missing.length === 0;

  return (
    <Card className="animate-in fade-in duration-300">
      <CardContent className="space-y-4 py-6 text-center">
        {complete ? (
          <>
            <CheckCircle2 className="text-primary mx-auto h-10 w-10" />
            <div>
              <h2 className="text-xl">Respondiste las {total} preguntas</h2>
              <p className="text-muted-foreground text-sm">
                Revisá si querés cambiar algo, o enviá tus respuestas.
              </p>
            </div>
          </>
        ) : (
          <div>
            <h2 className="text-xl">Te faltan {missing.length} respuestas</h2>
            <p className="text-muted-foreground text-sm">
              Tocá una pregunta pendiente para completarla:
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {missing.map((n) => (
                <Button
                  key={n}
                  size="sm"
                  variant="outline"
                  onClick={() => onEdit(n)}
                >
                  Pregunta {n}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={!complete || isPending}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Enviar respuestas
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          {answeredCount}/{total} respondidas
        </p>
      </CardContent>
    </Card>
  );
}
