"""Genera el SQL idempotente del alta de F64 Productora en FOTOFFICE (ws_f64).

Uso: python3 -I generar_alta.py <keys2.txt> > alta_f64.sql
Los cursos quedan en BORRADOR y sin precio: los precios los define Andrea en el formulario.
"""
import json
import sys

R2 = "https://pub-2086bd02202c406a9b952f2dbfa945c9.r2.dev"
WS = "ws_f64"
SLUG = "f64"
WA = "5493492417703"


def q(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, (dict, list)):
        return "'" + json.dumps(v, ensure_ascii=False).replace("'", "''") + "'::jsonb"
    return "'" + str(v).replace("'", "''") + "'"


def insert(table, row, conflict="id"):
    cols = ", ".join(f'"{c}"' for c in row)
    vals = ", ".join(q(v) for v in row.values())
    return f'INSERT INTO "{table}" ({cols}) VALUES ({vals}) ON CONFLICT ("{conflict}") DO NOTHING;'


CURSOS = [
    {
        "key": "inicial",
        "title": "Fotografía Inicial · Nivel 1",
        "slug": "fotografia-inicial",
        "level": "Inicial",
        "short": "Aprendé a usar tu cámara desde cero hasta el modo manual, en 10 clases grabadas.",
        "long": (
            "Un recorrido ordenado por los fundamentos de la fotografía, pensado para quien recién "
            "empieza o quiere dejar de disparar en automático.\n\n"
            "**Qué vas a ver**\n"
            "- Tipos de cámaras y modos de escena\n"
            "- Fotografía digital, balance de blancos, enfoque y medición\n"
            "- Profundidad de campo, flash y factores de la luz\n"
            "- Tipos de fotografía y, al final, el modo manual\n\n"
            "Cada clase trae su material en PDF para repasar cuando quieras."
        ),
        "lessons": [
            "Tipos de cámaras",
            "Modos de escena",
            "Fotografía digital",
            "Balance de blancos",
            "Sistema de enfoque y medición",
            "Profundidad de campo",
            "Flash",
            "Luz: factores de la luz",
            "Tipos de fotografía",
            "Modo manual",
        ],
    },
    {
        "key": "iluminacion",
        "title": "Iluminación: uso técnico y creativo de la luz",
        "slug": "iluminacion",
        "level": "Intermedio",
        "short": "La luz es la que genera el encanto: aprendé a leerla, medirla y crearla en 8 clases.",
        "long": (
            "Un curso para dominar la herramienta principal del fotógrafo: la luz.\n\n"
            "**Qué vas a ver**\n"
            "- Factores y propiedades de la luz\n"
            "- Cómo iluminar con intención\n"
            "- Luz natural y luz artificial\n"
            "- Flash: uso técnico\n"
            "- Esquemas de iluminación\n\n"
            "Cada clase trae su material en PDF."
        ),
        "lessons": [
            "Iluminación: uso técnico y creativo de la luz",
            "Factores de la luz",
            "Propiedades de la luz",
            "Iluminar",
            "Luz natural",
            "Luz artificial",
            "Flash: uso técnico",
            "Esquemas de iluminación",
        ],
    },
    {
        "key": "productos",
        "title": "Fotografía de productos con celular",
        "slug": "fotografia-de-productos",
        "level": "Inicial",
        "short": "Para emprendedores y artesanos: fotos de producto que venden, hechas con tu celular.",
        "long": (
            "Hoy la mayor parte de las ventas pasa por una pantalla: tus fotos son tu vidriera. "
            "Este curso es para emprendedores, artesanos y fotógrafos que quieren mostrar mejor sus "
            "productos en redes y tiendas online, con el celular.\n\n"
            "**Qué vas a ver**\n"
            "- Crear contenido visual para tu marca: planificar, producir y editar\n"
            "- Cómo comenzar: materiales, fondos, accesorios y configuración del celular\n"
            "- La luz: origen, calidad, dirección y color\n"
            "- Composición y estilo propio\n\n"
            "Incluye el material completo en PDF."
        ),
        "lessons": [
            "Módulo 1 · Crear contenido visual para tu marca",
            "Módulo 2 · Cómo comenzar: materiales, celular, luz y composición",
            "Módulo 3 · La luz en la fotografía de productos",
        ],
    },
    {
        "key": "boudoir",
        "title": "Workshop Boudoir",
        "slug": "workshop-boudoir",
        "level": "Intermedio",
        "short": "Sensualidad, elegancia e intimidad: el workshop de boudoir de Andrea Defagot, grabado.",
        "long": (
            "Boudoir viene del francés «tocador»: un estilo de retrato donde la sensualidad y la "
            "belleza son protagonistas. En este workshop Andrea comparte cómo trabaja su especialidad.\n\n"
            "**Qué vas a ver**\n"
            "- El concepto: por qué y para qué hacer boudoir\n"
            "- La empatía y la conexión entre fotógrafa y modelo\n"
            "- El mood: espacio, locación, ambientación, escenografía y vestuario\n"
            "- Técnica, iluminación y uso estratégico del color\n"
            "- Cómo guiar a la modelo y las poses\n\n"
            "Incluye el material del workshop en PDF."
        ),
        "lessons": ["Workshop Boudoir"],
    },
]


def main():
    keys = {}
    for line in open(sys.argv[1], encoding="utf-8"):
        k, b, key, size = line.rstrip("\n").split("|")
        n = int(b.split(" ")[0])
        keys.setdefault(k, []).append((n, b, key, int(size)))

    out = ["BEGIN;"]
    out.append(insert("Workspace", {"id": WS, "name": "F64 Productora", "updatedAt": "now"}).replace("'now'", "now()"))
    out.append(
        insert(
            "FotofficeWorkspaceBranding",
            {
                "id": "br_f64",
                "workspaceId": WS,
                "publicSlug": SLUG,
                "commercialName": "F64 Productora",
                "logoUrl": f"{R2}/fotoffice/sitio/f64/logo-f64-dorado.png",
                "coverImageUrl": f"{R2}/fotoffice/sitio/f64/portada-sitio-f64-v2.jpg",
                "faviconUrl": f"{R2}/fotoffice/sitio/f64/favicon-f64.png",
                "contactEmail": "hola@andreadefagot.ar",
                "phone": "3492417703",
                "whatsapp": WA,
                "instagram": "f64productora",
                "website": "https://andreadefagot.ar",
                "primaryColor": "#d2a626",
                "secondaryColor": "#f7f3ec",
                "backgroundColor": "#2b2c2d",
                "textColor": "#f7f3ec",
                "accentColor": "#d2a626",
                "panelColor": "#d2a626",
                "activityType": "EDUCATIONAL_INSTITUTION",
                "organizationType": "local",
                "city": "Rafaela",
                "province": "Santa Fe",
                "country": "Argentina",
                "shortDescription": "Formación, producción y encuentros en fotografía. Una forma de mirar. Un lugar para compartir.",
                "updatedAt": "now",
                "onboardingCompletedAt": "now",
            },
        ).replace("'now'", "now()")
    )
    out.append(insert("Membership", {"id": "mb_f64_owner", "userId": 4, "workspaceId": WS, "role": "ADMIN"}))
    out.append(
        insert(
            "WorkspaceMembership",
            {"id": "wm_f64_owner", "userId": 4, "workspaceId": WS, "role": "WORKSPACE_OWNER", "updatedAt": "now"},
        ).replace("'now'", "now()")
    )
    for m in ["website", "courses-sales", "clients", "communications", "reports", "sales", "cash"]:
        out.append(
            insert(
                "WorkspaceFeatureModule",
                {"id": f"wfm_f64_{m}", "workspaceId": WS, "moduleKey": m, "enabled": True, "updatedAt": "now"},
            ).replace("'now'", "now()")
        )
    out.append(
        insert(
            "CourseSalesWorkspaceSettings",
            {"id": "css_f64", "workspaceId": WS, "enrollmentCtaLabel": "Quiero este curso", "updatedAt": "now"},
            conflict="workspaceId",
        ).replace("'now'", "now()")
    )

    cards = []
    for c in CURSOS:
        cid = f"crs_f64_{c['key']}"
        cover = f"{R2}/fotoffice/courses/{cid}/portada-{c['key']}-v2.jpg"
        out.append(
            insert(
                "Course",
                {
                    "id": cid,
                    "workspaceId": WS,
                    "title": c["title"],
                    "slug": c["slug"],
                    "shortDescription": c["short"],
                    "longDescription": c["long"],
                    "coverImageUrl": cover,
                    "thumbnailImageUrl": cover,
                    "instructorName": "Andrea Defagot — F64 Productora",
                    "level": c["level"],
                    "status": "DRAFT",
                    "deliveryMode": "RECORDED",
                    "priceArs": None,
                    "accessMonths": 12,
                    "updatedAt": "now",
                },
            ).replace("'now'", "now()")
        )
        pdfs = sorted(keys.get(c["key"], []))
        for i, title in enumerate(c["lessons"], start=1):
            lid = f"les_f64_{c['key']}_{i:02d}"
            out.append(
                insert(
                    "CourseLesson",
                    {
                        "id": lid,
                        "courseId": cid,
                        "title": title,
                        "sortOrder": i,
                        "isPreview": False,
                        "updatedAt": "now",
                    },
                ).replace("'now'", "now()")
            )
            # Material: el PDF con el mismo número. El 00 de productos (material completo) va al módulo 1.
            for n, b, key, size in pdfs:
                if n == i or (n == 0 and i == 1):
                    nombre = b.split(" ", 1)[1].strip()
                    out.append(
                        insert(
                            "CourseLessonAttachment",
                            {
                                "id": f"att_f64_{c['key']}_{n:02d}",
                                "lessonId": lid,
                                "fileName": nombre,
                                "storageKey": key,
                                "sizeBytes": size,
                            },
                        )
                    )
        cards.append(
            {
                "id": c["key"],
                "imageUrl": cover,
                "badge": "Grabado",
                "title": c["title"],
                "text": c["short"],
                "buttonLabel": "Ver el curso",
                "buttonUrl": f"/w/{SLUG}/cursos/{c['slug']}",
            }
        )

    sections = {
        "pages": {
            "home": [
                {
                    "id": "hero-001",
                    "type": "HERO",
                    "order": 0,
                    "visible": True,
                    "config": {
                        "loop": False,
                        "autoplay": False,
                        "intervalMs": 5000,
                        "showArrows": False,
                        "showIndicators": False,
                        "pauseOnHover": True,
                        "transition": "fade",
                        "heightPreset": "screen",
                        "slides": [
                            {
                                "id": "s1",
                                "align": "left",
                                "contentPosition": "left",
                                "overlay": "none",
                                "title": "Una forma de mirar. Un lugar para compartir.",
                                "subtitle": "F64 Productora · Formación, producción y encuentros en fotografía, con Andrea Defagot.",
                                "imageUrl": f"{R2}/fotoffice/sitio/f64/portada-sitio-f64-v2.jpg",
                                "imageAlt": "Logo de F64 Productora",
                                "imageFocus": "center",
                                "showButton": True,
                                "buttonLabel": "Ver los cursos",
                                "buttonUrl": f"/w/{SLUG}/cursos",
                                "buttonStyle": "solid",
                            }
                        ],
                    },
                },
                {
                    "id": "rich_text-002",
                    "type": "RICH_TEXT",
                    "order": 1,
                    "visible": True,
                    "config": {
                        "title": "Crear imágenes con intención",
                        "align": "center",
                        "width": "normal",
                        "html": (
                            "<p>F64 es un espacio de formación, producción y encuentro en fotografía. "
                            "Enseñamos a desarrollar una mirada propia, en un ambiente cálido, donde importan "
                            "las buenas relaciones humanas tanto como la técnica.</p>"
                            "<p><strong>Formación · Servicios fotográficos · Eventos y comunidad</strong></p>"
                        ),
                    },
                },
                {
                    "id": "cards-003",
                    "type": "CARDS",
                    "order": 2,
                    "visible": True,
                    "config": {
                        "title": "Cursos grabados",
                        "intro": "Mirá las clases cuando quieras, a tu ritmo, con el material de cada clase en PDF.",
                        "items": cards,
                    },
                },
                {
                    "id": "rich_text-004",
                    "type": "RICH_TEXT",
                    "order": 3,
                    "visible": True,
                    "config": {
                        "title": "Sobre Andrea Defagot",
                        "align": "center",
                        "width": "normal",
                        "html": (
                            "<p>Artista visual, fotógrafa y retratista de mujeres. Directora creativa de F64 Productora, "
                            "docente y organizadora del congreso Rafaela en Foco.</p>"
                        ),
                    },
                },
                {
                    "id": "contacto",
                    "type": "WHATSAPP_BUTTON",
                    "order": 4,
                    "visible": True,
                    "config": {
                        "title": "¿Tenés dudas sobre un curso?",
                        "text": "Escribinos y te ayudamos a elegir.",
                        "phone": WA,
                        "style": "solid",
                        "message": "Hola, quería hacer una consulta sobre los cursos de F64",
                        "buttonLabel": "WhatsApp",
                    },
                },
            ]
        },
        "pageMeta": {},
    }
    nav = {
        "version": 2,
        "items": [{"id": "page:home", "kind": "page", "page": "home", "label": "Inicio", "hidden": False}],
    }
    design = {
        "menuSide": "right",
        "logoSizePx": 64,
        "menuLayout": "topbar",
        "buttonPreset": "square",
        "footerPreset": "columns",
        "headerPreset": "logo-left",
        "animationPreset": "soft",
        "showLoginButton": True,
        "loginButtonLabel": "Iniciar sesión",
        "typographyPreset": "editorial",
        "siteSettings": {
            "seo": {
                "keywords": ["cursos de fotografía", "Andrea Defagot", "F64 Productora", "Rafaela", "boudoir", "iluminación"],
                "shareImageUrl": f"{R2}/fotoffice/sitio/f64/portada-sitio-f64-v2.jpg",
                "googleVerification": None,
            },
            "analytics": {"ga4Id": None, "metaPixelId": None},
            "socialLinks": [
                {"url": "https://www.instagram.com/f64productora", "network": "instagram"},
                {"url": "https://www.instagram.com/andrea_defagot", "network": "instagram"},
            ],
            "whatsappButton": {
                "side": "right",
                "size": "md",
                "number": WA,
                "enabled": True,
                "chatText": "Hola, quería hacer una consulta sobre los cursos de F64",
                "welcomeMessage": "¡Hola! ¿En qué te ayudamos?",
            },
            "photoProtection": {"enabled": False},
        },
    }
    out.append(
        insert(
            "FotofficeWorkspaceWebsite",
            {
                "id": "web_f64",
                "workspaceId": WS,
                "heroTitle": "F64 Productora",
                "heroSubtitle": "Una forma de mirar. Un lugar para compartir.",
                "seoTitle": "F64 Productora · Cursos de fotografía con Andrea Defagot",
                "seoDescription": "Cursos grabados de fotografía de F64 Productora y Andrea Defagot: fotografía inicial, iluminación, fotografía de productos y boudoir.",
                "navJson": nav,
                "sectionsJson": sections,
                "designPresetsJson": design,
                "updatedAt": "now",
            },
        ).replace("'now'", "now()")
    )
    out.append("COMMIT;")
    print("\n".join(out))


main()
