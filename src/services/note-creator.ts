import SupernoteAPIClient from "./supernote-api";
import { NoteTemplateGenerator } from "./note-template-generator";
import { FolderMappingStore } from "./folder-mapping-store";
import type { MeetingData } from "./meeting-detector";

/**
 * NoteCreator
 *
 * Orchestrates the full note creation flow for meetings:
 * 1. Look up folder mapping for the meeting
 * 2. Check for duplicate notes (via noteFileName)
 * 3. Generate markdown content
 * 4. Generate filename
 * 5. Upload to Supernote Cloud
 * 6. Update mapping with noteFileName to track creation
 *
 * Uses the same batch processing and rate limiting pattern as FolderOrganizer.
 */
export class NoteCreator {
  private supernoteClient: SupernoteAPIClient;
  private templateGenerator: NoteTemplateGenerator;
  private mappingStore: FolderMappingStore;

  constructor(
    supernoteClient: SupernoteAPIClient,
    templateGenerator: NoteTemplateGenerator,
    mappingStore: FolderMappingStore,
  ) {
    this.supernoteClient = supernoteClient;
    this.templateGenerator = templateGenerator;
    this.mappingStore = mappingStore;
  }

  /**
   * Create a note for a single meeting.
   *
   * - Skips if no folder mapping exists (folder not yet created)
   * - Skips if noteFileName already set (prevents duplicate notes)
   * - Generates markdown, uploads to Supernote, updates mapping
   */
  async createNoteForMeeting(meeting: MeetingData): Promise<void> {
    // Step 1: Look up folder mapping
    const mapping = this.mappingStore.getMappingByMeetingId(meeting.id);

    if (!mapping) {
      console.warn(
        `[NoteCreator] No folder mapping for "${meeting.title}" (${meeting.id}) — skipping note creation`,
      );
      return;
    }

    // Step 2: Check for duplicate
    if (mapping.noteFileName) {
      console.log(
        `[NoteCreator] Note already exists for "${meeting.title}" (${mapping.noteFileName}) — skipping`,
      );
      return;
    }

    // Step 3: Generate markdown content
    const markdown = this.templateGenerator.generateMarkdown(meeting);

    // Step 4: Generate filename
    const fileName = this.templateGenerator.generateFileName(meeting);

    // Step 5: Upload to Supernote
    console.log(
      `[NoteCreator] Uploading note "${fileName}" to folder ${mapping.folderId}...`,
    );
    await this.supernoteClient.uploadTextFile(
      markdown,
      fileName,
      mapping.folderId,
    );

    // Step 6: Update mapping with noteFileName
    this.mappingStore.updateMapping(meeting.id, { noteFileName: fileName });

    console.log(
      `[NoteCreator] Note created for "${meeting.title}": ${fileName}`,
    );
  }

  /**
   * Process a batch of new meetings, creating notes as needed.
   *
   * - 500ms delay between uploads (rate limiting)
   * - Per-meeting try/catch for error isolation
   * - Returns counts of created and skipped notes
   */
  async processNewMeetings(
    meetings: MeetingData[],
  ): Promise<{ created: number; skipped: number }> {
    console.log(
      `[NoteCreator] Processing ${meetings.length} meetings for note creation...`,
    );

    let created = 0;
    let skipped = 0;

    for (let i = 0; i < meetings.length; i++) {
      const meeting = meetings[i];

      try {
        const mapping = this.mappingStore.getMappingByMeetingId(meeting.id);
        const hadNote = !!(mapping && mapping.noteFileName);

        await this.createNoteForMeeting(meeting);

        // Determine if we created or skipped
        if (!mapping || hadNote) {
          skipped++;
        } else {
          created++;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error(
          `[NoteCreator] Failed to create note for "${meeting.title}": ${errorMessage}`,
        );
        skipped++;
      }

      // Rate limiting: 500ms delay between API calls (not after last one)
      if (i < meetings.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.log(
      `[NoteCreator] Done — created: ${created}, skipped: ${skipped}`,
    );

    return { created, skipped };
  }
}

export default NoteCreator;
