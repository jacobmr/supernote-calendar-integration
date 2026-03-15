import { FolderOrganizer } from "../../src/services/folder-organizer";
import { NoteCreator } from "../../src/services/note-creator";
import { NoteTemplateGenerator } from "../../src/services/note-template-generator";
import {
  createRecurringMeeting,
  createAdHocMeeting,
  createMockSupernoteClient,
  createTempMappingStore,
  resetCounters,
  type MockSupernoteClient,
} from "./pipeline-helpers";
import type { FolderMappingStore } from "../../src/services/folder-mapping-store";

jest.setTimeout(15000);

describe("Pipeline edge cases", () => {
  let mockClient: MockSupernoteClient;
  let mappingStore: FolderMappingStore;
  let cleanupStore: () => void;

  beforeEach(() => {
    resetCounters();
    mockClient = createMockSupernoteClient();
    const temp = createTempMappingStore();
    mappingStore = temp.store;
    cleanupStore = temp.cleanup;
  });

  afterEach(() => {
    cleanupStore();
  });

  it("should skip note creation when no folder mapping exists", async () => {
    const meeting = createAdHocMeeting({
      title: "Unmapped Meeting",
      startTime: "2026-03-19T10:00:00Z",
      endTime: "2026-03-19T11:00:00Z",
    });

    // Do NOT run through FolderOrganizer — go directly to NoteCreator
    const templateGenerator = new NoteTemplateGenerator();
    const noteCreator = new NoteCreator(
      mockClient as any,
      templateGenerator,
      mappingStore,
    );
    const result = await noteCreator.processNewMeetings([meeting]);

    // uploadTextFile NOT called
    const { uploads } = mockClient.getCalls();
    expect(uploads).toHaveLength(0);

    // Returns skipped
    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it("should isolate errors per meeting in batch", async () => {
    const meeting1 = createRecurringMeeting({
      title: "Morning Standup",
      startTime: "2026-03-16T09:00:00Z",
      endTime: "2026-03-16T09:30:00Z",
      recurringEventId: "series-err-1",
    });
    const meeting2 = createRecurringMeeting({
      title: "Failing Meeting",
      startTime: "2026-03-16T11:00:00Z",
      endTime: "2026-03-16T11:30:00Z",
      recurringEventId: "series-err-2",
    });
    const meeting3 = createRecurringMeeting({
      title: "Afternoon Sync",
      startTime: "2026-03-16T15:00:00Z",
      endTime: "2026-03-16T15:30:00Z",
      recurringEventId: "series-err-3",
    });

    const allMeetings = [meeting1, meeting2, meeting3];

    // ── Process all through FolderOrganizer first ─────────────────────────
    const folderOrganizer = new FolderOrganizer(
      mockClient as any,
      mappingStore,
    );
    await folderOrganizer.processNewMeetings(allMeetings);

    // ── Configure uploadTextFile to throw on 2nd call only ────────────────
    let uploadCallCount = 0;
    mockClient.uploadTextFile.mockImplementation(
      (content: string, fileName: string, folderId: number) => {
        uploadCallCount++;
        if (uploadCallCount === 2) {
          return Promise.reject(new Error("Simulated upload failure"));
        }
        return Promise.resolve({ success: true });
      },
    );

    const templateGenerator = new NoteTemplateGenerator();
    const noteCreator = new NoteCreator(
      mockClient as any,
      templateGenerator,
      mappingStore,
    );
    const result = await noteCreator.processNewMeetings(allMeetings);

    // 1st and 3rd succeed, 2nd fails
    expect(result.created).toBe(2);
    expect(result.skipped).toBe(1);

    // uploadTextFile was called 3 times (all attempted)
    expect(mockClient.uploadTextFile).toHaveBeenCalledTimes(3);

    // 1st and 3rd meetings should have noteFileName set
    const mapping1 = mappingStore.getMappingByMeetingId(meeting1.id);
    const mapping3 = mappingStore.getMappingByMeetingId(meeting3.id);
    expect(mapping1!.noteFileName).toBeDefined();
    expect(mapping3!.noteFileName).toBeDefined();

    // 2nd meeting should NOT have noteFileName (upload failed)
    const mapping2 = mappingStore.getMappingByMeetingId(meeting2.id);
    expect(mapping2!.noteFileName).toBeUndefined();
  });

  it("should handle empty meeting list gracefully", async () => {
    const folderOrganizer = new FolderOrganizer(
      mockClient as any,
      mappingStore,
    );
    const folderResult = await folderOrganizer.processNewMeetings([]);

    // Base structure still created, but no meeting-specific work
    expect(folderResult.created).toBe(0);
    expect(folderResult.skipped).toBe(0);

    const templateGenerator = new NoteTemplateGenerator();
    const noteCreator = new NoteCreator(
      mockClient as any,
      templateGenerator,
      mappingStore,
    );
    mockClient.resetCalls();
    const noteResult = await noteCreator.processNewMeetings([]);

    expect(noteResult.created).toBe(0);
    expect(noteResult.skipped).toBe(0);

    // No upload calls made for empty list
    const { uploads } = mockClient.getCalls();
    expect(uploads).toHaveLength(0);
  });

  it("should handle folder creation failure gracefully", async () => {
    const meeting = createRecurringMeeting({
      title: "Doomed Meeting",
      startTime: "2026-03-20T10:00:00Z",
      endTime: "2026-03-20T10:30:00Z",
      recurringEventId: "series-doom",
    });

    // Configure createFolderPath to succeed for base structure but fail for meeting subfolder
    let folderCallCount = 0;
    mockClient.createFolderPath.mockImplementation((folderPath: string) => {
      folderCallCount++;
      // First two calls are base structure (Calendar/Recurring, Calendar/Ad-Hoc)
      if (folderCallCount <= 2) {
        return Promise.resolve(folderCallCount + 100);
      }
      // Third call is the meeting subfolder — simulate failure
      return Promise.reject(
        new Error("Supernote API error: folder creation failed"),
      );
    });

    const folderOrganizer = new FolderOrganizer(
      mockClient as any,
      mappingStore,
    );
    const folderResult = await folderOrganizer.processNewMeetings([meeting]);

    // Error isolated — returns skipped, not thrown
    expect(folderResult.created).toBe(0);
    expect(folderResult.skipped).toBe(1);

    // No mapping created for the failed meeting
    expect(mappingStore.hasFolderForMeeting(meeting.id)).toBe(false);

    // Run through NoteCreator — should skip (no mapping exists)
    const templateGenerator = new NoteTemplateGenerator();
    const noteCreator = new NoteCreator(
      mockClient as any,
      templateGenerator,
      mappingStore,
    );
    const noteResult = await noteCreator.processNewMeetings([meeting]);

    expect(noteResult.created).toBe(0);
    expect(noteResult.skipped).toBe(1);
  });
});
