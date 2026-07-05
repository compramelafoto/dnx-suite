export type CronMetricsPayload = {
  cron: string;
  duration_ms: number;
  jobs_claimed?: number;
  jobs_ok?: number;
  jobs_failed?: number;
  images_processed?: number;
  skipped?: boolean;
  idle?: boolean;
  bytes_approx?: number;
  [key: string]: unknown;
};

export function logCronMetrics(payload: CronMetricsPayload): void {
  console.info("[cron:metrics]", JSON.stringify(payload));
}
