import { requireUserId } from "@/server/session";
import { getPatientsForList, getGroups } from "@/server/queries";
import { PatientsTable } from "@/components/features/patients/PatientsTable";

export default async function PacientesPage() {
  const userId = await requireUserId();
  const [patients, groups] = await Promise.all([
    getPatientsForList(userId),
    getGroups(userId),
  ]);

  const patientRows = patients.map((p) => ({
    id: p.id,
    fullName: p.fullName,
    age: p.age,
    sex: p.sex,
    lastSessionAt: p.lastSessionAt,
    sessions: p.sessions,
    worsening: p.worsening,
    inactive: p.inactive,
    noWhatsapp: p.noWhatsapp,
    active: p.active,
  }));

  const groupRows = groups.map((g) => ({
    id: g.id,
    name: g.name,
    memberNames: g.members.map((m) => m.patient.fullName),
    lastSessionAt: g.sessions[0]?.startsAt ?? null,
    sessions: g._count.sessions,
  }));

  const patientOptions = patients
    .map((p) => ({ id: p.id, fullName: p.fullName }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Pacientes</h1>
        <p className="text-muted-foreground">
          Individuales y grupos (parejas, familias).
        </p>
      </div>

      <PatientsTable
        patients={patientRows}
        groups={groupRows}
        patientOptions={patientOptions}
      />
    </div>
  );
}
