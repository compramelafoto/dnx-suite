"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

/** Sincroniza el tamaño del canvas R3F con el contenedor (evita buffer 0×0 en flex). */
export default function ViewportSizeSync() {
  const gl = useThree((state) => state.gl);
  const setSize = useThree((state) => state.setSize);

  useEffect(() => {
    const parent = gl.domElement.parentElement;
    if (!parent) return;

    const sync = () => {
      const { width, height } = parent.getBoundingClientRect();
      if (width > 1 && height > 1) {
        setSize(width, height);
      }
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(parent);
    window.addEventListener("resize", sync);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [gl, setSize]);

  return null;
}
