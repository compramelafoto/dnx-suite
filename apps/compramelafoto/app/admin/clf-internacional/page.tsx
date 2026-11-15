import { prisma } from "@/lib/prisma";
import Card from "@/components/ui/Card";
import { parsePilotUserIds, PILOT_ENV_VAR } from "@/lib/international/pilot";
import { getWalletState } from "@/lib/international/wallet-store";
import { intlMpCurrencies, latestFxRate } from "@/lib/international/fx-store";
import { isStale } from "@/lib/international/fx";
import { formatUsdCents, movementLabel } from "@/lib/international/wallet-labels";
import AjusteSaldoForm from "./AjusteSaldoForm";

export const dynamic = "force-dynamic";
const AR_TZ = "America/Argentina/Buenos_Aires";
const fecha = (d: Date) => d.toLocaleString("es-AR", { timeZone: AR_TZ });

/** CLF internacional (piloto): saldos, cotizaciones y recargas. Protegida por el layout de admin. */
export default async function AdminClfInternacionalPage() {
  const ids = [...parsePilotUserIds(process.env[PILOT_ENV_VAR])];
  const users = ids.length
    ? await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, email: true, countryCode: true },
      })
    : [];
  const wallets = await Promise.all(users.map(async (u) => ({ user: u, wallet: await getWalletState(u.id) })));
  const rates = await Promise.all(intlMpCurrencies().map(async (c) => ({ currency: c, rate: await latestFxRate(c) })));
  const topups = await prisma.clfIntlWalletMovement.findMany({
    where: { type: "TOPUP" },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const now = new Date();

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-semibold text-[#1a1a1a]">CLF internacional · piloto</h1>

      <Card className="space-y-3 overflow-x-auto">
        <h2 className="text-lg font-medium">Fotógrafos del piloto</h2>
        {wallets.length === 0 ? (
          <p className="text-sm text-[#6b7280]">No hay nadie en {PILOT_ENV_VAR}.</p>
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-[#6b7280]">
                <th className="py-2">Id</th>
                <th>Nombre</th>
                <th>País</th>
                <th>Saldo</th>
                <th>Adelanto a devolver</th>
                <th>Comisión 30 días</th>
                <th>Última venta</th>
              </tr>
            </thead>
            <tbody>
              {wallets.map(({ user, wallet }) => {
                const lastSale = wallet.movements.find((m) => m.type === "COMMISSION");
                return (
                  <tr key={user.id} className="border-t border-[#e5e7eb]">
                    <td className="py-2">{user.id}</td>
                    <td className="break-words">{user.name ?? user.email}</td>
                    <td>{user.countryCode ?? "—"}</td>
                    <td>{formatUsdCents(wallet.balanceUsdCents)}</td>
                    <td>{formatUsdCents(wallet.advanceDebtUsdCents)}</td>
                    <td>{formatUsdCents(wallet.last30DaysCommissionUsdCents)}</td>
                    <td>{lastSale ? fecha(lastSale.createdAt) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {wallets.map(({ user, wallet }) =>
          wallet.movements.length ? (
            <details key={user.id} className="text-sm">
              <summary className="cursor-pointer">Movimientos de {user.name ?? user.email}</summary>
              <ul className="mt-2 space-y-1">
                {wallet.movements.slice(0, 50).map((m) => (
                  <li key={m.id}>
                    {fecha(m.createdAt)} · {movementLabel(m)}
                  </li>
                ))}
              </ul>
            </details>
          ) : null,
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-medium">Ajuste manual</h2>
        <p className="text-sm text-[#6b7280]">
          Para devoluciones u otras correcciones. Monto positivo suma saldo; negativo descuenta.
        </p>
        <AjusteSaldoForm users={users.map((u) => ({ id: u.id, label: `${u.id} · ${u.name ?? u.email}` }))} />
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-medium">Cotizaciones (unidades por 1 USD)</h2>
        <ul className="space-y-1 text-sm">
          {rates.map(({ currency, rate }) => (
            <li key={currency}>
              {currency}:{" "}
              {rate ? (
                <>
                  {rate.unitsPerUsdBuy} · {fecha(rate.fetchedAt)}
                  {isStale(rate.fetchedAt, now) ? (
                    <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-amber-900">más de 48 h</span>
                  ) : null}
                </>
              ) : (
                <span className="text-red-700">sin cotización</span>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-3 overflow-x-auto">
        <h2 className="text-lg font-medium">Recargas por PayPal (para facturar)</h2>
        {topups.length === 0 ? (
          <p className="text-sm text-[#6b7280]">Todavía no hay recargas.</p>
        ) : (
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-[#6b7280]">
                <th className="py-2">Fecha</th>
                <th>Usuario</th>
                <th>Al saldo</th>
                <th>Pagado</th>
                <th>Captura PayPal</th>
              </tr>
            </thead>
            <tbody>
              {topups.map((t) => {
                let paid = t.amountUsdCents;
                try {
                  paid = Number(JSON.parse(t.note ?? "{}").paidUsdCents ?? paid);
                } catch {
                  /* nota vieja o vacía */
                }
                return (
                  <tr key={t.id} className="border-t border-[#e5e7eb]">
                    <td className="py-2">{fecha(t.createdAt)}</td>
                    <td>{t.userId}</td>
                    <td>{formatUsdCents(t.amountUsdCents)}</td>
                    <td>{formatUsdCents(paid)}</td>
                    <td className="break-all">{t.externalRef}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
