import supernoteApi from "supernote-cloud-api";
import type { FileInfo } from "supernote-cloud-api";

const SUPERNOTE_BASE_URL = "https://cloud.supernote.com";

interface ApiResponse {
  success?: boolean;
  errorCode?: string;
  errorMsg?: string;
  [key: string]: unknown;
}

export class SupernoteAPIClient {
  private token: string | null = null;

  private requireToken(): string {
    if (!this.token) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }
    return this.token;
  }

  private async postJson(
    path: string,
    payload: Record<string, unknown>,
  ): Promise<ApiResponse> {
    const token = this.requireToken();
    const response = await fetch(`${SUPERNOTE_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-access-token": token,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `Supernote API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as ApiResponse;
    if (data.errorCode && data.errorCode !== "0") {
      throw new Error(
        `Supernote API error: ${data.errorMsg || data.errorCode}`,
      );
    }
    return data;
  }

  async authenticate(email: string, password: string): Promise<string> {
    console.log(`Authenticating with Supernote as ${email}...`);
    this.token = await supernoteApi.login(email, password);
    console.log("Authentication successful");
    return this.token;
  }

  async listNotebooks(directoryId: string = "0"): Promise<FileInfo[]> {
    this.requireToken();
    console.log(`Listing notebooks in directory ${directoryId}...`);
    const items = await supernoteApi.fileList(this.token!, directoryId);
    console.log(`Found ${items.length} items`);
    return items;
  }

  /**
   * Create a folder in Supernote Cloud.
   * @param name Folder name
   * @param parentId Parent directory ID (0 for root)
   */
  async createFolder(name: string, parentId: number = 0): Promise<ApiResponse> {
    console.log(`Creating folder "${name}" in directory ${parentId}...`);
    const data = await this.postJson("/api/file/folder/add", {
      fileName: name,
      directoryId: parentId,
    });
    console.log(`Folder "${name}" created`);
    return data;
  }

  /**
   * Create nested folder path, returning the final folder's ID.
   * Creates any missing segments. Example: createFolderPath("Calendar/Recurring/Standup")
   * @param folderPath Forward-slash separated path (e.g. "Calendar/Recurring")
   * @param rootId Starting directory ID (0 for root)
   * @returns ID of the deepest folder
   */
  async createFolderPath(
    folderPath: string,
    rootId: number = 0,
  ): Promise<number> {
    const segments = folderPath.split("/").filter(Boolean);
    let currentParentId = rootId;

    for (const segment of segments) {
      const listing = await supernoteApi.fileList(
        this.requireToken(),
        String(currentParentId),
      );
      const match = listing.find(
        (item: FileInfo) => item.isFolder === "Y" && item.fileName === segment,
      );

      if (match) {
        currentParentId = Number(match.id);
      } else {
        const result = await this.createFolder(segment, currentParentId);
        // Use ID from create response if available, otherwise re-list
        if (result.id) {
          currentParentId = Number(result.id);
        } else {
          const updated = await supernoteApi.fileList(
            this.requireToken(),
            String(currentParentId),
          );
          const created = updated.find(
            (item: FileInfo) =>
              item.isFolder === "Y" && item.fileName === segment,
          );
          if (!created) {
            throw new Error(
              `Failed to find folder "${segment}" after creation`,
            );
          }
          currentParentId = Number(created.id);
        }
      }
    }

    return currentParentId;
  }

  /**
   * Rename a file or folder.
   * @param id File/folder ID
   * @param newName New name
   */
  async rename(id: number, newName: string): Promise<ApiResponse> {
    console.log(`Renaming ${id} to "${newName}"...`);
    return this.postJson("/api/file/rename", { id, newName });
  }

  /**
   * Move files/folders to another directory.
   * @param idList IDs of items to move
   * @param fromDirectoryId Source directory ID
   * @param toDirectoryId Destination directory ID
   */
  async moveFiles(
    idList: number[],
    fromDirectoryId: number,
    toDirectoryId: number,
  ): Promise<ApiResponse> {
    console.log(
      `Moving ${idList.length} items from ${fromDirectoryId} to ${toDirectoryId}...`,
    );
    return this.postJson("/api/file/move", {
      idList,
      directoryId: fromDirectoryId,
      goDirectoryId: toDirectoryId,
    });
  }

  /**
   * Delete files/folders (moves to recycle bin).
   * @param idList IDs of items to delete
   * @param directoryId Directory containing the items
   */
  async deleteFiles(
    idList: number[],
    directoryId: number,
  ): Promise<ApiResponse> {
    console.log(
      `Deleting ${idList.length} items from directory ${directoryId}...`,
    );
    return this.postJson("/api/file/delete", { idList, directoryId });
  }

  async getNoteById(id: string): Promise<{ url: string; id: string }> {
    this.requireToken();
    console.log(`Getting download URL for notebook ${id}...`);
    const url = await supernoteApi.fileUrl(this.token!, id);
    return { url, id };
  }

  async syncFiles(localPath: string): Promise<void> {
    this.requireToken();
    console.log(`Syncing Supernote to ${localPath}...`);
    await supernoteApi.syncFiles(this.token!, localPath);
    console.log("Sync complete");
  }

  isAuthenticated(): boolean {
    return this.token !== null;
  }

  getToken(): string | null {
    return this.token;
  }
}

export default SupernoteAPIClient;
