import { NoteCreator } from "../src/services/note-creator";
import type { MeetingData } from "../src/services/meeting-detector";

// Use fake timers to avoid slow 500ms delays in processNewMeetings
jest.useFakeTimers();

// Mock SupernoteAPIClient
const mockUploadTextFile = jest.fn();
const mockSupernoteClient = {
  uploadTextFile: mockUploadTextFile,
  authenticate: jest.fn(),
  isAuthenticated: jest.fn(() => true),
} as any;

// Mock NoteTemplateGenerator
const mockGenerateMarkdown = jest.fn();
const mockGenerateFileName = jest.fn();
const mockTemplateGenerator = {
  generateMarkdown: mockGenerateMarkdown,
  generateFileName: mockGenerateFileName,
} as any;

// Mock FolderMappingStore
const mockGetMappingByMeetingId = jest.fn();
const mockUpdateMapping = jest.fn();
const mockMappingStore = {
  getMappingByMeetingId: mockGetMappingByMeetingId,
  updateMapping: mockUpdateMapping,
} as any;

function makeMeeting(overrides: Partial<MeetingData> = {}): MeetingData {
  return {
    id: "meeting-1",
    title: "Team Standup",
    startTime: "2026-03-16T09:00:00-07:00",
    endTime: "2026-03-16T09:30:00-07:00",
    attendees: [
      {
        email: "alice@example.com",
        displayName: "Alice",
        responseStatus: "accepted",
      },
    ],
    isRecurring: false,
    ...overrides,
  };
}

describe("NoteCreator", () => {
  let noteCreator: NoteCreator;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock returns
    mockGenerateMarkdown.mockReturnValue("# Team Standup\n\n**Date:** ...");
    mockGenerateFileName.mockReturnValue("2026-03-16 09-00 Team Standup.md");
    mockUploadTextFile.mockResolvedValue({ success: true });

    noteCreator = new NoteCreator(
      mockSupernoteClient,
      mockTemplateGenerator,
      mockMappingStore,
    );
  });

  describe("createNoteForMeeting", () => {
    it("generates and uploads note when folder mapping exists", async () => {
      mockGetMappingByMeetingId.mockReturnValue({
        meetingId: "meeting-1",
        meetingTitle: "Team Standup",
        folderId: 42,
        folderPath: "Calendar/Ad-Hoc",
        isRecurring: false,
        createdAt: Date.now(),
      });

      const meeting = makeMeeting();
      await noteCreator.createNoteForMeeting(meeting);

      // Should generate markdown
      expect(mockGenerateMarkdown).toHaveBeenCalledWith(meeting);

      // Should generate filename
      expect(mockGenerateFileName).toHaveBeenCalledWith(meeting);

      // Should upload to correct folder
      expect(mockUploadTextFile).toHaveBeenCalledWith(
        "# Team Standup\n\n**Date:** ...",
        "2026-03-16 09-00 Team Standup.md",
        42,
      );

      // Should update mapping with noteFileName
      expect(mockUpdateMapping).toHaveBeenCalledWith("meeting-1", {
        noteFileName: "2026-03-16 09-00 Team Standup.md",
      });
    });

    it("skips when no folder mapping exists", async () => {
      mockGetMappingByMeetingId.mockReturnValue(undefined);

      const meeting = makeMeeting();
      await noteCreator.createNoteForMeeting(meeting);

      expect(mockGenerateMarkdown).not.toHaveBeenCalled();
      expect(mockUploadTextFile).not.toHaveBeenCalled();
      expect(mockUpdateMapping).not.toHaveBeenCalled();
    });

    it("skips when noteFileName already set (duplicate prevention)", async () => {
      mockGetMappingByMeetingId.mockReturnValue({
        meetingId: "meeting-1",
        meetingTitle: "Team Standup",
        folderId: 42,
        folderPath: "Calendar/Ad-Hoc",
        isRecurring: false,
        createdAt: Date.now(),
        noteFileName: "2026-03-16 09-00 Team Standup.md",
      });

      const meeting = makeMeeting();
      await noteCreator.createNoteForMeeting(meeting);

      expect(mockGenerateMarkdown).not.toHaveBeenCalled();
      expect(mockUploadTextFile).not.toHaveBeenCalled();
      expect(mockUpdateMapping).not.toHaveBeenCalled();
    });

    it("handles upload failure gracefully", async () => {
      mockGetMappingByMeetingId.mockReturnValue({
        meetingId: "meeting-1",
        meetingTitle: "Team Standup",
        folderId: 42,
        folderPath: "Calendar/Ad-Hoc",
        isRecurring: false,
        createdAt: Date.now(),
      });

      mockUploadTextFile.mockRejectedValue(new Error("S3 upload failed"));

      const meeting = makeMeeting();

      await expect(noteCreator.createNoteForMeeting(meeting)).rejects.toThrow(
        "S3 upload failed",
      );

      // Should NOT update mapping on failure
      expect(mockUpdateMapping).not.toHaveBeenCalled();
    });
  });

  describe("processNewMeetings", () => {
    it("processes batch with rate limiting", async () => {
      // Both meetings have folder mappings
      mockGetMappingByMeetingId
        .mockReturnValueOnce({
          meetingId: "m1",
          folderId: 10,
          folderPath: "Calendar/Ad-Hoc",
          isRecurring: false,
          createdAt: Date.now(),
        })
        .mockReturnValueOnce({
          meetingId: "m1",
          folderId: 10,
          folderPath: "Calendar/Ad-Hoc",
          isRecurring: false,
          createdAt: Date.now(),
        })
        .mockReturnValueOnce({
          meetingId: "m2",
          folderId: 20,
          folderPath: "Calendar/Ad-Hoc",
          isRecurring: false,
          createdAt: Date.now(),
        })
        .mockReturnValueOnce({
          meetingId: "m2",
          folderId: 20,
          folderPath: "Calendar/Ad-Hoc",
          isRecurring: false,
          createdAt: Date.now(),
        });

      const meetings = [
        makeMeeting({ id: "m1", title: "Meeting 1" }),
        makeMeeting({ id: "m2", title: "Meeting 2" }),
      ];

      const resultPromise = noteCreator.processNewMeetings(meetings);

      // Advance timers to handle the 500ms delay between meetings
      await jest.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;

      expect(result.created).toBe(2);
      expect(result.skipped).toBe(0);
      expect(mockUploadTextFile).toHaveBeenCalledTimes(2);
    });

    it("continues after individual meeting error", async () => {
      // First meeting has mapping but upload fails
      mockGetMappingByMeetingId
        .mockReturnValueOnce({
          meetingId: "m1",
          folderId: 10,
          folderPath: "Calendar/Ad-Hoc",
          isRecurring: false,
          createdAt: Date.now(),
        })
        .mockReturnValueOnce({
          meetingId: "m1",
          folderId: 10,
          folderPath: "Calendar/Ad-Hoc",
          isRecurring: false,
          createdAt: Date.now(),
        })
        .mockReturnValueOnce({
          meetingId: "m2",
          folderId: 20,
          folderPath: "Calendar/Ad-Hoc",
          isRecurring: false,
          createdAt: Date.now(),
        })
        .mockReturnValueOnce({
          meetingId: "m2",
          folderId: 20,
          folderPath: "Calendar/Ad-Hoc",
          isRecurring: false,
          createdAt: Date.now(),
        });

      mockUploadTextFile
        .mockRejectedValueOnce(new Error("API error"))
        .mockResolvedValueOnce({ success: true });

      const meetings = [
        makeMeeting({ id: "m1", title: "Broken" }),
        makeMeeting({ id: "m2", title: "Works" }),
      ];

      const resultPromise = noteCreator.processNewMeetings(meetings);
      await jest.advanceTimersByTimeAsync(1000);
      const result = await resultPromise;

      expect(result.skipped).toBe(1);
      expect(result.created).toBe(1);
    });

    it("skips meetings without folder mappings", async () => {
      mockGetMappingByMeetingId
        .mockReturnValueOnce(undefined) // m1: no mapping (in processNewMeetings)
        .mockReturnValueOnce(undefined) // m1: no mapping (in createNoteForMeeting)
        .mockReturnValueOnce({
          meetingId: "m2",
          folderId: 20,
          folderPath: "Calendar/Ad-Hoc",
          isRecurring: false,
          createdAt: Date.now(),
        })
        .mockReturnValueOnce({
          meetingId: "m2",
          folderId: 20,
          folderPath: "Calendar/Ad-Hoc",
          isRecurring: false,
          createdAt: Date.now(),
        });

      const meetings = [
        makeMeeting({ id: "m1", title: "No Mapping" }),
        makeMeeting({ id: "m2", title: "Has Mapping" }),
      ];

      const resultPromise = noteCreator.processNewMeetings(meetings);
      await jest.advanceTimersByTimeAsync(1000);
      const result = await resultPromise;

      expect(result.skipped).toBe(1);
      expect(result.created).toBe(1);
      expect(mockUploadTextFile).toHaveBeenCalledTimes(1);
    });
  });
});

describe("FolderMappingStore.updateMapping", () => {
  // This test uses the real FolderMappingStore to verify updateMapping
  let store: any;
  let tmpDir: string;

  beforeEach(() => {
    const fs = require("fs");
    const path = require("path");
    const os = require("os");
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "note-creator-test-"));
    const testFilePath = path.join(tmpDir, "folder-mappings.json");

    const {
      FolderMappingStore,
    } = require("../src/services/folder-mapping-store");
    store = new FolderMappingStore(testFilePath);
  });

  afterEach(() => {
    const fs = require("fs");
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("updates existing mapping with partial data", () => {
    store.addMapping({
      meetingId: "test-meeting",
      meetingTitle: "Test Meeting",
      folderId: 42,
      folderPath: "Calendar/Ad-Hoc",
      isRecurring: false,
      createdAt: Date.now(),
    });

    store.updateMapping("test-meeting", {
      noteFileName: "2026-03-16 Test Meeting.md",
    });

    const updated = store.getMappingByMeetingId("test-meeting");
    expect(updated).toBeDefined();
    expect(updated!.noteFileName).toBe("2026-03-16 Test Meeting.md");
    expect(updated!.folderId).toBe(42); // unchanged
    expect(updated!.meetingTitle).toBe("Test Meeting"); // unchanged
  });

  it("does nothing when meetingId not found", () => {
    store.addMapping({
      meetingId: "existing",
      meetingTitle: "Existing",
      folderId: 1,
      folderPath: "Calendar/Ad-Hoc",
      isRecurring: false,
      createdAt: Date.now(),
    });

    // Should not throw
    store.updateMapping("nonexistent", { noteFileName: "file.md" });

    // Original mapping unchanged
    const existing = store.getMappingByMeetingId("existing");
    expect(existing).toBeDefined();
    expect(existing!.noteFileName).toBeUndefined();
  });
});
