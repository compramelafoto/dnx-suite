#!/usr/bin/env python3
"""Genera las placas (PNG 1920x1080) del curso: apertura de cada clase, cierre y explicaciones.
Las «capas» (nombre con -capa) son transparentes y van encima de la pantalla filmada."""
import base64, os, subprocess
from clases import CLASES

AQUI = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(AQUI, "filmar", "placas"); os.makedirs(OUT, exist_ok=True)
LOGO = "data:image/png;base64," + base64.b64encode(open("/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite/apps/compramelafoto/public/LOGO CLF.png", "rb").read()).decode()
BASE_CSS = """*{box-sizing:border-box;margin:0}body{width:1920px;height:1080px;font-family:Inter,-apple-system,'Helvetica Neue',sans-serif;color:#111827;overflow:hidden}
.fondo{background:radial-gradient(circle at 18% 12%,#fbeee2 0,#f5f3ef 45%,#efe9e1 100%);width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 160px}
.logo{width:420px}.chico{width:230px;position:absolute;top:60px;left:80px}
h1{font-size:92px;font-weight:800;letter-spacing:-2px;line-height:1.05;margin-top:40px}
h2{font-size:64px;font-weight:800;letter-spacing:-1.5px;line-height:1.1}
.eti{font-size:34px;font-weight:700;color:#c27b3d;letter-spacing:1px;margin-top:56px;text-transform:uppercase}
.sub{font-size:38px;color:#4b5563;margin-top:28px;line-height:1.35}
.fila{display:flex;gap:28px;align-items:stretch;justify-content:center;margin-top:60px}
.caja{background:#fff;border-radius:28px;box-shadow:0 18px 50px rgba(17,24,39,.10);padding:40px 44px;font-size:34px;font-weight:600;line-height:1.3;min-width:300px}
.caja b{display:block;font-size:60px;margin-bottom:12px}
.fila.cinco .caja{min-width:0;width:270px;padding:34px 26px;font-size:31px}.fila.cinco .flecha{font-size:54px}
.caja.n{border:4px solid #c27b3d}
.flecha{font-size:70px;color:#c27b3d;align-self:center;font-weight:800}
.nota{font-size:30px;color:#6b7280;margin-top:50px}
.tarjeta{position:absolute;background:#fff;border-radius:22px;box-shadow:0 10px 40px rgba(17,24,39,.18);padding:34px 40px;text-align:left}
.btn{display:inline-block;background:#c27b3d;color:#fff;font-weight:700;border-radius:999px;padding:18px 40px;font-size:30px;margin-top:26px}
.btn.mp{background:#009ee3;border-radius:14px}
"""

def pagina(cuerpo, transparente=False):
    fondo = "background:transparent" if transparente else "background:#f5f3ef"
    return f"<!doctype html><html lang=es><head><meta charset=utf-8><style>{BASE_CSS}body{{{fondo}}}</style></head><body>{cuerpo}</body></html>"

PLACAS = {}
for c, cl in CLASES.items():
    n = int(c[1:])
    PLACAS[f"apertura-{c}"] = pagina(f'<div class="fondo"><img class="logo" src="{LOGO}"><p class="eti">Curso para fotógrafos nuevos · Clase {n}</p><h1>{cl["titulo"]}</h1></div>')
PLACAS["cierre"] = pagina(f'<div class="fondo"><img class="logo" src="{LOGO}"><h1 style="font-size:76px">Vendé tus fotos online</h1><p class="sub">compramelafoto.com</p></div>')

def pasos(titulo, items, nota=""):
    cls = "fila cinco" if len(items) >= 5 else "fila"
    cajas = '<span class="flecha">→</span>'.join(f'<div class="caja{" n" if i == len(items) - 1 else ""}"><b>{e}</b>{t}</div>' for i, (e, t) in enumerate(items))
    return pagina(f'<img class="chico" src="{LOGO}"><div class="fondo"><h2>{titulo}</h2><div class="{cls}">{cajas}</div>{f"<p class=nota>{nota}</p>" if nota else ""}</div>')

PLACAS["recorrido"] = pasos("Lo que vas a aprender", [("👤", "Tu cuenta"), ("💳", "Mercado Pago"), ("📷", "Tu primer álbum"), ("🛒", "La venta"), ("📦", "La entrega")])
PLACAS["correo-verificar"] = pagina(f"""<img class="chico" src="{LOGO}"><div class="fondo">
<div class="caja" style="width:1100px;text-align:left;padding:56px 64px;font-weight:400">
<p style="font-size:26px;color:#6b7280">De: ComprameLaFoto</p>
<p style="font-size:40px;font-weight:800;margin-top:10px">Verificá tu email en ComprameLaFoto</p>
<p style="font-size:32px;margin-top:30px;color:#374151">Necesitamos confirmar tu email para activar la cuenta.</p>
<span class="btn">Verificar email</span>
<p style="font-size:26px;color:#6b7280;margin-top:34px">El enlace vence a las 24 horas.</p></div></div>""")
# Tarjeta «Mercado Pago sin conectar» del Inicio, encima de la tarjeta del país (en el cuadro de 1920: x 480–1860, y 384–640).
PLACAS["mp-sin-conectar-capa"] = pagina("""<div class="tarjeta" style="left:480px;top:384px;width:1380px;height:256px;background:#fff1f0;border:2px solid #f3b4ae;box-shadow:none;border-radius:24px;padding:34px 40px">
<p style="font-size:30px;font-weight:700">Mercado Pago sin conectar</p>
<p style="font-size:26px;color:#374151;margin-top:10px">Conectá tu cuenta para cobrar ventas digitales e impresiones.</p>
<span class="btn" style="font-size:24px;padding:12px 30px;margin-top:22px">Conectar MP</span></div>""", True)
PLACAS["mp-desconectado"] = pagina(f"""<img class="chico" src="{LOGO}"><div class="fondo">
<div class="caja" style="width:1300px;text-align:left;padding:50px 60px;font-weight:400">
<p style="font-size:40px;font-weight:700">Integración con Mercado Pago</p>
<div style="background:#fff7e6;border:2px solid #f5c46b;border-radius:18px;padding:26px 30px;margin-top:26px;font-size:28px">⚠️ <b style="display:inline;font-size:28px">Este paso es obligatorio.</b> Si no vinculás tu cuenta de Mercado Pago no podrás subir fotos ni vender impresiones.</div>
<p style="font-size:28px;color:#374151;margin-top:26px">Conectá tu cuenta de Mercado Pago para recibir pagos directamente en tu cuenta.</p>
<span class="btn mp">Conectar con Mercado Pago</span>
<p style="font-size:24px;color:#6b7280;margin-top:22px">La autorización se hace en Mercado Pago. No compartís tu contraseña con ComprameLaFoto.</p></div></div>""")
PLACAS["mp-autorizar"] = pasos("Cómo se conecta", [("1", "Tocás «Conectar con Mercado Pago»"), ("2", "Iniciás sesión en Mercado Pago y autorizás"), ("3", "Volvés a tu panel, ya conectado")],
                               "Tu contraseña la ponés en Mercado Pago, nunca en ComprameLaFoto.")
PLACAS["mp-vencido"] = pagina(f"""<img class="chico" src="{LOGO}"><div class="fondo">
<div class="caja" style="width:1300px;text-align:left;padding:50px 60px;font-weight:400">
<div style="background:#fff1f0;border:2px solid #f3b4ae;border-radius:18px;padding:30px 34px;font-size:32px">⚠️ <b style="display:inline;font-size:32px">Se venció tu conexión con Mercado Pago.</b> Hasta que lo renueves nadie puede comprarte fotos.</div>
<span class="btn mp">Reconectar Mercado Pago</span>
<p style="font-size:28px;color:#6b7280;margin-top:30px">Mercado Pago pide renovar el permiso cada 6 meses.</p></div></div>""")

def reparto(titulo, partes, nota=""):
    cajas = "".join(f'<div class="caja" style="min-width:330px"><b>{e}</b>{t}</div>' for e, t in partes)
    return pagina(f'''<img class="chico" src="{LOGO}"><div class="fondo"><h2>{titulo}</h2>
<div class="fila"><div class="caja n" style="min-width:300px"><b>🛒</b>El cliente paga</div><span class="flecha">→</span>
<div class="caja" style="min-width:300px;background:#e8f6fd"><b>⚡</b>Mercado Pago reparte en el momento</div></div>
<p class="flecha" style="margin-top:10px">↓</p><div class="fila" style="margin-top:10px">{cajas}</div>{f"<p class=nota>{nota}</p>" if nota else ""}</div>''')

PLACAS["reparto"] = reparto("El cobro dividido", [("📷", "Tu parte, a tu cuenta"), ("🏟️", "El club o el colegio, la suya"), ("🧡", "ComprameLaFoto, su comisión")],
                            "Cada uno en su propia cuenta de Mercado Pago.")
PLACAS["nada-cambia"] = pasos("¿Qué cambia?", [("=", "Tus precios, iguales"), ("=", "Las comisiones, iguales"), ("⚡", "Cambia cuándo te llega el dinero: en el momento")],
                              "Si el cliente paga con el dinero de su cuenta de Mercado Pago, se cobra como siempre.")
PLACAS["autorizan-todos"] = pasos("Para que funcione", [("✔︎", "Cada parte lo autoriza"), ("1×", "Una sola vez"), ("⚡", "Y después, en cada venta, solo")])

def quien(titulo, ejemplo, quienes, nota=""):
    cajas = "".join(f'<div class="caja n" style="min-width:380px"><b>✅</b>{q}</div>' for q in quienes)
    return pagina(f'<img class="chico" src="{LOGO}"><div class="fondo"><p class="eti" style="margin-top:0">¿Quién lo autoriza?</p><h2 style="margin-top:20px">{titulo}</h2>'
                  f'<p class="sub">{ejemplo}</p><div class="fila">{cajas}</div>{f"<p class=nota>{nota}</p>" if nota else ""}</div>')

PLACAS["tipo-intro"] = pagina(f'<img class="chico" src="{LOGO}"><div class="fondo"><h2>¿Quién lo autoriza?</h2><p class="sub">Depende de quién participa en la venta.</p></div>')
PLACAS["tipo-propio"] = quien("Tu álbum", "Un evento o un partido que cubriste vos solo", ["Vos", "Quien te recomendó la plataforma (si lo hay)"])
PLACAS["tipo-organizador"] = quien("Evento con organizador", "Club, liga, escuela de danza o empresa de turismo que cobra comisión", ["Vos", "El organizador"])
PLACAS["tipo-escolar"] = quien("Venta escolar", "El colegio cobra una comisión", ["Vos", "El colegio"], "El colegio conecta su Mercado Pago una vez y su parte le llega sola.")
PLACAS["tipo-varios"] = quien("Evento con varios fotógrafos", "El cliente paga todo junto, en un solo carrito", ["Todos los fotógrafos del evento"], "Si falta uno, cada álbum se cobra por separado.")
PLACAS["tipo-lab"] = quien("Impresiones con laboratorio", "El laboratorio no tiene que autorizar nada", ["Vos le pagás el lote, como siempre"])
PLACAS["tipo-siempre"] = pagina(f'<img class="chico" src="{LOGO}"><div class="fondo"><p class="eti" style="margin-top:0">Mi consejo</p><h1 style="margin-top:20px">Activalo siempre,<br>el primer día</h1><p class="sub">Así ninguna venta se frena por un permiso que faltaba.</p></div>')

PLACAS["mp-plazos"] = pagina(f'''<img class="chico" src="{LOGO}"><div class="fondo"><p class="eti" style="margin-top:0">Un consejo antes de conectar</p>
<h2 style="margin-top:20px">Revisá tus plazos de acreditación</h2><div class="fila"><div class="caja"><b>⚡</b>Más rápido<br>= más comisión</div><div class="caja"><b>🗓️</b>Más días<br>= menos comisión</div></div>
<p class="nota">Se elige en tu cuenta de Mercado Pago. Elegí lo que te convenga.</p></div>''')

def cartel(resaltar="", marcado=False):
    r = lambda k: "outline:5px solid #c27b3d;outline-offset:6px;" if resaltar == k else ""
    caja = "☑" if marcado else "☐"
    return pagina(f'''<div style="position:absolute;inset:0;background:rgba(15,23,42,.55)"></div>
<div class="tarjeta" style="left:290px;top:70px;width:1340px;padding:50px 64px;font-size:28px;line-height:1.4">
<p style="font-size:42px;font-weight:800">Nuevos términos: cobro dividido con Mercado Pago</p>
<p style="color:#4b5563;margin-top:14px">Cuando alguien paga con tarjeta, Mercado Pago reparte el dinero en el momento: tu parte va directo a tu cuenta.</p>
<p style="color:#c27b3d;font-weight:700;margin-top:12px">Ver ejemplos: ¿cuándo se usa?</p>
<div style="background:#f9fafb;border-radius:18px;padding:26px 30px;margin-top:26px;{r('1')}"><p style="font-weight:800">1. Aceptá el anexo de los términos</p>
<p style="color:#c27b3d;margin-top:6px">Leer el texto completo</p><p style="margin-top:10px">{caja} Leí y acepto el anexo de cobro dividido con Mercado Pago.</p><span class="btn" style="font-size:26px;padding:12px 32px;margin-top:14px">Aceptar</span></div>
<div style="background:#f9fafb;border-radius:18px;padding:26px 30px;margin-top:20px;{r('2')}"><p style="font-weight:800">2. Autorizá el cobro dividido en Mercado Pago</p>
<p style="color:#4b5563;margin-top:6px">Esto lo tenés que hacer vos desde tu cuenta de Mercado Pago: nosotros no podemos hacerlo por vos. Cuando lo autorices, este cartel se va solo.</p></div>
<div style="display:flex;justify-content:space-between;align-items:center;margin-top:26px"><span style="color:#c27b3d">¿No podés completarlo? Escribinos</span>
<span style="border:2px solid #d1d5db;border-radius:999px;padding:12px 32px;font-weight:700;{r('ahora')}">Ahora no</span></div>
{"<p style='color:#6b7280;margin-top:14px;font-size:24px'>Tenés tiempo hasta la fecha límite. Después no vas a poder usar el panel sin completarlos.</p>" if resaltar == "ahora" else ""}</div>''')

PLACAS["cartel"] = cartel()
PLACAS["cartel-1"] = cartel("1", True)
PLACAS["cartel-2"] = cartel("2", True)
PLACAS["cartel-ahora"] = cartel("ahora")
PLACAS["invitacion-pendiente"] = pagina(f'''<img class="chico" src="{LOGO}"><div class="fondo"><div class="caja" style="width:1250px;text-align:left;padding:50px 60px;font-weight:400">
<p style="font-size:38px;font-weight:700">Cobro dividido al instante</p>
<div style="background:#fff7e6;border:2px solid #f5c46b;border-radius:18px;padding:26px 30px;margin-top:26px;font-size:30px">Falta un paso: aceptá la invitación en Mercado Pago con la cuenta <b style="display:inline;font-size:30px">tu-correo@mercadopago</b>.</div>
<div style="display:flex;gap:20px;align-items:center;margin-top:10px"><span class="btn mp" style="outline:5px solid #c27b3d;outline-offset:6px">Aceptar en Mercado Pago</span><span class="btn" style="background:#fff;color:#111827;border:2px solid #d1d5db">Ya acepté, revisar</span></div>
<p style="font-size:26px;color:#c27b3d;margin-top:24px">Usar otro correo</p></div></div>''')
PLACAS["cobro-activo"] = pagina(f'''<img class="chico" src="{LOGO}"><div class="fondo"><div class="caja" style="width:1250px;text-align:left;padding:50px 60px;font-weight:400">
<p style="font-size:38px;font-weight:700">Cobro dividido al instante</p>
<div style="background:#e7f7ee;border:2px solid #9fdcb9;border-radius:18px;padding:30px 34px;margin-top:26px;font-size:32px"><b style="display:inline;font-size:34px;color:#15803d">✅ Cobro dividido activo</b><br>En cada venta, Mercado Pago te deposita tu parte en el momento en tu cuenta.</div></div></div>''')

if __name__ == "__main__":
    tmp = os.path.join(OUT, "html"); os.makedirs(tmp, exist_ok=True); args = []
    for nombre, html in PLACAS.items():
        h = os.path.join(tmp, nombre + ".html"); open(h, "w").write(html); args += [os.path.join(OUT, nombre + ".png"), h]
    env = dict(os.environ, PLAYWRIGHT_BROWSERS_PATH="/private/tmp/claude-501/-Users-danielcuart--claude-spares-spare-NMtGK2/3d0e8012-1d28-4e81-b4c4-438b0b43f396/scratchpad/pw")
    subprocess.run(["node", os.path.join(AQUI, "filmar", "placa.mjs"), *args], check=True, env=env)
    print(len(PLACAS), "placas")
