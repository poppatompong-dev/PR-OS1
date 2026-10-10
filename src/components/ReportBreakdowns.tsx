import type { PrEvent } from "@/types/domain";
import { byActivity, byPeriod, byPerson } from "@/lib/reports/breakdowns";
import type { Granularity } from "@/lib/reports/breakdowns";
import { formatThaiDate } from "@/lib/format";

const PERCENT = new Intl.NumberFormat("th-TH", { style: "percent", maximumFractionDigits: 0 });

/** Totals by month, quarter or year, for the annual and quarterly returns. */
export function PeriodReport({
  events,
  granularity,
}: {
  events: PrEvent[];
  granularity: Granularity;
}) {
  const rows = byPeriod(events, granularity);

  if (rows.length === 0) return <p className="empty-note">ไม่มีงานในช่วงเวลานี้</p>;

  return (
    <>
      <div className="only-wide table-wrap">
        <table className="event-table report-table">
          <thead>
            <tr>
              <th>ช่วงเวลา</th>
              <th>งานทั้งหมด</th>
              <th>เผยแพร่</th>
              <th>เสร็จสิ้น</th>
              <th>ยกเลิก</th>
              <th>มีการแก้ไข</th>
              <th>ครั้งที่มอบหมาย</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td><strong>{row.label}</strong></td>
                <td className="num">{row.total}</td>
                <td className="num">{row.published}</td>
                <td className="num">{row.completed}</td>
                <td className="num">{row.canceled}</td>
                <td className="num">{row.changed}</td>
                <td className="num">{row.assignments}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="only-narrow stat-cards">
        {rows.map((row) => (
          <li key={row.key} className="stat-card">
            <h3>{row.label}</h3>
            <p className="stat-lead">
              <strong>{row.total}</strong> งาน
            </p>
            <dl className="stat-pairs">
              <div><dt>เผยแพร่</dt><dd>{row.published}</dd></div>
              <div><dt>เสร็จสิ้น</dt><dd>{row.completed}</dd></div>
              <div><dt>ยกเลิก</dt><dd>{row.canceled}</dd></div>
              <div><dt>แก้ไข</dt><dd>{row.changed}</dd></div>
              <div><dt>มอบหมาย</dt><dd>{row.assignments}</dd></div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}

/** What each person actually did — the sheet an appraisal is written from. */
export function PersonReport({ events }: { events: PrEvent[] }) {
  const rows = byPerson(events);

  if (rows.length === 0) return <p className="empty-note">ไม่มีงานที่มอบหมายในช่วงเวลานี้</p>;

  return (
    <>
      <p className="report-note">
        นับเฉพาะงานที่ไม่ถูกยกเลิก — งานที่ยกเลิกไม่ใช่ภาระงานที่ปฏิบัติจริง
      </p>

      <div className="only-wide table-wrap">
        <table className="event-table report-table">
          <thead>
            <tr>
              <th>ผู้ปฏิบัติงาน</th>
              <th>งานทั้งหมด</th>
              <th>งานด่วน/สำคัญ</th>
              <th>รับทราบแล้ว</th>
              <th>อัตราการรับทราบ</th>
              <th>บทบาทที่ทำ</th>
              <th>งานล่าสุด</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.personName}>
                <td>
                  <strong>{row.personName}</strong>
                  <div className="table-note">{row.departments.join(" · ")}</div>
                </td>
                <td className="num">{row.total}</td>
                <td className="num">{row.urgent}</td>
                <td className="num">
                  {row.acknowledged}
                  {row.pending > 0 ? <div className="table-note">ค้าง {row.pending}</div> : null}
                </td>
                <td className="num">{PERCENT.format(row.ackRate)}</td>
                <td>
                  <div className="assignee-list">
                    {row.roles.map((r) => (
                      <span key={r.roleName}>
                        {r.roleName}: {r.count}
                      </span>
                    ))}
                  </div>
                </td>
                <td>{formatThaiDate(row.lastDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="only-narrow stat-cards">
        {rows.map((row) => (
          <li key={row.personName} className="stat-card">
            <h3>{row.personName}</h3>
            <p className="stat-lead">
              <strong>{row.total}</strong> งาน · รับทราบ {PERCENT.format(row.ackRate)}
            </p>
            <dl className="stat-pairs">
              <div><dt>ด่วน/สำคัญ</dt><dd>{row.urgent}</dd></div>
              <div><dt>รับทราบแล้ว</dt><dd>{row.acknowledged}</dd></div>
              <div><dt>ค้างรับทราบ</dt><dd>{row.pending}</dd></div>
              <div><dt>งานล่าสุด</dt><dd>{formatThaiDate(row.lastDate)}</dd></div>
            </dl>
            <p className="stat-tags">
              {row.roles.map((r) => (
                <span key={r.roleName} className="tag tag-gray">
                  {r.roleName} {r.count}
                </span>
              ))}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Which kinds of work take the effort. */
export function ActivityReport({ events }: { events: PrEvent[] }) {
  const rows = byActivity(events);

  if (rows.length === 0) return <p className="empty-note">ไม่มีงานในช่วงเวลานี้</p>;

  const max = Math.max(...rows.map((r) => r.total), 1);

  return (
    <>
      <div className="only-wide table-wrap">
        <table className="event-table report-table">
          <thead>
            <tr>
              <th>ประเภทงาน / โครงการ</th>
              <th>งานทั้งหมด</th>
              <th>สัดส่วน</th>
              <th>เผยแพร่</th>
              <th>ยกเลิก</th>
              <th>ครั้งที่มอบหมาย</th>
              <th>ผู้เกี่ยวข้อง</th>
              <th>หน่วยงานหลัก</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.activity}>
                <td><strong>{row.activity}</strong></td>
                <td className="num">{row.total}</td>
                <td className="bar-cell">
                  <span className="bar-track">
                    <span className="bar" style={{ width: `${(row.total / max) * 100}%` }} />
                  </span>
                </td>
                <td className="num">{row.published}</td>
                <td className="num">{row.canceled}</td>
                <td className="num">{row.assignments}</td>
                <td className="num">{row.people}</td>
                <td>{row.topDepartment}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="only-narrow stat-cards">
        {rows.map((row) => (
          <li key={row.activity} className="stat-card">
            <h3>{row.activity}</h3>
            <p className="stat-lead">
              <strong>{row.total}</strong> งาน
            </p>
            <span className="bar-track">
              <span className="bar" style={{ width: `${(row.total / max) * 100}%` }} />
            </span>
            <dl className="stat-pairs">
              <div><dt>เผยแพร่</dt><dd>{row.published}</dd></div>
              <div><dt>ยกเลิก</dt><dd>{row.canceled}</dd></div>
              <div><dt>มอบหมาย</dt><dd>{row.assignments}</dd></div>
              <div><dt>ผู้เกี่ยวข้อง</dt><dd>{row.people}</dd></div>
              <div><dt>หน่วยงานหลัก</dt><dd>{row.topDepartment}</dd></div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
