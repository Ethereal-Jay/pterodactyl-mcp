import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  PterodactylClient,
  handleApiError,
} from "../api-client.js";
import { type PterodactylResponse, type PterodactylListResponse, type Location } from "../types.js";
import {
  ResponseFormat,
  PaginationParams,
  FilterParams,
  CreateLocationSchema,
  UpdateLocationSchema,
  LocationIdentifier,
} from "../schemas.js";

export function registerAdminLocationTools(server: McpServer, client: PterodactylClient) {
  // ── List Locations ──
  server.registerTool(
    "pterodactyl_admin_list_locations",
    {
      title: "List Locations (Admin)",
      description: `List all locations. Admin API key required.

Supports filtering by short and long fields, and including nodes/servers.

Args:
  - page (number): Page number (default: 1)
  - per_page (number): Items per page (default: 25)
  - filter (object, optional): Filter by fields (e.g., {short: 'us-east'})
  - include (string, optional): Comma-separated relationships (nodes, servers)
  - sort (string, optional): Sort field
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')`,
      inputSchema: PaginationParams.merge(FilterParams).extend({ response_format: ResponseFormat }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { response_format, page, per_page, filter, include, sort } = params;
        const query: Record<string, unknown> = { page, per_page };
        if (filter) {
          for (const [key, value] of Object.entries(filter)) query[`filter[${key}]`] = value;
        }
        if (include) query.include = include;
        if (sort) query.sort = sort;

        const data = await client.appGet<PterodactylListResponse<Location>>("locations", query);
        if (!data.data.length) {
          return { content: [{ type: "text", text: "No locations found." }] };
        }

        if (response_format === "markdown") {
          const lines = [`# Locations (Page ${page}/${data.meta.pagination.total_pages}, Total: ${data.meta.pagination.total})`, ""];
          for (const l of data.data) {
            lines.push(`## ${l.short} (ID: ${l.id})`);
            if (l.long) lines.push(`- **Description**: ${l.long}`);
            lines.push("");
          }
          lines.push(`Has more pages: ${data.meta.pagination.current_page < data.meta.pagination.total_pages}`);
          return { content: [{ type: "text", text: lines.join("\n") }] };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
          structuredContent: data,
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Get Location ──
  server.registerTool(
    "pterodactyl_admin_get_location",
    {
      title: "Get Location Details (Admin)",
      description: `Get detailed information about a location.

Args:
  - location (number): Location ID
  - include (string, optional): Comma-separated relationships (nodes, servers)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')`,
      inputSchema: LocationIdentifier.extend({
        include: FilterParams.shape.include,
        response_format: ResponseFormat,
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ location: locId, include, response_format }) => {
      try {
        const query: Record<string, unknown> = {};
        if (include) query.include = include;

        const data = await client.appGet<PterodactylResponse<Location>>(`locations/${locId}`, query);
        const l = data.attributes || data.data;

        if (response_format === "markdown") {
          const lines = [`# Location: ${l.short}`, "", `**ID**: ${l.id}`];
          if (l.long) lines.push(`**Description**: ${l.long}`);
          return { content: [{ type: "text", text: lines.join("\n") }] };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(l, null, 2) }],
          structuredContent: l,
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Create Location ──
  server.registerTool(
    "pterodactyl_admin_create_location",
    {
      title: "Create Location (Admin)",
      description: `Create a new location.

Args:
  - short (string): Short location code (e.g., 'us-east', 'eu-west', max 60 chars)
  - long (string, optional): Long description (e.g., 'US East Coast')`,
      inputSchema: CreateLocationSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const data = await client.appPost<PterodactylResponse<Location>>("locations", params);
        const l = data.attributes || data.data;
        return {
          content: [{ type: "text", text: `Location '${l.short}' created (ID: ${l.id}).` }],
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Update Location ──
  server.registerTool(
    "pterodactyl_admin_update_location",
    {
      title: "Update Location (Admin)",
      description: `Update an existing location.

Args:
  - location (number): Location ID
  - (optional) short, long`,
      inputSchema: UpdateLocationSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ location: locId, ...updates }) => {
      try {
        const body: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(updates)) {
          if (value !== undefined) body[key] = value;
        }
        await client.appPatch(`locations/${locId}`, body);
        return { content: [{ type: "text", text: `Location ${locId} updated.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Delete Location ──
  server.registerTool(
    "pterodactyl_admin_delete_location",
    {
      title: "Delete Location (Admin)",
      description: `Delete a location. The location must have no nodes assigned.

Args:
  - location (number): Location ID to delete`,
      inputSchema: LocationIdentifier.strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ location: locId }) => {
      try {
        await client.appDelete(`locations/${locId}`);
        return { content: [{ type: "text", text: `Location ${locId} deleted.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );
}
