/**
 * Supernote Cloud API Wrapper
 *
 * This module provides a TypeScript wrapper around the adrianba/supernote-cloud-api library.
 *
 * Authentication:
 * - Uses email/password-based authentication
 * - Credentials should be stored in .env as SUPERNOTE_EMAIL and SUPERNOTE_PASSWORD
 * - The library handles SHA256(MD5(password) + randomCode) hashing internally
 *
 * Available Methods:
 * - login(email, password): Authenticates with Supernote and returns access token
 * - fileList(token, directoryId?): Lists files/folders in a directory (0 = root)
 * - fileUrl(token, id): Gets download URL for a file
 * - syncFiles(token, localPath): Syncs Supernote files to local filesystem
 *
 * API Response Format:
 * - fileList returns array of userFileVOList items with properties:
 *   - id: unique file/folder identifier
 *   - fileName: name of file or folder
 *   - isFolder: "Y" or "N" indicating if item is a folder
 *   - updateTime: last modification timestamp
 *   - fileSize: size in bytes
 *
 * Rate Limits:
 * - No documented rate limits from unofficial API
 * - Requests should include reasonable delays to avoid being rate-limited
 */

import supernoteApi from "supernote-cloud-api";
import type { FileInfo } from "supernote-cloud-api";

export class SupernoteAPIClient {
  private token: string | null = null;

  /**
   * Authenticate with Supernote Cloud
   * @param email Supernote account email
   * @param password Supernote account password
   * @returns Access token for subsequent API calls
   */
  async authenticate(email: string, password: string): Promise<string> {
    console.log(`Authenticating with Supernote as ${email}...`);
    this.token = await supernoteApi.login(email, password);
    console.log("Authentication successful");
    return this.token;
  }

  /**
   * List all files and folders in a directory
   * @param directoryId Directory ID to list (0 for root, pass as string per API)
   * @returns Array of files and folders
   */
  async listNotebooks(directoryId: string = "0"): Promise<FileInfo[]> {
    if (!this.token) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    console.log(`Listing notebooks in directory ${directoryId}...`);
    const items = await supernoteApi.fileList(this.token, directoryId);
    console.log(`Found ${items.length} items`);
    return items;
  }

  /**
   * Create a new notebook (folder) in Supernote
   * Note: The unofficial API does not provide a direct createNotebook method.
   * This function documents the required parameters for Phase 3 planning.
   *
   * TODO: Implement folder creation via API when method becomes available
   * or find alternative approach in library.
   *
   * @param name Notebook name
   * @param parentId Parent folder ID (0 for root)
   * @returns Created notebook metadata (when API supports it)
   */
  async createNotebook(name: string, parentId: number = 0): Promise<void> {
    if (!this.token) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    // The unofficial API does not expose a create method yet
    // This would need to be implemented when the library adds support
    // or through reverse-engineering the API endpoint
    throw new Error(
      "createNotebook not yet implemented in unofficial Supernote API. " +
        "Consider creating notebooks manually or exploring API endpoint: " +
        "POST /api/notebook/create with { name, parentId }",
    );
  }

  /**
   * Get a specific file/notebook by ID
   * @param id File or notebook ID
   * @returns File metadata and download URL
   */
  async getNoteById(id: string): Promise<{ url: string; id: string }> {
    if (!this.token) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    console.log(`Getting download URL for notebook ${id}...`);
    const url = await supernoteApi.fileUrl(this.token, id);
    return { url, id };
  }

  /**
   * Sync all Supernote files to local filesystem
   * @param localPath Local directory path to sync to
   */
  async syncFiles(localPath: string): Promise<void> {
    if (!this.token) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    console.log(`Syncing Supernote to ${localPath}...`);
    await supernoteApi.syncFiles(this.token, localPath);
    console.log("Sync complete");
  }

  /**
   * Check if currently authenticated
   */
  isAuthenticated(): boolean {
    return this.token !== null;
  }

  /**
   * Get current authentication token
   */
  getToken(): string | null {
    return this.token;
  }
}

export default SupernoteAPIClient;
