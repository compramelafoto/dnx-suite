import { describe, expect, it } from "vitest";
import { atributo, buscar, buscarTodos, decodificarEntidades, htmlInterno, parsearHtml, textoDe } from "./dom";

describe("parsearHtml", () => {
  it("arma el árbol con atributos con y sin comillas, y elementos vacíos", () => {
    const raiz = parsearHtml(`<div class="a b" id=x data-v='1 > 2'><img src="f.jpg"><br/><p>hola <b>mundo</b></p></div>`);
    const div = buscar(raiz, "div#x.a.b");
    expect(div).not.toBeNull();
    expect(atributo(div, "data-v")).toBe("1 > 2");
    expect(buscar(raiz, "img")?.attrs.src).toBe("f.jpg");
    expect(textoDe(buscar(raiz, "p"))).toBe("hola mundo");
  });

  it("el contenido de script y style es texto, no etiquetas", () => {
    const raiz = parsearHtml(`<script>if (a < b) { x = "<div class='no'>" }</script><div class="si">ok</div>`);
    expect(buscarTodos(raiz, "div")).toHaveLength(1);
    expect(textoDe(raiz)).toBe("ok");
  });

  it("tolera etiquetas mal cerradas: un </article> cierra lo que quedó abierto adentro", () => {
    const raiz = parsearHtml(`<article><div class="c"><p>uno</div></article><p class="fuera">dos</p>`);
    expect(buscar(raiz, "article .fuera")).toBeNull();
    expect(textoDe(buscar(raiz, "p.fuera"))).toBe("dos");
  });

  it("un <p> nuevo cierra el anterior, y un </p> suelto no rompe nada", () => {
    const raiz = parsearHtml(`<div><p><p>a</p></p><p>b</div>`);
    expect(buscarTodos(raiz, "div > p").map((p) => textoDe(p))).toEqual(["", "a", "b"]);
  });

  it("htmlInterno devuelve el HTML original de adentro, tal cual", () => {
    const html = `<div class="post_content"><p>Hola <a href="x">link</a></p><p><br></p>  </div><div>otro</div>`;
    expect(htmlInterno(buscar(parsearHtml(html), ".post_content"), html)).toBe(`<p>Hola <a href="x">link</a></p><p><br></p>  `);
  });

  it("selectores: descendiente, hijo directo, atributo con y sin valor, varias opciones", () => {
    const raiz = parsearHtml(`<ul><li><a data-is-video="false" href="1">x</a></li><li><span><a data-is-video="true" href="2">y</a></span></li></ul>`);
    expect(buscarTodos(raiz, `a[data-is-video="false"]`).map((a) => a.attrs.href)).toEqual(["1"]);
    expect(buscarTodos(raiz, "li > a").map((a) => a.attrs.href)).toEqual(["1"]);
    expect(buscarTodos(raiz, "ul a[href]")).toHaveLength(2);
    expect(buscarTodos(raiz, "span, li > a")).toHaveLength(2);
  });

  it("comentarios y doctype no generan nodos", () => {
    const raiz = parsearHtml(`<!DOCTYPE html><!-- <div>no</div> --><div>sí</div>`);
    expect(buscarTodos(raiz, "div")).toHaveLength(1);
  });
});

describe("decodificarEntidades", () => {
  it("nombradas, decimales y hexadecimales (incluye emojis)", () => {
    expect(decodificarEntidades("a&amp;b &aacute; &nbsp;&#x1F4F8; &#39;x&#39; &ntilde;")).toBe("a&b á  📸 'x' ñ");
    expect(decodificarEntidades("&desconocida;")).toBe("&desconocida;");
  });
});
