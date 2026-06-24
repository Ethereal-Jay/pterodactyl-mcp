import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  PterodactylClient,
  handleApiError,
  formatBytes,
} from "../api-client.js";
import { type PterodactylResponse, type PterodactylListResponse, type Node, type NodeAllocation } from "../types.js";
import { z } from "zod";
import {
  ResponseFormat,
  PaginationParams,
  FilterParams,
  CreateNodeSchema,
  UpdateNodeSchema,
  NodeIdentifier,
  CreateAllocationsSchema,
} from "../schemas.js";

export function registerAdminNodeTools(server: McpServer, client: PterodactylClient) {
  // ── List Nodes ──
  server.registerTool(
    "pterodactyl_admin_list_nodes",
    {
      title: "List Nodes (Admin)",
      description: `List all nodes on the panel. Admin API key required.

Supports filtering by name, uuid, fqdn and including related data.

Args:
  - page (number): Page number (default: 1)
  - per_page (number): Items per page (default: 25)
  - filter (object, optional): Filter by fields
  - include (string, optional): Comma-separated relationships (allocations, location, servers)
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

        const data = await client.appGet<PterodactylListResponse<Node>>("nodes", query);
        if (!data.data.length) {
          return { content: [{ type: "text", text: "No nodes found." }] };
        }

        if (response_format === "markdown") {
          const lines = [`# Nodes (Page ${page}/${data.meta.pagination.total_pages}, Total: ${data.meta.pagination.total})`, ""];
          for (const n of data.data) {
            const memUsed = n.allocated_resources?.memory ?? 0;
            const diskUsed = n.allocated_resources?.disk ?? 0;
            const memPct = n.memory > 0 ? ((memUsed / n.memory) * 100).toFixed(1) : "N/A";
            const diskPct = n.disk > 0 ? ((diskUsed / n.disk) * 100).toFixed(1) : "N/A";
            lines.push(`## ${n.name} (ID: ${n.id})`);
            lines.push(`- **FQDN**: ${n.fqdn} (${n.scheme})`);
            lines.push(`- **Location ID**: ${n.location_id}`);
            lines.push(`- **Memory**: ${formatBytes(memUsed * 1024 * 1024)} / ${formatBytes(n.memory * 1024 * 1024)} (${memPct}%)`);
            lines.push(`- **Disk**: ${formatBytes(diskUsed * 1024 * 1024)} / ${formatBytes(n.disk * 1024 * 1024)} (${diskPct}%)`);
            lines.push(`- **Public**: ${n.public ? "Yes" : "No"}`);
            lines.push(`- **Maintenance**: ${n.maintenance_mode ? "Yes" : "No"}`);
            lines.push(`- **UUID**: ${n.uuid}`);
            if (n.description) lines.push(`- **Description**: ${n.description}`);
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

  // ── Get Node ──
  server.registerTool(
    "pterodactyl_admin_get_node",
    {
      title: "Get Node Details (Admin)",
      description: `Get detailed information about a node.

Args:
  - node (number): Node ID
  - include (string, optional): Comma-separated relationships
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')`,
      inputSchema: NodeIdentifier.extend({
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
    async ({ node: nodeId, include, response_format }) => {
      try {
        const query: Record<string, unknown> = {};
        if (include) query.include = include;

        const data = await client.appGet<PterodactylResponse<Node>>(`nodes/${nodeId}`, query);
        const n = data.attributes || data.data;

        if (response_format === "markdown") {
          const lines = [
            `# Node: ${n.name}`,
            "",
            `**ID**: ${n.id}`,
            `**UUID**: ${n.uuid}`,
            `**FQDN**: ${n.fqdn} (${n.scheme})`,
            `**Location ID**: ${n.location_id}`,
            `**Public**: ${n.public ? "Yes" : "No"}`,
            `**Behind Proxy**: ${n.behind_proxy ? "Yes" : "No"}`,
            `**Maintenance Mode**: ${n.maintenance_mode ? "Yes" : "No"}`,
            "",
            "## Resources",
            `- **Memory**: ${formatBytes(n.memory * 1024 * 1024)} (Overallocate: ${n.memory_overallocate}%)`,
            `- **Disk**: ${formatBytes(n.disk * 1024 * 1024)} (Overallocate: ${n.disk_overallocate}%)`,
            `- **Max Upload**: ${formatBytes(n.upload_size * 1024 * 1024)}`,
            "",
            "## Daemon",
            `- **Listen Port**: ${n.daemon_listen}`,
            `- **SFTP Port**: ${n.daemon_sftp}`,
            `- **Base Path**: ${n.daemon_base}`,
          ];
          if (n.description) lines.push("", `**Description**: ${n.description}`);
          return { content: [{ type: "text", text: lines.join("\n") }] };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(n, null, 2) }],
          structuredContent: n,
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Create Node ──
  server.registerTool(
    "pterodactyl_admin_create_node",
    {
      title: "Create Node (Admin)",
      description: `Create a new node. Admin API key required.

Args:
  - name (string): Node name
  - location_id (number): Location ID
  - fqdn (string): Fully qualified domain name
  - memory (number): Total memory in MiB
  - disk (number): Total disk in MiB
  - scheme (string): 'https' or 'http' (default: 'https')
  - daemon_listen (number): Wings daemon port (default: 8080)
  - daemon_sftp (number): SFTP port (default: 2022)
  - public (boolean): Is node public (default: true)
  - (optional) description, behind_proxy, memory_overallocate, disk_overallocate, upload_size, maintenance_mode`,
      inputSchema: CreateNodeSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const data = await client.appPost<PterodactylResponse<Node>>("nodes", params);
        const n = data.attributes || data.data;
        return {
          content: [{ type: "text", text: `Node '${n.name}' created (ID: ${n.id}, UUID: ${n.uuid}).` }],
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Update Node ──
  server.registerTool(
    "pterodactyl_admin_update_node",
    {
      title: "Update Node (Admin)",
      description: `Update an existing node. Only provide fields you want to change.

Args:
  - node (number): Node ID to update
  - (optional) name, location_id, fqdn, scheme, memory, disk, and other node fields`,
      inputSchema: UpdateNodeSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ node: nodeId, ...updates }) => {
      try {
        const body: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(updates)) {
          if (value !== undefined) body[key] = value;
        }
        await client.appPatch(`nodes/${nodeId}`, body);
        return { content: [{ type: "text", text: `Node ${nodeId} updated.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Delete Node ──
  server.registerTool(
    "pterodactyl_admin_delete_node",
    {
      title: "Delete Node (Admin)",
      description: `Delete a node. The node must have no servers assigned to it.

Args:
  - node (number): Node ID to delete`,
      inputSchema: NodeIdentifier.strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ node: nodeId }) => {
      try {
        await client.appDelete(`nodes/${nodeId}`);
        return { content: [{ type: "text", text: `Node ${nodeId} deleted.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Get Node Configuration ──
  server.registerTool(
    "pterodactyl_admin_get_node_configuration",
    {
      title: "Get Node Wings Configuration (Admin)",
      description: `Get the Wings daemon configuration (YAML) for a node. Used to configure Wings on the node machine.

Args:
  - node (number): Node ID`,
      inputSchema: NodeIdentifier.strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ node: nodeId }) => {
      try {
        const { data: config } = await client.appGet<string>(`nodes/${nodeId}/configuration`);
        return { content: [{ type: "text", text: typeof config === "string" ? config : JSON.stringify(config, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── List Node Allocations ──
  server.registerTool(
    "pterodactyl_admin_list_allocations",
    {
      title: "List Node Allocations (Admin)",
      description: `List all network allocations on a specific node.

Args:
  - node (number): Node ID
  - page (number): Page number (default: 1)
  - per_page (number): Items per page (default: 25)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')`,
      inputSchema: NodeIdentifier.merge(PaginationParams).extend({ response_format: ResponseFormat }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ node: nodeId, page, per_page, response_format }) => {
      try {
        const data = await client.appGet<PterodactylListResponse<NodeAllocation>>(`nodes/${nodeId}/allocations`, { page, per_page });
        if (!data.data.length) {
          return { content: [{ type: "text", text: `No allocations found on node ${nodeId}.` }] };
        }

        if (response_format === "markdown") {
          const lines = [`# Allocations for Node ${nodeId} (Total: ${data.meta.pagination.total})`, ""];
          for (const a of data.data) {
            lines.push(`- ${a.ip}:${a.port} (ID: ${a.id}, Assigned: ${a.assigned ? "Yes" : "No"})`);
            if (a.notes) lines.push(`  Notes: ${a.notes}`);
          }
          lines.push("", `Has more pages: ${data.meta.pagination.current_page < data.meta.pagination.total_pages}`);
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

  // ── Create Allocations on Node ──
  server.registerTool(
    "pterodactyl_admin_create_allocations",
    {
      title: "Create Node Allocations (Admin)",
      description: `Create new IP:Port allocations on a node.

Ports can be single ports or ranges (e.g., '25565' or '25565-25570').

Args:
  - node (number): Node ID
  - ip (string): IP address for the allocations
  - ports (string[]): Array of ports or port ranges
  - alias (string, optional): IP alias`,
      inputSchema: CreateAllocationsSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ node: nodeId, ip, ports, alias }) => {
      try {
        const body: Record<string, unknown> = { ip, ports };
        if (alias) body.alias = alias;
        await client.appPost(`nodes/${nodeId}/allocations`, body);
        return { content: [{ type: "text", text: `Allocations created on node ${nodeId} for ${ip} with ${ports.length} port range(s).` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Delete Allocation ──
  server.registerTool(
    "pterodactyl_admin_delete_allocation",
    {
      title: "Delete Node Allocation (Admin)",
      description: `Delete a specific allocation from a node.

Args:
  - node (number): Node ID
  - allocation (number): Allocation ID to delete`,
      inputSchema: NodeIdentifier.extend({
        allocation: z.number().int().positive().describe("Allocation ID to delete"),
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ node: nodeId, allocation }) => {
      try {
        await client.appDelete(`nodes/${nodeId}/allocations/${allocation}`);
        return { content: [{ type: "text", text: `Allocation ${allocation} deleted from node ${nodeId}.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );
}
