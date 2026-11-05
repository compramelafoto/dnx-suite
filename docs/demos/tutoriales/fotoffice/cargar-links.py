"""Pasa los links ya subidos a YouTube a la página /tutoriales de FOTOFFICE.

Lee el manifiesto (qué clase de qué curso es cada archivo) y el estado de subir.py (el id de YouTube de
cada archivo subido) y escribe el SQL que guarda los links en SystemSettings:

    python3 docs/demos/tutoriales/fotoffice/cargar-links.py | psql "$DIRECT_URL" -v ON_ERROR_STOP=1

DIRECT_URL es la de apps/fotoffice/.env.local (la base de producción de FOTOFFICE). Reemplaza los links
de cada curso por los del estado: lo cargado a mano desde /admin/tutoriales para otras clases se pierde.
"""
import json, pathlib

AQUI = pathlib.Path(__file__).parent
ESTADO = pathlib.Path('/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite/tools/video/youtube/'
                      'estado-youtube-manifiesto-fotoffice.json')
CLAVES = {  # lib/tutoriales/cursos.ts
    'negocio-de-fotografia': 'fotoffice_tutoriales_negocio',
    'sociedad-o-fotoclub': 'fotoffice_tutoriales_sociedad',
    'cuanto-cobrar': 'fotoffice_tutoriales_cuanto_cobrar',
}

manifiesto = json.loads((AQUI / 'youtube-manifiesto-fotoffice.json').read_text(encoding='utf-8'))
estado = json.loads(ESTADO.read_text(encoding='utf-8'))
por_curso = {slug: {} for slug in CLAVES}
for v in manifiesto['videos']:
    if v['archivo'] in estado:
        por_curso[v['curso']][v['clave']] = f"https://youtu.be/{estado[v['archivo']]}"

print('BEGIN;')
for slug, videos in por_curso.items():
    if not videos:
        continue
    valor = json.dumps({'videos': videos}, ensure_ascii=False).replace("'", "''")
    print(f'''INSERT INTO "SystemSettings" (key, value, description, "isActive", "createdAt", "updatedAt")
VALUES ('{CLAVES[slug]}', '{valor}', 'Links de YouTube de /tutoriales/{slug}', true, now(), now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = now();''')
print('COMMIT;')
