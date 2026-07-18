export function runTelegramChecklist(): {
  exitCode: number;
  lines: string[];
} {
  const lines = [
    "DNX telegram:checklist",
    "",
    "- [ ] Crear bot en @BotFather (privado)",
    "- [ ] Guardar token en apps/dnx-sales-assistant/.env.local (DNX_TELEGRAM_BOT_TOKEN)",
    "- [ ] DNX_TELEGRAM_ENABLED=true",
    "- [ ] DNX_TELEGRAM_TRANSPORT=polling",
    "- [ ] Ejecutar telegram:pair y enviar /vincular desde Telegram",
    "- [ ] Configurar DNX_TELEGRAM_ALLOWED_USER_IDS",
    "- [ ] Configurar DNX_TELEGRAM_ALLOWED_CHAT_IDS",
    "- [ ] telegram:validate → OK",
    "- [ ] DNX_OWNER_EMAIL=dnxfotografia@gmail.com",
    "- [ ] DNX_TELEGRAM_OWNER_USER_ID / DNX_TELEGRAM_OWNER_CHAT_ID (mismo dueño)",
    "- [ ] owner-profile:checklist → perfil económico real (sin sintéticos)",
    "- [ ] Archivo .local (no .example.json) para perfil y plantillas",
    "- [ ] telegram:start y probar /inicio",
    "- [ ] /presupuesto sin perfil → bloqueo (sin importes de prueba)",
    "- [ ] No versionar .env.local ni .local/telegram/",
    "",
    "Durante esta etapa Telegram se ejecuta mediante long polling en la computadora local.",
    "El bot sólo funciona mientras el proceso telegram:start esté encendido.",
    "",
    "Telegram es el canal principal para Dani. El laboratorio web continúa siendo una herramienta técnica secundaria.",
    "",
    "La autorización para utilizar el bot de Telegram no determina por sí sola qué perfil económico debe utilizar Cuánto Cobro.",
    "Los perfiles sintéticos existen únicamente para pruebas automatizadas y nunca pueden producir un presupuesto operativo para Dani.",
    "Si el perfil real no está disponible, el asistente debe bloquear el cálculo en lugar de inventar o sustituir valores.",
  ];
  return { exitCode: 0, lines };
}
