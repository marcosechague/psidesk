import { notFound } from "next/navigation";

import { requireUserId } from "@/server/session";
import { getGroup, getPatients } from "@/server/queries";
import { GroupDetail } from "@/components/features/patients/GroupDetail";

export default async function GrupoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireUserId();
  const [group, patients] = await Promise.all([
    getGroup(userId, id),
    getPatients(userId),
  ]);
  if (!group) notFound();

  return (
    <GroupDetail
      group={{
        id: group.id,
        name: group.name,
        members: group.members.map((m) => ({
          id: m.patient.id,
          fullName: m.patient.fullName,
        })),
      }}
      sessions={group.sessions.map((s) => ({
        id: s.id,
        startsAt: s.startsAt,
        status: s.status,
        participantNames: s.participants.map((p) => p.patient.fullName),
      }))}
      patientOptions={patients
        .map((p) => ({ id: p.id, fullName: p.fullName }))
        .sort((a, b) => a.fullName.localeCompare(b.fullName))}
    />
  );
}
