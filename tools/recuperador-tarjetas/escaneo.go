package main

// Recorre la tarjeta sector por sector, sólo leyendo, y avisa cada archivo
// que encuentra. Nunca escribe en el origen.

import (
	"io"
)

const sector = 512

// Hallazgo es un archivo reconocido dentro de la tarjeta.
type Hallazgo struct {
	Indice    int
	Offset    int64
	Largo     int64
	Tipo      Tipo
	Extension string
}

// Progreso se informa periódicamente mientras se escanea.
type Progreso struct {
	Leidos        int64
	Total         int64
	Encontrados   int
	SectoresMalos int64
}

// origenSeguro envuelve el dispositivo para que toda lectura esté alineada a
// sectores (Windows lo exige con discos físicos) y para que un sector dañado
// no corte el escaneo: se reintenta de a un sector y lo ilegible vuelve en
// ceros.
type origenSeguro struct {
	r     io.ReaderAt
	total int64
	malos int64
}

func nuevoOrigen(r io.ReaderAt, total int64) *origenSeguro {
	return &origenSeguro{r: r, total: total}
}

func (o *origenSeguro) ReadAt(p []byte, off int64) (int, error) {
	if off >= o.total {
		return 0, io.EOF
	}
	if off+int64(len(p)) > o.total {
		p = p[:o.total-off]
	}
	ini := off &^ (sector - 1)
	fin := (off + int64(len(p)) + sector - 1) &^ (sector - 1)
	if fin > o.total {
		fin = (o.total + sector - 1) &^ (sector - 1)
	}
	if ini == off && fin-ini == int64(len(p)) {
		return o.leerAlineado(p, off), nil
	}
	tmp := make([]byte, fin-ini)
	o.leerAlineado(tmp, ini)
	n := copy(p, tmp[off-ini:])
	return n, nil
}

func (o *origenSeguro) leerAlineado(p []byte, off int64) int {
	n, err := o.r.ReadAt(p, off)
	if err == nil || (err == io.EOF && n == len(p)) {
		return len(p)
	}
	if n == len(p) {
		return n
	}
	// reintentar de a un sector a partir de donde falló
	for s := int64(n) &^ (sector - 1); s < int64(len(p)); s += sector {
		e := s + sector
		if e > int64(len(p)) {
			e = int64(len(p))
		}
		m, err2 := o.r.ReadAt(p[s:e], off+s)
		if err2 != nil && m < int(e-s) {
			if off+s >= o.total {
				break
			}
			for i := s + int64(m); i < e; i++ {
				p[i] = 0
			}
			o.malos++
		}
	}
	return len(p)
}

// escanear recorre [0,total) y llama a encontrado por cada archivo. Devuelve
// cuántos encontró.
func escanear(o *origenSeguro, encontrado func(Hallazgo), progreso func(Progreso)) int {
	total := o.total
	const bloque = 8 << 20
	buf := make([]byte, bloque)
	var pos int64
	var cuenta int
	var ultimoAviso int64 = -1
	var abierto *Hallazgo // video sin final declarado
	var inicioCeros int64 = -1
	emitir := func(h Hallazgo) {
		cuenta++
		h.Indice = cuenta
		encontrado(h)
	}
	cerrarAbierto := func(hasta int64) {
		if abierto == nil {
			return
		}
		abierto.Largo = min64(hasta-abierto.Offset, maxVideo)
		if abierto.Largo > 64<<10 {
			emitir(*abierto)
		}
		abierto = nil
		inicioCeros = -1
	}
	for pos < total {
		n, _ := o.ReadAt(buf, pos)
		if n <= 0 {
			break
		}
		salto := int64(0)
		for i := 0; i+16 <= n; i += sector {
			if abierto != nil {
				// un tramo largo en ceros es espacio libre: el video terminó antes
				if todoCero(buf[i:min(i+sector, n)]) {
					if inicioCeros < 0 {
						inicioCeros = pos + int64(i)
					} else if pos+int64(i)-inicioCeros >= 1<<20 {
						cerrarAbierto(inicioCeros)
					}
				} else {
					inicioCeros = -1
				}
			}
			f, ok := reconocer(buf[i:])
			if !ok {
				continue
			}
			off := pos + int64(i)
			l := largoArchivo(o, off, total, f)
			if l == largoAbierto {
				cerrarAbierto(off)
				abierto = &Hallazgo{Offset: off, Tipo: f.Tipo, Extension: f.Extension}
				continue
			}
			if l <= 0 {
				continue
			}
			cerrarAbierto(off)
			if f.Extension == "tif" {
				if info := leerTIFF(o, off, l); info != nil {
					f.Extension = info.extension
				}
			}
			emitir(Hallazgo{Offset: off, Largo: l, Tipo: f.Tipo, Extension: f.Extension})
			// seguir después del archivo encontrado
			sig := (off + l + sector - 1) &^ (sector - 1)
			if sig > pos+int64(n) {
				salto = sig
				break
			}
			i = int(sig-pos) - sector
		}
		if salto > 0 {
			pos = salto
		} else {
			pos += int64(n)
		}
		if progreso != nil && (pos-ultimoAviso >= 64<<20 || pos >= total) {
			ultimoAviso = pos
			progreso(Progreso{Leidos: min64(pos, total), Total: total, Encontrados: cuenta, SectoresMalos: o.malos})
		}
	}
	cerrarAbierto(total)
	return cuenta
}

func todoCero(b []byte) bool {
	for _, c := range b {
		if c != 0 {
			return false
		}
	}
	return true
}
