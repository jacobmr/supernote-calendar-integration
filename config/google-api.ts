import { google } from "@googleapis/calendar";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
  throw new Error(
    "Missing required Google Calendar OAuth2 credentials. " +
      "Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in .env",
  );
}

/**
 * Create and return an OAuth2 client for Google Calendar API
 * The client must be authenticated with valid access token before use
 */
export const createOAuth2Client = () => {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
  );
};

/**
 * Create and return an authenticated Google Calendar API client
 * Requires auth to be set on the client first (via setCredentials)
 */
export const createCalendarClient = (auth: any) => {
  return google.calendar({
    version: "v3",
    auth,
  });
};

export { google };
