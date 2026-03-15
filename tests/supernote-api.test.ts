import * as crypto from "crypto";
import { SupernoteAPIClient } from "../src/services/supernote-api";

// Mock global fetch for direct API calls
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// Mock the supernote-cloud-api library
jest.mock("supernote-cloud-api", () => ({
  __esModule: true,
  default: {
    login: jest.fn(),
    fileList: jest.fn(),
    fileUrl: jest.fn(),
    syncFiles: jest.fn(),
  },
}));

import supernoteApi from "supernote-cloud-api";
const mockedApi = supernoteApi as jest.Mocked<typeof supernoteApi>;

describe("Supernote API Client", () => {
  let client: SupernoteAPIClient;

  beforeEach(() => {
    client = new SupernoteAPIClient();
    jest.clearAllMocks();
  });

  describe("Client initialization", () => {
    test("should create new client instance", () => {
      expect(client).toBeInstanceOf(SupernoteAPIClient);
    });

    test("should not be authenticated on init", () => {
      expect(client.isAuthenticated()).toBe(false);
      expect(client.getToken()).toBeNull();
    });
  });

  describe("Authentication validation", () => {
    test("listNotebooks should throw if not authenticated", async () => {
      await expect(client.listNotebooks("0")).rejects.toThrow(
        /Not authenticated/,
      );
    });

    test("getNoteById should throw if not authenticated", async () => {
      await expect(client.getNoteById("test-id")).rejects.toThrow(
        /Not authenticated/,
      );
    });

    test("createFolder should throw if not authenticated", async () => {
      await expect(client.createFolder("test")).rejects.toThrow(
        /Not authenticated/,
      );
    });

    test("syncFiles should throw if not authenticated", async () => {
      await expect(client.syncFiles("/tmp")).rejects.toThrow(
        /Not authenticated/,
      );
    });

    test("rename should throw if not authenticated", async () => {
      await expect(client.rename(1, "new-name")).rejects.toThrow(
        /Not authenticated/,
      );
    });

    test("moveFiles should throw if not authenticated", async () => {
      await expect(client.moveFiles([1], 0, 1)).rejects.toThrow(
        /Not authenticated/,
      );
    });

    test("deleteFiles should throw if not authenticated", async () => {
      await expect(client.deleteFiles([1], 0)).rejects.toThrow(
        /Not authenticated/,
      );
    });

    test("uploadFile should throw if not authenticated", async () => {
      await expect(
        client.uploadFile(Buffer.from("test"), "test.md", 0),
      ).rejects.toThrow(/Not authenticated/);
    });

    test("uploadTextFile should throw if not authenticated", async () => {
      await expect(
        client.uploadTextFile("test content", "test.md", 0),
      ).rejects.toThrow(/Not authenticated/);
    });
  });

  describe("API Method Signatures", () => {
    test("should have all expected methods", () => {
      const methods = [
        "authenticate",
        "listNotebooks",
        "getNoteById",
        "createFolder",
        "createFolderPath",
        "rename",
        "moveFiles",
        "deleteFiles",
        "uploadFile",
        "uploadTextFile",
        "syncFiles",
        "isAuthenticated",
        "getToken",
      ];
      for (const method of methods) {
        expect(typeof (client as any)[method]).toBe("function");
      }
    });
  });

  describe("createFolder", () => {
    beforeEach(() => {
      (client as any).token = "mock-token";
    });

    test("should POST to /api/file/folder/add", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await client.createFolder("Meeting Notes", 0);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://cloud.supernote.com/api/file/folder/add",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ fileName: "Meeting Notes", directoryId: 0 }),
        }),
      );
    });

    test("should include auth token in header", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await client.createFolder("test", 0);

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers["x-access-token"]).toBe("mock-token");
    });

    test("should throw on API error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ errorCode: "500", errorMsg: "Internal error" }),
      });

      await expect(client.createFolder("test", 0)).rejects.toThrow(
        "Internal error",
      );
    });

    test("should throw on HTTP error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
      });

      await expect(client.createFolder("test", 0)).rejects.toThrow(
        "403 Forbidden",
      );
    });
  });

  describe("createFolderPath", () => {
    beforeEach(() => {
      (client as any).token = "mock-token";
    });

    test("should reuse existing folders", async () => {
      mockedApi.fileList.mockResolvedValueOnce([
        { id: "10", fileName: "Calendar", isFolder: "Y" } as any,
      ]);
      mockedApi.fileList.mockResolvedValueOnce([
        { id: "20", fileName: "Recurring", isFolder: "Y" } as any,
      ]);

      const id = await client.createFolderPath("Calendar/Recurring");
      expect(id).toBe(20);
      expect(mockFetch).not.toHaveBeenCalled(); // No folders created
    });

    test("should create missing segments and use returned ID", async () => {
      // First segment: "Calendar" exists
      mockedApi.fileList.mockResolvedValueOnce([
        { id: "10", fileName: "Calendar", isFolder: "Y" } as any,
      ]);
      // Second segment: "NewFolder" doesn't exist
      mockedApi.fileList.mockResolvedValueOnce([]);

      // Create response includes the new folder's ID
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 30 }),
      });

      const id = await client.createFolderPath("Calendar/NewFolder");
      expect(id).toBe(30);
      expect(mockFetch).toHaveBeenCalledTimes(1); // One folder created
      // No extra fileList call needed since ID came from response
      expect(mockedApi.fileList).toHaveBeenCalledTimes(2);
    });

    test("should fall back to re-listing if create response has no ID", async () => {
      mockedApi.fileList.mockResolvedValueOnce([]); // "Docs" doesn't exist
      mockedApi.fileList.mockResolvedValueOnce([
        { id: "50", fileName: "Docs", isFolder: "Y" } as any,
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }), // No ID returned
      });

      const id = await client.createFolderPath("Docs");
      expect(id).toBe(50);
      expect(mockedApi.fileList).toHaveBeenCalledTimes(2); // Initial + re-list
    });
  });

  describe("rename", () => {
    test("should POST to /api/file/rename", async () => {
      (client as any).token = "mock-token";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await client.rename(123, "New Name");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://cloud.supernote.com/api/file/rename",
        expect.objectContaining({
          body: JSON.stringify({ id: 123, newName: "New Name" }),
        }),
      );
    });
  });

  describe("moveFiles", () => {
    test("should POST to /api/file/move", async () => {
      (client as any).token = "mock-token";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await client.moveFiles([1, 2], 0, 10);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://cloud.supernote.com/api/file/move",
        expect.objectContaining({
          body: JSON.stringify({
            idList: [1, 2],
            directoryId: 0,
            goDirectoryId: 10,
          }),
        }),
      );
    });
  });

  describe("deleteFiles", () => {
    test("should POST to /api/file/delete", async () => {
      (client as any).token = "mock-token";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await client.deleteFiles([5, 6], 10);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://cloud.supernote.com/api/file/delete",
        expect.objectContaining({
          body: JSON.stringify({ idList: [5, 6], directoryId: 10 }),
        }),
      );
    });
  });

  describe("uploadFile", () => {
    const testContent = Buffer.from("# Meeting Notes\n\nTest content");
    const testMd5 = crypto.createHash("md5").update(testContent).digest("hex");

    beforeEach(() => {
      (client as any).token = "mock-token";
    });

    test("should complete 3-step upload flow", async () => {
      // Step 1: Apply response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          url: "https://s3.example.com/upload-target",
          s3Authorization: "AWS4-HMAC-SHA256 ...",
          xamzDate: "20260315T120000Z",
          innerName: "inner-file-name-123",
        }),
      });

      // Step 2: S3 PUT response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
      });

      // Step 3: Finish response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await client.uploadFile(testContent, "notes.md", 42);

      expect(mockFetch).toHaveBeenCalledTimes(3);

      // Verify Step 1: Apply call
      expect(mockFetch.mock.calls[0][0]).toBe(
        "https://cloud.supernote.com/api/file/upload/apply",
      );
      const applyBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(applyBody).toEqual({
        directoryId: 42,
        fileName: "notes.md",
        md5: testMd5,
        size: testContent.byteLength,
      });

      // Verify Step 2: S3 PUT
      expect(mockFetch.mock.calls[1][0]).toBe(
        "https://s3.example.com/upload-target",
      );
      expect(mockFetch.mock.calls[1][1].method).toBe("PUT");
      expect(mockFetch.mock.calls[1][1].headers).toEqual({
        Authorization: "AWS4-HMAC-SHA256 ...",
        "x-amz-date": "20260315T120000Z",
        "x-amz-content-sha256": "UNSIGNED-PAYLOAD",
        "Content-Type": "application/octet-stream",
      });

      // Verify Step 3: Finish call
      expect(mockFetch.mock.calls[2][0]).toBe(
        "https://cloud.supernote.com/api/file/upload/finish",
      );
      const finishBody = JSON.parse(mockFetch.mock.calls[2][1].body);
      expect(finishBody).toEqual({
        directoryId: 42,
        fileName: "notes.md",
        fileSize: testContent.byteLength,
        innerName: "inner-file-name-123",
        md5: testMd5,
      });
    });

    test("should throw if apply response missing required fields", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          url: "https://s3.example.com/upload-target",
          // Missing s3Authorization, xamzDate, innerName
        }),
      });

      await expect(
        client.uploadFile(testContent, "notes.md", 42),
      ).rejects.toThrow(/missing required fields/);
    });

    test("should throw on apply API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          errorCode: "500",
          errorMsg: "Upload not allowed",
        }),
      });

      await expect(
        client.uploadFile(testContent, "notes.md", 42),
      ).rejects.toThrow("Upload not allowed");
    });

    test("should throw on S3 PUT failure", async () => {
      // Apply succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          url: "https://s3.example.com/upload-target",
          s3Authorization: "AWS4-HMAC-SHA256 ...",
          xamzDate: "20260315T120000Z",
          innerName: "inner-file-name-123",
        }),
      });

      // S3 PUT fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
      });

      await expect(
        client.uploadFile(testContent, "notes.md", 42),
      ).rejects.toThrow("S3 upload failed: 403 Forbidden");
    });

    test("should throw on finish API error", async () => {
      // Apply succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          url: "https://s3.example.com/upload-target",
          s3Authorization: "AWS4-HMAC-SHA256 ...",
          xamzDate: "20260315T120000Z",
          innerName: "inner-file-name-123",
        }),
      });

      // S3 PUT succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
      });

      // Finish fails
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          errorCode: "400",
          errorMsg: "File already exists",
        }),
      });

      await expect(
        client.uploadFile(testContent, "notes.md", 42),
      ).rejects.toThrow("File already exists");
    });

    test("should throw on finish HTTP error", async () => {
      // Apply succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          url: "https://s3.example.com/upload-target",
          s3Authorization: "AWS4-HMAC-SHA256 ...",
          xamzDate: "20260315T120000Z",
          innerName: "inner-file-name-123",
        }),
      });

      // S3 PUT succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
      });

      // Finish HTTP error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      await expect(
        client.uploadFile(testContent, "notes.md", 42),
      ).rejects.toThrow("500 Internal Server Error");
    });
  });

  describe("uploadTextFile", () => {
    beforeEach(() => {
      (client as any).token = "mock-token";
    });

    test("should convert string to Buffer and call uploadFile", async () => {
      const textContent = "# Hello World\n\nThis is a test note.";
      const expectedMd5 = crypto
        .createHash("md5")
        .update(Buffer.from(textContent, "utf-8"))
        .digest("hex");

      // Apply
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          url: "https://s3.example.com/upload",
          s3Authorization: "AWS4-HMAC-SHA256 ...",
          xamzDate: "20260315T120000Z",
          innerName: "inner-123",
        }),
      });
      // S3 PUT
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
      });
      // Finish
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await client.uploadTextFile(textContent, "note.md", 10);

      // Verify apply was called with correct MD5 and size from Buffer
      const applyBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(applyBody.md5).toBe(expectedMd5);
      expect(applyBody.size).toBe(Buffer.from(textContent, "utf-8").byteLength);
      expect(applyBody.fileName).toBe("note.md");
      expect(applyBody.directoryId).toBe(10);
    });
  });

  describe("Token management", () => {
    test("getToken should return null when not authenticated", () => {
      expect(client.getToken()).toBeNull();
    });

    test("getToken should return token after setting", () => {
      (client as any).token = "test-token";
      expect(client.getToken()).toBe("test-token");
    });

    test("isAuthenticated should reflect token state", () => {
      expect(client.isAuthenticated()).toBe(false);
      (client as any).token = "test-token";
      expect(client.isAuthenticated()).toBe(true);
      (client as any).token = null;
      expect(client.isAuthenticated()).toBe(false);
    });
  });
});
