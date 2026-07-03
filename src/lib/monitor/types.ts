// Monitor-safe shapes (no phone numbers, internal notes, emails, attachments).

export type MonitorEvent = {
  id: string;
  title: string;
  eventDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM or ""
  shortNote: string;
  locationName: string;
  departmentShort: string;
  roles: string[];
  assignees: string[]; // "ชื่อ (บทบาท)"
  allAck: boolean;
  hasChanges: boolean;
};

export type MonitorPerson = {
  id: string;
  displayName: string;
  position: string;
};
