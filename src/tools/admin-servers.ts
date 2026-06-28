import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  PterodactylClient,
  handleApiError,
  formatBytes,
  sc,
} from "../api-client.js";
import { type PterodactylResponse, type PterodactylListResponse, type Server, type Database } from "../types.js";
import {
  ResponseFormat,
  PaginationParams,
  FilterParams,
  CreateServerSchema,
  UpdateServerDetailsSchema,
  UpdateServerBuildSchema,
  UpdateServerStartupSchema,
  AdminServerIdentifier,
} from "../schemas.js";

export function registerAdminServerTools(server: McpServer, client: PterodactylClient) {
  // ── List Servers ──
  server.registerTool(
    "pterodactyl_admin_list_servers",
    {
      title: "List All Servers (Admin)",
      description: `List all servers on the panel. Admin API key required.

Supports filtering by name, uuid, external_id, image, and including related data.

Args:
  - page (number): Page number (default: 1)
  - per_page (number): Items per page, max 100 (default: 25)
  - filter (object, optional): Filter by fields (e.g., {name: 'survival', uuid: 'abc...'})
  - include (string, optional): Comma-separated relationships (allocations, user, subusers, nest, egg, variables, location, node, databases, backups)
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

        const data = await client.appGet<PterodactylListResponse<Server>>("servers", query);
        const servers = data.data.map((item) => item.attributes);

        if (!servers.length) {
          return { content: [{ type: "text", text: "No servers found." }] };
        }

        if (response_format === "markdown") {
          const lines = [`# All Servers (Page ${page}/${data.meta.pagination.total_pages}, Total: ${data.meta.pagination.total})`, ""];
          for (const s of servers) {
            lines.push(`## ${s.name} (${s.identifier})`);
            lines.push(`- **ID**: ${s.id}`);
            lines.push(`- **UUID**: ${s.uuid}`);
            lines.push(`- **Owner ID**: ${s.user}`);
            lines.push(`- **Node ID**: ${s.node}`);
            lines.push(`- **Status**: ${s.status || "unknown"}`);
            lines.push(`- **Suspended**: ${s.suspended ? "Yes" : "No"}`);
            lines.push(`- **Limits**: CPU ${s.limits.cpu}%, Memory ${formatBytes(s.limits.memory * 1024 * 1024)}, Disk ${formatBytes(s.limits.disk * 1024 * 1024)}`);
            lines.push("");
          }
          lines.push(`Has more pages: ${data.meta.pagination.current_page < data.meta.pagination.total_pages}`);
          return { content: [{ type: "text", text: lines.join("\n") }] };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(servers, null, 2) }],
          structuredContent: sc(servers),
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Get Server ──
  server.registerTool(
    "pterodactyl_admin_get_server",
    {
      title: "Get Server Details (Admin)",
      description: `Get full details of a server by ID or external ID. Admin API key required.

Args:
  - server (number|string): Server ID or external ID
  - include (string, optional): Comma-separated relationships
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')`,
      inputSchema: z.object({
        server: z.union([z.number().int().positive(), z.string()]).describe("Server ID or external ID"),
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
    async ({ server: serverId, include, response_format }) => {
      try {
        const query: Record<string, unknown> = {};
        if (include) query.include = include;

        const endpoint = typeof serverId === "number" ? `servers/${serverId}` : `servers/external/${serverId}`;
        const data = await client.appGet<PterodactylResponse<Server>>(endpoint, query);
        const s = data.attributes;

        if (response_format === "markdown") {
          const lines = [
            `# Server: ${s.name}`,
            "",
            `**ID**: ${s.id}`,
            `**Identifier**: ${s.identifier}`,
            `**UUID**: ${s.uuid}`,
            `**Owner ID**: ${s.user}`,
            `**Node ID**: ${s.node}`,
            `**Egg ID**: ${s.egg}`,
            `**Nest ID**: ${s.nest}`,
            `**Status**: ${s.status || "unknown"}`,
            `**Suspended**: ${s.suspended ? "Yes" : "No"}`,
            `**Image**: ${s.container.image}`,
            `**Startup**: ${s.container.startup_command}`,
            `**Installed**: ${s.container.installed ? "Yes" : "No"}`,
            "",
            "## Limits",
            `- CPU: ${s.limits.cpu}%, Memory: ${formatBytes(s.limits.memory * 1024 * 1024)}, Disk: ${formatBytes(s.limits.disk * 1024 * 1024)}`,
            `- Swap: ${formatBytes(s.limits.swap * 1024 * 1024)}, IO: ${s.limits.io}`,
            "",
            "## Feature Limits",
            `- Databases: ${s.feature_limits.databases}, Allocations: ${s.feature_limits.allocations}, Backups: ${s.feature_limits.backups}`,
          ];
          if (s.description) lines.push("", `**Description**: ${s.description}`);
          return { content: [{ type: "text", text: lines.join("\n") }] };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(s, null, 2) }],
          structuredContent: sc(s),
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Create Server ──
  server.registerTool(
    "pterodactyl_admin_create_server",
    {
      title: "Create Server (Admin)",
      description: `Create a new server on the panel. Admin API key required.

Args:
  - name (string): Server name
  - user (number): Owner user ID
  - egg (number): Egg ID to use
  - docker_image (string, optional): Docker image override
  - startup (string, optional): Startup command override
  - environment (object, optional): Environment variables
  - limits (object): Resource limits {memory, swap, disk, io, cpu, threads?, oom_disabled?}
  - feature_limits (object): Feature limits {databases, allocations, backups}
  - allocation (object, optional): Allocation config {default, additional[]}
  - deploy (object, optional): Deploy config {locations[]}`,
      inputSchema: CreateServerSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const data = await client.appPost<PterodactylResponse<Server>>("servers", params);
        const s = data.attributes;
        return {
          content: [{ type: "text", text: `Server '${s.name}' created (ID: ${s.id}, Identifier: ${s.identifier}).` }],
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Update Server Details ──
  server.registerTool(
    "pterodactyl_admin_update_server_details",
    {
      title: "Update Server Details (Admin)",
      description: `Update a server's name, owner, external ID, or description.

Args:
  - server (number): Server ID
  - (optional) name, user, external_id, description`,
      inputSchema: UpdateServerDetailsSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ server: serverId, ...updates }) => {
      try {
        const body: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(updates)) {
          if (value !== undefined) body[key] = value;
        }
        await client.appPatch(`servers/${serverId}/details`, body);
        return { content: [{ type: "text", text: `Server ${serverId} details updated.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Update Server Build ──
  server.registerTool(
    "pterodactyl_admin_update_server_build",
    {
      title: "Update Server Build Config (Admin)",
      description: `Update a server's resource limits, allocation, and feature limits.

Args:
  - server (number): Server ID
  - (optional) allocation, memory, swap, disk, io, cpu, threads, oom_disabled, feature_limits, add_allocations[], remove_allocations[]`,
      inputSchema: UpdateServerBuildSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ server: serverId, ...updates }) => {
      try {
        const body: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(updates)) {
          if (value !== undefined) body[key] = value;
        }
        await client.appPatch(`servers/${serverId}/build`, body);
        return { content: [{ type: "text", text: `Server ${serverId} build config updated.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Update Server Startup ──
  server.registerTool(
    "pterodactyl_admin_update_server_startup",
    {
      title: "Update Server Startup (Admin)",
      description: `Update a server's startup command, environment variables, egg, or Docker image.

Args:
  - server (number): Server ID
  - (optional) startup, environment, egg, image, skip_scripts`,
      inputSchema: UpdateServerStartupSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ server: serverId, ...updates }) => {
      try {
        const body: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(updates)) {
          if (value !== undefined) body[key] = value;
        }
        await client.appPatch(`servers/${serverId}/startup`, body);
        return { content: [{ type: "text", text: `Server ${serverId} startup config updated.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Suspend Server ──
  server.registerTool(
    "pterodactyl_admin_suspend_server",
    {
      title: "Suspend Server (Admin)",
      description: `Suspend a server, preventing it from starting.

Args:
  - server (number): Server ID to suspend`,
      inputSchema: AdminServerIdentifier.strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ server: serverId }) => {
      try {
        await client.appPost(`servers/${serverId}/suspend`);
        return { content: [{ type: "text", text: `Server ${serverId} suspended.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Unsuspend Server ──
  server.registerTool(
    "pterodactyl_admin_unsuspend_server",
    {
      title: "Unsuspend Server (Admin)",
      description: `Unsuspend a server, allowing it to start again.

Args:
  - server (number): Server ID to unsuspend`,
      inputSchema: AdminServerIdentifier.strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ server: serverId }) => {
      try {
        await client.appPost(`servers/${serverId}/unsuspend`);
        return { content: [{ type: "text", text: `Server ${serverId} unsuspended.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Reinstall Server ──
  server.registerTool(
    "pterodactyl_admin_reinstall_server",
    {
      title: "Reinstall Server (Admin)",
      description: `Trigger a server reinstall (re-runs egg install script).

Args:
  - server (number): Server ID to reinstall`,
      inputSchema: AdminServerIdentifier.strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ server: serverId }) => {
      try {
        await client.appPost(`servers/${serverId}/reinstall`);
        return { content: [{ type: "text", text: `Server ${serverId} reinstall triggered.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Delete Server ──
  server.registerTool(
    "pterodactyl_admin_delete_server",
    {
      title: "Delete Server (Admin)",
      description: `Delete a server permanently. Use force=true to skip safety checks.

Args:
  - server (number): Server ID to delete
  - force (boolean, optional): Force delete even if the Wings daemon is unreachable`,
      inputSchema: AdminServerIdentifier.extend({
        force: z.boolean().default(false).describe("Force delete even if Wings daemon is unreachable"),
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ server: serverId, force }) => {
      try {
        await client.appDelete(`servers/${serverId}${force ? "?force=true" : ""}`);
        return { content: [{ type: "text", text: `Server ${serverId} deleted.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );
}
