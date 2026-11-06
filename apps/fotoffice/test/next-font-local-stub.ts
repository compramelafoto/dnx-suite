// `next/font/local` lo resuelve el compilador de Next en el build; en vitest no existe. Este stub
// devuelve la misma forma (className, variable, style) para que los módulos que importan una
// letra local se puedan probar.
export default function localFont(options: { variable?: string }) {
  return { className: "stub-font", variable: options.variable ? "stub-font-variable" : "", style: { fontFamily: "stub" } };
}
