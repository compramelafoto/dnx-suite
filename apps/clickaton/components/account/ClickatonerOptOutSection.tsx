import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { setClickatonerOptOutAction } from "@/lib/clickatoner/account-actions";

/**
 * Mi cuenta: si la persona quiere o no aparecer como Clickatoner de la semana.
 *
 * Por defecto entra (aceptó las bases, que incluyen el uso de su imagen); acá puede salir.
 */
export function ClickatonerOptOutSection({ optedOut }: { optedOut: boolean }) {
  return (
    <Card id="clickatoner" variant="default" className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ck-yellow">
        Clickatoner de la semana
      </p>
      <p className="text-sm leading-relaxed text-ck-text-secondary">
        Cada viernes la portada presenta a alguien que corrió una maratón con resultados
        publicados, con su foto, su ciudad, su Instagram y su mejor obra, y un link a su página.
        Si participaste, en algún momento te puede tocar.
      </p>
      <p className="text-sm text-ck-text">
        {optedOut
          ? "Pediste no aparecer. No vas a salir en la portada y tu página no se muestra."
          : "Podés aparecer como Clickatoner de la semana."}
      </p>
      <form action={setClickatonerOptOutAction}>
        <input type="hidden" name="optOut" value={optedOut ? "0" : "1"} />
        <Button type="submit" variant={optedOut ? "secondary" : "outline"} size="sm">
          {optedOut ? "Quiero volver a poder aparecer" : "No quiero aparecer como Clickatoner de la semana"}
        </Button>
      </form>
    </Card>
  );
}
