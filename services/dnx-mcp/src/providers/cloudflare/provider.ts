import { ProviderNotConfiguredError } from "../../utils/errors.js";
import type { Provider } from "../../types/provider.js";
import type { PlatformDefinition } from "../../platforms/types.js";
import { CloudflareHttpClient, R2S3Client } from "./client/index.js";
import {
  hasR2ObjectCredentials,
  isCloudflareConfigured,
  resolveCloudflareConfig,
  type CloudflareConfig,
} from "./config.js";
import {
  AccountService,
  R2BucketsService,
  R2CorsService,
  R2CredentialsService,
  R2DomainService,
  R2ObjectsService,
} from "./services/index.js";
import {
  assessCloudflareReleaseReadiness,
  prepareApplication,
  prepareStagingBucket,
  type PrepareApplicationServices,
  type StagingBucketServices,
  type VercelPreviewEnvPort,
} from "./helpers/index.js";
import type {
  CreateBucketOptions,
  PrepareApplicationInput,
  PrepareStagingBucketInput,
  R2CorsRule,
} from "./types/index.js";

export interface CloudflareProviderOptions {
  config?: Partial<CloudflareConfig>;
  fetchImpl?: typeof fetch;
  httpClient?: CloudflareHttpClient;
  s3Client?: R2S3Client;
  /** Puerto opcional para auditar/cargar env en Vercel Preview (nunca production). */
  vercelPreviewEnv?: VercelPreviewEnvPort;
}

/**
 * Provider empresarial de Cloudflare con módulo R2.
 *
 * - Management API (Bearer token) para cuenta, buckets, CORS y dominios.
 * - API S3-compatible oficial de R2 para objetos (credenciales R2 opcionales).
 * - dryRun=true / confirm=false por defecto en mutaciones.
 */
export class CloudflareProvider implements Provider {
  readonly name = "cloudflare" as const;

  readonly account: AccountService;
  readonly buckets: R2BucketsService;
  readonly objects: R2ObjectsService;
  readonly cors: R2CorsService;
  readonly domains: R2DomainService;
  readonly credentials: R2CredentialsService;

  private readonly config: CloudflareConfig;
  private readonly httpClient: CloudflareHttpClient;
  private readonly s3Client: R2S3Client;
  private readonly fetchImpl: typeof fetch | undefined;
  private readonly vercelPreviewEnv: VercelPreviewEnvPort | undefined;

  constructor(options: CloudflareProviderOptions = {}) {
    this.config = resolveCloudflareConfig(options.config);
    this.fetchImpl = options.fetchImpl;
    this.vercelPreviewEnv = options.vercelPreviewEnv;
    this.httpClient =
      options.httpClient ??
      new CloudflareHttpClient({
        config: this.config,
        ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
      });
    this.s3Client =
      options.s3Client ??
      new R2S3Client({
        config: this.config,
        ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
      });

    this.account = new AccountService(this.httpClient);
    this.buckets = new R2BucketsService(this.httpClient);
    this.objects = new R2ObjectsService(this.s3Client);
    this.cors = new R2CorsService(this.httpClient);
    this.domains = new R2DomainService(this.httpClient);
    this.credentials = new R2CredentialsService(this.httpClient);
  }

  isConfigured(): boolean {
    return isCloudflareConfigured(this.config);
  }

  hasObjectCredentials(): boolean {
    return hasR2ObjectCredentials(this.config);
  }

  getConfig(): Readonly<CloudflareConfig> {
    return this.config;
  }

  assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ProviderNotConfiguredError(this.name);
    }
  }

  // --- Cuenta ---

  verifyToken() {
    this.assertConfigured();
    return this.account.verifyToken();
  }

  getAccount() {
    this.assertConfigured();
    return this.account.getAccount();
  }

  getAccountHealth() {
    this.assertConfigured();
    return this.account.getAccountHealth();
  }

  // --- R2 buckets ---

  listBuckets() {
    this.assertConfigured();
    return this.buckets.listBuckets();
  }

  getBucket(name: string) {
    this.assertConfigured();
    return this.buckets.getBucket(name);
  }

  bucketExists(name: string) {
    this.assertConfigured();
    return this.buckets.bucketExists(name);
  }

  createBucket(name: string, options: Partial<CreateBucketOptions> = {}) {
    this.assertConfigured();
    return this.buckets.createBucket(name, options);
  }

  deleteBucket(name: string, confirm = false, dryRun = true) {
    this.assertConfigured();
    return this.buckets.deleteBucket(name, confirm, dryRun);
  }

  getBucketUsage(name: string) {
    this.assertConfigured();
    return this.buckets.getBucketUsage(name);
  }

  validateBucket(name: string) {
    this.assertConfigured();
    return this.buckets.validateBucket(name);
  }

  // --- R2 objetos ---

  listObjects(bucket: string, prefix?: string) {
    this.assertConfigured();
    return this.objects.listObjects(bucket, prefix);
  }

  objectExists(bucket: string, key: string) {
    this.assertConfigured();
    return this.objects.objectExists(bucket, key);
  }

  headObject(bucket: string, key: string) {
    this.assertConfigured();
    return this.objects.headObject(bucket, key);
  }

  uploadObject(
    bucket: string,
    key: string,
    body: string | Buffer | Uint8Array,
    contentType = "application/octet-stream",
    confirm = false,
    dryRun = true,
  ) {
    this.assertConfigured();
    return this.objects.uploadObject(bucket, key, body, contentType, confirm, dryRun);
  }

  deleteObject(bucket: string, key: string, confirm = false, dryRun = true) {
    this.assertConfigured();
    return this.objects.deleteObject(bucket, key, confirm, dryRun);
  }

  // --- R2 configuración ---

  getCors(bucket: string) {
    this.assertConfigured();
    return this.cors.getCors(bucket);
  }

  updateCors(bucket: string, rules: R2CorsRule[], confirm = false, dryRun = true) {
    this.assertConfigured();
    return this.cors.updateCors(bucket, rules, confirm, dryRun);
  }

  getPublicDomain(bucket: string) {
    this.assertConfigured();
    return this.domains.getPublicDomain(bucket);
  }

  enablePublicDomain(bucket: string, confirm = false, dryRun = true) {
    this.assertConfigured();
    return this.domains.enablePublicDomain(bucket, confirm, dryRun);
  }

  disablePublicDomain(bucket: string, confirm = false, dryRun = true) {
    this.assertConfigured();
    return this.domains.disablePublicDomain(bucket, confirm, dryRun);
  }

  // --- Helpers ---

  prepareStagingBucket(input: PrepareStagingBucketInput) {
    this.assertConfigured();
    const services: StagingBucketServices = {
      buckets: this.buckets,
      cors: this.cors,
      domains: this.domains,
    };
    return prepareStagingBucket(services, input);
  }

  /**
   * Prepara R2 para una app (staging): verifica bucket, credenciales S3,
   * genera R2_*, audita/carga Vercel Preview y valida upload/download.
   * Nunca toca producción.
   */
  prepareApplication(input: PrepareApplicationInput) {
    this.assertConfigured();
    const services: PrepareApplicationServices = {
      config: this.config,
      buckets: this.buckets,
      objects: this.objects,
      credentials: this.credentials,
      createS3Client: (overrides = {}) =>
        new R2S3Client({
          config: { ...this.config, ...overrides },
          ...(this.fetchImpl ? { fetchImpl: this.fetchImpl } : {}),
        }),
      ...(this.vercelPreviewEnv ? { vercel: this.vercelPreviewEnv } : {}),
    };
    return prepareApplication(services, input);
  }

  assessReleaseReadiness(platform: PlatformDefinition) {
    return assessCloudflareReleaseReadiness(
      {
        buckets: this.buckets,
        cors: this.cors,
        domains: this.domains,
        isConfigured: () => this.isConfigured(),
      },
      platform,
    );
  }
}

export function createCloudflareProvider(
  options: CloudflareProviderOptions = {},
): CloudflareProvider {
  return new CloudflareProvider(options);
}

/** Singleton registrado en Provider Registry. */
export const cloudflareProvider = createCloudflareProvider();
