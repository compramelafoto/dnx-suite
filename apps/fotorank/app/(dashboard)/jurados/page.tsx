import Link from "next/link";
import { Card, Button, Badge } from "@repo/design-system";
import { listJudgesForOrg } from "../../actions/judges";

export default async function JuradosPage() {
  const result = await listJudgesForOrg();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-fr-primary">Jurados</h1>
        <Link href="/jurados/nuevo">
          <Button>Nuevo jurado</Button>
        </Link>
      </div>

      {!result.ok ? (
        <Card><p className="text-sm text-red-300">{result.error}</p></Card>
      ) : result.data?.length === 0 ? (
        <Card><p className="text-sm text-fr-muted">Todavía no hay jurados.</p></Card>
      ) : (
        <div className="grid gap-4">
          {result.data?.map((j) => (
            <Card key={String(j.judgeId)}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-fr-primary">{String((j as any).profile?.firstName ?? "")} {String((j as any).profile?.lastName ?? "")}</h2>
                  <p className="text-sm text-fr-muted">{String(j.email)}</p>
                  <p className="mt-2 text-xs text-fr-muted-soft">Último acceso: {(j as any).lastLoginAt ? new Date((j as any).lastLoginAt).toLocaleString("es-AR") : "sin actividad"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="neutral">{String(j.accountStatus)}</Badge>
                  <Link href={`/jurados/${String(j.judgeId)}/editar`}><Button variant="outline" size="sm">Editar</Button></Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
