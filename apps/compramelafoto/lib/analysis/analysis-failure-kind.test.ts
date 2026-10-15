import { describe, expect, it } from "vitest";
import { analysisFailureKind, retryDelayMs } from "./analysis-failure-kind";

describe("de quién es la culpa cuando falla un análisis", () => {
  /*
    Esta es la razón por la que existe el módulo.

    El 7 de octubre de 2026 la cuenta de AWS quedó sin credencial válida y Rekognition
    empezó a devolver "The security token included in the request is invalid.". El
    clasificador viejo buscaba la palabra "invalid" en cualquier parte del mensaje para
    decidir si la foto estaba rota, así que dio por rotas 2233 fotos de clientes que
    habían pagado, en el primer intento y para siempre: los trabajos en ERROR no se
    vuelven a tomar nunca.
  */
  it("una credencial vencida no es una foto rota", () => {
    expect(analysisFailureKind("The security token included in the request is invalid.")).toBe(
      "INFRASTRUCTURE",
    );
  });

  it("los demás nombres que pone AWS a lo mismo", () => {
    for (const mensaje of [
      "UnrecognizedClientException: The security token is invalid",
      "ExpiredTokenException: The security token included in the request is expired",
      "InvalidSignatureException: Signature expired",
      "AccessDeniedException: User is not authorized to perform rekognition:DetectFaces",
      "SubscriptionRequiredException",
    ]) {
      expect(analysisFailureKind(mensaje)).toBe("INFRASTRUCTURE");
    }
  });

  it("estar sobrepasados tampoco es culpa de la foto", () => {
    expect(analysisFailureKind("ThrottlingException: Rate exceeded")).toBe("INFRASTRUCTURE");
    expect(analysisFailureKind("ProvisionedThroughputExceededException")).toBe("INFRASTRUCTURE");
    expect(analysisFailureKind("ServiceUnavailable")).toBe("INFRASTRUCTURE");
  });

  it("que se corte la red, tampoco", () => {
    for (const mensaje of ["ECONNRESET", "ETIMEDOUT", "getaddrinfo EAI_AGAIN", "socket hang up"]) {
      expect(analysisFailureKind(mensaje)).toBe("INFRASTRUCTURE");
    }
  });

  it("una foto de verdad rota sigue siendo culpa de la foto", () => {
    for (const mensaje of [
      "Input buffer contains unsupported image format",
      "VipsJpeg: Invalid SOS parameters for sequential JPEG",
      "pngload: corrupt file",
      "Imagen inválida",
      "Formato no soportado",
      "La foto llegó sin dimensiones",
    ]) {
      expect(analysisFailureKind(mensaje)).toBe("PHOTO");
    }
  });

  it("lo que no se reconoce queda en duda, no se da por perdido", () => {
    expect(analysisFailureKind("Cannot read properties of undefined")).toBe("UNKNOWN");
    expect(analysisFailureKind("")).toBe("UNKNOWN");
  });

  /*
    La palabra "invalid" sola ya no alcanza: es la que estaba en el mensaje de la
    credencial. Para dar una foto por rota tiene que haber algo de imagen en el mensaje.
  */
  it("'invalid' sin nada de imagen alrededor no condena a la foto", () => {
    expect(analysisFailureKind("Invalid request")).not.toBe("PHOTO");
  });
});

describe("cuánto se espera para volver a probar", () => {
  it("una caída de infraestructura se consulta más espaciado que un error cualquiera", () => {
    /*
      No crece con cada intento, a propósito. Para crecer necesitaría un contador, y el
      único que hay es el presupuesto de intentos de la foto: usarlo para las dos cosas
      hace que, después de una caída larga, el primer error de verdad lo agote de entrada.
      La cola además procesa de a poco por cron, así que no hay estampida que justifique
      la complicación.
    */
    expect(retryDelayMs("INFRASTRUCTURE")).toBeGreaterThan(retryDelayMs("UNKNOWN"));
  });

  it("lo desconocido mantiene los diez minutos de siempre", () => {
    expect(retryDelayMs("UNKNOWN")).toBe(10 * 60 * 1000);
  });

  it("media hora, para que vuelva solo al rato de que AWS vuelva", () => {
    /*
      Media hora es nada al lado de lo que tarda la cola en drenar miles de fotos de a
      poco. Lo que importa es que vuelva sola, sin que nadie toque un botón.
    */
    expect(retryDelayMs("INFRASTRUCTURE")).toBe(30 * 60 * 1000);
  });
});
