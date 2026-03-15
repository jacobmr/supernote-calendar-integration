import * as fs from "fs";
import * as path from "path";

/**
 * Mapping of a specific meeting instance to its Supernote folder
 */
export interface FolderMapping {
  meetingId: string;
  meetingTitle: string;
  folderId: number;
  folderPath: string;
  isRecurring: boolean;
  createdAt: number;
  noteFileName?: string;
}

/**
 * Mapping of a recurring event series to a shared Supernote folder.
 * All instances of the same recurring event share one folder.
 */
export interface RecurringFolderMapping {
  recurringEventId: string;
  meetingTitle: string;
  folderId: number;
  folderPath: string;
  createdAt: number;
}

/**
 * Persisted state for folder mappings
 */
export interface FolderMappingState {
  mappings: FolderMapping[];
  recurringFolders: RecurringFolderMapping[];
}

/**
 * FolderMappingStore
 *
 * Persists meeting-to-folder mappings to disk for deduplication.
 * Tracks which meetings already have Supernote folders to avoid
 * creating duplicate folders on subsequent runs.
 *
 * Follows the same file I/O pattern as StateManager.
 */
export class FolderMappingStore {
  private filepath: string;
  private dataDir: string;

  constructor(filepath: string = "data/folder-mappings.json") {
    this.filepath = filepath;
    this.dataDir = path.dirname(filepath);
  }

  /**
   * Load folder mapping state from disk.
   * Returns empty arrays if file doesn't exist (first run).
   */
  loadState(): FolderMappingState {
    try {
      if (!fs.existsSync(this.filepath)) {
        return { mappings: [], recurringFolders: [] };
      }

      const content = fs.readFileSync(this.filepath, "utf-8");
      const state = JSON.parse(content) as FolderMappingState;

      return {
        mappings: Array.isArray(state.mappings) ? state.mappings : [],
        recurringFolders: Array.isArray(state.recurringFolders)
          ? state.recurringFolders
          : [],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        `[FolderMappingStore] Failed to load state from ${this.filepath}: ${errorMessage}`,
      );
      return { mappings: [], recurringFolders: [] };
    }
  }

  /**
   * Save folder mapping state to disk.
   * Creates data directory if it doesn't exist.
   */
  saveState(state: FolderMappingState): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      const content = JSON.stringify(state, null, 2);
      fs.writeFileSync(this.filepath, content, "utf-8");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        `[FolderMappingStore] Failed to save state to ${this.filepath}: ${errorMessage}`,
      );
      throw error;
    }
  }

  /**
   * Get a folder mapping by meeting ID
   */
  getMappingByMeetingId(id: string): FolderMapping | undefined {
    const state = this.loadState();
    return state.mappings.find((m) => m.meetingId === id);
  }

  /**
   * Get a recurring folder mapping by recurring event ID
   */
  getRecurringFolder(
    recurringEventId: string,
  ): RecurringFolderMapping | undefined {
    const state = this.loadState();
    return state.recurringFolders.find(
      (r) => r.recurringEventId === recurringEventId,
    );
  }

  /**
   * Add a folder mapping for a specific meeting instance.
   * Loads current state, appends, and saves.
   */
  addMapping(mapping: FolderMapping): void {
    const state = this.loadState();
    state.mappings.push(mapping);
    this.saveState(state);
  }

  /**
   * Add a recurring folder mapping for a recurring event series.
   * Loads current state, appends, and saves.
   */
  addRecurringFolder(mapping: RecurringFolderMapping): void {
    const state = this.loadState();
    state.recurringFolders.push(mapping);
    this.saveState(state);
  }

  /**
   * Update an existing folder mapping with partial data.
   * Finds the mapping by meetingId and merges the updates, then saves.
   */
  updateMapping(meetingId: string, updates: Partial<FolderMapping>): void {
    const state = this.loadState();
    const index = state.mappings.findIndex((m) => m.meetingId === meetingId);

    if (index === -1) {
      console.warn(
        `[FolderMappingStore] No mapping found for meetingId "${meetingId}" — cannot update`,
      );
      return;
    }

    state.mappings[index] = { ...state.mappings[index], ...updates };
    this.saveState(state);
  }

  /**
   * Check if a folder already exists for a specific meeting ID
   */
  hasFolderForMeeting(meetingId: string): boolean {
    return this.getMappingByMeetingId(meetingId) !== undefined;
  }

  /**
   * Check if a folder already exists for a recurring event series
   */
  hasFolderForRecurringEvent(recurringEventId: string): boolean {
    return this.getRecurringFolder(recurringEventId) !== undefined;
  }
}
