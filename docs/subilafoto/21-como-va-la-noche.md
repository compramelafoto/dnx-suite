# Cómo va la noche

*Etapa 5. El panel de monitoreo del lanzamiento. 2026-09-15.*

El cronograma pide "monitoreo activo" el 10 de octubre. Sin nada construido, eso significa
alguien refrescando consultas SQL a mano a la una de la mañana. Esto es lo que reemplaza a
eso.

## La falla que no se ve

Un cron que deja de correr **no tira error y no rompe ninguna pantalla**. Las fotos
simplemente no se moderan. Nadie se entera hasta que alguien pregunta por qué la pantalla
del salón está vacía, y para entonces pasó media fiesta.

Ninguna tabla contestaba esa pregunta. Por eso hay una nueva, `SubilafotoCronRun`: **una
fila por tarea, actualizada en el lugar**. Cinco filas para siempre, no un registro que
crece. No es historia —para eso están los registros de Vercel— es la respuesta a "¿esto
sigue corriendo?".

### Cuánto es "tarde" depende de cada uno

No hay un número que sirva para todos: la moderación corre cada 5 minutos y la purga una
vez por día.

| Estado | Cuándo |
|---|---|
| Bien | Menos de 3 cadencias |
| Atrasado | 3 cadencias o más |
| Caído | 6 cadencias o más |

Tres cadencias de tolerancia porque Vercel no garantiza el minuto exacto y una corrida que
tarda puede correr la siguiente. Al triple ya no es demora.

Dos reglas que costaron un test cada una:

- **Sin fila está caído, no bien.** Es el error más caro que puede tener un panel de salud:
  un panel en verde es justamente lo que hace que nadie mire.
- **Una corrida reciente con error no está bien.** Que haya corrido hace un minuto no la
  salva si terminó mal.

## Qué hacer, no qué pasa

Un panel de números no sirve a la una de la mañana. Cada alerta trae **su instrucción**,
porque quien la lee está apurado y probablemente no sea quien escribió el sistema.

| Alerta | Gravedad | Qué dice hacer |
|---|---|---|
| Pagos acreditados sin evento | Grave | Buscar el motivo en los registros y crear el evento a mano |
| Fotos trabadas +10 min | Grave desde 10 | Disparar la moderación; si vuelve a pasar, mirar la credencial de Amazon |
| Paquetes fallados | Grave | El motivo está en la columna `error`; son clientes que pagaron |
| Eventos vencidos sin cerrar | Aviso | Disparar el cierre; no interrumpe nada en curso |
| Correos no enviados | Aviso | El motivo está en `error`; un aviso que falla no se reintenta |
| Fotos aprobadas sin variante | Aviso | No se ven en ningún lado; el cron las levanta de a cinco |

**Primero la plata.** Un pago acreditado sin evento es lo único de la lista donde alguien
ya pagó y no tiene nada, y lo único que no se arregla solo con el tiempo.

Una precisión que evita una alarma permanente: se cuentan sólo las órdenes de **evento**.
El adicional de descarga se compra sobre un evento que ya existe y por definición no crea
ninguno.

## La pantalla

`/panel/salud`. Pensada para leerse de un vistazo desde el teléfono, parado: primero el
semáforo, después qué hacer, y recién al final los números. **Se recarga sola cada medio
minuto** — un panel que hay que refrescar a mano es un panel que nadie mira.

Ninguna consulta trae filas, sólo cuenta. La pantalla se recarga durante un evento y una
consulta que trae doscientas fotos para contarlas molesta justo cuando el sistema está
ocupado.

### Quién la ve

Muestra el estado de **toda la plataforma**, no el de un evento, así que no alcanza con
estar logueado: hace falta `globalRole` `SUPER_ADMIN` o `PLATFORM_SUPPORT`.

> **Hoy no hay ningún usuario con ese rol en producción.** Para habilitarla:
>
> ```sql
> UPDATE "User" SET "globalRole" = 'SUPER_ADMIN' WHERE email = '<tu mail>';
> ```
>
> Ojo: ese rol es de **toda la suite**, no sólo de Subí la Foto. Da acceso a los paneles
> de administración de las otras plataformas. Por eso no lo puse yo.

## Y por si no hay nadie con ese rol

`/api/salud` devuelve lo mismo en JSON, con la llave de servicio:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" https://subilafoto.com/api/salud
```

Responde **503 cuando algo dejó de correr** y 200 cuando está bien, así se le puede colgar
un chequeo externo sin que tenga que interpretar el cuerpo.

## Verificado en producción (2026-09-15)

Recién desplegado, con la tabla vacía, el panel dijo lo que tenía que decir:

```
semáforo: caido → HTTP 503
  moderacion  caido  Nunca corrió
  cierre      caido  Nunca corrió
  paquetes    caido  Nunca corrió
  avisos      caido  Nunca corrió
  purga       caido  Nunca corrió
```

**Eso es lo correcto, no un error.** Sin fila no sabemos si el cron corre, y decir "todo
bien" ahí sería exactamente el fallo que este panel existe para evitar.

Después de disparar las cinco tareas una vez:

```
semáforo: bien → HTTP 200
  moderacion  bien  Hace 0 minutos  {"msTotal":343,"decididas":0,"revisadas":0,…}
  cierre      bien  Hace 0 minutos  {"ahora":"…","cerrados":0,"diasDeRetencion":30}
  paquetes    bien  Hace 0 minutos  {"armados":0}
  avisos      bien  Hace 0 minutos  {"secos":0,"fallos":0,"enviados":0,…}
  purga       bien  Hace 0 minutos  {"borrados":0,"revisados":0,"plazosCompletados":0}
alertas: 0
```

Cada latido guarda **lo que devolvió la tarea**, así que se puede ver qué hizo la última
corrida sin abrir los registros de Vercel.
