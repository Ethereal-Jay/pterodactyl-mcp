import axios, { AxiosError, type AxiosInstance } from "axios";

const CLIENT_API = "api/client";
const APPLICATION_API = "api/application";

export type ApiType = "client" | "application";

export class PterodactylClient {
  private clientApi: AxiosInstance;
  private appApi: AxiosInstance;
  public apiType: ApiType;

  constructor(baseUrl: string, apiKey: string) {
    const trimmedBase = baseUrl.replace(/\/+$/, "");

    this.clientApi = axios.create({
      baseURL: `${trimmedBase}/${CLIENT_API}`,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.pterodactyl.v1+json",
      },
      timeout: 30000,
    });

    this.appApi = axios.create({
      baseURL: `${trimmedBase}/${APPLICATION_API}`,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.pterodactyl.v1+json",
      },
      timeout: 30000,
    });

    this.apiType = apiKey.startsWith("ptlc_") ? "client" : "application";
  }

  getClientApi(): AxiosInstance {
    return this.clientApi;
  }

  getAppApi(): AxiosInstance {
    return this.appApi;
  }

  async clientGet<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
    const response = await this.clientApi.get<T>(endpoint, { params });
    return response.data;
  }

  async clientPost<T>(endpoint: string, data?: unknown, params?: Record<string, unknown>): Promise<T> {
    const response = await this.clientApi.post<T>(endpoint, data, { params });
    return response.data;
  }

  async clientPut<T>(endpoint: string, data?: unknown): Promise<T> {
    const response = await this.clientApi.put<T>(endpoint, data);
    return response.data;
  }

  async clientDelete<T>(endpoint: string): Promise<T> {
    const response = await this.clientApi.delete<T>(endpoint);
    return response.data;
  }

  async appGet<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
    const response = await this.appApi.get<T>(endpoint, { params });
    return response.data;
  }

  async appPost<T>(endpoint: string, data?: unknown): Promise<T> {
    const response = await this.appApi.post<T>(endpoint, data);
    return response.data;
  }

  async appPatch<T>(endpoint: string, data?: unknown): Promise<T> {
    const response = await this.appApi.patch<T>(endpoint, data);
    return response.data;
  }

  async appDelete<T>(endpoint: string): Promise<T> {
    const response = await this.appApi.delete<T>(endpoint);
    return response.data;
  }
}

export function handleApiError(error: unknown): string {
  if (error instanceof AxiosError) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as { errors?: Array<{ code: string; status: string; detail: string }> } | undefined;
      const detail = data?.errors?.[0]?.detail;

      switch (status) {
        case 400:
          return `Error: Bad request${detail ? ` - ${detail}` : ". Check your input parameters."}`;
        case 401:
          return "Error: Unauthorized. Your API key is missing or invalid. Generate one at your panel's admin/api or account/api page.";
        case 403:
          return `Error: Forbidden${detail ? ` - ${detail}` : ". Your API key does not have permission for this action."}`;
        case 404:
          return `Error: Not found${detail ? ` - ${detail}` : ". The requested resource does not exist or the API key lacks access."}`;
        case 409:
          return `Error: Conflict${detail ? ` - ${detail}` : ". The request conflicts with the current server state."}`;
        case 412:
          return `Error: Precondition failed${detail ? ` - ${detail}` : ". The server state prevents this action."}`;
        case 422:
          return `Error: Validation failed${detail ? ` - ${detail}` : ". Check your input values."}`;
        case 429:
          return "Error: Rate limit exceeded (default: 240 req/min). Wait before making more requests.";
        case 500:
          return "Error: Internal server error on the Pterodactyl panel. Try again later.";
        default:
          return `Error: API request failed with status ${status}${detail ? ` - ${detail}` : ""}`;
      }
    } else if (error.code === "ECONNABORTED") {
      return "Error: Request timed out. Check your panel URL and network connectivity.";
    } else if (error.code === "ECONNREFUSED") {
      return "Error: Connection refused. Verify the Pterodactyl panel URL is correct and reachable.";
    }
  }
  return `Error: Unexpected error: ${error instanceof Error ? error.message : String(error)}`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  return parts.length > 0 ? parts.join(" ") : "<1m";
}

/**
 * Wrap arbitrary structured data for the MCP `structuredContent` field.
 * The MCP SDK requires `structuredContent` to satisfy
 * `{ [x: string]: unknown }`; raw interfaces and arrays fail that constraint
 * at compile time even though they serialise fine at runtime. This helper
 * applies the necessary `unknown`-bridge cast.
 */
export function sc<T>(value: T): { [key: string]: unknown } | undefined {
  return value === undefined ? undefined : (value as unknown as { [key: string]: unknown });
}
