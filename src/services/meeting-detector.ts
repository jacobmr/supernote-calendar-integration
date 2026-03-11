import { GoogleCalendarService, CalendarEvent } from "./google-calendar";
import { GOOGLE_CALENDAR_API } from "./constants";

/**
 * Meeting data structure for state persistence and change detection
 */
export interface MeetingData {
  id: string;
  title: string;
  startTime: string; // ISO 8601 format
  endTime: string; // ISO 8601 format
  attendees: Array<{
    email: string;
    displayName?: string;
    responseStatus: string;
  }>;
  description?: string;
  location?: string;
}

/**
 * MeetingDetectorService
 *
 * Queries Google Calendar for upcoming meetings and returns structured data
 * for state persistence and change detection.
 */
export class MeetingDetectorService {
  private calendarService: GoogleCalendarService;

  constructor(calendarService: GoogleCalendarService) {
    this.calendarService = calendarService;
  }

  /**
   * Query upcoming meetings from Google Calendar
   *
   * @param window Query window configuration (e.g., { days: 30 })
   * @returns Array of meeting data without state/change detection
   */
  async queryUpcomingMeetings(window: {
    days: number;
  }): Promise<MeetingData[]> {
    try {
      // Convert days to minutes
      const timeMinutesAhead = window.days * 24 * 60;

      // Query calendar for upcoming events
      const events =
        await this.calendarService.getUpcomingEvents(timeMinutesAhead);

      // Transform to MeetingData format
      const meetings: MeetingData[] = events.map((event: CalendarEvent) => ({
        id: event.id,
        title: event.title,
        startTime: event.start,
        endTime: event.end,
        attendees: event.attendees,
        description: event.description,
        location: event.location,
      }));

      return meetings;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        `[MeetingDetector] Failed to query upcoming meetings: ${errorMessage}`,
      );
      throw error;
    }
  }
}
