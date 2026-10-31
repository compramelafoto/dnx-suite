// Link de referidos de DNX Suite: www.dnx-suite.com/?ref=CODIGO.
// El portal recuerda el código (30 días) y lo agrega a los links hacia cada herramienta,
// para que quede registrado quién refirió a la persona donde sea que cree su cuenta.
// ComprameLaFoto lo recibe como ?ref= (su programa de siempre); el resto como ?dnx_ref=,
// porque Clickatón ya usa ?ref= para su propio programa.
(function () {
  var CLAVE = "dnx_ref";
  var DIAS = 30;
  var CLF = /(^|\.)compramelafoto\.com$/;

  function normalizar(valor) {
    var codigo = String(valor || "").trim().toUpperCase();
    return /^[A-Z0-9_-]{3,40}$/.test(codigo) ? codigo : null;
  }

  function leerGuardado() {
    try {
      var dato = JSON.parse(localStorage.getItem(CLAVE) || "null");
      if (dato && dato.vence > Date.now()) return normalizar(dato.codigo);
    } catch (e) {}
    return null;
  }

  function guardar(codigo) {
    try {
      localStorage.setItem(CLAVE, JSON.stringify({ codigo: codigo, vence: Date.now() + DIAS * 864e5 }));
    } catch (e) {}
  }

  var params = new URLSearchParams(location.search);
  // El primer link gana, igual que en ComprameLaFoto y Clickatón.
  var codigo = leerGuardado();
  if (!codigo) {
    codigo = normalizar(params.get("ref") || params.get(CLAVE));
    if (codigo) guardar(codigo);
  }
  if (!codigo) return;

  document.querySelectorAll("a[href^='http']").forEach(function (a) {
    var url;
    try {
      url = new URL(a.href);
    } catch (e) {
      return;
    }
    if (url.hostname === location.hostname) return;
    url.searchParams.set(CLF.test(url.hostname) ? "ref" : CLAVE, codigo);
    a.href = url.toString();
  });
})();
