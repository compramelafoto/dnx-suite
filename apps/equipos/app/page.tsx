import { Boton } from "./_ui";

const CAMINOS = [
  {
    titulo: "Comprar",
    texto:
      "Cada publicación muestra qué comprobó el portal y qué declara el vendedor, por separado. Todos los vendedores verificaron su identidad.",
    enlace: { href: "/equipos", texto: "Ver equipos en venta" },
  },
  {
    titulo: "Vender",
    texto:
      "Cargá tu equipo con su número de serie, fotos y factura. Cuantos más datos comprobamos, más alto queda tu nivel de confianza.",
    enlace: { href: "/mis-publicaciones", texto: "Mis publicaciones" },
  },
  {
    titulo: "Consultar una serie",
    texto:
      "Antes de comprar en cualquier lado, fijate si el número de serie tiene una denuncia de robo o pérdida activa.",
    enlace: { href: "/consultar-serie", texto: "Consultar una serie" },
  },
];

export default function Home() {
  return (
    <main id="contenido" className="pagina pagina-ancha">
      <section className="portada" aria-labelledby="promesa">
        <h1 id="promesa" className="portada-titulo">
          Equipos usados de fotógrafos con identidad verificada
        </h1>
        <p className="pagina-bajada">
          Cada equipo tiene sus papeles: quién lo vende, de dónde viene y qué datos pudimos comprobar.
        </p>
        <form className="buscador" action="/equipos" method="get" role="search">
          <label className="campo-etiqueta" htmlFor="buscar-marca">
            Buscar por marca
          </label>
          <div className="buscador-fila">
            <input
              id="buscar-marca"
              className="control"
              name="make"
              type="search"
              placeholder="Canon, Nikon, Sony, Fujifilm"
              autoComplete="off"
            />
            <Boton>Buscar equipos</Boton>
          </div>
        </form>
      </section>

      <ul className="caminos">
        {CAMINOS.map((c) => (
          <li key={c.titulo} className="camino">
            <h2>{c.titulo}</h2>
            <p className="texto-secundario">{c.texto}</p>
            <a className="camino-enlace" href={c.enlace.href}>
              {c.enlace.texto}
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
