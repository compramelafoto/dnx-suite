export const dynamic = "force-dynamic";

export default function VerificacionPage() {
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <h1>Verificá tu identidad</h1>
      <p>
        Para dar este paso vamos a pedirte una foto de tu DNI y una imagen de tu rostro. Las
        procesa un proveedor externo de verificación de identidad.
      </p>
      <h2>Consentimiento para el tratamiento de datos biométricos</h2>
      <ul>
        <li>
          Las imágenes de tu DNI y de tu rostro las procesa el proveedor para comprobar que sos
          vos. DNX no las guarda.
        </li>
        <li>
          Sólo conservamos el resultado de la verificación, tu nombre según el DNI, una huella
          cifrada del número (para que nadie más use el mismo DNI) y sus últimos 3 dígitos.
        </li>
        <li>No usamos estos datos para vigilancia ni los cedemos a terceros con fines comerciales.</li>
        <li>Podés pedir que se eliminen tus datos escribiéndonos.</li>
      </ul>
      <form method="post" action="/api/identidad/iniciar">
        <label>
          <input type="checkbox" name="consent" required /> Leí y acepto el tratamiento de mis
          datos biométricos para verificar mi identidad.
        </label>
        <p>
          <button type="submit">Continuar a la verificación</button>
        </p>
      </form>
    </main>
  );
}
