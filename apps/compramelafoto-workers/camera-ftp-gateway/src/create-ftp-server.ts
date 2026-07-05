import path from "node:path";
import { Writable } from "node:stream";
import {
  FileSystem,
  FileSystemError,
  FtpServer,
  GeneralError,
  type FtpConnection,
} from "ftp-srv";
import type { GatewayConfig } from "./config.js";
import { authenticateFtpUser, type CameraFtpAuthContext } from "./authenticate.js";
import {
  assertAllowedJpegFilename,
  handleCameraFtpUpload,
  sanitizeUploadBasename,
} from "./handle-upload.js";
import { logInfo, logWarn } from "./logger.js";

const WIN_SEP_REGEX = /\\/g;

function normalizeClientPath(input: string): string {
  const resolved = input.replace(WIN_SEP_REGEX, "/");
  if (resolved.includes("..")) {
    throw new FileSystemError("Path traversal not allowed", 550);
  }
  return path.posix.normalize(resolved.startsWith("/") ? resolved : `/${resolved}`);
}

function fakeDirectoryStat(name: string) {
  const now = new Date();
  return {
    name,
    size: 0,
    mtime: now,
    atime: now,
    ctime: now,
    isDirectory: () => true,
    isFile: () => false,
    mode: 0o755,
  };
}

class CameraUploadFileSystem extends FileSystem {
  private readonly auth: CameraFtpAuthContext;
  private readonly config: GatewayConfig;

  constructor(
    connection: FtpConnection,
    auth: CameraFtpAuthContext,
    config: GatewayConfig
  ) {
    super(connection, { root: "/", cwd: "/" });
    this.auth = auth;
    this.config = config;
  }

  override currentDirectory(): string {
    return this.cwd;
  }

  override get(fileName: string): Promise<ReturnType<typeof fakeDirectoryStat>> {
    const normalized = normalizeClientPath(fileName || ".");
    if (normalized === "/" || normalized === "/." || fileName === ".") {
      return Promise.resolve(fakeDirectoryStat("."));
    }
    return Promise.reject(new FileSystemError("File not found", 550));
  }

  override list(_path = "."): Promise<never[]> {
    return Promise.resolve([]);
  }

  override chdir(pathArg = "."): Promise<string> {
    const normalized = normalizeClientPath(pathArg || ".");
    (this as { cwd: string }).cwd = normalized === "/" ? "/" : normalized;
    return Promise.resolve(this.currentDirectory());
  }

  override mkdir(pathArg: string): Promise<string> {
    return Promise.resolve(normalizeClientPath(pathArg));
  }

  override write(
    fileName: string,
    { append = false, start = undefined }: { append?: boolean; start?: number } = {}
  ): { stream: Writable; clientPath: string } {
    if (append || start != null) {
      throw new FileSystemError("Append/REST not supported", 550);
    }

    const basename = sanitizeUploadBasename(fileName);
    assertAllowedJpegFilename(basename);

    const auth = this.auth;
    const config = this.config;
    const chunks: Buffer[] = [];
    let totalSize = 0;

    const stream = new Writable({
      write(chunk, _encoding, callback) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        totalSize += buf.length;
        if (totalSize > config.FTP_MAX_UPLOAD_BYTES) {
          callback(new FileSystemError("File too large", 550));
          return;
        }
        chunks.push(buf);
        callback();
      },
      final(callback) {
        const buffer = Buffer.concat(chunks);
        handleCameraFtpUpload(config, auth, basename, buffer)
          .then(() => {
            callback();
          })
          .catch((err: unknown) => {
            const message = err instanceof Error ? err.message : String(err);
            callback(
              err instanceof FileSystemError
                ? err
                : new FileSystemError(message || "Upload failed", 550)
            );
          });
      },
    });

    return { stream, clientPath: basename };
  }

  override read(): Promise<never> {
    return Promise.reject(new FileSystemError("Downloads not supported", 550));
  }

  override delete(): Promise<never> {
    return Promise.reject(new FileSystemError("Delete not supported", 550));
  }

  override rename(): Promise<never> {
    return Promise.reject(new FileSystemError("Rename not supported", 550));
  }

  override chmod(): Promise<never> {
    return Promise.reject(new FileSystemError("CHMOD not supported", 550));
  }
}

export function createFtpServer(config: GatewayConfig): FtpServer {
  const pasvOptions = config.pasvUrl
    ? {
        pasv_url: config.pasvUrl,
        pasv_min: config.FTP_PASV_MIN_PORT,
        pasv_max: config.FTP_PASV_MAX_PORT,
      }
    : {
        pasv_min: config.FTP_PASV_MIN_PORT,
        pasv_max: config.FTP_PASV_MAX_PORT,
      };

  const ftpServer = new FtpServer({
    url: `ftp://0.0.0.0:${config.CAMERA_CONNECTION_FTP_PORT}`,
    anonymous: false,
    greeting: ["ComprameLaFoto Camera FTP"],
    timeout: 0,
    ...pasvOptions,
    blacklist: ["DELE", "RNFR", "RNTO", "RETR", "APPE", "STOU"],
  });

  ftpServer.on("login", ({ username, password, connection }, resolve, reject) => {
    authenticateFtpUser(username, password)
      .then((auth) => {
        logInfo("login_ok", {
          username: auth.ftpUsername,
          userId: auth.userId,
          albumId: auth.activeAlbumId ?? undefined,
          assignmentMode: auth.assignmentMode,
          status: "authenticated",
          clientIp: connection.ip,
        });

        resolve({
          fs: new CameraUploadFileSystem(connection, auth, config),
          root: "/",
          cwd: "/",
        });
      })
      .catch((err: unknown) => {
        logWarn("login_rejected", {
          username: username?.trim() || "(empty)",
          status: "rejected",
          clientIp: connection.ip,
          reason: err instanceof Error ? err.message : "auth failed",
        });
        reject(err instanceof Error ? err : new GeneralError("Authentication failed", 530));
      });
  });

  ftpServer.on("client-error", ({ context, error }) => {
    logWarn("client_error", {
      status: "error",
      context,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return ftpServer;
}
