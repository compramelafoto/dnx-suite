# Ensayo, congelamiento y lanzamiento

*Etapa 5: 8, 9 y 10 de octubre. Plan escrito el 2026-09-15.*

Tres días con tres trabajos distintos. El error clásico es hacer los tres el mismo día.

---

## Antes del 8: lo que tiene que estar sí o sí

Nada de esto lo puede hacer el código. **Si el 7 a la noche falta algo de esta lista, el
ensayo del 8 no se puede hacer** y hay que decidir si se mueve la fecha.

| | Quién |
|---|---|
| `SUBILAFOTO_MP_CLIENT_ID`, `_CLIENT_SECRET`, `_REDIRECT_URI`, `_ACCESS_TOKEN` en Vercel | Titular |
| `DNX_FINANCIAL_CREDENTIAL_MASTER_KEY` en Vercel | Titular |
| URL de retorno declarada en la app **"DNX Suite"** de Mercado Pago | Titular |
| `RESEND_API_KEY` y el remitente configurado | Titular |
| Dominio `subilafoto.com` verificado en Resend | Titular |
| Un usuario con `globalRole = 'SUPER_ADMIN'` para ver `/panel/salud` | Titular |
| Un teléfono iPhone y uno Android a mano | Titular |
| Un televisor o proyector con navegador | Titular |

Lo legal ya está: el botón de arrepentimiento, el Libro de Quejas y los datos del
responsable están publicados, y los textos quedaron **revisados y aprobados sin cambios**
el 16 de septiembre.

---

## 8 de octubre: el ensayo

Un evento entero, de principio a fin, con plata de verdad. No un evento de prueba: **una
compra real, con una tarjeta real, aunque sea de cinco pesos**. Es la única forma de
probar el camino del dinero.

### Antes de empezar

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" https://subilafoto.com/api/diagnostico
curl -s -H "Authorization: Bearer $CRON_SECRET" https://subilafoto.com/api/salud
```

Las dos tienen que dar todo en verde. Si el semáforo dice algo distinto de `bien`, se
arregla eso antes de empezar: hacer un ensayo sobre un sistema que ya está roto no prueba
nada.

### El guion

Los pasos son los del [recorrido de aceptación](20-recorrido-de-aceptacion.md). El ensayo
es hacerlos **en orden y sin saltear**, aunque alguno parezca obvio.

1. **La venta.** Un fotógrafo conecta Mercado Pago, arma su enlace, y un cliente compra
   desde otro dispositivo y otra cuenta. Mirar que la comisión quede en la cuenta de DNX.
2. **La configuración.** Plantilla, portada, fecha. Verificar que la hora de cierre que
   muestra la pantalla sea la correcta.
3. **El QR.** Imprimirlo de verdad, en papel, en el tamaño del centro de mesa. Escanearlo
   con los dos teléfonos, con poca luz.
4. **Antes de la hora.** Escanear el QR y confirmar que no deja subir.
5. **La ventana.** Esperar a que se active sola. No forzarla a mano: lo que se prueba es
   que se active sola.
6. **La carga.** Al menos tres personas distintas, con sus propios teléfonos, subiendo
   varias fotos cada una. Incluir **una foto sacada de costado** para verificar que se
   proyecta derecha.
7. **El modo avión.** A mitad de una carga, cortar la conexión y volver a prenderla. La
   foto tiene que terminar o fallar con un mensaje, nunca quedar colgada.
8. **La pantalla.** El televisor prendido todo el rato. Dejarlo **al menos una hora**: lo
   que se busca es la fuga de memoria y el parpadeo, y eso no aparece en cinco minutos.
9. **La moderación.** Subir a propósito algo que tenga que quedar retenido. Recuperarlo
   desde el panel y verificar que quede en la auditoría.
10. **El cierre.** Dejar que cierre solo. No adelantarlo.
11. **La descarga.** Comprar el adicional y bajar el paquete. Abrir el ZIP y contar las
    fotos.
12. **Los correos.** Verificar que el del día siguiente salga, y que **firme con el
    vendedor y no con nosotros**.
13. **Los proveedores.** Mandar el enlace a alguien de verdad y que complete su ficha.

### Mientras tanto

Tener `/panel/salud` abierto en otra pantalla. Es el ensayo del panel, no sólo del sistema.

### Qué anotar

Todo lo que sorprenda, aunque no sea un error. "Tardó más de lo que esperaba", "no encontré
el botón", "no entendí el mensaje". Eso es lo que el 9 se decide si se arregla o no.

---

## 9 de octubre: congelamiento

**Un solo criterio para decidir si algo se toca:**

> ¿Esto hace que un cliente que paga no reciba lo que compró, o que una foto que no debía
> publicarse aparezca en la pantalla?

Si la respuesta es sí, se arregla. Si es no, se anota y se hace después del lanzamiento.

### Lo que sí se arregla el 9

- Algo que impide comprar, configurar, subir, proyectar o descargar.
- Una foto de riesgo alto que llegó a la pantalla.
- Plata que entra y no genera evento.
- Datos de una persona visibles para quien no corresponde.

### Lo que NO se arregla el 9

- Un texto mejorable.
- Un color, un espaciado, una tipografía.
- Una pantalla que funciona pero podría ser más linda.
- Una optimización.
- Cualquier cosa que se descubrió el 9 y no bloquea.

**El motivo no es pereza.** Un cambio el día antes del lanzamiento se despliega sin ensayo,
y el ensayo es lo que acabamos de hacer. Cada arreglo del 9 invalida una parte del 8.

### Al final del día

Un último despliegue, y después nada más hasta el 10. Correr el diagnóstico y la salud una
vez más sobre esa versión exacta, y **anotar la URL del despliegue**: es a la que se vuelve
si el 10 sale mal.

---

## 10 de octubre: lanzamiento

### A la mañana

1. Diagnóstico y salud, otra vez, sobre la versión congelada.
2. Verificar que los cinco cron corrieron esta madrugada (`/panel/salud`).
3. Tener a mano la URL del despliegue anterior, por si hay que volver.

### Durante el día

`/panel/salud` abierto. Se recarga sola cada medio minuto.

**Lo que hay que mirar, en este orden:**

1. ¿El semáforo está verde?
2. ¿Hay alertas? Cada una dice qué hacer.
3. ¿Los eventos abiertos tienen fotos subiendo?

### Si algo sale mal

El [manual de operación](17-manual-de-operacion.md) está ordenado por síntoma. Buscar lo
que te están diciendo por teléfono, no lo que creés que está roto.

Y si hay que volver atrás, el [procedimiento](18-rollback.md) está escrito. En resumen: el
código vuelve con un clic, las variables a mano, y la base y los archivos **casi nunca**.

### Lanzamiento controlado quiere decir

No anunciarlo a todo el mundo el mismo día. Los primeros eventos con gente que uno conoce y
puede llamar por teléfono. La diferencia entre un problema y un desastre es cuánta gente lo
sufre al mismo tiempo.

---

## Lo que queda para después del lanzamiento

Está anotado y no bloquea:

- El panel del profesional no tiene la estética del resto de la suite.
- Panel de administración para fusionar empresas duplicadas.
- Partes 2 y 3 de la prueba de moderación con fotos reales de eventos.
