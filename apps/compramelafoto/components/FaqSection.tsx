"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Link from "next/link";

export type FaqCategory = {
  title: string;
  items: { q: string; a: string }[];
};

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    title: "General",
    items: [
      {
        q: "¿Para qué sirve ComprameLaFoto?",
        a: "ComprameLaFoto es una plataforma que permite a fotógrafos vender fotos online de forma simple y automatizada, sin tener que mandar links manuales ni coordinar pagos uno por uno.",
      },
      {
        q: "¿Tengo que pagar algo para usar la plataforma?",
        a: "Registrarse y crear álbumes no tiene costo. ComprameLaFoto cobra una comisión únicamente cuando realizás una venta.",
      },
      {
        q: "¿Qué tipo de trabajos puedo vender?",
        a: "Fotos de eventos deportivos, sociales, escolares, recitales, sesiones privadas y cualquier cobertura donde el fotógrafo tenga derecho a comercializar sus imágenes.",
      },
      {
        q: "¿Mis fotos quedan públicas en internet?",
        a: "No necesariamente. Vos decidís si un álbum es público o privado y quién puede acceder.",
      },
    ],
  },
  {
    title: "Precios, comisiones y descuentos",
    items: [
      {
        q: "¿Quién decide el precio de las fotos?",
        a: "El fotógrafo (o el organizador de la cobertura, según cómo se configure el álbum) define los precios. La plataforma no fija precios por vos.",
      },
      {
        q: "¿Puedo hacer descuentos por cantidad de fotos?",
        a: "Sí, se pueden armar promos por volumen (por ejemplo: 3, 5 o 10 fotos) o cupones, según las opciones activas en tu cuenta.",
      },
      {
        q: "¿Puedo poner combos (digital + impresa) o packs?",
        a: "Sí, podés ofrecer packs para simplificar la compra (por ejemplo: “digital + impresa”), según las opciones activas en tu cuenta.",
      },
      {
        q: "¿El dinero lo cobro yo o la plataforma?",
        a: "El pago se realiza a través de Mercado Pago y el dinero se acredita en la cuenta configurada. ComprameLaFoto aplica su comisión según el plan/configuración.",
      },
      {
        q: "¿Se puede extender el tiempo que las fotos permanecen en el servidor?",
        a: "Sí. Se puede configurar un tiempo mayor de disponibilidad. En general tiene costo adicional de almacenamiento y/o aumenta la comisión del plan, porque implica más recursos y espacio.",
      },
      {
        q: "¿Cuánto tiempo quedan las fotos disponibles?",
        a: "Depende de la configuración del álbum/plan. En muchos casos se usa una ventana limitada para incentivar la compra.",
      },
    ],
  },
  {
    title: "Derechos (imagen / autor / propiedad)",
    items: [
      {
        q: "¿Qué pasa con el derecho de autor de las fotos?",
        a: "El derecho de autor normalmente es del fotógrafo que realizó la imagen (salvo acuerdos específicos). La plataforma no cambia esa titularidad: actúa como medio de exhibición y venta.",
      },
      {
        q: "¿Qué pasa con el derecho de imagen de las personas fotografiadas?",
        a: "Según el contexto (evento privado, menores, etc.), puede ser necesario consentimiento para publicar o comercializar. En general, quien organiza la cobertura y el fotógrafo son quienes deben gestionar esos permisos cuando corresponde.",
      },
      {
        q: "¿Qué pasa si el evento es en un lugar privado (propiedad privada)?",
        a: "Algunos lugares (club, salón, escuela, predio) tienen reglas propias. Si el evento se hace ahí, es importante que la cobertura y la venta estén autorizadas por quien corresponda.",
      },
      {
        q: "¿Comprando una foto, el cliente compra el derecho de autor?",
        a: "No. Comprar una copia (digital o impresa) no transfiere el derecho de autor. El comprador adquiere el acceso a esa copia para uso personal, salvo que se indique otra cosa.",
      },
    ],
  },
  {
    title: "Privacidad y remoción de imágenes",
    items: [
      {
        q: "¿Qué pasa si no quiero que aparezca mi foto en ninguna galería?",
        a: "Podés pedir la remoción. Se revisa el caso y se retira la imagen del álbum si corresponde.",
      },
      {
        q: "¿Cómo pido la remoción de una foto?",
        a: "Enviá un mensaje por el canal oficial de soporte con: link del álbum, número/nombre de la foto (si aparece), captura de pantalla y tu pedido de remoción. El equipo lo deriva al fotógrafo/administrador del álbum para resolverlo.",
      },
      {
        q: "¿Pueden ocultar una foto sin borrar todo el álbum?",
        a: "Sí. Se puede despublicar una imagen puntual o restringir el acceso, según permisos del álbum.",
      },
    ],
  },
  {
    title: "Compra, entrega y formatos (digital / impresa)",
    items: [
      {
        q: "¿Puedo vender fotos digitales e impresas?",
        a: "Sí. Podés vender digitales y también impresas si tenés activada la opción de laboratorio/impresión.",
      },
      {
        q: "Si el cliente compra la copia impresa, ¿puedo enviarle también la digital?",
        a: "Sí, podés ofrecerlo como pack “impresa + digital” o como beneficio adicional, según cómo lo configures. Lo ideal es que quede claro antes de la compra qué incluye cada opción.",
      },
      {
        q: "¿El cliente puede pedir impresiones subiendo sus propias fotos (que él sacó)?",
        a: "Sí. Existe un flujo de “pedido de impresión” donde el cliente sube sus archivos, elige tamaños/cantidades y paga. En ese caso, el cliente debe contar con permisos sobre esas imágenes para imprimirlas.",
      },
      {
        q: "¿Cómo funciona un pedido de impresiones en el sistema?",
        a: "El cliente elige tamaños y cantidades, carga archivos (si corresponde), paga, y el pedido pasa a producción/estado “listo” o “enviado”, según la configuración.",
      },
      {
        q: "¿Qué calidad/resolución se recomienda para imprimir?",
        a: "Se recomienda subir archivos en buena resolución. Si el tamaño elegido no es compatible con la calidad del archivo, se recomienda optar por un tamaño menor.",
      },
    ],
  },
  {
    title: "Seguridad y cuentas",
    items: [
      {
        q: "¿Es seguro conectar mi cuenta de Mercado Pago?",
        a: "Sí. La conexión se realiza mediante el flujo oficial de Mercado Pago. La plataforma no ve tu contraseña y la conexión usa permisos técnicos para operar cobros dentro del flujo.",
      },
      {
        q: "¿Puedo desconectar Mercado Pago cuando quiera?",
        a: "Sí. Podés revocar permisos desde Mercado Pago o desde la configuración del sistema (si está disponible). Al desconectar, no se podrán procesar nuevas ventas hasta reconectar.",
      },
      {
        q: "¿La plataforma puede mover mi dinero?",
        a: "La plataforma no opera como un homebanking. Procesa cobros a través de Mercado Pago dentro del flujo de ventas de ComprameLaFoto, y la acreditación ocurre en la cuenta configurada.",
      },
    ],
  },
  {
    title: "Sistema de referidos",
    items: [
      {
        q: "¿Qué es el programa de referidos?",
        a: "Cualquier usuario de ComprameLaFoto (fotógrafo, laboratorio, organizador o cliente) puede recomendar con su link único. Solo cuando la persona referida es un fotógrafo que se registra y vende en la plataforma se generan comisiones: cobrás el 50% del fee de ComprameLaFoto por 12 meses desde su alta.",
      },
      {
        q: "¿Quién puede participar y quién genera comisiones?",
        a: "Podés recomendar si sos fotógrafo, laboratorio, organizador o cliente: cualquiera puede tener su link de referidos y compartirlo. Las comisiones solo se pagan cuando el referido es un fotógrafo que hace ventas. Para cobrar esas comisiones necesitás tener Mercado Pago conectado (los fotógrafos lo configuran en Configuración → Referidos).",
      },
      {
        q: "¿Cómo obtengo mi link de referidos?",
        a: "Los fotógrafos lo tienen en Configuración → Referidos (con Mercado Pago conectado podés generar o ver tu link). Laboratorios, organizadores y clientes pueden solicitar su link a soporte. Compartilo por WhatsApp, redes o email; quien se registre usando ese link queda asociado a tu código. Solo los fotógrafos referidos que venden generan comisión para vos.",
      },
      {
        q: "¿Cuándo cobro la comisión por un referido?",
        a: "Cobrás el 50% del fee de la plataforma en cada venta que haga un fotógrafo referido por vos, durante 12 meses desde su registro. Si en el momento de esa venta no tenés Mercado Pago conectado, esa comisión no se acumula ni se paga después.",
      },
      {
        q: "¿Cómo solicito el cobro de mis comisiones?",
        a: "Desde Configuración → Referidos podés ver tu saldo acumulado y solicitar el cobro cuando quieras (sujeto a un mínimo). El equipo de ComprameLaFoto procesa la solicitud y te paga por Mercado Pago o transferencia según lo configurado.",
      },
      {
        q: "¿Qué pasa si hay devolución o contracargo en una venta de mi referido?",
        a: "Si una venta se devuelve o tiene contracargo, la comisión que te correspondía por esa venta se revierte.",
      },
      {
        q: "¿Puedo referirme a mí mismo o usar cuentas duplicadas?",
        a: "No. No se permiten auto-referidos ni cuentas duplicadas para sumar comisiones. La plataforma se reserva el derecho de bloquear códigos en caso de abuso.",
      },
    ],
  },
  {
    title: "Soporte y problemas comunes",
    items: [
      {
        q: "¿Qué pasa si el cliente pagó y no le llegó el link?",
        a: "Puede tardar unos minutos. También conviene revisar spam/promociones. Si sigue sin llegar, se puede reenviar el acceso o contactar soporte.",
      },
      {
        q: "¿Qué hago si un cliente se equivocó de email?",
        a: "Contactá soporte con comprobante de pago y datos del pedido para corregir el acceso.",
      },
      {
        q: "¿Dónde pido ayuda?",
        a: "Desde la sección de contacto del sitio o por el canal oficial de soporte.",
      },
    ],
  },
];

export default function FaqSection() {
  const [openCategoryIndex, setOpenCategoryIndex] = useState<number | null>(null);
  const [openQuestionIndex, setOpenQuestionIndex] = useState<number | null>(null);

  const handleToggleCategory = (index: number) => {
    setOpenCategoryIndex((prev) => (prev === index ? null : index));
    setOpenQuestionIndex(null);
  };

  const handleToggleQuestion = (index: number) => {
    setOpenQuestionIndex((prev) => (prev === index ? null : index));
  };

  return (
    <section id="faq" className="section-spacing bg-white">
      <div className="container-custom">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-semibold text-[#1a1a1a] mb-3">
              Preguntas frecuentes
            </h2>
            <p className="text-lg text-[#6b7280]">
              Respondemos las dudas más comunes sobre la plataforma.
            </p>
          </div>

          <div className="space-y-4">
            {FAQ_CATEGORIES.map((category, categoryIndex) => {
              const isCategoryOpen = openCategoryIndex === categoryIndex;
              const categoryPanelId = `faq-category-panel-${categoryIndex}`;
              return (
                <Card key={category.title} className="border border-[#e5e7eb]">
                  <button
                    type="button"
                    className="w-full text-left px-5 py-4 flex items-center justify-between"
                    aria-expanded={isCategoryOpen}
                    aria-controls={categoryPanelId}
                    onClick={() => handleToggleCategory(categoryIndex)}
                  >
                    <h3 className="text-base md:text-lg font-semibold text-[#111827]">
                      {category.title}
                    </h3>
                    <span className="text-[#6b7280] text-xl">
                      {isCategoryOpen ? "−" : "+"}
                    </span>
                  </button>

                  {isCategoryOpen && (
                    <div id={categoryPanelId} className="px-5 pb-5">
                      <div className="space-y-3">
                        {category.items.map((item, questionIndex) => {
                          const isQuestionOpen = openQuestionIndex === questionIndex;
                          const questionPanelId = `faq-question-panel-${categoryIndex}-${questionIndex}`;
                          return (
                            <div
                              key={`${categoryIndex}-${questionIndex}`}
                              className="border border-[#e5e7eb] rounded-xl"
                            >
                              <button
                                type="button"
                                className="w-full text-left px-4 py-3 flex items-center justify-between"
                                aria-expanded={isQuestionOpen}
                                aria-controls={questionPanelId}
                                onClick={() => handleToggleQuestion(questionIndex)}
                              >
                                <span className="text-sm md:text-base font-medium text-[#1a1a1a]">
                                  {item.q}
                                </span>
                                <span className="text-[#6b7280] text-lg">
                                  {isQuestionOpen ? "−" : "+"}
                                </span>
                              </button>
                              {isQuestionOpen && (
                                <div
                                  id={questionPanelId}
                                  className="px-4 pb-4 text-sm text-[#4b5563]"
                                >
                                  {item.a}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          <div className="mt-10 text-center">
            <Card className="inline-block px-6 py-4 bg-[#f9fafb] border border-[#e5e7eb]">
              <p className="text-sm md:text-base text-[#1a1a1a]">
                ¿Te quedó alguna duda?{" "}
                <Link href="/#contacto" className="text-[#c27b3d] font-semibold underline">
                  Escribinos
                </Link>
              </p>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
