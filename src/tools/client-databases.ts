import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  PterodactylClient,
  handleApiError,
  sc,
} from "../api-client.js";
import { type PterodactylResponse, type PterodactylListResponse, type Database, type DatabasePassword } from "../types.js";
import {
  ResponseFormat,
  ServerIdentifier,
  CreateDatabaseSchema,
  DatabaseIdentifier,
} from "../schemas.js";

export function registerClientDatabaseTools(server: McpServer, client: PterodactylClient) {
  // ── List Databases ──
  server.registerTool(
    "pterodactyl_list_databases",
    {
      title: "List Server Databases",
      description: `List all databases for a server, including host info and connection details.

Note: Passwords are NOT included in the list. Use get_database or rotate_password to view passwords.

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
        const resp = await client.clientGet<PterodactylListResponse<Database>>(`servers/${serverId}/databases`);
        const dbs = resp.data.map((item) => item.attributes);
        if (!dbs.length) {
          return { content: [{ type: "text", text: `No databases found on server ${serverId}.` }] };
        }

        if (response_format === "markdown") {
          const lines = [`# Databases for Server ${serverId}`, ""];
          for (const db of dbs) {
            lines.push(`## ${db.name} (ID: ${db.id})`);
            lines.push(`- **Host**: ${db.host.address}:${db.host.port}`);
            lines.push(`- **Username**: ${db.username}`);
            lines.push(`- **Remote**: ${db.remote}`);
            lines.push(`- **Max Connections**: ${db.max_connections}`);
            lines.push("");
          }
          return { content: [{ type: "text", text: lines.join("\n") }] };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(dbs, null, 2) }],
          structuredContent: sc({ databases: dbs }),
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Create Database ──
  server.registerTool(
    "pterodactyl_create_database",
    {
      title: "Create Server Database",
      description: `Create a new database for a server.

Args:
  - server (string): Server identifier
  - database (string): Database name (max 48 chars)
  - remote (string): Remote connection host (default: '%' = any host)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')`,
      inputSchema: CreateDatabaseSchema.extend({ response_format: ResponseFormat }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ server: serverId, database, remote, response_format }) => {
      try {
        const resp = await client.clientPost<PterodactylResponse<Database>>(
          `servers/${serverId}/databases`,
          { database: database, remote }
        );
        const db = resp.attributes;
        if (response_format === "markdown") {
          const pw = (resp.relationships as { password?: { attributes: { password: string } } } | undefined)
            ?.password?.attributes?.password || "(hidden)";
          const lines = [
            `# Database Created`,
            "",
            `**Name**: ${db.name}`,
            `**Host**: ${db.host.address}:${db.host.port}`,
            `**Username**: ${db.username}`,
            `**Password**: ${pw}`,
            `**Remote**: ${db.remote}`,
            `**Max Connections**: ${db.max_connections}`,
            "",
            `**Connection String**: \`mysql://${db.username}:${pw}@${db.host.address}:${db.host.port}/${db.name}\``,
          ];
          return { content: [{ type: "text", text: lines.join("\n") }] };
        }
        return {
          content: [{ type: "text", text: JSON.stringify(db, null, 2) }],
          structuredContent: sc(db),
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Rotate Database Password ──
  server.registerTool(
    "pterodactyl_rotate_database_password",
    {
      title: "Rotate Database Password",
      description: `Rotate (reset) the password for a server database. Returns the new password.

Warning: This will invalidate any existing connections using the old password.

Args:
  - server (string): Server identifier
  - db (number): Database ID`,
      inputSchema: DatabaseIdentifier.strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ server: serverId, db }) => {
      try {
        const resp = await client.clientPost<PterodactylResponse<DatabasePassword>>(
          `servers/${serverId}/databases/${db}/rotate-password`
        );
        const pw = resp.attributes.password;
        return { content: [{ type: "text", text: `Password rotated for database ID ${db}.\nNew password: \`${pw}\`` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Delete Database ──
  server.registerTool(
    "pterodactyl_delete_database",
    {
      title: "Delete Server Database",
      description: `Delete a database from a server. This action is irreversible.

Args:
  - server (string): Server identifier
  - db (number): Database ID to delete`,
      inputSchema: DatabaseIdentifier.strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ server: serverId, db }) => {
      try {
        await client.clientDelete(`servers/${serverId}/databases/${db}`);
        return { content: [{ type: "text", text: `Database ID ${db} deleted from server ${serverId}.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );
}
