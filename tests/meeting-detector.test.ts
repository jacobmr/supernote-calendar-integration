import { StateManager, PersistedMeeting } from "../src/services/state-manager";

/**
 * Test suite for meeting state persistence and change detection
 */
describe("StateManager", () => {
  let stateManager: StateManager;
  const testFilePath = "data/test-meeting-state.json";

  beforeAll(() => {
    stateManager = new StateManager(testFilePath);
  });

  afterAll(() => {
    // Cleanup test file
    try {
      const fs = require("fs");
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("State Management", () => {
    it("should return empty state on first run (file doesn't exist)", () => {
      const state = stateManager.loadState();

      expect(Array.isArray(state)).toBe(true);
      expect(state.length).toBe(0);
      console.log("✓ Empty state on first run");
    });

    it("should save and load meeting state", () => {
      const meetings: PersistedMeeting[] = [
        {
          id: "meeting-1",
          title: "Team Standup",
          startTime: "2026-03-12T09:00:00Z",
          endTime: "2026-03-12T09:30:00Z",
          lastDetected: Date.now(),
        },
        {
          id: "meeting-2",
          title: "Project Review",
          startTime: "2026-03-12T14:00:00Z",
          endTime: "2026-03-12T15:00:00Z",
          lastDetected: Date.now(),
        },
      ];

      stateManager.saveState(meetings);
      const loaded = stateManager.loadState();

      expect(loaded.length).toBe(2);
      expect(loaded[0].id).toBe("meeting-1");
      expect(loaded[1].id).toBe("meeting-2");
      console.log("✓ Save and load meeting state");
    });
  });

  describe("Change Detection", () => {
    it("should detect new meetings", () => {
      const previousState: PersistedMeeting[] = [
        {
          id: "meeting-1",
          title: "Team Standup",
          startTime: "2026-03-12T09:00:00Z",
          endTime: "2026-03-12T09:30:00Z",
          lastDetected: Date.now() - 3600000,
        },
      ];

      const currentState: PersistedMeeting[] = [
        {
          id: "meeting-1",
          title: "Team Standup",
          startTime: "2026-03-12T09:00:00Z",
          endTime: "2026-03-12T09:30:00Z",
          lastDetected: Date.now(),
        },
        {
          id: "meeting-2",
          title: "New Meeting",
          startTime: "2026-03-12T14:00:00Z",
          endTime: "2026-03-12T15:00:00Z",
          lastDetected: Date.now(),
        },
      ];

      const changes = stateManager.detectChanges(previousState, currentState);

      expect(changes.newMeetings.length).toBe(1);
      expect(changes.newMeetings[0].id).toBe("meeting-2");
      expect(changes.changedMeetings.length).toBe(0);
      expect(changes.cancelledMeetings.length).toBe(0);
      console.log("✓ Detect new meetings");
    });

    it("should detect changed meetings (time change)", () => {
      const previousState: PersistedMeeting[] = [
        {
          id: "meeting-1",
          title: "Team Standup",
          startTime: "2026-03-12T09:00:00Z",
          endTime: "2026-03-12T09:30:00Z",
          lastDetected: Date.now() - 3600000,
        },
      ];

      const currentState: PersistedMeeting[] = [
        {
          id: "meeting-1",
          title: "Team Standup",
          startTime: "2026-03-12T10:00:00Z", // Changed time
          endTime: "2026-03-12T10:30:00Z",
          lastDetected: Date.now(),
        },
      ];

      const changes = stateManager.detectChanges(previousState, currentState);

      expect(changes.newMeetings.length).toBe(0);
      expect(changes.changedMeetings.length).toBe(1);
      expect(changes.changedMeetings[0].id).toBe("meeting-1");
      expect(changes.cancelledMeetings.length).toBe(0);
      console.log("✓ Detect changed meetings (time)");
    });

    it("should detect changed meetings (title change)", () => {
      const previousState: PersistedMeeting[] = [
        {
          id: "meeting-1",
          title: "Team Standup",
          startTime: "2026-03-12T09:00:00Z",
          endTime: "2026-03-12T09:30:00Z",
          lastDetected: Date.now() - 3600000,
        },
      ];

      const currentState: PersistedMeeting[] = [
        {
          id: "meeting-1",
          title: "Team Sync", // Changed title
          startTime: "2026-03-12T09:00:00Z",
          endTime: "2026-03-12T09:30:00Z",
          lastDetected: Date.now(),
        },
      ];

      const changes = stateManager.detectChanges(previousState, currentState);

      expect(changes.newMeetings.length).toBe(0);
      expect(changes.changedMeetings.length).toBe(1);
      expect(changes.changedMeetings[0].title).toBe("Team Sync");
      expect(changes.cancelledMeetings.length).toBe(0);
      console.log("✓ Detect changed meetings (title)");
    });

    it("should detect cancelled meetings", () => {
      const previousState: PersistedMeeting[] = [
        {
          id: "meeting-1",
          title: "Team Standup",
          startTime: "2026-03-12T09:00:00Z",
          endTime: "2026-03-12T09:30:00Z",
          lastDetected: Date.now() - 3600000,
        },
        {
          id: "meeting-2",
          title: "Project Review",
          startTime: "2026-03-12T14:00:00Z",
          endTime: "2026-03-12T15:00:00Z",
          lastDetected: Date.now() - 3600000,
        },
      ];

      const currentState: PersistedMeeting[] = [
        {
          id: "meeting-1",
          title: "Team Standup",
          startTime: "2026-03-12T09:00:00Z",
          endTime: "2026-03-12T09:30:00Z",
          lastDetected: Date.now(),
        },
      ];

      const changes = stateManager.detectChanges(previousState, currentState);

      expect(changes.newMeetings.length).toBe(0);
      expect(changes.changedMeetings.length).toBe(0);
      expect(changes.cancelledMeetings.length).toBe(1);
      expect(changes.cancelledMeetings[0].id).toBe("meeting-2");
      console.log("✓ Detect cancelled meetings");
    });

    it("should handle empty previous state (first run)", () => {
      const previousState: PersistedMeeting[] = [];

      const currentState: PersistedMeeting[] = [
        {
          id: "meeting-1",
          title: "Team Standup",
          startTime: "2026-03-12T09:00:00Z",
          endTime: "2026-03-12T09:30:00Z",
          lastDetected: Date.now(),
        },
        {
          id: "meeting-2",
          title: "Project Review",
          startTime: "2026-03-12T14:00:00Z",
          endTime: "2026-03-12T15:00:00Z",
          lastDetected: Date.now(),
        },
      ];

      const changes = stateManager.detectChanges(previousState, currentState);

      // All meetings are "new" on first run
      expect(changes.newMeetings.length).toBe(2);
      expect(changes.changedMeetings.length).toBe(0);
      expect(changes.cancelledMeetings.length).toBe(0);
      console.log("✓ Handle empty previous state (first run)");
    });

    it("should detect no changes when state is identical", () => {
      const meeting: PersistedMeeting = {
        id: "meeting-1",
        title: "Team Standup",
        startTime: "2026-03-12T09:00:00Z",
        endTime: "2026-03-12T09:30:00Z",
        lastDetected: Date.now(),
      };

      const previousState: PersistedMeeting[] = [meeting];
      const currentState: PersistedMeeting[] = [
        {
          ...meeting,
          lastDetected: Date.now(),
        },
      ];

      const changes = stateManager.detectChanges(previousState, currentState);

      expect(changes.newMeetings.length).toBe(0);
      expect(changes.changedMeetings.length).toBe(0);
      expect(changes.cancelledMeetings.length).toBe(0);
      console.log("✓ Detect no changes when state is identical");
    });

    it("should handle complex scenarios (new + changed + cancelled)", () => {
      const previousState: PersistedMeeting[] = [
        {
          id: "meeting-1",
          title: "Team Standup",
          startTime: "2026-03-12T09:00:00Z",
          endTime: "2026-03-12T09:30:00Z",
          lastDetected: Date.now() - 3600000,
        },
        {
          id: "meeting-2",
          title: "Project Review",
          startTime: "2026-03-12T14:00:00Z",
          endTime: "2026-03-12T15:00:00Z",
          lastDetected: Date.now() - 3600000,
        },
        {
          id: "meeting-3",
          title: "1:1 Sync",
          startTime: "2026-03-12T16:00:00Z",
          endTime: "2026-03-12T16:30:00Z",
          lastDetected: Date.now() - 3600000,
        },
      ];

      const currentState: PersistedMeeting[] = [
        {
          id: "meeting-1",
          title: "Team Standup",
          startTime: "2026-03-12T09:00:00Z",
          endTime: "2026-03-12T09:30:00Z",
          lastDetected: Date.now(),
        },
        {
          id: "meeting-2",
          title: "Project Review - UPDATED",
          startTime: "2026-03-12T14:00:00Z",
          endTime: "2026-03-12T15:00:00Z",
          lastDetected: Date.now(),
        },
        {
          id: "meeting-4",
          title: "New Meeting",
          startTime: "2026-03-12T11:00:00Z",
          endTime: "2026-03-12T12:00:00Z",
          lastDetected: Date.now(),
        },
      ];

      const changes = stateManager.detectChanges(previousState, currentState);

      expect(changes.newMeetings.length).toBe(1);
      expect(changes.newMeetings[0].id).toBe("meeting-4");

      expect(changes.changedMeetings.length).toBe(1);
      expect(changes.changedMeetings[0].id).toBe("meeting-2");

      expect(changes.cancelledMeetings.length).toBe(1);
      expect(changes.cancelledMeetings[0].id).toBe("meeting-3");

      console.log("✓ Handle complex scenario (new + changed + cancelled)");
    });
  });
});
