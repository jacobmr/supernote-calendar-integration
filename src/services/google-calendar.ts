import { createCalendarClient } from "../../config/google-api";
import { getValidAccessToken, loadStoredTokens } from "../utils/oauth-handler";

/**
 * Parsed event object from Google Calendar
 */
export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO 8601 format
  end: string; // ISO 8601 format
  attendees: Array<{
    email: string;
    displayName?: string;
    responseStatus: string;
  }>;
  description?: string;
  location?: string;
}

/**
 * Google Calendar Service
 * Handles queries to Google Calendar API
 */
export class GoogleCalendarService {
  /**
   * Get upcoming events from the primary calendar
   * @param timeMinutesAhead How many minutes ahead to query (default 30 days = 43200 minutes)
   * @returns Array of parsed calendar events
   */
  async getUpcomingEvents(
    timeMinutesAhead: number = 43200,
  ): Promise<CalendarEvent[]> {
    // Load stored tokens
    const tokens = loadStoredTokens();
    if (!tokens) {
      throw new Error("No stored tokens found. Please authenticate first.");
    }

    // Get valid access token (refresh if needed)
    const accessToken = await getValidAccessToken(tokens);

    // Create calendar client with auth
    const auth = {
      access_token: accessToken,
    };

    const calendar = createCalendarClient(auth);

    // Calculate time range
    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(
      now.getTime() + timeMinutesAhead * 60000,
    ).toISOString();

    try {
      // Query calendar API
      const response = await calendar.events.list({
        calendarId: "primary",
        timeMin,
        timeMax,
        maxResults: 100,
        singleEvents: true,
        orderBy: "startTime",
      });

      if (!response.data.items) {
        return [];
      }

      // Parse and transform events
      const events = response.data.items.map((event) => {
        return {
          id: event.id || "",
          title: event.summary || "Untitled Event",
          start: event.start?.dateTime || event.start?.date || "",
          end: event.end?.dateTime || event.end?.date || "",
          attendees: (event.attendees || []).map((att) => ({
            email: att.email || "",
            displayName: att.displayName,
            responseStatus: att.responseStatus || "needsAction",
          })),
          description: event.description,
          location: event.location,
        } as CalendarEvent;
      });

      return events;
    } catch (error) {
      console.error("Error querying calendar:", error);
      throw error;
    }
  }
}
