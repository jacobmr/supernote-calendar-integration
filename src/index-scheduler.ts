import * as cron from "node-cron";
import * as dotenv from "dotenv";
import { GoogleCalendarService } from "./services/google-calendar";
import {
  MeetingDetectorService,
  MeetingData,
} from "./services/meeting-detector";
import { StateManager, PersistedMeeting } from "./services/state-manager";
import { GOOGLE_CALENDAR_API } from "./services/constants";

// Load environment variables
dotenv.config();

/**
 * Hourly scheduler for meeting detection
 *
 * Runs every hour at :00 (0 * * * * cron syntax)
 * Queries Google Calendar for upcoming meetings
 * Detects new, changed, and cancelled meetings using state persistence
 */
async function startScheduler(): Promise<void> {
  console.log("[Scheduler] Initializing meeting detection scheduler...");

  // Initialize services
  const calendarService = new GoogleCalendarService();
  const meetingDetector = new MeetingDetectorService(calendarService);
  const stateManager = new StateManager();

  // Schedule job to run every hour at :00
  const job = cron.schedule("0 * * * *", async () => {
    const startTime = new Date();
    console.log(
      `\n[Scheduler] Job started at ${startTime.toISOString().substring(11, 19)} UTC`,
    );

    try {
      // Load previous state
      const previousState = stateManager.loadState();
      console.log(
        `[Scheduler] Loaded previous state: ${previousState.length} meetings`,
      );

      // Query upcoming meetings for next 30 days
      const meetings = await meetingDetector.queryUpcomingMeetings({
        days: 30,
      });

      console.log(
        `[Scheduler] Found ${meetings.length} upcoming meetings in next 30 days`,
      );

      // Transform API response to persistent format
      const now = Date.now();
      const currentState: PersistedMeeting[] = meetings.map(
        (meeting: MeetingData) => ({
          id: meeting.id,
          title: meeting.title,
          startTime: meeting.startTime,
          endTime: meeting.endTime,
          lastDetected: now,
        }),
      );

      // Detect changes between previous and current state
      const changes = stateManager.detectChanges(previousState, currentState);

      // Log change summary
      console.log("[Scheduler] === Change Detection Summary ===");
      console.log(`[Scheduler] New meetings: ${changes.newMeetings.length}`);
      if (changes.newMeetings.length > 0) {
        changes.newMeetings.slice(0, 3).forEach((meeting) => {
          console.log(
            `[Scheduler]   + ${meeting.title} (${meeting.startTime.substring(0, 10)})`,
          );
        });
        if (changes.newMeetings.length > 3) {
          console.log(
            `[Scheduler]   + ... and ${changes.newMeetings.length - 3} more new meetings`,
          );
        }
      }

      console.log(
        `[Scheduler] Changed meetings: ${changes.changedMeetings.length}`,
      );
      if (changes.changedMeetings.length > 0) {
        changes.changedMeetings.slice(0, 3).forEach((meeting) => {
          console.log(
            `[Scheduler]   ~ ${meeting.title} (time/details changed)`,
          );
        });
        if (changes.changedMeetings.length > 3) {
          console.log(
            `[Scheduler]   ~ ... and ${changes.changedMeetings.length - 3} more changed meetings`,
          );
        }
      }

      console.log(
        `[Scheduler] Cancelled meetings: ${changes.cancelledMeetings.length}`,
      );
      if (changes.cancelledMeetings.length > 0) {
        changes.cancelledMeetings.slice(0, 3).forEach((meeting) => {
          console.log(`[Scheduler]   - ${meeting.title} (cancelled)`);
        });
        if (changes.cancelledMeetings.length > 3) {
          console.log(
            `[Scheduler]   - ... and ${changes.cancelledMeetings.length - 3} more cancelled meetings`,
          );
        }
      }

      // Save current state for next run
      stateManager.saveState(currentState);
      console.log(
        `[Scheduler] Saved current state: ${currentState.length} meetings`,
      );

      // Phase 3 will extend this to create/update folders
      console.log("[Scheduler] Folder creation: Not yet implemented (Phase 3)");
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
  console.log("[Scheduler] State file: data/meeting-state.json");
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

export {
  startScheduler,
  MeetingDetectorService,
  GoogleCalendarService,
  StateManager,
};
