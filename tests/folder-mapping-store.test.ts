import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  FolderMappingStore,
  FolderMapping,
  RecurringFolderMapping,
} from "../src/services/folder-mapping-store";

describe("FolderMappingStore", () => {
  let store: FolderMappingStore;
  let tmpDir: string;
  let testFilePath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "folder-mapping-test-"));
    testFilePath = path.join(tmpDir, "folder-mappings.json");
    store = new FolderMappingStore(testFilePath);
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should return empty state when file does not exist", () => {
    const state = store.loadState();

    expect(state.mappings).toEqual([]);
    expect(state.recurringFolders).toEqual([]);
    console.log("✓ Empty state when file missing");
  });

  it("should add a mapping and retrieve it by meeting ID", () => {
    const mapping: FolderMapping = {
      meetingId: "meeting-abc",
      meetingTitle: "Team Standup",
      folderId: 12345,
      folderPath: "/Recurring/Team Standup",
      isRecurring: true,
      createdAt: Date.now(),
    };

    store.addMapping(mapping);

    const retrieved = store.getMappingByMeetingId("meeting-abc");
    expect(retrieved).toBeDefined();
    expect(retrieved!.meetingId).toBe("meeting-abc");
    expect(retrieved!.folderId).toBe(12345);
    expect(retrieved!.folderPath).toBe("/Recurring/Team Standup");
    expect(retrieved!.isRecurring).toBe(true);
    console.log("✓ Add and retrieve mapping by meeting ID");
  });

  it("should add a recurring folder mapping and retrieve it", () => {
    const recurringMapping: RecurringFolderMapping = {
      recurringEventId: "recurring-parent-xyz",
      meetingTitle: "Weekly Review",
      folderId: 67890,
      folderPath: "/Recurring/Weekly Review",
      createdAt: Date.now(),
    };

    store.addRecurringFolder(recurringMapping);

    const retrieved = store.getRecurringFolder("recurring-parent-xyz");
    expect(retrieved).toBeDefined();
    expect(retrieved!.recurringEventId).toBe("recurring-parent-xyz");
    expect(retrieved!.folderId).toBe(67890);
    expect(retrieved!.folderPath).toBe("/Recurring/Weekly Review");
    console.log("✓ Add and retrieve recurring folder mapping");
  });

  it("should return true for hasFolderForMeeting when mapping exists", () => {
    const mapping: FolderMapping = {
      meetingId: "meeting-exists",
      meetingTitle: "Existing Meeting",
      folderId: 111,
      folderPath: "/Ad-Hoc/Existing Meeting",
      isRecurring: false,
      createdAt: Date.now(),
    };

    store.addMapping(mapping);

    expect(store.hasFolderForMeeting("meeting-exists")).toBe(true);
    expect(store.hasFolderForMeeting("meeting-nonexistent")).toBe(false);
    console.log("✓ hasFolderForMeeting returns correct boolean");
  });

  it("should return true for hasFolderForRecurringEvent when mapping exists", () => {
    const recurringMapping: RecurringFolderMapping = {
      recurringEventId: "recurring-exists",
      meetingTitle: "Recurring Event",
      folderId: 222,
      folderPath: "/Recurring/Recurring Event",
      createdAt: Date.now(),
    };

    store.addRecurringFolder(recurringMapping);

    expect(store.hasFolderForRecurringEvent("recurring-exists")).toBe(true);
    expect(store.hasFolderForRecurringEvent("recurring-nonexistent")).toBe(
      false,
    );
    console.log("✓ hasFolderForRecurringEvent returns correct boolean");
  });

  it("should persist state across store instances", () => {
    const mapping: FolderMapping = {
      meetingId: "persist-test",
      meetingTitle: "Persist Test Meeting",
      folderId: 333,
      folderPath: "/Ad-Hoc/Persist Test",
      isRecurring: false,
      createdAt: Date.now(),
    };

    store.addMapping(mapping);

    // Create a new store instance pointing to the same file
    const newStore = new FolderMappingStore(testFilePath);
    const retrieved = newStore.getMappingByMeetingId("persist-test");

    expect(retrieved).toBeDefined();
    expect(retrieved!.meetingTitle).toBe("Persist Test Meeting");
    console.log("✓ State persists across store instances");
  });

  it("should handle multiple mappings of both types", () => {
    store.addMapping({
      meetingId: "m1",
      meetingTitle: "Meeting 1",
      folderId: 1,
      folderPath: "/Ad-Hoc/Meeting 1",
      isRecurring: false,
      createdAt: Date.now(),
    });

    store.addMapping({
      meetingId: "m2",
      meetingTitle: "Meeting 2",
      folderId: 2,
      folderPath: "/Recurring/Meeting 2",
      isRecurring: true,
      createdAt: Date.now(),
    });

    store.addRecurringFolder({
      recurringEventId: "r1",
      meetingTitle: "Recurring 1",
      folderId: 10,
      folderPath: "/Recurring/Recurring 1",
      createdAt: Date.now(),
    });

    const state = store.loadState();
    expect(state.mappings.length).toBe(2);
    expect(state.recurringFolders.length).toBe(1);
    expect(store.hasFolderForMeeting("m1")).toBe(true);
    expect(store.hasFolderForMeeting("m2")).toBe(true);
    expect(store.hasFolderForRecurringEvent("r1")).toBe(true);
    console.log("✓ Multiple mappings of both types handled correctly");
  });
});
