# El estado real de cada proyecto

Un archivo por proyecto, en esta carpeta. De ahí sale el tablero; **el tablero no se escribe a
mano nunca**.

## Por qué así y no un porcentaje escrito en el spec

Un número escrito a mano se pudre en días. Pasó dos veces en una sola jornada: una nota decía
que el histórico de Foto Positiva no estaba cargado cuando ya estaba, y se le dijo a un
implementador que un bug seguía pendiente cuando ya se había arreglado.

Así que acá se separa **lo que una máquina puede verificar sola** de **lo único que necesita una
persona**:

| | Quién lo sabe |
|---|---|
| ¿Existe el commit? ¿El PR está mergeado? ¿CI verde? | `scripts/estado.mjs`, consultando git y GitHub |
| ¿La migración está aplicada? ¿El módulo está encendido? | Una consulta a la base, anotada como evidencia |
| **¿Alguien lo probó de punta a punta y funcionó?** | **Sólo una persona. Se tilda a mano.** |

## La regla que ordena todo

Un criterio llega a **100% sólo si está implementado Y probado en producción**. Implementado y
sin probar vale **50%**.

No es una penalización arbitraria: es la diferencia entre "el código existe" y "sabemos que
funciona". Un módulo entero mergeado, desplegado y nunca ejercitado es exactamente medio
trabajo, y hasta que esto existió eso no se veía en ninguna parte.

## Cómo se escribe un criterio

Un criterio es **algo que alguien puede hacer y comprobar**, no una tarea técnica.

- Bien: *"Una organización pide una cobertura desde el formulario público y recibe el correo con
  su enlace de seguimiento."*
- Mal: *"Implementar el submit de la solicitud."* — eso es una tarea, y las tareas ya viven en
  el plan.

La prueba: si no podés decir **cómo lo verificarías en producción**, no es un criterio.

## El formato

```json
{
  "proyecto": "Solicitudes y Coberturas",
  "plataforma": "FOTOFFICE",
  "spec": "apps/fotoffice/docs/superpowers/plans/2026-09-15-coberturas-etapa-1b.md",
  "etapas": [
    {
      "nombre": "1a — Pedir una cobertura y evaluarla",
      "criterios": [
        {
          "que": "Una ONG pide una cobertura y recibe el correo con su enlace de seguimiento",
          "implementado": { "pr": 112, "fecha": "2026-09-15" },
          "probado": { "fecha": "2026-09-17", "evidencia": "SC-2026-0001, SentEmailLog status SENT" }
        },
        {
          "que": "La coordinación aprueba el pedido y la organización se entera",
          "implementado": { "pr": 112, "fecha": "2026-09-15" },
          "probado": null,
          "bloqueado": "Falta la sesión de fotopositivos@gmail.com"
        }
      ]
    }
  ]
}
```

- `implementado`: `null`, o `{ pr, fecha }` / `{ commit, fecha }`. El script verifica que ese PR
  esté mergeado de verdad.
- `probado`: `null`, o `{ fecha, evidencia }`. **La evidencia es obligatoria** — "lo probé" sin
  decir qué se miró no es evidencia, y dentro de tres meses nadie se acuerda.
- `bloqueado`: texto libre, opcional. Lo que falta para poder probarlo. Un criterio bloqueado
  **no suma**, pero aparece en el tablero con su motivo en vez de parecer olvido.

## Los comandos

```bash
pnpm estado            # el resumen por consola
pnpm estado --verificar # además consulta GitHub: ¿ese PR está realmente mergeado?
pnpm estado --html      # genera el tablero
```

`--verificar` es el que evita la mentira más fácil: anotar un PR que todavía no se mergeó.
