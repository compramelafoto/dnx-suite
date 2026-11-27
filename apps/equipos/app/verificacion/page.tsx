import { Boton, Pagina } from "@/app/_ui";

export const dynamic = "force-dynamic";

export default function VerificacionPage() {
  return (
    <Pagina
      titulo="Verificá tu identidad"
      bajada="Paso 3 de 3. Para dar este paso vamos a pedirte una foto de tu DNI y una imagen de tu rostro. Las procesa un proveedor externo de verificación de identidad."
      volver={{ href: "/cuenta/verificacion", texto: "Mi verificación" }}
    >
      <form method="post" action="/api/identidad/iniciar" className="superficie formulario">
        <section className="pila" aria-labelledby="consentimiento">
          <h2 id="consentimiento">Consentimiento para el tratamiento de datos biométricos</h2>
          <ul className="lista-texto">
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
        </section>
        <label className="opcion">
          <input type="checkbox" name="consent" required />
          <span className="opcion-texto">
            Leí y acepto el tratamiento de mis datos biométricos para verificar mi identidad.
          </span>
        </label>
        <div className="acciones">
          <Boton>Continuar a la verificación</Boton>
        </div>
      </form>
    </Pagina>
  );
}
