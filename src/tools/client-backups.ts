import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  PterodactylClient,
  handleApiError,
  formatBytes,
  sc,
} from "../api-client.js";
import { type PterodactylResponse, type PterodactylListResponse, type Backup } from "../types.js";
import {
  ResponseFormat,
  ServerIdentifier,
  CreateBackupSchema,
  BackupIdentifier,
  RestoreBackupSchema,
  LockBackupSchema,
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
        const resp = await client.clientGet<PterodactylListResponse<Backup>>(`servers/${serverId}/backups`);
        const backups = resp.data.map((item) => item.attributes);
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
          structuredContent: sc({ backups: backups }),
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

        const resp = await client.clientPost<PterodactylResponse<Backup>>(`servers/${serverId}/backups`, body);
        const info = resp.attributes;
        return {
          content: [{ type: "text", text: `Backup created on server ${serverId}:\n${JSON.stringify(info, null, 2)}` }],
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Get Backup ──
  server.registerTool(
    "pterodactyl_get_backup",
    {
      title: "Get Backup Details",
      description: `Get details about a specific backup.

Args:
  - server (string): Server identifier
  - backup (string): Backup UUID
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')`,
      inputSchema: BackupIdentifier.extend({ response_format: ResponseFormat }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ server: serverId, backup: backupUuid, response_format }) => {
      try {
        const resp = await client.clientGet<PterodactylResponse<Backup>>(
          `servers/${serverId}/backups/${backupUuid}`
        );
        const b = resp.attributes;

        if (response_format === "markdown") {
          const status = b.is_successful ? "Successful" : b.completed_at ? "Failed" : "In Progress";
          const lines = [
            `# Backup: ${b.name || "Unnamed"}`,
            "",
            `**UUID**: ${b.uuid}`,
            `**Status**: ${status}`,
            `**Size**: ${formatBytes(b.bytes)}`,
            `**Locked**: ${b.is_locked ? "Yes" : "No"}`,
            `**Created**: ${b.created_at}`,
          ];
          if (b.completed_at) lines.push(`**Completed**: ${b.completed_at}`);
          if (b.sha256_hash) lines.push(`**SHA256**: ${b.sha256_hash}`);
          if (b.ignored_files.length) lines.push(`**Ignored Files**: ${b.ignored_files.join(", ")}`);
          return { content: [{ type: "text", text: lines.join("\n") }] };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(b, null, 2) }],
          structuredContent: sc(b),
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Download Backup ──
  server.registerTool(
    "pterodactyl_download_backup",
    {
      title: "Get Backup Download URL",
      description: `Get a pre-signed URL for downloading a backup.

The URL is short-lived. Download it before it expires.

Args:
  - server (string): Server identifier
  - backup (string): Backup UUID`,
      inputSchema: BackupIdentifier,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ server: serverId, backup: backupUuid }) => {
      try {
        const resp = await client.clientGet<{ object: string; attributes: { url: string } }>(
          `servers/${serverId}/backups/${backupUuid}/download`
        );
        const url = resp.attributes?.url;
        return { content: [{ type: "text", text: `Download URL for backup ${backupUuid}:\n${url}` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Lock/Unlock Backup ──
  server.registerTool(
    "pterodactyl_lock_backup",
    {
      title: "Toggle Backup Lock",
      description: `Toggle the lock state of a backup. Locked backups cannot be deleted until unlocked.

Args:
  - server (string): Server identifier
  - backup (string): Backup UUID`,
      inputSchema: LockBackupSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ server: serverId, backup: backupUuid }) => {
      try {
        const resp = await client.clientPost<PterodactylResponse<Backup>>(
          `servers/${serverId}/backups/${backupUuid}/lock`
        );
        const b = resp.attributes;
        return {
          content: [{ type: "text", text: `Backup ${backupUuid} is now ${b.is_locked ? "LOCKED" : "UNLOCKED"}.` }],
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
