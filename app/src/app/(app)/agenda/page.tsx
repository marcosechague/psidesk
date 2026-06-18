import { requireUserId } from "@/server/session";
import {
  getSessions,
  getPatientsForScheduling,
  getGroups,
  getAvailability,
  userFeatureEnabled,
} from "@/server/queries";
import { AgendaView } from "@/components/features/agenda/AgendaView";

export default async function AgendaPage() {
  const userId = await requireUserId();
  const [sessions, patients, groups, availability, canNotify] = await Promise.all([
    getSessions(userId),
    getPatientsForScheduling(userId),
    getGroups(userId),
    getAvailability(userId),
    userFeatureEnabled(userId, "whatsappAppointments"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Calendario</h1>
        <p className="text-muted-foreground">
          Agendá y reprogramá tus citas. Para trabajar una sesión (notas, tests,
          iniciarla), entrá desde <strong>Sesiones</strong>.
        </p>
      </div>

      <AgendaView
        sessions={sessions.map((s) => ({
          id: s.id,
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
          groupId: s.groupId,
          participants: s.participants.map((sp) => sp.patient),
        }))}
        patients={patients}
        groups={groups.map((g) => ({
          id: g.id,
          name: g.name,
          memberIds: g.members.map((m) => m.patientId),
        }))}
        availability={availability}
        canNotify={canNotify}
      />
    </div>
  );
}
