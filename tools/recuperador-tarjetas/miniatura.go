package main

// Datos de cada foto (fecha, cámara, medidas) y miniatura chica para mostrar
// en FOTOFFICE. La foto completa nunca sale de la computadora.

import (
	"bytes"
	"encoding/binary"
	"image"
	"image/jpeg"
	"strings"
)

type Detalle struct {
	Ancho     int
	Alto      int
	FechaToma string // "2026:10:12 15:30:22" tal como lo guarda la cámara
	Camara    string
	Miniatura []byte // JPEG de hasta ladoMiniatura px, o nil
}

const ladoMiniatura = 480

// analizar saca los datos y arma la miniatura a partir del archivo completo.
func analizar(h Hallazgo, datos []byte) Detalle {
	var d Detalle
	switch {
	case h.Tipo == TipoJPEG:
		d = metadatosJPEG(datos)
		d.Miniatura, d.Ancho, d.Alto = miniaturaDeJPEG(datos)
	case h.Tipo == TipoRAW:
		if h.Extension != "raf" && h.Extension != "cr3" {
			if info := leerTIFF(bytes.NewReader(datos), 0, int64(len(datos))); info != nil {
				d.FechaToma = info.fecha
				d.Camara = camara(info.marca, info.modelo)
			}
		}
		// la vista previa más grande que la cámara guardó adentro del RAW
		if prev := mayorJPEGInterno(datos); prev != nil {
			if d.Camara == "" || d.FechaToma == "" {
				m := metadatosJPEG(prev)
				if d.Camara == "" {
					d.Camara = m.Camara
				}
				if d.FechaToma == "" {
					d.FechaToma = m.FechaToma
				}
			}
			// la medida de la vista previa no es la de la foto: no se informa
			d.Miniatura, _, _ = miniaturaDeJPEG(prev)
		}
	case h.Tipo == TipoHEIC:
		if prev := mayorJPEGInterno(datos); prev != nil {
			d.Miniatura, _, _ = miniaturaDeJPEG(prev)
		}
	}
	return d
}

func camara(marca, modelo string) string {
	if modelo == "" {
		return marca
	}
	if marca != "" && !strings.HasPrefix(strings.ToLower(modelo), strings.ToLower(strings.Fields(marca)[0])) {
		return marca + " " + modelo
	}
	return modelo
}

// metadatosJPEG lee el bloque EXIF (APP1) del JPEG.
func metadatosJPEG(b []byte) Detalle {
	var d Detalle
	p := 2
	for p+4 < len(b) && b[p] == 0xFF {
		m := b[p+1]
		l := int(binary.BigEndian.Uint16(b[p+2:]))
		if m == 0xDA || l < 2 || p+2+l > len(b) {
			break
		}
		seg := b[p+4 : p+2+l]
		if m == 0xE1 && bytes.HasPrefix(seg, []byte("Exif\x00\x00")) {
			t := seg[6:]
			if info := leerTIFF(bytes.NewReader(t), 0, int64(len(t))); info != nil {
				d.FechaToma = info.fecha
				d.Camara = camara(info.marca, info.modelo)
			}
			break
		}
		p += 2 + l
	}
	return d
}

// mayorJPEGInterno busca JPEG completos dentro de un archivo (vistas previas
// de un RAW) y devuelve el más grande.
func mayorJPEGInterno(b []byte) []byte {
	var mejor []byte
	r := bytes.NewReader(b)
	for i := 0; i+4 < len(b); {
		j := bytes.Index(b[i:], []byte{0xFF, 0xD8, 0xFF})
		if j < 0 {
			break
		}
		ini := i + j
		l := largoJPEG(r, int64(ini), int64(len(b)-ini))
		if l > 0 {
			if l > int64(len(mejor)) {
				mejor = b[ini : ini+int(l)]
			}
			i = ini + int(l)
		} else {
			i = ini + 3
		}
	}
	if len(mejor) < 4096 {
		return nil
	}
	return mejor
}

func miniaturaDeJPEG(b []byte) ([]byte, int, int) {
	cfg, err := jpeg.DecodeConfig(bytes.NewReader(b))
	if err != nil {
		return nil, 0, 0
	}
	img, err := jpeg.Decode(bytes.NewReader(b))
	if err != nil {
		// un JPEG cortado igual puede servir para la vista previa: se ve
		// la parte que sí se recuperó
		return nil, cfg.Width, cfg.Height
	}
	chica := reducir(img, ladoMiniatura)
	var out bytes.Buffer
	if err := jpeg.Encode(&out, chica, &jpeg.Options{Quality: 72}); err != nil {
		return nil, cfg.Width, cfg.Height
	}
	return out.Bytes(), cfg.Width, cfg.Height
}

// reducir promedia bloques de píxeles hasta que el lado mayor mida "lado".
func reducir(src image.Image, lado int) image.Image {
	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	if w <= lado && h <= lado {
		return src
	}
	var nw, nh int
	if w >= h {
		nw, nh = lado, h*lado/w
	} else {
		nw, nh = w*lado/h, lado
	}
	if nw < 1 {
		nw = 1
	}
	if nh < 1 {
		nh = 1
	}
	dst := image.NewRGBA(image.Rect(0, 0, nw, nh))
	// muestreo de 3x3 puntos por píxel de destino: rápido y sin serrucho
	for y := 0; y < nh; y++ {
		for x := 0; x < nw; x++ {
			var r, g, bl, n uint32
			for sy := 0; sy < 3; sy++ {
				for sx := 0; sx < 3; sx++ {
					px := b.Min.X + (x*3+sx)*w/(nw*3)
					py := b.Min.Y + (y*3+sy)*h/(nh*3)
					cr, cg, cb, _ := src.At(px, py).RGBA()
					r += cr
					g += cg
					bl += cb
					n++
				}
			}
			i := dst.PixOffset(x, y)
			dst.Pix[i] = uint8(r / n >> 8)
			dst.Pix[i+1] = uint8(g / n >> 8)
			dst.Pix[i+2] = uint8(bl / n >> 8)
			dst.Pix[i+3] = 255
		}
	}
	return dst
}
