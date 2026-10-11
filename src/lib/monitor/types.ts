// Monitor-safe shapes (no phone numbers, internal notes, emails, attachments).

/** One assignee as the wall screen needs them: the full name, the role they
 *  were given, and whether they have acknowledged. The TV has to be able to
 *  point at a *person* who has not acknowledged — "ยังไม่รับทราบ 2 คน" sends
 *  everyone off to look it up on their phone, which defeats the screen. */
export type MonitorAssignee = {
  name: string;
  role: string;
  ack: boolean;
};

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
  assignees: string[]; // "ชื่อ (บทบาท)" — kept for the legacy classic view
  assigneeDetail: MonitorAssignee[];
  allAck: boolean;
  hasChanges: boolean;
  /** "published" | "canceled". Canceled work still comes down the feed on
   *  purpose: a screen that silently drops it is how someone ends up driving
   *  to an event that was called off. */
  status: string;
  cancellationReason: string;
};

export type MonitorPerson = {
  id: string;
  displayName: string;
  position: string;
};
