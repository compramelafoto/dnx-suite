# Qué falta

*Al 2026-09-17, a tres semanas del lanzamiento. Reemplaza a las listas sueltas de "lo que
falta" repartidas por los otros documentos.*

## Lo que bloquea el lanzamiento

Ninguna de las tres es código.

| Qué | Por qué bloquea | Quién |
|---|---|---|
| **Parte 2 de la prueba de moderación** | Veinte fotos reales en los tres perfiles, para medir cuántas buenas retiene por error. Si el perfil SOCIAL retiene de más, la pantalla del salón queda vacía en un casamiento | Titular: hacen falta las fotos |
| **Probar el OAuth completo con Mercado Pago** | Es lo único que confirma que la URL de retorno quedó bien escrita. Una barra de más falla con un error que no dice nada | Titular |
| **Los aparatos** | iPhone con Safari, Android con Chrome, un televisor y un proyector. El escaneo del QR y el selector de fotos no se simulan | Titular |

La parte 3 —romper la credencial de AWS y confirmar que no se publica nada— **no la puedo
hacer yo**: cambiaría un secreto que después no puedo restaurar, porque Vercel no devuelve
los valores cargados.

## Lo que se puede implementar y no bloquea

En orden de lo que más se va a extrañar:

### 1. Fusionar empresas duplicadas

El detector encuentra los posibles duplicados y los anota en `notes` de la empresa. Leerlos
es a mano y fusionarlas también.

Con una empresa en la base todavía no molesta. Con doscientas, sí. **No corre apuro hasta
que haya volumen de proveedores.**

### 2. El logo del proveedor

`DnxPartnerAsset` existe en el modelo y la ficha no lo pide. La maquinaria de subir a R2 ya
está hecha para el logo del vendedor: es reusarla.

### 3. El panel del profesional no se parece al resto de la suite

Es la **deuda D1**, y está postergada a propósito: toca los mismos cinco formatos de menú
que el buscador ⌘K del menú DNX, y hacer las dos cosas por separado es pagar dos veces.

### 4. Un SVG del logo

Los PNG de la marca se generaron desde el isotipo; no hay vectorial maestro. Para un
televisor 4K y para imprenta hace falta. Es trabajo de diseño, no de código.

### 5. Los referidos

50% del fee por doce meses, como en CompraMeLaFoto. **Espera al split 1:N**, que todavía
está en homologación. La ventana arranca el día que se enciende, no en el alta.

## Lo que decidimos no hacer

| Qué | Por qué |
|---|---|
| Borrar `/api/diagnostico` | Se cerró con llave y creció: hoy es lo que dice si el token de Mercado Pago es de producción y si Resend sirve. Es el diagnóstico que más falta va a hacer el 10 a las dos de la mañana |
| Migrar SubiLaFoto a otro proveedor de correo | Resend anda, el dominio está verificado y el envío se probó de punta a punta |
| Que cada vendedor mande desde su propio Gmail | La misma discusión que en FotoOffice, con las mismas razones. Ver `docs/fotoffice/DECISION-CORREO-SALIENTE.md` |

## Cómo saber si esto sigue siendo cierto

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" https://subilafoto.com/api/salud
curl -s -H "Authorization: Bearer $CRON_SECRET" https://subilafoto.com/api/diagnostico
```

El primero dice si falta alguna variable y si los cinco cron corren. El segundo, si la base,
R2, Rekognition, Mercado Pago y Resend responden — y **a qué cuenta de Mercado Pago apunta
el token**, que es lo que no se puede ver de ninguna otra forma.
