import type { Department, Location, Person, PrEvent, ReportSummary, Role } from "@/types/domain";

export const people: Person[] = [
  {
    id: "per_001",
    displayName: "นางสาวภนิตา ชะรัดรัมย์",
    position: "รักษาการในตำแหน่ง หัวหน้าฝ่ายบริการและเผยแพร่วิชาการ",
    isActive: true,
  },
  {
    id: "per_002",
    displayName: "นายธนันธร พันธุ์รอด",
    position: "หัวหน้างานประชาสัมพันธ์",
    isActive: true,
  },
  {
    id: "per_003",
    displayName: "นายประชารักษ์ ประทุมโทน",
    position: "นักประชาสัมพันธ์ปฏิบัติการ",
    isActive: true,
  },
  {
    id: "per_004",
    displayName: "นางสาวณัฏฐ์ จิรจีรังชัย",
    position: "นักประชาสัมพันธ์ปฏิบัติการ",
    isActive: true,
  },
  {
    id: "per_005",
    displayName: "นางสาวภัททิรา แย้มเผื่อน",
    position: "พนักงานจ้างทั่วไป",
    isActive: true,
  },
  {
    id: "per_006",
    displayName: "นางสาวเทียมแข กิจกล้า",
    position: "พนักงานจ้างทั่วไป",
    isActive: true,
  },
];

export const departments: Department[] = [
  { id: "dep_001", name: "สำนักปลัดเทศบาล", shortName: "สป." },
  { id: "dep_002", name: "กองการศึกษา", shortName: "กศ." },
  { id: "dep_003", name: "กองสาธารณสุขและสิ่งแวดล้อม", shortName: "สธ." },
];

export const locations: Location[] = [
  { id: "loc_001", name: "ห้องประชุมสภาเทศบาล", description: "ชั้น 3 อาคารสำนักงาน" },
  { id: "loc_002", name: "ลานกิจกรรมเทศบาล", description: "หน้าอาคารสำนักงาน" },
  { id: "loc_003", name: "โรงเรียนในสังกัดเทศบาล", description: "ระบุโรงเรียนในหมายเหตุ" },
];

export const roles: Role[] = [
  { id: "role_mc", code: "mc", name: "พิธีกร", color: "teal" },
  { id: "role_photo", code: "photo", name: "ช่างภาพ", color: "blue" },
  { id: "role_writer", code: "writer", name: "ทำข่าว", color: "indigo" },
  { id: "role_coord", code: "coord", name: "ประสานงาน", color: "amber" },
];

export const events: PrEvent[] = [
  {
    id: "evt_001",
    title: "พิธีเปิดโครงการอบรมอาสาสมัครชุมชน",
    description: "งานเปิดโครงการและบันทึกภาพกิจกรรมสำหรับข่าวประชาสัมพันธ์",
    eventDate: "2026-07-01",
    startTime: "09:00",
    endTime: "11:30",
    location: locations[0],
    ownerDepartment: departments[0],
    eventType: "พิธีการ",
    intakeChannel: "หนังสือราชการ",
    status: "published",
    urgency: "normal",
    shortNote: "เตรียมถ่ายภาพช่วงประธานเปิดงานและมอบเกียรติบัตร",
    hasChanges: false,
    updatedAt: "2026-06-29T09:20:00+07:00",
    assignments: [
      {
        id: "asg_001",
        person: people[0],
        role: roles[1],
        ackStatus: "acknowledged",
        acknowledgedAt: "2026-06-29T10:05:00+07:00",
      },
      {
        id: "asg_002",
        person: people[3],
        role: roles[0],
        ackStatus: "pending",
      },
    ],
  },
  {
    id: "evt_002",
    title: "กิจกรรมรณรงค์ป้องกันไข้เลือดออก",
    description: "ลงพื้นที่ทำข่าวและเก็บภาพกิจกรรมร่วมกับกองสาธารณสุข",
    eventDate: "2026-07-02",
    startTime: "08:30",
    location: locations[2],
    ownerDepartment: departments[2],
    eventType: "ลงพื้นที่",
    intakeChannel: "LINE กลุ่มสารบรรณ",
    status: "published",
    urgency: "important",
    shortNote: "รอระบุโรงเรียนจากเจ้าของเรื่องอีกครั้ง",
    hasChanges: true,
    updatedAt: "2026-06-29T13:40:00+07:00",
    assignments: [
      {
        id: "asg_003",
        person: people[2],
        role: roles[2],
        ackStatus: "pending",
      },
      {
        id: "asg_004",
        person: people[0],
        role: roles[1],
        ackStatus: "pending",
      },
    ],
  },
  {
    id: "evt_003",
    title: "ประชุมเตรียมงานประเพณีประจำปี",
    eventDate: "2026-07-03",
    startTime: "13:30",
    endTime: "15:00",
    location: locations[0],
    ownerDepartment: departments[1],
    eventType: "ประชุม",
    intakeChannel: "โทรศัพท์",
    status: "draft",
    urgency: "normal",
    shortNote: "รอหนังสือยืนยันกำหนดการ",
    hasChanges: false,
    updatedAt: "2026-06-29T15:10:00+07:00",
    assignments: [
      {
        id: "asg_005",
        person: people[4],
        role: roles[3],
        ackStatus: "not_required",
      },
    ],
  },
  {
    id: "evt_004",
    title: "แถลงข่าวกิจกรรมตลาดสีเขียว",
    eventDate: "2026-07-04",
    startTime: "10:00",
    location: locations[1],
    ownerDepartment: departments[0],
    eventType: "แถลงข่าว",
    intakeChannel: "เดินมาแจ้ง",
    status: "canceled",
    urgency: "normal",
    shortNote: "เจ้าของเรื่องแจ้งเลื่อนวันจัดงาน",
    hasChanges: true,
    updatedAt: "2026-06-29T16:00:00+07:00",
    assignments: [
      {
        id: "asg_006",
        person: people[0],
        role: roles[1],
        ackStatus: "pending",
      },
    ],
  },
];

export const reportSummary: ReportSummary = {
  totalEvents: events.length,
  publishedEvents: events.filter((event) => event.status === "published").length,
  pendingAcknowledgements: events.flatMap((event) => event.assignments).filter((item) => item.ackStatus === "pending").length,
  changedOrCanceled: events.filter((event) => event.hasChanges || event.status === "canceled").length,
  todayEvents: 1,
  topWorkloadPerson: people[0].displayName,
};
