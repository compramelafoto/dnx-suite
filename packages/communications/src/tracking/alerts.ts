/**
 * Alertas operativas sanitizadas — sin PII ni payloads.
 */

export type CommunicationWebhookAlertType =
  | "signature_failure_spike"
  | "database_failure"
  | "configuration_failure"
  | "processing_failure_spike"
  | "unexpected_event_spike";

export type CommunicationWebhookAlert = {
  type: CommunicationWebhookAlertType;
  environment: string;
  provider: "resend";
  errorCode?: string;
  count: number;
  windowSeconds: number;
  requestId?: string;
  occurredAt: Date;
};

export type CommunicationWebhookAlertSink = {
  notify(alert: CommunicationWebhookAlert): Promise<void>;
};

export type WebhookAlertConfig = {
  enabled: boolean;
  signatureFailureThreshold: number;
  databaseFailureThreshold: number;
  windowSeconds: number;
};

export function createNoopWebhookAlertSink(): CommunicationWebhookAlertSink {
  return {
    async notify() {},
  };
}

export type TestWebhookAlertSink = CommunicationWebhookAlertSink & {
  alerts: CommunicationWebhookAlert[];
  reset(): void;
  failNext?: boolean;
};

export function createTestWebhookAlertSink(): TestWebhookAlertSink {
  const alerts: CommunicationWebhookAlert[] = [];
  const sink: TestWebhookAlertSink = {
    alerts,
    failNext: false,
    reset() {
      alerts.length = 0;
      sink.failNext = false;
    },
    async notify(alert) {
      if (sink.failNext) {
        sink.failNext = false;
        throw new Error("ALERT_SINK_FAILURE");
      }
      alerts.push(alert);
    },
  };
  return sink;
}

/**
 * Contador en ventana deslizante simple (proceso local).
 * Emite a lo sumo una alerta por tipo al superar umbral (por ventana).
 */
export function createThresholdAlertTracker(input: {
  config: WebhookAlertConfig;
  sink: CommunicationWebhookAlertSink;
  environment: string;
}) {
  const windows = new Map<
    string,
    { count: number; resetAt: number; emitted: boolean }
  >();

  async function record(inputAlert: {
    type: CommunicationWebhookAlertType;
    errorCode?: string;
    requestId?: string;
    threshold: number;
  }): Promise<{ emitted: boolean }> {
    if (!input.config.enabled) return { emitted: false };
    const now = Date.now();
    const windowMs = Math.max(1, input.config.windowSeconds) * 1000;
    let bucket = windows.get(inputAlert.type);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs, emitted: false };
      windows.set(inputAlert.type, bucket);
    }
    bucket.count += 1;
    if (bucket.count < inputAlert.threshold || bucket.emitted) {
      return { emitted: false };
    }
    bucket.emitted = true;
    try {
      await input.sink.notify({
        type: inputAlert.type,
        environment: input.environment,
        provider: "resend",
        errorCode: inputAlert.errorCode,
        count: bucket.count,
        windowSeconds: input.config.windowSeconds,
        requestId: inputAlert.requestId,
        occurredAt: new Date(),
      });
      return { emitted: true };
    } catch {
      // Fallo del sink no debe alterar el webhook.
      return { emitted: false };
    }
  }

  return {
    async onSignatureFailure(requestId?: string) {
      return record({
        type: "signature_failure_spike",
        errorCode: "WEBHOOK_SIGNATURE_INVALID",
        requestId,
        threshold: input.config.signatureFailureThreshold,
      });
    },
    async onDatabaseFailure(requestId?: string) {
      return record({
        type: "database_failure",
        errorCode: "WEBHOOK_HANDLER_FAILED",
        requestId,
        threshold: input.config.databaseFailureThreshold,
      });
    },
    async onConfigurationFailure(requestId?: string) {
      return record({
        type: "configuration_failure",
        errorCode: "WEBHOOK_CONFIGURATION_MISSING",
        requestId,
        threshold: 1,
      });
    },
  };
}
