package main

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
)

func listarDispositivos() ([]Dispositivo, error) {
	ents, err := os.ReadDir("/sys/block")
	if err != nil {
		return nil, err
	}
	var lista []Dispositivo
	for _, e := range ents {
		n := e.Name()
		if strings.HasPrefix(n, "loop") || strings.HasPrefix(n, "ram") || strings.HasPrefix(n, "zram") {
			continue
		}
		rem, _ := os.ReadFile(filepath.Join("/sys/block", n, "removable"))
		dev, _ := os.Readlink(filepath.Join("/sys/block", n))
		if strings.TrimSpace(string(rem)) != "1" && !strings.Contains(dev, "/usb") && !strings.HasPrefix(n, "mmcblk") {
			continue
		}
		s, _ := os.ReadFile(filepath.Join("/sys/block", n, "size"))
		sect, _ := strconv.ParseInt(strings.TrimSpace(string(s)), 10, 64)
		if sect == 0 {
			continue
		}
		modelo, _ := os.ReadFile(filepath.Join("/sys/block", n, "device", "model"))
		lista = append(lista, Dispositivo{Ruta: "/dev/" + n, Nombre: strings.TrimSpace(string(modelo)) + " (" + n + ")", Tamanio: sect * 512})
	}
	return lista, nil
}

func abrirDispositivo(ruta string) (*os.File, int64, error) {
	f, err := os.Open(ruta)
	if err != nil {
		return nil, 0, err
	}
	tam, err := f.Seek(0, io.SeekEnd)
	if err != nil || tam <= 0 {
		f.Close()
		return nil, 0, fmt.Errorf("no se pudo saber el tamaño de %s", ruta)
	}
	return f, tam, nil
}

func asegurarPermisos() bool {
	if os.Geteuid() == 0 {
		return false
	}
	fmt.Println("Para leer la tarjeta hace falta la contraseña de administrador.")
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

func carpetaPersonal() string {
	if u := os.Getenv("SUDO_USER"); u != "" {
		return filepath.Join("/home", u)
	}
	h, _ := os.UserHomeDir()
	return h
}

func entregar(ruta string) {
	uid, err1 := strconv.Atoi(os.Getenv("SUDO_UID"))
	gid, err2 := strconv.Atoi(os.Getenv("SUDO_GID"))
	if err1 == nil && err2 == nil {
		_ = syscall.Chown(ruta, uid, gid)
	}
}

func abrirCarpeta(ruta string) {}

func nombreEquipo() string {
	h, _ := os.Hostname()
	return "Linux · " + h
}
