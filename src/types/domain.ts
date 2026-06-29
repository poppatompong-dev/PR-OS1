export type EventStatus = "draft" | "published" | "completed" | "canceled";
export type Urgency = "normal" | "important" | "urgent";
export type AckStatus = "acknowledged" | "pending" | "not_required";

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
  hasChanges: boolean;
  assignments: Assignment[];
  updatedAt: string;
};

export type ReportSummary = {
  totalEvents: number;
  publishedEvents: number;
  pendingAcknowledgements: number;
  changedOrCanceled: number;
  todayEvents: number;
  topWorkloadPerson: string;
};
