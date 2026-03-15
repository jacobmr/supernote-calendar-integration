import * as cron from "node-cron";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { GoogleCalendarService } from "./services/google-calendar";
import {
  MeetingDetectorService,
  MeetingData,
} from "./services/meeting-detector";
import { StateManager, PersistedMeeting } from "./services/state-manager";
import { FolderMappingStore } from "./services/folder-mapping-store";
import { FolderOrganizer } from "./services/folder-organizer";
import { NoteCreator } from "./services/note-creator";
import { NoteTemplateGenerator } from "./services/note-template-generator";
import SupernoteAPIClient from "./services/supernote-api";
import {
  GOOGLE_CALENDAR_API,
  RETRY_STRATEGY,
  getBackoffDelay,
} from "./services/constants";
import { createLogger } from "./utils/logger";

// Load environment variables
dotenv.config();

const log = createLogger("Scheduler");

// Consecutive failure tracking for error recovery
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 3;

/**
 * Result of a single pipeline run
 */
export interface PipelineResult {
  lastRun: string;
  summary: {
    new: number;
    changed: number;
    cancelled: number;
    foldersCreated: number;
    foldersSkipped: number;
    notesCreated: number;
    notesSkipped: number;
  };
  durationMs: number;
}

/**
 * Runs the full meeting detection pipeline once.
 * Shared between the cron scheduler and the manual trigger endpoint.
 */
export async function runPipelineOnce(): Promise<PipelineResult> {
  const startTime = new Date();
  log.info(`Job started at ${startTime.toISOString().substring(11, 19)} UTC`);

  // Initialize services
  const calendarService = new GoogleCalendarService();
  const meetingDetector = new MeetingDetectorService(calendarService);
  const stateManager = new StateManager();

  // Load previous state
  const previousState = stateManager.loadState();
  log.info(`Loaded previous state: ${previousState.length} meetings`);

  // Query upcoming meetings for next 30 days
  const meetings = await meetingDetector.queryUpcomingMeetings({
    days: 30,
  });

  log.info(`Found ${meetings.length} upcoming meetings in next 30 days`);

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
  log.info("=== Change Detection Summary ===");
  log.info(`New meetings: ${changes.newMeetings.length}`);
  if (changes.newMeetings.length > 0) {
    changes.newMeetings.slice(0, 3).forEach((meeting) => {
      log.info(`  + ${meeting.title} (${meeting.startTime.substring(0, 10)})`);
    });
    if (changes.newMeetings.length > 3) {
      log.info(
        `  + ... and ${changes.newMeetings.length - 3} more new meetings`,
      );
    }
  }

  log.info(`Changed meetings: ${changes.changedMeetings.length}`);
  if (changes.changedMeetings.length > 0) {
    changes.changedMeetings.slice(0, 3).forEach((meeting) => {
      log.info(`  ~ ${meeting.title} (time/details changed)`);
    });
    if (changes.changedMeetings.length > 3) {
      log.info(
        `  ~ ... and ${changes.changedMeetings.length - 3} more changed meetings`,
      );
    }
  }

  log.info(`Cancelled meetings: ${changes.cancelledMeetings.length}`);
  if (changes.cancelledMeetings.length > 0) {
    changes.cancelledMeetings.slice(0, 3).forEach((meeting) => {
      log.info(`  - ${meeting.title} (cancelled)`);
    });
    if (changes.cancelledMeetings.length > 3) {
      log.info(
        `  - ... and ${changes.cancelledMeetings.length - 3} more cancelled meetings`,
      );
    }
  }

  // Folder and note creation for new meetings
  let foldersCreated = 0;
  let foldersSkipped = 0;
  let notesCreated = 0;
  let notesSkipped = 0;

  if (changes.newMeetings.length > 0) {
    const supernoteEmail = process.env.SUPERNOTE_EMAIL;
    const supernotePassword = process.env.SUPERNOTE_PASSWORD;

    if (supernoteEmail && supernotePassword) {
      try {
        // Build MeetingData[] for new meetings by matching IDs back
        const newMeetingIds = new Set(changes.newMeetings.map((m) => m.id));
        const newMeetingData = meetings.filter((m) => newMeetingIds.has(m.id));

        const supernoteClient = new SupernoteAPIClient();
        await supernoteClient.authenticate(supernoteEmail, supernotePassword);

        const mappingStore = new FolderMappingStore();
        const folderOrganizer = new FolderOrganizer(
          supernoteClient,
          mappingStore,
        );

        const folderResult =
          await folderOrganizer.processNewMeetings(newMeetingData);
        foldersCreated = folderResult.created;
        foldersSkipped = folderResult.skipped;

        log.info(
          `Folders created: ${foldersCreated}, skipped: ${foldersSkipped}`,
        );

        // Create notes for new meetings (after folders exist)
        try {
          const templateGenerator = new NoteTemplateGenerator();
          const noteCreator = new NoteCreator(
            supernoteClient,
            templateGenerator,
            mappingStore,
          );

          const noteResult =
            await noteCreator.processNewMeetings(newMeetingData);
          notesCreated = noteResult.created;
          notesSkipped = noteResult.skipped;

          log.info(`Notes created: ${notesCreated}, skipped: ${notesSkipped}`);
        } catch (error) {
          const noteErrorMessage =
            error instanceof Error ? error.message : "Unknown error";
          log.error(`Note creation failed: ${noteErrorMessage}`);
        }
      } catch (error) {
        const folderErrorMessage =
          error instanceof Error ? error.message : "Unknown error";
        log.error(`Folder creation failed: ${folderErrorMessage}`);
      }
    } else {
      log.warn(
        "Supernote credentials not configured — skipping folder and note creation",
      );
    }
  }

  // Save current state for next run
  stateManager.saveState(currentState);
  log.info(`Saved current state: ${currentState.length} meetings`);

  const endTime = new Date();
  const duration = endTime.getTime() - startTime.getTime();

  // Build result
  const result: PipelineResult = {
    lastRun: new Date().toISOString(),
    summary: {
      new: changes.newMeetings.length,
      changed: changes.changedMeetings.length,
      cancelled: changes.cancelledMeetings.length,
      foldersCreated,
      foldersSkipped,
      notesCreated,
      notesSkipped,
    },
    durationMs: duration,
  };

  // Write scheduler status for the web dashboard
  const statusPath = path.join(process.cwd(), "data", "scheduler-status.json");
  fs.writeFileSync(
    statusPath,
    JSON.stringify({ ...result, status: "idle" }, null, 2),
    "utf-8",
  );
  log.info("Updated scheduler status for dashboard");
  log.info(`Job completed in ${duration}ms`);

  return result;
}

/**
 * Validates required and optional environment variables at startup.
 * Exits the process if required variables are missing.
 */
function validateStartup(): void {
  // Check required env vars
  const requiredVars = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"];
  const missingRequired = requiredVars.filter((v) => !process.env[v]);

  if (missingRequired.length > 0) {
    log.error(
      `Missing required environment variables: ${missingRequired.join(", ")}`,
    );
    log.error(
      "Set these in .env or as environment variables. See .env.example for reference.",
    );
    process.exit(1);
  }

  // Check optional env vars
  const optionalVars = ["SUPERNOTE_EMAIL", "SUPERNOTE_PASSWORD"];
  const missingOptional = optionalVars.filter((v) => !process.env[v]);

  if (missingOptional.length > 0) {
    log.warn("Supernote credentials not set — folder/note creation disabled");
  }

  // Ensure data directory exists
  fs.mkdirSync("data", { recursive: true });
  log.debug("Data directory verified");
}

/**
 * Hourly scheduler for meeting detection
 *
 * Runs every hour at :00 (0 * * * * cron syntax)
 * Queries Google Calendar for upcoming meetings
 * Detects new, changed, and cancelled meetings using state persistence
 */
async function startScheduler(): Promise<void> {
  log.info("Initializing meeting detection scheduler...");

  // Validate environment before scheduling
  validateStartup();

  // Schedule job to run every hour at :00
  const job = cron.schedule("0 * * * *", async () => {
    let lastError: string | undefined;

    // Retry loop with exponential backoff
    for (let attempt = 0; attempt <= RETRY_STRATEGY.MAX_ATTEMPTS; attempt++) {
      try {
        if (attempt > 0) {
          const delay = getBackoffDelay(attempt - 1);
          log.warn(
            `Retry attempt ${attempt}/${RETRY_STRATEGY.MAX_ATTEMPTS} after ${delay}ms`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        await runPipelineOnce();

        // Success — reset consecutive failure counter
        consecutiveFailures = 0;
        return;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Unknown error";
        log.error(`Job failed (attempt ${attempt + 1}): ${lastError}`);
      }
    }

    // All retries exhausted — track consecutive failure
    consecutiveFailures++;
    log.error(
      `Job failed after ${RETRY_STRATEGY.MAX_ATTEMPTS + 1} attempts: ${lastError}`,
    );

    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      log.error(
        `Scheduler unhealthy: ${MAX_CONSECUTIVE_FAILURES} consecutive failures`,
      );
    }

    // Write failure status so dashboard shows error state
    const statusPath = path.join(
      process.cwd(),
      "data",
      "scheduler-status.json",
    );
    const failureStatus = {
      status: "error",
      lastError: lastError,
      lastRun: new Date().toISOString(),
      consecutiveFailures,
    };
    try {
      fs.writeFileSync(
        statusPath,
        JSON.stringify(failureStatus, null, 2),
        "utf-8",
      );
    } catch {
      log.error("Failed to write scheduler-status.json");
    }
  });

  log.info("Meeting detection scheduler started");
  log.info("Runs every hour at :00");
  log.info("Query window: 30 days");
  log.info("State file: data/meeting-state.json");
  log.info("To stop: press Ctrl+C");

  // Keep process running
  return new Promise(() => {
    // Never resolves - scheduler runs indefinitely
  });
}

// Start scheduler if run directly
if (require.main === module) {
  startScheduler().catch((error) => {
    log.error(`Fatal error: ${error}`);
    process.exit(1);
  });
}

export {
  startScheduler,
  validateStartup,
  MeetingDetectorService,
  GoogleCalendarService,
  StateManager,
  FolderOrganizer,
  FolderMappingStore,
  NoteCreator,
  NoteTemplateGenerator,
};
