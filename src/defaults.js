"use strict";

const DEFAULT_SETTINGS = {
  // ข้อมูลหน่วยงาน
  orgName: "สำนักงานเขตบางรัก",
  siteName: "ระบบจองห้องประชุม",
  subtitle: "กรุงเทพมหานคร",
  logo: "",
  contactText: "ติดต่อสอบถาม: ผู้ดูแลห้องประชุม สำนักงานเขตบางรัก",

  // ประกาศ
  announcementEnabled: true,
  announcementLevel: "info",
  announcementText:
    "ยินดีต้อนรับสู่ระบบจองห้องประชุมออนไลน์ สำนักงานเขตบางรัก — จองได้ทั้งจากคอมพิวเตอร์ แท็บเล็ต และมือถือ ผ่าน Wi-Fi ภายในสำนักงาน",

  // ช่วงเวลาให้บริการ
  openTime: "08:00",
  closeTime: "18:00",
  slotMinutes: 30,
  minDurationMinutes: 30,
  maxDurationMinutes: 600,
  bufferMinutes: 0,
  advanceDays: 90,
  minNoticeMinutes: 0,
  allowWeekends: false,
  allowHolidays: false,

  // การอนุมัติและสิทธิ์ผู้จอง
  requireApproval: false,
  allowUserCancel: true,
  allowUserEdit: true,
  cancelDeadlineMinutes: 0,
  maxActivePerPhone: 0,
  enableRecurring: true,
  maxRecurring: 12,
  requirePhone: true,
  requireEmail: false,
  enforceCapacity: true,
  termsText:
    "1. กรุณาเข้าใช้ห้องประชุมตรงเวลา และคืนห้องตามเวลาที่จอง\n2. ช่วยกันดูแลความสะอาด ปิดไฟ เครื่องปรับอากาศ และอุปกรณ์ทุกครั้งหลังใช้งาน\n3. หากไม่ใช้ห้องตามที่จอง กรุณายกเลิกในระบบล่วงหน้า เพื่อให้หน่วยงานอื่นใช้ห้องได้\n4. หากอุปกรณ์ชำรุดหรือมีปัญหา กรุณาแจ้งผู้ดูแลห้องประชุมทันที",

  // ความเป็นส่วนตัว
  showOrganizerPublic: true,
  showTitlePublic: true,

  // เช็คอิน
  checkinEnabled: false,
  checkinWindowMinutes: 15,
  autoReleaseMinutes: 15,

  // รายการอุปกรณ์/บริการเสริม
  equipmentOptions: [
    "โปรเจกเตอร์",
    "จอทีวี",
    "ไมโครโฟน",
    "ระบบเครื่องเสียง",
    "ระบบประชุมออนไลน์",
    "ไวท์บอร์ด",
    "ปลั๊กพ่วง",
  ],
  serviceOptions: [
    "น้ำดื่ม",
    "กาแฟ/เครื่องดื่ม",
    "อาหารว่าง",
    "จัดโต๊ะแบบพิเศษ",
  ],

  // รูปลักษณ์และเอฟเฟกต์
  themeColor: "green",
  defaultThemeMode: "auto",
  motionLevel: "full",
  hapticFeedback: true,
  clickSound: false,
  confettiOnBooking: true,

  // หน้าจอหน้าห้อง
  displayEnabled: true,
  displayShowTitle: true,

  // ระบบ
  maintenanceMode: false,
  maintenanceMessage:
    "ระบบปิดรับการจองชั่วคราวเพื่อปรับปรุง ขออภัยในความไม่สะดวก",
  adminNotifySound: true,
  logRetentionDays: 365,
  backupKeepDays: 30,
  bookingRateLimitPerHour: 30,
  sessionHours: 12,
};

// สคีมาสำหรับตรวจสอบค่าที่แอดมินบันทึก
const SETTINGS_SCHEMA = {
  orgName: { type: "str", min: 1, max: 120 },
  siteName: { type: "str", min: 1, max: 120 },
  subtitle: { type: "str", max: 120 },
  logo: { type: "dataurl", max: 400000 },
  contactText: { type: "str", max: 300 },
  announcementEnabled: { type: "bool" },
  announcementLevel: {
    type: "enum",
    values: ["info", "success", "warning", "danger"],
  },
  announcementText: { type: "str", max: 1000 },
  openTime: { type: "time" },
  closeTime: { type: "time" },
  slotMinutes: { type: "enum", values: [10, 15, 20, 30, 60] },
  minDurationMinutes: { type: "int", min: 5, max: 1440 },
  maxDurationMinutes: { type: "int", min: 10, max: 1440 },
  bufferMinutes: { type: "int", min: 0, max: 120 },
  advanceDays: { type: "int", min: 1, max: 730 },
  minNoticeMinutes: { type: "int", min: 0, max: 10080 },
  allowWeekends: { type: "bool" },
  allowHolidays: { type: "bool" },
  requireApproval: { type: "bool" },
  allowUserCancel: { type: "bool" },
  allowUserEdit: { type: "bool" },
  cancelDeadlineMinutes: { type: "int", min: 0, max: 10080 },
  maxActivePerPhone: { type: "int", min: 0, max: 500 },
  enableRecurring: { type: "bool" },
  maxRecurring: { type: "int", min: 2, max: 52 },
  requirePhone: { type: "bool" },
  requireEmail: { type: "bool" },
  enforceCapacity: { type: "bool" },
  termsText: { type: "str", max: 4000 },
  showOrganizerPublic: { type: "bool" },
  showTitlePublic: { type: "bool" },
  checkinEnabled: { type: "bool" },
  checkinWindowMinutes: { type: "int", min: 0, max: 120 },
  autoReleaseMinutes: { type: "int", min: 0, max: 240 },
  equipmentOptions: { type: "list", maxItems: 40, maxLen: 60 },
  serviceOptions: { type: "list", maxItems: 40, maxLen: 60 },
  themeColor: {
    type: "enum",
    values: [
      "green",
      "teal",
      "blue",
      "indigo",
      "purple",
      "rose",
      "orange",
      "gold",
    ],
  },
  defaultThemeMode: { type: "enum", values: ["auto", "light", "dark"] },
  motionLevel: { type: "enum", values: ["full", "reduced", "off"] },
  hapticFeedback: { type: "bool" },
  clickSound: { type: "bool" },
  confettiOnBooking: { type: "bool" },
  displayEnabled: { type: "bool" },
  displayShowTitle: { type: "bool" },
  maintenanceMode: { type: "bool" },
  maintenanceMessage: { type: "str", max: 500 },
  adminNotifySound: { type: "bool" },
  logRetentionDays: { type: "int", min: 7, max: 3650 },
  backupKeepDays: { type: "int", min: 1, max: 365 },
  bookingRateLimitPerHour: { type: "int", min: 1, max: 1000 },
  sessionHours: { type: "int", min: 1, max: 168 },
};

// ค่าที่ส่งให้หน้าเว็บผู้ใช้ทั่วไปได้ (ไม่มีค่าภายในระบบ)
const PUBLIC_SETTING_KEYS = [
  "orgName",
  "siteName",
  "subtitle",
  "logo",
  "contactText",
  "announcementEnabled",
  "announcementLevel",
  "announcementText",
  "openTime",
  "closeTime",
  "slotMinutes",
  "minDurationMinutes",
  "maxDurationMinutes",
  "bufferMinutes",
  "advanceDays",
  "minNoticeMinutes",
  "allowWeekends",
  "allowHolidays",
  "requireApproval",
  "allowUserCancel",
  "allowUserEdit",
  "cancelDeadlineMinutes",
  "enableRecurring",
  "maxRecurring",
  "requirePhone",
  "requireEmail",
  "enforceCapacity",
  "termsText",
  "showOrganizerPublic",
  "showTitlePublic",
  "checkinEnabled",
  "checkinWindowMinutes",
  "autoReleaseMinutes",
  "equipmentOptions",
  "serviceOptions",
  "themeColor",
  "defaultThemeMode",
  "motionLevel",
  "hapticFeedback",
  "clickSound",
  "confettiOnBooking",
  "displayEnabled",
  "displayShowTitle",
  "maintenanceMode",
  "maintenanceMessage",
];

function defaultRooms() {
  return [
    {
      id: "small-2",
      name: "ห้องประชุมเล็ก",
      floor: "ชั้น 2",
      capacity: 15,
      description: "เหมาะสำหรับประชุมกลุ่มย่อย ประชุมฝ่าย และประชุมออนไลน์",
      equipment: ["จอทีวี", "ระบบประชุมออนไลน์", "ไวท์บอร์ด"],
      color: "#0284c7",
      active: true,
      approval: "inherit",
      closedMessage: "",
      archived: false,
      order: 1,
    },
    {
      id: "large-4",
      name: "ห้องประชุมใหญ่",
      floor: "ชั้น 4",
      capacity: 80,
      description: "เหมาะสำหรับประชุมใหญ่ อบรม สัมมนา และกิจกรรมของสำนักงานเขต",
      equipment: [
        "โปรเจกเตอร์",
        "ไมโครโฟน",
        "ระบบเครื่องเสียง",
        "ระบบประชุมออนไลน์",
      ],
      color: "#7c3aed",
      active: true,
      approval: "inherit",
      closedMessage: "",
      archived: false,
      order: 2,
    },
  ];
}

const DEFAULT_DEPARTMENTS = [
  "ผู้บริหารสำนักงานเขต",
  "ฝ่ายปกครอง",
  "ฝ่ายทะเบียน",
  "ฝ่ายการคลัง",
  "ฝ่ายรายได้",
  "ฝ่ายโยธา",
  "ฝ่ายรักษาความสะอาดและสวนสาธารณะ",
  "ฝ่ายเทศกิจ",
  "ฝ่ายพัฒนาชุมชนและสวัสดิการสังคม",
  "ฝ่ายสิ่งแวดล้อมและสุขาภิบาล",
  "ฝ่ายการศึกษา",
  "หน่วยงานภายนอก",
];

// วันหยุดราชการที่วันที่ตายตัวทุกปี (วันหยุดทางจันทรคติ/วันหยุดชดเชย ให้แอดมินเพิ่มเอง)
const FIXED_HOLIDAYS = [
  ["01-01", "วันขึ้นปีใหม่"],
  ["04-06", "วันจักรี"],
  ["04-13", "วันสงกรานต์"],
  ["04-14", "วันสงกรานต์"],
  ["04-15", "วันสงกรานต์"],
  ["05-04", "วันฉัตรมงคล"],
  ["06-03", "วันเฉลิมพระชนมพรรษาสมเด็จพระราชินี"],
  ["07-28", "วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว"],
  ["08-12", "วันแม่แห่งชาติ"],
  ["10-13", "วันนวมินทรมหาราช"],
  ["10-23", "วันปิยมหาราช"],
  ["12-05", "วันพ่อแห่งชาติ"],
  ["12-10", "วันรัฐธรรมนูญ"],
  ["12-31", "วันสิ้นปี"],
];

function fixedHolidays(year) {
  return FIXED_HOLIDAYS.map(([md, name]) => ({ date: `${year}-${md}`, name }));
}

module.exports = {
  DEFAULT_SETTINGS,
  SETTINGS_SCHEMA,
  PUBLIC_SETTING_KEYS,
  defaultRooms,
  DEFAULT_DEPARTMENTS,
  fixedHolidays,
};
