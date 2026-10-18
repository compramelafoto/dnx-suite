/**
 * ftp-srv es un paquete CommonJS: Node (ESM) sólo deja importar por nombre lo
 * que detecta a simple vista, y `FtpServer`, `FileSystemError` y `GeneralError`
 * no están entre eso (aunque sus tipos digan que sí). Por eso se toman del
 * export por defecto, que sí existe en tiempo de ejecución.
 */
import FtpServerClass, { FileSystem } from "ftp-srv";
import type * as FtpSrvTypes from "ftp-srv";

type FtpSrvRuntime = {
  ftpErrors: {
    FileSystemError: typeof FtpSrvTypes.FileSystemError;
    GeneralError: typeof FtpSrvTypes.GeneralError;
  };
};

const { FileSystemError, GeneralError } = (FtpServerClass as unknown as FtpSrvRuntime).ftpErrors;

export const FtpServer = FtpServerClass;
export type FtpServer = FtpServerClass;
export { FileSystem, FileSystemError, GeneralError };
export type FtpConnection = FtpSrvTypes.FtpConnection;
