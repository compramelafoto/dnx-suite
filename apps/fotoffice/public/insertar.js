/*
 * FOTOFFICE — alto automático de los formularios insertados.
 *
 * Opcional: se pega junto al <iframe data-fotoffice-form ...>. El formulario avisa cuánto mide
 * ({ type: "fotoffice-form-height", height }) y este script le pone ese alto al marco, así no
 * quedan barras de desplazamiento ni espacio en blanco. Sin este script el marco igual funciona,
 * con su alto fijo.
 *
 * Sólo obedece el aviso si viene del marco que lo mandó (event.source) y desde el mismo origen
 * que el `src` de ese marco: otra página no puede agrandar ni achicar el formulario.
 */
(function () {
  if (window.__fotofficeInsertar) return;
  window.__fotofficeInsertar = true;

  var ALTO_MAXIMO = 20000;

  function origenDe(src) {
    try {
      return new URL(src, window.location.href).origin;
    } catch (e) {
      return null;
    }
  }

  window.addEventListener("message", function (event) {
    var datos = event.data;
    if (!datos || typeof datos !== "object" || datos.type !== "fotoffice-form-height") return;
    var alto = Number(datos.height);
    if (!isFinite(alto) || alto <= 0) return;

    var marcos = document.querySelectorAll("iframe[data-fotoffice-form]");
    for (var i = 0; i < marcos.length; i++) {
      var marco = marcos[i];
      if (marco.contentWindow !== event.source) continue;
      if (origenDe(marco.getAttribute("src") || marco.src) !== event.origin) return;
      marco.style.height = Math.max(100, Math.min(Math.ceil(alto), ALTO_MAXIMO)) + "px";
      return;
    }
  });
})();
