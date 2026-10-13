# 18 — Benchmark ระบบใกล้เคียง + ไอเดียสื่อจาก Claude 5.5

สำรวจเมื่อ 13 ต.ค. 2026 · เอกสารนี้เป็น **ข้อเสนอให้พิจารณา** ไม่ใช่ requirement — ยังไม่มีอะไรในนี้ถูกสร้างจริง
แหล่งอ้างอิงอยู่ท้ายเอกสาร หัวข้อที่เขียนว่า "ยืนยันไม่ได้" คือหาแหล่งทางการไม่เจอหรือเปิดหน้าทางการไม่ได้ ต้องเช็กซ้ำก่อนใช้ตัดสินใจ

---

## ส่วน A — เทียบกับระบบที่ใกล้เคียง

### ระบบที่นำมาเทียบ

| หมวด | ระบบ | จุดที่เกี่ยวข้องกับ PR-OS |
|---|---|---|
| วางแผนงานข่าว/สื่อสาร | Desk-Net, Planable, CoSchedule, monday.com | ปฏิทินตามช่องทาง, มอบหมายงาน, approval หลายขั้น, ฟอร์มรับคำขอ, ติดตามชิ้นงาน [1–5] |
| สื่อสารภาครัฐ | Granicus govDelivery, e-Saraban/e-Office (ไทย) | ส่งหลายช่องทาง + segmentation; ระบบสารบรรณตามระเบียบฯ ฉบับที่ 4 พ.ศ. 2564 — **ไม่พบระบบงาน PR ของเทศบาลไทยแบบสำเร็จรูป** [6–8] |
| มอบหมายงานภาคสนาม + รับทราบ | Deputy, Connecteam, Tanda/Celayix | ตอบรับ/ปฏิเสธกะงาน, pop-up บังคับกดอ่าน, รายงานใครยังไม่รับทราบ, แจ้งหัวหน้า [9–13] |
| จอแสดงผลสำนักงาน | Yodeck, Rise Vision, ScreenCloud | ดึงปฏิทินขึ้นจอ ราคา $8–30/จอ/เดือน [14–15] |
| คลังภาพ/วิดีโอ | PhotoShelter, Canto, Immich (open source) | อัลบั้ม, ค้นด้วยใบหน้า, alt text, shared album [16–17] |

### ตารางเทียบฟีเจอร์

| ฟีเจอร์ | PR-OS | ระบบที่ทำได้ |
|---|---|---|
| ปฏิทิน ตาราง/เดือน/สัปดาห์ + ตัวกรอง | ✅ มี | Desk-Net, CoSchedule |
| มอบหมายตามบทบาท + เตือนเวลาชน | ✅ มี | Desk-Net, Deputy |
| รับทราบ + reset เมื่อแก้สาระสำคัญ (ผูก version) | ✅ มี — **จุดแข็ง** | Tanda, Celayix, Deputy |
| จอสำนักงานที่กรองข้อมูลอ่อนไหว | ✅ มี — ปลอดภัยกว่า signage ทั่วไป | Yodeck, Rise Vision |
| แจ้งเตือนหลายช่องทาง + quota guard | ✅ มี (รอ credential) | Deputy, govDelivery |
| Audit log, Excel/PDF, PWA รับทราบตอนออฟไลน์ | ✅ มี | Connecteam, monday |
| **ปฏิเสธ/ติดภารกิจ + เหตุผล** | ❌ ไม่มี | Deputy, Tanda |
| **ตามคนที่ยังไม่รับทราบ → แจ้งหัวหน้า** | ◐ บางส่วน (มี reminder + รายงานค้าง แต่ไม่ escalate) | Connecteam, Deputy |
| อ้างอิงเลขหนังสือราชการ / ลิงก์ e-Office | ❌ ไม่มี | e-Saraban (ระบบแยก) |
| ฟีด ICS เข้า Google/iPhone Calendar | ❌ ไม่มี | Yodeck, Rise Vision |
| ติดตามชิ้นงานหลังงาน (ภาพส่งแล้ว/ข่าวออก/ลิงก์โพสต์) | ❌ ไม่มี | Desk-Net, monday |
| คลังภาพ + ธง consent | ❌ ไม่มี (มีแค่ไฟล์แนบ ≤10 MB) | PhotoShelter, Canto, Immich |
| ฟอร์มรับคำขอจากกองอื่น | ❌ ไม่มี | CoSchedule, monday |
| ขั้นอนุมัติก่อนเผยแพร่ | ◐ คุมด้วย role เท่านั้น | Planable, CoSchedule |
| Backup/archive อัตโนมัติ | ❌ ไม่มี | SaaS จัดการให้ |

### ช่องว่างที่ควรพิจารณา (เรียงตามคุณค่าสำหรับทีม 6 คน)

| # | ข้อเสนอ | Effort | เข้า MVP ได้ไหม |
|---|---|---|---|
| 1 | ปุ่ม **"ไม่สะดวก" + เหตุผล** → แจ้งหัวหน้าทันที (ตอนนี้ระบบรู้แค่ "รับทราบ/ยังไม่รับทราบ") | S | ได้ |
| 2 | **Escalation**: ยังไม่รับทราบภายใน X ชม. ก่อนงาน → แจ้งหัวหน้า (ใช้คิวเดิม) | S | ได้ |
| 3 | ช่อง **เลขที่หนังสือ / ลิงก์ e-Office** ในงาน — ตรวจย้อนได้โดยไม่ต้องทำ OCR | S | ได้ |
| 4 | **ฟีด ICS ส่วนตัวแบบมี token** (กรองฟิลด์ภายในเหมือนจอมอนิเตอร์) | S | หลัง MVP |
| 5 | **Checklist ชิ้นงานหลังงาน** → รายงานผู้บริหารวัดผลงาน (output) ได้ ไม่ใช่แค่นับงาน | M | หลัง MVP |
| 6 | **ลิงก์คลังภาพ + ธง consent/ห้ามเผยแพร่** — ลิงก์ไป Google Drive/Immich แทนการสร้าง DAM เอง (Storage แผนฟรีไม่พอสำหรับภาพ/วิดีโอ) | M | หลัง MVP |
| 7 | ฟอร์มขอรับบริการ PR จากกองอื่น (เข้ามาเป็น draft) | M | ระยะถัดไป |
| 8 | ขั้นอนุมัติก่อนเผยแพร่ — สำหรับทีม 6 คนอาจทำให้ช้าเกินจำเป็น ทำเมื่อหัวหน้าต้องการจริง | S–M | ตามความต้องการ |

ข้อ 1–3 แตะ schema และ API จึงต้องอัปเดต `docs/04` + `docs/05` และต้องให้ owner ยืนยันก่อนรันบน Supabase จริง

### สิ่งที่ต้องระวังเป็นพิเศษ

**1. โควต้า LINE จะเต็มเร็วกว่าที่คิด — เรื่องนี้สำคัญที่สุด**
- LINE Notify ปิดบริการแล้วตั้งแต่ 31 มี.ค. 2025 [18] PR-OS ใช้ Messaging API อยู่แล้ว จึงไม่ได้รับผลกระทบ
- แพ็กเกจฟรีของ LINE OA ไทยลดเหลือ **300 ข้อความ/เดือน** ตั้งแต่ 1 ส.ค. 2024 [19] (ข้อมูลจาก snippet ประกาศ เปิดหน้าทางการไม่ได้ — ควรเช็กใน LINE OA Manager) โดย push นับรวมโควต้า แต่ reply ไม่นับ [20]
- **ประมาณการ:** งานหนึ่งที่มีผู้รับผิดชอบ 2 คนใช้ราว 6–8 ข้อความ (มอบหมาย + เตือน 24 ชม. + เตือน 1.5 ชม. + แก้ไข) โควต้า 300 ข้อความจึงรองรับได้แค่ **ประมาณ 40 งาน/เดือน**
- **ข้อเสนอ:** ส่ง **สรุปงานรายวันคนละ 1 ข้อความ** (6 คน × 30 วัน = 180) ส่วนเตือน 1.5 ชม. ส่งทาง LINE เฉพาะงานที่ยังไม่รับทราบ ที่เหลือส่งทาง Email — ต้องตัดสินใจก่อนเปิดส่งจริง
- ราคาแพ็กเกจแบบเสียเงินปี 2026 **ยืนยันไม่ได้** (มีแต่แหล่งบุคคลที่สาม)

**2. Supabase แผนฟรีไม่เหมาะกับการเก็บบันทึกราชการระยะยาว**
- โปรเจกต์จะถูก pause เมื่อไม่มี activity 7 วัน และ restore ได้ภายใน 90 วัน [21]
- เอกสารของ Supabase เรื่อง backup ในแผนฟรีพูดไม่ตรงกัน [22] ควร `supabase db dump` ตามรอบแล้วเก็บไว้นอก Supabase
- ระยะยาวควรพิจารณาแผน Pro หรือเซิร์ฟเวอร์ของเทศบาล
- keep-alive (`.github/workflows/keep-alive.yml`) ช่วยกัน pause ได้ แต่ไม่ได้ทำหน้าที่ backup

**3. PDPA**
- ภาพที่เห็นหน้าบุคคลชัดถือเป็นข้อมูลส่วนบุคคล [23] และ PDPC เคยปรับจริงถึง 7 ล้านบาทในปี 2024 [24]
- ควรมี:
  - privacy notice สำหรับบุคลากร (เบอร์โทร, LINE userId)
  - นโยบายระยะเวลาเก็บข้อมูล
  - ธง consent/ห้ามเผยแพร่บนภาพ
- log การเข้าถึงไฟล์มีอยู่แล้ว
- ฐานทางกฎหมายแบบ "ภารกิจรัฐ" และเรื่อง DPO ของ อปท. **ยืนยันไม่ได้** — ควรถามนิติกรของเทศบาล

**4. การเก็บรักษาบันทึกราชการ**
- เกี่ยวข้องกับระเบียบงานสารบรรณ (ฉบับที่ 4) พ.ศ. 2564 และ พ.ร.บ.จดหมายเหตุแห่งชาติ พ.ศ. 2556 [7][25]
- อายุการเก็บ "10 ปี" ที่พูดกันทั่วไป **ยืนยันไม่ได้**
- ให้คงหลัก soft-delete ไว้ และเพิ่ม export รายปีสำหรับเก็บถาวร

**5. มาตรฐานภาครัฐ**
- สพร. มีมาตรฐานเว็บไซต์ภาครัฐ 2.0 (ร่างฉบับ 3 เปิดรับฟังความเห็นปี 2023) และร่าง มรด. การจัดระดับชั้นข้อมูล (ม.ค. 2026) [26]
- ระดับ WCAG ที่บังคับใช้ **ยืนยันไม่ได้** ให้ยึด WCAG 2.1 AA เป็นอย่างน้อย

**6. การยอมรับระบบ (adoption)**
- งานวิจัย e-Saraban พบอุปสรรค 4 ข้อ [7]:
  - ยึดวิธีทำงานแบบเดิม
  - ระบบไม่เสถียร
  - ขาดทักษะ
  - ขาดระเบียบรองรับ
- ข้อเสนอ:
  - ให้ผู้บริหารประกาศให้ PR-OS เป็นแหล่งข้อมูลหลัก
  - ใช้ไวท์บอร์ดคู่ขนานในช่วงสั้น ๆ
  - ทำให้กดรับทราบจาก LINE ได้ในคลิกเดียว
  - ไม่ปล่อยให้ระบบล่มเพราะ pause

**7. ค่าจอ**
- signage แบบ SaaS ราคา $8–30/จอ/เดือน [14][15]
- จอ `/monitor` บน kiosk browser ของ PR-OS ถูกกว่าและกรองข้อมูลได้ดีกว่า — **ควรเก็บแนวทางนี้ไว้**

---

## ส่วน B — ความสามารถด้านสื่อของ Claude 5.5 กับการทำให้เว็บไม่น่าเบื่อ

### สิ่งที่ยืนยันแล้ว (จากเอกสาร Anthropic)

| หัวข้อ | ข้อเท็จจริง |
|---|---|
| รับ-ส่งข้อมูล | **รับข้อความ + รูปภาพ (+ PDF) และตอบเป็นข้อความ** [B2][B5] |
| Vision | high-res อัตโนมัติ ด้านยาวสุด 2576px, สูงสุด 600 รูปต่อ request, ไฟล์ละไม่เกิน 10MB [B6] Opus 5.5 อ่านกราฟ ไดอะแกรม และ screenshot ได้แม่นขึ้นชัดเจน [B1][B2] |
| สร้างภาพ/เสียง/วิดีโอ | **ทำไม่ได้แบบ native** — เอกสาร Vision ระบุว่า Claude สร้างหรือแก้ไขภาพไม่ได้ [B6][B10] |
| สื่อที่สร้างจากโค้ด | เขียน SVG/HTML/CSS/canvas ได้ และ code execution สร้างไฟล์ PNG/MP4/MP3 ได้ (sandbox ไม่มี internet) [B8] |
| Claude Design | สร้างและแก้ดีไซน์บน canvas ได้ในทุกบทสนทนา รวมถึง Claude Code และ import design system ได้ [B10][B12] |
| คำแนะนำการ prompt | ถ้าไม่ให้ทิศทาง จะได้สไตล์ frontend แบบ default ซ้ำ ๆ — ให้ **ระบุรายการสิ่งที่ห้ามใช้ชัด ๆ** แทนการบอกกว้าง ๆ ว่า "อย่าดูเป็น AI" [B3] |
| ข้อจำกัด | Files API ไม่รองรับ ZDR และไฟล์ใช้ร่วมกันทั้ง workspace — **ไม่ควรเอาไฟล์แนบ private ไปฝากไว้** [B7] |

ยืนยันไม่ได้: การรับเสียงหรือวิดีโอเป็น input และฟีเจอร์สื่อที่มีเฉพาะรุ่น 5.5 — ให้ถือว่าไม่มี

**Connector ใน environment นี้:**
- **Figma** — ดึงหน้าจริงเข้า Figma และทำ design system
- **Canva** — autofill brand template เป็นโปสเตอร์/โพสต์
- **HyperFrames** — HTML → MP4 (ใน Claude Code ต้องใช้ local skill เพราะเครื่องมือ compose/render ของ MCP ถูกปิด)
- **Gamma** — ทำสไลด์สรุปผู้บริหาร

`generate_image` ของ Canva และ Figma ใช้โมเดลของผู้ให้บริการเหล่านั้น ไม่ใช่ Claude

### ไอเดียที่นำมาใช้กับ PR-OS

หลักที่ใช้คัด:
- MVP ไม่มี AI ใน production
- `/monitor` ยึดแบบ "ตารางเรียบ ตัวใหญ่" (ตาม `docs/14` ซึ่ง supersede `docs/12` เฉพาะจอนี้)
- motion ต้องมีความหมายและเคารพ `prefers-reduced-motion`

| ไอเดีย | ตัดสิน | คุณค่า | Effort | ต้องเรียก Claude API ตอน runtime? |
|---|---|---|---|---|
| **Data-viz รายงานด้วย inline SVG** — heatmap ภาระงานรายคน, แนวโน้มรายสัปดาห์, กราฟค้างรับทราบ (พิมพ์ใน `/reports/print` ได้) | ✅ ทำก่อน | สูง | S–M | ไม่ |
| **Claude Design ทำ 3–4 ทิศทาง redesign บน canvas** พร้อม avoid-list ก่อนลงโค้ด | ✅ | สูง — แก้ "เว็บดูจืด" ตรงจุด | S | ไม่ |
| **Vision QA ตอนพัฒนา** — ถ่าย screenshot desktop/มือถือ/จอแล้วให้ตรวจความอ่านง่ายภาษาไทย, ล้นจอ, contrast (ใช้ mock data เท่านั้น) | ✅ | สูง — ตรงกับ Definition of Done | S | ไม่ |
| **การ์ด/โปสเตอร์ต่องานจาก template SVG/HTML** — ใช้เฉพาะฟิลด์ที่ปลอดภัยสำหรับจอ, สีตามประเภทงาน, ทำเป็นหน้าพิมพ์แบบ `/reports/print` (ไม่ต้องเพิ่ม library และต้องทดสอบสระ/วรรณยุกต์) | ✅ | กลาง–สูง — ฝ่าย PR ได้ภาพประกอบโพสต์ทันที | M | ไม่ |
| **Figma design-system sync** ล็อก token และ component | ✅ ตอนออกแบบ | กลาง | M | ไม่ |
| **Monitor: highlight แถวที่เพิ่งเปลี่ยน/ยกเลิก** + crossfade ตอน refresh (ไม่ใส่ transition ตกแต่งบนตารางหลัก) | ⚠️ ทำเฉพาะส่วน | กลาง | S | ไม่ |
| **ช่องทีวีย้อนยุคใช้ข้อมูลสด** (อากาศ/ราคา) + เปลี่ยนรีโมทเป็น Supabase Realtime — เป็นงาน data ไม่ใช่ความสามารถของ Claude | ⚠️ | กลาง | M | ไม่ (แต่ต้องดึง API ภายนอก) |
| **Recap video จากภาพงาน** (HyperFrames + FFmpeg) — คนต้องเลือกภาพและตรวจเอง ห้ามดึงจากไฟล์แนบ private อัตโนมัติ (PDPA) | ⏸ Phase 2 / เครื่องมือนอกระบบ | กลาง (งานสื่อสารภายนอก) | M–L | ไม่ |
| **ร่างข่าวประชาสัมพันธ์จากข้อมูลงาน** — ส่งเฉพาะฟิลด์สาธารณะ คนอนุมัติก่อนเผยแพร่ และมี audit (Sonnet 5.5 ราว <$0.05 ต่อฉบับ) | ⏸ Phase 2 | สูง | S–M | ใช่ (key ฝั่ง server) |
| **Alt text/คำบรรยายภาพอัตโนมัติ** — ต้นทุนต่ำมาก (≈$0.0001 ต่อภาพบน Haiku 5.5) แต่ภาพต้องส่งออกนอกระบบ และ Claude ไม่ระบุตัวบุคคล | ⏸ Phase 2 | กลาง | M | ใช่ |
| ให้ Claude "สร้างภาพ/โลโก้" | ❌ ตัดทิ้ง — ทำไม่ได้ ใช้ Canva/Figma แทน | – | – | – |
| ฝากไฟล์ไว้ใน Files API แบบถาวร | ❌ สำหรับ MVP — ไม่รองรับ ZDR และขัดกับ RLS ของไฟล์แนบ | – | – | – |

**ลำดับที่แนะนำ:**
1. Claude Design + avoid-list
2. Figma ล็อก design system
3. Data-viz ในรายงาน
4. การ์ดต่องาน
5. Vision QA loop
6. Monitor change-highlight

ส่วน Phase 2 (ร่างข่าว, alt text) ต้องผ่าน Human Gate เพราะใช้ API key ใหม่และส่งข้อมูลออกนอกระบบ และต้องอัปเดต `docs/05` + `docs/08` ก่อน

---

## แหล่งอ้างอิง

**ส่วน A**
1. https://desk-net.com/info/newsroom-content-planning
2. https://www.journalism.co.uk/advertorial-using-desk-net-to-better-manage-cross-platform-newsrooms/
3. https://makerstack.co/reviews/planable-review/
4. https://coschedule.com/marketing-suite
5. https://monday.com/templates/media-coverage
6. https://assets.applytosupply.digitalmarketplace.service.gov.uk/g-cloud-15/documents/92418/492158674076955-service-definition-document-2026-01-29-1955.pdf
7. https://cuir.car.chula.ac.th/xmlui/handle/123456789/81179?show=full
8. https://so05.tci-thaijo.org/index.php/polsciPSU/article/download/282316/188434/1251059
9. https://help.deputy.com/hc/en-au/articles/4689081125007
10. https://help.deputy.com/hc/en-au/articles/6727607546767
11. https://connecteam.com/pop-up-updates/
12. https://help.connecteam.com/en/articles/3933810-follow-up-notifications
13. https://help.tanda.co/en/articles/3054115-have-employees-acknowledge-their-rostered-shifts · https://www.celayix.com/blog/automation-schedule-change-communications
14. https://www.yodeck.com/apps/daily-weekly-calendar-app · https://www.softwareadvice.com/android-kiosk/yodeck-profile
15. https://www.risevision.com/blog/screencloud-alternatives
16. https://go.photoshelter.com/brands/blog/photoshelter-vs-canto/
17. https://www.glukhov.org/post/2025/11/selfhosting-immich/
18. https://developers.line.biz/en/news/tags/end-of-life
19. https://lineforbusiness.com/th/news/20240619_1
20. https://docs.conduit.ai/setting-up-conduit/connect-line
21. https://supabase.com/docs/guides/platform/free-project-pausing
22. https://supabase.com/docs/guides/platform/backups · https://supabase.com/docs/pricing
23. https://he02.tci-thaijo.org/index.php/simedbull/article/view/270948
24. https://www.tilleke.com/insights/landmark-fine-imposed-under-thailands-personal-data-protection-act/
25. ระเบียบสำนักนายกรัฐมนตรีว่าด้วยงานสารบรรณ (ฉบับที่ 4) พ.ศ. 2564 — https://www.arch.chula.ac.th/arch-cu/files/formcontentepost/
26. https://standard.dga.or.th/wp-content/uploads/2023/07/PH-GovWebsite3_v.01.pdf

**ส่วน B**
- B1. https://www.anthropic.com/claude-opus-5-5
- B2. https://platform.claude.com/docs/en/models/opus-5-5/whats-new-opus-5-5
- B3. https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5
- B4. https://platform.claude.com/docs/en/models/sonnet-5-5/overview
- B5. https://platform.claude.com/docs/en/models/haiku-5-5/overview
- B6. https://platform.claude.com/docs/en/build-with-claude/vision
- B7. https://platform.claude.com/docs/en/build-with-claude/files
- B8. https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool
- B9. https://platform.claude.com/docs/en/agents-and-tools/tool-use/browser-use-tool
- B10. https://www.anthropic.com/news/claude-design-anthropic-labs
- B11. https://github.com/heygen-com/hyperframes
- B12. https://support.claude.com/en/articles/12138966-release-notes
