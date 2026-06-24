import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  PterodactylClient,
  handleApiError,
  formatBytes,
} from "../api-client.js";
import { type Backup } from "../types.js";
import {
  ResponseFormat,
  ServerIdentifier,
  CreateBackupSchema,
  BackupIdentifier,
  RestoreBackupSchema,
} from "../schemas.js";

export function registerClientBackupTools(server: McpServer, client: PterodactylClient) {
  // ── List Backups ──
  server.registerTool(
    "pterodactyl_list_backups",
    {
      title: "List Server Backups",
      description: `List all backups for a server.

Returns backup UUIDs, names, sizes, creation dates, and success status.

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
        const { data: backups } = await client.clientGet<Backup[]>(`servers/${serverId}/backups`);
        if (!backups.length) {
          return { content: [{ type: "text", text: `No backups found on server ${serverId}.` }] };
        }

        if (response_format === "markdown") {
          const lines = [`# Backups for Server ${serverId}`, ""];
          for (const b of backups) {
            const status = b.is_successful ? "Successful" : b.completed_at ? "Failed" : "In Progress";
            lines.push(`## ${b.name || "Unnamed"} (${b.uuid})`);
            lines.push(`- **Size**: ${formatBytes(b.bytes)}`);
            lines.push(`- **Status**: ${status}`);
            lines.push(`- **Locked**: ${b.is_locked ? "Yes" : "No"}`);
            lines.push(`- **Created**: ${b.created_at}`);
            if (b.completed_at) lines.push(`- **Completed**: ${b.completed_at}`);
            lines.push("");
          }
          return { content: [{ type: "text", text: lines.join("\n") }] };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(backups, null, 2) }],
          structuredContent: backups,
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Create Backup ──
  server.registerTool(
    "pterodactyl_create_backup",
    {
      title: "Create Server Backup",
      description: `Create a new backup of the server. Backups run asynchronously - check completion with list_backups.

Args:
  - server (string): Server identifier
  - name (string, optional): Name for the backup
  - is_locked (boolean, optional): If true, backup cannot be deleted until unlocked`,
      inputSchema: CreateBackupSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ server: serverId, name, is_locked }) => {
      try {
        const body: Record<string, unknown> = {};
        if (name) body.name = name;
        if (is_locked !== undefined) body.is_locked = is_locked;

        const { data: backup } = await client.clientPost<Backup>(`servers/${serverId}/backups`, body);
        const info = (backup as Record<string, unknown>).attributes || backup;
        return {
          content: [{ type: "text", text: `Backup created on server ${serverId}:\n${JSON.stringify(info, null, 2)}` }],
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Delete Backup ──
  server.registerTool(
    "pterodactyl_delete_backup",
    {
      title: "Delete Server Backup",
      description: `Delete a backup. Locked backups cannot be deleted.

Args:
  - server (string): Server identifier
  - backup (string): Backup UUID to delete`,
      inputSchema: BackupIdentifier,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ server: serverId, backup }) => {
      try {
        await client.clientDelete(`servers/${serverId}/backups/${backup}`);
        return { content: [{ type: "text", text: `Backup ${backup} deleted from server ${serverId}.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Restore Backup ──
  server.registerTool(
    "pterodactyl_restore_backup",
    {
      title: "Restore Server Backup",
      description: `Restore a server from a backup.

WARNING: This may overwrite existing files if truncate is true.

Args:
  - server (string): Server identifier
  - backup (string): Backup UUID to restore
  - truncate (boolean, optional): If true, delete all files first before restoring`,
      inputSchema: RestoreBackupSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ server: serverId, backup, truncate }) => {
      try {
        const body: Record<string, unknown> = {};
        if (truncate !== undefined) body.truncate = truncate;
        await client.clientPost(`servers/${serverId}/backups/${backup}/restore`, body);
        return { content: [{ type: "text", text: `Backup ${backup} restore started on server ${serverId}.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );
}
