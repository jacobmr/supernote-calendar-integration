import { FolderOrganizer } from "../src/services/folder-organizer";
import type { MeetingData } from "../src/services/meeting-detector";

// Use fake timers to avoid slow 500ms delays in processNewMeetings
jest.useFakeTimers();

// Mock SupernoteAPIClient
const mockCreateFolderPath = jest.fn();
const mockSupernoteClient = {
  createFolderPath: mockCreateFolderPath,
  authenticate: jest.fn(),
  listNotebooks: jest.fn(),
  createFolder: jest.fn(),
  isAuthenticated: jest.fn(() => true),
} as any;

// Mock FolderMappingStore
const mockHasFolderForMeeting = jest.fn();
const mockHasFolderForRecurringEvent = jest.fn();
const mockGetRecurringFolder = jest.fn();
const mockAddMapping = jest.fn();
const mockAddRecurringFolder = jest.fn();
const mockMappingStore = {
  hasFolderForMeeting: mockHasFolderForMeeting,
  hasFolderForRecurringEvent: mockHasFolderForRecurringEvent,
  getRecurringFolder: mockGetRecurringFolder,
  addMapping: mockAddMapping,
  addRecurringFolder: mockAddRecurringFolder,
} as any;

function makeMeeting(overrides: Partial<MeetingData> = {}): MeetingData {
  return {
    id: "meeting-1",
    title: "Team Standup",
    startTime: "2026-03-16T09:00:00-07:00",
    endTime: "2026-03-16T09:30:00-07:00",
    attendees: [],
    isRecurring: false,
    ...overrides,
  };
}

describe("FolderOrganizer", () => {
  let organizer: FolderOrganizer;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default: createFolderPath returns incrementing IDs
    let folderIdCounter = 100;
    mockCreateFolderPath.mockImplementation(async () => ++folderIdCounter);

    // Default: no existing mappings
    mockHasFolderForMeeting.mockReturnValue(false);
    mockHasFolderForRecurringEvent.mockReturnValue(false);
    mockGetRecurringFolder.mockReturnValue(undefined);

    organizer = new FolderOrganizer(mockSupernoteClient, mockMappingStore);
  });

  describe("ensureBaseStructure", () => {
    it("creates Calendar/Recurring and Calendar/Ad-Hoc paths", async () => {
      mockCreateFolderPath
        .mockResolvedValueOnce(10) // Calendar/Recurring
        .mockResolvedValueOnce(20); // Calendar/Ad-Hoc

      const result = await organizer.ensureBaseStructure();

      expect(mockCreateFolderPath).toHaveBeenCalledWith("Calendar/Recurring");
      expect(mockCreateFolderPath).toHaveBeenCalledWith("Calendar/Ad-Hoc");
      expect(result).toEqual({ recurringFolderId: 10, adHocFolderId: 20 });
    });

    it("caches folder IDs after first call", async () => {
      mockCreateFolderPath.mockResolvedValueOnce(10).mockResolvedValueOnce(20);

      await organizer.ensureBaseStructure();
      const result2 = await organizer.ensureBaseStructure();

      // Only 2 calls total (both from first invocation)
      expect(mockCreateFolderPath).toHaveBeenCalledTimes(2);
      expect(result2).toEqual({ recurringFolderId: 10, adHocFolderId: 20 });
    });
  });

  describe("sanitizeFolderName", () => {
    it("replaces invalid characters with underscores", () => {
      expect(organizer.sanitizeFolderName('Meeting <with> "quotes"')).toBe(
        "Meeting _with_ _quotes_",
      );
    });

    it("limits name to 100 characters", () => {
      const longName = "A".repeat(150);
      expect(organizer.sanitizeFolderName(longName)).toHaveLength(100);
    });

    it("trims whitespace", () => {
      expect(organizer.sanitizeFolderName("  Meeting  ")).toBe("Meeting");
    });

    it("handles special characters like pipes and backslashes", () => {
      expect(organizer.sanitizeFolderName("Path\\to|file?name")).toBe(
        "Path_to_file_name",
      );
    });
  });

  describe("createFolderForMeeting", () => {
    it("creates folder under Recurring/[name] for recurring meetings", async () => {
      mockCreateFolderPath.mockResolvedValue(42);

      const meeting = makeMeeting({
        isRecurring: true,
        recurringEventId: "rec-001",
        title: "Daily Standup",
      });

      await organizer.createFolderForMeeting(meeting);

      expect(mockCreateFolderPath).toHaveBeenCalledWith(
        "Calendar/Recurring/Daily Standup",
      );
      expect(mockAddRecurringFolder).toHaveBeenCalledWith(
        expect.objectContaining({
          recurringEventId: "rec-001",
          meetingTitle: "Daily Standup",
          folderId: 42,
          folderPath: "Calendar/Recurring/Daily Standup",
        }),
      );
      expect(mockAddMapping).toHaveBeenCalledWith(
        expect.objectContaining({
          meetingId: meeting.id,
          folderId: 42,
          isRecurring: true,
        }),
      );
    });

    it("reuses existing recurring folder for second instance", async () => {
      const meeting = makeMeeting({
        id: "meeting-instance-2",
        isRecurring: true,
        recurringEventId: "rec-001",
        title: "Daily Standup",
      });

      // Recurring folder already exists
      mockGetRecurringFolder.mockReturnValue({
        recurringEventId: "rec-001",
        folderId: 42,
        folderPath: "Calendar/Recurring/Daily Standup",
      });

      await organizer.createFolderForMeeting(meeting);

      // Should NOT create a new folder
      expect(mockCreateFolderPath).not.toHaveBeenCalled();
      // Should add instance mapping pointing to existing folder
      expect(mockAddMapping).toHaveBeenCalledWith(
        expect.objectContaining({
          meetingId: "meeting-instance-2",
          folderId: 42,
          folderPath: "Calendar/Recurring/Daily Standup",
          isRecurring: true,
        }),
      );
      // Should NOT add a new recurring folder mapping
      expect(mockAddRecurringFolder).not.toHaveBeenCalled();
    });

    it("maps ad-hoc meeting to Calendar/Ad-Hoc folder", async () => {
      mockCreateFolderPath
        .mockResolvedValueOnce(10) // Calendar/Recurring
        .mockResolvedValueOnce(20); // Calendar/Ad-Hoc

      const meeting = makeMeeting({
        isRecurring: false,
        title: "Coffee Chat",
      });

      await organizer.createFolderForMeeting(meeting);

      // Should use the Ad-Hoc folder ID
      expect(mockAddMapping).toHaveBeenCalledWith(
        expect.objectContaining({
          meetingId: meeting.id,
          folderId: 20,
          folderPath: "Calendar/Ad-Hoc",
          isRecurring: false,
        }),
      );
    });

    it("skips meeting with existing folder mapping", async () => {
      mockHasFolderForMeeting.mockReturnValue(true);

      const meeting = makeMeeting();
      await organizer.createFolderForMeeting(meeting);

      expect(mockCreateFolderPath).not.toHaveBeenCalled();
      expect(mockAddMapping).not.toHaveBeenCalled();
    });
  });

  describe("processNewMeetings", () => {
    it("returns correct created and skipped counts", async () => {
      mockCreateFolderPath
        .mockResolvedValueOnce(10) // base: Calendar/Recurring
        .mockResolvedValueOnce(20) // base: Calendar/Ad-Hoc
        .mockResolvedValueOnce(30); // recurring folder

      const meetings = [
        makeMeeting({
          id: "m1",
          isRecurring: true,
          recurringEventId: "r1",
          title: "Standup",
        }),
        makeMeeting({ id: "m2", isRecurring: false, title: "Lunch" }),
      ];

      const resultPromise = organizer.processNewMeetings(meetings);

      // Advance timers to handle the 500ms delay between meetings
      await jest.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;

      expect(result.created).toBe(2);
      expect(result.skipped).toBe(0);
    });

    it("continues after individual meeting error", async () => {
      mockCreateFolderPath
        .mockResolvedValueOnce(10) // base: Calendar/Recurring
        .mockResolvedValueOnce(20) // base: Calendar/Ad-Hoc
        .mockRejectedValueOnce(new Error("API error")) // first meeting fails
        .mockResolvedValueOnce(30); // second meeting succeeds (but it's ad-hoc, uses cached)

      const meetings = [
        makeMeeting({
          id: "m1",
          isRecurring: true,
          recurringEventId: "r1",
          title: "Broken",
        }),
        makeMeeting({ id: "m2", isRecurring: false, title: "Works" }),
      ];

      const resultPromise = organizer.processNewMeetings(meetings);
      await jest.advanceTimersByTimeAsync(1000);
      const result = await resultPromise;

      // First meeting errored (skipped), second succeeded
      expect(result.skipped).toBe(1);
      expect(result.created).toBe(1);
      // The second meeting should still have a mapping
      expect(mockAddMapping).toHaveBeenCalledWith(
        expect.objectContaining({ meetingId: "m2" }),
      );
    });

    it("skips already-mapped meetings in batch", async () => {
      mockCreateFolderPath.mockResolvedValueOnce(10).mockResolvedValueOnce(20);

      // First meeting already mapped
      mockHasFolderForMeeting
        .mockReturnValueOnce(true) // first call in processNewMeetings check
        .mockReturnValueOnce(true) // second call inside createFolderForMeeting
        .mockReturnValueOnce(false) // third call for m2 in processNewMeetings
        .mockReturnValueOnce(false); // fourth call for m2 in createFolderForMeeting

      const meetings = [
        makeMeeting({ id: "m1", title: "Already Mapped" }),
        makeMeeting({ id: "m2", title: "New Meeting" }),
      ];

      const resultPromise = organizer.processNewMeetings(meetings);
      await jest.advanceTimersByTimeAsync(1000);
      const result = await resultPromise;

      expect(result.skipped).toBe(1);
      expect(result.created).toBe(1);
    });
  });
});
