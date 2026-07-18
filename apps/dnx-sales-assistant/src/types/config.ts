export type AssistantMode = "simulate";

export type AppConfig = {
  port: number;
  environment: string;
  mode: AssistantMode;
  serviceName: "dnx-sales-assistant";
  version: string;
};
