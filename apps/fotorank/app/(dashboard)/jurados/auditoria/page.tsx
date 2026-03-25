import { Card } from "@repo/design-system";
import { listJudgeAuditEvents } from "../../../actions/judges";

export default async function JudgeAuditPage() {
  const result = await listJudgeAuditEvents();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-fr-primary">Auditoría de jurados</h1>
      {!result.ok ? (
        <Card><p className="text-sm text-red-300">{result.error}</p></Card>
      ) : (
        <div className="grid gap-3">
          {(result.data ?? []).map((e: any) => (
            <Card key={e.id}>
              <div className="flex items-center justify-between gap-4 text-sm">
                <div>
                  <p className="text-fr-primary font-semibold">{e.eventType}</p>
                  <p className="text-fr-muted">{e.entityType} · {e.entityId}</p>
                  <p className="text-fr-muted-soft">{e.actorUserName ?? e.actorJudgeName ?? "system"}</p>
                </div>
                <div className="text-fr-muted-soft">{new Date(e.createdAt).toLocaleString("es-AR")}</div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
