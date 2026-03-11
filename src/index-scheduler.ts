import * as cron from "node-cron";
import * as dotenv from "dotenv";
import { GoogleCalendarService } from "./services/google-calendar";
import { MeetingDetectorService } from "./services/meeting-detector";
import { GOOGLE_CALENDAR_API } from "./services/constants";

// Load environment variables
dotenv.config();

/**
 * Hourly scheduler for meeting detection
 *
 * Runs every hour at :00 (0 * * * * cron syntax)
 * Queries Google Calendar for upcoming meetings
 * Implements change detection in Task 2
 */
async function startScheduler(): Promise<void> {
  console.log("[Scheduler] Initializing meeting detection scheduler...");

  // Initialize services
  const calendarService = new GoogleCalendarService();
  const meetingDetector = new MeetingDetectorService(calendarService);

  // Schedule job to run every hour at :00
  const job = cron.schedule("0 * * * *", async () => {
    const startTime = new Date();
    console.log(
      `\n[Scheduler] Job started at ${startTime.toISOString().substring(11, 19)} UTC`,
    );

    try {
      // Query upcoming meetings for next 30 days
      const meetings = await meetingDetector.queryUpcomingMeetings({
        days: 30,
      });

      console.log(
        `[Scheduler] Found ${meetings.length} upcoming meetings in next 30 days`,
      );

      // Log meetings for visibility
      if (meetings.length > 0) {
        console.log("[Scheduler] Upcoming meetings:");
        meetings.slice(0, 5).forEach((meeting, idx) => {
          console.log(
            `  ${idx + 1}. ${meeting.title} (${meeting.startTime} - ${meeting.endTime})`,
          );
        });
        if (meetings.length > 5) {
          console.log(`  ... and ${meetings.length - 5} more`);
        }
      }

      // Task 2 will extend this with state persistence and change detection
      console.log(
        "[Scheduler] State persistence: Not yet implemented (Task 2)",
      );
      console.log("[Scheduler] Change detection: Not yet implemented (Task 2)");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`[Scheduler] Job failed: ${errorMessage}`);
    }

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    console.log(`[Scheduler] Job completed in ${duration}ms`);
  });

  console.log("[Scheduler] Meeting detection scheduler started");
  console.log("[Scheduler] Runs every hour at :00");
  console.log("[Scheduler] Query window: 30 days");
  console.log("[Scheduler] To stop: press Ctrl+C");

  // Keep process running
  return new Promise(() => {
    // Never resolves - scheduler runs indefinitely
  });
}

// Start scheduler if run directly
if (require.main === module) {
  startScheduler().catch((error) => {
    console.error("[Scheduler] Fatal error:", error);
    process.exit(1);
  });
}

export { startScheduler, MeetingDetectorService, GoogleCalendarService };
