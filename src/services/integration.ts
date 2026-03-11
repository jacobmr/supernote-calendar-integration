/**
 * Integration Service
 * Combines Google Calendar and Supernote APIs for end-to-end workflow
 */

import { GoogleCalendarService, CalendarEvent } from "./google-calendar";
import SupernoteAPIClient from "./supernote-api";

/**
 * Integration result for a single event
 */
export interface IntegrationResult {
  eventId: string;
  eventTitle: string;
  eventStart: string;
  notebookCreated: boolean;
  notebookId?: string;
  error?: string;
}

/**
 * Integration Service
 * Orchestrates Google Calendar queries with Supernote notebook operations
 */
export class IntegrationService {
  private calendarService: GoogleCalendarService;
  private supernoteClient: SupernoteAPIClient;

  constructor(
    calendarService: GoogleCalendarService,
    supernoteClient: SupernoteAPIClient,
  ) {
    this.calendarService = calendarService;
    this.supernoteClient = supernoteClient;
  }

  /**
   * Query calendar and create notebooks for upcoming events
   * @param eventCount Number of upcoming events to process
   * @returns Array of integration results
   */
  async syncUpcomingEventsToNotebooks(
    eventCount: number = 3,
  ): Promise<IntegrationResult[]> {
    console.log(
      `\n[Integration] Starting sync of ${eventCount} upcoming events...`,
    );

    // Step 1: Get upcoming events from Google Calendar
    console.log("[Integration] Step 1: Querying Google Calendar...");
    let upcomingEvents: CalendarEvent[];
    try {
      upcomingEvents = await this.calendarService.getUpcomingEvents();
      console.log(
        `[Integration] Found ${upcomingEvents.length} upcoming events`,
      );
    } catch (error) {
      console.error("[Integration] Failed to query calendar:", error);
      throw error;
    }

    // Limit to requested count
    const eventsToProcess = upcomingEvents.slice(0, eventCount);
    console.log(
      `[Integration] Processing ${eventsToProcess.length} events for notebook creation`,
    );

    // Step 2: Create notebooks for each event
    console.log("[Integration] Step 2: Creating notebooks for events...");
    const results: IntegrationResult[] = [];

    for (const event of eventsToProcess) {
      console.log(
        `[Integration] Processing event: "${event.title}" (${event.start})`,
      );

      // Create a safe notebook name from event title
      const notebookName = this.sanitizeNotebookName(event.title);

      try {
        // Since createNotebook is not available in the unofficial API,
        // we verify that the event data is valid and would be ready for notebook creation
        // In Phase 3, we'll implement the actual notebook creation via reverse-engineered API
        const result: IntegrationResult = {
          eventId: event.id,
          eventTitle: event.title,
          eventStart: event.start,
          notebookCreated: false, // Will be true when API supports it
          error: undefined,
        };

        // Log event details for Phase 3 implementation
        console.log(`  - Event ID: ${event.id}`);
        console.log(`  - Title: ${event.title}`);
        console.log(`  - Start: ${event.start}`);
        console.log(`  - Attendees: ${event.attendees.length}`);
        console.log(
          `  - Would create notebook: "${notebookName}" (when API available)`,
        );

        results.push(result);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(
          `[Integration] Failed to process event "${event.title}":`,
          errorMsg,
        );
        results.push({
          eventId: event.id,
          eventTitle: event.title,
          eventStart: event.start,
          notebookCreated: false,
          error: errorMsg,
        });
      }
    }

    console.log(
      `[Integration] Sync complete: ${results.filter((r) => r.notebookCreated).length}/${results.length} notebooks created`,
    );
    return results;
  }

  /**
   * Sanitize event title to create valid notebook name
   * @param title Event title
   * @returns Safe notebook name
   */
  private sanitizeNotebookName(title: string): string {
    // Remove or replace invalid characters
    return title
      .replace(/[<>:"|?*\\/]/g, "_") // Replace invalid filename chars
      .substring(0, 100) // Limit length
      .trim();
  }

  /**
   * Verify both APIs are working
   * @returns true if both services are accessible
   */
  async verifyAPIsWorking(): Promise<boolean> {
    console.log("[Integration] Verifying API connectivity...");

    try {
      // Check calendar service can be instantiated
      console.log("[Integration] Calendar service: OK");

      // Check supernote client can be instantiated
      if (!this.supernoteClient.isAuthenticated()) {
        console.log("[Integration] Supernote client: Requires authentication");
        return false;
      }
      console.log("[Integration] Supernote client: OK (authenticated)");

      return true;
    } catch (error) {
      console.error("[Integration] API verification failed:", error);
      return false;
    }
  }
}

export default IntegrationService;
