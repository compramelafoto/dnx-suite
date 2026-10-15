# Plantillas de servicio: conceptos calculados en la propuesta modelo

Fecha: 08/10/2026 · Rama: `feat/fotoffice-plantillas-servicio` (apilada sobre `feat/fotoffice-perfil-precios`, PR 419) · Estado: decidido por Claude con autorización general de Daniel ("seguí con lo que toca").

## 1. Para qué

Paso 2 del bot de ventas de DNX Estudio: que cada categoría de consulta (Boda, XV…) tenga una
"plantilla de servicio" con la que se arma sola la cotización. Hoy existe la **propuesta modelo
por categoría** (`FotofficePropuestaModelo`), pero sólo acepta productos del catálogo a precio de
lista, porque un precio calculado dependía del perfil privado que FOTOFFICE no guardaba. Con el
perfil del workspace (PR 419) ya se puede.

## 2. Decisiones

1. **La propuesta modelo acepta conceptos calculados** además de productos del catálogo. Un
   concepto calculado es un ítem `modoPrecio: "CALCULO"`, `productId: null`, cuyo `calculo` guarda
   SÓLO `{ entrada: { presupuesto } }` (el trabajo: tipo de trabajo, concepto, horas, costos
   directos, margen). **Nunca guarda el perfil** (la propuesta modelo no lleva datos privados).
   `precioUnitario` se guarda en 0 (se calcula al usarla).
2. **Instanciar** (`lib/presupuestos/instanciar-propuesta.ts`, puro): de los ítems de la
   propuesta + productos activos del catálogo (id → nombre, descripción, precio) + el perfil del
   workspace (o null), arma los ítems del presupuesto:
   - LISTA: como hoy `itemsAlPrecioDeHoy` (nombre, descripción y precio del catálogo hoy).
   - CALCULO: corre el motor con el perfil vigente (`calcularItemDelPanel` con el trabajo leído
     por `trabajoDesdeMotor`) y deja un ítem CALCULO completo (`calculo.entrada = { perfil,
     presupuesto }`), con id nuevo.
   - Devuelve `{ ok: true, items }` o `{ ok: false, motivo: "PRODUCTO_INACTIVO" | "SIN_PERFIL" | "CALCULO" }`.
3. **Lectura del perfil por el sistema**: `leerPerfilPreciosDelSistema(workspaceId)` en
   `lib/precios/perfil.ts` (sin ctx, sin permisos; la usan sólo el envío automático y el alta de
   presupuesto en el servidor; nunca se manda al navegador sin `veCostos`).
4. **Envío automático** (`propuesta-automatica.ts`): `itemsAlPrecioDeHoy` pasa a usar
   `instanciarPropuesta`. Si falla (producto inactivo, sin perfil o cálculo inválido) → "FALLO"
   como hoy (va la respuesta común). La vista pública ya no muestra datos internos
   (`itemSinDatosInternos`); se agrega una prueba que lo fije para ítems CALCULO.
5. **Nuevo presupuesto desde una consulta se precarga**: `crearPresupuesto`, cuando hay
   `consultaLeadId` (o `nuevaConsulta` con categoría) y la categoría tiene propuesta modelo con
   ítems, crea la V1 con los ítems instanciados, sus totales y su `costSnapshot` (vía
   `normalizarBorrador`) y las condiciones de la propuesta si tiene. Si la instanciación o la
   normalización fallan, la V1 queda vacía como hoy (nunca bloquea el alta). No depende de
   `enviarSola`.
6. **Editor de la propuesta modelo** (Configuración → Presupuestos → Propuestas → categoría):
   botón "Agregar concepto calculado" que abre los campos del trabajo (`CamposTrabajo`, el mismo
   del panel) con vista previa del precio usando el perfil del workspace (la página ya exige
   `configurar`). Sin perfil, aviso con enlace a Configuración → Precios y no deja agregar.
   Al guardar se manda el trabajo sin perfil. Se mantiene "sin texto libre".
7. **Sin cambios de base de datos.**

## 3. Fuera de alcance

- Armar el borrador solo cuando llega una consulta (sin enviarlo): paso siguiente (necesita un
  interruptor nuevo).
- Preguntas obligatorias por categoría y conversación con IA (bot).
- Rangos de horas mín./máx. de las plantillas del bot viejo.

## 4. Pruebas

- Puras: `validarItemsDeModelo` acepta CALCULO con trabajo válido y rechaza CALCULO con perfil
  adentro o sin trabajo; `instanciarPropuesta` (LISTA, CALCULO, sin perfil, producto inactivo,
  ids nuevos, precio = motor).
- Servidor: `leerPerfilPreciosDelSistema`; propuesta automática con concepto calculado (sale con
  precio del motor y la vista pública no tiene `calculo`); sin perfil → FALLO; `crearPresupuesto`
  precargado / vacío ante falla / sin propuesta.
- Componentes por reglas de fuente; typecheck; suite completa; build.
