<#
.SYNOPSIS
  Ayudante de FOTOFFICE: apaga la computadora cuando la estación de grabación termina de subir.

.DESCRIPTION
  La página de FOTOFFICE no puede apagar Windows por su cuenta. Este ayudante queda escuchando
  SOLO en esta computadora (127.0.0.1, puerto 47231) y hace tres cosas:
    GET  /estado    -> responde que está andando y su versión.
    POST /apagar    -> shutdown /s /t 30 (Windows avisa y da 30 s para cancelar con shutdown /a).
    POST /cancelar  -> shutdown /a.
  Sólo atiende pedidos que vienen de https://fotoffice.com (o www, o el entorno de desarrollo
  http://localhost:3010) y que traen el código de emparejamiento de 6 números.

  Uso:
    powershell -ExecutionPolicy Bypass -File ayudante-apagado.ps1 -Instalar
      Lo copia a %APPDATA%\FOTOFFICE, lo deja arrancando solo al iniciar sesión y muestra el código.
      (Clic derecho -> "Ejecutar con PowerShell" hace lo mismo.)
    ... -MostrarCodigo   vuelve a mostrar el código.
    ... -Desinstalar     lo quita (deja de arrancar solo y se borra el código).
    ... -Servir          lo usa la tarea programada: queda escuchando, sin ventana.

  Funciona con Windows PowerShell 5.1 (el que trae Windows) y no pide permisos de administrador.
#>
[CmdletBinding()]
param(
  [switch]$Instalar,
  [switch]$Desinstalar,
  [switch]$Servir,
  [switch]$MostrarCodigo
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

$Version = '1.0.0'
$Puerto = 47231
$NombreTarea = 'FOTOFFICE - Ayudante de apagado'
# Únicas páginas que pueden pedir el apagado. Cualquier otra recibe 403.
$OrigenesPermitidos = @('https://fotoffice.com', 'https://www.fotoffice.com', 'http://localhost:3010')
# Contra "DNS rebinding": el pedido tiene que estar dirigido a esta máquina por nombre local.
$HostsPermitidos = @("127.0.0.1:$Puerto", "localhost:$Puerto")
$Carpeta = Join-Path $env:APPDATA 'FOTOFFICE'
$ArchivoConfig = Join-Path $Carpeta 'ayudante.json'
$ScriptInstalado = Join-Path $Carpeta 'ayudante-apagado.ps1'
$AccesoInicio = Join-Path ([Environment]::GetFolderPath('Startup')) 'FOTOFFICE ayudante de apagado.lnk'
# Límite de pedidos: la estación consulta cada 30 s; 60 por minuto sobra.
$MaxPedidosPorMinuto = 60
# Tras 5 códigos equivocados seguidos, 5 minutos sin atender (adivinar 6 números se vuelve eterno).
$MaxCodigosErrados = 5
$MinutosBloqueo = 5

# ── Código de emparejamiento ───────────────────────────────────────────────

function Obtener-Config {
  if (-not (Test-Path -LiteralPath $Carpeta)) { New-Item -ItemType Directory -Path $Carpeta -Force | Out-Null }
  if (Test-Path -LiteralPath $ArchivoConfig) {
    try {
      $c = Get-Content -Raw -LiteralPath $ArchivoConfig | ConvertFrom-Json
      if ([string]$c.codigo -match '^\d{6}$') { return $c }
    } catch { }
  }
  # Primera vez (o archivo roto): se genera con el generador criptográfico de Windows.
  $rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
  $bytes = New-Object byte[] 4
  $rng.GetBytes($bytes)
  $numero = [BitConverter]::ToUInt32($bytes, 0) % 1000000
  $c = [pscustomobject]@{ codigo = ('{0:D6}' -f $numero); creado = (Get-Date).ToString('s') }
  $c | ConvertTo-Json | Set-Content -LiteralPath $ArchivoConfig -Encoding UTF8
  return $c
}

function Mostrar-Codigo([string]$codigo, [string]$titulo) {
  $separado = ($codigo.ToCharArray() -join ' ')
  Write-Host ''
  Write-Host '  ==============================================' -ForegroundColor Cyan
  Write-Host "    $titulo" -ForegroundColor Cyan
  Write-Host ''
  Write-Host '    Código para escribir en FOTOFFICE:' -ForegroundColor White
  Write-Host ''
  Write-Host "          $separado" -ForegroundColor Yellow -BackgroundColor DarkBlue
  Write-Host ''
  Write-Host '  ==============================================' -ForegroundColor Cyan
  Write-Host ''
  # Con "Ejecutar con PowerShell" la consola se cierra sola al terminar: el cartel la frena.
  try {
    Add-Type -AssemblyName System.Windows.Forms
    [void][System.Windows.Forms.MessageBox]::Show(
      "$titulo`r`n`r`nCódigo para escribir en FOTOFFICE:`r`n`r`n          $separado`r`n`r`nAnotalo: lo vas a escribir en la estación de grabación.",
      'FOTOFFICE - Ayudante de apagado', 'OK', 'Information')
  } catch {
    Read-Host 'Presioná Enter para cerrar'
  }
}

# ── Servidor (sólo 127.0.0.1) ──────────────────────────────────────────────
# Se usa TcpListener sobre la interfaz de loopback y no HttpListener: HttpListener con
# "http://127.0.0.1:47231/" pide una reserva de URL de administrador (netsh http add urlacl),
# y "+" o "*" además lo abrirían a la red. TcpListener en 127.0.0.1 no necesita permisos y
# es imposible alcanzarlo desde otra computadora.

$script:Pedidos = New-Object 'System.Collections.Generic.Queue[datetime]'
$script:CodigosErrados = 0
$script:BloqueadoHasta = [datetime]::MinValue

function Escribir-Respuesta($red, [int]$estado, [string]$texto, [hashtable]$encabezados, [string]$cuerpo) {
  $bytesCuerpo = [System.Text.Encoding]::UTF8.GetBytes($cuerpo)
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.Append("HTTP/1.1 $estado $texto`r`n")
  foreach ($k in $encabezados.Keys) { [void]$sb.Append("${k}: $($encabezados[$k])`r`n") }
  [void]$sb.Append("Content-Length: $($bytesCuerpo.Length)`r`nConnection: close`r`n`r`n")
  $cabecera = [System.Text.Encoding]::ASCII.GetBytes($sb.ToString())
  $red.Write($cabecera, 0, $cabecera.Length)
  if ($bytesCuerpo.Length -gt 0) { $red.Write($bytesCuerpo, 0, $bytesCuerpo.Length) }
  $red.Flush()
}

function Json([hashtable]$datos) { return ($datos | ConvertTo-Json -Compress) }

function Ejecutar-Shutdown([string[]]$argumentos) {
  & "$env:SystemRoot\System32\shutdown.exe" @argumentos 2>&1 | Out-Null
  return $LASTEXITCODE
}

function Atender-Pedido($cliente, [string]$codigo) {
  $cliente.ReceiveTimeout = 5000
  $cliente.SendTimeout = 5000
  $red = $cliente.GetStream()
  $lector = New-Object System.IO.StreamReader($red, [System.Text.Encoding]::ASCII, $false, 4096, $true)

  # Línea de pedido ("GET /estado HTTP/1.1") y encabezados, con tope para no leer basura sin fin.
  $linea = $lector.ReadLine()
  if (-not $linea) { return }
  $partes = $linea.Split(' ')
  if ($partes.Length -lt 3) { Escribir-Respuesta $red 400 'Bad Request' @{} ''; return }
  $metodo = $partes[0].ToUpperInvariant()
  $ruta = $partes[1].Split('?')[0]
  $enc = @{}  # las tablas de PowerShell no distinguen mayúsculas: "origin" = "Origin"
  for ($i = 0; $i -lt 60; $i++) {
    $l = $lector.ReadLine()
    if ($null -eq $l -or $l -eq '') { break }
    if ($l.Length -gt 8192) { return }
    $dos = $l.IndexOf(':')
    if ($dos -gt 0) { $enc[$l.Substring(0, $dos).Trim()] = $l.Substring($dos + 1).Trim() }
  }

  # Límite de pedidos por minuto (para todos los que llaman).
  $ahora = Get-Date
  while ($script:Pedidos.Count -gt 0 -and ($ahora - $script:Pedidos.Peek()).TotalSeconds -gt 60) { [void]$script:Pedidos.Dequeue() }
  if ($script:Pedidos.Count -ge $MaxPedidosPorMinuto) { Escribir-Respuesta $red 429 'Too Many Requests' @{} ''; return }
  $script:Pedidos.Enqueue($ahora)

  $hostPedido = if ($enc.ContainsKey('Host')) { $enc['Host'].ToLowerInvariant() } else { '' }
  if ($HostsPermitidos -notcontains $hostPedido) { Escribir-Respuesta $red 403 'Forbidden' @{} ''; return }

  # Sin Origin permitido no hay CORS: el navegador no deja que otra página lea ni dispare nada.
  $origen = if ($enc.ContainsKey('Origin')) { $enc['Origin'] } else { '' }
  if ($OrigenesPermitidos -notcontains $origen) { Escribir-Respuesta $red 403 'Forbidden' @{} ''; return }

  $base = @{
    'Access-Control-Allow-Origin' = $origen
    'Vary'                        = 'Origin'
    'Cache-Control'               = 'no-store'
    'Content-Type'                = 'application/json; charset=utf-8'
  }

  # Preflight CORS, y la de red privada de Chrome (Private Network Access).
  if ($metodo -eq 'OPTIONS') {
    $base['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    $base['Access-Control-Allow-Headers'] = 'X-Codigo'
    $base['Access-Control-Max-Age'] = '600'
    if ($enc.ContainsKey('Access-Control-Request-Private-Network')) { $base['Access-Control-Allow-Private-Network'] = 'true' }
    Escribir-Respuesta $red 204 'No Content' $base ''
    return
  }

  if ($ahora -lt $script:BloqueadoHasta) {
    Escribir-Respuesta $red 429 'Too Many Requests' $base (Json @{ ok = $false; error = 'bloqueado' })
    return
  }
  # Todo pedido real exige el código de emparejamiento.
  $codigoPedido = if ($enc.ContainsKey('X-Codigo')) { $enc['X-Codigo'] } else { '' }
  if ($codigoPedido -cne $codigo) {
    $script:CodigosErrados++
    if ($script:CodigosErrados -ge $MaxCodigosErrados) {
      $script:BloqueadoHasta = $ahora.AddMinutes($MinutosBloqueo)
      $script:CodigosErrados = 0
    }
    Escribir-Respuesta $red 401 'Unauthorized' $base (Json @{ ok = $false; error = 'codigo' })
    return
  }
  $script:CodigosErrados = 0

  if ($ruta -eq '/estado' -and $metodo -eq 'GET') {
    Escribir-Respuesta $red 200 'OK' $base (Json @{ ok = $true; version = $Version })
  } elseif ($ruta -eq '/apagar' -and $metodo -eq 'POST') {
    # 30 s de margen: Windows muestra su aviso y se puede cancelar con "shutdown /a".
    $salida = Ejecutar-Shutdown @('/s', '/t', '30', '/c', 'FOTOFFICE: grabación subida')
    # 1190 = ya había un apagado pedido: para la estación es lo mismo.
    if ($salida -eq 0 -or $salida -eq 1190) { Escribir-Respuesta $red 200 'OK' $base (Json @{ ok = $true }) }
    else { Escribir-Respuesta $red 500 'Internal Server Error' $base (Json @{ ok = $false; error = "shutdown $salida" }) }
  } elseif ($ruta -eq '/cancelar' -and $metodo -eq 'POST') {
    # 1116 = no había ningún apagado en curso: también está bien.
    $salida = Ejecutar-Shutdown @('/a')
    if ($salida -eq 0 -or $salida -eq 1116) { Escribir-Respuesta $red 200 'OK' $base (Json @{ ok = $true }) }
    else { Escribir-Respuesta $red 500 'Internal Server Error' $base (Json @{ ok = $false; error = "shutdown $salida" }) }
  } elseif ($ruta -eq '/estado' -or $ruta -eq '/apagar' -or $ruta -eq '/cancelar') {
    Escribir-Respuesta $red 405 'Method Not Allowed' $base (Json @{ ok = $false; error = 'metodo' })
  } else {
    Escribir-Respuesta $red 404 'Not Found' $base (Json @{ ok = $false; error = 'ruta' })
  }
}

function Iniciar-Servidor {
  $codigo = [string](Obtener-Config).codigo
  $escucha = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Puerto)
  try {
    $escucha.Start()
  } catch {
    # El puerto ya está tomado: casi seguro otro ayudante andando. No hace falta un segundo.
    exit 0
  }
  while ($true) {
    $cliente = $escucha.AcceptTcpClient()
    try { Atender-Pedido $cliente $codigo } catch { } finally { $cliente.Close() }
  }
}

# ── Instalar / desinstalar ─────────────────────────────────────────────────

function Detener-Ayudantes {
  try {
    Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" |
      Where-Object { $_.CommandLine -and $_.CommandLine -like '*ayudante-apagado.ps1*-Servir*' -and $_.ProcessId -ne $PID } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  } catch { }
}

function Instalar-Ayudante {
  $config = Obtener-Config
  # Se copia a %APPDATA%: si después borran la carpeta Descargas, sigue andando.
  if ($PSCommandPath -and ($PSCommandPath -ne $ScriptInstalado)) { Copy-Item -LiteralPath $PSCommandPath -Destination $ScriptInstalado -Force }
  try { Unblock-File -LiteralPath $ScriptInstalado } catch { }
  # Si había una versión vieja andando, se cierra para que arranque la nueva.
  Detener-Ayudantes

  $argumentos = "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$ScriptInstalado`" -Servir"
  $usuario = "$env:USERDOMAIN\$env:USERNAME"
  $registrado = $false
  try {
    # Tarea programada del usuario actual, al iniciar sesión, oculta y sin permisos de administrador.
    $accion = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $argumentos
    $disparador = New-ScheduledTaskTrigger -AtLogOn -User $usuario
    $principal = New-ScheduledTaskPrincipal -UserId $usuario -LogonType Interactive -RunLevel Limited
    $ajustes = New-ScheduledTaskSettingsSet -Hidden -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
    Register-ScheduledTask -TaskName $NombreTarea -Action $accion -Trigger $disparador -Principal $principal -Settings $ajustes -Description 'Deja que FOTOFFICE apague la computadora al terminar de subir una grabación.' -Force | Out-Null
    Start-ScheduledTask -TaskName $NombreTarea
    $registrado = $true
    if (Test-Path -LiteralPath $AccesoInicio) { Remove-Item -LiteralPath $AccesoInicio -Force }
  } catch {
    Write-Host "No se pudo crear la tarea programada ($($_.Exception.Message)). Uso la carpeta Inicio." -ForegroundColor Yellow
  }
  if (-not $registrado) {
    # Plan B, también sin administrador: un acceso directo en la carpeta Inicio del usuario.
    $shell = New-Object -ComObject WScript.Shell
    $acceso = $shell.CreateShortcut($AccesoInicio)
    $acceso.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
    $acceso.Arguments = $argumentos
    $acceso.WindowStyle = 7
    $acceso.Save()
    Start-Process -FilePath 'powershell.exe' -ArgumentList $argumentos -WindowStyle Hidden
  }
  Mostrar-Codigo ([string]$config.codigo) 'Listo: el ayudante quedó instalado y arranca solo con Windows.'
}

function Desinstalar-Ayudante {
  try { Stop-ScheduledTask -TaskName $NombreTarea -ErrorAction SilentlyContinue } catch { }
  try { Unregister-ScheduledTask -TaskName $NombreTarea -Confirm:$false -ErrorAction SilentlyContinue } catch { }
  if (Test-Path -LiteralPath $AccesoInicio) { Remove-Item -LiteralPath $AccesoInicio -Force }
  Detener-Ayudantes
  foreach ($f in @($ArchivoConfig, $ScriptInstalado)) {
    if ((Test-Path -LiteralPath $f) -and ($f -ne $PSCommandPath)) { Remove-Item -LiteralPath $f -Force }
  }
  Write-Host 'Listo: el ayudante de apagado se quitó de esta computadora.' -ForegroundColor Green
}

# ── Qué hacer ──────────────────────────────────────────────────────────────

if ($Servir) {
  Iniciar-Servidor
} elseif ($Desinstalar) {
  Desinstalar-Ayudante
} elseif ($MostrarCodigo) {
  Mostrar-Codigo ([string](Obtener-Config).codigo) 'Ayudante de apagado de FOTOFFICE'
} else {
  # Sin opciones (doble clic o "Ejecutar con PowerShell") es lo mismo que -Instalar.
  Instalar-Ayudante
}
