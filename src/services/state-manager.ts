import * as fs from "fs";
import * as path from "path";

/**
 * Meeting state structure persisted to disk
 * Used for tracking changes between runs
 */
export interface PersistedMeeting {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  lastDetected: number; // Unix timestamp
}

/**
 * Change detection result
 */
export interface MeetingChanges {
  newMeetings: PersistedMeeting[];
  changedMeetings: PersistedMeeting[];
  cancelledMeetings: PersistedMeeting[];
}

/**
 * StateManager
 *
 * Persists meeting state to disk for change detection between runs.
 * Stores meetings in JSON format: data/meeting-state.json
 */
export class StateManager {
  private filepath: string;
  private dataDir: string;

  constructor(filepath: string = "data/meeting-state.json") {
    this.filepath = filepath;
    this.dataDir = path.dirname(filepath);
  }

  /**
   * Load previous meeting state from disk
   * Returns empty array if file doesn't exist (first run)
   */
  loadState(): PersistedMeeting[] {
    try {
      if (!fs.existsSync(this.filepath)) {
        return [];
      }

      const content = fs.readFileSync(this.filepath, "utf-8");
      const meetings = JSON.parse(content) as PersistedMeeting[];
      return Array.isArray(meetings) ? meetings : [];
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        `[StateManager] Failed to load state from ${this.filepath}: ${errorMessage}`,
      );
      return [];
    }
  }

  /**
   * Save current meeting state to disk
   * Creates data/ directory if it doesn't exist
   */
  saveState(meetings: PersistedMeeting[]): void {
    try {
      // Ensure data directory exists
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      // Write state file
      const content = JSON.stringify(meetings, null, 2);
      fs.writeFileSync(this.filepath, content, "utf-8");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        `[StateManager] Failed to save state to ${this.filepath}: ${errorMessage}`,
      );
      throw error;
    }
  }

  /**
   * Detect changes between previous and current meetings
   *
   * @param previousMeetings Previous state loaded from disk
   * @param currentMeetings Current meetings from API
   * @returns Object with new, changed, and cancelled meetings
   */
  detectChanges(
    previousMeetings: PersistedMeeting[],
    currentMeetings: PersistedMeeting[],
  ): MeetingChanges {
    // Create maps for easier lookup
    const previousMap = new Map(previousMeetings.map((m) => [m.id, m]));
    const currentMap = new Map(currentMeetings.map((m) => [m.id, m]));

    const newMeetings: PersistedMeeting[] = [];
    const changedMeetings: PersistedMeeting[] = [];
    const cancelledMeetings: PersistedMeeting[] = [];

    // Find new and changed meetings
    for (const [id, current] of currentMap) {
      const previous = previousMap.get(id);

      if (!previous) {
        // New meeting
        newMeetings.push(current);
      } else if (
        previous.startTime !== current.startTime ||
        previous.endTime !== current.endTime ||
        previous.title !== current.title
      ) {
        // Changed meeting
        changedMeetings.push(current);
      }
    }

    // Find cancelled meetings
    for (const [id, previous] of previousMap) {
      if (!currentMap.has(id)) {
        cancelledMeetings.push(previous);
      }
    }

    return {
      newMeetings,
      changedMeetings,
      cancelledMeetings,
    };
  }
}
