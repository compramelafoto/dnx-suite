// En el centro del diafragma aparece el nombre de la hoja apuntada, y las
// demás hojas se apagan.
(function () {
  var grupo = document.querySelector(".hojas");
  var centro = document.querySelector(".diafragma-centro span");
  if (!grupo || !centro) return;
  var inicial = centro.textContent;
  grupo.querySelectorAll(".hoja").forEach(function (hoja) {
    function mostrar() {
      grupo.querySelectorAll(".activa").forEach(function (otra) {
        otra.classList.remove("activa");
      });
      hoja.classList.add("activa");
      grupo.classList.add("apuntando");
      centro.textContent = hoja.dataset.nombre;
      centro.style.color = hoja.dataset.color;
    }
    function volver() {
      hoja.classList.remove("activa");
      grupo.classList.remove("apuntando");
      centro.textContent = inicial;
      centro.style.color = "";
    }
    hoja.addEventListener("mouseenter", mostrar);
    hoja.addEventListener("focus", mostrar);
    hoja.addEventListener("mouseleave", volver);
    hoja.addEventListener("blur", volver);
  });
})();
