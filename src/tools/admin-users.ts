import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  PterodactylClient,
  handleApiError,
} from "../api-client.js";
import { type PterodactylResponse, type PterodactylListResponse, type User } from "../types.js";
import {
  ResponseFormat,
  PaginationParams,
  FilterParams,
  CreateUserSchema,
  UpdateUserSchema,
  UserIdentifier,
} from "../schemas.js";

import { z } from "zod";

export function registerAdminUserTools(server: McpServer, client: PterodactylClient) {
  // ── List Users ──
  server.registerTool(
    "pterodactyl_admin_list_users",
    {
      title: "List All Users (Admin)",
      description: `List all users on the panel. Admin API key required.

Supports filtering by email, uuid, username, or external_id.

Args:
  - page (number): Page number (default: 1)
  - per_page (number): Items per page, max 100 (default: 25)
  - filter (object, optional): Filter by fields (e.g., {email: 'user@example.com', username: 'johndoe'})
  - include (string, optional): Comma-separated relationships to include
  - sort (string, optional): Sort field (e.g., '-created_at' for newest first)
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
          for (const [key, value] of Object.entries(filter)) {
            query[`filter[${key}]`] = value;
          }
        }
        if (include) query.include = include;
        if (sort) query.sort = sort;

        const data = await client.appGet<PterodactylListResponse<User>>("users", query);

        if (!data.data.length) {
          return { content: [{ type: "text", text: "No users found." }] };
        }

        if (response_format === "markdown") {
          const lines = [`# Users (Page ${page}/${data.meta.pagination.total_pages}, Total: ${data.meta.pagination.total})`, ""];
          for (const u of data.data) {
            lines.push(`## ${u.username} (ID: ${u.id})`);
            lines.push(`- **Email**: ${u.email}`);
            lines.push(`- **Name**: ${u.first_name} ${u.last_name}`);
            lines.push(`- **Root Admin**: ${u.root_admin ? "Yes" : "No"}`);
            lines.push(`- **2FA**: ${u.two_factor_enabled ? "Enabled" : "Disabled"}`);
            lines.push(`- **UUID**: ${u.uuid}`);
            if (u.external_id) lines.push(`- **External ID**: ${u.external_id}`);
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

  // ── Get User ──
  server.registerTool(
    "pterodactyl_admin_get_user",
    {
      title: "Get User Details (Admin)",
      description: `Get detailed information about a specific user by ID or external ID.

Args:
  - user (number|string): User ID (number) or external ID (string)
  - include (string, optional): Comma-separated relationships to include
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')`,
      inputSchema: UserIdentifier.extend({ include: FilterParams.shape.include, response_format: ResponseFormat }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ user, include, response_format }) => {
      try {
        const query: Record<string, unknown> = {};
        if (include) query.include = include;

        const endpoint = typeof user === "number" ? `users/${user}` : `users/external/${user}`;
        const data = await client.appGet<PterodactylResponse<User>>(endpoint, query);
        const u = data.attributes || data.data;

        if (response_format === "markdown") {
          const lines = [
            `# User: ${u.username}`,
            "",
            `**ID**: ${u.id}`,
            `**UUID**: ${u.uuid}`,
            `**Email**: ${u.email}`,
            `**Name**: ${u.first_name} ${u.last_name}`,
            `**Language**: ${u.language}`,
            `**Root Admin**: ${u.root_admin ? "Yes" : "No"}`,
            `**2FA**: ${u.two_factor_enabled ? "Enabled" : "Disabled"}`,
            `**Created**: ${u.created_at}`,
            `**Updated**: ${u.updated_at}`,
          ];
          if (u.external_id) lines.push(`**External ID**: ${u.external_id}`);
          return { content: [{ type: "text", text: lines.join("\n") }] };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(u, null, 2) }],
          structuredContent: u,
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Create User ──
  server.registerTool(
    "pterodactyl_admin_create_user",
    {
      title: "Create User (Admin)",
      description: `Create a new panel user. Admin API key required.

If password is omitted, one will be auto-generated (the user can reset it via email).

Args:
  - email (string): User's email address
  - username (string): Username
  - first_name (string): First name
  - last_name (string): Last name
  - password (string, optional): Password (min 8 chars, auto-generated if omitted)
  - root_admin (boolean, optional): Whether user is a root admin
  - external_id (string, optional): External ID for SSO integration`,
      inputSchema: CreateUserSchema.extend({ response_format: ResponseFormat }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { response_format, ...body } = params;
        const data = await client.appPost<PterodactylResponse<User>>("users", body);
        const u = data.attributes || data.data;

        if (response_format === "markdown") {
          const lines = [
            `# User Created`,
            "",
            `**ID**: ${u.id}`,
            `**Username**: ${u.username}`,
            `**Email**: ${u.email}`,
            `**Name**: ${u.first_name} ${u.last_name}`,
            `**Root Admin**: ${u.root_admin ? "Yes" : "No"}`,
          ];
          if (u.external_id) lines.push(`**External ID**: ${u.external_id}`);
          return { content: [{ type: "text", text: lines.join("\n") }] };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(u, null, 2) }],
          structuredContent: u,
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Update User ──
  server.registerTool(
    "pterodactyl_admin_update_user",
    {
      title: "Update User (Admin)",
      description: `Update an existing user's details. Only provide fields you want to change.

Args:
  - user (number): User ID to update
  - (optional) email, username, first_name, last_name, password, root_admin, language`,
      inputSchema: UpdateUserSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ user: userId, ...updates }) => {
      try {
        const body: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(updates)) {
          if (value !== undefined) body[key] = value;
        }
        const data = await client.appPatch<PterodactylResponse<User>>(`users/${userId}`, body);
        const u = data.attributes || data.data;
        return {
          content: [{ type: "text", text: `User ${userId} (${u.username}) updated successfully.` }],
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Delete User ──
  server.registerTool(
    "pterodactyl_admin_delete_user",
    {
      title: "Delete User (Admin)",
      description: `Permanently delete a user and all their servers. This is irreversible.

Args:
  - user (number): User ID to delete`,
      inputSchema: UserIdentifier.extend({
        user: z.number().int().positive().describe("User ID to delete"),
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ user }) => {
      try {
        await client.appDelete(`users/${user}`);
        return { content: [{ type: "text", text: `User ${user} deleted.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );
}
