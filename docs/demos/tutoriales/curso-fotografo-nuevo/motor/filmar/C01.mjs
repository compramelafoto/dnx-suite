import { grabar } from "./lib.mjs";
// Registro sin sesión. No se toca «Crear cuenta» ni «Continuar con Google».
await grabar("C01", { sesion: false }, async (h) => {
  const p = h.p;
  await h.ir("/registro"); await h.esperar(500);
  await h.toma(1); await h.esperar(3000);
  await h.toma(2); await h.señalar("¿Cómo vas a usar ComprameLaFoto?", 1400); await h.señalar("Soy fotógrafo/a", 1800);
  await h.toma(3); const sel = p.locator("select").first(); await h.mover(sel); await sel.selectOption({ label: "Argentina" }).catch(() => sel.selectOption({ index: 1 }));
  await h.esperar(700); await h.señalar("Quiero recibir por correo novedades", 2000);
  await h.toma(4);
  await h.tipear(p.getByLabel("Nombre", { exact: true }), "Lucía");
  await h.tipear(p.getByLabel("Apellido", { exact: true }), "Gómez");
  await h.tipear(p.getByLabel("Email"), "lucia.gomez@ejemplo.com", 45);
  await h.tipear(p.locator("input[type=password]").nth(0), "fotos2026lg", 60);
  await h.tipear(p.locator("input[type=password]").nth(1), "fotos2026lg", 60);
  await h.señalar("Mínimo 8 caracteres", 1800);
  await h.toma(5); await h.clic(p.getByRole("checkbox").last()); await h.señalar(p.getByRole("button", { name: "Crear cuenta" }), 1800);
  await h.señalar("Continuar con Google", 2200);
  await h.toma(6); await h.esperar(1000);
  await h.toma(7); await h.esperar(1000);
});
