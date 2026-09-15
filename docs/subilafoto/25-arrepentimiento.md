# Botón de arrepentimiento y Libro de Quejas

*Implementado el 2026-09-15. **Los textos están pendientes de revisión legal.***

## Qué exige la norma

La **Resolución 424/2020** de la Secretaría de Comercio Interior obliga a toda tienda que
venda por internet en Argentina a tener:

1. Un enlace **"Botón de arrepentimiento"**, visible en la **primera pantalla de la
   portada**, que lleve **directo** al formulario. No a una página de ayuda ni a un correo.
2. Una **constancia** de la solicitud para quien la hace.
3. Un enlace visible al **Libro de Quejas Online** del Estado.

El derecho de fondo es el **artículo 34 de la Ley 24.240**: diez días corridos para
revocar, sin tener que explicar por qué y sin costo.

No lo tenía ninguna plataforma de la suite. Ahora lo tiene Subí la Foto.

## Dónde están los enlaces

| Dónde | Por qué |
|---|---|
| Cabecera de la portada | La norma pide que se vea sin bajar |
| Pie de la portada | Donde la gente los busca |
| Dentro del formulario | El Libro de Quejas, como alternativa ante el Estado |

## Dos decisiones que importan

### Nunca se rechaza por el plazo

El artículo da diez días, pero **la solicitud entra siempre**. Decidir automáticamente que
alguien se pasó —con un dato que puede no ser el correcto, escrito de memoria por una
persona que no encuentra el correo de la compra— es negarle un derecho por un problema
nuestro. El plazo lo resuelve una persona mirando el caso.

`dentroDelPlazo` existe y está probada, pero se usa para **informar**, no para filtrar. Sin
fecha de compra devuelve `true`.

### La constancia se puede dictar por teléfono

`AR-` más seis caracteres de un alfabeto sin `I`, `O`, `U`, `0` ni `1`. Alguien la va a
copiar a mano de una pantalla o dictarla, y la diferencia entre `O` y `0` se pierde en los
dos casos.

Se deriva del identificador de la solicitud, no es al azar: **un reintento da el mismo
número** en vez de generar una constancia nueva para el mismo pedido.

## Lo que falta

| Falta | Quién |
|---|---|
| Revisión legal de estos textos, de `/terminos` y de `/privacidad` | Abogado |
| Que la solicitud avise por correo a quien la hizo y al titular | Espera a que estén los correos |
| Pantalla para resolver las solicitudes | Hoy se miran en la base |
| Datos de la empresa —razón social, CUIT, domicilio— en el pie | Titular |

Ese último punto también lo pide la norma y no lo puedo completar yo: son los datos
fiscales reales de la empresa.

```sql
SELECT receipt, email, reference, status, "createdAt"
FROM "SubilafotoRetractionRequest" ORDER BY "createdAt" DESC;
```
