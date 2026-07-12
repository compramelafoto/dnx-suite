import type { VercelHttpClient } from "../client/index.js";
import {
  parseVercelLogEvents,
  type GetLogsOptions,
  type LogSource,
  type VercelLogEvent,
} from "../types/index.js";

export class LogsService {
  constructor(private readonly client: VercelHttpClient) {}

  async getBuildLogs(
    deploymentId: string,
    options: GetLogsOptions = {},
  ): Promise<VercelLogEvent[]> {
    return this.getDeploymentEvents(deploymentId, "build", options);
  }

  async getRuntimeLogs(
    projectId: string,
    deploymentId: string,
    options: GetLogsOptions = {},
  ): Promise<VercelLogEvent[]> {
    try {
      const response = await this.client.get<unknown>(
        `/v1/projects/${projectId}/deployments/${deploymentId}/runtime-logs`,
        {
          query: {
            limit: options.limit,
            since: options.since,
            until: options.until,
            direction: options.direction,
            follow: options.follow,
          },
        },
      );

      const events = parseVercelLogEvents(response);
      return events;
    } catch {
      return this.getDeploymentEvents(deploymentId, "runtime", options);
    }
  }

  async getEdgeLogs(deploymentId: string, options: GetLogsOptions = {}): Promise<VercelLogEvent[]> {
    return this.getDeploymentEvents(deploymentId, "edge", options);
  }

  async getLogs(
    source: LogSource,
    params: {
      deploymentId: string;
      projectId?: string;
      options?: GetLogsOptions;
    },
  ): Promise<VercelLogEvent[]> {
    switch (source) {
      case "build":
        return this.getBuildLogs(params.deploymentId, params.options);
      case "runtime":
        if (!params.projectId) {
          throw new Error("projectId es requerido para runtime logs");
        }
        return this.getRuntimeLogs(params.projectId, params.deploymentId, params.options);
      case "edge":
        return this.getEdgeLogs(params.deploymentId, params.options);
    }
  }

  formatLogs(events: VercelLogEvent[]): string {
    return events
      .map((event) => {
        const text = event.payload?.text ?? event.payload?.message ?? "";
        const timestamp = event.created ?? event.payload?.date;
        const prefix = timestamp ? `[${new Date(timestamp).toISOString()}] ` : "";
        return `${prefix}${text}`.trim();
      })
      .filter(Boolean)
      .join("\n");
  }

  private async getDeploymentEvents(
    deploymentId: string,
    source: LogSource,
    options: GetLogsOptions,
  ): Promise<VercelLogEvent[]> {
    const response = await this.client.get<unknown>(`/v3/deployments/${deploymentId}/events`, {
      query: {
        limit: options.limit,
        since: options.since,
        until: options.until,
        direction: options.direction,
        follow: options.follow,
        types: this.mapSourceToEventTypes(source),
      },
    });

    const events = parseVercelLogEvents(response);

    if (source === "build") {
      return events;
    }

    return events.filter((event) => this.matchesSource(event, source));
  }

  private mapSourceToEventTypes(source: LogSource): string | undefined {
    switch (source) {
      case "build":
        return undefined;
      case "runtime":
        return "stdout,stderr,command";
      case "edge":
        return "edge-function,edge-middleware";
    }
  }

  private matchesSource(event: VercelLogEvent, source: LogSource): boolean {
    const eventSource = event.payload?.source ?? event.type;

    if (source === "edge") {
      return eventSource.includes("edge");
    }

    if (source === "runtime") {
      return !eventSource.includes("edge");
    }

    return true;
  }
}
