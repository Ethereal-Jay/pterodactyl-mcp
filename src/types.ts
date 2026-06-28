export interface PaginationMeta {
  pagination: {
    total: number;
    count: number;
    per_page: number;
    current_page: number;
    total_pages: number;
    links: Record<string, string>;
  };
}

/** A single Pterodactyl API resource — body shape is `{ object, attributes, meta?, relationships? }`. */
export interface PterodactylResponse<T> {
  object: string;
  attributes: T;
  meta?: Record<string, unknown>;
  relationships?: Record<string, unknown>;
}

/** A wrapper entry inside `PterodactylListResponse.data` arrays. */
export interface PterodactylResource<T> {
  object: string;
  attributes: T;
  meta?: Record<string, unknown>;
  relationships?: Record<string, unknown>;
}

/** A Pterodactyl API collection — body shape is `{ object: "list", data: PterodactylResource<T>[], meta }`. */
export interface PterodactylListResponse<T> {
  object: "list";
  data: PterodactylResource<T>[];
  meta: PaginationMeta;
}

export interface ServerLimits {
  memory: number;
  swap: number;
  disk: number;
  io: number;
  cpu: number;
  threads: number | null;
  oom_disabled: boolean;
}

export interface ServerFeatureLimits {
  databases: number;
  allocations: number;
  backups: number;
}

export interface ServerContainer {
  startup_command: string;
  image: string;
  installed: boolean;
  environment: Record<string, string | number | boolean>;
}

export interface ServerSftpDetails {
  ip: string;
  port: number;
}

export interface ServerAllocation {
  id: number;
  ip: string;
  alias: string | null;
  port: number;
  notes: string | null;
  is_default: boolean;
  assigned: boolean;
}

export interface Server {
  id: number;
  external_id: string | null;
  uuid: string;
  identifier: string;
  name: string;
  description: string;
  status: string | null;
  suspended: boolean;
  limits: ServerLimits;
  feature_limits: ServerFeatureLimits;
  user: number;
  node: number;
  allocation: number;
  nest: number;
  egg: number;
  container: ServerContainer;
  sftp_details: ServerSftpDetails;
  created_at: string;
  updated_at: string;
}

export interface ClientServer {
  server_owner: boolean;
  identifier: string;
  internal_id: number;
  uuid: string;
  name: string;
  node: string;
  is_node_under_maintenance: boolean;
  sftp_details: ServerSftpDetails;
  description: string;
  limits: ServerLimits;
  invocation: string;
  docker_image: string;
  egg_features: string[];
  feature_limits: ServerFeatureLimits;
  is_suspended: boolean;
  is_installing: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServerResources {
  current_state: string;
  is_suspended: boolean;
  resources: {
    memory_bytes: number;
    cpu_absolute: number;
    disk_bytes: number;
    network_rx_bytes: number;
    network_tx_bytes: number;
    uptime: number;
    memory_limit_bytes: number;
  };
}

export interface FileObject {
  name: string;
  mode: string;
  mode_bits: string;
  size: number;
  is_file: boolean;
  is_symlink: boolean;
  is_editable: boolean;
  mimetype: string;
  created_at: string;
  modified_at: string;
}

export interface Database {
  id: number;
  host: {
    address: string;
    port: number;
  };
  name: string;
  username: string;
  remote: string;
  max_connections: number;
  relationships?: {
    password?: {
      object: string;
      attributes: {
        password: string;
      };
    };
  };
}

export interface DatabasePassword {
  password: string;
}

export interface Backup {
  uuid: string;
  name: string;
  ignored_files: string[];
  sha256_hash: string | null;
  bytes: number;
  created_at: string;
  completed_at: string | null;
  is_successful: boolean;
  is_locked: boolean;
}

export interface ScheduleTask {
  id: number;
  sequence_id: number;
  action: string;
  payload: string;
  time_offset: number;
  is_queued: boolean;
  continue_on_failure: boolean;
  created_at: string;
  updated_at: string;
}

export interface Schedule {
  id: number;
  name: string;
  cron: {
    minute: string;
    hour: string;
    day_of_month: string;
    month: string;
    day_of_week: string;
  };
  is_active: boolean;
  is_processing: boolean;
  only_when_online: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
  relationships?: {
    tasks?: {
      object: "list";
      data: PterodactylResource<ScheduleTask>[];
    };
  };
}

export interface Allocation {
  id: number;
  ip: string;
  alias: string | null;
  port: number;
  notes: string | null;
  is_default: boolean;
}

export interface Subuser {
  uuid: string;
  username: string;
  email: string;
  image: string;
  two_factor_enabled: boolean;
  created_at: string;
  permissions: string[];
}

export interface Account {
  id: number;
  admin: boolean;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  language: string;
}

export interface User {
  id: number;
  external_id: string | null;
  uuid: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  language: string;
  root_admin: boolean;
  two_factor_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface NodeAllocation {
  id: number;
  ip: string;
  alias: string | null;
  port: number;
  notes: string | null;
  assigned: boolean;
}

export interface Node {
  id: number;
  uuid: string;
  public: boolean;
  name: string;
  description: string;
  location_id: number;
  fqdn: string;
  scheme: string;
  behind_proxy: boolean;
  maintenance_mode: boolean;
  memory: number;
  memory_overallocate: number;
  disk: number;
  disk_overallocate: number;
  upload_size: number;
  daemon_listen: number;
  daemon_sftp: number;
  daemon_base: string;
  allocated_resources?: {
    memory: number;
    disk: number;
  };
}

export interface Location {
  id: number;
  short: string;
  long: string;
}

export interface Nest {
  id: number;
  uuid: string;
  author: string;
  name: string;
  description: string;
}

export interface EggVariable {
  name: string;
  description: string;
  env_variable: string;
  default_value: string;
  user_viewable: boolean;
  user_editable: boolean;
  rules: string;
}

export interface Egg {
  id: number;
  uuid: string;
  name: string;
  nest: number;
  author: string;
  description: string;
  docker_image: string;
  docker_images: Record<string, string>;
  config: Record<string, unknown>;
  startup: string;
  script: {
    privileged: boolean;
    install: string;
    entry: string;
    container: string;
    extends: string | null;
  };
  relationships?: {
    variables?: {
      object: "list";
      data: PterodactylResource<EggVariable>[];
    };
    nest?: {
      object: string;
      attributes: Nest;
    };
  };
}

export type PowerAction = "start" | "stop" | "restart" | "kill";
export type TaskAction = "command" | "power" | "backup";
export type DatabaseHost = string;
