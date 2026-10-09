# Los estilos de un evento

## Qué es un estilo

Cuatro colores, una tipografía y una textura. Se aplican a la puerta del invitado, a la
pantalla donde sube, al álbum y a la proyección del salón.

Siguen siendo **datos y no un motor**: elegir un estilo es guardar ese puñado de valores
en `Album.themeTokens`. No hay CSS dinámico ni hojas de estilo por evento.

## Por qué están agrupados en familias

El fotógrafo no entra al selector buscando "un violeta". Entra buscando *"algo para unos
quince"* o *"algo para un congreso"*. Trece estilos en una lista plana son trece
decisiones; en tres familias son una y después tres o cuatro.

| Familia | Para qué | Estilos |
|---|---|---|
| **Fiesta** | Quince, cumpleaños, casamientos de noche | Luces, Pista, Velitas, Globos, Neón |
| **Clásico** | Bodas, egresos, actos | Jardín de noche, Porcelana, Pizarrón, Vino |
| **Sobrio** | Empresas, congresos, lanzamientos | Señalética, Oficina, Tinta, Sin tema |

Dos de ellos —**Porcelana** y **Oficina**— son de fondo claro. Hasta el 2026-10-09 todos
eran oscuros.

## Las cuatro tipografías

Son cuatro y no una por estilo. **El invitado las descarga con datos móviles en un salón
lleno de gente**, y cada familia extra son kilobytes que paga él. Cada una hace algo que
las otras no:

| Variable | Familia | Para qué |
|---|---|---|
| `--slf-font` | Montserrat | Casi todo. La de la marca. |
| `--slf-font-serif` | Cormorant Garamond | Donde el papel importa: bodas, diplomas. |
| `--slf-font-cartel` | Bebas Neue | Condensada y en caja alta: se lee de lejos proyectada. Un solo peso. |
| `--slf-font-mano` | Caveat | Manuscrita, para cumpleaños y eventos de confianza. |

## Las texturas

Dibujos chicos que se repiten detrás de todo: estrellas, globos, confeti, lunares, trama
fina, destellos. Dan carácter sin competir con las fotos, que son las protagonistas.

**Van en SVG embebido y no en archivos.** Un PNG en el bucket sería otra descarga en el
televisor del salón y otra cosa que puede fallar a las once de la noche; esto viaja con
la página y pesa unos cientos de bytes.

El color de fondo se pinta **además** del dibujo, no en su lugar: la textura tiene partes
transparentes y sin color debajo la pantalla quedaría blanca.

### Por qué la lista es cerrada

El valor de la textura termina dentro de un atributo `style` de la página del invitado.
Si entrara texto libre, un evento con los tokens manipulados podría inyectar CSS —o una
`url()` que se lleva datos a otro servidor— en la pantalla del salón. Por eso
`texturaValida` descarta todo lo que no esté en la lista, igual que `tema.ts` hace con
los colores.

## Las tres pruebas que hay que respetar al agregar un estilo

Las tres existían antes y **las dos primeras atajaron defectos reales** al sumar los
estilos claros:

1. **Contraste** (`plantillas.test.ts`). Tres pares: texto sobre fondo ≥ 4,5; acento
   sobre fondo ≥ 3; texto sobre acento ≥ 4,5. *Porcelana* entró con un marrón que daba
   3,95 con blanco encima y hubo que oscurecerlo a `#8E5F47`.
2. **Opacidad** (`opacidades.test.ts`). Las pantallas usan `opacity` para el texto
   secundario, y eso **mezcla** el color con el fondo. *Porcelana* y *Oficina* pasaban el
   contraste pleno pero se caían al 0,62: hubo que oscurecerles el texto.
3. **Validación** (`plantillas.test.ts`). Que `resolverTema` devuelva exactamente los
   tokens declarados. Si un color estuviera mal escrito se reemplazaría en silencio y el
   estilo se vería como el de la marca sin que nadie se entere.

La prueba de cantidad ya no dice "son seis": cuenta las claves contra sí mismas. Una
prueba que fija un número sólo obliga a editarla cada vez sin verificar nada.

## Dónde está cada cosa

| Archivo | Qué |
|---|---|
| `lib/plantillas.ts` | El catálogo y las familias |
| `lib/texturas.ts` | Los dibujos y su validación |
| `lib/tema.ts` | El tipo `Tema` y la validación de tokens |
| `lib/estilo-de-tema.ts` | Convierte un `Tema` en estilo CSS, con textura |
| `app/panel/eventos/[id]/plantilla/` | El selector |

`estiloDeTema` existe porque son **cinco** los lugares que pintan el tema —la puerta, la
carga, el álbum, la proyección y la muestra del selector— y la textura hay que pintarla
igual en todos. Cinco copias de la misma expresión es cuestión de tiempo hasta que una
quede vieja.

## Lo que falta

- **Que el fotógrafo elija colores propios**, no sólo del catálogo. Hoy el estilo es una
  elección entre trece; no hay forma de meter el violeta de la marca de un cliente.
- **Una portada por evento.** Está pedido y va en otra etapa.
