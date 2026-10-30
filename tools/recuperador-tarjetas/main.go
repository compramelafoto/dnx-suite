// Recuperador de tarjetas de FOTOFFICE.
//
// Lee una tarjeta de memoria (o un disco externo) sector por sector, sin
// escribir nada en ella, y rescata las fotos y videos que encuentra aunque
// hayan sido borrados o la tarjeta se haya formateado. Las fotos quedan en la
// computadora de la persona; a FOTOFFICE sólo viajan una miniatura chica y
// los datos de cada archivo, para que el estudio vea el resultado a
// distancia.
package main

import (
	"bufio"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"time"
)

var version = "1.0.0"

const servidorPorDefecto = "https://fotoffice.com"

var entrada = bufio.NewReader(os.Stdin)

func main() {
	origen := flag.String("origen", "", "archivo de imagen de disco a analizar en lugar de una tarjeta")
	servidor := flag.String("servidor", servidorPorDefecto, "dirección de FOTOFFICE")
	destino := flag.String("destino", "", "carpeta donde guardar lo recuperado")
	listar := flag.Bool("listar", false, "sólo mostrar las tarjetas conectadas")
	flag.Parse()
	if *listar {
		lista, err := listarDispositivos()
		if err != nil {
			fmt.Println(err)
			os.Exit(1)
		}
		for _, d := range lista {
			fmt.Printf("%s\t%s\t%s\n", d.Ruta, d.Nombre, humano(d.Tamanio))
		}
		return
	}
	codigo := strings.ToUpper(strings.TrimSpace(flag.Arg(0)))

	fmt.Println()
	fmt.Println("  FOTOFFICE · Recuperación de tarjetas  v" + version)
	fmt.Println("  La tarjeta sólo se lee: este programa nunca escribe ni borra nada en ella.")
	fmt.Println()

	if *origen == "" {
		asegurarPermisos()
	}

	if err := ejecutar(codigo, *origen, *servidor, *destino); err != nil {
		fmt.Println()
		fmt.Println("  No se pudo terminar: " + err.Error())
		esperarEnter()
		os.Exit(1)
	}
	esperarEnter()
}

func esperarEnter() {
	if runtime.GOOS == "windows" {
		fmt.Println()
		fmt.Print("  Presioná Enter para cerrar esta ventana.")
		_, _ = entrada.ReadString('\n')
	}
}

func preguntar(texto string) string {
	fmt.Print("  " + texto)
	s, _ := entrada.ReadString('\n')
	return strings.TrimSpace(s)
}

var formatoCodigo = regexp.MustCompile(`^[A-Z0-9]{4}-?[A-Z0-9]{4}$`)

func ejecutar(codigo, origen, servidor, destino string) error {
	cli := nuevoCliente(strings.TrimRight(servidor, "/"))
	var caso *RespVincular
	for caso == nil {
		if codigo == "" {
			codigo = strings.ToUpper(preguntar("Código del caso que te dio el estudio (Enter para seguir sin conexión): "))
		}
		if codigo == "" {
			fmt.Println("  Seguimos sin conexión: lo recuperado queda sólo en esta computadora.")
			break
		}
		if !formatoCodigo.MatchString(codigo) {
			fmt.Println("  El código tiene 8 letras y números, por ejemplo K7QM-2XPA.")
			codigo = ""
			continue
		}
		c, err := cli.Vincular(strings.ReplaceAll(codigo, "-", ""), nombreEquipo())
		if err != nil {
			if errors.Is(err, errCasoCerrado) {
				fmt.Println("  " + strings.TrimPrefix(err.Error(), errCasoCerrado.Error()+": "))
			} else {
				fmt.Println("  No se pudo conectar con FOTOFFICE (" + err.Error() + ").")
			}
			codigo = ""
			continue
		}
		caso = c
		fmt.Printf("  Conectado con %s · %s\n\n", c.Estudio, c.Titulo)
	}

	// --- elegir qué leer ---
	var disp Dispositivo
	var f *os.File
	var total int64
	var err error
	if origen != "" {
		f, err = os.Open(origen)
		if err != nil {
			return err
		}
		st, _ := f.Stat()
		total = st.Size()
		disp = Dispositivo{Ruta: origen, Nombre: filepath.Base(origen), Tamanio: total}
	} else {
		disp, err = elegirDispositivo()
		if err != nil {
			return err
		}
		f, total, err = abrirDispositivo(disp.Ruta)
		if err != nil {
			return fmt.Errorf("no se pudo abrir la tarjeta (%v)", err)
		}
	}
	defer f.Close()

	// --- carpeta de salida ---
	if destino == "" {
		nombre := "Recuperadas " + time.Now().Format("2006-01-02 15-04")
		if caso != nil {
			nombre = limpiarNombre(caso.Titulo) + " " + time.Now().Format("2006-01-02 15-04")
		}
		destino = filepath.Join(carpetaPersonal(), "FOTOFFICE Recuperadas", nombre)
	}
	if err := os.MkdirAll(destino, 0o755); err != nil {
		return fmt.Errorf("no se pudo crear la carpeta %s: %v", destino, err)
	}
	entregar(filepath.Dir(destino))
	entregar(destino)

	fmt.Printf("  Leyendo %s (%s). Puede tardar: una tarjeta de 64 GB lleva entre 10 y 30 minutos.\n", disp.Nombre, humano(total))
	fmt.Printf("  Lo recuperado se guarda en: %s\n\n", destino)

	r := &recuperacion{cli: cli, conectado: caso != nil, destino: destino, total: total, disp: disp.Nombre}
	r.avisar("ESCANEANDO", Progreso{Total: total}, "")
	inicio := time.Now()
	r.src = nuevoOrigen(f, total)
	r.iniciarTrabajadores()
	cant := escanear(r.src, r.encontrado, r.progreso)
	r.terminar()

	fmt.Printf("\r  Listo: %d de %d archivos recuperados en %s.                      \n", r.guardados, cant, time.Since(inicio).Round(time.Second))
	if r.malos > 0 {
		fmt.Printf("  Atención: %d sectores de la tarjeta no se pudieron leer (la tarjeta puede estar dañada).\n", r.malos)
	}
	mensaje := ""
	if r.errorEscritura != nil {
		mensaje = "No se pudo guardar todo en la computadora: " + r.errorEscritura.Error()
		fmt.Println("  " + mensaje)
	}
	r.avisar("TERMINADO", Progreso{Leidos: total, Total: total, Encontrados: r.guardados, SectoresMalos: r.malos}, mensaje)
	if caso != nil {
		fmt.Println("  El estudio ya puede ver el resultado en FOTOFFICE.")
	}
	abrirCarpeta(destino)
	return nil
}

func elegirDispositivo() (Dispositivo, error) {
	for {
		lista, err := listarDispositivos()
		if err != nil {
			return Dispositivo{}, err
		}
		if len(lista) == 0 {
			preguntar("No encontré ninguna tarjeta. Conectala (con el lector o la cámara por cable) y presioná Enter… ")
			continue
		}
		fmt.Println("  Tarjetas y discos externos conectados:")
		for i, d := range lista {
			fmt.Printf("    %d) %s · %s\n", i+1, d.Nombre, humano(d.Tamanio))
		}
		if len(lista) == 1 {
			if r := strings.ToLower(preguntar("¿Leo esta? (S/n): ")); r == "" || r == "s" || r == "si" || r == "sí" {
				return lista[0], nil
			}
			continue
		}
		var n int
		if _, err := fmt.Sscanf(preguntar("Número de la tarjeta a leer: "), "%d", &n); err == nil && n >= 1 && n <= len(lista) {
			return lista[n-1], nil
		}
	}
}

// ---------- recuperación en curso ----------

type tarea struct {
	h     Hallazgo
	datos []byte // nil para videos grandes, que se copian directo al disco
	ruta  string
}

type recuperacion struct {
	cli       *Cliente
	conectado bool
	destino   string
	total     int64
	disp      string

	mu             sync.Mutex
	guardados      int
	malos          int64
	ultimoEstado   time.Time
	errorEscritura error

	trabajo  chan tarea
	subidas  chan ArchivoAPI
	miniat   map[int][]byte
	wg, wgUp sync.WaitGroup
	src      *origenSeguro
}

const enMemoriaHasta = 400 << 20

func (r *recuperacion) iniciarTrabajadores() {
	n := runtime.NumCPU()
	if n > 6 {
		n = 6
	}
	r.trabajo = make(chan tarea, n)
	r.subidas = make(chan ArchivoAPI, 64)
	r.miniat = map[int][]byte{}
	for i := 0; i < n; i++ {
		r.wg.Add(1)
		go func() {
			defer r.wg.Done()
			for t := range r.trabajo {
				r.procesar(t)
			}
		}()
	}
	r.wgUp.Add(1)
	go r.subir()
}

func (r *recuperacion) terminar() {
	close(r.trabajo)
	r.wg.Wait()
	close(r.subidas)
	r.wgUp.Wait()
}

// encontrado corre en el hilo del escaneo: lee el archivo de la tarjeta y lo
// pasa a los trabajadores, que lo analizan y lo guardan en paralelo.
func (r *recuperacion) encontrado(h Hallazgo) {
	src := r.src
	if h.Largo > enMemoriaHasta {
		ruta := r.rutaArchivo(h, "")
		if err := copiarTramo(src, h.Offset, h.Largo, ruta); err != nil {
			r.fallaEscritura(err)
			return
		}
		entregar(ruta)
		r.trabajo <- tarea{h: h, ruta: ruta}
		return
	}
	datos := make([]byte, h.Largo)
	if _, err := src.ReadAt(datos, h.Offset); err != nil && err != io.EOF {
		return
	}
	r.trabajo <- tarea{h: h, datos: datos}
}

func (r *recuperacion) procesar(t tarea) {
	var d Detalle
	ruta := t.ruta
	if t.datos != nil {
		d = analizar(t.h, t.datos)
		ruta = r.rutaArchivo(t.h, d.FechaToma)
		if err := os.WriteFile(ruta, t.datos, 0o644); err != nil {
			r.fallaEscritura(err)
			return
		}
		entregar(ruta)
	}
	r.mu.Lock()
	r.guardados++
	if d.Miniatura != nil {
		r.miniat[t.h.Indice] = d.Miniatura
	}
	r.mu.Unlock()
	if r.conectado {
		r.subidas <- ArchivoAPI{
			Indice: t.h.Indice, Tipo: t.h.Tipo, Extension: t.h.Extension, Tamanio: t.h.Largo, Offset: t.h.Offset,
			Ancho: d.Ancho, Alto: d.Alto, FechaToma: d.FechaToma, Camara: d.Camara,
			NombreLocal: filepath.Base(ruta), BytesMiniatura: len(d.Miniatura),
		}
	}
}

func (r *recuperacion) fallaEscritura(err error) {
	r.mu.Lock()
	if r.errorEscritura == nil {
		r.errorEscritura = err
		fmt.Println("\n  No se pudo guardar un archivo: " + err.Error() + " (¿falta espacio en el disco?)")
	}
	r.mu.Unlock()
}

// subir manda los datos de a tandas y después cada miniatura directo al
// almacenamiento, con la dirección firmada que devuelve FOTOFFICE.
func (r *recuperacion) subir() {
	defer r.wgUp.Done()
	var tanda []ArchivoAPI
	enviar := func() {
		if len(tanda) == 0 || !r.conectado {
			tanda = tanda[:0]
			return
		}
		resp, err := r.cli.Archivos(tanda)
		if err != nil {
			if errors.Is(err, errCasoCerrado) {
				r.conectado = false
				fmt.Println("\n  El caso se cerró en FOTOFFICE; sigo recuperando sólo en esta computadora.")
			}
			tanda = tanda[:0]
			return
		}
		for _, s := range resp.Subidas {
			r.mu.Lock()
			jpg := r.miniat[s.Indice]
			delete(r.miniat, s.Indice)
			r.mu.Unlock()
			if jpg != nil {
				_ = r.cli.SubirMiniatura(s.URL, jpg)
			}
		}
		r.mu.Lock()
		for _, a := range tanda {
			delete(r.miniat, a.Indice)
		}
		r.mu.Unlock()
		tanda = tanda[:0]
	}
	tick := time.NewTicker(4 * time.Second)
	defer tick.Stop()
	for {
		select {
		case a, ok := <-r.subidas:
			if !ok {
				enviar()
				return
			}
			tanda = append(tanda, a)
			if len(tanda) >= 25 {
				enviar()
			}
		case <-tick.C:
			enviar()
		}
	}
}

func (r *recuperacion) progreso(p Progreso) {
	r.mu.Lock()
	r.malos = p.SectoresMalos
	guardados := r.guardados
	r.mu.Unlock()
	pct := float64(p.Leidos) * 100 / float64(max(p.Total, 1))
	fmt.Printf("\r  %5.1f %% · %s de %s · %d archivos encontrados   ", pct, humano(p.Leidos), humano(p.Total), p.Encontrados)
	if time.Since(r.ultimoEstado) > 5*time.Second && p.Leidos < p.Total {
		r.ultimoEstado = time.Now()
		p.Encontrados = guardados
		go r.avisar("ESCANEANDO", p, "")
	}
}

func (r *recuperacion) avisar(estado string, p Progreso, mensaje string) {
	if !r.conectado {
		return
	}
	_ = r.cli.Estado(EstadoAPI{
		Estado: estado, Dispositivo: r.disp, BytesTotales: p.Total, BytesLeidos: p.Leidos,
		Encontrados: p.Encontrados, SectoresMalos: p.SectoresMalos, Equipo: nombreEquipo(), Mensaje: mensaje,
	})
}

var carpetasPorTipo = map[Tipo]string{TipoJPEG: "Fotos JPG", TipoRAW: "Fotos RAW", TipoHEIC: "Fotos HEIC", TipoVideo: "Videos"}

func (r *recuperacion) rutaArchivo(h Hallazgo, fecha string) string {
	dir := filepath.Join(r.destino, carpetasPorTipo[h.Tipo])
	if _, err := os.Stat(dir); err != nil {
		_ = os.MkdirAll(dir, 0o755)
		entregar(dir)
	}
	nombre := fmt.Sprintf("%05d", h.Indice)
	if f := fechaArchivo(fecha); f != "" {
		nombre = f + "_" + nombre
	}
	return filepath.Join(dir, nombre+"."+h.Extension)
}

// "2026:10:12 15:30:22" → "2026-10-12_15-30-22"
func fechaArchivo(f string) string {
	if len(f) < 19 || f[4] != ':' || f[0] == '0' {
		return ""
	}
	return strings.NewReplacer(":", "-", " ", "_").Replace(f[:19])
}

func copiarTramo(src io.ReaderAt, off, largo int64, ruta string) error {
	out, err := os.Create(ruta)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, io.NewSectionReader(src, off, largo)); err != nil {
		out.Close()
		return err
	}
	return out.Close()
}

func limpiarNombre(s string) string {
	s = strings.Map(func(c rune) rune {
		if strings.ContainsRune(`/\:*?"<>|`, c) || c < 32 {
			return '-'
		}
		return c
	}, s)
	s = strings.TrimSpace(s)
	if len([]rune(s)) > 60 {
		s = string([]rune(s)[:60])
	}
	if s == "" {
		s = "Recuperadas"
	}
	return s
}

func humano(b int64) string {
	switch {
	case b >= 1<<30:
		return fmt.Sprintf("%.1f GB", float64(b)/(1<<30))
	case b >= 1<<20:
		return fmt.Sprintf("%.0f MB", float64(b)/(1<<20))
	default:
		return fmt.Sprintf("%d KB", b>>10)
	}
}
