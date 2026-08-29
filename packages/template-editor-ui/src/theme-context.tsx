"use client";

import {
  createContext,
  useContext,
  useMemo,
  type CSSProperties,
  type ReactNode,
} from "react";
import { editorThemeStyle, type TemplateEditorTheme } from "./theme";

const EditorThemeContext = createContext<TemplateEditorTheme | undefined>(undefined);

export function EditorThemeProvider({
  theme,
  children,
}: {
  theme?: TemplateEditorTheme;
  children: ReactNode;
}) {
  return <EditorThemeContext.Provider value={theme}>{children}</EditorThemeContext.Provider>;
}

/**
 * Las propiedades CSS del tema para un contenedor montado por portal.
 *
 * Los tokens `--te-*` viajan inline en el elemento raíz del editor, y las variables CSS se
 * heredan por el árbol del DOM, no por el de React. Un portal a `document.body` cae fuera de
 * ese elemento y se queda sin tokens: `var(--te-accent)` no resuelve, el botón principal
 * pierde el fondo y queda blanco sobre blanco, y los bordes `var(--te-line)` caen a
 * `currentColor`. Todo contenedor que salga por portal tiene que volver a declararlos.
 */
export function useEditorThemeStyle(): CSSProperties {
  const theme = useContext(EditorThemeContext);
  return useMemo(() => editorThemeStyle(theme), [theme]);
}
