import { notFound } from "next/navigation";

import { requireUserId } from "@/server/session";
import { getPatient, getTests, userFeatureEnabled } from "@/server/queries";
import { patientSnapshot, resultOf } from "@/lib/clinicalSummary";
import { topicLabel } from "@/lib/sessionLabels";
import { toDateInputValue, patientFullName } from "@/lib/patients";
import { PatientSessions } from "@/components/features/sessions/PatientSessions";
import { PatientTests } from "@/components/features/tests/PatientTests";
import { PatientCheckins } from "@/components/features/checkins/PatientCheckins";
import { Attachments } from "@/components/features/attachments/Attachments";
import { PatientDiagnoses } from "@/components/features/patients/PatientDiagnoses";
import { PatientDetailTabs } from "@/components/features/patients/PatientDetailTabs";
import type { ClinicalRecordData } from "@/server/actions";

export default async function PacienteDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireUserId();
  const patient = await getPatient(userId, id);
  if (!patient) notFound();
  const canNotify = await userFeatureEnabled(userId, "whatsappAppointments");
  // Catálogo para el selector de "Cargar resultado" (sistema + propios).
  const catalog = (await getTests(userId)).map((t) => ({
    id: t.id,
    name: t.name,
    scored: t.scored,
    isSystem: t.isSystem,
  }));

  const now = Date.now();

  // Resumen process-centric: por cada proceso (el agrupador del tratamiento),
  // sus sesiones, tests completados, próxima/última sesión y snapshot clínico.
  const processSummaries = patient.processes.map((pr) => {
    const parts = patient.sessionParticipations.filter(
      (sp) => sp.processId === pr.id,
    );
    const procSessions = parts.map((sp) => sp.session);
    const upcoming = procSessions
      .filter(
        (s) =>
          new Date(s.startsAt).getTime() >= now &&
          s.status !== "CANCELED" &&
          s.status !== "NO_SHOW",
      )
      .sort(
        (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      );
    const procPast = procSessions
      .filter((s) => new Date(s.startsAt).getTime() < now)
      .sort(
        (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
      );
    const procAssignments = patient.assignments.filter(
      (a) => a.processId === pr.id,
    );
    // Seguimiento por WhatsApp del proceso: planes activos + última respuesta.
    const procCheckins = patient.checkinPlans.filter(
      (p) => p.processId === pr.id,
    );
    let lastCheckinResponse: Date | null = null;
    for (const plan of procCheckins) {
      for (const e of plan.entries) {
        if (e.status === "RESPONDED" && e.respondedAt) {
          const t = new Date(e.respondedAt);
          if (!lastCheckinResponse || t > lastCheckinResponse)
            lastCheckinResponse = t;
        }
      }
    }
    return {
      id: pr.id,
      motivo: pr.motivo,
      motivoCategory: pr.motivoCategory,
      status: pr.status,
      startedAt: pr.startedAt,
      endedAt: pr.endedAt,
      sessions: parts.length,
      testsCompleted: procAssignments.filter((a) => a.status === "COMPLETED")
        .length,
      nextSession: upcoming[0]
        ? { id: upcoming[0].id, startsAt: upcoming[0].startsAt }
        : null,
      lastSession: procPast[0]
        ? { id: procPast[0].id, startsAt: procPast[0].startsAt }
        : null,
      snapshot: patientSnapshot(procAssignments),
      checkins: {
        active: procCheckins.filter((p) => p.status === "ACTIVE").length,
        total: procCheckins.length,
        lastResponse: lastCheckinResponse,
      },
    };
  });

  // Agrupar sesiones y tests por proceso (activos primero; "sin proceso" al final).
  const processMeta = patient.processes.map((pr) => ({
    id: pr.id as string | null,
    motivo: pr.motivo,
    motivoCategory: pr.motivoCategory,
    status: pr.status as string | null,
    startedAt: pr.startedAt as Date | null,
    endedAt: pr.endedAt,
  }));
  const noProcess = {
    id: null,
    motivo: null,
    motivoCategory: null,
    status: null,
    startedAt: null as Date | null,
    endedAt: null,
  };

  const sessionGroups = [...processMeta, noProcess].map((g) => ({
    ...g,
    sessions: patient.sessionParticipations
      .filter((sp) => sp.processId === g.id)
      .map(({ session: s }) => ({
        id: s.id,
        participantIds: s.participants.map((p) => p.patientId),
        title: s.title,
        startsAt: s.startsAt,
        durationMin: s.durationMin,
        status: s.status,
        topic: s.topic,
        topicOther: s.topicOther,
        observations: s.observations,
        goals: s.goals,
        nextSteps: s.nextSteps,
        reminderOffsetMin: s.reminderOffsetMin,
        notifyPatient: s.notifyPatient,
      })),
  }));

  const sessionsSlot = (
    <PatientSessions
      patientId={patient.id}
      groups={sessionGroups}
      canNotify={canNotify}
    />
  );

  // Historial de tests: una fila por asignación (pendiente, respondida o
  // cargada a mano), más reciente primero.
  const testHistory = patient.assignments
    .map((a) => {
      const scored = a.result?.scoresJson ? resultOf(a) : null;
      const manual = Boolean(a.result && a.result.source === "PROFESSIONAL");
      return {
        assignmentId: a.id,
        token: a.token,
        testName: a.test.name,
        status: a.status as string,
        manual,
        edited: Boolean(a.result?.editedAt),
        when: (a.completedAt ?? a.createdAt) as Date,
        level: scored ? { label: scored.levelLabel, tone: scored.tone } : null,
        findings: manual
          ? ((a.result!.findingsJson as
              | { label: string; value: string }[]
              | null) ?? [])
          : [],
        notes: manual ? a.result!.notes : null,
        resultId: a.result?.id ?? null,
      };
    })
    .sort((x, y) => y.when.getTime() - x.when.getTime());

  const testsSlot = (
    <PatientTests
      patientId={patient.id}
      patientName={patientFullName(patient)}
      patientPhone={patient.phone}
      history={testHistory}
      catalog={catalog}
    />
  );

  // Seguimientos (check-ins) agrupados por proceso, igual que sesiones y tests.
  const checkinGroups = [...processMeta, noProcess]
    .map((g) => ({
      id: g.id,
      motivo: g.motivo,
      motivoCategory: g.motivoCategory,
      status: g.status,
      startedAt: g.startedAt,
      endedAt: g.endedAt,
      plans: patient.checkinPlans
        .filter((p) => p.processId === g.id)
        .map((p) => ({
          id: p.id,
          question: p.question,
          questionType: p.questionType,
          optionsJson: p.optionsJson,
          frequency: p.frequency,
          everyNDays: p.everyNDays,
          weekdaysJson: p.weekdaysJson,
          timeOfDay: p.timeOfDay,
          startDate: p.startDate,
          endDate: p.endDate,
          status: p.status,
          entries: p.entries.map((e) => ({
            id: e.id,
            scheduledFor: e.scheduledFor,
            status: e.status,
            responseText: e.responseText,
            responseValue: e.responseValue,
            respondedAt: e.respondedAt,
          })),
        })),
    }))
    .filter((g) => g.plans.length > 0);

  const checkinsSlot = (
    <PatientCheckins
      patientId={patient.id}
      phone={patient.phone}
      whatsappOptIn={patient.whatsappOptIn}
      groups={checkinGroups}
    />
  );

  // Vista por tratamiento (pestaña Tratamiento): cada proceso con sus sesiones,
  // tests y seguimientos; más un grupo "sin tratamiento" (consultas puntuales).
  const treatmentItems = (pid: string | null) => ({
    sessions: patient.sessionParticipations
      .filter((sp) => sp.processId === pid)
      .map((sp) => sp.session)
      .sort(
        (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
      )
      .map((s) => ({
        id: s.id,
        startsAt: s.startsAt,
        status: s.status,
        topic: topicLabel(s.topic, s.topicOther),
      })),
    tests: patient.assignments
      .filter((a) => a.processId === pid)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((a) => {
        const r = a.status === "COMPLETED" ? resultOf(a) : null;
        return {
          assignmentId: a.id,
          testName: a.test.name,
          status: a.status,
          levelLabel: r?.levelLabel ?? null,
          tone: r?.tone ?? null,
          when: r?.when ?? a.createdAt,
        };
      }),
    checkins: patient.checkinPlans
      .filter((p) => p.processId === pid)
      .map((p) => ({ id: p.id, question: p.question, status: p.status })),
  });

  const treatments = patient.processes.map((pr) => ({
    id: pr.id as string | null,
    status: pr.status as string | null,
    motivo: pr.motivo,
    motivoCategory: pr.motivoCategory,
    startedAt: pr.startedAt as Date | null,
    endedAt: pr.endedAt,
    ...treatmentItems(pr.id),
  }));
  const looseItems = treatmentItems(null);
  if (
    looseItems.sessions.length ||
    looseItems.tests.length ||
    looseItems.checkins.length
  ) {
    treatments.push({
      id: null,
      status: null,
      motivo: null,
      motivoCategory: null,
      startedAt: null,
      endedAt: null,
      ...looseItems,
    });
  }

  // Resumen del paciente (tab "Resumen"): conteos transversales a todos los
  // tratamientos + datos clínicos clave. El detalle vive en cada tab específico.
  const upcomingAll = patient.sessionParticipations
    .map((sp) => sp.session)
    .filter(
      (s) =>
        new Date(s.startsAt).getTime() >= now &&
        s.status !== "CANCELED" &&
        s.status !== "NO_SHOW",
    )
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
  const primaryDiagnosis =
    patient.diagnoses.find((d) => d.isPrimary) ?? patient.diagnoses[0] ?? null;
  const summary = {
    sessionsTotal: patient.sessionParticipations.length,
    sessionsDone: patient.sessionParticipations.filter(
      (sp) => sp.session.status === "COMPLETED",
    ).length,
    nextSession: upcomingAll[0]
      ? { id: upcomingAll[0].id, startsAt: upcomingAll[0].startsAt as Date }
      : null,
    testsDone: patient.assignments.filter((a) => a.status === "COMPLETED").length,
    testsPending: patient.assignments.filter((a) => a.status === "PENDING").length,
    checkinsTotal: patient.checkinPlans.length,
    checkinsActive: patient.checkinPlans.filter((p) => p.status === "ACTIVE")
      .length,
    diagnosesCount: patient.diagnoses.length,
    primaryDiagnosis: primaryDiagnosis
      ? { code: primaryDiagnosis.code, label: primaryDiagnosis.label }
      : null,
    worsening: processSummaries.some((p) => p.snapshot.worsening),
  };

  // Ficha clínica estructurada; migra el campo libre legacy a "notas generales".
  const clinicalRecord: ClinicalRecordData = {
    ...((patient.clinicalRecordJson as ClinicalRecordData | null) ?? {}),
  };
  if (!clinicalRecord.notes && patient.clinicalNotes) {
    clinicalRecord.notes = patient.clinicalNotes;
  }

  const attachmentsSlot = (
    <Attachments
      patientId={patient.id}
      attachments={patient.attachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        mimeType: a.mimeType,
        size: a.size,
        createdAt: a.createdAt,
      }))}
    />
  );

  const diagnosesSlot = (
    <PatientDiagnoses
      patientId={patient.id}
      diagnoses={patient.diagnoses.map((d) => ({
        id: d.id,
        code: d.code,
        label: d.label,
        isPrimary: d.isPrimary,
      }))}
    />
  );

  return (
    <PatientDetailTabs
      patient={{
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        email: patient.email,
        phone: patient.phone,
        whatsappOptIn: patient.whatsappOptIn,
        birthDate: toDateInputValue(patient.birthDate),
        sex: patient.sex,
        maritalStatus: patient.maritalStatus,
      }}
      processSummaries={processSummaries}
      summary={summary}
      treatments={treatments}
      clinicalRecord={clinicalRecord}
      sessionsSlot={sessionsSlot}
      testsSlot={testsSlot}
      diagnosesSlot={diagnosesSlot}
      checkinsSlot={checkinsSlot}
      attachmentsSlot={attachmentsSlot}
      canNotify={canNotify}
    />
  );
}
