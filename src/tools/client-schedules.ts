import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  PterodactylClient,
  handleApiError,
  sc,
} from "../api-client.js";
import { type PterodactylResponse, type PterodactylListResponse, type Schedule } from "../types.js";
import {
  ResponseFormat,
  ServerIdentifier,
  CreateScheduleSchema,
  ScheduleIdentifier,
  UpdateScheduleSchema,
  CreateTaskSchema,
  TaskIdentifier,
} from "../schemas.js";

export function registerClientScheduleTools(server: McpServer, client: PterodactylClient) {
  // ── List Schedules ──
  server.registerTool(
    "pterodactyl_list_schedules",
    {
      title: "List Server Schedules",
      description: `List all schedules for a server.

Returns schedule details including cron settings, active status, and last/next run times.

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
        const resp = await client.clientGet<PterodactylListResponse<Schedule>>(`servers/${serverId}/schedules`);
        const schedules = resp.data.map((item) => item.attributes);
        if (!schedules.length) {
          return { content: [{ type: "text", text: `No schedules found on server ${serverId}.` }] };
        }

        if (response_format === "markdown") {
          const lines = [`# Schedules for Server ${serverId}`, ""];
          for (const s of schedules) {
            const cron = `${s.cron.minute} ${s.cron.hour} ${s.cron.day_of_month} ${s.cron.month} ${s.cron.day_of_week}`;
            lines.push(`## ${s.name} (ID: ${s.id})`);
            lines.push(`- **Cron**: \`${cron}\``);
            lines.push(`- **Active**: ${s.is_active ? "Yes" : "No"}`);
            lines.push(`- **Processing**: ${s.is_processing ? "Yes" : "No"}`);
            lines.push(`- **Only When Online**: ${s.only_when_online ? "Yes" : "No"}`);
            if (s.last_run_at) lines.push(`- **Last Run**: ${s.last_run_at}`);
            if (s.next_run_at) lines.push(`- **Next Run**: ${s.next_run_at}`);
            lines.push("");
          }
          return { content: [{ type: "text", text: lines.join("\n") }] };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(schedules, null, 2) }],
          structuredContent: sc(schedules),
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Get Schedule ──
  server.registerTool(
    "pterodactyl_get_schedule",
    {
      title: "Get Schedule Details",
      description: `Get details of a specific schedule including its tasks.

Args:
  - server (string): Server identifier
  - schedule (number): Schedule ID
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')`,
      inputSchema: ScheduleIdentifier.extend({ response_format: ResponseFormat }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ server: serverId, schedule, response_format }) => {
      try {
        const resp = await client.clientGet<PterodactylResponse<Schedule>>(
          `servers/${serverId}/schedules/${schedule}`
        );
        const s = resp.attributes;

        if (response_format === "markdown") {
          const cron = `${s.cron.minute} ${s.cron.hour} ${s.cron.day_of_month} ${s.cron.month} ${s.cron.day_of_week}`;
          const lines = [
            `# Schedule: ${s.name}`,
            "",
            `**ID**: ${s.id}`,
            `**Cron**: \`${cron}\``,
            `**Active**: ${s.is_active ? "Yes" : "No"}`,
            `**Only When Online**: ${s.only_when_online ? "Yes" : "No"}`,
            s.last_run_at ? `**Last Run**: ${s.last_run_at}` : "",
            s.next_run_at ? `**Next Run**: ${s.next_run_at}` : "",
            "",
          ];

          const tasksRaw = s.relationships?.tasks?.data || [];
          const tasks = tasksRaw.map((t) => t.attributes);
          if (tasks.length > 0) {
            lines.push("## Tasks", "");
            for (const t of tasks) {
              lines.push(`- **#${t.sequence_id}**: ${t.action} -> ${t.payload} (offset: ${t.time_offset}s)`);
            }
          }
          return { content: [{ type: "text", text: lines.join("\n") }] };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(s, null, 2) }],
          structuredContent: sc(s),
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Create Schedule ──
  server.registerTool(
    "pterodactyl_create_schedule",
    {
      title: "Create Server Schedule",
      description: `Create a new schedule for a server with cron timing.

Tasks must be added separately with create_schedule_task.

Args:
  - server (string): Server identifier
  - name (string): Schedule name
  - minute, hour, day_of_month, month, day_of_week (string): Cron fields (default: '*' for each)
  - is_active (boolean): Initially active (default: true)
  - only_when_online (boolean): Only run when server is online (default: true)`,
      inputSchema: CreateScheduleSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const body = {
          name: params.name,
          minute: params.minute,
          hour: params.hour,
          day_of_month: params.day_of_month,
          month: params.month,
          day_of_week: params.day_of_week,
          is_active: params.is_active,
          only_when_online: params.only_when_online,
        };
        const resp = await client.clientPost<PterodactylResponse<Schedule>>(
          `servers/${params.server}/schedules`,
          body
        );
        const s = resp.attributes;
        return {
          content: [{ type: "text", text: `Schedule '${params.name}' created on server ${params.server} (ID: ${s.id}).` }],
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Update Schedule ──
  server.registerTool(
    "pterodactyl_update_schedule",
    {
      title: "Update Server Schedule",
      description: `Update an existing schedule's configuration.

Only provide the fields you want to change.

Args:
  - server (string): Server identifier
  - schedule (number): Schedule ID
  - (optional) name, minute, hour, day_of_month, month, day_of_week, is_active, only_when_online`,
      inputSchema: UpdateScheduleSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ server: serverId, schedule, ...updates }) => {
      try {
        const body: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(updates)) {
          if (value !== undefined) body[key] = value;
        }
        await client.clientPost(`servers/${serverId}/schedules/${schedule}`, body);
        return { content: [{ type: "text", text: `Schedule ${schedule} updated on server ${serverId}.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Delete Schedule ──
  server.registerTool(
    "pterodactyl_delete_schedule",
    {
      title: "Delete Server Schedule",
      description: `Delete a schedule and all its tasks.

Args:
  - server (string): Server identifier
  - schedule (number): Schedule ID to delete`,
      inputSchema: ScheduleIdentifier.strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ server: serverId, schedule }) => {
      try {
        await client.clientDelete(`servers/${serverId}/schedules/${schedule}`);
        return { content: [{ type: "text", text: `Schedule ${schedule} deleted from server ${serverId}.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Create Schedule Task ──
  server.registerTool(
    "pterodactyl_create_schedule_task",
    {
      title: "Create Schedule Task",
      description: `Add a task to an existing schedule.

Task actions:
- 'command': Runs a console command (payload is the command string)
- 'power': Sends a power action (payload is start/stop/restart/kill)
- 'backup': Creates a backup (payload is comma-separated ignored files or empty)

Args:
  - server (string): Server identifier
  - schedule (number): Schedule ID
  - action ('command' | 'power' | 'backup'): Task action type
  - payload (string): Action payload
  - time_offset (number): Seconds after schedule start (default: 0)
  - continue_on_failure (boolean): Continue subsequent tasks on failure (default: false)`,
      inputSchema: CreateTaskSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ server: serverId, schedule, action, payload, time_offset, continue_on_failure }) => {
      try {
        const body = { action, payload, time_offset, continue_on_failure };
        await client.clientPost(`servers/${serverId}/schedules/${schedule}/tasks`, body);
        return { content: [{ type: "text", text: `Task '${action}' added to schedule ${schedule} on server ${serverId}.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Delete Schedule Task ──
  server.registerTool(
    "pterodactyl_delete_schedule_task",
    {
      title: "Delete Schedule Task",
      description: `Remove a task from a schedule.

Args:
  - server (string): Server identifier
  - schedule (number): Schedule ID
  - task (number): Task ID to delete`,
      inputSchema: TaskIdentifier,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ server: serverId, schedule, task }) => {
      try {
        await client.clientDelete(`servers/${serverId}/schedules/${schedule}/tasks/${task}`);
        return { content: [{ type: "text", text: `Task ${task} deleted from schedule ${schedule} on server ${serverId}.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );
}
