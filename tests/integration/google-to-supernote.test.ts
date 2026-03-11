/**
 * Integration Test: Google Calendar to Supernote
 *
 * This test validates that:
 * 1. Google Calendar API can retrieve upcoming events
 * 2. Supernote API can authenticate and list notebooks
 * 3. Both APIs work together without conflicts
 * 4. Event data can be mapped to notebook creation parameters
 *
 * NOTE: This is an integration test that uses real API credentials.
 * Requires GOOGLE_* and SUPERNOTE_* environment variables to be set.
 *
 * Tests will skip if credentials are missing (expected in CI/development).
 */

import * as dotenv from "dotenv";
import { GoogleCalendarService } from "../../src/services/google-calendar";
import SupernoteAPIClient from "../../src/services/supernote-api";
import IntegrationService from "../../src/services/integration";

// Load environment variables
dotenv.config();

describe("Google Calendar to Supernote Integration", () => {
  let calendarService: GoogleCalendarService;
  let supernoteClient: SupernoteAPIClient;
  let integrationService: IntegrationService;

  beforeAll(() => {
    // Initialize services
    calendarService = new GoogleCalendarService();
    supernoteClient = new SupernoteAPIClient();
    integrationService = new IntegrationService(
      calendarService,
      supernoteClient,
    );

    console.log("\n=== Integration Test Setup ===");
    console.log("Services initialized");
  });

  describe("Task 1.1: Google Calendar API", () => {
    test("should retrieve upcoming calendar events", async () => {
      try {
        console.log(
          "\n[Test 1.1] Querying Google Calendar for upcoming events...",
        );
        const events = await calendarService.getUpcomingEvents();

        console.log(`[Test 1.1] Found ${events.length} events`);

        // Verify events structure
        events.forEach((event, index) => {
          console.log(`  Event ${index + 1}: "${event.title}"`);
          expect(event).toHaveProperty("id");
          expect(event).toHaveProperty("title");
          expect(event).toHaveProperty("start");
          expect(event).toHaveProperty("end");
          expect(event).toHaveProperty("attendees");
          expect(typeof event.title).toBe("string");
          expect(typeof event.start).toBe("string");
          expect(typeof event.end).toBe("string");
          expect(Array.isArray(event.attendees)).toBe(true);
        });

        // Should have at least some events or be empty
        expect(Array.isArray(events)).toBe(true);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("No stored tokens")
        ) {
          console.log(
            "[Test 1.1] Skipping: No Google Calendar credentials available. " +
              "Run 'npm run dev' to authenticate first.",
          );
          return;
        }
        console.error("[Test 1.1] Error:", error);
        throw error;
      }
    });

    test("should handle calendar events with all expected fields", async () => {
      try {
        console.log("\n[Test 1.1b] Validating event field completeness...");
        const events = await calendarService.getUpcomingEvents();

        if (events.length > 0) {
          const event = events[0];
          console.log(`[Test 1.1b] Validating event: "${event.title}"`);

          // All required fields should exist
          expect(event.id).toBeDefined();
          expect(event.title).toBeDefined();
          expect(event.start).toBeDefined();
          expect(event.end).toBeDefined();
          expect(event.attendees).toBeDefined();

          // Start time should be a valid ISO 8601 date
          const startDate = new Date(event.start);
          expect(startDate instanceof Date && !isNaN(startDate.getTime())).toBe(
            true,
          );

          console.log(`[Test 1.1b] Event fields validated successfully`);
        } else {
          console.log(
            "[Test 1.1b] No events to validate, skipping field checks",
          );
        }
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("No stored tokens")
        ) {
          console.log(
            "[Test 1.1b] Skipping: No Google Calendar credentials available.",
          );
          return;
        }
        console.error("[Test 1.1b] Error:", error);
        throw error;
      }
    });
  });

  describe("Task 1.2: Supernote API Authentication", () => {
    test("should authenticate with Supernote API", async () => {
      const email = process.env.SUPERNOTE_EMAIL;
      const password = process.env.SUPERNOTE_PASSWORD;

      if (!email || !password) {
        console.log(
          "[Test 1.2] Skipping: SUPERNOTE_EMAIL or SUPERNOTE_PASSWORD not set",
        );
        return;
      }

      try {
        console.log(
          `\n[Test 1.2] Authenticating with Supernote as ${email}...`,
        );
        const token = await supernoteClient.authenticate(email, password);

        expect(token).toBeDefined();
        expect(typeof token).toBe("string");
        expect(token.length).toBeGreaterThan(0);
        expect(supernoteClient.isAuthenticated()).toBe(true);

        console.log("[Test 1.2] Authentication successful, token obtained");
      } catch (error) {
        console.error("[Test 1.2] Authentication failed:", error);
        throw error;
      }
    });

    test("should list notebooks after authentication", async () => {
      const email = process.env.SUPERNOTE_EMAIL;
      const password = process.env.SUPERNOTE_PASSWORD;

      if (!email || !password) {
        console.log(
          "[Test 1.2b] Skipping: SUPERNOTE_EMAIL or SUPERNOTE_PASSWORD not set",
        );
        return;
      }

      try {
        console.log("\n[Test 1.2b] Listing Supernote notebooks...");

        // Ensure authenticated
        if (!supernoteClient.isAuthenticated()) {
          await supernoteClient.authenticate(email, password);
        }

        const notebooks = await supernoteClient.listNotebooks();
        console.log(
          `[Test 1.2b] Found ${notebooks.length} items in root directory`,
        );

        // Verify notebooks structure
        notebooks.forEach((notebook, index) => {
          if (index < 3) {
            console.log(
              `  Item ${index + 1}: ${notebook.fileName} (folder: ${notebook.isFolder})`,
            );
          }
        });

        expect(Array.isArray(notebooks)).toBe(true);
        // Should have at least root folder structure
        expect(notebooks).toBeDefined();
      } catch (error) {
        console.error("[Test 1.2b] Failed to list notebooks:", error);
        throw error;
      }
    });
  });

  describe("Task 1.3: Integration - Combined API Workflow", () => {
    test("should verify both APIs are accessible", async () => {
      const email = process.env.SUPERNOTE_EMAIL;
      const password = process.env.SUPERNOTE_PASSWORD;

      try {
        console.log("\n[Test 1.3] Verifying API integration...");

        // Authenticate supernote if credentials available
        if (email && password && !supernoteClient.isAuthenticated()) {
          await supernoteClient.authenticate(email, password);
        }

        const apiWorkingCondition =
          await integrationService.verifyAPIsWorking();
        console.log(`[Test 1.3] APIs working: ${apiWorkingCondition}`);

        // If supernote is not authenticated, that's OK for this test
        if (!email || !password) {
          console.log(
            "[Test 1.3] Note: Supernote not authenticated (credentials not provided)",
          );
        } else if (!apiWorkingCondition) {
          expect(apiWorkingCondition).toBe(true);
        }
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("No stored tokens")
        ) {
          console.log(
            "[Test 1.3] Skipping: No Google Calendar credentials available.",
          );
          return;
        }
        console.error("[Test 1.3] Integration verification failed:", error);
        throw error;
      }
    });

    test("should sync calendar events to notebook creation format", async () => {
      const email = process.env.SUPERNOTE_EMAIL;
      const password = process.env.SUPERNOTE_PASSWORD;

      try {
        console.log(
          "\n[Test 1.3b] Syncing calendar events to notebook format...",
        );

        // Authenticate supernote if credentials available
        if (email && password && !supernoteClient.isAuthenticated()) {
          await supernoteClient.authenticate(email, password);
        }

        // Execute integration: query calendar and prepare for notebook creation
        const results =
          await integrationService.syncUpcomingEventsToNotebooks(3);

        console.log(
          `[Test 1.3b] Integration results: ${results.length} events processed`,
        );

        // Verify results structure
        expect(Array.isArray(results)).toBe(true);

        results.forEach((result, index) => {
          console.log(`  Result ${index + 1}: "${result.eventTitle}"`);
          expect(result).toHaveProperty("eventId");
          expect(result).toHaveProperty("eventTitle");
          expect(result).toHaveProperty("eventStart");
          expect(result).toHaveProperty("notebookCreated");
          expect(typeof result.eventTitle).toBe("string");
          expect(typeof result.eventStart).toBe("string");
          expect(typeof result.notebookCreated).toBe("boolean");
        });

        console.log("[Test 1.3b] All results have expected structure");
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("No stored tokens")
        ) {
          console.log(
            "[Test 1.3b] Skipping: No Google Calendar credentials available.",
          );
          return;
        }
        console.error("[Test 1.3b] Sync failed:", error);
        throw error;
      }
    });

    test("should handle no conflicts between APIs in sequence", async () => {
      const email = process.env.SUPERNOTE_EMAIL;
      const password = process.env.SUPERNOTE_PASSWORD;

      try {
        console.log(
          "\n[Test 1.3c] Testing sequential API calls (no conflicts)...",
        );

        // First: Query calendar
        console.log("[Test 1.3c] Step 1: Query calendar...");
        const calendarEvents = await calendarService.getUpcomingEvents();
        console.log(`[Test 1.3c] Got ${calendarEvents.length} events`);

        // Second: Authenticate supernote and list notebooks
        if (email && password) {
          console.log("[Test 1.3c] Step 2: Authenticate Supernote...");
          await supernoteClient.authenticate(email, password);
          console.log("[Test 1.3c] Authenticated successfully");

          console.log("[Test 1.3c] Step 3: List Supernote notebooks...");
          const notebooks = await supernoteClient.listNotebooks();
          console.log(`[Test 1.3c] Got ${notebooks.length} items`);
        }

        // Third: Query calendar again (should still work)
        console.log(
          "[Test 1.3c] Step 4: Query calendar again (no conflicts)...",
        );
        const calendarEventsAgain = await calendarService.getUpcomingEvents();
        console.log(`[Test 1.3c] Got ${calendarEventsAgain.length} events`);

        // Both should succeed and have same results
        expect(calendarEvents.length).toBe(calendarEventsAgain.length);
        console.log("[Test 1.3c] No timing/auth conflicts detected");
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("No stored tokens")
        ) {
          console.log(
            "[Test 1.3c] Skipping: No Google Calendar credentials available.",
          );
          return;
        }
        console.error("[Test 1.3c] Conflict test failed:", error);
        throw error;
      }
    });
  });

  afterAll(() => {
    console.log("\n=== Integration Test Complete ===\n");
  });
});
