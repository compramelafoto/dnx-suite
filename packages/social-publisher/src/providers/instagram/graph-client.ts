import { SocialPublisherError } from "../../types";

export type GraphClientOptions = {
  apiVersion?: string;
  fetchImpl?: typeof fetch;
};

/**
 * Cliente mínimo Graph API. No loguea tokens.
 */
export function createMetaGraphClient(options: GraphClientOptions = {}) {
  const version = options.apiVersion ?? "v21.0";
  const fetchImpl = options.fetchImpl ?? fetch;

  async function request<T>(
    path: string,
    init: {
      method?: string;
      accessToken: string;
      body?: Record<string, string>;
      form?: boolean;
    },
  ): Promise<T> {
    const url = new URL(`https://graph.facebook.com/${version}${path}`);
    const headers: Record<string, string> = {};
    let body: string | undefined;
    if (init.form && init.body) {
      const params = new URLSearchParams(init.body);
      params.set("access_token", init.accessToken);
      body = params.toString();
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    } else {
      url.searchParams.set("access_token", init.accessToken);
      if (init.body) {
        body = JSON.stringify(init.body);
        headers["Content-Type"] = "application/json";
      }
    }
    const res = await fetchImpl(url.toString(), {
      method: init.method ?? "GET",
      headers,
      body,
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: { message?: string; code?: number; error_subcode?: number };
    } & T;
    if (!res.ok || json.error) {
      const msg = json.error?.message ?? `HTTP ${res.status}`;
      const retryable = res.status === 429 || res.status >= 500;
      throw new SocialPublisherError("META_GRAPH_ERROR", msg.slice(0, 200), retryable);
    }
    return json as T;
  }

  return { request, version };
}
