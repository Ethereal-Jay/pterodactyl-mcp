import { z } from "zod";

export const ResponseFormat = z
  .nativeEnum({ markdown: "markdown" as const, json: "json" as const })
  .default("markdown")
  .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable");

export const PaginationParams = z.object({
  page: z.number().int().min(1).default(1).describe("Page number (1-based)"),
  per_page: z.number().int().min(1).max(100).default(25).describe("Items per page (max 100)"),
});

export type PaginationParams = z.infer<typeof PaginationParams>;

export const ServerIdentifier = z.object({
  server: z.string().min(1).describe("Server identifier (short ID like 'abc12345')"),
});

// --- Client: Server ---

export const PowerActionSchema = ServerIdentifier.extend({
  signal: z
    .nativeEnum({ start: "start" as const, stop: "stop" as const, restart: "restart" as const, kill: "kill" as const })
    .describe("Power action to perform on the server"),
}).strict();

export const ConsoleCommandSchema = ServerIdentifier.extend({
  command: z.string().min(1).describe("Console command to send to the server"),
}).strict();

export const RenameServerSchema = ServerIdentifier.extend({
  name: z.string().min(1).max(191).describe("New name for the server"),
  description: z.string().optional().describe("New description (optional)"),
}).strict();

// --- Client: Files ---

export const ListFilesSchema = ServerIdentifier.extend({
  directory: z.string().default("/").describe("Directory path to list (default: root '/')"),
}).strict();

export const ReadFileSchema = ServerIdentifier.extend({
  file: z.string().min(1).describe("Full file path to read"),
}).strict();

export const WriteFileSchema = ServerIdentifier.extend({
  file: z.string().min(1).describe("Full file path to write to"),
  content: z.string().describe("File content to write"),
}).strict();

export const DeleteFilesSchema = ServerIdentifier.extend({
  root: z.string().default("/").describe("Root directory for relative paths"),
  files: z.array(z.string()).min(1).describe("Array of file/directory paths to delete"),
}).strict();

export const CreateFolderSchema = ServerIdentifier.extend({
  root: z.string().default("/").describe("Root directory"),
  name: z.string().min(1).describe("Folder name to create"),
}).strict();

export const CopyFileSchema = ServerIdentifier.extend({
  location: z.string().min(1).describe("Full path of the file/directory to copy"),
}).strict();

export const CompressFilesSchema = ServerIdentifier.extend({
  root: z.string().default("/").describe("Root directory for relative paths"),
  files: z.array(z.string()).min(1).describe("Array of file/directory paths to compress"),
}).strict();

export const DecompressFileSchema = ServerIdentifier.extend({
  root: z.string().default("/").describe("Root directory"),
  file: z.string().min(1).describe("Full path to the archive to decompress"),
}).strict();

export const UploadFileSchema = ServerIdentifier.extend({
  directory: z.string().default("/").describe("Target directory on the server (default: '/')"),
  file_name: z.string().min(1).describe("Name for the uploaded file (e.g. 'server.properties')"),
  content: z.string().min(1).describe("Base64-encoded file content"),
}).strict();

// --- Client: Databases ---

export const CreateDatabaseSchema = ServerIdentifier.extend({
  database: z.string().min(1).max(48).describe("Database name (max 48 chars)"),
  remote: z.string().default("%").describe("Remote connection host (default '%' = any)"),
}).strict();

export const DatabaseIdentifier = ServerIdentifier.extend({
  db: z.number().int().positive().describe("Database ID"),
}).strict();

// --- Client: Backups ---

export const CreateBackupSchema = ServerIdentifier.extend({
  name: z.string().optional().describe("Optional name for the backup"),
  is_locked: z.boolean().optional().describe("If true, backup cannot be deleted until unlocked"),
}).strict();

export const BackupIdentifier = ServerIdentifier.extend({
  backup: z.string().uuid().describe("Backup UUID"),
}).strict();

export const RestoreBackupSchema = ServerIdentifier.extend({
  backup: z.string().uuid().describe("Backup UUID to restore"),
  truncate: z.boolean().optional().describe("If true, delete all files first before restoring"),
}).strict();

export const LockBackupSchema = ServerIdentifier.extend({
  backup: z.string().uuid().describe("Backup UUID to lock/unlock"),
}).strict();

// --- Client: Schedules ---

export const CreateScheduleSchema = z.object({
  server: z.string().min(1).describe("Server identifier"),
  name: z.string().min(1).max(191).describe("Schedule name"),
  minute: z.string().default("*").describe("Cron minute (e.g., '*/5', '0')"),
  hour: z.string().default("*").describe("Cron hour (e.g., '*' or '3')"),
  day_of_month: z.string().default("*").describe("Cron day of month"),
  month: z.string().default("*").describe("Cron month"),
  day_of_week: z.string().default("*").describe("Cron day of week"),
  is_active: z.boolean().default(true).describe("Whether the schedule is active"),
  only_when_online: z.boolean().default(true).describe("Only execute when server is online"),
}).strict();

export const ScheduleIdentifier = ServerIdentifier.extend({
  schedule: z.number().int().positive().describe("Schedule ID"),
}).strict();

export const UpdateScheduleSchema = ServerIdentifier.extend({
  schedule: z.number().int().positive().describe("Schedule ID"),
  name: z.string().min(1).max(191).optional().describe("New schedule name"),
  minute: z.string().optional().describe("Cron minute"),
  hour: z.string().optional().describe("Cron hour"),
  day_of_month: z.string().optional().describe("Cron day of month"),
  month: z.string().optional().describe("Cron month"),
  day_of_week: z.string().optional().describe("Cron day of week"),
  is_active: z.boolean().optional().describe("Whether schedule is active"),
  only_when_online: z.boolean().optional().describe("Only execute when online"),
}).strict();

export const CreateTaskSchema = ServerIdentifier.extend({
  schedule: z.number().int().positive().describe("Schedule ID"),
  action: z
    .nativeEnum({ command: "command" as const, power: "power" as const, backup: "backup" as const })
    .describe("Task action: 'command' (console cmd), 'power' (start/stop/restart/kill), or 'backup'"),
  payload: z
    .string()
    .min(1)
    .describe("Payload: console command (if action='command'), power signal (if action='power'), or ignored files (if action='backup')"),
  time_offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Seconds offset from schedule start (default 0)"),
  continue_on_failure: z.boolean().default(false).describe("Continue subsequent tasks if this one fails"),
}).strict();

export const TaskIdentifier = ServerIdentifier.extend({
  schedule: z.number().int().positive().describe("Schedule ID"),
  task: z.number().int().positive().describe("Task ID"),
}).strict();

// --- Client: Allocations ---

export const AssignAllocationSchema = ServerIdentifier.extend({
  ip: z.string().optional().describe("IP address for the allocation (optional, uses node defaults)"),
  port: z.number().int().optional().describe("Port for the allocation (optional, auto-assigns)"),
}).strict();

export const AllocationIdentifier = ServerIdentifier.extend({
  allocation: z.number().int().positive().describe("Allocation ID"),
}).strict();

// --- Client: Subusers ---

export const CreateSubuserSchema = ServerIdentifier.extend({
  email: z.string().email().describe("Email of the user to invite as subuser"),
  permissions: z
    .array(z.string())
    .min(1)
    .describe("Array of permission keys to grant"),
}).strict();

export const UpdateSubuserSchema = ServerIdentifier.extend({
  user: z.string().uuid().describe("Subuser UUID"),
  permissions: z.array(z.string()).min(1).describe("Updated array of permission keys"),
}).strict();

export const DeleteSubuserSchema = ServerIdentifier.extend({
  user: z.string().uuid().describe("Subuser UUID to remove"),
}).strict();

// --- Application: Users ---

export const CreateUserSchema = z.object({
  email: z.string().email().describe("User email address"),
  username: z.string().min(1).max(191).describe("Username"),
  first_name: z.string().min(1).max(191).describe("First name"),
  last_name: z.string().min(1).max(191).describe("Last name"),
  password: z.string().min(8).optional().describe("Password (auto-generated if not provided)"),
  root_admin: z.boolean().optional().describe("Whether user is a root admin"),
  external_id: z.string().optional().describe("External ID for SSO integration"),
}).strict();

export const UpdateUserSchema = z.object({
  user: z.number().int().positive().describe("User ID to update"),
  email: z.string().email().optional().describe("New email"),
  username: z.string().min(1).max(191).optional().describe("New username"),
  first_name: z.string().min(1).max(191).optional().describe("New first name"),
  last_name: z.string().min(1).max(191).optional().describe("New last name"),
  password: z.string().min(8).optional().describe("New password"),
  root_admin: z.boolean().optional().describe("Set root admin status"),
  language: z.string().optional().describe("Language code (e.g., 'en')"),
}).strict();

export const UserIdentifier = z.object({
  user: z.union([z.number().int().positive(), z.string()]).describe("User ID (number) or external ID (string)"),
});

// --- Application: Servers ---

export const CreateServerSchema = z.object({
  name: z.string().min(1).max(191).describe("Server name"),
  user: z.number().int().positive().describe("Owner user ID"),
  egg: z.number().int().positive().describe("Egg ID for the server"),
  docker_image: z.string().optional().describe("Docker image (defaults to egg default)"),
  startup: z.string().optional().describe("Startup command (overrides egg default)"),
  environment: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional().describe("Environment variables"),
  limits: z
    .object({
      memory: z.number().int().min(0).describe("Memory limit in MiB"),
      swap: z.number().int().min(-1).default(0).describe("Swap limit in MiB (-1 for unlimited)"),
      disk: z.number().int().min(0).describe("Disk limit in MiB"),
      io: z.number().int().min(10).max(1000).default(500).describe("IO weight (10-1000)"),
      cpu: z.number().int().min(0).describe("CPU limit in %"),
      threads: z.number().int().optional().describe("CPU threads/pinning"),
      oom_disabled: z.boolean().optional().describe("Disable OOM killer"),
    })
    .describe("Resource limits"),
  feature_limits: z
    .object({
      databases: z.number().int().min(0).default(0).describe("Max databases"),
      allocations: z.number().int().min(0).default(0).describe("Max allocations"),
      backups: z.number().int().min(0).default(0).describe("Max backups"),
    })
    .describe("Feature limits"),
  allocation: z
    .object({
      default: z.number().int().positive().describe("Default allocation ID"),
      additional: z.array(z.number().int().positive()).optional().describe("Additional allocation IDs"),
    })
    .optional()
    .describe("Allocation configuration"),
  deploy: z
    .object({
      locations: z.array(z.number().int().positive()).min(1).describe("Location IDs to deploy"),
    })
    .optional()
    .describe("Deployment config"),
}).strict();

export const UpdateServerDetailsSchema = z.object({
  server: z.number().int().positive().describe("Server ID"),
  name: z.string().min(1).max(191).optional().describe("New server name"),
  user: z.number().int().positive().optional().describe("New owner user ID"),
  external_id: z.string().optional().describe("New external ID"),
  description: z.string().optional().describe("New description"),
}).strict();

export const UpdateServerBuildSchema = z.object({
  server: z.number().int().positive().describe("Server ID"),
  allocation: z.number().int().positive().optional().describe("New default allocation ID"),
  memory: z.number().int().min(0).optional().describe("Memory in MiB"),
  swap: z.number().int().min(-1).optional().describe("Swap in MiB"),
  disk: z.number().int().min(0).optional().describe("Disk in MiB"),
  io: z.number().int().min(10).max(1000).optional().describe("IO weight"),
  cpu: z.number().int().min(0).optional().describe("CPU limit in %"),
  threads: z.number().int().optional().describe("CPU threads"),
  oom_disabled: z.boolean().optional().describe("Disable OOM killer"),
  feature_limits: z
    .object({
      databases: z.number().int().min(0).optional(),
      allocations: z.number().int().min(0).optional(),
      backups: z.number().int().min(0).optional(),
    })
    .optional(),
  add_allocations: z.array(z.number().int().positive()).optional().describe("Allocation IDs to add"),
  remove_allocations: z.array(z.number().int().positive()).optional().describe("Allocation IDs to remove"),
}).strict();

export const UpdateServerStartupSchema = z.object({
  server: z.number().int().positive().describe("Server ID"),
  startup: z.string().optional().describe("New startup command"),
  environment: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional().describe("Environment variables"),
  egg: z.number().int().positive().optional().describe("New egg ID"),
  image: z.string().optional().describe("New Docker image"),
  skip_scripts: z.boolean().optional().describe("Skip install scripts"),
}).strict();

export const AdminServerIdentifier = z.object({
  server: z.number().int().positive().describe("Server ID"),
});

// --- Application: Nodes ---

export const CreateNodeSchema = z.object({
  name: z.string().min(1).max(191).describe("Node name"),
  location_id: z.number().int().positive().describe("Location ID"),
  fqdn: z.string().min(1).describe("Fully qualified domain name"),
  scheme: z.string().default("https").describe("HTTP scheme (http/https)"),
  behind_proxy: z.boolean().default(false).describe("Whether node is behind a proxy"),
  public: z.boolean().default(true).describe("Whether node is public"),
  memory: z.number().int().min(0).describe("Total memory in MiB"),
  memory_overallocate: z.number().int().min(-1).default(0).describe("Memory overallocation % (-1 unlimited)"),
  disk: z.number().int().min(0).describe("Total disk in MiB"),
  disk_overallocate: z.number().int().min(-1).default(0).describe("Disk overallocation % (-1 unlimited)"),
  upload_size: z.number().int().min(1).default(100).describe("Max upload size in MiB"),
  daemon_sftp: z.number().int().default(2022).describe("SFTP port"),
  daemon_listen: z.number().int().default(8080).describe("Wings daemon port"),
  description: z.string().optional().describe("Node description"),
  maintenance_mode: z.boolean().default(false).describe("Maintenance mode"),
}).strict();

export const UpdateNodeSchema = z.object({
  node: z.number().int().positive().describe("Node ID to update"),
  name: z.string().min(1).max(191).optional(),
  location_id: z.number().int().positive().optional(),
  fqdn: z.string().min(1).optional(),
  scheme: z.string().optional(),
  behind_proxy: z.boolean().optional(),
  public: z.boolean().optional(),
  memory: z.number().int().min(0).optional(),
  memory_overallocate: z.number().int().min(-1).optional(),
  disk: z.number().int().min(0).optional(),
  disk_overallocate: z.number().int().min(-1).optional(),
  upload_size: z.number().int().min(1).optional(),
  daemon_sftp: z.number().int().optional(),
  daemon_listen: z.number().int().optional(),
  description: z.string().optional(),
  maintenance_mode: z.boolean().optional(),
}).strict();

export const NodeIdentifier = z.object({
  node: z.number().int().positive().describe("Node ID"),
});

export const CreateAllocationsSchema = NodeIdentifier.extend({
  ip: z.string().min(1).describe("IP address for the allocations"),
  ports: z.array(z.string()).min(1).describe("Array of port ranges (e.g., ['25565', '25566-25570'])"),
  alias: z.string().optional().describe("IP alias"),
}).strict();

// --- Application: Locations ---

export const CreateLocationSchema = z.object({
  short: z.string().min(1).max(60).describe("Short location code (e.g., 'us-east')"),
  long: z.string().optional().describe("Long description (e.g., 'US East Coast')"),
}).strict();

export const UpdateLocationSchema = z.object({
  location: z.number().int().positive().describe("Location ID to update"),
  short: z.string().min(1).max(60).optional().describe("New short code"),
  long: z.string().optional().describe("New description"),
}).strict();

export const LocationIdentifier = z.object({
  location: z.number().int().positive().describe("Location ID"),
});

// --- Application: Nests/Eggs ---

export const NestIdentifier = z.object({
  nest: z.number().int().positive().describe("Nest ID"),
});

export const EggIdentifier = NestIdentifier.extend({
  egg: z.number().int().positive().describe("Egg ID"),
});

// --- Filter parameters for list endpoints ---

export const FilterParams = z.object({
  filter: z.record(z.string(), z.string()).optional().describe("Filter by field values (e.g., {name: 'server1', email: 'user@example.com'})"),
  include: z.string().optional().describe("Comma-separated list of relationships to include"),
  sort: z.string().optional().describe("Sort field (prefix with '-' for descending, e.g., '-created_at')"),
});
