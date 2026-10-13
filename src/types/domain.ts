export type EventStatus = "draft" | "published" | "completed" | "canceled";
export type Urgency = "normal" | "important" | "urgent";
// "declined" = the assignee pressed "ไม่สะดวก" for the current assignment
// version. The name stays on the job until a supervisor reassigns it.
export type AckStatus = "acknowledged" | "pending" | "declined" | "not_required";

export type Person = {
  id: string;
  displayName: string;
  position: string;
  email?: string;
  lineUserId?: string;
  isActive: boolean;
};

export type Department = {
  id: string;
  name: string;
  shortName: string;
};

export type Location = {
  id: string;
  name: string;
  description?: string;
};

export type Role = {
  id: string;
  code: string;
  name: string;
  color: string;
};

export type Assignment = {
  id: string;
  person: Person;
  role: Role;
  ackStatus: AckStatus;
  acknowledgedAt?: string;
  declinedAt?: string;
  // Internal only — may be personal (e.g. illness). Shown on the event page to
  // backend roles, never on the monitor or in exported reports.
  declineReason?: string;
  note?: string;
};

export type PrEvent = {
  id: string;
  title: string;
  description?: string;
  eventDate: string;
  startTime: string;
  endTime?: string;
  location: Location;
  ownerDepartment: Department;
  eventType: string;
  intakeChannel: string;
  status: EventStatus;
  urgency: Urgency;
  shortNote?: string;
  internalNote?: string;
  // เลขที่หนังสือ / ลิงก์ e-Office — internal, never on the monitor.
  sourceReference?: string;
  sourceUrl?: string;
  hasChanges: boolean;
  assignments: Assignment[];
  updatedAt: string;
};

// Private attachment metadata. The storage path is deliberately NOT part of
// this type: it never leaves the server (downloads go through a signed URL
// created per request in /api/attachments/[id]).
export type EventAttachment = {
  id: string;
  eventId: string;
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
  createdAt: string;
};

export type ReportSummary = {
  totalEvents: number;
  publishedEvents: number;
  pendingAcknowledgements: number;
  changedOrCanceled: number;
  todayEvents: number;
  topWorkloadPerson: string;
};
