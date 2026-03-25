"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";

type Lab = {
  id: number;
  name: string;
  secondaryColor: string | null;
};

export default function LabPublicFooter({ lab }: { lab: Lab }) {
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactData, setContactData] = useState({
    name: "",
    email: "",
    message: "",
    role: "",
  });
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentFileName, setDocumentFileName] = useState<string>("");

  // Cerrar modal de contacto con ESC
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && showContactForm) {
        setShowContactForm(false);
        setContactError(null);
        setContactSuccess(false);
      }
    }
    if (showContactForm) {
      window.addEventListener("keydown", handleEscape);
      return () => window.removeEventListener("keydown", handleEscape);
    }
  }, [showContactForm]);

  async function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault();
    setContactError(null);
    setContactLoading(true);

    try {
      const formData = new FormData();
      formData.append("name", contactData.name);
      formData.append("email", contactData.email);
      formData.append("message", contactData.message);
      if (contactData.role) {
        formData.append("role", contactData.role);
      }
      formData.append("labId", lab.id.toString());
      if (documentFile) {
        formData.append("document", documentFile);
      }

      const res = await fetch("/api/contact", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error enviando mensaje");

      setContactSuccess(true);
      setContactData({ name: "", email: "", message: "", role: "" });
      setDocumentFile(null);
      setDocumentFileName("");
      setTimeout(() => {
        setShowContactForm(false);
        setContactSuccess(false);
      }, 3000);
    } catch (err: any) {
      setContactError(err?.message || "Error enviando mensaje");
    } finally {
      setContactLoading(false);
    }
  }

  const bgColor = lab.secondaryColor || "#2d2d2d";

  return (
    <>
      <footer
        className="text-white py-8 md:py-10"
        style={{ backgroundColor: bgColor }}
      >
        <div className="container-custom">
          <div className="flex flex-col items-center justify-center space-y-4">
            <Image
              src="/watermark.png"
              alt="ComprameLaFoto"
              width={180}
              height={54}
              className="h-12 md:h-[2.5rem] w-auto opacity-90"
            />
            <p className="text-sm md:text-base text-white/70">
              creado por ComprameLaFoto
            </p>
          </div>
        </div>
      </footer>
      {/* Link debajo del footer */}
      <div className="bg-white py-4 text-center">
        <button
          onClick={() => setShowContactForm(true)}
          className="text-[#6b7280] hover:text-[#1a1a1a] text-sm underline transition-colors"
          style={{
            wordBreak: "normal",
            overflowWrap: "normal",
            whiteSpace: "normal",
          }}
        >
          Trabajá con nosotros
        </button>
      </div>

      {/* Modal de contacto */}
      {showContactForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card
            className="max-h-[90vh] overflow-y-auto"
            style={{
              width: "100%",
              maxWidth: "600px",
              wordBreak: "normal",
              overflowWrap: "normal",
            }}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-medium text-[#1a1a1a]">
                Trabajá con nosotros
              </h2>
              <button
                onClick={() => {
                  setShowContactForm(false);
                  setContactError(null);
                  setContactSuccess(false);
                }}
                className="text-[#6b7280] hover:text-[#1a1a1a]"
              >
                ✕
              </button>
            </div>

            {contactSuccess ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">✅</div>
                <p className="text-[#10b981] font-medium">
                  ¡Mensaje enviado correctamente!
                </p>
                <p className="text-sm text-[#6b7280] mt-2">
                  Te contactaremos pronto.
                </p>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="space-y-4">
                {contactError && (
                  <div className="bg-[#ef4444]/10 border border-[#ef4444] rounded-lg p-3">
                    <p className="text-[#ef4444] text-sm">{contactError}</p>
                  </div>
                )}

                <div>
                  <label htmlFor="lab-footer-contact-name" className="block text-sm font-medium text-[#1a1a1a] mb-2">
                    Nombre *
                  </label>
                  <Input
                    id="lab-footer-contact-name"
                    type="text"
                    placeholder="Tu nombre"
                    value={contactData.name}
                    onChange={(e) =>
                      setContactData({ ...contactData, name: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <label htmlFor="lab-footer-contact-email" className="block text-sm font-medium text-[#1a1a1a] mb-2">
                    Email *
                  </label>
                  <Input
                    id="lab-footer-contact-email"
                    type="email"
                    placeholder="tu@email.com"
                    value={contactData.email}
                    onChange={(e) =>
                      setContactData({ ...contactData, email: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <label htmlFor="lab-footer-contact-role" className="block text-sm font-medium text-[#1a1a1a] mb-2">
                    ¿Qué rol cumplís? *
                  </label>
                  <select
                    id="lab-footer-contact-role"
                    className="w-full px-4 py-3 border border-[#e5e7eb] rounded-lg text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#c27b3d] focus:border-transparent transition-all duration-200"
                    value={contactData.role}
                    onChange={(e) =>
                      setContactData({ ...contactData, role: e.target.value })
                    }
                    required
                  >
                    <option value="">Seleccioná una opción</option>
                    <option value="fotografo">Soy fotógrafo</option>
                    <option value="laboratorio">Tengo un laboratorio</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="lab-footer-contact-message" className="block text-sm font-medium text-[#1a1a1a] mb-2">
                    Mensaje *
                  </label>
                  <textarea
                    id="lab-footer-contact-message"
                    className="w-full px-4 py-3 border border-[#e5e7eb] rounded-lg text-[#1a1a1a] placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-[#c27b3d] focus:border-transparent transition-all duration-200"
                    rows={5}
                    placeholder="Contanos sobre tu proyecto o consulta..."
                    value={contactData.message}
                    onChange={(e) =>
                      setContactData({ ...contactData, message: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <label htmlFor="document-upload-lab" className="block text-sm font-medium text-[#1a1a1a] mb-2">
                    Documento o CV (opcional)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      id="document-upload-lab"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setDocumentFile(file);
                        setDocumentFileName(file ? file.name : "");
                      }}
                      className="hidden"
                    />
                    <label
                      htmlFor="document-upload-lab"
                      className="flex-1 px-4 py-3 border border-[#e5e7eb] rounded-lg text-[#1a1a1a] cursor-pointer hover:bg-gray-50 transition-colors text-sm"
                    >
                      {documentFileName || "Seleccionar archivo"}
                    </label>
                    {documentFileName && (
                      <button
                        type="button"
                        onClick={() => {
                          setDocumentFile(null);
                          setDocumentFileName("");
                          const input = document.getElementById("document-upload-lab") as HTMLInputElement;
                          if (input) input.value = "";
                        }}
                        className="text-[#ef4444] hover:text-[#dc2626] text-sm"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-[#6b7280] mt-1">
                    Formatos aceptados: PDF, DOC, DOCX, JPG, PNG
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowContactForm(false);
                      setContactError(null);
                    }}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={contactLoading}
                    className="flex-1"
                  >
                    {contactLoading ? "Enviando..." : "Enviar"}
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
