import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  PterodactylClient,
  handleApiError,
  sc,
} from "../api-client.js";
import { type PterodactylResponse, type PterodactylListResponse, type Nest, type Egg } from "../types.js";
import {
  ResponseFormat,
  PaginationParams,
  FilterParams,
  NestIdentifier,
  EggIdentifier,
} from "../schemas.js";

export function registerAdminNestTools(server: McpServer, client: PterodactylClient) {
  // ── List Nests ──
  server.registerTool(
    "pterodactyl_admin_list_nests",
    {
      title: "List Nests (Admin)",
      description: `List all nests (server type categories like 'Minecraft', 'Source Engine', etc.). Admin API key required.

Args:
  - page (number): Page number (default: 1)
  - per_page (number): Items per page (default: 25)
  - include (string, optional): Comma-separated relationships (eggs, servers)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')`,
      inputSchema: PaginationParams.extend({
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
    async ({ page, per_page, include, response_format }) => {
      try {
        const query: Record<string, unknown> = { page, per_page };
        if (include) query.include = include;

        const data = await client.appGet<PterodactylListResponse<Nest>>("nests", query);
        const nests = data.data.map((item) => item.attributes);
        if (!nests.length) {
          return { content: [{ type: "text", text: "No nests found." }] };
        }

        if (response_format === "markdown") {
          const lines = [`# Nests (Page ${page}/${data.meta.pagination.total_pages}, Total: ${data.meta.pagination.total})`, ""];
          for (const n of nests) {
            lines.push(`## ${n.name} (ID: ${n.id})`);
            lines.push(`- **Author**: ${n.author}`);
            lines.push(`- **UUID**: ${n.uuid}`);
            if (n.description) lines.push(`- **Description**: ${n.description}`);
            lines.push("");
          }
          lines.push(`Has more pages: ${data.meta.pagination.current_page < data.meta.pagination.total_pages}`);
          return { content: [{ type: "text", text: lines.join("\n") }] };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(nests, null, 2) }],
          structuredContent: sc({ nests: nests }),
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Get Nest ──
  server.registerTool(
    "pterodactyl_admin_get_nest",
    {
      title: "Get Nest Details (Admin)",
      description: `Get detailed information about a nest.

Args:
  - nest (number): Nest ID
  - include (string, optional): Comma-separated relationships (eggs, servers)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')`,
      inputSchema: NestIdentifier.extend({
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
    async ({ nest: nestId, include, response_format }) => {
      try {
        const query: Record<string, unknown> = {};
        if (include) query.include = include;

        const data = await client.appGet<PterodactylResponse<Nest>>(`nests/${nestId}`, query);
        const n = data.attributes;

        if (response_format === "markdown") {
          const lines = [
            `# Nest: ${n.name}`,
            "",
            `**ID**: ${n.id}`,
            `**UUID**: ${n.uuid}`,
            `**Author**: ${n.author}`,
          ];
          if (n.description) lines.push(`**Description**: ${n.description}`);
          return { content: [{ type: "text", text: lines.join("\n") }] };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(n, null, 2) }],
          structuredContent: sc(n),
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── List Eggs ──
  server.registerTool(
    "pterodactyl_admin_list_eggs",
    {
      title: "List Eggs in Nest (Admin)",
      description: `List all eggs (server type variants) within a specific nest. Eggs define the Docker image, startup command, and default configuration for a server type.

Args:
  - nest (number): Nest ID
  - page (number): Page number (default: 1)
  - per_page (number): Items per page (default: 25)
  - include (string, optional): Comma-separated relationships (variables, nest)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')`,
      inputSchema: NestIdentifier.merge(PaginationParams).extend({
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
    async ({ nest: nestId, page, per_page, include, response_format }) => {
      try {
        const query: Record<string, unknown> = { page, per_page };
        if (include) query.include = include;

        const data = await client.appGet<PterodactylListResponse<Egg>>(`nests/${nestId}/eggs`, query);
        const eggs = data.data.map((item) => item.attributes);
        if (!eggs.length) {
          return { content: [{ type: "text", text: `No eggs found in nest ${nestId}.` }] };
        }

        if (response_format === "markdown") {
          const lines = [`# Eggs in Nest ${nestId} (Page ${page}/${data.meta.pagination.total_pages}, Total: ${data.meta.pagination.total})`, ""];
          for (const e of eggs) {
            lines.push(`## ${e.name} (ID: ${e.id})`);
            lines.push(`- **Author**: ${e.author}`);
            lines.push(`- **UUID**: ${e.uuid}`);
            lines.push(`- **Docker Image**: ${e.docker_image}`);
            lines.push(`- **Startup**: \`${e.startup}\``);
            if (e.description) lines.push(`- **Description**: ${e.description}`);
            lines.push("");
          }
          lines.push(`Has more pages: ${data.meta.pagination.current_page < data.meta.pagination.total_pages}`);
          return { content: [{ type: "text", text: lines.join("\n") }] };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(eggs, null, 2) }],
          structuredContent: sc({ eggs: eggs }),
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Get Egg ──
  server.registerTool(
    "pterodactyl_admin_get_egg",
    {
      title: "Get Egg Details (Admin)",
      description: `Get detailed information about an egg including its Docker image, startup command, environment variables, and install script configuration.

This is essential for creating servers - use this to find the egg ID and see available environment variables.

Args:
  - nest (number): Nest ID
  - egg (number): Egg ID
  - include (string, optional): Comma-separated relationships (variables, nest)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')`,
      inputSchema: EggIdentifier.extend({
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
    async ({ nest: nestId, egg: eggId, include, response_format }) => {
      try {
        const query: Record<string, unknown> = {};
        if (include) query.include = include;

        const data = await client.appGet<PterodactylResponse<Egg>>(`nests/${nestId}/eggs/${eggId}`, query);
        const e = data.attributes;

        if (response_format === "markdown") {
          const lines = [
            `# Egg: ${e.name}`,
            "",
            `**ID**: ${e.id}`,
            `**UUID**: ${e.uuid}`,
            `**Nest ID**: ${e.nest}`,
            `**Author**: ${e.author}`,
            `**Docker Image**: ${e.docker_image}`,
            `**Startup Command**: \`${e.startup}\``,
          ];
          if (e.description) lines.push(`**Description**: ${e.description}`);

          const dockerImages = e.docker_images;
          if (dockerImages && Object.keys(dockerImages).length > 1) {
            lines.push("", "## Available Docker Images");
            for (const [key, img] of Object.entries(dockerImages)) {
              lines.push(`- **${key}**: ${img}`);
            }
          }

          const variablesRaw = e.relationships?.variables?.data || [];
          const variables = variablesRaw.map((v) => v.attributes);
          if (variables.length > 0) {
            lines.push("", "## Environment Variables");
            for (const v of variables) {
              lines.push(`- **${v.env_variable}** (Default: \`${v.default_value}\`)`);
              lines.push(`  ${v.description}`);
              if (v.rules) lines.push(`  Rules: \`${v.rules}\``);
              lines.push(`  User Viewable: ${v.user_viewable ? "Yes" : "No"}, User Editable: ${v.user_editable ? "Yes" : "No"}`);
            }
          }

          return { content: [{ type: "text", text: lines.join("\n") }] };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(e, null, 2) }],
          structuredContent: sc(e),
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );
}
