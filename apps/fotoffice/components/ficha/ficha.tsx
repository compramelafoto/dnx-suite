import "server-only";
import type { ReactNode } from "react";
import { puede, puedeEnContexto } from "@/lib/access/policy";
import { contextoDeFicha, type PersonaPedida } from "@/lib/ficha/acceso";
import { listarAdjuntos } from "@/lib/ficha/adjuntos";
import { adjuntosR2Configurado } from "@/lib/ficha/adjuntos-r2";
import { asegurarCategorias, listarCategorias } from "@/lib/ficha/categorias";
import { etiquetasDePersona } from "@/lib/ficha/etiquetas";
import { armarLinea, serializarPagina } from "@/lib/ficha/linea-de-tiempo";
import { MAX_NOTAS_FIJADAS, listarNotas, puedeModificarNota } from "@/lib/ficha/notas";
import { proveedoresParaWorkspace } from "@/lib/ficha/proveedores";
import { relacionesDePersona } from "@/lib/ficha/relaciones";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { Adjuntos } from "./adjuntos";
import { CajaDeNota } from "./caja-de-nota";
import { EncabezadoFicha, type EncabezadoFichaProps } from "./encabezado-ficha";
import { Etiquetas } from "./etiquetas";
import { LineaDeTiempo } from "./linea-de-tiempo";
import { PersonasRelacionadas } from "./personas-relacionadas";
import type { AdjuntoVista, NotaVista } from "./tipos";

export type EncabezadoDeFicha = Omit<EncabezadoFichaProps, "etiquetas">;

/**
 * La ficha estándar de una persona (cliente o socio). Componente de servidor: la página ya
 * pasó el guarda de su módulo; acá se vuelve a resolver el contexto (sesión, workspace,
 * módulo, `operar`, persona del workspace) ANTES de leer notas, etiquetas, adjuntos o historia.
 *
 * - `encabezado`: nombre, tipo, contacto y botones del módulo (las etiquetas las pone la ficha).
 * - `datos`: los datos de la persona (`DatosFicha`, formularios), arriba de la columna lateral.
 * - `lateral`: tarjetas propias del módulo, debajo de los datos.
 */
export async function Ficha({
  persona,
  encabezado,
  datos,
  lateral,
}: {
  persona: PersonaPedida;
  encabezado: EncabezadoDeFicha;
  datos?: ReactNode;
  lateral?: ReactNode;
}) {
  const ctx = await contextoDeFicha(persona);
  // A los componentes de cliente viaja sólo esto: el tipo y el id que ya están en la URL.
  const ref = { tipo: persona.tipo, id: persona.id };
  if (!ctx) {
    // Sin permiso para la historia: se ve lo que la página ya decidió mostrar, nada más.
    return (
      <div className="space-y-6">
        <EncabezadoFicha {...encabezado} />
        <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
          <p className="fo-card p-4 text-sm text-[var(--fo-muted)]">No tenés acceso a la historia de esta ficha.</p>
          <aside className="space-y-4">
            {datos}
            {lateral}
          </aside>
        </div>
      </div>
    );
  }

  await asegurarCategorias(ctx.workspaceId, ctx.workspaceSlug);
  const esConfigurador = puede(ctx.role, "configurar");
  const veDinero = puedeEnContexto(ctx, "verDinero");
  // Sólo las fuentes de los módulos encendidos (Caja con `cash`; cuotas y carnets con `members`).
  const proveedores = await proveedoresParaWorkspace(ctx.workspaceId);

  const [categorias, notas, pagina, etiquetas, relaciones, adjuntos, vocabulario] = await Promise.all([
    listarCategorias(ctx.workspaceId),
    // Las fijadas vienen primero; alcanza con unas pocas más que el máximo.
    listarNotas(ctx.workspaceId, ctx.persona, { take: MAX_NOTAS_FIJADAS + 5 }),
    armarLinea({
      proveedores,
      ctx: { workspaceId: ctx.workspaceId, role: ctx.role, acceso: ctx.acceso, modulo: ctx.modulo },
      persona: ctx.persona,
      filtro: null,
      cursor: null,
    }),
    etiquetasDePersona(ctx.workspaceId, ctx.persona),
    relacionesDePersona(ctx.workspaceId, ctx.persona),
    listarAdjuntos(ctx, { conBorrados: esConfigurador }),
    loadPersonVocabulary(ctx.workspaceId),
  ]);

  const fijadas: NotaVista[] = notas
    .filter((n) => n.pinned)
    .map((n) => ({
      id: n.id,
      body: n.body,
      categoryId: n.categoryId,
      categoria: n.category?.name ?? "Observaciones",
      autor: n.authorLabel || null,
      fecha: n.createdAt.toISOString(),
      editada: n.editedAt !== null,
      pinned: true,
      puedeModificar: puedeModificarNota(ctx, n),
    }));

  // Sin la clave del objeto: sólo lo que se muestra.
  const adjuntosVista: AdjuntoVista[] = adjuntos.map((a) => ({
    id: a.id,
    nombre: a.fileName,
    tipo: a.contentType,
    tamano: a.sizeBytes,
    estado: a.status,
    subidoPor: a.uploadedByLabel,
    fecha: a.createdAt.toISOString(),
    restaurableHasta: a.status === "BORRADO" && a.purgeAfter ? a.purgeAfter.toISOString() : null,
  }));

  return (
    <div className="space-y-6">
      <EncabezadoFicha {...encabezado} etiquetas={<Etiquetas persona={ref} etiquetas={etiquetas} />} />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="min-w-0 space-y-4">
          <CajaDeNota persona={ref} categorias={categorias} />
          <LineaDeTiempo
            persona={ref}
            inicial={serializarPagina(pagina)}
            fijadas={fijadas}
            categorias={categorias}
            userId={ctx.userId}
            esConfigurador={esConfigurador}
            veDinero={veDinero}
          />
        </div>
        <aside className="min-w-0 space-y-4" aria-label="Datos de la persona">
          {datos}
          {lateral}
          <PersonasRelacionadas
            persona={ref}
            nombre={encabezado.titulo}
            relaciones={relaciones}
            palabraSocio={vocabulario.singular}
          />
          <Adjuntos persona={ref} adjuntos={adjuntosVista} habilitados={adjuntosR2Configurado()} esConfigurador={esConfigurador} />
        </aside>
      </div>
    </div>
  );
}
