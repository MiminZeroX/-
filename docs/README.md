# คู่มือ · Manuals

| เล่ม                                         | PDF                                                    | ต้นฉบับ                                          | สำหรับ                                                                  |
| -------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------ | ----------------------------------------------------------------------- |
| คู่มือการใช้งานสำหรับผู้ใช้ทั่วไป             | [user-guide.pdf](pdf/user-guide.pdf)                   | [user-guide.md](user-guide.md)                   | เจ้าหน้าที่ผู้จองห้อง                                                    |
| คู่มือผู้ดูแลระบบและการพัฒนาต่อยอด           | [admin-guide.pdf](pdf/admin-guide.pdf)                 | [admin-guide.md](admin-guide.md)                 | ผู้ดูแลห้องประชุม ผู้ดูแล GitHub/Cloudflare นักพัฒนา ผู้ส่งมอบ/รับมอบ      |
| คู่มือโปรแกรมตรวจสอบระบบ                     | [checker-guide.pdf](pdf/checker-guide.pdf)             | [checker-guide.md](checker-guide.md)             | ผู้ตรวจการทำงานและความปลอดภัยของเว็บ (Windows/macOS)                     |
| คู่มือการลบข้อมูลและล้างฐานข้อมูล            | [data-deletion-guide.pdf](pdf/data-deletion-guide.pdf) | [data-deletion-guide.md](data-deletion-guide.md) | ผู้ดูแลระบบ เจ้าหน้าที่คุ้มครองข้อมูลส่วนบุคคล (DPO)                       |
| Complete manual (English)                    | [manual.en.pdf](pdf/manual.en.pdf)                     | [manual.en.md](manual.en.md)                     | English readers                                                         |

- ภาพหน้าจอ · Screenshots: [images/](images/) (ข้อมูลตัวอย่าง · sample data)
- เอกสารเทคนิค · Technical: [../deploy/CLOUDFLARE.md](../deploy/CLOUDFLARE.md) · [../deploy/README.md](../deploy/README.md)
- สร้าง PDF ใหม่หลังแก้ไฟล์ `.md` · Rebuild the PDFs: `node docs/build/build-pdf.js` (ทุกเล่ม) หรือ `node docs/build/build-pdf.js admin-guide` (เล่มเดียว) — ต้องมี pandoc, poppler (pdftotext) และ Playwright
