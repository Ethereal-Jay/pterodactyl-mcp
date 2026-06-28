# Pterodactyl MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server for managing [Pterodactyl Game Panel](https://pterodactyl.io) servers via both the Client API and Application API.

## Features

- **Client API** — manage your own servers: power actions, files, databases, backups, schedules, allocations, subusers
- **Application API** — admin operations: users, servers, nodes, locations, nests/eggs (auto-detected from `ptla_` key prefix)
- Markdown (default) and JSON output formats on all read tools
- Each tool is fully documented with descriptions, input schemas, and annotations (readOnly, destructive, idempotent hints)

## Prerequisites

- Node.js 18+
- A Pterodactyl panel URL
- A Pterodactyl API key (Client: `ptlc_...` or Application: `ptla_...`)

## Setup

```bash
npm install
npm run build
```

## Usage

Set environment variables and start the server:

```bash
export PTERODACTYL_URL=https://panel.yourdomain.com
export PTERODACTYL_API_KEY=ptlc_your_api_key_here
npm start
```

For development with hot reload:

```bash
npm run dev
```

### MCP Client Configuration

Add to your MCP client config (e.g. `~/.config/opencode/mcp.json`):

```json
{
  "mcpServers": {
    "pterodactyl": {
      "command": "node",
      "args": ["/path/to/pterodactyl-mcp-server/dist/index.js"],
      "env": {
        "PTERODACTYL_URL": "https://panel.yourdomain.com",
        "PTERODACTYL_API_KEY": "ptlc_your_api_key_here"
      }
    }
  }
}
```

## Tools

### Client API (Server Management)

| Tool | Description |
|------|-------------|
| `pterodactyl_list_servers` | List all servers on your account |
| `pterodactyl_get_server` | Get detailed server info |
| `pterodactyl_get_server_resources` | Get real-time CPU, memory, disk usage |
| `pterodactyl_send_power_action` | Start, stop, restart, or kill a server |
| `pterodactyl_send_console_command` | Send a command to the server console |
| `pterodactyl_rename_server` | Rename a server and update its description |
| `pterodactyl_reinstall_server` | Trigger a reinstall of the server |
| `pterodactyl_get_websocket` | Get WebSocket token/socket URL for console access |
| `pterodactyl_get_console` | Retrieve recent console output via WebSocket |
| `pterodactyl_get_account` | Get authenticated account details |

**Files:**

| Tool | Description |
|------|-------------|
| `pterodactyl_list_files` | List files and directories |
| `pterodactyl_read_file` | Read a file's contents |
| `pterodactyl_write_file` | Write content to a file |
| `pterodactyl_upload_file` | Upload a file (base64 or local path) |
| `pterodactyl_pull_file` | Download a file from a URL directly to the server |
| `pterodactyl_create_folder` | Create a new directory |
| `pterodactyl_delete_files` | Delete files or directories |
| `pterodactyl_copy_file` | Copy a file or directory |
| `pterodactyl_compress_files` | Create a tar.gz archive |
| `pterodactyl_decompress_file` | Extract a tar.gz or zip archive |

**Databases:**

| Tool | Description |
|------|-------------|
| `pterodactyl_list_databases` | List server databases |
| `pterodactyl_create_database` | Create a new database |
| `pterodactyl_rotate_database_password` | Rotate a database password |
| `pterodactyl_delete_database` | Delete a database |

**Backups:**

| Tool | Description |
|------|-------------|
| `pterodactyl_list_backups` | List server backups |
| `pterodactyl_create_backup` | Create a new backup |
| `pterodactyl_get_backup` | Get backup details |
| `pterodactyl_download_backup` | Get a backup download URL |
| `pterodactyl_restore_backup` | Restore a backup |
| `pterodactyl_lock_backup` | Lock/unlock a backup |
| `pterodactyl_delete_backup` | Delete a backup |

**Schedules:**

| Tool | Description |
|------|-------------|
| `pterodactyl_list_schedules` | List schedules with cron details |
| `pterodactyl_get_schedule` | Get schedule details including tasks |
| `pterodactyl_create_schedule` | Create a schedule |
| `pterodactyl_update_schedule` | Update schedule config |
| `pterodactyl_delete_schedule` | Delete a schedule |
| `pterodactyl_create_schedule_task` | Add a task to a schedule |
| `pterodactyl_delete_schedule_task` | Remove a task from a schedule |

**Allocations:**

| Tool | Description |
|------|-------------|
| `pterodactyl_list_allocations` | List server allocations |
| `pterodactyl_create_allocation` | Assign a new allocation |
| `pterodactyl_set_primary_allocation` | Set the primary allocation |
| `pterodactyl_delete_allocation` | Remove an allocation |

**Subusers:**

| Tool | Description |
|------|-------------|
| `pterodactyl_list_subusers` | List subusers with permissions |
| `pterodactyl_create_subuser` | Invite a subuser |
| `pterodactyl_update_subuser` | Update subuser permissions |
| `pterodactyl_delete_subuser` | Remove a subuser |

### Application API (Admin)

Requires an Application API key (`ptla_...`).

**Users:**

| Tool | Description |
|------|-------------|
| `pterodactyl_admin_list_users` | List all panel users (with filters) |
| `pterodactyl_admin_get_user` | Get user details |
| `pterodactyl_admin_create_user` | Create a new user |
| `pterodactyl_admin_update_user` | Update a user |
| `pterodactyl_admin_delete_user` | Delete a user |

**Servers:**

| Tool | Description |
|------|-------------|
| `pterodactyl_admin_list_servers` | List all servers (with filters) |
| `pterodactyl_admin_get_server` | Get server details |
| `pterodactyl_admin_create_server` | Create a server |
| `pterodactyl_admin_update_server_details` | Update server name, owner, description |
| `pterodactyl_admin_update_server_build` | Update server resources and allocations |
| `pterodactyl_admin_update_server_startup` | Update startup config, egg, image |
| `pterodactyl_admin_suspend_server` | Suspend a server |
| `pterodactyl_admin_unsuspend_server` | Unsuspend a server |
| `pterodactyl_admin_reinstall_server` | Trigger a reinstall of the server |
| `pterodactyl_admin_delete_server` | Delete a server |

**Nodes:**

| Tool | Description |
|------|-------------|
| `pterodactyl_admin_list_nodes` | List all nodes (with filters) |
| `pterodactyl_admin_get_node` | Get node details |
| `pterodactyl_admin_create_node` | Create a new node |
| `pterodactyl_admin_update_node` | Update a node |
| `pterodactyl_admin_delete_node` | Delete a node |
| `pterodactyl_admin_get_node_configuration` | Get node wings configuration |
| `pterodactyl_admin_list_allocations` | List node allocations |
| `pterodactyl_admin_create_allocations` | Create allocations on a node |
| `pterodactyl_admin_delete_allocation` | Delete an allocation |

**Locations:**

| Tool | Description |
|------|-------------|
| `pterodactyl_admin_list_locations` | List all locations |
| `pterodactyl_admin_get_location` | Get location details |
| `pterodactyl_admin_create_location` | Create a location |
| `pterodactyl_admin_update_location` | Update a location |
| `pterodactyl_admin_delete_location` | Delete a location |

**Nests & Eggs:**

| Tool | Description |
|------|-------------|
| `pterodactyl_admin_list_nests` | List all nests |
| `pterodactyl_admin_get_nest` | Get nest details (with eggs) |
| `pterodactyl_admin_list_eggs` | List eggs in a nest |
| `pterodactyl_admin_get_egg` | Get egg details (with variables) |

## Output Formats

All read tools accept an optional `response_format` parameter:
- `markdown` (default) — human-readable tables and lists
- `json` — raw JSON for programmatic use

## API Key Types

| Prefix | Type | Available Tools |
|--------|------|----------------|
| `ptlc_` | Client API | Server management, files, databases, backups, schedules, allocations, subusers |
| `ptla_` | Application API | Everything above + admin tools (users, servers, nodes, locations, nests) |
