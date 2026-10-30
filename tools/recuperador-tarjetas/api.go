package main

// Conexión con FOTOFFICE: vincular el caso con el código, informar el avance
// y subir las miniaturas.

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Cliente struct {
	Base  string
	Token string
	http  *http.Client
}

func nuevoCliente(base string) *Cliente {
	return &Cliente{Base: base, http: &http.Client{Timeout: 60 * time.Second}}
}

type RespVincular struct {
	CasoID  string `json:"casoId"`
	Token   string `json:"token"`
	Estudio string `json:"estudio"`
	Titulo  string `json:"titulo"`
}

type ArchivoAPI struct {
	Indice         int    `json:"indice"`
	Tipo           Tipo   `json:"tipo"`
	Extension      string `json:"extension"`
	Tamanio        int64  `json:"tamanio"`
	Offset         int64  `json:"offset"`
	Ancho          int    `json:"ancho,omitempty"`
	Alto           int    `json:"alto,omitempty"`
	FechaToma      string `json:"fechaToma,omitempty"`
	Camara         string `json:"camara,omitempty"`
	NombreLocal    string `json:"nombreLocal"`
	BytesMiniatura int    `json:"bytesMiniatura,omitempty"`
}

type RespArchivos struct {
	Subidas []struct {
		Indice int    `json:"indice"`
		URL    string `json:"url"`
	} `json:"subidas"`
}

type EstadoAPI struct {
	Estado        string `json:"estado"`
	Dispositivo   string `json:"dispositivo,omitempty"`
	BytesTotales  int64  `json:"bytesTotales"`
	BytesLeidos   int64  `json:"bytesLeidos"`
	Encontrados   int    `json:"encontrados"`
	SectoresMalos int64  `json:"sectoresMalos"`
	Equipo        string `json:"equipo,omitempty"`
	Version       string `json:"version,omitempty"`
	Mensaje       string `json:"mensaje,omitempty"`
}

var errCasoCerrado = errors.New("el caso ya no acepta datos")

func (c *Cliente) post(ruta string, cuerpo any, salida any) error {
	b, _ := json.Marshal(cuerpo)
	var ultimo error
	for intento := 0; intento < 4; intento++ {
		if intento > 0 {
			time.Sleep(time.Duration(intento*intento) * 2 * time.Second)
		}
		req, _ := http.NewRequest("POST", c.Base+ruta, bytes.NewReader(b))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", "FOTOFFICE-Recuperador/"+version)
		if c.Token != "" {
			req.Header.Set("Authorization", "Bearer "+c.Token)
		}
		res, err := c.http.Do(req)
		if err != nil {
			ultimo = err
			continue
		}
		data, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
		res.Body.Close()
		if res.StatusCode == 409 || res.StatusCode == 401 || res.StatusCode == 404 {
			var e struct{ Error string }
			_ = json.Unmarshal(data, &e)
			if e.Error != "" {
				return fmt.Errorf("%w: %s", errCasoCerrado, e.Error)
			}
			return errCasoCerrado
		}
		if res.StatusCode >= 500 || res.StatusCode == 429 {
			ultimo = fmt.Errorf("FOTOFFICE respondió %d", res.StatusCode)
			continue
		}
		if res.StatusCode >= 400 {
			var e struct{ Error string }
			_ = json.Unmarshal(data, &e)
			if e.Error == "" {
				e.Error = fmt.Sprintf("FOTOFFICE respondió %d", res.StatusCode)
			}
			return errors.New(e.Error)
		}
		if salida != nil {
			return json.Unmarshal(data, salida)
		}
		return nil
	}
	return ultimo
}

func (c *Cliente) Vincular(codigo, equipo string) (*RespVincular, error) {
	var r RespVincular
	err := c.post("/api/recuperacion/vincular", map[string]string{"codigo": codigo, "equipo": equipo, "version": version}, &r)
	if err != nil {
		return nil, err
	}
	c.Token = r.Token
	return &r, nil
}

func (c *Cliente) Estado(e EstadoAPI) error {
	e.Version = version
	return c.post("/api/recuperacion/estado", e, nil)
}

func (c *Cliente) Archivos(a []ArchivoAPI) (*RespArchivos, error) {
	var r RespArchivos
	err := c.post("/api/recuperacion/archivos", map[string]any{"archivos": a}, &r)
	return &r, err
}

func (c *Cliente) SubirMiniatura(url string, jpg []byte) error {
	var ultimo error
	for intento := 0; intento < 3; intento++ {
		req, _ := http.NewRequest("PUT", url, bytes.NewReader(jpg))
		req.Header.Set("Content-Type", "image/jpeg")
		res, err := c.http.Do(req)
		if err != nil {
			ultimo = err
			time.Sleep(2 * time.Second)
			continue
		}
		res.Body.Close()
		if res.StatusCode < 300 {
			return nil
		}
		ultimo = fmt.Errorf("subida respondió %d", res.StatusCode)
	}
	return ultimo
}
