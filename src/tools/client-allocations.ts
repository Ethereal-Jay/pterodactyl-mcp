import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  PterodactylClient,
  handleApiError,
} from "../api-client.js";
import { type PterodactylResponse, type Allocation } from "../types.js";
import {
  ResponseFormat,
  ServerIdentifier,
  AssignAllocationSchema,
  AllocationIdentifier,
} from "../schemas.js";

export function registerClientAllocationTools(server: McpServer, client: PterodactylClient) {
  // ── List Allocations ──
  server.registerTool(
    "pterodactyl_list_allocations",
    {
      title: "List Server Allocations",
      description: `List all network allocations (IP:Port) assigned to a server.

Returns IP addresses, ports, notes, and whether each is the default allocation.

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
        const { data: allocs } = await client.clientGet<Allocation[]>(`servers/${serverId}/network/allocations`);
        if (!allocs.length) {
          return { content: [{ type: "text", text: `No allocations found on server ${serverId}.` }] };
        }

        if (response_format === "markdown") {
          const lines = [`# Allocations for Server ${serverId}`, ""];
          for (const a of allocs) {
            const def = a.is_default ? " **[DEFAULT]**" : "";
            lines.push(`- ${a.ip}:${a.port}${def} (ID: ${a.id})`);
            if (a.notes) lines.push(`  Notes: ${a.notes}`);
            if (a.alias) lines.push(`  Alias: ${a.alias}`);
          }
          return { content: [{ type: "text", text: lines.join("\n") }] };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(allocs, null, 2) }],
          structuredContent: allocs,
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Assign Allocation ──
  server.registerTool(
    "pterodactyl_assign_allocation",
    {
      title: "Assign Network Allocation",
      description: `Assign a new network allocation (IP:Port) to a server.

If ip and port are omitted, the panel will auto-assign from available node allocations.

Args:
  - server (string): Server identifier
  - ip (string, optional): IP address
  - port (number, optional): Port number`,
      inputSchema: AssignAllocationSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ server: serverId, ip, port }) => {
      try {
        const body: Record<string, unknown> = {};
        if (ip) body.ip = ip;
        if (port) body.port = port;
        await client.clientPost(`servers/${serverId}/network/allocations`, body);
        return { content: [{ type: "text", text: `Allocation assigned to server ${serverId}.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Remove Allocation ──
  server.registerTool(
    "pterodactyl_remove_allocation",
    {
      title: "Remove Network Allocation",
      description: `Remove an allocation from a server. The default allocation cannot be removed.

Args:
  - server (string): Server identifier
  - allocation (number): Allocation ID to remove`,
      inputSchema: AllocationIdentifier,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ server: serverId, allocation }) => {
      try {
        await client.clientDelete(`servers/${serverId}/network/allocations/${allocation}`);
        return { content: [{ type: "text", text: `Allocation ${allocation} removed from server ${serverId}.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );
}
