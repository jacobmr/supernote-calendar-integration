import { google } from "@googleapis/calendar";
/**
 * Create and return an OAuth2 client for Google Calendar API
 * The client must be authenticated with valid access token before use
 */
export declare const createOAuth2Client: () => any;
/**
 * Create and return an authenticated Google Calendar API client
 * Requires auth to be set on the client first (via setCredentials)
 */
export declare const createCalendarClient: (auth: any) => any;
export { google };
//# sourceMappingURL=google-api.d.ts.map
