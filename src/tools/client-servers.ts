import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  PterodactylClient,
  handleApiError,
  formatBytes,
  formatUptime,
  sc,
} from "../api-client.js";
import {
  type PterodactylResponse,
  type PterodactylListResponse,
  type ClientServer,
  type ServerResources,
  type PowerAction,
  type Account,
} from "../types.js";
import {
  ResponseFormat,
  PowerActionSchema,
  ConsoleCommandSchema,
  RenameServerSchema,
  ServerIdentifier,
} from "../schemas.js";

export function registerClientServerTools(server: McpServer, client: PterodactylClient) {
  // ── List Servers ──
  server.registerTool(
    "pterodactyl_list_servers",
    {
      title: "List Pterodactyl Servers",
      description: `List all servers the authenticated user has access to.

Returns server details including name, identifier, status, limits, and node information.

Args:
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns: List of servers with identifiers, names, statuses, and resource limits.`,
      inputSchema: z.object({
        response_format: ResponseFormat,
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ response_format }) => {
      try {
        const resp = await client.clientGet<PterodactylListResponse<ClientServer>>("");
        const servers = resp.data.map((item) => item.attributes);
        if (!servers.length) {
          return { content: [{ type: "text", text: "No servers found on your account." }] };
        }

        const output = servers.map((s) => ({
          identifier: s.identifier,
          uuid: s.uuid,
          name: s.name,
          description: s.description,
          status: s.is_suspended ? "suspended" : s.is_installing ? "installing" : "running",
          node: s.node,
          limits: s.limits,
          feature_limits: s.feature_limits,
        }));

        let textContent: string;
        if (response_format === "markdown") {
          const lines = ["# Your Pterodactyl Servers", "", `Total: ${servers.length}`, ""];
          for (const s of servers) {
            const status = s.is_suspended ? "Suspended" : s.is_installing ? "Installing" : "Running";
            lines.push(`## ${s.name}`);
            lines.push(`- **Identifier**: ${s.identifier}`);
            lines.push(`- **UUID**: ${s.uuid}`);
            lines.push(`- **Status**: ${status}`);
            lines.push(`- **Node**: ${s.node}`);
            lines.push(`- **Limits**: CPU ${s.limits.cpu}%, Memory ${formatBytes(s.limits.memory * 1024 * 1024)}, Disk ${formatBytes(s.limits.disk * 1024 * 1024)}`);
            lines.push(`- **Features**: ${s.feature_limits.databases} DBs, ${s.feature_limits.allocations} Allocs, ${s.feature_limits.backups} Backups`);
            if (s.description) lines.push(`- **Description**: ${s.description}`);
            lines.push("");
          }
          textContent = lines.join("\n");
        } else {
          textContent = JSON.stringify(output, null, 2);
        }

        return {
          content: [{ type: "text", text: textContent }],
          structuredContent: sc(output),
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Get Server ──
  server.registerTool(
    "pterodactyl_get_server",
    {
      title: "Get Pterodactyl Server Details",
      description: `Get detailed information about a specific server.

Returns full server details including limits, feature limits, SFTP info, and container configuration.

Args:
  - server (string): Server identifier (short ID like 'abc12345')
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
        const resp = await client.clientGet<PterodactylResponse<ClientServer>>(`servers/${serverId}`);
        const srv = resp.attributes;

        if (response_format === "markdown") {
          const status = srv.is_suspended ? "Suspended" : srv.is_installing ? "Installing" : "Running";
          const lines = [
            `# Server: ${srv.name}`,
            "",
            `**Identifier**: ${srv.identifier}`,
            `**UUID**: ${srv.uuid}`,
            `**Status**: ${status}`,
            `**Node**: ${srv.node}`,
            `**Docker Image**: ${srv.docker_image}`,
            `**Owner**: ${srv.server_owner ? "Yes" : "No"}`,
            "",
            "## Limits",
            `- **CPU**: ${srv.limits.cpu}%`,
            `- **Memory**: ${formatBytes(srv.limits.memory * 1024 * 1024)}`,
            `- **Disk**: ${formatBytes(srv.limits.disk * 1024 * 1024)}`,
            `- **Swap**: ${formatBytes(srv.limits.swap * 1024 * 1024)}`,
            `- **IO**: ${srv.limits.io}`,
            "",
            "## Feature Limits",
            `- **Databases**: ${srv.feature_limits.databases}`,
            `- **Allocations**: ${srv.feature_limits.allocations}`,
            `- **Backups**: ${srv.feature_limits.backups}`,
            "",
            "## SFTP",
            `- **Host**: ${srv.sftp_details.ip}`,
            `- **Port**: ${srv.sftp_details.port}`,
            "",
          ];
          if (srv.description) lines.push(`**Description**: ${srv.description}`, "");
          const textContent = lines.join("\n");
          return { content: [{ type: "text", text: textContent }] };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(srv, null, 2) }],
          structuredContent: sc(srv),
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Get Server Resources ──
  server.registerTool(
    "pterodactyl_get_server_resources",
    {
      title: "Get Server Resource Usage",
      description: `Get current resource usage for a server including memory, CPU, disk, and network stats.

Returns real-time resource utilization data. Requires the server to be running.

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
        const r = await client.clientGet<PterodactylResponse<ServerResources>>(`servers/${serverId}/resources`);
        const res = r.attributes;

        if (response_format === "markdown") {
          const memPct = res.resources.memory_limit_bytes > 0
            ? ((res.resources.memory_bytes / res.resources.memory_limit_bytes) * 100).toFixed(1)
            : "N/A";
          const lines = [
            `# Server Resource Usage`,
            "",
            `**State**: ${res.current_state}`,
            `**Suspended**: ${res.is_suspended ? "Yes" : "No"}`,
            "",
            "## Resources",
            `- **Memory**: ${formatBytes(res.resources.memory_bytes)} / ${formatBytes(res.resources.memory_limit_bytes)} (${memPct}%)`,
            `- **CPU**: ${res.resources.cpu_absolute.toFixed(1)}%`,
            `- **Disk**: ${formatBytes(res.resources.disk_bytes)}`,
            `- **Network RX**: ${formatBytes(res.resources.network_rx_bytes)}`,
            `- **Network TX**: ${formatBytes(res.resources.network_tx_bytes)}`,
            `- **Uptime**: ${formatUptime(res.resources.uptime)}`,
          ];
          return { content: [{ type: "text", text: lines.join("\n") }] };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
          structuredContent: sc(res),
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Power Action ──
  server.registerTool(
    "pterodactyl_send_power_action",
    {
      title: "Send Server Power Action",
      description: `Send a power action to a server (start, stop, restart, or kill).

Use 'kill' only when the server is unresponsive to 'stop'.

Args:
  - server (string): Server identifier
  - signal ('start' | 'stop' | 'restart' | 'kill'): Power action to perform`,
      inputSchema: PowerActionSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ server: serverId, signal }) => {
      try {
        await client.clientPost(`servers/${serverId}/power`, { signal });
        return { content: [{ type: "text", text: `Power action '${signal}' sent to server ${serverId} successfully.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Console Command ──
  server.registerTool(
    "pterodactyl_send_console_command",
    {
      title: "Send Console Command",
      description: `Send a command to the server's console.

The server must be running. Commands vary by game/egg (e.g., 'say Hello', 'op username' for Minecraft).

Args:
  - server (string): Server identifier
  - command (string): Console command to execute`,
      inputSchema: ConsoleCommandSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ server: serverId, command }) => {
      try {
        await client.clientPost(`servers/${serverId}/command`, { command });
        return { content: [{ type: "text", text: `Command sent to server ${serverId}: ${command}` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Rename Server ──
  server.registerTool(
    "pterodactyl_rename_server",
    {
      title: "Rename Server",
      description: `Rename a server and optionally update its description.

Args:
  - server (string): Server identifier
  - name (string): New name for the server
  - description (string, optional): New description`,
      inputSchema: RenameServerSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ server: serverId, name, description }) => {
      try {
        const body: Record<string, string> = { name };
        if (description !== undefined) body.description = description;
        await client.clientPost(`servers/${serverId}/settings/rename`, body);
        return { content: [{ type: "text", text: `Server ${serverId} renamed to '${name}'.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Reinstall Server ──
  server.registerTool(
    "pterodactyl_reinstall_server",
    {
      title: "Reinstall Server",
      description: `Trigger a reinstall of the server. This will run the egg's install script.

WARNING: This may delete or overwrite server files depending on the egg configuration.

Args:
  - server (string): Server identifier`,
      inputSchema: ServerIdentifier.strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ server: serverId }) => {
      try {
        await client.clientPost(`servers/${serverId}/settings/reinstall`);
        return { content: [{ type: "text", text: `Reinstall triggered for server ${serverId}.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Get WebSocket ──
  server.registerTool(
    "pterodactyl_get_websocket",
    {
      title: "Get WebSocket Connection Info",
      description: `Get the WebSocket token and socket URL for console access.

Returns a JWT token (valid for 10 minutes) and socket URL for establishing a WebSocket connection to the server console.

Args:
  - server (string): Server identifier`,
      inputSchema: ServerIdentifier.strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ server: serverId }) => {
      try {
        // NOTE: the websocket endpoint is the lone Client API endpoint that
        // returns `{ data: { token, socket } }` rather than `{ attributes: ... }`.
        const resp = await client.clientGet<{ data: { token: string; socket: string } }>(
          `servers/${serverId}/websocket`
        );
        const info = resp.data;
        return {
          content: [{ type: "text", text: JSON.stringify(info, null, 2) }],
          structuredContent: sc(info),
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Get Account ──
  server.registerTool(
    "pterodactyl_get_account",
    {
      title: "Get Account Details",
      description: `Get details about the authenticated user's account.

Returns username, email, name, language, and admin status.

Args:
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')`,
      inputSchema: z.object({ response_format: ResponseFormat }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ response_format }) => {
      try {
        const a = await client.clientGet<PterodactylResponse<Account>>("account");
        const acct = a.attributes;

        if (response_format === "markdown") {
          const lines = [
            `# Account: ${acct.username}`,
            "",
            `**ID**: ${acct.id}`,
            `**Email**: ${acct.email}`,
            `**Name**: ${acct.first_name} ${acct.last_name}`,
            `**Language**: ${acct.language}`,
            `**Admin**: ${acct.admin ? "Yes" : "No"}`,
          ];
          return { content: [{ type: "text", text: lines.join("\n") }] };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(acct, null, 2) }],
          structuredContent: sc(acct),
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );
}
