import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  PterodactylClient,
  handleApiError,
  formatBytes,
  sc,
} from "../api-client.js";
import { type PterodactylListResponse, type FileObject } from "../types.js";
import {
  ResponseFormat,
  ListFilesSchema,
  ReadFileSchema,
  WriteFileSchema,
  DeleteFilesSchema,
  CreateFolderSchema,
  CopyFileSchema,
  CompressFilesSchema,
  DecompressFileSchema,
  UploadFileSchema,
} from "../schemas.js";
import fs from "fs";
import path from "path";
import os from "os";
import FormData from "form-data";

export function registerClientFileTools(server: McpServer, client: PterodactylClient) {
  // ── List Files ──
  server.registerTool(
    "pterodactyl_list_files",
    {
      title: "List Server Files",
      description: `List files and directories in a given directory on the server.

Args:
  - server (string): Server identifier
  - directory (string): Directory path (default: '/')
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')`,
      inputSchema: ListFilesSchema.extend({ response_format: ResponseFormat }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ server: serverId, directory, response_format }) => {
      try {
        const resp = await client.clientGet<PterodactylListResponse<FileObject>>(
          `servers/${serverId}/files/list`,
          { directory }
        );
        const files = resp.data.map((item) => item.attributes);
        if (!files.length) {
          return { content: [{ type: "text", text: `Directory '${directory}' is empty.` }] };
        }

        if (response_format === "markdown") {
          const lines = [`# Files: ${directory}`, ""];
          for (const f of files) {
            const type = f.is_file ? "📄" : "📁";
            const size = f.is_file ? formatBytes(f.size) : "-";
            const perms = f.mode_bits || f.mode;
            lines.push(`- ${type} **${f.name}** (${size}, ${perms})`);
          }
          lines.push("", `Total: ${files.length} items`);
          return { content: [{ type: "text", text: lines.join("\n") }] };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(files, null, 2) }],
          structuredContent: sc({ files: files }),
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Read File ──
  server.registerTool(
    "pterodactyl_read_file",
    {
      title: "Read Server File",
      description: `Read the contents of a file on the server.

Note: For large files, use list_files to check the size first.

Args:
  - server (string): Server identifier
  - file (string): Full path to the file (e.g., '/server.properties')
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')`,
      inputSchema: ReadFileSchema.extend({ response_format: ResponseFormat }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ server: serverId, file: filePath, response_format }) => {
      try {
        // The contents endpoint returns the file body as plain text (not JSON-wrapped).
        const data = await client.clientGet<string>(`servers/${serverId}/files/contents`, { file: filePath });
        const content = typeof data === "string" ? data : JSON.stringify(data, null, 2);

        if (response_format === "markdown") {
          return { content: [{ type: "text", text: `\`\`\`\n# ${filePath}\n${content}\n\`\`\`` }] };
        }
        return { content: [{ type: "text", text: JSON.stringify({ file: filePath, content }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Write File ──
  server.registerTool(
    "pterodactyl_write_file",
    {
      title: "Write Server File",
      description: `Write content to a file on the server. Creates the file if it doesn't exist, overwrites if it does.

Args:
  - server (string): Server identifier
  - file (string): Full path to the file (e.g., '/config.yml')
  - content (string): Content to write to the file`,
      inputSchema: WriteFileSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ server: serverId, file: filePath, content }) => {
      try {
        // LLM tool calls often pass $`\n`$ as literal backslash+n rather than
        // a real newline. Decode JSON-like escape sequences so the file on
        // disk contains actual line breaks, tabs, etc.
        // Order matters: handle $`\\\\`$ (two backslashes) last so it doesn't
        // interfere with $`\\n`$, $`\\t`$, etc.
        content = content
          .replace(/\\n/g, "\n")
          .replace(/\\t/g, "\t")
          .replace(/\\r/g, "\r")
          .replace(/\\\\/g, "\\");
        await client.clientPost(`servers/${serverId}/files/write`, content, { file: filePath }, { "Content-Type": "text/plain" });
        return { content: [{ type: "text", text: `File '${filePath}' written successfully on server ${serverId}.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Create Folder ──
  server.registerTool(
    "pterodactyl_create_folder",
    {
      title: "Create Server Folder",
      description: `Create a new directory on the server.

Args:
  - server (string): Server identifier
  - root (string): Parent directory path (default: '/')
  - name (string): New folder name`,
      inputSchema: CreateFolderSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ server: serverId, root, name }) => {
      try {
        await client.clientPost(`servers/${serverId}/files/create-folder`, { root, name });
        return { content: [{ type: "text", text: `Folder '${name}' created in '${root}' on server ${serverId}.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Delete Files ──
  server.registerTool(
    "pterodactyl_delete_files",
    {
      title: "Delete Server Files",
      description: `Delete one or more files or directories from the server.

WARNING: This action is irreversible. Deleting directories removes all contents recursively.

Args:
  - server (string): Server identifier
  - root (string): Root directory for relative paths (default: '/')
  - files (string[]): Array of file/directory paths to delete`,
      inputSchema: DeleteFilesSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ server: serverId, root, files }) => {
      try {
        await client.clientPost(`servers/${serverId}/files/delete`, { root, files });
        return { content: [{ type: "text", text: `Deleted ${files.length} file(s) from server ${serverId}.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Copy File ──
  server.registerTool(
    "pterodactyl_copy_file",
    {
      title: "Copy Server File/Directory",
      description: `Copy a file or directory on the server. A copy will be created with a numeric suffix (e.g., 'file copy 1').

Args:
  - server (string): Server identifier
  - location (string): Full path of the file or directory to copy`,
      inputSchema: CopyFileSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ server: serverId, location }) => {
      try {
        await client.clientPost(`servers/${serverId}/files/copy`, { location });
        return { content: [{ type: "text", text: `Copied '${location}' on server ${serverId}.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Compress Files ──
  server.registerTool(
    "pterodactyl_compress_files",
    {
      title: "Compress Server Files",
      description: `Create a compressed archive (tar.gz) of specified files/directories.

Args:
  - server (string): Server identifier
  - root (string): Root directory for relative paths (default: '/')
  - files (string[]): Array of file/directory paths to include in the archive`,
      inputSchema: CompressFilesSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ server: serverId, root, files }) => {
      try {
        const resp = await client.clientPost<Record<string, unknown>>(`servers/${serverId}/files/compress`, { root, files });
        return {
          content: [{ type: "text", text: `Archive created on server ${serverId}: ${JSON.stringify(resp)}` }],
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Decompress File ──
  server.registerTool(
    "pterodactyl_decompress_file",
    {
      title: "Decompress Server Archive",
      description: `Extract a compressed archive (tar.gz, zip) on the server.

Args:
  - server (string): Server identifier
  - root (string): Root directory where the archive is located (default: '/')
  - file (string): Full path to the archive file to extract`,
      inputSchema: DecompressFileSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ server: serverId, root, file: archiveFile }) => {
      try {
        await client.clientPost(`servers/${serverId}/files/decompress`, { root, file: archiveFile });
        return { content: [{ type: "text", text: `Archive '${archiveFile}' extracted on server ${serverId}.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── Upload File ──
  server.registerTool(
    "pterodactyl_upload_file",
    {
      title: "Upload File to Server",
      description: `Upload a file to the server using a two-step signed-URL process.

Provide the file content as a base64-encoded string.

Args:
  - server (string): Server identifier
  - directory (string): Target directory on the server (default: '/')
  - file_name (string): Name for the uploaded file
  - content (string): Base64-encoded file content`,
      inputSchema: UploadFileSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ server: serverId, directory, file_name, content }) => {
      const tmpPath = path.join(os.tmpdir(), `pterodactyl-upload-${Date.now()}-${file_name}`);
      try {
        // 1. Get signed upload URL from the panel
        const signedResp = await client.clientGet<{
          object: string;
          attributes: { url: string };
        }>(`servers/${serverId}/files/upload`, { directory });
        const signedUrl = signedResp.attributes?.url;
        if (!signedUrl) {
          return { content: [{ type: "text", text: "Error: panel returned no signed URL for upload." }] };
        }

        // 2. Decode base64 and write to a temp file
        const buf = Buffer.from(content, "base64");
        fs.writeFileSync(tmpPath, buf);

        // 3. Upload to the signed URL via multipart form
        const form = new FormData();
        form.append("files", fs.createReadStream(tmpPath), { filename: file_name });
        form.append("directory", directory);

        await new Promise<void>((resolve, reject) => {
          form.submit(signedUrl, (err, res) => {
            if (err) return reject(err);
            const body: Buffer[] = [];
            res.on("data", (chunk: Buffer) => body.push(chunk));
            res.on("end", () => {
              const status = res.statusCode ?? 0;
              if (status >= 200 && status < 300) resolve();
              else reject(new Error(`Upload returned HTTP ${status}: ${Buffer.concat(body).toString().slice(0, 300)}`));
            });
          });
        });

        return {
          content: [{ type: "text", text: `File '${file_name}' uploaded to ${directory} on server ${serverId}.` }],
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      } finally {
        // Clean up temp file
        try { fs.unlinkSync(tmpPath); } catch {}
      }
    }
  );
}
