import { requireUserId } from "@/server/session";
import {
  getSessions,
  getPatientsForScheduling,
  getGroups,
  userFeatureEnabled,
} from "@/server/queries";
import { SessionsHub } from "@/components/features/sessions/SessionsHub";

export default async function SesionesPage() {
  const userId = await requireUserId();
  const [sessions, patients, groups, canNotify] = await Promise.all([
    getSessions(userId),
    getPatientsForScheduling(userId),
    getGroups(userId),
    userFeatureEnabled(userId, "whatsappAppointments"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Sesiones</h1>
        <p className="text-muted-foreground">
          Tu espacio de trabajo clínico: las de hoy, en curso e historial.
        </p>
      </div>

      <SessionsHub
        sessions={sessions.map((s) => ({
          id: s.id,
          title: s.title,
          startsAt: s.startsAt,
          durationMin: s.durationMin,
          status: s.status,
          topic: s.topic,
          topicOther: s.topicOther,
          participants: s.participants.map((sp) => sp.patient),
        }))}
        patients={patients}
        groups={groups.map((g) => ({
          id: g.id,
          name: g.name,
          memberIds: g.members.map((m) => m.patientId),
        }))}
        canNotify={canNotify}
      />
    </div>
  );
}
