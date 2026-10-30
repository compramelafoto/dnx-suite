package main

import (
	"bytes"
	"encoding/binary"
	"image"
	"image/color"
	"image/jpeg"
	"math/rand"
	"testing"
)

func jpegDePrueba(t *testing.T, w, h int, progresivoFalso bool) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{uint8(x), uint8(y), uint8(x ^ y), 255})
		}
	}
	var b bytes.Buffer
	if err := jpeg.Encode(&b, img, &jpeg.Options{Quality: 90}); err != nil {
		t.Fatal(err)
	}
	out := b.Bytes()
	// agregar un bloque EXIF con fecha y cámara, y una miniatura interna
	// (otro JPEG completo adentro del APP1, como hacen las cámaras)
	mini := jpegChico(t)
	exif := tiffDePrueba(binary.LittleEndian, "Canon", "Canon EOS R6", "2026:10:12 15:30:22", nil)
	app1 := append([]byte("Exif\x00\x00"), exif...)
	app1 = append(app1, mini...)
	seg := []byte{0xFF, 0xE1, 0, 0}
	binary.BigEndian.PutUint16(seg[2:], uint16(len(app1)+2))
	seg = append(seg, app1...)
	return append(append([]byte{0xFF, 0xD8}, seg...), out[2:]...)
}

func jpegChico(t *testing.T) []byte {
	img := image.NewGray(image.Rect(0, 0, 16, 16))
	var b bytes.Buffer
	_ = jpeg.Encode(&b, img, nil)
	return b.Bytes()
}

// tiffDePrueba arma un TIFF mínimo con marca, modelo, fecha y una "tira" de
// datos de imagen al final.
func tiffDePrueba(bo binary.ByteOrder, marca, modelo, fecha string, tira []byte) []byte {
	type ent struct {
		tag, typ uint16
		datos    []byte
		val      uint32
	}
	ents := []ent{
		{271, 2, []byte(marca + "\x00"), 0},
		{272, 2, []byte(modelo + "\x00"), 0},
		{306, 2, []byte(fecha + "\x00"), 0},
	}
	if tira != nil {
		ents = append(ents, ent{273, 4, nil, 0}, ent{279, 4, nil, uint32(len(tira))})
	}
	n := len(ents)
	ifd := 8
	extra := ifd + 2 + n*12 + 4
	buf := make([]byte, extra)
	if bo == binary.LittleEndian {
		copy(buf, "II*\x00")
	} else {
		copy(buf, "MM\x00*")
	}
	bo.PutUint32(buf[4:], uint32(ifd))
	bo.PutUint16(buf[ifd:], uint16(n))
	var datos []byte
	for i, e := range ents {
		p := ifd + 2 + i*12
		bo.PutUint16(buf[p:], e.tag)
		bo.PutUint16(buf[p+2:], e.typ)
		if e.datos != nil {
			bo.PutUint32(buf[p+4:], uint32(len(e.datos)))
			bo.PutUint32(buf[p+8:], uint32(extra+len(datos)))
			datos = append(datos, e.datos...)
		} else {
			bo.PutUint32(buf[p+4:], 1)
			if e.tag == 273 {
				bo.PutUint32(buf[p+8:], 0) // se completa abajo
			} else {
				bo.PutUint32(buf[p+8:], e.val)
			}
		}
	}
	out := append(buf, datos...)
	if tira != nil {
		for i, e := range ents {
			if e.tag == 273 {
				bo.PutUint32(out[ifd+2+i*12+8:], uint32(len(out)))
			}
		}
		out = append(out, tira...)
	}
	return out
}

func mp4DePrueba(datos int) []byte {
	ftyp := []byte("\x00\x00\x00\x18ftypisom\x00\x00\x02\x00isomiso2")
	mdat := make([]byte, 8+datos)
	binary.BigEndian.PutUint32(mdat, uint32(len(mdat)))
	copy(mdat[4:], "mdat")
	moov := []byte("\x00\x00\x00\x10moov\x00\x00\x00\x08free")
	return append(append(ftyp, mdat...), moov...)
}

// TestEscanearTarjetaFormateada simula una tarjeta formateada: basura al
// azar con archivos enteros en límites de sector, que es como quedan las
// fotos cuando se borra la tabla de archivos.
func TestEscanearTarjetaFormateada(t *testing.T) {
	rnd := rand.New(rand.NewSource(1))
	disco := make([]byte, 20<<20)
	rnd.Read(disco)
	// los bytes 0xFF 0xD8 0xFF al azar no deben confundirse: sacar firmas
	// accidentales al comienzo de los sectores
	for i := 0; i < len(disco); i += sector {
		disco[i] = 0
	}

	foto := jpegDePrueba(t, 640, 480, false)
	raw := tiffDePrueba(binary.LittleEndian, "NIKON CORPORATION", "NIKON Z 6", "2026:10:13 09:00:01", append(jpegDePrueba(t, 320, 240, false), make([]byte, 300000)...))
	video := mp4DePrueba(2 << 20)
	partido := jpegDePrueba(t, 400, 300, false)

	colocar := func(off int, b []byte) { copy(disco[off:], b) }
	colocar(1<<20, foto)
	colocar(3<<20+4096, raw)
	colocar(8<<20-sector, video)              // cruza el límite de un bloque de lectura
	colocar(15<<20, partido[:len(partido)/2]) // JPEG cortado: no cierra

	var hall []Hallazgo
	o := nuevoOrigen(bytes.NewReader(disco), int64(len(disco)))
	escanear(o, func(h Hallazgo) { hall = append(hall, h) }, nil)

	if len(hall) != 3 {
		t.Fatalf("esperaba 3 archivos, encontré %d: %+v", len(hall), hall)
	}
	esperado := []struct {
		off   int64
		largo int
		ext   string
	}{{1 << 20, len(foto), "jpg"}, {3<<20 + 4096, len(raw), "nef"}, {8<<20 - sector, len(video), "mp4"}}
	for i, e := range esperado {
		h := hall[i]
		if h.Offset != e.off || h.Largo != int64(e.largo) || h.Extension != e.ext {
			t.Errorf("archivo %d: %+v, esperaba off=%d largo=%d ext=%s", i, h, e.off, e.largo, e.ext)
		}
	}

	d := analizar(hall[0], disco[hall[0].Offset:hall[0].Offset+hall[0].Largo])
	if d.Camara != "Canon EOS R6" || d.FechaToma != "2026:10:12 15:30:22" || d.Ancho != 640 || d.Alto != 480 {
		t.Errorf("datos del JPEG: %+v", d)
	}
	if len(d.Miniatura) == 0 {
		t.Error("el JPEG no generó miniatura")
	}
	r := analizar(hall[1], disco[hall[1].Offset:hall[1].Offset+hall[1].Largo])
	if r.Camara != "NIKON Z 6" || r.Ancho != 0 || len(r.Miniatura) == 0 {
		t.Errorf("datos del RAW: %+v (miniatura %d bytes)", r, len(r.Miniatura))
	}
}

func TestSectorIlegibleNoCortaElEscaneo(t *testing.T) {
	disco := make([]byte, 4<<20)
	foto := jpegDePrueba(t, 200, 200, false)
	copy(disco[2<<20:], foto)
	o := nuevoOrigen(&conFalla{r: bytes.NewReader(disco), malo: 1 << 20}, int64(len(disco)))
	n := escanear(o, func(Hallazgo) {}, nil)
	if n != 1 || o.malos != 1 {
		t.Fatalf("encontrados=%d malos=%d", n, o.malos)
	}
}

type conFalla struct {
	r    *bytes.Reader
	malo int64
}

func (c *conFalla) ReadAt(p []byte, off int64) (int, error) {
	if c.malo >= off && c.malo < off+int64(len(p)) {
		n := int(c.malo - off)
		c.r.ReadAt(p[:n], off)
		return n, errIO
	}
	return c.r.ReadAt(p, off)
}

var errIO = &falloLectura{}

type falloLectura struct{}

func (*falloLectura) Error() string { return "error de entrada/salida" }
