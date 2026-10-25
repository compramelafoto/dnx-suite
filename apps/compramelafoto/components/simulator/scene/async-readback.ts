/**
 * Lectura de píxeles de la GPU sin frenar el cuadro (WebGL2: búfer de
 * empaquetado + valla). Se pide la lectura del render target que está ligado
 * y se recoge uno o dos cuadros después, cuando la GPU ya terminó.
 *
 * readRenderTargetPixels de three.js es sincrónico (el procesador espera a la
 * placa: eran los tirones al caminar) y además consulta getParameter en cada
 * llamada; esta versión no hace ninguna de las dos cosas.
 */
export class AsyncPixelReader {
  private readonly gl: WebGL2RenderingContext;
  private readonly buffer: WebGLBuffer | null;
  private sync: WebGLSync | null = null;
  private readonly width: number;
  private readonly height: number;
  /** "float" (RGBA de 32 bits) o "byte" (RGBA de 8 bits, celulares sin render en punto flotante). */
  private readonly format: "float" | "byte";

  constructor(gl: WebGL2RenderingContext, width: number, height: number, format: "float" | "byte" = "float") {
    this.gl = gl;
    this.width = width;
    this.height = height;
    this.format = format;
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.buffer);
    gl.bufferData(gl.PIXEL_PACK_BUFFER, width * height * 4 * (format === "float" ? 4 : 1), gl.STREAM_READ);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
  }

  /** Hay una lectura en camino. */
  get pending(): boolean {
    return this.sync !== null;
  }

  /** Pide los píxeles del framebuffer ligado ahora. */
  request(): void {
    if (this.sync || !this.buffer) return;
    const gl = this.gl;
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.buffer);
    gl.readPixels(0, 0, this.width, this.height, gl.RGBA, this.format === "float" ? gl.FLOAT : gl.UNSIGNED_BYTE, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    this.sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
  }

  /** Si la lectura ya llegó la copia en `out` y devuelve true; si no, false (sin esperar). */
  poll(out: Float32Array | Uint8Array): boolean {
    if (!this.sync) return false;
    const gl = this.gl;
    const status = gl.clientWaitSync(this.sync, 0, 0);
    if (status === gl.TIMEOUT_EXPIRED) return false;
    gl.deleteSync(this.sync);
    this.sync = null;
    if (status === gl.WAIT_FAILED) return false;
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.buffer);
    gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, out);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    return true;
  }

  dispose(): void {
    if (this.sync) this.gl.deleteSync(this.sync);
    if (this.buffer) this.gl.deleteBuffer(this.buffer);
  }
}
