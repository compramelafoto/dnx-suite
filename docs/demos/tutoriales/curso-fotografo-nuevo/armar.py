#!/usr/bin/env python3
"""Arma el PDF del curso «Empezá a vender en ComprameLaFoto» y de sus shorts, a partir de guion.py.

Mismo formato que «Guiones para grabar»: portada con el índice, una hoja por capítulo con «Cómo grabar»,
una hoja por clase (🎬 lo que se ve + la voz en letra grande) y, al final, los shorts.
Uso: python3 docs/demos/tutoriales/curso-fotografo-nuevo/armar.py
     → curso.html + Curso-ComprameLaFoto-fotografo-nuevo.pdf (y una copia en ~/Downloads)
"""
import base64, html, pathlib, shutil, subprocess, sys

AQUI = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
from guion import CURSO, SHORTS, HALLAZGOS  # noqa: E402

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
NOMBRE_PDF = "Curso-ComprameLaFoto-fotografo-nuevo.pdf"
e = html.escape
LOGO = "data:image/png;base64," + base64.b64encode((AQUI / "logo-clf.png").read_bytes()).decode()

COMO_CURSO = [
    "Grabá cada clase en un archivo aparte y guardalo con su código: <b>C01.m4a</b>, <b>C02.m4a</b>…",
    "Leé solo el texto en letra grande. Lo de la caja 🎬 es lo que se va a ver en pantalla: no se lee.",
    "Dejá un segundo de silencio entre toma y toma: ahí se corta y se pega con la pantalla.",
    "Si te equivocás, repetí la frase entera desde el principio; después se limpia.",
    "Solo la clase 1 lleva tu presentación. Las demás arrancan directo con el tema.",
]
COMO_SHORTS = [
    "Cada short se graba en un archivo aparte: <b>S01.m4a</b>, <b>S02.m4a</b>…",
    "Son tres frases: gancho, paso y cierre. Leelas con energía: duran entre 20 y 40 segundos.",
    "El video va en vertical, con la misma pantalla que la clase indicada.",
]

clases = [c for cap in CURSO for c in cap["clases"]]

def portada():
    caps = "".join(
        f'<tr class="cap"><td colspan="3"><a href="#cap{i}">{e(cap["titulo"])}</a></td></tr>' +
        "".join(f'<tr><td class="cod"><a href="#{c["cod"]}">{e(c["cod"])}</a></td><td><a href="#{c["cod"]}">'
                f'{e(c["titulo"])}</a></td><td class="dur">{e(c["dur"])}</td></tr>' for c in cap["clases"])
        for i, cap in enumerate(CURSO, 1))
    hall = "".join(f"<li>{e(h)}</li>" for h in HALLAZGOS)
    return f"""<section class="hoja portada">
  <img src="{LOGO}" alt="ComprameLaFoto" class="logo">
  <h1>Empezá a vender en ComprameLaFoto</h1>
  <p class="sub">Curso en video para fotógrafos nuevos · guion para grabar · 21/11/2026</p>
  <p class="cifra"><b>{len(clases)}</b> clases en {len(CURSO)} capítulos · <b>{len(SHORTS)}</b> shorts para redes</p>
  <div class="tabla"><table class="indice">{caps}
  <tr class="cap"><td colspan="3"><a href="#shorts">Shorts para redes (S01 a S{len(SHORTS):02d})</a></td></tr></table></div>
  <div class="caja"><h3>Para revisar antes de grabar</h3><p>Cosas que hoy no andan como el video necesita. El guion las esquiva; conviene decidir si se arreglan antes:</p><ul>{hall}</ul></div>
</section>"""

def hoja_capitulo(i, cap):
    pasos = "".join(f"<li>{p}</li>" for p in COMO_CURSO)
    filas = "".join(f'<tr><td class="cod">{e(c["cod"])}</td><td>{e(c["titulo"])}</td><td class="dur">{e(c["dur"])}</td></tr>'
                    for c in cap["clases"])
    como = f'<div class="como"><h3>Cómo grabar</h3><ol>{pasos}</ol></div>' if i == 1 else ""
    return f"""<section class="hoja portada grupo" id="cap{i}">
  <img class="logo" src="{LOGO}" alt="">
  <h1 class="g">{e(cap['titulo'])}</h1>
  <p class="sub">{len(cap['clases'])} {'clase' if len(cap['clases']) == 1 else 'clases'}</p>
  {como}
  <div class="tabla"><table class="indice">{filas}</table></div>
</section>"""

def hoja_clase(c):
    tomas = "".join(
        f'<li><span class="n">{i}</span><div><p class="escena">🎬 {e(p)}</p><p class="voz">{e(v)}</p></div></li>'
        for i, (p, v) in enumerate(c["tomas"], 1))
    ojo = f'<p class="ojo"><b>Antes de grabar:</b> {e(c["ojo"])}</p>' if c.get("ojo") else ""
    return f"""<section class="hoja" id="{c['cod']}">
  <div class="cab"><span class="pill">{e(c["cod"])}</span><span class="guardar">Guardalo como <b>{e(c["cod"])}.m4a</b></span></div>
  <h2>{e(c["titulo"])}</h2>
  <p class="meta">≈ {e(c["dur"])} · Arranca en: {e(c["arranca"])}</p>
  <ol class="tomas">{tomas}</ol>
  {ojo}
</section>"""

def hojas_shorts():
    pasos = "".join(f"<li>{p}</li>" for p in COMO_SHORTS)
    filas = "".join(f'<tr><td class="cod">{e(cod)}</td><td>{e(t)}</td><td class="dur">de la clase {e(cl)}</td></tr>'
                    for cod, t, cl, *_ in SHORTS)
    out = f"""<section class="hoja portada grupo" id="shorts">
  <img class="logo" src="{LOGO}" alt="">
  <h1 class="g">Shorts para redes</h1>
  <p class="sub">{len(SHORTS)} videos verticales · Instagram, TikTok y YouTube Shorts · uno por configuración o acción</p>
  <div class="como"><h3>Cómo grabar</h3><ol>{pasos}</ol></div>
  <div class="tabla"><table class="indice">{filas}</table></div>
</section>"""
    tarjetas = []
    for cod, titulo, clase, *partes in SHORTS:
        tomas = "".join(
            f'<li><span class="n et">{et}</span><div><p class="escena">🎬 {e(p)}</p><p class="voz">{e(v)}</p></div></li>'
            for et, (p, v) in zip(("Gancho", "Paso", "Cierre"), partes))
        tarjetas.append(f"""<div class="short">
  <div class="cab"><span class="pill chica">{e(cod)}</span><span class="guardar">Guardalo como <b>{e(cod)}.m4a</b> · pantalla de la clase {e(clase)}</span></div>
  <h3>{e(titulo)}</h3>
  <ol class="tomas">{tomas}</ol></div>""")
    # Dos shorts por hoja.
    for i in range(0, len(tarjetas), 2):
        out += f'<section class="hoja">{"".join(tarjetas[i:i + 2])}</section>'
    return out

cuerpo = portada() + "".join(hoja_capitulo(i, cap) + "".join(hoja_clase(c) for c in cap["clases"])
                             for i, cap in enumerate(CURSO, 1)) + hojas_shorts()

pagina = f"""<title>Curso fotógrafo nuevo</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
<style>
:root {{ --tinta: #111827; --gris: #6b7280; --naranja: #c27b3d; --crema: #f5f3ef; --escena: #f4e6da; --escena-t: #7a4a22;
  --linea: #e5e7eb; --papel: #ffffff; --fondo: #eceae6; --aviso: #fff4d6;
  --f: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif; color-scheme: light; }}
* {{ box-sizing: border-box; }}
body {{ margin: 0; background: var(--fondo); color: var(--tinta); font: 15px/1.55 var(--f); padding: 24px 16px; }}
a {{ color: inherit; text-decoration: none; }}
.hoja {{ background: var(--papel); max-width: 820px; margin: 0 auto 24px; padding: 56px clamp(20px, 7vw, 62px); border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0,0,0,.08); }}
.portada {{ text-align: center; }}
.logo {{ width: 170px; max-width: 50%; height: auto; }}
h1 {{ font-size: clamp(28px, 6vw, 40px); font-weight: 800; letter-spacing: -.02em; margin: 18px 0 4px; text-wrap: balance; }}
h1.g {{ font-size: clamp(26px, 5vw, 34px); }}
.sub {{ color: var(--gris); font-size: 16px; margin: 0 0 18px; }}
.cifra {{ font-size: 17px; margin: 0 0 8px; }} .cifra b {{ color: var(--naranja); font-size: 26px; }}
.como, .caja {{ text-align: left; background: var(--crema); border-left: 5px solid var(--naranja); border-radius: 10px; padding: 16px 24px; margin-top: 20px; }}
.caja {{ background: var(--aviso); border-left-color: #d4a017; font-size: 13px; }}
.caja p {{ margin: 0 0 6px; }}
.como h3, .caja h3 {{ margin: 0 0 8px; font-size: 15px; }}
.como ol, .caja ul {{ margin: 0; padding-left: 22px; }}
.como li + li, .caja li + li {{ margin-top: 5px; }}
.tabla {{ margin-top: 18px; }}
.indice {{ width: 100%; border-collapse: collapse; text-align: left; font-size: 13.5px; }}
.indice td {{ padding: 7px 8px; border-bottom: 1px solid var(--linea); vertical-align: top; }}
.indice tr.cap td {{ font-weight: 800; padding-top: 14px; border-bottom: 2px solid var(--tinta); }}
.cod {{ color: var(--naranja); font-weight: 700; white-space: nowrap; }}
.dur {{ color: var(--gris); white-space: nowrap; }}
.cab {{ display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; align-items: center; }}
.pill {{ background: var(--naranja); color: #fff; font-weight: 800; font-size: 24px; padding: 6px 22px; border-radius: 99px; }}
.pill.chica {{ font-size: 18px; padding: 4px 16px; }}
.guardar {{ color: var(--gris); font-size: 13.5px; }} .guardar b {{ color: var(--tinta); }}
h2 {{ font-size: 28px; font-weight: 800; letter-spacing: -.015em; line-height: 1.2; margin: 24px 0 4px; text-wrap: balance; }}
.meta {{ color: var(--gris); font-size: 13px; margin: 0 0 22px; }}
.tomas {{ list-style: none; margin: 0; padding: 0; display: grid; gap: 20px; }}
.tomas li {{ display: grid; grid-template-columns: 36px minmax(0, 1fr); gap: 18px; align-items: start; break-inside: avoid; }}
.n {{ width: 36px; height: 36px; border-radius: 50%; background: var(--tinta); color: #fff; font-weight: 700; font-size: 14px;
  display: grid; place-items: center; margin-top: 4px; }}
.short .tomas li {{ grid-template-columns: 66px minmax(0, 1fr); gap: 14px; }}
.n.et {{ width: 66px; height: auto; border-radius: 6px; font-size: 11px; padding: 5px 0; }}
.escena {{ display: inline-block; background: var(--escena); color: var(--escena-t); font-size: 13px; line-height: 1.4;
  padding: 7px 12px; border-radius: 6px; margin: 0 0 8px; }}
.voz {{ font-size: clamp(18px, 3.2vw, 22px); font-weight: 700; line-height: 1.4; margin: 0; letter-spacing: -.01em; }}
.ojo {{ margin: 26px 0 0; background: var(--aviso); border-radius: 8px; padding: 10px 14px; font-size: 13px; }}
.short {{ break-inside: avoid; }}
.short + .short {{ margin-top: 34px; padding-top: 30px; border-top: 2px dashed var(--linea); }}
.short h3 {{ font-size: 22px; margin: 14px 0 16px; }}
.short .voz {{ font-size: 19px; }}
@page {{ size: A4; margin: 14mm 0; }}
@media print {{
  body {{ background: #fff; padding: 0; }}
  .hoja {{ box-shadow: none; margin: 0 auto; padding: 0 16mm; max-width: none; border-radius: 0; break-after: page; }}
  .hoja:last-child {{ break-after: auto; }}
}}
</style>
{cuerpo}
"""

(AQUI / "curso.html").write_text(pagina, encoding="utf-8")
tmp = AQUI / ".para-pdf.html"
tmp.write_text(f'<!doctype html><html lang="es"><head><meta charset="utf-8"></head><body>{pagina}</body></html>', encoding="utf-8")
pdf = AQUI / NOMBRE_PDF
subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-pdf-header-footer", "--virtual-time-budget=10000",
                f"--print-to-pdf={pdf}", tmp.as_uri()], check=True, capture_output=True)
tmp.unlink()
destino = pathlib.Path.home() / "Downloads" / NOMBRE_PDF
shutil.copy(pdf, destino)
print("Listo:", len(clases), "clases,", len(SHORTS), "shorts ·", destino)
