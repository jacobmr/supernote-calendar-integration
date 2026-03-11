/**
 * Supernote Authentication Handler
 *
 * This module manages authentication with the Supernote Cloud API.
 *
 * Authentication Method:
 * - Email/password-based login via unofficial Supernote Cloud API
 * - The supernote-cloud-api library handles password hashing (SHA256(MD5(password) + randomCode))
 * - Returns access token for subsequent authenticated API calls
 *
 * Environment Variables:
 * - SUPERNOTE_EMAIL: Supernote account email address
 * - SUPERNOTE_PASSWORD: Supernote account password
 *
 * Token Lifecycle:
 * - Token is obtained once per session/job run
 * - Token is passed in x-access-token header for subsequent API calls
 * - No documented token expiry in unofficial API docs
 */

import * as dotenv from "dotenv";
import { SupernoteAPIClient } from "../services/supernote-api";

dotenv.config();

/**
 * Initialize and authenticate Supernote API client
 * @returns Authenticated SupernoteAPIClient instance
 * @throws Error if credentials are missing or authentication fails
 */
export async function initializeSupernoteAuth(): Promise<SupernoteAPIClient> {
  const email = process.env.SUPERNOTE_EMAIL;
  const password = process.env.SUPERNOTE_PASSWORD;

  if (!email) {
    throw new Error(
      "SUPERNOTE_EMAIL not found in environment. " +
        "Add SUPERNOTE_EMAIL to .env file with your Supernote account email.",
    );
  }

  if (!password) {
    throw new Error(
      "SUPERNOTE_PASSWORD not found in environment. " +
        "Add SUPERNOTE_PASSWORD to .env file with your Supernote account password.",
    );
  }

  const client = new SupernoteAPIClient();

  try {
    await client.authenticate(email, password);
    console.log("Supernote authentication successful");
    return client;
  } catch (error) {
    console.error("Supernote authentication failed:", error);
    throw new Error(
      `Failed to authenticate with Supernote: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Verify that authentication works with a simple API call
 * @param client Authenticated SupernoteAPIClient instance
 */
export async function verifySupernoteAuth(
  client: SupernoteAPIClient,
): Promise<void> {
  try {
    // Test with a simple listNotebooks call on root directory
    const notebooks = await client.listNotebooks("0");
    console.log(
      `Authentication verified: Found ${notebooks.length} items in root directory`,
    );

    if (notebooks.length > 0) {
      console.log("First item:", notebooks[0].fileName);
    }
  } catch (error) {
    throw new Error(
      `Authentication verification failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export default initializeSupernoteAuth;
