/**
 * Supernote Authentication Verification Script
 *
 * This script verifies that Supernote authentication works correctly
 * with the configured credentials in .env file.
 *
 * Usage:
 *   npx ts-node src/verify-supernote-auth.ts
 *
 * Prerequisites:
 *   SUPERNOTE_EMAIL and SUPERNOTE_PASSWORD must be set in .env
 */

import {
  initializeSupernoteAuth,
  verifySupernoteAuth,
} from "./utils/supernote-auth";

async function main() {
  console.log("=".repeat(60));
  console.log("Supernote Authentication Verification");
  console.log("=".repeat(60));

  try {
    console.log("\n1. Initializing Supernote API client...");
    const client = await initializeSupernoteAuth();

    console.log("\n2. Verifying authentication with API call...");
    await verifySupernoteAuth(client);

    console.log("\n3. Testing listNotebooks() method...");
    const notebooks = await client.listNotebooks("0");
    console.log(
      `✓ Successfully retrieved ${notebooks.length} items from root directory`,
    );

    if (notebooks.length > 0) {
      console.log("\n4. Sample notebook item:");
      const sample = notebooks[0];
      console.log("   id:", sample.id);
      console.log("   fileName:", sample.fileName);
      console.log("   isFolder:", sample.isFolder);
      console.log("   size:", sample.size);
      console.log(
        "   updateTime:",
        new Date(sample.updateTime * 1000).toISOString(),
      );

      // Test getNoteById if we have a file
      if (sample.isFolder === "N") {
        console.log("\n5. Testing getNoteById() method...");
        const fileInfo = await client.getNoteById(sample.id);
        console.log("✓ Retrieved download URL for:", sample.fileName);
        console.log("   URL length:", fileInfo.url.length, "characters");
      }
    }

    // Test createNotebook error
    console.log("\n6. Testing createNotebook() (expected to fail)...");
    try {
      await client.createNotebook("test", 0);
      console.log("✗ Unexpected: createNotebook did not fail");
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("not yet implemented")
      ) {
        console.log(
          "✓ createNotebook correctly throws 'not yet implemented' error",
        );
      } else {
        throw error;
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("✓ All authentication tests passed!");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\n✗ Authentication verification failed:");
    console.error(error);
    process.exit(1);
  }
}

main();
