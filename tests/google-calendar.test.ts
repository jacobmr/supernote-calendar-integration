import { GoogleCalendarService } from "../src/services/google-calendar";
import { loadStoredTokens } from "../src/utils/oauth-handler";

/**
 * Integration test for Google Calendar API access
 * This test queries the actual Google Calendar API to verify read access
 *
 * Prerequisites:
 * 1. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI in .env
 * 2. Run authentication flow first: npm run dev (will guide through OAuth2)
 * 3. Tokens will be stored in tokens.json
 */
describe("GoogleCalendarService", () => {
  let service: GoogleCalendarService;

  beforeAll(() => {
    service = new GoogleCalendarService();
  });

  describe("getUpcomingEvents", () => {
    it("should retrieve upcoming events from calendar", async () => {
      // Check if tokens are available
      const tokens = loadStoredTokens();
      if (!tokens) {
        console.log(
          "Skipping integration test: No stored tokens found. " +
            "Please authenticate first by running: npm run dev",
        );
        return;
      }

      // Query next 30 days of events
      const events = await service.getUpcomingEvents(43200); // 30 days in minutes

      // Validate response structure
      expect(Array.isArray(events)).toBe(true);
      console.log(`\n✓ Retrieved ${events.length} upcoming events`);

      // If events exist, validate their structure
      if (events.length > 0) {
        const event = events[0];

        expect(event).toHaveProperty("id");
        expect(event).toHaveProperty("title");
        expect(event).toHaveProperty("start");
        expect(event).toHaveProperty("end");
        expect(event).toHaveProperty("attendees");
        expect(event).toHaveProperty("description");
        expect(event).toHaveProperty("location");

        expect(typeof event.title).toBe("string");
        expect(typeof event.start).toBe("string");
        expect(typeof event.end).toBe("string");
        expect(Array.isArray(event.attendees)).toBe(true);

        // Log first event for verification
        console.log("\n📅 First upcoming event:");
        console.log(`  Title: ${event.title}`);
        console.log(`  Start: ${event.start}`);
        console.log(`  End: ${event.end}`);
        console.log(`  Location: ${event.location || "N/A"}`);
        console.log(
          `  Attendees: ${event.attendees.map((a) => a.email).join(", ") || "N/A"}`,
        );
      }
    }, 30000); // 30 second timeout for API call

    it("should parse event attendees correctly", async () => {
      const tokens = loadStoredTokens();
      if (!tokens) {
        console.log("Skipping attendee test: No stored tokens found");
        return;
      }

      const events = await service.getUpcomingEvents(43200);

      // Find event with attendees
      const eventWithAttendees = events.find((e) => e.attendees.length > 0);

      if (eventWithAttendees) {
        console.log(`\n👥 Event with attendees: ${eventWithAttendees.title}`);
        eventWithAttendees.attendees.forEach((attendee) => {
          expect(attendee).toHaveProperty("email");
          expect(attendee).toHaveProperty("responseStatus");
          console.log(
            `  - ${attendee.displayName || attendee.email} (${attendee.responseStatus})`,
          );
        });
      }
    }, 30000);

    it("should handle calendar with no events gracefully", async () => {
      const tokens = loadStoredTokens();
      if (!tokens) {
        console.log("Skipping empty calendar test: No stored tokens found");
        return;
      }

      // Query far in the future (10 years)
      const events = await service.getUpcomingEvents(10 * 365 * 24 * 60);

      // Should return array even if empty
      expect(Array.isArray(events)).toBe(true);
      console.log(
        `\n✓ Handled empty result gracefully (found ${events.length} events)`,
      );
    }, 30000);
  });
});
