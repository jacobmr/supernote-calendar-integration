/**
 * Supernote API Unit Tests
 *
 * Unit tests for SupernoteAPIClient class.
 * Tests verify method signatures and error handling without actual API calls.
 *
 * For integration tests with real credentials:
 * Run: npx ts-node src/verify-supernote-auth.ts
 */

import { SupernoteAPIClient } from "../src/services/supernote-api";

describe("Supernote API Client - Unit Tests", () => {
  let client: SupernoteAPIClient;

  beforeEach(() => {
    client = new SupernoteAPIClient();
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
    test("listNotebooks should throw error if not authenticated", async () => {
      await expect(client.listNotebooks("0")).rejects.toThrow(
        /Not authenticated/,
      );
    });

    test("getNoteById should throw error if not authenticated", async () => {
      await expect(client.getNoteById("test-id")).rejects.toThrow(
        /Not authenticated/,
      );
    });

    test("createNotebook should throw error if not authenticated", async () => {
      await expect(client.createNotebook("test", 0)).rejects.toThrow(
        /Not authenticated/,
      );
    });

    test("syncFiles should throw error if not authenticated", async () => {
      await expect(client.syncFiles("/tmp")).rejects.toThrow(
        /Not authenticated/,
      );
    });
  });

  describe("API Method Signatures", () => {
    test("SupernoteAPIClient should have authenticate method", () => {
      expect(typeof client.authenticate).toBe("function");
    });

    test("SupernoteAPIClient should have listNotebooks method", () => {
      expect(typeof client.listNotebooks).toBe("function");
    });

    test("SupernoteAPIClient should have getNoteById method", () => {
      expect(typeof client.getNoteById).toBe("function");
    });

    test("SupernoteAPIClient should have createNotebook method", () => {
      expect(typeof client.createNotebook).toBe("function");
    });

    test("SupernoteAPIClient should have syncFiles method", () => {
      expect(typeof client.syncFiles).toBe("function");
    });

    test("SupernoteAPIClient should have isAuthenticated method", () => {
      expect(typeof client.isAuthenticated).toBe("function");
    });

    test("SupernoteAPIClient should have getToken method", () => {
      expect(typeof client.getToken).toBe("function");
    });
  });

  describe("createNotebook limitation", () => {
    test("createNotebook should reject with clear error message", async () => {
      // Mock a token to bypass authentication check
      (client as any).token = "mock-token";

      await expect(client.createNotebook("test-notebook", 0)).rejects.toThrow(
        /not yet implemented/,
      );
    });

    test("createNotebook error should suggest API endpoint", async () => {
      (client as any).token = "mock-token";

      try {
        await client.createNotebook("test", 0);
        fail("Should have thrown error");
      } catch (error) {
        expect(error instanceof Error).toBe(true);
        if (error instanceof Error) {
          expect(error.message).toContain("POST /api/notebook/create");
        }
      }
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

/**
 * Integration test documentation
 *
 * To run integration tests with real Supernote credentials:
 *
 * 1. Create .env file with:
 *    SUPERNOTE_EMAIL=your_email@example.com
 *    SUPERNOTE_PASSWORD=your_password_here
 *
 * 2. Run verification script:
 *    npx ts-node src/verify-supernote-auth.ts
 *
 * The verification script tests:
 * - Authentication with actual Supernote account
 * - listNotebooks() retrieves real notebooks from root directory
 * - getNoteById() works with actual notebook IDs
 * - API response format matches FileInfo type definition
 * - createNotebook() correctly reports as unimplemented
 */
