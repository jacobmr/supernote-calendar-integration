import { FolderOrganizer } from "../../src/services/folder-organizer";
import { NoteCreator } from "../../src/services/note-creator";
import { NoteTemplateGenerator } from "../../src/services/note-template-generator";
import {
  createRecurringMeeting,
  createRecurringInstance,
  createMockSupernoteClient,
  createTempMappingStore,
  resetCounters,
  type MockSupernoteClient,
} from "./pipeline-helpers";
import type { FolderMappingStore } from "../../src/services/folder-mapping-store";

jest.setTimeout(15000);

describe("Recurring meeting pipeline integration", () => {
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

  it("should create folder and note for a new recurring meeting", async () => {
    const meeting = createRecurringMeeting({
      title: "Weekly Standup",
      startTime: "2026-03-16T10:00:00Z",
      endTime: "2026-03-16T10:30:00Z",
    });

    // ── Phase 1: Folder creation ──────────────────────────────────────────
    const folderOrganizer = new FolderOrganizer(
      mockClient as any,
      mappingStore,
    );
    const folderResult = await folderOrganizer.processNewMeetings([meeting]);

    expect(folderResult.created).toBe(1);
    expect(folderResult.skipped).toBe(0);

    // Verify createFolderPath calls: base structure (Recurring + Ad-Hoc) + meeting subfolder
    const { folderCreations } = mockClient.getCalls();
    const folderPaths = folderCreations.map((c) => c.path);
    expect(folderPaths).toContain("Calendar/Recurring");
    expect(folderPaths).toContain("Calendar/Ad-Hoc");
    expect(
      folderPaths.some((p) => p.startsWith("Calendar/Recurring/Weekly")),
    ).toBe(true);

    // Verify FolderMappingStore has mapping
    expect(mappingStore.hasFolderForMeeting(meeting.id)).toBe(true);
    expect(
      mappingStore.hasFolderForRecurringEvent(meeting.recurringEventId!),
    ).toBe(true);

    // ── Phase 2: Note creation ────────────────────────────────────────────
    const templateGenerator = new NoteTemplateGenerator();
    const noteCreator = new NoteCreator(
      mockClient as any,
      templateGenerator,
      mappingStore,
    );
    const noteResult = await noteCreator.processNewMeetings([meeting]);

    expect(noteResult.created).toBe(1);
    expect(noteResult.skipped).toBe(0);

    // Verify uploadTextFile called once
    const { uploads } = mockClient.getCalls();
    expect(uploads).toHaveLength(1);

    // Verify filename matches YYYY-MM-DD Title.md pattern (recurring omits time)
    expect(uploads[0].fileName).toMatch(/^\d{4}-\d{2}-\d{2} .+\.md$/);
    expect(uploads[0].fileName).toContain("Weekly Standup");

    // Verify content includes meeting sections
    const content = uploads[0].content;
    expect(content).toContain("# Weekly Standup");
    expect(content).toContain("## Attendees");
    expect(content).toContain("## Action Items");

    // Verify mapping now has noteFileName set
    const updatedMapping = mappingStore.getMappingByMeetingId(meeting.id);
    expect(updatedMapping).toBeDefined();
    expect(updatedMapping!.noteFileName).toBeDefined();
    expect(updatedMapping!.noteFileName).toMatch(/\.md$/);
  });

  it("should reuse folder for second instance of same recurring event", async () => {
    const recurringEventId = "series-reuse-test";
    const instance1 = createRecurringInstance(recurringEventId, 1, {
      title: "Design Review",
    });
    const instance2 = createRecurringInstance(recurringEventId, 2, {
      title: "Design Review",
    });

    const folderOrganizer = new FolderOrganizer(
      mockClient as any,
      mappingStore,
    );

    // ── Process first instance — creates folder ───────────────────────────
    await folderOrganizer.processNewMeetings([instance1]);

    const callsAfterFirst = mockClient.getCalls();
    const meetingFolderCalls = callsAfterFirst.folderCreations.filter((c) =>
      c.path.startsWith("Calendar/Recurring/Design"),
    );
    expect(meetingFolderCalls).toHaveLength(1);
    const firstFolderId = meetingFolderCalls[0].returnedId;

    // ── Process second instance — reuses folder (no new subfolder) ────────
    mockClient.resetCalls();
    await folderOrganizer.processNewMeetings([instance2]);

    const callsAfterSecond = mockClient.getCalls();
    const newMeetingFolderCalls = callsAfterSecond.folderCreations.filter((c) =>
      c.path.startsWith("Calendar/Recurring/Design"),
    );
    // No new createFolderPath for the meeting subfolder
    expect(newMeetingFolderCalls).toHaveLength(0);

    // Both instances mapped to same folderId
    const mapping1 = mappingStore.getMappingByMeetingId(instance1.id);
    const mapping2 = mappingStore.getMappingByMeetingId(instance2.id);
    expect(mapping1).toBeDefined();
    expect(mapping2).toBeDefined();
    expect(mapping1!.folderId).toBe(mapping2!.folderId);
    expect(mapping1!.folderId).toBe(firstFolderId);

    // ── Note creation: both instances get separate notes ──────────────────
    const templateGenerator = new NoteTemplateGenerator();
    const noteCreator = new NoteCreator(
      mockClient as any,
      templateGenerator,
      mappingStore,
    );

    mockClient.resetCalls();
    await noteCreator.processNewMeetings([instance1, instance2]);

    const { uploads } = mockClient.getCalls();
    expect(uploads).toHaveLength(2);

    // Different filenames (different dates)
    expect(uploads[0].fileName).not.toBe(uploads[1].fileName);

    // Both uploaded to the same folder
    expect(uploads[0].folderId).toBe(uploads[1].folderId);
  });

  it("should not re-create note on second run (deduplication)", async () => {
    const meeting = createRecurringMeeting({
      title: "Sprint Retro",
      startTime: "2026-03-18T15:00:00Z",
      endTime: "2026-03-18T16:00:00Z",
    });

    // ── Full pipeline: folder + note ──────────────────────────────────────
    const folderOrganizer = new FolderOrganizer(
      mockClient as any,
      mappingStore,
    );
    await folderOrganizer.processNewMeetings([meeting]);

    const templateGenerator = new NoteTemplateGenerator();
    const noteCreator = new NoteCreator(
      mockClient as any,
      templateGenerator,
      mappingStore,
    );
    const firstResult = await noteCreator.processNewMeetings([meeting]);
    expect(firstResult.created).toBe(1);

    // Verify note was created
    const mapping = mappingStore.getMappingByMeetingId(meeting.id);
    expect(mapping!.noteFileName).toBeDefined();

    // ── Second run: same meeting through NoteCreator again ────────────────
    mockClient.resetCalls();
    const secondResult = await noteCreator.processNewMeetings([meeting]);

    // uploadTextFile NOT called (note already exists)
    const { uploads } = mockClient.getCalls();
    expect(uploads).toHaveLength(0);

    // Returns skipped count
    expect(secondResult.created).toBe(0);
    expect(secondResult.skipped).toBe(1);
  });
});
