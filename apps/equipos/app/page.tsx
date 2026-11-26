export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <h1>Equipos verificados</h1>
      <p>
        <a href="/crear-cuenta">Crear cuenta</a> · <a href="/login">Iniciar sesión</a> ·{" "}
        <a href="/cuenta/verificacion">Mi verificación</a>
      </p>
    </main>
  );
}
