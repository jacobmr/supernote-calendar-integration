import { oauth2_v2 } from "@googleapis/calendar";
import * as fs from "fs";
import * as http from "http";
import * as url from "url";
import { createOAuth2Client } from "../../config/google-api";

const TOKEN_STORE_PATH = process.env.TOKEN_STORE_PATH || "./tokens.json";

/**
 * Type definition for stored OAuth2 tokens
 */
interface StoredTokens {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
  token_type: string;
  scope: string;
}

/**
 * Load tokens from file if they exist
 */
export const loadStoredTokens = (): StoredTokens | null => {
  try {
    if (fs.existsSync(TOKEN_STORE_PATH)) {
      const data = fs.readFileSync(TOKEN_STORE_PATH, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn("Warning: Could not load stored tokens:", error);
  }
  return null;
};

/**
 * Save tokens to file for future use
 */
const saveTokens = (tokens: StoredTokens): void => {
  try {
    fs.writeFileSync(TOKEN_STORE_PATH, JSON.stringify(tokens, null, 2));
    console.log(`Tokens saved to ${TOKEN_STORE_PATH}`);
  } catch (error) {
    console.error("Error saving tokens:", error);
    throw error;
  }
};

/**
 * Perform OAuth2 authentication flow
 * Opens browser for user login and sets up callback server to capture authorization code
 */
export const authenticate = async (): Promise<StoredTokens> => {
  return new Promise((resolve, reject) => {
    const oauth2Client = createOAuth2Client();

    // Generate the URL for user authorization
    const scopes = ["https://www.googleapis.com/auth/calendar.readonly"];
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent", // Force consent screen to ensure refresh token is returned
    });

    console.log("Authorize this app by visiting this url:", authUrl);

    // Note: Browser opening omitted for security. Users should manually visit the URL.
    // For production, use a library like 'open' package with proper validation.

    // Set up local callback server
    const server = http.createServer(async (req, res) => {
      if (req.url?.indexOf("/oauth/callback") === 0) {
        const qs = new url.URL(req.url || "", "http://localhost:3000")
          .searchParams;
        const code = qs.get("code");

        if (code) {
          try {
            // Exchange authorization code for access token
            const { tokens } = await oauth2Client.getToken(code);

            // Store tokens securely
            const storedTokens: StoredTokens = {
              access_token: tokens.access_token!,
              refresh_token: tokens.refresh_token,
              expiry_date: tokens.expiry_date,
              token_type: tokens.token_type || "Bearer",
              scope: scopes.join(" "),
            };

            saveTokens(storedTokens);

            res.end("Authentication successful! You can close this window.");
            server.close();

            console.log("✓ Authentication successful");
            console.log("✓ Access token obtained");
            console.log("✓ Refresh token stored for scheduled job use");

            resolve(storedTokens);
          } catch (error) {
            console.error("Error exchanging code for token:", error);
            res.end("Authentication failed. Please try again.");
            server.close();
            reject(error);
          }
        } else {
          res.end("No authorization code received.");
          server.close();
          reject(new Error("No authorization code received"));
        }
      }
    });

    server.listen(3000, () => {
      console.log("Callback server listening on http://localhost:3000");
    });

    server.on("error", (error) => {
      console.error("Callback server error:", error);
      reject(error);
    });
  });
};

/**
 * Get valid access token, refreshing if necessary
 * Use this before making API calls
 */
export const getValidAccessToken = async (
  tokens: StoredTokens,
): Promise<string> => {
  const oauth2Client = createOAuth2Client();

  // Set the credentials
  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  });

  // Check if token is expired
  if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
    console.log("Access token expired, refreshing...");

    try {
      const { credentials } = await oauth2Client.refreshAccessToken();

      // Update stored tokens
      const updatedTokens: StoredTokens = {
        access_token: credentials.access_token!,
        refresh_token: credentials.refresh_token || tokens.refresh_token,
        expiry_date: credentials.expiry_date,
        token_type: credentials.token_type || "Bearer",
        scope: tokens.scope,
      };

      saveTokens(updatedTokens);
      console.log("✓ Access token refreshed");

      return credentials.access_token!;
    } catch (error) {
      console.error("Error refreshing access token:", error);
      throw error;
    }
  }

  return tokens.access_token;
};
