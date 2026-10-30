package main

// Reconocimiento de formatos y cálculo del largo de cada archivo a partir de
// su propia estructura interna. No depende del sistema de archivos de la
// tarjeta: sirve igual con fotos borradas o con la tarjeta formateada.

import (
	"bytes"
	"encoding/binary"
	"io"
)

type Tipo string

const (
	TipoJPEG  Tipo = "JPEG"
	TipoRAW   Tipo = "RAW"
	TipoHEIC  Tipo = "HEIC"
	TipoVideo Tipo = "VIDEO"
)

// Firma es lo que se reconoce al principio de un sector.
type Firma struct {
	Tipo      Tipo
	Extension string
}

// largoAbierto indica un archivo cuyo final no está escrito adentro.
const largoAbierto = -1

const (
	maxJPEG  = 80 << 20  // 80 MB
	maxRAW   = 400 << 20 // 400 MB
	maxVideo = 64 << 30  // 64 GB
)

// reconocer mira los primeros bytes de un sector y dice si ahí empieza un
// archivo conocido.
func reconocer(b []byte) (Firma, bool) {
	if len(b) < 16 {
		return Firma{}, false
	}
	switch {
	case b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF && b[3] >= 0xC0:
		return Firma{TipoJPEG, "jpg"}, true
	case bytes.HasPrefix(b, []byte("FUJIFILMCCD-RAW")):
		return Firma{TipoRAW, "raf"}, true
	case bytes.HasPrefix(b, []byte("IIRO")) || bytes.HasPrefix(b, []byte("IIRS")):
		return Firma{TipoRAW, "orf"}, true
	case bytes.HasPrefix(b, []byte("IIU\x00")):
		return Firma{TipoRAW, "rw2"}, true
	case bytes.HasPrefix(b, []byte("II*\x00")):
		if string(b[8:10]) == "CR" {
			return Firma{TipoRAW, "cr2"}, true
		}
		return Firma{TipoRAW, "tif"}, true // NEF, ARW, DNG, PEF…: se afina después
	case bytes.HasPrefix(b, []byte("MM\x00*")):
		return Firma{TipoRAW, "tif"}, true
	case string(b[4:8]) == "ftyp":
		switch string(b[8:12]) {
		case "crx ":
			return Firma{TipoRAW, "cr3"}, true
		case "heic", "heix", "mif1", "msf1", "hevc":
			return Firma{TipoHEIC, "heic"}, true
		case "qt  ":
			return Firma{TipoVideo, "mov"}, true
		case "isom", "iso2", "iso4", "mp41", "mp42", "avc1", "XAVC", "MSNV", "M4V ", "3gp4", "3gp5":
			return Firma{TipoVideo, "mp4"}, true
		}
	}
	return Firma{}, false
}

// largoArchivo devuelve cuántos bytes ocupa el archivo que empieza en off,
// o 0 si la estructura no cierra (archivo dañado o falsa alarma).
func largoArchivo(r io.ReaderAt, off, limite int64, f Firma) int64 {
	disponible := limite - off
	switch {
	case f.Tipo == TipoJPEG:
		return largoJPEG(r, off, min64(disponible, maxJPEG))
	case f.Extension == "raf":
		return largoRAF(r, off, min64(disponible, maxRAW))
	case f.Extension == "cr3" || f.Tipo == TipoHEIC:
		return largoBMFF(r, off, min64(disponible, maxRAW))
	case f.Tipo == TipoVideo:
		return largoBMFF(r, off, min64(disponible, maxVideo))
	case f.Tipo == TipoRAW:
		return largoTIFF(r, off, min64(disponible, maxRAW))
	}
	return 0
}

func min64(a, b int64) int64 {
	if a < b {
		return a
	}
	return b
}

// ---------- JPEG ----------

// largoJPEG recorre los segmentos del JPEG hasta el marcador de fin (FFD9).
// Dentro de los datos comprimidos un 0xFF sólo puede ir seguido de 0x00 o de
// un marcador de reinicio, así que el primer marcador "de verdad" después de
// los datos indica si sigue otro bloque (JPEG progresivo) o si terminó.
func largoJPEG(r io.ReaderAt, off, max int64) int64 {
	br := newLector(r, off, max)
	if br.u8() != 0xFF || br.u8() != 0xD8 {
		return 0
	}
	for !br.err {
		// buscar el próximo marcador
		b := br.u8()
		if b != 0xFF {
			return 0
		}
		m := br.u8()
		for m == 0xFF { // relleno permitido
			m = br.u8()
		}
		switch {
		case m == 0xD9:
			fin := br.pos
			// Muchos celulares y cámaras guardan una segunda imagen (MPF)
			// pegada a continuación: es parte del mismo archivo.
			if a, b2, c := br.peekN(fin), br.peekN(fin+1), br.peekN(fin+2); a == 0xFF && b2 == 0xD8 && c == 0xFF {
				if extra := largoJPEG(r, off+fin, max-fin); extra > 0 {
					return fin + extra
				}
			}
			return fin
		case m == 0x01 || (m >= 0xD0 && m <= 0xD7):
			continue
		case m == 0xD8 || m == 0x00:
			return 0
		}
		l := int64(br.u16be())
		if l < 2 {
			return 0
		}
		br.skip(l - 2)
		if m == 0xDA { // datos comprimidos: avanzar hasta un marcador real
			for !br.err {
				c := br.u8()
				if c != 0xFF {
					continue
				}
				n := br.peek()
				if n == 0x00 || (n >= 0xD0 && n <= 0xD7) || n == 0xFF {
					if n != 0xFF {
						br.u8()
					}
					continue
				}
				br.pos-- // volver al 0xFF para que el bucle principal lo lea
				break
			}
		}
	}
	return 0
}

// ---------- TIFF (CR2, NEF, ARW, DNG, ORF, RW2, PEF…) ----------

type infoTIFF struct {
	fin       int64
	modelo    string
	marca     string
	fecha     string
	extension string
}

// largoTIFF calcula el final del archivo como el byte más lejano al que
// apunta cualquiera de sus directorios (IFD): tiras de imagen, mosaicos,
// vistas previas y datos de cada etiqueta.
func largoTIFF(r io.ReaderAt, off, max int64) int64 {
	info := leerTIFF(r, off, max)
	if info == nil {
		return 0
	}
	return info.fin
}

func leerTIFF(r io.ReaderAt, off, max int64) *infoTIFF {
	cab := make([]byte, 8)
	if _, err := r.ReadAt(cab, off); err != nil {
		return nil
	}
	var bo binary.ByteOrder
	switch string(cab[:2]) {
	case "II":
		bo = binary.LittleEndian
	case "MM":
		bo = binary.BigEndian
	default:
		return nil
	}
	info := &infoTIFF{fin: 8}
	primero := int64(bo.Uint32(cab[4:]))
	pendientes := []int64{primero}
	visitados := map[int64]bool{}
	tiras := map[uint16][]int64{}
	for len(pendientes) > 0 && len(visitados) < 64 {
		ifd := pendientes[0]
		pendientes = pendientes[1:]
		if ifd < 8 || ifd >= max || visitados[ifd] {
			continue
		}
		visitados[ifd] = true
		nb := make([]byte, 2)
		if _, err := r.ReadAt(nb, off+ifd); err != nil {
			continue
		}
		n := int64(bo.Uint16(nb))
		if n == 0 || n > 1000 || ifd+2+n*12+4 > max {
			continue
		}
		ent := make([]byte, n*12+4)
		if _, err := r.ReadAt(ent, off+ifd+2); err != nil {
			continue
		}
		info.fin = maxI(info.fin, ifd+2+n*12+4)
		for k := range tiras {
			delete(tiras, k)
		}
		for i := int64(0); i < n; i++ {
			e := ent[i*12 : i*12+12]
			tag := bo.Uint16(e)
			typ := bo.Uint16(e[2:])
			cnt := int64(bo.Uint32(e[4:]))
			sz := tamTipo(typ) * cnt
			if sz < 0 || cnt > 1<<24 {
				continue
			}
			var datos []byte
			if sz <= 4 {
				datos = e[8 : 8+sz]
			} else {
				p := int64(bo.Uint32(e[8:]))
				if p+sz > max {
					continue
				}
				info.fin = maxI(info.fin, p+sz)
				if sz <= 1<<20 && (tag == 273 || tag == 279 || tag == 324 || tag == 325 || tag == 330 || tag == 271 || tag == 272 || tag == 36867 || tag == 306) {
					datos = make([]byte, sz)
					if _, err := r.ReadAt(datos, off+p); err != nil {
						continue
					}
				}
			}
			if datos == nil {
				continue
			}
			valores := func() []int64 {
				out := make([]int64, 0, cnt)
				for j := int64(0); j < cnt; j++ {
					switch typ {
					case 3:
						out = append(out, int64(bo.Uint16(datos[j*2:])))
					case 4, 13:
						out = append(out, int64(bo.Uint32(datos[j*4:])))
					}
				}
				return out
			}
			switch tag {
			case 273, 279, 324, 325, 513, 514:
				tiras[tag] = valores()
			case 330, 34665: // SubIFDs y EXIF
				pendientes = append(pendientes, valores()...)
			case 271:
				info.marca = texto(datos)
			case 272:
				info.modelo = texto(datos)
			case 36867:
				info.fecha = texto(datos)
			case 306:
				if info.fecha == "" {
					info.fecha = texto(datos)
				}
			}
		}
		for _, par := range [][2]uint16{{273, 279}, {324, 325}, {513, 514}} {
			o, l := tiras[par[0]], tiras[par[1]]
			for j := 0; j < len(o) && j < len(l); j++ {
				if o[j]+l[j] <= max {
					info.fin = maxI(info.fin, o[j]+l[j])
				}
			}
		}
		sig := int64(bo.Uint32(ent[n*12:]))
		if sig != 0 {
			pendientes = append(pendientes, sig)
		}
	}
	if info.fin <= 8 || len(visitados) == 0 {
		return nil
	}
	info.extension = extensionPorMarca(info.marca, info.modelo)
	return info
}

func extensionPorMarca(marca, modelo string) string {
	m := bytes.ToLower([]byte(marca))
	switch {
	case bytes.Contains(m, []byte("nikon")):
		return "nef"
	case bytes.Contains(m, []byte("sony")):
		return "arw"
	case bytes.Contains(m, []byte("canon")):
		return "cr2"
	case bytes.Contains(m, []byte("pentax")) || bytes.Contains(m, []byte("ricoh")):
		return "pef"
	case bytes.Contains(m, []byte("olympus")) || bytes.Contains(m, []byte("om digital")):
		return "orf"
	case bytes.Contains(m, []byte("panasonic")):
		return "rw2"
	case bytes.Contains(m, []byte("leica")) || bytes.Contains(m, []byte("hasselblad")):
		return "dng"
	}
	return "dng"
}

func tamTipo(t uint16) int64 {
	switch t {
	case 1, 2, 6, 7:
		return 1
	case 3, 8:
		return 2
	case 4, 9, 11, 13:
		return 4
	case 5, 10, 12:
		return 8
	}
	return 0
}

func texto(b []byte) string {
	if i := bytes.IndexByte(b, 0); i >= 0 {
		b = b[:i]
	}
	return string(bytes.TrimSpace(b))
}

func maxI(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}

// ---------- RAF (Fujifilm) ----------

// El encabezado RAF trae dónde empieza y cuánto mide la vista previa JPEG y
// los datos del sensor.
func largoRAF(r io.ReaderAt, off, max int64) int64 {
	cab := make([]byte, 108)
	if _, err := r.ReadAt(cab, off); err != nil {
		return 0
	}
	be := binary.BigEndian
	var fin int64
	for _, p := range [][2]int{{84, 88}, {92, 96}, {100, 104}} {
		o := int64(be.Uint32(cab[p[0]:]))
		l := int64(be.Uint32(cab[p[1]:]))
		if o > 0 && l > 0 && o+l <= max {
			fin = maxI(fin, o+l)
		}
	}
	return fin
}

// ---------- ISO BMFF (CR3, HEIC, MP4, MOV) ----------

// Estos formatos son una sucesión de "cajas" que declaran su propio tamaño.
func largoBMFF(r io.ReaderAt, off, max int64) int64 {
	var pos int64
	var vioDatos bool
	h := make([]byte, 16)
	for pos < max {
		if _, err := r.ReadAt(h[:8], off+pos); err != nil {
			break
		}
		sz := int64(binary.BigEndian.Uint32(h))
		tipo := h[4:8]
		if !tipoCajaValido(tipo) {
			break
		}
		if sz == 1 {
			if _, err := r.ReadAt(h[8:16], off+pos+8); err != nil {
				break
			}
			sz = int64(binary.BigEndian.Uint64(h[8:]))
		}
		if sz < 8 || pos+sz > max {
			if sz == 0 && string(tipo) == "mdat" {
				// "sigue hasta el final": típico de un video cuya grabación
				// se cortó. El escaneo lo cierra donde empieza el próximo
				// archivo.
				return largoAbierto
			}
			break
		}
		if string(tipo) == "mdat" || string(tipo) == "moov" || string(tipo) == "meta" {
			vioDatos = true
		}
		pos += sz
	}
	if !vioDatos || pos <= 8 {
		return 0
	}
	return pos
}

func tipoCajaValido(t []byte) bool {
	for _, c := range t {
		if !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == ' ' || c == '-' || c == '_' || c == 0xA9) {
			return false
		}
	}
	return true
}

// ---------- lector secuencial con búfer ----------

type lector struct {
	r    io.ReaderAt
	base int64
	max  int64
	pos  int64
	buf  []byte
	bOff int64
	err  bool
}

func newLector(r io.ReaderAt, base, max int64) *lector {
	return &lector{r: r, base: base, max: max, bOff: -1}
}

func (l *lector) fill() bool {
	if l.pos >= l.max {
		l.err = true
		return false
	}
	if l.buf == nil {
		l.buf = make([]byte, 1<<20)
	}
	n, _ := l.r.ReadAt(l.buf, l.base+l.pos)
	if n == 0 {
		l.err = true
		return false
	}
	l.buf = l.buf[:n]
	l.bOff = l.pos
	return true
}

func (l *lector) byteAt(p int64) (byte, bool) {
	if p >= l.max {
		return 0, false
	}
	if l.bOff < 0 || p < l.bOff || p >= l.bOff+int64(len(l.buf)) {
		save := l.pos
		l.pos = p
		l.buf = l.buf[:cap(l.buf)]
		ok := l.fill()
		l.pos = save
		if !ok {
			return 0, false
		}
	}
	return l.buf[p-l.bOff], true
}

func (l *lector) u8() byte {
	b, ok := l.byteAt(l.pos)
	if !ok {
		l.err = true
		return 0
	}
	l.pos++
	return b
}

func (l *lector) peekN(p int64) byte {
	b, _ := l.byteAt(p)
	return b
}

func (l *lector) peek() byte {
	b, _ := l.byteAt(l.pos)
	return b
}

func (l *lector) u16be() uint16 {
	a := l.u8()
	b := l.u8()
	return uint16(a)<<8 | uint16(b)
}

func (l *lector) skip(n int64) {
	l.pos += n
	if l.pos > l.max {
		l.err = true
	}
}
