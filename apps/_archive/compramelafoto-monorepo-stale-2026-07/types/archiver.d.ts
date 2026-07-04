declare module "archiver" {
  import { Readable } from "stream";

  interface ArchiverOptions {
    zlib?: {
      level?: number;
    };
    [key: string]: any;
  }

  interface EntryData {
    name: string;
    [key: string]: any;
  }

  interface FileOptions {
    name: string;
    [key: string]: any;
  }

  interface Archiver extends Readable {
    on(event: "data", listener: (chunk: Buffer) => void): this;
    on(event: "end", listener: () => void): this;
    on(event: "warning", listener: (err: Error) => void): this;
    on(event: "error", listener: (err: Error) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
    append(source: Buffer | string, data?: EntryData): this;
    file(filepath: string, data?: FileOptions): this;
    finalize(): Promise<void>;
  }

  function archiver(format: string, options?: ArchiverOptions): Archiver;

  export = archiver;
}
