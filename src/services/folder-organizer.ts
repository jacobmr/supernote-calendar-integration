import SupernoteAPIClient from "./supernote-api";
import { FolderMappingStore } from "./folder-mapping-store";
import type { MeetingData } from "./meeting-detector";

/**
 * FolderOrganizer
 *
 * Creates Supernote folder hierarchies for meetings.
 * Recurring meetings get dedicated subfolders under Calendar/Recurring/[Meeting-Name]/
 * Ad-hoc meetings share the Calendar/Ad-Hoc/ folder.
 *
 * Uses FolderMappingStore to prevent duplicate folder creation across runs.
 */
export class FolderOrganizer {
  private supernoteClient: SupernoteAPIClient;
  private mappingStore: FolderMappingStore;
  private basePath: string = "Calendar";

  // Cached folder IDs after first ensureBaseStructure() call
  private recurringFolderId: number | null = null;
  private adHocFolderId: number | null = null;

  constructor(
    supernoteClient: SupernoteAPIClient,
    mappingStore: FolderMappingStore,
  ) {
    this.supernoteClient = supernoteClient;
    this.mappingStore = mappingStore;
  }

  /**
   * Ensure the base folder structure exists in Supernote:
   *   Calendar/Recurring/
   *   Calendar/Ad-Hoc/
   *
   * Results are cached on the instance after first call.
   */
  async ensureBaseStructure(): Promise<{
    recurringFolderId: number;
    adHocFolderId: number;
  }> {
    if (this.recurringFolderId !== null && this.adHocFolderId !== null) {
      return {
        recurringFolderId: this.recurringFolderId,
        adHocFolderId: this.adHocFolderId,
      };
    }

    console.log("[FolderOrganizer] Creating base folder structure...");

    this.recurringFolderId = await this.supernoteClient.createFolderPath(
      `${this.basePath}/Recurring`,
    );
    this.adHocFolderId = await this.supernoteClient.createFolderPath(
      `${this.basePath}/Ad-Hoc`,
    );

    console.log(
      `[FolderOrganizer] Base structure ready — Recurring: ${this.recurringFolderId}, Ad-Hoc: ${this.adHocFolderId}`,
    );

    return {
      recurringFolderId: this.recurringFolderId,
      adHocFolderId: this.adHocFolderId,
    };
  }

  /**
   * Sanitize a meeting title for use as a folder name.
   * Replaces invalid filename characters and limits length.
   */
  sanitizeFolderName(name: string): string {
    return name
      .replace(/[<>:"|?*\\/]/g, "_")
      .substring(0, 100)
      .trim();
  }

  /**
   * Create a Supernote folder for a single meeting.
   *
   * - Recurring meetings: Calendar/Recurring/[sanitized title]/
   *   All instances of the same recurring event share one folder.
   * - Ad-hoc meetings: Calendar/Ad-Hoc/ (shared folder, no per-meeting subfolder)
   *
   * Skips meetings that already have a folder mapping.
   */
  async createFolderForMeeting(meeting: MeetingData): Promise<void> {
    // Skip if already mapped
    if (this.mappingStore.hasFolderForMeeting(meeting.id)) {
      console.log(
        `[FolderOrganizer] Skipping "${meeting.title}" — already mapped`,
      );
      return;
    }

    if (meeting.isRecurring && meeting.recurringEventId) {
      // Check if this recurring event series already has a folder
      const existingRecurring = this.mappingStore.getRecurringFolder(
        meeting.recurringEventId,
      );

      if (existingRecurring) {
        // Reuse existing folder — just add instance mapping
        console.log(
          `[FolderOrganizer] Reusing recurring folder for "${meeting.title}"`,
        );
        this.mappingStore.addMapping({
          meetingId: meeting.id,
          meetingTitle: meeting.title,
          folderId: existingRecurring.folderId,
          folderPath: existingRecurring.folderPath,
          isRecurring: true,
          createdAt: Date.now(),
        });
        return;
      }

      // Create new folder for this recurring event series
      const sanitizedName = this.sanitizeFolderName(meeting.title);
      const folderPath = `${this.basePath}/Recurring/${sanitizedName}`;
      const folderId = await this.supernoteClient.createFolderPath(folderPath);

      console.log(
        `[FolderOrganizer] Created recurring folder: ${folderPath} (ID: ${folderId})`,
      );

      // Save recurring folder mapping
      this.mappingStore.addRecurringFolder({
        recurringEventId: meeting.recurringEventId,
        meetingTitle: meeting.title,
        folderId,
        folderPath,
        createdAt: Date.now(),
      });

      // Save instance mapping
      this.mappingStore.addMapping({
        meetingId: meeting.id,
        meetingTitle: meeting.title,
        folderId,
        folderPath,
        isRecurring: true,
        createdAt: Date.now(),
      });
    } else {
      // Ad-hoc meeting — use shared Ad-Hoc folder
      const { adHocFolderId } = await this.ensureBaseStructure();
      const folderPath = `${this.basePath}/Ad-Hoc`;

      console.log(
        `[FolderOrganizer] Mapped ad-hoc meeting "${meeting.title}" to ${folderPath}`,
      );

      this.mappingStore.addMapping({
        meetingId: meeting.id,
        meetingTitle: meeting.title,
        folderId: adHocFolderId,
        folderPath,
        isRecurring: false,
        createdAt: Date.now(),
      });
    }
  }

  /**
   * Process a batch of new meetings, creating folders as needed.
   *
   * - Calls ensureBaseStructure() once
   * - Adds 500ms delay between Supernote API calls (rate limiting)
   * - Continues processing on individual meeting errors
   */
  async processNewMeetings(
    meetings: MeetingData[],
  ): Promise<{ created: number; skipped: number }> {
    console.log(
      `[FolderOrganizer] Processing ${meetings.length} new meetings...`,
    );

    // Ensure base structure exists
    await this.ensureBaseStructure();

    let created = 0;
    let skipped = 0;

    for (let i = 0; i < meetings.length; i++) {
      const meeting = meetings[i];

      try {
        const hadMapping = this.mappingStore.hasFolderForMeeting(meeting.id);
        await this.createFolderForMeeting(meeting);

        if (hadMapping) {
          skipped++;
        } else {
          created++;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error(
          `[FolderOrganizer] Failed to create folder for "${meeting.title}": ${errorMessage}`,
        );
        skipped++;
      }

      // Rate limiting: 500ms delay between API calls (not after last one)
      if (i < meetings.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.log(
      `[FolderOrganizer] Done — created: ${created}, skipped: ${skipped}`,
    );

    return { created, skipped };
  }
}

export default FolderOrganizer;
