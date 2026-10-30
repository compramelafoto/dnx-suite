package main

import (
	"encoding/binary"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"syscall"
	"unsafe"
)

const (
	ioctlDiskGetLengthInfo    = 0x7405C
	ioctlStorageQueryProperty = 0x2D1400
	busUSB, busSD, busMMC     = 7, 0xC, 0xD
)

// listarDispositivos prueba \\.\PhysicalDrive0..31 y se queda con los que
// están conectados por USB o por lector de tarjetas. El disco del sistema
// nunca aparece.
func listarDispositivos() ([]Dispositivo, error) {
	var lista []Dispositivo
	for i := 0; i < 32; i++ {
		ruta := fmt.Sprintf(`\\.\PhysicalDrive%d`, i)
		h, err := abrirCrudo(ruta)
		if err != nil {
			continue
		}
		bus, removible, nombre := propiedades(h)
		tam := largoDisco(h)
		syscall.CloseHandle(h)
		if tam <= 0 {
			continue
		}
		if bus != busUSB && bus != busSD && bus != busMMC && !removible {
			continue
		}
		if nombre == "" {
			nombre = fmt.Sprintf("Disco %d", i)
		}
		lista = append(lista, Dispositivo{Ruta: ruta, Nombre: nombre, Tamanio: tam})
	}
	return lista, nil
}

func abrirCrudo(ruta string) (syscall.Handle, error) {
	p, _ := syscall.UTF16PtrFromString(ruta)
	return syscall.CreateFile(p, syscall.GENERIC_READ, syscall.FILE_SHARE_READ|syscall.FILE_SHARE_WRITE, nil, syscall.OPEN_EXISTING, 0, 0)
}

func largoDisco(h syscall.Handle) int64 {
	var out [8]byte
	var n uint32
	if err := syscall.DeviceIoControl(h, ioctlDiskGetLengthInfo, nil, 0, &out[0], 8, &n, nil); err != nil {
		return 0
	}
	return int64(binary.LittleEndian.Uint64(out[:]))
}

func propiedades(h syscall.Handle) (bus uint32, removible bool, nombre string) {
	var q [12]byte // PropertyId=StorageDeviceProperty(0), QueryType=PropertyStandardQuery(0)
	out := make([]byte, 1024)
	var n uint32
	if err := syscall.DeviceIoControl(h, ioctlStorageQueryProperty, &q[0], uint32(len(q)), &out[0], uint32(len(out)), &n, nil); err != nil || n < 32 {
		return 0, false, ""
	}
	removible = out[10] != 0
	bus = binary.LittleEndian.Uint32(out[28:])
	leer := func(off uint32) string {
		if off == 0 || int(off) >= int(n) {
			return ""
		}
		b := out[off:n]
		if i := strings.IndexByte(string(b), 0); i >= 0 {
			b = b[:i]
		}
		return strings.TrimSpace(string(b))
	}
	nombre = strings.TrimSpace(leer(binary.LittleEndian.Uint32(out[12:])) + " " + leer(binary.LittleEndian.Uint32(out[16:])))
	return
}

func abrirDispositivo(ruta string) (*os.File, int64, error) {
	h, err := abrirCrudo(ruta)
	if err != nil {
		return nil, 0, err
	}
	tam := largoDisco(h)
	if tam <= 0 {
		syscall.CloseHandle(h)
		return nil, 0, fmt.Errorf("no se pudo saber el tamaño de %s", ruta)
	}
	return os.NewFile(uintptr(h), ruta), tam, nil
}

// asegurarPermisos relanza el programa como administrador (aparece el aviso
// de Windows pidiendo permiso). Devuelve true si relanzó.
func asegurarPermisos() bool {
	if esAdministrador() {
		return false
	}
	exe, _ := os.Executable()
	args := strings.Join(os.Args[1:], " ")
	verbo, _ := syscall.UTF16PtrFromString("runas")
	ex, _ := syscall.UTF16PtrFromString(exe)
	ar, _ := syscall.UTF16PtrFromString(args)
	shell := syscall.NewLazyDLL("shell32.dll").NewProc("ShellExecuteW")
	r, _, _ := shell.Call(0, uintptr(unsafe.Pointer(verbo)), uintptr(unsafe.Pointer(ex)), uintptr(unsafe.Pointer(ar)), 0, 1)
	if r <= 32 {
		fmt.Println("Hace falta aceptar el permiso de administrador para poder leer la tarjeta.")
		esperarEnter()
		os.Exit(1)
	}
	os.Exit(0)
	return true
}

func esAdministrador() bool {
	h, err := abrirCrudo(`\\.\PhysicalDrive0`)
	if err != nil {
		return false
	}
	syscall.CloseHandle(h)
	return true
}

func carpetaPersonal() string {
	h, _ := os.UserHomeDir()
	if d := h + `\Desktop`; existe(d) {
		return d
	}
	return h
}

func existe(p string) bool { _, err := os.Stat(p); return err == nil }

func entregar(ruta string) {}

func abrirCarpeta(ruta string) { _ = exec.Command("explorer", ruta).Start() }

func nombreEquipo() string {
	h, _ := os.Hostname()
	return "Windows · " + h
}
