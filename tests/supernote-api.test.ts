/**
 * Supernote API Integration Tests
 *
 * These tests verify that the Supernote Cloud API client works correctly
 * with actual Supernote account credentials.
 *
 * Prerequisites:
 * - SUPERNOTE_EMAIL and SUPERNOTE_PASSWORD must be set in .env file
 * - Account must be accessible and not rate-limited
 *
 * Note: These are integration tests that make real API calls.
 * They require valid credentials and network access to Supernote Cloud.
 */

import { SupernoteAPIClient } from "../src/services/supernote-api";
import {
  initializeSupernoteAuth,
  verifySupernoteAuth,
} from "../src/utils/supernote-auth";

describe("Supernote API Client", () => {
  let client: SupernoteAPIClient;

  beforeAll(async () => {
    // Skip tests if credentials are not available
    if (!process.env.SUPERNOTE_EMAIL || !process.env.SUPERNOTE_PASSWORD) {
      console.warn(
        "Skipping Supernote tests: SUPERNOTE_EMAIL and SUPERNOTE_PASSWORD not set",
      );
      return;
    }

    try {
      client = await initializeSupernoteAuth();
    } catch (error) {
      console.error("Failed to initialize Supernote client:", error);
      throw error;
    }
  });

  test("should authenticate with Supernote", async () => {
    if (!process.env.SUPERNOTE_EMAIL || !process.env.SUPERNOTE_PASSWORD) {
      console.warn("Skipping authentication test: credentials not set");
      return;
    }

    expect(client.isAuthenticated()).toBe(true);
    expect(client.getToken()).not.toBeNull();
    expect(typeof client.getToken()).toBe("string");
  });

  test("should verify authentication by listing notebooks", async () => {
    if (!process.env.SUPERNOTE_EMAIL || !process.env.SUPERNOTE_PASSWORD) {
      console.warn("Skipping verification test: credentials not set");
      return;
    }

    await expect(verifySupernoteAuth(client)).resolves.not.toThrow();
  });

  test("listNotebooks should return array of files/folders", async () => {
    if (!process.env.SUPERNOTE_EMAIL || !process.env.SUPERNOTE_PASSWORD) {
      console.warn("Skipping listNotebooks test: credentials not set");
      return;
    }

    const notebooks = await client.listNotebooks("0");

    expect(Array.isArray(notebooks)).toBe(true);
    if (notebooks.length > 0) {
      const firstItem = notebooks[0];
      expect(firstItem).toHaveProperty("id");
      expect(firstItem).toHaveProperty("fileName");
      expect(firstItem).toHaveProperty("isFolder");
      expect(firstItem).toHaveProperty("updateTime");

      console.log("Sample notebook item:", {
        id: firstItem.id,
        fileName: firstItem.fileName,
        isFolder: firstItem.isFolder,
        updateTime: new Date(firstItem.updateTime * 1000).toISOString(),
        size: firstItem.size,
      });
    }
  });

  test("getNoteById should return download URL", async () => {
    if (!process.env.SUPERNOTE_EMAIL || !process.env.SUPERNOTE_PASSWORD) {
      console.warn("Skipping getNoteById test: credentials not set");
      return;
    }

    // First, get a notebook to test with
    const notebooks = await client.listNotebooks("0");

    if (notebooks.length === 0) {
      console.warn("No notebooks found to test getNoteById");
      return;
    }

    // Find a file (not a folder)
    const file = notebooks.find((item) => item.isFolder === "N");

    if (!file) {
      console.warn("No files found to test getNoteById");
      return;
    }

    const result = await client.getNoteById(file.id);

    expect(result).toHaveProperty("url");
    expect(result).toHaveProperty("id");
    expect(result.id).toBe(file.id);
    expect(typeof result.url).toBe("string");
    expect(result.url.length).toBeGreaterThan(0);

    console.log("Download URL retrieved for:", file.fileName);
  });

  test("createNotebook should fail with helpful error", async () => {
    if (!process.env.SUPERNOTE_EMAIL || !process.env.SUPERNOTE_PASSWORD) {
      console.warn("Skipping createNotebook test: credentials not set");
      return;
    }

    await expect(client.createNotebook("test-notebook", 0)).rejects.toThrow(
      /not yet implemented/,
    );
  });

  test("should throw error if not authenticated", async () => {
    const unauthenticatedClient = new SupernoteAPIClient();

    await expect(unauthenticatedClient.listNotebooks("0")).rejects.toThrow(
      /Not authenticated/,
    );
  });

  test("API response format should match FileInfo type", async () => {
    if (!process.env.SUPERNOTE_EMAIL || !process.env.SUPERNOTE_PASSWORD) {
      console.warn("Skipping API response format test: credentials not set");
      return;
    }

    const notebooks = await client.listNotebooks("0");

    if (notebooks.length > 0) {
      const item = notebooks[0];

      // Verify FileInfo type properties
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("directoryId");
      expect(item).toHaveProperty("fileName");
      expect(item).toHaveProperty("size");
      expect(item).toHaveProperty("md5");
      expect(item).toHaveProperty("isFolder");
      expect(item).toHaveProperty("createTime");
      expect(item).toHaveProperty("updateTime");

      // Verify types
      expect(typeof item.id).toBe("string");
      expect(typeof item.directoryId).toBe("string");
      expect(typeof item.fileName).toBe("string");
      expect(typeof item.size).toBe("number");
      expect(typeof item.md5).toBe("string");
      expect(typeof item.isFolder).toBe("string");
      expect(item.isFolder === "Y" || item.isFolder === "N").toBe(true);
      expect(typeof item.createTime).toBe("number");
      expect(typeof item.updateTime).toBe("number");

      console.log("API response format verified:", {
        properties: Object.keys(item),
        types: {
          id: typeof item.id,
          fileName: typeof item.fileName,
          isFolder: typeof item.isFolder,
          size: typeof item.size,
        },
      });
    }
  });
});
