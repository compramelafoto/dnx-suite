package main

import (
	"encoding/xml"
	"fmt"
	"io"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
)

// listarDispositivos pide a diskutil los discos externos físicos. Nunca
// ofrece el disco interno de la Mac.
func listarDispositivos() ([]Dispositivo, error) {
	out, err := exec.Command("diskutil", "list", "-plist", "external", "physical").Output()
	if err != nil {
		return nil, fmt.Errorf("no se pudo consultar los discos: %w", err)
	}
	raiz, err := leerPlist(out)
	if err != nil {
		return nil, err
	}
	var lista []Dispositivo
	discos, _ := raiz.(map[string]any)["WholeDisks"].([]any)
	for _, d := range discos {
		id, _ := d.(string)
		if id == "" {
			continue
		}
		info, err := exec.Command("diskutil", "info", "-plist", id).Output()
		if err != nil {
			continue
		}
		v, err := leerPlist(info)
		if err != nil {
			continue
		}
		m, _ := v.(map[string]any)
		if interno, _ := m["Internal"].(bool); interno {
			if ext, _ := m["RemovableMediaOrExternalDevice"].(bool); !ext {
				continue
			}
		}
		tam, _ := m["TotalSize"].(int64)
		if tam == 0 {
			tam, _ = m["Size"].(int64)
		}
		nombre, _ := m["MediaName"].(string)
		if vols := volumenes(id); vols != "" {
			nombre = strings.TrimSpace(nombre + " (" + vols + ")")
		}
		lista = append(lista, Dispositivo{Ruta: "/dev/r" + id, Nombre: strings.TrimSpace(nombre), Tamanio: tam})
	}
	return lista, nil
}

func volumenes(id string) string {
	out, err := exec.Command("diskutil", "list", "-plist", id).Output()
	if err != nil {
		return ""
	}
	v, err := leerPlist(out)
	if err != nil {
		return ""
	}
	var nombres []string
	todos, _ := v.(map[string]any)["AllDisksAndPartitions"].([]any)
	for _, d := range todos {
		dm, _ := d.(map[string]any)
		parts, _ := dm["Partitions"].([]any)
		for _, p := range parts {
			pm, _ := p.(map[string]any)
			if n, _ := pm["VolumeName"].(string); n != "" {
				nombres = append(nombres, n)
			}
		}
	}
	return strings.Join(nombres, ", ")
}

func abrirDispositivo(ruta string) (*os.File, int64, error) {
	f, err := os.Open(ruta) // sólo lectura
	if err != nil {
		return nil, 0, err
	}
	tam, err := f.Seek(0, io.SeekEnd)
	if err != nil || tam <= 0 {
		// los dispositivos de bloque no siempre informan su largo con Seek
		tam = 0
		id := strings.TrimPrefix(filepath.Base(ruta), "r")
		if out, err2 := exec.Command("diskutil", "info", "-plist", id).Output(); err2 == nil {
			if v, err3 := leerPlist(out); err3 == nil {
				tam, _ = v.(map[string]any)["TotalSize"].(int64)
			}
		}
	}
	if tam <= 0 {
		f.Close()
		return nil, 0, fmt.Errorf("no se pudo saber el tamaño de %s", ruta)
	}
	return f, tam, nil
}

// asegurarPermisos vuelve a lanzar el programa con sudo: leer la tarjeta en
// crudo requiere permisos de administrador. Devuelve true si ya relanzó.
func asegurarPermisos() bool {
	if os.Geteuid() == 0 {
		return false
	}
	fmt.Println("Para leer la tarjeta hace falta la contraseña de esta Mac (la que usás para iniciar sesión).")
	fmt.Println("Al escribirla no se ven los caracteres: es normal.")
	exe, _ := os.Executable()
	cmd := exec.Command("sudo", append([]string{exe}, os.Args[1:]...)...)
	cmd.Stdin, cmd.Stdout, cmd.Stderr = os.Stdin, os.Stdout, os.Stderr
	err := cmd.Run()
	if ee, ok := err.(*exec.ExitError); ok {
		os.Exit(ee.ExitCode())
	}
	os.Exit(0)
	return true
}

// carpetaPersonal es la carpeta de la persona aunque el programa corra con
// sudo. Se usa la carpeta personal y no el Escritorio porque macOS pide un
// permiso aparte para escribir en el Escritorio.
func carpetaPersonal() string {
	if u := os.Getenv("SUDO_USER"); u != "" {
		if us, err := user.Lookup(u); err == nil {
			return us.HomeDir
		}
	}
	h, _ := os.UserHomeDir()
	return h
}

// entregar deja el archivo a nombre de la persona y no de root, para que lo
// pueda abrir, mover y borrar sin pedir permisos.
func entregar(ruta string) {
	uid, err1 := strconv.Atoi(os.Getenv("SUDO_UID"))
	gid, err2 := strconv.Atoi(os.Getenv("SUDO_GID"))
	if err1 == nil && err2 == nil {
		_ = syscall.Chown(ruta, uid, gid)
	}
}

func abrirCarpeta(ruta string) {
	if u := os.Getenv("SUDO_USER"); u != "" {
		_ = exec.Command("sudo", "-u", u, "open", ruta).Run()
		return
	}
	_ = exec.Command("open", ruta).Run()
}

func nombreEquipo() string {
	h, _ := os.Hostname()
	return "Mac · " + h
}

// ---- plist mínimo (dict, array, string, integer, true, false) ----

func leerPlist(b []byte) (any, error) {
	d := xml.NewDecoder(strings.NewReader(string(b)))
	d.Strict = false
	for {
		t, err := d.Token()
		if err != nil {
			return nil, fmt.Errorf("respuesta de diskutil ilegible: %w", err)
		}
		if se, ok := t.(xml.StartElement); ok && se.Name.Local != "plist" {
			return valorPlist(d, se)
		}
	}
}

func valorPlist(d *xml.Decoder, se xml.StartElement) (any, error) {
	switch se.Name.Local {
	case "dict":
		m := map[string]any{}
		var clave string
		for {
			t, err := d.Token()
			if err != nil {
				return nil, err
			}
			switch x := t.(type) {
			case xml.StartElement:
				if x.Name.Local == "key" {
					var s string
					if err := d.DecodeElement(&s, &x); err != nil {
						return nil, err
					}
					clave = s
					continue
				}
				v, err := valorPlist(d, x)
				if err != nil {
					return nil, err
				}
				m[clave] = v
			case xml.EndElement:
				return m, nil
			}
		}
	case "array":
		var a []any
		for {
			t, err := d.Token()
			if err != nil {
				return nil, err
			}
			switch x := t.(type) {
			case xml.StartElement:
				v, err := valorPlist(d, x)
				if err != nil {
					return nil, err
				}
				a = append(a, v)
			case xml.EndElement:
				return a, nil
			}
		}
	case "true", "false":
		_ = d.Skip()
		return se.Name.Local == "true", nil
	case "integer":
		var s string
		if err := d.DecodeElement(&s, &se); err != nil {
			return nil, err
		}
		n, _ := strconv.ParseInt(strings.TrimSpace(s), 10, 64)
		return n, nil
	default:
		var s string
		if err := d.DecodeElement(&s, &se); err != nil {
			return nil, err
		}
		return s, nil
	}
}
