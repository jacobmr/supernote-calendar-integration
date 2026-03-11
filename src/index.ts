import * as dotenv from "dotenv";
import { authenticate, loadStoredTokens } from "./utils/oauth-handler";
import { GoogleCalendarService } from "./services/google-calendar";

// Load environment variables
dotenv.config();

/**
 * Main entry point for Supernote Calendar Integration
 * Handles OAuth2 authentication and displays upcoming calendar events
 */
async function main(): Promise<void> {
  try {
    console.log("🚀 Supernote Calendar Integration\n");

    // Check if tokens already exist
    let tokens = loadStoredTokens();

    if (!tokens) {
      console.log("📝 Authenticating with Google Calendar...\n");
      tokens = await authenticate();
    } else {
      console.log("✓ Using existing credentials from tokens.json");
    }

    // Query upcoming events
    console.log("\n📅 Fetching upcoming events...\n");
    const service = new GoogleCalendarService();
    const events = await service.getUpcomingEvents();

    console.log(
      `✓ Found ${events.length} upcoming events in the next 30 days\n`,
    );

    if (events.length > 0) {
      console.log("📋 Upcoming Events:\n");
      events.slice(0, 5).forEach((event) => {
        console.log(`• ${event.title}`);
        console.log(`  Start: ${event.start}`);
        console.log(`  End: ${event.end}`);
        if (event.location) {
          console.log(`  Location: ${event.location}`);
        }
        if (event.attendees.length > 0) {
          console.log(
            `  Attendees: ${event.attendees.map((a) => a.email).join(", ")}`,
          );
        }
        console.log();
      });

      if (events.length > 5) {
        console.log(`... and ${events.length - 5} more events`);
      }
    } else {
      console.log("No upcoming events found in the next 30 days.");
    }

    console.log("\n✅ Google Calendar API access verified successfully!");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();
