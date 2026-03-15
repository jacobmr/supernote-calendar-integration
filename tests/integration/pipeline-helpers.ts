import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import type { MeetingData } from "../../src/services/meeting-detector";
import { FolderMappingStore } from "../../src/services/folder-mapping-store";

// ─── ID counters for unique, collision-free test data ────────────────────────

let meetingIdCounter = 0;
let recurringEventIdCounter = 0;
let folderIdCounter = 100;

/**
 * Reset all counters between test suites if needed.
 */
export function resetCounters(): void {
  meetingIdCounter = 0;
  recurringEventIdCounter = 0;
  folderIdCounter = 100;
}

// ─── MeetingData factory functions ───────────────────────────────────────────

/**
 * Create a recurring meeting with sensible defaults.
 * Each call produces a unique id and recurringEventId.
 */
export function createRecurringMeeting(
  overrides?: Partial<MeetingData>,
): MeetingData {
  meetingIdCounter++;
  recurringEventIdCounter++;

  return {
    id: `meeting-${meetingIdCounter}`,
    title: `Weekly Standup`,
    startTime: "2026-03-16T10:00:00Z",
    endTime: "2026-03-16T10:30:00Z",
    attendees: [
      {
        email: "alice@example.com",
        displayName: "Alice",
        responseStatus: "accepted",
      },
      {
        email: "bob@example.com",
        displayName: "Bob",
        responseStatus: "accepted",
      },
    ],
    description: "Daily sync for the team",
    isRecurring: true,
    recurringEventId: `recurring-${recurringEventIdCounter}`,
    ...overrides,
  };
}

/**
 * Create an ad-hoc (non-recurring) meeting with sensible defaults.
 */
export function createAdHocMeeting(
  overrides?: Partial<MeetingData>,
): MeetingData {
  meetingIdCounter++;

  return {
    id: `meeting-${meetingIdCounter}`,
    title: `Project Kickoff`,
    startTime: "2026-03-17T14:00:00Z",
    endTime: "2026-03-17T15:00:00Z",
    attendees: [
      {
        email: "carol@example.com",
        displayName: "Carol",
        responseStatus: "accepted",
      },
    ],
    description: "Initial project discussion",
    isRecurring: false,
    ...overrides,
  };
}

/**
 * Create a specific instance of a recurring series.
 * Uses the same recurringEventId but a unique instance id.
 * instanceNum shifts the date forward to simulate different occurrences.
 */
export function createRecurringInstance(
  recurringEventId: string,
  instanceNum: number,
  overrides?: Partial<MeetingData>,
): MeetingData {
  meetingIdCounter++;

  // Shift date by instanceNum days
  const baseDate = new Date("2026-03-16T10:00:00Z");
  baseDate.setDate(baseDate.getDate() + (instanceNum - 1) * 7);
  const endDate = new Date(baseDate);
  endDate.setMinutes(endDate.getMinutes() + 30);

  return {
    id: `meeting-${meetingIdCounter}`,
    title: `Weekly Standup`,
    startTime: baseDate.toISOString(),
    endTime: endDate.toISOString(),
    attendees: [
      {
        email: "alice@example.com",
        displayName: "Alice",
        responseStatus: "accepted",
      },
      {
        email: "bob@example.com",
        displayName: "Bob",
        responseStatus: "accepted",
      },
    ],
    description: "Daily sync for the team",
    isRecurring: true,
    recurringEventId,
    ...overrides,
  };
}

// ─── Mock SupernoteAPIClient ─────────────────────────────────────────────────

export interface MockUploadCall {
  content: string;
  fileName: string;
  folderId: number;
}

export interface MockCreateFolderCall {
  path: string;
  returnedId: number;
}

export interface MockSupernoteClient {
  authenticate: jest.Mock;
  createFolderPath: jest.Mock;
  uploadTextFile: jest.Mock;
  getCalls: () => {
    uploads: MockUploadCall[];
    folderCreations: MockCreateFolderCall[];
  };
  resetCalls: () => void;
}

/**
 * Create a mock SupernoteAPIClient that:
 *  - authenticate() resolves successfully
 *  - createFolderPath(path) resolves to a deterministic incrementing folder ID
 *  - uploadTextFile(content, filename, folderId) resolves and records the call
 *
 * Exposes getCalls() and resetCalls() for assertion and re-use.
 */
export function createMockSupernoteClient(): MockSupernoteClient {
  const uploads: MockUploadCall[] = [];
  const folderCreations: MockCreateFolderCall[] = [];

  const authenticate = jest.fn().mockResolvedValue("mock-token");

  const createFolderPath = jest
    .fn()
    .mockImplementation((folderPath: string) => {
      folderIdCounter++;
      const id = folderIdCounter;
      folderCreations.push({ path: folderPath, returnedId: id });
      return Promise.resolve(id);
    });

  const uploadTextFile = jest
    .fn()
    .mockImplementation(
      (content: string, fileName: string, folderId: number) => {
        uploads.push({ content, fileName, folderId });
        return Promise.resolve({ success: true });
      },
    );

  return {
    authenticate,
    createFolderPath,
    uploadTextFile,
    getCalls: () => ({
      uploads: [...uploads],
      folderCreations: [...folderCreations],
    }),
    resetCalls: () => {
      uploads.length = 0;
      folderCreations.length = 0;
      authenticate.mockClear();
      createFolderPath.mockClear();
      uploadTextFile.mockClear();
    },
  };
}

// ─── Temp FolderMappingStore factory ─────────────────────────────────────────

/**
 * Create a FolderMappingStore backed by a temp file.
 * Returns both the store instance and a cleanup function that removes the temp file.
 */
export function createTempMappingStore(): {
  store: FolderMappingStore;
  cleanup: () => void;
  filePath: string;
} {
  const tmpDir = os.tmpdir();
  const suffix = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const filePath = path.join(tmpDir, `folder-mappings-test-${suffix}.json`);

  const store = new FolderMappingStore(filePath);

  const cleanup = (): void => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // Ignore cleanup errors in tests
    }
  };

  return { store, cleanup, filePath };
}
