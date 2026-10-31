# คู่มือ · Manual

**[manual.pdf](pdf/manual.pdf)** — คู่มือฉบับสมบูรณ์เล่มเดียว ภาษาไทย (ครึ่งแรก) และ English (ครึ่งหลัง) มีสารบัญแยกหมวดภาษา
Complete manual in one book — Thai (first half) and English (second half), with a contents page grouped by language.

| ส่วน · Part | เนื้อหา · Contents                                                                 |
| ----------- | ---------------------------------------------------------------------------------- |
| ก · A       | เริ่มต้น ภาพรวม คำศัพท์ · Getting started, overview, glossary                      |
| ข · B       | ผู้ใช้ทั่วไป (เจ้าหน้าที่) · Staff (general users)                                 |
| ค · C       | ผู้ดูแลระบบ (หน้า admin) · Administrators                                          |
| ง · D       | GitHub: แก้ไขโค้ด ย้อนกลับ · GitHub: editing and undoing                           |
| จ · E       | Cloudflare: เว็บออนไลน์ ค่าลับ ค่าใช้จ่าย · Cloudflare: live site, secrets, costs  |
| ฉ · F       | สร้างใหม่ตั้งแต่ต้นจนจบ · Building from scratch                                    |
| ช · G       | การส่งมอบ (ผู้สร้าง / ผู้รับมอบ) · Handover (creator / recipient)                  |
| ซ · H       | ความปลอดภัย PDPA เหตุฉุกเฉิน แก้ปัญหา · Security, PDPA, incidents, troubleshooting |

- ต้นฉบับ · Source: [manual.md](manual.md) · ภาพหน้าจอ · Screenshots: [images/](images/)
- เอกสารเทคนิค · Technical: [../deploy/CLOUDFLARE.md](../deploy/CLOUDFLARE.md) · [../deploy/README.md](../deploy/README.md)
- สร้าง PDF ใหม่หลังแก้ `manual.md` · Rebuild the PDF after editing: `node docs/build/build-pdf.js` (ต้องมี pandoc, poppler-utils และ Playwright · requires pandoc, poppler-utils and Playwright)

ภาพหน้าจอในคู่มือใช้ข้อมูลตัวอย่าง · Screenshots use sample data.
