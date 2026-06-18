import { notFound } from "next/navigation";

import { requireUserId } from "@/server/session";
import {
  getSession,
  getTests,
  getNoteTemplates,
  getWritingVoices,
  getPatientMessageEmojis,
  userFeatureEnabled,
} from "@/server/queries";
import { patientSnapshot } from "@/lib/clinicalSummary";
import { buildEvolution } from "@/lib/evolution";
import type { ScoreResult } from "@/lib/scoring/types";
import { ageFromBirthDate } from "@/lib/patients";
import { SessionWorkspace } from "@/components/features/sessions/SessionWorkspace";

export default async function SesionWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireUserId();
  const [
    session,
    tests,
    templates,
    voices,
    patientMessageEmojis,
    aiSummaryEnabled,
    whatsappTasksEnabled,
  ] = await Promise.all([
    getSession(userId, id),
    getTests(userId),
    getNoteTemplates(userId),
    getWritingVoices(userId),
    getPatientMessageEmojis(userId),
    userFeatureEnabled(userId, "aiSummary"),
    userFeatureEnabled(userId, "whatsappTasks"),
  ]);
  if (!session) notFound();

  // Continuidad: la sesión anterior (de cualquiera de los participantes) con su
  // contenido, para mostrar "dónde quedamos" y heredar el foco de hoy.
  const currentStart = new Date(session.startsAt).getTime();
  const priorSeen = new Set<string>();
  let prevSession: {
    startsAt: Date;
    observations: string | null;
    goals: string | null;
    nextSteps: string | null;
    summary: string | null;
  } | null = null;
  for (const p of session.participants) {
    for (const sp of p.patient.sessionParticipations) {
      const s = sp.session;
      if (s.id === session.id || priorSeen.has(s.id)) continue;
      priorSeen.add(s.id);
      if (new Date(s.startsAt).getTime() >= currentStart) continue;
      if (
        !prevSession ||
        new Date(s.startsAt).getTime() >
          new Date(prevSession.startsAt).getTime()
      ) {
        prevSession = {
          startsAt: s.startsAt,
          observations: s.observations,
          goals: s.goals,
          nextSteps: s.nextSteps,
          summary: s.summary,
        };
      }
    }
  }
  return (
    <SessionWorkspace
      previousSession={prevSession}
      tests={tests.map((t) => ({ id: t.id, name: t.name }))}
      templates={templates.map((t) => ({
        id: t.id,
        name: t.name,
        isSystem: t.isSystem,
        isDefault: t.isDefault,
      }))}
      voices={voices.map((v) => ({
        id: v.id,
        name: v.name,
        isSystem: v.isSystem,
        isDefault: v.isDefault,
      }))}
      patientMessageEmojis={patientMessageEmojis}
      aiSummaryEnabled={aiSummaryEnabled}
      whatsappTasksEnabled={whatsappTasksEnabled}
      session={{
        id: session.id,
        title: session.title,
        startsAt: session.startsAt,
        durationMin: session.durationMin,
        status: session.status,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        topic: session.topic,
        topicOther: session.topicOther,
        observations: session.observations,
        goals: session.goals,
        nextSteps: session.nextSteps,
        summary: session.summary,
        templateId: session.templateId,
        voiceId: session.voiceId,
        summaryModel: session.summaryModel,
        summaryAt: session.summaryAt,
        patientMessage: session.patientMessage,
        taskSentAt: session.taskSentAt,
        participants: session.participants.map((p) => ({
          participantId: p.id,
          patientId: p.patientId,
          fullName: p.patient.fullName,
          age: ageFromBirthDate(p.patient.birthDate),
          sex: p.patient.sex,
          maritalStatus: p.patient.maritalStatus,
          email: p.patient.email,
          phone: p.patient.phone,
          individualNotes: p.individualNotes,
          snapshot: patientSnapshot(p.patient.assignments),
          // Series de evolución por test (solo con ≥2 tomas, que es lo graficable).
          testCharts: buildTestCharts(p.patient.assignments),
          assignments: p.patient.assignments.map((a) => ({
            id: a.id,
            testId: a.testId,
            testName: a.test.name,
            status: a.status,
            createdAt: a.createdAt,
            completedAt: a.completedAt,
            hasResult: Boolean(a.result),
            // Detalle del informe, para mostrarlo inline en la consola sin navegar.
            testDescription: a.test.description,
            responseType: a.test.responseType,
            itemsJson: a.test.itemsJson,
            scoresJson: a.result?.scoresJson
              ? (a.result.scoresJson as unknown as ScoreResult)
              : null,
            findings:
              (a.result?.findingsJson as
                | { label: string; value: string }[]
                | null) ?? null,
            notes: a.result?.notes ?? null,
            editedAt: a.result?.editedAt ?? null,
            answersJson: a.response?.answersJson ?? null,
          })),
          attachments: p.patient.attachments.map((a) => ({
            id: a.id,
            fileName: a.fileName,
            createdAt: a.createdAt,
          })),
          diagnoses: p.patient.diagnoses.map((d) => ({
            code: d.code,
            label: d.label,
            isPrimary: d.isPrimary,
            createdAt: d.createdAt,
          })),
          manualResults: p.patient.manualResults.map((r) => ({
            testName: r.testName,
            takenAt: r.takenAt,
            findings: (r.findingsJson as { label: string; value: string }[]) ?? [],
            notes: r.notes,
          })),
          checkinPlans: p.patient.checkinPlans.map((c) => ({
            id: c.id,
            question: c.question,
            status: c.status,
            createdAt: c.createdAt,
          })),
          // Historial: otras sesiones del paciente (excluye la actual).
          history: p.patient.sessionParticipations
            .map((sp) => sp.session)
            .filter((s) => s.id !== session.id),
        })),
      }}
    />
  );
}

type WorkspaceAssignment = NonNullable<
  Awaited<ReturnType<typeof getSession>>
>["participants"][number]["patient"]["assignments"][number];

/** Una serie de evolución por test (solo tests con ≥2 tomas completadas). */
function buildTestCharts(assignments: WorkspaceAssignment[]) {
  const completed = assignments.filter(
    // solo resultados puntuados (los cargados a mano no tienen serie de evolución)
    (a) => a.status === "COMPLETED" && a.result?.scoresJson && a.completedAt,
  );
  const byTest = new Map<string, WorkspaceAssignment[]>();
  for (const a of completed) {
    const arr = byTest.get(a.testId) ?? [];
    arr.push(a);
    byTest.set(a.testId, arr);
  }
  return [...byTest.values()]
    .map((arr) => {
      const { data, series } = buildEvolution(
        arr.map((a) => ({
          completedAt: a.completedAt,
          createdAt: a.createdAt,
          scoresJson: a.result!.scoresJson,
        })),
      );
      return { testName: arr[0].test.name, data, series };
    })
    .filter((c) => c.data.length >= 2);
}
