#!/usr/bin/env node
/**
 * MCP Server for Pterodactyl Game Panel.
 *
 * Provides comprehensive tools for managing Pterodactyl servers, files,
 * databases, backups, schedules, allocations, subusers (Client API) and
 * users, servers, nodes, locations, nests/eggs (Application API).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { PterodactylClient } from "./api-client.js";
import { registerClientServerTools } from "./tools/client-servers.js";
import { registerClientFileTools } from "./tools/client-files.js";
import { registerClientDatabaseTools } from "./tools/client-databases.js";
import { registerClientBackupTools } from "./tools/client-backups.js";
import { registerClientScheduleTools } from "./tools/client-schedules.js";
import { registerClientAllocationTools } from "./tools/client-allocations.js";
import { registerClientSubuserTools } from "./tools/client-subusers.js";
import { registerAdminUserTools } from "./tools/admin-users.js";
import { registerAdminServerTools } from "./tools/admin-servers.js";
import { registerAdminNodeTools } from "./tools/admin-nodes.js";
import { registerAdminLocationTools } from "./tools/admin-locations.js";
import { registerAdminNestTools } from "./tools/admin-nests.js";

const server = new McpServer({
  name: "pterodactyl-mcp-server",
  version: "1.0.0",
});

async function main() {
  const panelUrl = process.env.PTERODACTYL_URL;
  const apiKey = process.env.PTERODACTYL_API_KEY;

  if (!panelUrl || !apiKey) {
    console.error(
      "ERROR: PTERODACTYL_URL and PTERODACTYL_API_KEY environment variables are required.\n\n" +
        "Set them before running:\n" +
        "  export PTERODACTYL_URL=https://panel.example.com\n" +
        "  export PTERODACTYL_API_KEY=ptlc_......  # or ptla_......"
    );
    process.exit(1);
  }

  const client = new PterodactylClient(panelUrl, apiKey);

  console.error(`Pterodactyl MCP server starting...`);
  console.error(`Panel URL: ${panelUrl}`);
  console.error(`API type: ${client.apiType}`);
  console.error(`Available namespaces: ${client.apiType === "application" ? "client + admin" : "client"}`);

  registerClientServerTools(server, client);
  registerClientFileTools(server, client);
  registerClientDatabaseTools(server, client);
  registerClientBackupTools(server, client);
  registerClientScheduleTools(server, client);
  registerClientAllocationTools(server, client);
  registerClientSubuserTools(server, client);

  if (client.apiType === "application") {
    registerAdminUserTools(server, client);
    registerAdminServerTools(server, client);
    registerAdminNodeTools(server, client);
    registerAdminLocationTools(server, client);
    registerAdminNestTools(server, client);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("Pterodactyl MCP server running via stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
