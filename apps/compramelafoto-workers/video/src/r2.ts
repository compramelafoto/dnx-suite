import fs from "node:fs";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import type { WorkerConfig } from "./config.js";

let s3: S3Client | null = null;

function getClient(config: WorkerConfig): S3Client {
  if (!s3) {
    s3 = new S3Client({
      region: "auto",
      endpoint: config.R2_ENDPOINT,
      credentials: {
        accessKeyId: config.R2_ACCESS_KEY_ID,
        secretAccessKey: config.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3;
}

export async function downloadFromR2(
  config: WorkerConfig,
  key: string,
  localPath: string
): Promise<void> {
  const client = getClient(config);
  const res = await client.send(
    new GetObjectCommand({
      Bucket: config.r2BucketName,
      Key: key,
    })
  );
  if (!res.Body) {
    throw new Error(`Objeto vacío o inexistente en R2: ${key}`);
  }
  await pipeline(res.Body as NodeJS.ReadableStream, createWriteStream(localPath));
}

export async function uploadFileToR2(
  config: WorkerConfig,
  localPath: string,
  key: string,
  contentType: string
): Promise<void> {
  const client = getClient(config);
  const body = fs.createReadStream(localPath);
  await client.send(
    new PutObjectCommand({
      Bucket: config.r2BucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

export function thumbnailKey(albumId: number, videoId: number): string {
  return `albums/${albumId}/videos/thumbnail/${videoId}.jpg`;
}

export function previewKey(albumId: number, videoId: number): string {
  return `albums/${albumId}/videos/preview/${videoId}.mp4`;
}
