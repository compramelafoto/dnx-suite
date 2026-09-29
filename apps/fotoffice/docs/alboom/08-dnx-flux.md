# 08 — DNX FLUX: la ingesta de fotos de DNX Estudio y cómo integrarla a FOTOFFICE

**Qué es:** DNX FLUX es el programa que corre en la computadora del estudio y lleva cada evento de punta a punta: **tarjeta → disco → R2 ("DNX Nube") → Aftershoot (selección y edición automáticas) → Alboom Proof (galería del cliente) → Google Drive**. Versión `0.3.0` (`dnxflux/__init__.py`), Python 3 sin dependencias obligatorias; Playwright + keyring sólo para Alboom, pyautogui + Tesseract sólo para Aftershoot.

**Método:** lectura del repositorio `~/Desktop/PROGRAMACIONES/dnx-flux` (todo `dnxflux/`, `dnxflux/web/`, `aftershoot_pasos.json`, `README.md`, `config.example.json`, `docs/ideas/publicar-en-compramelafoto.md`) y de su historial de git (58 commits, 27/09/2026 → 29/09/2026, rama única `main`, sin cambios sin guardar). No se ejecutó el programa, no se usó internet, no se leyeron `config.json`, el Llavero, `navegador/` ni la configuración de rclone.

**Convención de citas:** `archivo · función()` (rutas relativas a `dnxflux/`). "Pantalla" = una página de Alboom que el programa maneja como una persona; Alboom Proof **no se usa por API**.

---

## 0. Resumen ejecutivo

1. DNX FLUX es **un único programa local** con ventana web en `http://127.0.0.1:8765`. El "pedido" es **una carpeta en el disco externo** con un `estado.json` oculto; no hay base de datos ni servidor.
2. La copia es **segura**: escribe a `.partial`, calcula SHA‑256 al vuelo, hace `fsync`, renombra al final y **nunca pisa** un archivo. Se reanuda leyendo una lista por tarjeta (`tarjeta-N.jsonl`).
3. "Mover" sólo borra el original **después de releer la copia y comparar su SHA‑256** con la huella tomada al copiar.
4. R2 y Drive se suben con **rclone** (`copy` + `check --one-way`); los crudos con `--immutable`. R2 los borra solos a los 180 días por una regla de Cloudflare: el programa **sólo anota la fecha**.
5. Aftershoot se maneja **mirando la pantalla** (Tesseract) y **haciendo clics** (pyautogui), con un recorrido de 27 pasos en un JSON; filtra 4 y 5 estrellas y exporta a Entregas. En Windows no está calibrado.
6. Alboom CRM y Proof se manejan con **un Chrome automatizado** (Playwright) sobre un perfil propio; el CRM sólo se usa para **leer los datos del cliente de un pedido** (nombre, email, teléfono, tipo, fecha, lugar).
7. En Proof arma: galería "Selección y Venta" con el nombre de la carpeta y un preset, cliente con **una clave igual para todos**, sube los JPG, ordena por fecha de captura, publica, copia los datos de acceso y (opcional) aprueba el email.
8. **La lista de pedidos de la ventana sale del disco, no del CRM.** No existe hoy una lista de pedidos traída de Alboom.
9. Riesgos principales: todo lo de Alboom y Aftershoot depende de **textos de pantalla**; Cloudflare obliga a iniciar sesión a mano; un único Chrome bloquea todo lo de Alboom mientras sube (hasta 6 h); la clave de clientes queda en texto plano en tres lugares.
10. Propuesta: dejar en la computadora un **agente local** (copia, huellas, Aftershoot, subidas) y llevar a FOTOFFICE **el Trabajo, el cliente, la galería, el registro de ingestas y la verificación**, con un **token de dispositivo** y **URLs firmadas a R2** (patrón ya usado en FotoRank).

---

## 1. Qué hace, fase por fase

### 1.0 Arranque y carpeta raíz

- Doble clic en `DNX FLUX.command` / `DNX FLUX.bat` → `app.py · main()`. Sin opciones abre el servidor local (`web/servidor.py · abrir()`), que busca un puerto libre desde el 8765 y abre Chrome en modo aplicación (`web/servidor.py · abrir_ventana()`). Con `--consola`, `--simular`, `--cambiar-raiz`, `--leer-pantalla` o `--probar-aftershoot` trabaja en la terminal (`app.py · argumentos()`).
- **Carpeta raíz** (normalmente en el disco externo): se elige una vez y se guarda en `config.json` (`config.py · elegir_raiz()`, `app.py · obtener_raiz()`). Antes de cada uso se comprueba que exista, sea carpeta y se pueda escribir creando un archivo temporal; **si falta, no la crea** (evita escribir en el disco equivocado cuando el externo está desconectado o cambió de letra) (`config.py · validar_raiz()`).
- `config.json` es de cada máquina y no va a git (`.gitignore`); los valores por defecto están en `config.py · VALORES_POR_DEFECTO`.

### 1.1 Detección de tarjetas

- `app.py · tarjetas_conectadas()`: en Mac recorre `/Volumes`, en Windows las letras `D:` a `Z:`, en Linux `/media` y `/mnt`. Considera tarjeta a un volumen que **tiene carpeta `DCIM`** y **mide 512 GB o menos**; nunca sugiere el volumen que contiene la carpeta raíz.
- La ventana las muestra con nombre y espacio usado (`web/servidor.py · tarjetas()`, ruta `GET /api/tarjetas`); también se puede elegir "otra carpeta…" con el selector del sistema (`config.py · elegir_carpeta_con_ventana()`, `POST /api/elegir-carpeta`).
- Se rechaza un origen que esté dentro de la carpeta del pedido (`web/trabajo.py · _preparar_pedido()`, `app.py · pedir_tarjeta()`).

### 1.2 Estructura de carpetas y nombres

`estado.py · Rutas` arma, debajo de la raíz:

```
{Año}/{Pedido} - {Cliente} - {Evento}/                 ← carpeta del pedido
    Crudos/Fotos/{Evento}/{Tarjeta}/…RAW               ← una subcarpeta por tarjeta
    Entregas/Fotos/{Evento}/…JPG                        ← exportación de Aftershoot
    log.txt                                             ← registro legible
    .dnxflux/estado.json                                ← estado para reanudar
    .dnxflux/tarjeta-1.jsonl, tarjeta-2.jsonl…          ← lista de lo copiado por tarjeta
    .dnxflux/proof.json, capturas de error…             ← datos de Proof y diagnósticos
```

- Nombre de la carpeta del pedido: `"{pedido} - {cliente} - {evento}"` (`estado.py · nombre_carpeta_pedido()`). El **número de pedido es el de Alboom CRM** (el campo del formulario dice "Alboom", `web/estatico/index.html`).
- `Tarjeta` por defecto es `Tarjeta 1`, `Tarjeta 2`…; se puede poner otro nombre (p. ej. "Cámara Nikon") y no puede repetirse dentro del pedido (`web/trabajo.py · _preparar_pedido()`).
- Todos los nombres pasan por `nombres.py · limpiar()`: quita `/ \ : * ? " < > |` y caracteres de control, junta espacios, saca espacios y puntos finales y agrega `_` a nombres reservados de Windows (`CON`, `COM1`…). Así el mismo disco exFAT sirve en Mac y en Windows.
- Aviso si una ruta supera `largo_maximo_ruta` (240) (`pasos.py · copiar_tarjeta()`; en la vista previa, `web/servidor.py · vista_previa()`).
- **Buscar un pedido existente** ignora los ceros de adelante (`"000123"` = `"123"`) y mira sólo la carpeta del año indicado (`estado.py · buscar_pedidos()`, `_clave_pedido()`).
- Una carpeta creada a mano sin `estado.json` se "adopta" deduciendo cliente y evento del nombre (`estado.py · Estado.cargar()`).

### 1.3 Copia y verificación

Orquestada por `pasos.py · copiar_tarjeta()`; primitivas en `copia.py`.

1. **Qué se busca:** extensiones RAW `CR3, CR2, NEF, ARW, RAF, DNG, ORF, RW2` y, si se activa "Copiar también los JPG de la cámara", `JPG, JPEG` (`copia.py · extensiones_a_copiar()`). Recorre todas las subcarpetas; ignora ocultos (incluidos los `._IMG…` de macOS) y carpetas de sistema como `.Trashes` o `System Volume Information` (`copia.py · buscar_archivos()`).
2. **Plan** (`copia.py · planificar()`), para cada archivo:
   - si la lista de esa tarjeta ya lo registra y el destino existe con el mismo tamaño → **"ya estaba"** (reanudación);
   - si en `Crudos` hay otro con el mismo tamaño y el mismo nombre (o con sufijo `_2`, `_3`) → calcula SHA‑256 de ambos; si coinciden → "ya estaba" (misma tarjeta) o **"duplicado"** (idéntico a otra tarjeta del pedido), y se saltea;
   - si el nombre está ocupado por un archivo distinto → se guarda como `IMG_0001_2.CR3` (`copia.py · nombre_libre()`).
3. **Controles previos:** espacio libre suficiente (`shutil.disk_usage`), rutas largas, y confirmación "¿Empiezo a copiar?" (`pasos.py · copiar_tarjeta()`).
4. **Copia de cada archivo** (`copia.py · copiar_archivo()`): lee en bloques de 8 MB, escribe a `nombre.partial`, **calcula SHA‑256 mientras copia**, hace `fsync`, compara el tamaño con el de la tarjeta, copia la fecha de modificación, verifica que no haya aparecido otro archivo con ese nombre y recién entonces renombra (`os.replace`). Un corte de luz nunca deja un RAW a medias con nombre válido.
5. **Registro por archivo** en `.dnxflux/tarjeta-N.jsonl`: `origen` (ruta relativa en la tarjeta), `destino` (nombre final), `bytes`, `sha256`, `fecha` (`copia.py · copiar_items()`). Se tolera una última línea cortada (`copia.py · leer_manifiesto()`).
6. **Verificación posterior:** cada archivo esperado existe en el disco **con el mismo tamaño** (`copia.py · verificar()`). La huella no se vuelve a leer en modo Copiar.
7. **Reintentos:** la copia **no reintenta**; ante un error se detiene con "Lo ya copiado quedó guardado; al reanudar sigue desde ahí" (`pasos.py · copiar_tarjeta()`), y la reanudación usa la lista de la tarjeta.
8. **Modo Mover (tarjeta en otro disco)** — `copia.py · borrar_originales()`: después de la verificación, para cada foto (incluidas las "duplicadas") **vuelve a leer la copia del disco, calcula su SHA‑256 y la compara con la huella tomada al copiar**; sólo si coinciden borra el original. Si no coincide o falta, no lo borra y lo informa. La ventana pide confirmación explícita antes de empezar (`web/estatico/app.js · empezar()`).
9. **Origen en el mismo disco que la raíz** (`pasos.py · mismo_disco()` compara el dispositivo):
   - con **Copiar** no se copia nada: las fotos quedan donde están ("en sitio"), se suben a R2 desde ahí y Aftershoot las importa desde ahí (`pasos.py · _usar_en_sitio()`);
   - con **Mover** se renombran al instante hacia `Crudos` (`os.rename`, sin huella) y los duplicados se borran tras comparar huellas (`copia.py · mover_en_el_mismo_disco()`, `pasos.py · _mover_en_disco()`).
10. **Resultado** guardado en la tarjeta: encontrados, copiados, ya estaban, duplicados, renombrados, movidos, bytes, fecha (`pasos.py · copiar_tarjeta()`).

### 1.4 Subida a R2 ("Bkp a DNX Nube")

- `pasos.py · subir_r2()` + `subida.py · copiar_y_verificar()`.
- **Destino:** `r2:dnx-crudos/{Año}/{Pedido - Cliente - Evento}/Crudos/Fotos/{Evento}/…` (misma estructura que el disco) (`pasos.py · carpetas_de_crudos()`). Las tarjetas "en sitio" se suben desde su carpeta original a `…/{Evento}/{Tarjeta}` con un filtro que sólo deja pasar las extensiones de foto.
- **Comando:** `rclone copy <origen> <destino> --immutable --transfers 4 --s3-no-check-bucket` + filtros; luego `rclone check <origen> <destino> --one-way` con los mismos filtros. `--immutable` hace fallar la subida si en la nube hay un archivo con el mismo nombre y otro contenido (los crudos nunca cambian). Si `check` encuentra diferencias, el paso queda en error.
- **Qué se excluye siempre:** `*.partial`, `._*`, `.DS_Store`, `Thumbs.db`, `desktop.ini` y **`*.xmp`/`*.XMP`** (las notas que Aftershoot escribe junto a los RAW y modifica mientras trabaja) (`subida.py · FILTROS`; commit `765a2a2`).
- **Progreso:** con la ventana, lee la línea de estadísticas de rclone cada segundo y la muestra como porcentaje; "Detener" corta el proceso (`subida.py · _copiar_con_progreso()`).
- **En paralelo con Aftershoot:** apenas termina la copia, R2 sube en otro hilo mientras Aftershoot trabaja; se puede apagar con `r2_en_paralelo: false` (`app.py · ejecutar()`, `_r2_en_segundo_plano()`).
- **Regla de 180 días:** la borra **Cloudflare** con una regla de ciclo de vida del bucket (`borrar-a-180-dias`, se configura a mano, `README.md`). El programa sólo guarda `expira = hoy + r2.dias_expiracion` en el estado y lo muestra en el resumen (`pasos.py · subir_r2()`, `app.py · resumen_final()`). Cada archivo vence 180 días después de **su** subida.
- **rclone:** si no está instalado ofrece instalarlo con Homebrew o winget (`subida.py · instalar_rclone()`); **no configura remotes ni pide claves**: si falta el remote `r2` o `gdrive`, se detiene con instrucciones (`pasos.py · Contexto.rclone()`).

### 1.5 Aftershoot

- `pasos.py · esperar_entregas()` → `pasos.py · manejar_aftershoot()` → `aftershoot.py · automatizar()`.
- Si ya hay JPG en Entregas, pregunta si la exportación terminó. Si "Aftershoot automático" está apagado, **sólo espera** a que la persona exporte.
- **Cómo lo maneja:** captura la pantalla, lee los textos con Tesseract en tres pasadas simultáneas (normal/invertida, sólo blancos y letras claras dentro de botones de color) y hace clic sobre el texto buscado (`aftershoot.py · leer_palabras()`, `_letras_en_botones_de_color()`, `buscar()`, `Pantalla.clic()`). Compara sin tildes ni mayúsculas y con 78 % de parecido (`SIMILITUD_MINIMA`).
- **Recorrido para Mac** (`aftershoot_pasos.json`, clave `mac`, 27 pasos; Windows vacío → "todavía no está calibrado", `aftershoot.py · cargar_pasos()`):
  1. Abrir Aftershoot; Escape; salir de asistentes abiertos ("Regresa"/"Go Back") y "Cancelar" pendientes (sólo si no está procesando).
  2. "Hogar" → **"Crear álbum"** → clic en el área "RAW JPEG TIFF" → esperar el cuadro de carpetas → **pegar la ruta de Crudos** con Cmd+Shift+G (`aftershoot.py · Automatizador._ir_a_carpeta()`) → "Import from this folder".
  3. Tipo de sesión "Algo Más" (opcional) → esperar la importación (hasta 15 min, **en segundo plano**) y elegir **"Selección y edición en un clic"** → "Próximo" (preferencias de selección y de edición) → **"Iniciar Culling"**. Usa el **perfil de edición por defecto** de Aftershoot (hoy "dnx fiesta", `README.md`).
  4. Esperar "Edición completa" hasta **4 horas**, mirando sólo la ventana de Aftershoot sin traerla al frente; ignora el texto si al lado dice "en progreso" (`aftershoot.py · Automatizador._esperar_en_segundo_plano()`, `_hay_excepcion()`). Muestra el avance que lee del cartel ("Selección en progreso · 21 % · Est. 30 min") (`aftershoot.py · avance_aftershoot()`).
  5. Cerrar el cartel de novedades; **filtrar 4 estrellas y 5 estrellas** (dos clics a una distancia fija a la izquierda del botón "More", medida en alturas de texto); **Cmd+A**; "Exportar" (antes **lee "Exportar N Fotos"** para saber cuántas esperar); "Destino" → pegar la ruta de Entregas → "Select" → **"Exportar"**.
- **Seguridad del mouse:** cuenta regresiva y notificación antes de tomar el mouse (`cuenta_regresiva` 10 s al inicio, `aviso_segundos` 30 s cuando vuelve a tomarlo); franja magenta en la ventana; llevar el mouse a la esquina superior izquierda corta (`aftershoot.py · Automatizador._tomar_control()`, `Pantalla.__init__()` con `FAILSAFE`).
- **Reintentos:** cada clic que declara qué debe aparecer después (`luego` / `luego_desaparece`) se repite hasta 3 veces, **buscando el botón de nuevo** (nunca a ciegas) (`aftershoot.py · Automatizador._ejecutar_paso()`).
- **Si algo falla:** guarda una captura en `.dnxflux/aftershoot-error-*.png`, suena la alarma, lo anota en el log y **sigue esperando la exportación manual**: un fallo de Aftershoot no detiene el pedido (`pasos.py · manejar_aftershoot()`).
- **No abre Aftershoot** si su biblioteca está en un disco desconectado (lee `~/Library/Application Support/Aftershoot/config.json`, clave `home`) (`aftershoot.py · biblioteca_aftershoot()`, `comprobar_biblioteca()`).
- **Fin de la fase:** espera a que haya **al menos N JPG** (N = lo que leyó en "Exportar N Fotos") y que nada cambie durante **120 s**, revisando cada 10 s; no cuenta archivos vacíos (`espera.py · esperar()`, `instantanea()`). Guarda cantidad y bytes (`pasos.py · esperar_entregas()`).
- Herramientas de calibración: `--leer-pantalla` guarda captura + texto leído con posiciones (`aftershoot.py · diagnosticar()`); `--probar-aftershoot --paso-a-paso --desde-paso N --hasta-paso N` (`app.py · probar_aftershoot()`).

### 1.6 Publicación en Alboom Proof

Se activa en Ajustes → "Publicar cada pedido en Alboom Proof" (`alboom.activo`). Sólo los pedidos **creados con Alboom activo** tienen la fase `proof` (`estado.py · Estado.nuevo()`), salvo que se sume después con el botón "Publicar en Proof" (`web/trabajo.py · _preparar_pedido()`, modo `proof`).

**Orden actual:** `r2 → entregas → proof → drive` ("Drive siempre último") (`estado.py · Estado.pasos_activos()`; commit `2085d9f`). *Ojo:* el `README.md` todavía dice "después de Drive"; el código manda.

**Cómo:** no hay API. `alboom.py · navegador()` abre **Google Chrome con Playwright** sobre un perfil propio (`navegador/`), invisible por defecto, 1440×900, idioma `es-AR`, tiempo máximo por acción 30 s. Los botones se buscan **por su nombre visible**. Si algo falla guarda captura + texto de la página en `.dnxflux/` (o `diagnostico/`) (`alboom.py · _guardar_diagnostico()`).

**Inicio de sesión** (`alboom.py · _abrir()`, `_iniciar_sesion()`): si ve un campo de contraseña o la URL contiene `auth.`, completa email y contraseña (la contraseña viene del Llavero del sistema, servicio `DNX FLUX · Alboom`, `alboom.py · credenciales()`), tilda "Mantenme conectado" y aprieta "Acceder" hasta 3 veces. Si aparece el desafío de **Cloudflare** ("verificar que sos humano"), no lo intenta: abre un Chrome normal con el mismo perfil para que la persona entre a mano (hasta 30 min) y luego reintenta una vez (`alboom.py · iniciar_sesion_a_mano()`, `_con_sesion()`; también `python3 -m dnxflux.sesion_proof` y el botón de Ajustes → `POST /api/alboom-sesion`).

**a) Preparar la galería** — en paralelo mientras Aftershoot trabaja (`app.py · _proof_en_segundo_plano()` → `pasos.py · preparar_proof()` → `alboom.py · crear_galeria()`):

| Paso | Pantalla / URL | Qué hace y qué campos manda |
|---|---|---|
| Exige clave de clientes | — | Falla si `alboom.clave_cliente` está vacío. |
| ¿Ya existe? | `proof_url` (`https://proof.alboompro.com`), buscador con placeholder "nombre del proyecto" | Escribe los primeros 60 caracteres del nombre; busca un enlace `/collection/{id}` cuyo texto empiece igual (25 caracteres). Si existe, **la reutiliza** (`alboom.py · _buscar_galeria()`). |
| Crear | Botón "Crear proyecto" → ventanita "Crear proyecto" | Elige la tarjeta **"Selección y Venta"**, "Continuar", escribe en "nombre de la galería" **el nombre de la carpeta del pedido** (`{Pedido} - {Cliente} - {Evento}`, máx. 160), elige el **Preset** (por defecto "Sesión de Fotos DNX") en el desplegable y aprieta "Crear galería" (`alboom.py · _crear_galeria()`, `_elegir_preset()`). |
| Dirección | URL resultante | Guarda `https://proof.alboompro.com/collection/{id}` en el estado **apenas se crea** (callback `al_crear`) para no duplicar en un reintento. |
| Cliente | `{galería}/clients` ("Clientes registrados") | Ver tabla siguiente. |

**Agregar el cliente a la galería** (`alboom.py · _agregar_cliente()`):
1. Si el nombre o el email ya figura en "Clientes registrados", no hace nada.
2. Escribe **el email** (y si no aparece, el nombre) en "Introduce el nombre o correo del cliente"; si Proof lo sugiere, toca ese renglón y confirma (`alboom.py · _elegir_sugerencia()`).
3. Si no existe: toca el **"+"** dentro del buscador (no "Importar") → ventanita **"Agregar cliente"** con **Nombre**, **Correo**, **Teléfono** (se le antepone `+54` configurable, porque el campo venía en +55) y **Contraseña = la "Clave para los clientes en Proof"** de Ajustes → "Agregar" (`alboom.py · _clic_en_mas()`).
4. Si Proof avisa "ya está vinculado" (el email ya tiene cuenta), cierra el formulario y lo elige de las sugerencias.
5. Verifica que el cliente quedó en la lista; si no, error.

**b) Subir y publicar** (`pasos.py · publicar_proof()` → `alboom.py · subir_y_publicar()`):

| Paso | Pantalla | Detalle |
|---|---|---|
| Archivos | — | Todos los `.jpg/.jpeg` no vacíos de Entregas, en orden alfabético. |
| ¿Ya subidas? | `{galería}/photos`, texto "Todas las fotos N" | Si N ≥ cantidad local, **no vuelve a subir** (`alboom.py · _fotos_en_la_galeria()`). |
| Subir | `input[type=file]` de la página | Entrega **todos los archivos de una vez** al selector y lee el progreso "X / Y fotos" cada 5 s, hasta **6 horas** (`alboom.py · _subir()`). |
| Ordenar | Botón "Ordenar" → ventanita "Ordenar fotos" | "Fecha de captura", sentido "Antiguo → Nuevo", "Confirmar" (`alboom.py · _ordenar_por_captura()`). |
| Cliente | `{galería}/clients` | Vuelve a asegurar que el cliente esté. |
| Publicar | Botón "Publicar" (o "Compartir" si ya dice "Publicado"); confirma diálogos intermedios | Espera hasta 6×3 s la ventanita "¡Felicidades!" con "Datos de acceso" / "Enlace de la galería" y guarda capturas `proof-publicar-N` (`alboom.py · _publicar()`). Error si dice "No hay clientes registrados". |
| Datos para compartir | Botón "Copiar" de la ventanita + lectura del texto e inputs | Lee del portapapeles y del texto: **enlace** (`Link: …` o `…/proof/s/…`), **correo**, **contraseña**, y el **enlace de la galería** de un campo de texto (`alboom.py · leer_datos_de_acceso()`). Error si no obtiene el enlace. |
| Email | Botón "Enviar por correo" → confirmar "Enviar" | Sólo si Ajustes → "Al publicar, aprobar el envío del email al cliente" (`alboom.enviar_email`, por defecto sí). Captura `proof-email`. |
| Guardar | `.dnxflux/proof.json` | `enlace`, `email`, `clave`, `enlace_galeria`, `texto_copiado`, `email_enviado`, `galeria`, `fotos`, `publicado_en`. El paso `proof` del estado copia casi todo (`pasos.py · publicar_proof()`). |

En la lista de pedidos, un pedido publicado muestra "Proof publicado · email enviado · {email} · clave {clave}", el enlace, **"Copiar datos para compartir"** (usa el texto copiado de Proof o arma "¡Hola {nombre}! Ya están listas tus fotos de {evento}. Galería… Usuario… Clave…") y "Abrir galería" (`web/estatico/app.js · cargarPedidos()`, `web/servidor.py · _datos_proof()`).

### 1.7 Google Drive

- `pasos.py · subir_drive()`: sube **sólo Entregas** a `gdrive:Eventos/{Año}/{Pedido - Cliente - Evento}/Entregas/Fotos/{Evento}` con `rclone copy` **sin `--immutable`** (una entrega nueva puede reemplazar una incompleta) y verifica con `rclone check --one-way`.
- Los crudos **no** van a Drive. El remote `gdrive` se configura a mano con acceso completo (`README.md`).

### 1.8 Pedidos simultáneos

- Cada pedido corre en un hilo con su propio `Trabajo` (`web/trabajo.py · TRABAJOS`, `_preparar_pedido()`, `_correr()`); la franja "En curso" los lista cada 2 s (`web/estatico/app.js · actualizarEnCurso()`).
- **Regla:** se puede empezar otro sólo cuando **todos los que corren ya pasaron Aftershoot** (o lo omitieron) (`web/trabajo.py · _iniciar()`, `Trabajo.paso_aftershoot()`); el botón "Ir al inicio (sigue trabajando)" deja el anterior subiendo a R2, Proof y Drive (commit `f06cc20`).
- No se puede correr dos veces el mismo pedido (`web/trabajo.py · _preparar_pedido()`).
- Candados: uno para la pantalla (Aftershoot, `aftershoot.py · _PANTALLA`), uno para el perfil de Chrome (**todo Alboom, de a uno**, `alboom.py · _UNO_A_LA_VEZ`), uno para crear galerías (`alboom.py · _CREANDO`), uno para escribir el estado (`estado.py · Estado._candado`).

### 1.9 Estado, reanudación y registro

- **Estado** en `.dnxflux/estado.json`, escrito de forma atómica (temporal + `fsync` + `os.replace`) (`estado.py · Estado._guardar()`). Cada paso guarda su resultado; al volver a abrir el mismo número de pedido **retoma desde lo que falta** (`estado.py · Estado.pendientes()`, `app.py · ejecutar()`).
- **Agregar una tarjeta** vuelve a poner **todos los pasos en pendiente** (guardando el resultado anterior en `anterior`): rclone sube sólo lo nuevo (`estado.py · Estado.agregar_tarjeta()`).
- **Fases elegibles:** en el formulario se tildan Tarjeta a disco / Bkp a DNX Nube / Aftershoot / Publicar en Proof / Entregas a Drive; lo no tildado queda pendiente (`web/trabajo.py · FASES`, `pasos.py · Contexto.hace()`, commit `614e278`).
- **"Volver a subir entregas"** (modo `reentregar`): pone Entregas y Drive en pendiente, apaga Aftershoot automático, opcionalmente fija cuántas fotos esperar; si Proof no estaba hecho lo deja pendiente conservando la galería (`web/trabajo.py · _preparar_pedido()`).
- **Error:** marca el paso o la tarjeta en `error` con el mensaje, espera a que R2 termine si iba en paralelo y sugiere reanudar (`app.py · ejecutar()`).
- **Registro** `log.txt` en la carpeta del pedido, con fecha y hora por línea; hasta que exista la carpeta, las líneas esperan en memoria (`registro.py · Registro`). Anota versión y sistema, fases elegidas, cantidades de cada paso, renombrados, borrados por Mover, fallos de Aftershoot/Proof, enlace de Proof y si salió el email.
- **Simular** no crea, copia ni sube nada: muestra los comandos de rclone y hace un `--dry-run` (`subida.py · copiar_y_verificar()`).

### 1.10 Sonidos y avisos

- `sonidos.py`: Mac usa sonidos del sistema (`Glass` al terminar bien cada estación, `Basso` ×3 ante error, `Ping` cuando espera una respuesta, `Hero` al terminar el pedido); Windows usa alias equivalentes. Nunca frenan el programa (hilo aparte). Se apagan en Ajustes.
- Disparadores: `consola.py · paso()` (ok/error por estación), `web/trabajo.py · Trabajo._preguntar()` (atención), `web/trabajo.py · _correr()` y `app.py · main()` (terminado), `pasos.py · manejar_aftershoot()` (error), `alboom.py · iniciar_sesion_a_mano()` (atención).
- Notificaciones de macOS con `osascript` antes de tomar el mouse o pedir login (`aftershoot.py · notificar()`).

### 1.11 La ventana web

Servidor `http.server` sólo en `127.0.0.1`; rechaza otros `Host` y exige la cabecera `X-DNX-Flux: 1` en los POST (defensa contra otras páginas del navegador) (`web/servidor.py · Manejador`). La página consulta el pedido cada 0,7 s (`web/estatico/app.js`).

| Zona | Contenido | Código |
|---|---|---|
| Barra | Logo, **lámparas** Disco (rojo si la raíz no sirve, ámbar si quedan <20 GB), Nube (rclone y remotes `r2`/`gdrive`), Aftershoot (biblioteca conectada, pyautogui/Tesseract); botón Ajustes | `web/servidor.py · sistema()`, `app.js · lampara()` |
| Franja "En curso" | Pedidos corriendo con estación y avance; clic abre su detalle | `web/trabajo.py · Trabajo.ficha()` |
| Inicio → **Nuevo pedido** | Número (Alboom), Año, Cliente, Evento; bloque "Cliente en Proof" (email, teléfono, "Volver a buscar" en el CRM); aviso si el pedido ya existe con "Continuar lo pendiente" / "Agregar esta tarjeta"; vista previa de la ruta; **Tarjeta** (detectadas, "Elegir otra carpeta…", Copiar/Mover, nombre en Crudos); **Fases a hacer**; "Simular"; **"Sólo crear carpetas"**; **"Empezar"** | `web/estatico/index.html` |
| Inicio → **Pedidos** | Lista del disco (ver 1.13) con mini‑estado por fase, "Falta: …" o "Entregado", y botones **Continuar**, **Volver a subir entregas**, **Publicar en Proof**, **Copiar datos para compartir**, **Abrir galería** | `app.js · cargarPedidos()` |
| Pedido en curso | Recorrido Tarjeta a disco → Bkp a DNX Nube → Aftershoot → Publicar en Proof → Entregas a Drive, línea "ahora", **preguntas como botones** (Sí/No, texto, "Elegir carpeta…"), franja magenta "no toques el mouse", **Detener**, **Ir al inicio (sigue trabajando)**, registro; al final resumen, "Abrir la carpeta del pedido", "Volver al inicio" | `web/trabajo.py · Trabajo.foto()`, `resumen()` |
| Ajustes | Carpeta raíz; estado de la nube; Aftershoot automático y segundos sin cambios; copiar JPG de cámara; **Alboom**: activar, aprobar email, email de la cuenta, contraseña (al Llavero), clave para clientes, preset, "Iniciar sesión en Alboom Proof"; sonidos | `web/servidor.py · guardar_ajustes()` |

Rutas: `GET /api/sistema`, `/api/pedidos`, `/api/buscar`, `/api/vista-previa`, `/api/crm`, `/api/tarjetas`, `/api/trabajos`, `/api/trabajo`; `POST /api/iniciar`, `/api/crear-carpetas`, `/api/responder`, `/api/detener`, `/api/volver`, `/api/elegir-carpeta`, `/api/ajustes`, `/api/alboom-sesion`, `/api/abrir` (`web/servidor.py · Manejador.do_GET()`, `do_POST()`).

### 1.12 "Sólo crear carpetas"

`web/trabajo.py · crear_estructura()` (commit `15c7bcd`): con número, año, cliente y evento crea en el disco `Crudos/Fotos/{Evento}`, `Entregas/Fotos/{Evento}` y `.dnxflux/` con un `estado.json` (todas las fases pendientes; con Proof si Alboom está activo; guarda los datos del cliente si hay email). Además hace `rclone mkdir` en Drive de **`gdrive:Eventos/{Año}/{Pedido…}/Crudos/Fotos/{Evento}`** y **`…/Entregas/Fotos/{Evento}`**. Si el pedido ya existía, completa las carpetas que falten. Si Drive falla, las carpetas quedan en el disco y lo informa. No copia ni sube nada.

### 1.13 Lista de pedidos y datos de Alboom CRM

**Importante:** la lista "Pedidos" de la ventana **no viene de Alboom CRM**. `web/servidor.py · pedidos_recientes()` recorre la carpeta raíz, años **pasado, actual y dos siguientes**, toma las carpetas que tienen `.dnxflux/estado.json`, las ordena por última modificación y devuelve hasta 300 (commit `97b4101`). Para cada una: número, cliente, evento, año, tarjetas, pendientes, estado por fase y datos de Proof (`_resumen_pedido()`).

Lo único que se lee del CRM es **la ficha de un pedido puntual** (`alboom.py · buscar_pedido_crm()`), cuando:
- se deja de escribir el número (≥3 caracteres, 1,2 s de pausa), si Alboom está activo y el pedido no existe en el disco (`app.js · traerCrm()`);
- se aprieta "Volver a buscar";
- se empieza un pedido con Proof sin email, o se usa "Publicar en Proof" en un pedido sin datos del cliente (`web/trabajo.py · _preparar_pedido()`).

Recorrido (`alboom.py · _buscar_pedido_crm()`): abre `{crm_url}/#/orders/index//1///` (`https://dnxfotografia.alboomcrm.com`), escribe el número en el buscador que está antes del texto "Para buscar fechas…", Enter, toma la primera fila `<tr>` que contiene el número, abre la ficha por su enlace (prefiere los que contienen `view|show|detail|ver`; si no, clic en "Ver") y espera "Detalles de Pedido" (`alboom.py · _abrir_ficha()`).

Datos leídos del texto de la ficha (`alboom.py · leer_ficha_pedido()`):

| Campo | Cómo se obtiene |
|---|---|
| `nombre` | Línea siguiente a "Cliente" |
| `tipo` | Línea siguiente a "Tipo" (o "Tipo X") — es la **categoría/tipo de evento** |
| `fecha` | Línea siguiente a "Fecha" (texto tal cual, sin convertir) |
| `lugar` | Línea siguiente a "Lugar" |
| `email` | Primer email después de "Cliente" |
| `telefono` | Primer número de 8–15 dígitos después de "Cliente" que no parezca fecha |

Se exige nombre y email. Con eso se completa Cliente, email y teléfono del formulario y se muestra "tipo · fecha · lugar" (`app.js · traerCrm()`). **No se leen** estado, emisión, total, costo, vendedor ni proyecto, aunque la grilla del CRM los tiene (columnas visibles en una captura de diagnóstico: `#`, Estado, Emisión, Nombre, Fecha del trabajo/evento, Proy, Categoría, Total, Costo, Vendedor). El evento **no** se completa desde el CRM: lo escribe la persona.

---

## 2. Modelo de datos implícito

No hay base de datos: todo son archivos dentro de la carpeta de cada pedido, más `config.json` en la carpeta del programa.

| Entidad | Dónde vive | Campos | Código |
|---|---|---|---|
| **Configuración** | `config.json` (programa) | raíz, extensiones, `r2{remote,bucket,dias_expiracion,flags_extra}`, `drive{remote,carpeta,flags_extra}`, transferencias, `r2_en_paralelo`, `espera_entregas`, `largo_maximo_ruta`, `sonidos`, `alboom{activo,crm_url,proof_url,email,preset,clave_cliente,prefijo_telefono,enviar_email,visible}`, `aftershoot{automatico,app,cuenta_regresiva,aviso_segundos,archivo_pasos}` | `config.py · VALORES_POR_DEFECTO` |
| **Credencial Alboom** | Llavero del sistema | email → contraseña | `alboom.py · guardar_credenciales()` |
| **Sesión Alboom** | `navegador/` (perfil de Chrome) | cookies | `alboom.py · PERFIL` |
| **Pedido** | `.dnxflux/estado.json` + nombre de la carpeta | `version`, `pedido` (nº Alboom), `cliente`, `evento`, `anio`, `creado`, `cliente_datos{nombre,email,telefono,tipo,fecha,lugar}` | `estado.py · Estado.nuevo()`, `web/trabajo.py · _preparar_pedido()` |
| **Tarjeta** | `estado.json → tarjetas[]` | `numero`, `nombre`, `carpeta`, `origen` (ruta), `estado` (pendiente/copiando/copiada/error), `agregada`, `modo` (copiar/mover), `en_sitio`, `error`, `resultado{encontrados,copiados,ya_estaban,duplicados,renombrados,movidos,bytes,fecha}` | `estado.py · agregar_tarjeta()`, `pasos.py · copiar_tarjeta()` |
| **Archivo + huella** | `.dnxflux/tarjeta-N.jsonl` (una línea por archivo) | `origen` (relativa en la tarjeta), `destino` (nombre final), `bytes`, `sha256` (vacío si se movió en el mismo disco), `fecha`, `movido` | `copia.py · copiar_items()`, `mover_en_el_mismo_disco()` |
| **Fase / paso** | `estado.json → pasos{r2, entregas, proof?, drive}` | `estado` (pendiente/hecho/error), `fecha`, `error`, `anterior`; r2: `destino`, `expira`, `archivos`, `bytes`, `check`; entregas: `archivos`, `bytes`, `esperadas`; drive: `destino`, `archivos`, `bytes`, `check`; proof: `galeria`, `cliente`, `fotos`, `nombre_cliente`, `clave_cliente`, `enlace`, `enlace_galeria`, `email_enviado` | `estado.py · marcar_paso()`, `pasos.py` |
| **Publicación Proof** | `.dnxflux/proof.json` | ver 1.6 | `alboom.py · _subir_y_publicar()` |
| **Registro** | `log.txt` | líneas con fecha | `registro.py` |
| **Diagnósticos** | `.dnxflux/*.png|txt`, `diagnostico/` | capturas y texto de pantallas | `alboom.py`, `aftershoot.py` |
| **Trabajo en curso** (memoria) | proceso Python | `id`, `situacion`, estaciones con detalle y fracción, líneas, pregunta, mouse, resumen | `web/trabajo.py · Trabajo` |

"Lote" no existe como concepto: la unidad es la **tarjeta** (y dentro del copiado, bloques de 8 MB). Tampoco hay identificadores globales: el pedido se reconoce por **año + número** en el nombre de la carpeta. **Las entregas no tienen huella** (sólo cantidad, tamaño y fecha durante la espera); tampoco se guarda qué RAW originó cada JPG ni las estrellas.

---

## 3. Lo que el código deja ver de Alboom Proof

| Concepto | Qué se deduce | Dónde |
|---|---|---|
| **Proyecto / galería** | En la pantalla se llama "proyecto"; se crea con "Crear proyecto" eligiendo un tipo; la URL es `/collection/{id}` (id numérico). "Mis proyectos" tiene buscador por nombre y muestra el nombre cortado. | `alboom.py · _buscar_galeria()`, `_crear_galeria()` |
| **Tipo "Selección y Venta"** | Uno de los tipos de proyecto (el doc 06 los describe como pruebas `S`); detrás del diálogo hay una pestaña con el mismo nombre. | `alboom.py · _crear_galeria()` |
| **Preset** | Plantilla de configuración elegida al crear (nombre "Sesión de Fotos DNX"); ahí viven, se supone, selección, descarga y marca de agua. **El código no toca selección, límites, descargas, marca de agua ni vencimiento: todo sale del preset.** | `alboom.py · _elegir_preset()`, `config.py` |
| **Colecciones** | Hay un "Ordenar" para colecciones y otro para fotos: la galería puede dividirse en colecciones, pero DNX FLUX sube todo a la vista "Todas las fotos". | `alboom.py · _ordenar_por_captura()` |
| **Fotos** | Subida por selector de archivos del navegador con contador "X / Y fotos"; orden por "Fecha de captura" (EXIF) "Antiguo → Nuevo". | `alboom.py · _subir()`, `_ordenar_por_captura()` |
| **Cliente de la galería** | Pantalla `/collection/{id}/clients`; buscador con sugerencias de clientes de toda la cuenta; alta con nombre, correo, teléfono y **contraseña que pone el fotógrafo**; un correo sólo puede tener una cuenta ("ya está vinculado"). | `alboom.py · _agregar_cliente()` |
| **Acceso del cliente** | Al publicar: enlace `…/proof/s/…`, correo y contraseña; botones "Copiar" y "Enviar por correo". Es acceso **con usuario y clave**, no un enlace mágico. | `alboom.py · _publicar()`, `leer_datos_de_acceso()` |
| **Estado de la galería** | Borrador → "Publicado"; una publicada ofrece "Compartir". | `alboom.py · _publicar()` |
| **Sesión del fotógrafo** | Login en un dominio `auth.`, casilla "Mantenme conectado", protección Cloudflare. | `alboom.py · _abrir()`, `_pide_verificacion_humana()` |
| **CRM** | Pedidos con número, estado, emisión, nombre, fecha del trabajo/evento, proyecto, categoría, total, costo y vendedor; ficha "Detalles de Pedido" con Cliente, Tipo, Fecha, Lugar, email y teléfono. CRM y Proof son dominios distintos con la misma cuenta. | `alboom.py · _buscar_pedido_crm()`, `leer_ficha_pedido()` |

No se deduce nada sobre descargas, marca de agua, favoritos, límites de selección ni precios: DNX FLUX no los configura.

---

## 4. Puntos débiles y riesgos

**Dependencia de pantallas**
1. **Todo Alboom depende de textos y estructura de la página** ("Crear proyecto", placeholders, "Todas las fotos N", "hover:bg" en la clase CSS de las sugerencias, "Para buscar fechas"). Cualquier cambio de Alboom rompe el recorrido; el propio código recarga `alboom.py` en cada uso para poder corregir sin reiniciar (`pasos.py · _alboom()`, commit `d73fc48`). 44 de los 58 commits mencionan Alboom, Proof o Aftershoot en el título.
2. **Aftershoot por OCR y clics**: depende del idioma, la resolución, que la ventana no esté minimizada y de posiciones relativas fijas (filtros de estrellas a −7,35 y −4,06 alturas de "More"). Windows sin calibrar (`aftershoot_pasos.json`). Si el filtro de estrellas falla silenciosamente se exportaría otra cosa; sólo se controla la cantidad que dice el botón.
3. **Conteos leídos del texto**: "Todas las fotos N" y "X / Y fotos" deciden si subir o si terminó (`alboom.py · _fotos_en_la_galeria()`, `_subir()`).

**Sesión y concurrencia**
4. **Cloudflare** exige iniciar sesión a mano en un Chrome aparte; si ocurre de noche, el pedido espera hasta 30 min y falla (`alboom.py · iniciar_sesion_a_mano()`).
5. **Un solo Chrome para todo Alboom** (`_UNO_A_LA_VEZ`): mientras un pedido sube a Proof (hasta 6 h), **cualquier búsqueda en el CRM o preparación de otra galería queda esperando**, incluida la búsqueda automática al escribir un número nuevo.
6. Subida a Proof por el navegador: **sin reanudación por archivo**; si "Todas las fotos" < total, vuelve a entregar **todos** los archivos al selector → posibles **duplicados** en la galería (típico al agregar una segunda tarjeta y reentregar).

**Datos y seguridad**
7. **Una misma clave para todos los clientes** (`alboom.clave_cliente`), guardada en texto plano en `config.json`, en cada `estado.json` y `proof.json`, y mostrada en la lista de pedidos (`pasos.py · publicar_proof()`, `app.js · cargarPedidos()`). Quien conoce la clave y el email de un cliente entra a su galería.
8. La contraseña del fotógrafo está bien guardada (Llavero), pero la **sesión de Alboom completa** vive en `navegador/` dentro de la carpeta del programa.
9. Las claves de R2 y Drive están en la configuración de rclone de cada máquina; el token de R2 está limitado al bucket (`README.md`), pero es **una cuenta de estudio**, no apta para varios fotógrafos o workspaces.

**Integridad**
10. **Las entregas no tienen huella** ni registro por archivo; Drive se sube sin `--immutable`.
11. El paso "Mover en el mismo disco" no calcula huella (confía en `rename`, que es seguro en el mismo volumen).
12. **Tarjetas "en sitio" mezcladas con copiadas**: Aftershoot importa `Crudos` salvo que **todas** estén en sitio, y en ese caso sólo la **primera** (`pasos.py · variables_aftershoot()`). Con dos carpetas en sitio, o una en sitio + una copiada, parte de las fotos no entra a Aftershoot.
13. La verificación de R2 (`rclone check`) compara lo que el remoto permite (tamaño y, si existe, MD5); en subidas multiparte de S3/R2 puede quedar sólo el tamaño. Comportamiento de rclone, no del código.
14. El vencimiento a 180 días depende de una **regla configurada a mano** en Cloudflare; el programa muestra una fecha calculada que puede no ser real si la regla cambia (`README.md`, `r2.dias_expiracion`).

**Límites y otros**
15. La espera de entregas se basa en "120 s sin cambios": un disco lento o una pausa de Aftershoot puede cortar antes; mitigado por la cantidad leída de "Exportar N Fotos".
16. Tamaños: los JPG de Aftershoot rondan **17 MB** (calidad 100) según `docs/ideas/publicar-en-compramelafoto.md`; CLF acepta 10 MB por foto. Una galería propia tiene que aceptar ese tamaño o generar versiones web.
17. "Sólo crear carpetas" crea en Drive una carpeta `Crudos` que después nunca se llena (`web/trabajo.py · crear_estructura()`).
18. "Volver a subir entregas" **no vuelve a publicar en Proof** si Proof ya estaba hecho (`web/trabajo.py · _preparar_pedido()`, modo `reentregar`).
19. Documentación desalineada: `README.md` dice que Proof va después de Drive; el código lo hace antes.
20. Detección de tarjetas: un disco externo ≤512 GB con `DCIM` se sugiere como tarjeta (`app.py · tarjetas_conectadas()`).
21. El vínculo con el CRM es **sólo el número dentro del nombre de la carpeta**; si el pedido cambia de cliente o evento en Alboom, la carpeta no se entera.

---

## 5. Propuesta de integración con FOTOFFICE

### 5.1 Principio

Lo que necesita **el disco, la tarjeta, la pantalla o Aftershoot** queda en la computadora; lo que es **del negocio** (Trabajo, Contratación, cliente, galería, acceso, historial, estado de respaldo) pasa a FOTOFFICE. DNX FLUX se transforma en el **Agente FOTOFFICE** (puede seguir siendo Python + ventana local) y deja de manejar Alboom por pantalla.

### 5.2 Reparto de responsabilidades

| Queda en la computadora (agente) | Pasa a FOTOFFICE (servidor) |
|---|---|
| Detectar tarjetas, copiar con `.partial` + SHA‑256, Mover verificado, reanudación por tarjeta | **Trabajo** y **Contratación** (reemplazan la lectura del CRM): cliente, email, teléfono, tipo, fecha, lugar, evento |
| Estructura de carpetas en el disco (misma convención; el número pasa a ser el del Trabajo/Contratación) | Registro de **Ingestas**, **Tarjetas** y **Archivos** con su huella |
| Aftershoot automático (sigue siendo local; sin cambios) | **Galería propia** (reemplaza Proof): creación, cliente, acceso, orden, publicación, email |
| Subida de crudos y entregas **directo a R2 con URL firmada** pedida al servidor | Emisión de URLs firmadas, verificación posterior (`HEAD`), derivados web / miniaturas / marca de agua |
| Espera de exportación y lectura de "Exportar N Fotos" | Estado visible en la **ficha del Trabajo** y avisos |
| Drive (opcional, mientras se use) con rclone | Vencimiento de crudos por **regla de ciclo de vida por prefijo** y fecha real por archivo |
| `log.txt` y `estado.json` locales (siguen sirviendo sin internet) | Auditoría: quién ingirió, desde qué equipo, cuándo |

### 5.3 Autenticación del agente

- **Token de dispositivo por workspace**, revocable, con alcance limitado (`ingesta:escribir`, `trabajos:leer`, `galerias:publicar`). Vinculación tipo "código en pantalla": el agente muestra un código, el fotógrafo lo confirma en FOTOFFICE → Configuración → Equipos conectados. Es el mismo patrón que el documento de ideas proponía para CLF ("tokens de acceso personal", `docs/ideas/publicar-en-compramelafoto.md`, Etapa 2).
- El token vive en el Llavero (como hoy la contraseña de Alboom, `alboom.py · guardar_credenciales()`), nunca en `config.json`.
- Sin credenciales de R2 en la máquina: el agente sólo recibe URLs firmadas de corta duración. Esto resuelve el problema de multi‑workspace del remote `r2` actual.

### 5.4 Vincular cada ingesta con un Trabajo/Contratación

1. En "Nuevo pedido", en lugar de escribir el número y raspar el CRM, el agente pide **`GET /api/agente/v1/trabajos?desde=…&hasta=…`** (misma ventana que hoy: año pasado a dos adelante, `web/servidor.py · pedidos_recientes()`) y muestra un buscador por número, cliente, fecha y tipo. Elegir uno trae cliente, email, teléfono, evento, fecha y lugar.
2. El agente guarda en `estado.json` los identificadores **`workspaceId`, `trabajoId`, `contratacionId`, `ingestaId`**. Desde ahí el vínculo ya no depende del nombre de la carpeta; si el Trabajo cambia de nombre, la carpeta sigue enlazada.
3. **Carpetas existentes**: al abrir la lista, las carpetas sin `trabajoId` se ofrecen para "Vincular con un Trabajo" (búsqueda por número, que hoy coincide con el de Alboom; conviene guardar el número de Alboom como referencia externa del Trabajo al migrar).
4. Un Trabajo puede tener **varias ingestas** (varias tarjetas, días o fotógrafos); cada tarjeta es una **Tarjeta de ingesta**.
5. "Sólo crear carpetas" pasa a ser "Preparar Trabajo en este equipo": crea la estructura local y avisa al servidor (y Drive si se mantiene).

**Modelo sugerido (servidor, todo con `workspaceId`):**

| Modelo | Campos principales |
|---|---|
| `DispositivoIngesta` | nombre del equipo, sistema, versión del agente, token (hash), último contacto, revocado |
| `Ingesta` | trabajoId, contratacionId?, dispositivoId, carpetaLocal (texto informativo), fases elegidas, estado por fase (copia, nube, seleccion, galeria, drive), fechas |
| `IngestaTarjeta` | ingestaId, nombre ("Tarjeta 1", "Cámara Nikon"), modo (copiar/mover/en_sitio), encontrados, copiados, duplicados, renombrados, bytes, borrados del origen |
| `ArchivoCrudo` | tarjetaId, rutaEnTarjeta, nombreFinal, bytes, **sha256**, fechaCaptura?, claveR2, subidoEn, **venceEn**, verificadoEn |
| `ArchivoEntrega` | ingestaId, nombre, bytes, **sha256**, estrellas?, crudoOrigen? (si se puede leer del XMP/EXIF), claveR2, galeriaFotoId |
| `Galeria` / `GaleriaFoto` / `GaleriaAcceso` | ver documento 06; el acceso por cliente reemplaza la "clave igual para todos" |

### 5.5 Subidas: crudos y entregas a R2 con URL firmada

Patrón ya probado en el monorepo: FotoRank firma un `PUT` a R2 con `@aws-sdk/s3-request-presigner` (`apps/fotorank/app/lib/fotorank/storage/r2-private-storage.ts · createUploadIntent()`) y confirma con `headObject` (`apps/fotorank/app/lib/fotorank/entries/entry-service.ts`, uso de `storage.headObject` al confirmar). Flujo propuesto:

1. **Manifiesto primero:** `POST /api/agente/v1/ingestas/{id}/archivos` con la lista `{rutaEnTarjeta, nombreFinal, bytes, sha256}` que el agente ya tiene en `tarjeta-N.jsonl`. El servidor responde **cuáles faltan** (deduplicación por `sha256` dentro del Trabajo): reemplaza a `rclone copy --immutable` y evita resubir al agregar tarjetas.
2. **Pedir URLs:** `POST …/subidas` por lotes de, por ejemplo, 50 archivos → URLs `PUT` válidas pocos minutos, con clave `ws/{workspaceId}/trabajos/{trabajoId}/crudos/{tarjeta}/{nombre}` o `…/entregas/{nombre}`. Firmar incluyendo tamaño y, si R2 lo admite en URLs firmadas, la suma SHA‑256 para que R2 rechace un archivo alterado (a verificar).
3. **Subir** desde el agente con reintentos por archivo y reanudación (hoy rclone lo hace solo); para RAW grandes, `PUT` simple alcanza (hasta 5 GB); multiparte sólo si se quisiera paralelizar un archivo.
4. **Confirmar:** `POST …/subidas/completar` → el servidor hace `HEAD` y compara tamaño (y suma si se firmó con ella), marca `verificadoEn` y calcula `venceEn`. Esto reemplaza `rclone check`.
5. **Vencimiento de crudos:** una sola regla de ciclo de vida por prefijo (p. ej. `crudos/` si se ordena la clave como `crudos/ws/…`), y la ficha muestra la fecha real por archivo. Los días pueden ser un ajuste del workspace (plan).
6. **Entregas:** el original va a un bucket privado; el servidor genera versión web, miniaturas y marca de agua (como hace CLF en `direct-upload/complete`, descrito en `docs/ideas/publicar-en-compramelafoto.md`). Hay que aceptar ~17 MB por JPG.

### 5.6 Publicar en la galería propia en lugar de Proof

- `POST /api/agente/v1/trabajos/{id}/galeria` (idempotente: si ya existe devuelve la misma) — reemplaza `alboom.py · _buscar_galeria()` + `_crear_galeria()`. La configuración (selección, descarga, marca de agua, vencimiento) sale de una **plantilla del workspace**, equivalente al preset.
- El cliente sale de la Contratación: no hay que buscarlo ni darlo de alta por pantalla (`alboom.py · _agregar_cliente()` desaparece). Acceso por **enlace personal** o código por cliente, nunca una clave común.
- Las fotos se asocian a la galería al confirmar cada entrega; el **orden por fecha de captura** se calcula en el servidor leyendo EXIF (reemplaza `_ordenar_por_captura()`).
- `POST …/galeria/publicar` con `{enviarEmail: bool}` → FOTOFFICE envía el email con Resend y devuelve el enlace y el texto para compartir por WhatsApp (reemplaza `_publicar()` y el portapapeles).
- Transición: mantener la fase `proof` como opcional y agregar una fase nueva **"Publicar en galería"**; cuando la galería propia esté probada, apagar Proof en Ajustes.

### 5.7 Respaldo y verificación visibles en la ficha del Trabajo

Sección **"Material"** en la ficha:

- **Ingestas**: equipo, fecha, quién; por tarjeta: archivos encontrados/copiados/duplicados, GB, modo (y si se borró la tarjeta, cuántos originales se borraron tras verificar).
- **Copia en el disco del estudio**: verificada con SHA‑256 (fecha), carpeta local como dato informativo.
- **DNX Nube**: `N de N archivos verificados` · GB · **vence el dd/mm/aaaa**; alerta si algún archivo no se verificó o si la ingesta quedó a medias.
- **Selección**: Aftershoot exportó N fotos (esperadas N), fecha.
- **Galería**: N fotos publicadas, enlace, email enviado sí/no, vistas y selección del cliente (del módulo de galerías).
- **Drive** (si se usa): destino y cantidad.
- **Avisos**: agente sin contacto hace X horas con una ingesta en curso; crudos que vencen pronto sin entrega publicada; diferencias entre entregas locales y publicadas.

El agente informa avance con `POST …/ingestas/{id}/eventos` (fase, porcentaje, errores) cada pocos segundos, así la ficha muestra en vivo lo mismo que hoy la franja "En curso".

### 5.8 Qué se gana y qué queda igual

- Desaparecen: raspado del CRM, Chrome automatizado, desafío de Cloudflare, candado de 6 h, clave común de clientes, duplicados por resubida, credenciales de R2 en cada máquina.
- Queda igual (y conviene no tocar): la copia segura, el Mover verificado, la reanudación, Aftershoot por pantalla (hasta que exista "DNX IA Select", `docs/ideas/publicar-en-compramelafoto.md`), los sonidos y la ventana local.
- Mejora de integridad: huella también de las **entregas** y verificación del lado del servidor.

---

## 6. Dudas abiertas

1. **¿Número de Trabajo = número de Alboom?** Para migrar sin renombrar carpetas conviene guardar el número de Alboom como referencia externa del Trabajo. ¿Se mantendrá la numeración de Alboom en FOTOFFICE o habrá una propia?
2. **¿Trabajo o Contratación como ancla?** Un Trabajo con varias Contrataciones (p. ej. fiesta + book) ¿comparte una carpeta/galería o tiene una por Contratación?
3. **Crudos en DNX Nube por workspace:** ¿cada estudio usa el bucket de DNX (costo a cargo de DNX, cobrado por plan) o su propio bucket? ¿180 días fijo o configurable?
4. **¿Se mantiene Drive** como entrega al cliente o la galería propia lo reemplaza? ¿Y la idea de compartir la carpeta de Drive por email?
5. **¿La galería recibe sólo 4 y 5 estrellas** (lo que exporta Aftershoot hoy) o también el resto para venta/selección?
6. **Tamaño**: ¿se publican los JPG de ~17 MB como original descargable, o se exporta aparte una versión más liviana?
7. **Varios equipos/fotógrafos** en un mismo Trabajo (segunda cámara en otra computadora): ¿se admite ingesta desde dos agentes a la vez?
8. **Agente en Windows**: Aftershoot no está calibrado; ¿hay equipos Windows en uso real?
9. **Seguridad de la firma**: confirmar si R2 acepta suma SHA‑256 en URLs `PUT` firmadas; si no, la verificación será por tamaño + huella calculada del lado del servidor en segundo plano.
10. **Clientes actuales de Proof**: ¿se migran galerías ya publicadas o conviven hasta que venzan?
