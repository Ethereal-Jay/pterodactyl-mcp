import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  PterodactylClient,
  handleApiError,
  sc,
} from "../api-client.js";
import { type PterodactylListResponse, type Subuser } from "../types.js";
import {
  ResponseFormat,
  ServerIdentifier,
  CreateSubuserSchema,
  UpdateSubuserSchema,
  DeleteSubuserSchema,
} from "../schemas.js";

export function registerClientSubuserTools(server: McpServer, client: PterodactylClient) {
  // ── List Subusers ──
  server.registerTool(
    "pterodactyl_list_subusers",
    {
      title: "List Server Subusers",
      description: `List all subusers for a server with their permissions.

Args:
  - server (string): Server identifier
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')`,
      inputSchema: ServerIdentifier.extend({ response_format: ResponseFormat }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ server: serverId, response_format }) => {
      try {
        const resp = await client.clientGet<PterodactylListResponse<Subuser>>(`servers/${serverId}/users`);
        const users = resp.data.map((item) => item.attributes);
        if (!users.length) {
          return { content: [{ type: "text", text: `No subusers found on server ${serverId}.` }] };
        }

        if (response_format === "markdown") {
          const lines = [`# Subusers for Server ${serverId}`, ""];
          for (const u of users) {
            lines.push(`## ${u.username} (${u.email})`);
            lines.push(`- **UUID**: ${u.uuid}`);
            lines.push(`- **2FA**: ${u.two_factor_enabled ? "Enabled" : "Disabled"}`);
            lines.push(`- **Permissions**: ${u.permissions.join(", ")}`);
            lines.push("");
          }
          return { content: [{ type: "text", text: lines.join("\n") }] };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(users, null, 2) }],
          structuredContent: sc(users),
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Create Subuser ──
  server.registerTool(
    "pterodactyl_create_subuser",
    {
      title: "Create Server Subuser",
      description: `Invite a user as a subuser to a server with specific permissions.

The user must already have an account on the panel. Common permissions include:
- 'control.console', 'control.start', 'control.stop', 'control.restart'
- 'file.create', 'file.read', 'file.update', 'file.delete', 'file.archive', 'file.sftp'
- 'database.create', 'database.read', 'database.update', 'database.delete'
- 'backup.create', 'backup.read', 'backup.update', 'backup.delete'
- 'allocation.read', 'allocation.create', 'allocation.update', 'allocation.delete'
- 'schedule.create', 'schedule.read', 'schedule.update', 'schedule.delete'
- 'user.create', 'user.read', 'user.update', 'user.delete'

Args:
  - server (string): Server identifier
  - email (string): Email of the panel user to add as subuser
  - permissions (string[]): Array of permission keys to grant`,
      inputSchema: CreateSubuserSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ server: serverId, email, permissions }) => {
      try {
        await client.clientPost(`servers/${serverId}/users`, { email, permissions });
        return { content: [{ type: "text", text: `Subuser '${email}' added to server ${serverId} with ${permissions.length} permission(s).` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Update Subuser ──
  server.registerTool(
    "pterodactyl_update_subuser",
    {
      title: "Update Subuser Permissions",
      description: `Update the permissions for an existing subuser on a server.

Args:
  - server (string): Server identifier
  - user (string): Subuser UUID
  - permissions (string[]): Updated array of permission keys`,
      inputSchema: UpdateSubuserSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ server: serverId, user, permissions }) => {
      try {
        await client.clientPost(`servers/${serverId}/users/${user}`, { permissions });
        return { content: [{ type: "text", text: `Permissions updated for subuser ${user} on server ${serverId}.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Delete Subuser ──
  server.registerTool(
    "pterodactyl_delete_subuser",
    {
      title: "Remove Server Subuser",
      description: `Remove a subuser's access to a server.

Args:
  - server (string): Server identifier
  - user (string): Subuser UUID to remove`,
      inputSchema: DeleteSubuserSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ server: serverId, user }) => {
      try {
        await client.clientDelete(`servers/${serverId}/users/${user}`);
        return { content: [{ type: "text", text: `Subuser ${user} removed from server ${serverId}.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );
}
