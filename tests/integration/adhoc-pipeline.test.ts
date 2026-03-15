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

describe("Ad-hoc meeting pipeline integration", () => {
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

  it("should create note in shared Ad-Hoc folder for ad-hoc meeting", async () => {
    const meeting = createAdHocMeeting({
      title: "Project Kickoff",
      startTime: "2026-03-17T14:00:00Z",
      endTime: "2026-03-17T15:00:00Z",
    });

    // ── Phase 1: Folder organization ──────────────────────────────────────
    const folderOrganizer = new FolderOrganizer(
      mockClient as any,
      mappingStore,
    );
    const folderResult = await folderOrganizer.processNewMeetings([meeting]);

    expect(folderResult.created).toBe(1);
    expect(folderResult.skipped).toBe(0);

    // Verify createFolderPath calls: base structure only, NO per-meeting subfolder
    const { folderCreations } = mockClient.getCalls();
    const folderPaths = folderCreations.map((c) => c.path);
    expect(folderPaths).toContain("Calendar/Recurring");
    expect(folderPaths).toContain("Calendar/Ad-Hoc");
    // No subfolder under Ad-Hoc for the specific meeting
    const adHocSubfolders = folderPaths.filter((p) =>
      p.startsWith("Calendar/Ad-Hoc/"),
    );
    expect(adHocSubfolders).toHaveLength(0);

    // Verify mapping store has entry with folderPath = "Calendar/Ad-Hoc"
    expect(mappingStore.hasFolderForMeeting(meeting.id)).toBe(true);
    const mapping = mappingStore.getMappingByMeetingId(meeting.id);
    expect(mapping).toBeDefined();
    expect(mapping!.folderPath).toBe("Calendar/Ad-Hoc");

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

    // Verify filename matches YYYY-MM-DD HH-MM Title.md pattern (ad-hoc includes time)
    expect(uploads[0].fileName).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}-\d{2} .+\.md$/,
    );
    expect(uploads[0].fileName).toContain("Project Kickoff");

    // Verify content includes expected meeting sections
    const content = uploads[0].content;
    expect(content).toContain("# Project Kickoff");
    expect(content).toContain("## Attendees");
    expect(content).toContain("## Action Items");
  });

  it("should handle mixed batch of recurring and ad-hoc meetings", async () => {
    const recurring1 = createRecurringMeeting({
      title: "Weekly Standup",
      startTime: "2026-03-16T10:00:00Z",
      endTime: "2026-03-16T10:30:00Z",
      recurringEventId: "series-a",
    });
    const recurring2 = createRecurringMeeting({
      title: "Design Review",
      startTime: "2026-03-16T14:00:00Z",
      endTime: "2026-03-16T15:00:00Z",
      recurringEventId: "series-b",
    });
    const adHoc1 = createAdHocMeeting({
      title: "Client Sync",
      startTime: "2026-03-17T09:00:00Z",
      endTime: "2026-03-17T09:30:00Z",
    });
    const adHoc2 = createAdHocMeeting({
      title: "Budget Discussion",
      startTime: "2026-03-17T11:00:00Z",
      endTime: "2026-03-17T12:00:00Z",
    });

    const allMeetings = [recurring1, recurring2, adHoc1, adHoc2];

    // ── Phase 1: Folder creation for all 4 ────────────────────────────────
    const folderOrganizer = new FolderOrganizer(
      mockClient as any,
      mappingStore,
    );
    const folderResult = await folderOrganizer.processNewMeetings(allMeetings);

    expect(folderResult.created).toBe(4);
    expect(folderResult.skipped).toBe(0);

    // Verify: recurring meetings get individual subfolders
    const { folderCreations } = mockClient.getCalls();
    const folderPaths = folderCreations.map((c) => c.path);
    expect(
      folderPaths.some((p) => p.startsWith("Calendar/Recurring/Weekly")),
    ).toBe(true);
    expect(
      folderPaths.some((p) => p.startsWith("Calendar/Recurring/Design")),
    ).toBe(true);

    // Ad-hoc meetings share one folder — no per-meeting subfolders
    const adHocSubfolders = folderPaths.filter((p) =>
      p.startsWith("Calendar/Ad-Hoc/"),
    );
    expect(adHocSubfolders).toHaveLength(0);

    // 4 mappings total in store
    expect(mappingStore.hasFolderForMeeting(recurring1.id)).toBe(true);
    expect(mappingStore.hasFolderForMeeting(recurring2.id)).toBe(true);
    expect(mappingStore.hasFolderForMeeting(adHoc1.id)).toBe(true);
    expect(mappingStore.hasFolderForMeeting(adHoc2.id)).toBe(true);

    // ── Phase 2: Note creation for all 4 ──────────────────────────────────
    const templateGenerator = new NoteTemplateGenerator();
    const noteCreator = new NoteCreator(
      mockClient as any,
      templateGenerator,
      mappingStore,
    );
    mockClient.resetCalls();
    const noteResult = await noteCreator.processNewMeetings(allMeetings);

    expect(noteResult.created).toBe(4);
    expect(noteResult.skipped).toBe(0);

    const { uploads } = mockClient.getCalls();
    expect(uploads).toHaveLength(4);

    // Verify: recurring notes have date-only filenames (no time component)
    const recurringUploads = uploads.filter(
      (u) => u.fileName.includes("Standup") || u.fileName.includes("Design"),
    );
    for (const upload of recurringUploads) {
      expect(upload.fileName).toMatch(/^\d{4}-\d{2}-\d{2} [A-Z].*\.md$/);
      // Should NOT contain HH-MM time pattern between date and title
      expect(upload.fileName).not.toMatch(/^\d{4}-\d{2}-\d{2} \d{2}-\d{2} /);
    }

    // Verify: ad-hoc notes have date+time filenames
    const adHocUploads = uploads.filter(
      (u) => u.fileName.includes("Client") || u.fileName.includes("Budget"),
    );
    for (const upload of adHocUploads) {
      expect(upload.fileName).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}-\d{2} .+\.md$/);
    }
  });

  it("should not re-create note for ad-hoc meeting on second run", async () => {
    const meeting = createAdHocMeeting({
      title: "One-off Planning",
      startTime: "2026-03-18T16:00:00Z",
      endTime: "2026-03-18T17:00:00Z",
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
