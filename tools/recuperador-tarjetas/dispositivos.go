package main

// Dispositivo es una tarjeta o disco externo que se puede escanear.
type Dispositivo struct {
	Ruta    string // lo que se abre para leer (/dev/rdisk4, \\.\PhysicalDrive2…)
	Nombre  string // lo que ve la persona
	Tamanio int64
}
