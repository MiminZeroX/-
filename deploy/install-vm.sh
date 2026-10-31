#!/usr/bin/env bash
# ติดตั้ง/อัปเดตระบบจองห้องประชุมบนเครื่องคลาวด์ (VM) Ubuntu 22.04 หรือ 24.04
# พร้อม HTTPS อัตโนมัติ (Caddy + Let's Encrypt ต่ออายุใบรับรองให้เอง)
#
# ติดตั้งครั้งแรก:
#   sudo bash deploy/install-vm.sh --domain=booking.example.go.th --office-ips=203.0.113.10
#   (ไม่มีโดเมน: เว้น --domain ไว้ ระบบจะใช้ชื่อชั่วคราว <IP>.sslip.io ให้)
# อัปเดตโค้ด (หลัง git pull หรืออัปโหลดไฟล์ใหม่):
#   sudo bash deploy/install-vm.sh
#
# ตัวเลือก:
#   --domain=ชื่อโดเมน          ชื่อที่ชี้ (DNS A record) มายัง IP ของเครื่องนี้แล้ว
#   --office-ips=IP,IP/24       IP สาธารณะของสำนักงาน (ทุกคนในสำนักงานออกเน็ตด้วย IP นี้)
#   --admin-office-only         เปิดหน้าผู้ดูแลได้เฉพาะจาก IP สำนักงาน
#   --admin-anywhere            ยกเลิกการจำกัดข้างบน

set -euo pipefail

APP_DIR=/opt/bangrak-booking
DATA_DIR=/var/lib/bangrak-booking
ENV_FILE=/etc/bangrak-booking.env
SERVICE=bangrak-booking
APP_USER=bangrak
PORT=3000
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[31mผิดพลาด:\033[0m %s\n\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "กรุณารันด้วย sudo"
command -v apt-get >/dev/null || die "สคริปต์นี้รองรับ Ubuntu/Debian เท่านั้น"
[ -f "$SRC_DIR/server.js" ] || die "ไม่พบ server.js — รันสคริปต์จากโฟลเดอร์โปรเจกต์"

DOMAIN=""
OFFICE_IPS=""
ADMIN_MODE=""
for a in "$@"; do
  case "$a" in
    --domain=*) DOMAIN="${a#*=}" ;;
    --office-ips=*) OFFICE_IPS="${a#*=}" ;;
    --admin-office-only) ADMIN_MODE=office ;;
    --admin-anywhere) ADMIN_MODE=anywhere ;;
    -h | --help) sed -n '2,17p' "$0"; exit 0 ;;
    *) die "ไม่รู้จักตัวเลือก $a (ดู --help)" ;;
  esac
done

# ค่าเดิมจากการติดตั้งครั้งก่อน (ใช้ต่อเมื่อไม่ได้ระบุใหม่)
if [ -f "$ENV_FILE" ]; then
  OLD_URL=$(sed -n 's/^PUBLIC_URL=//p' "$ENV_FILE")
  [ -n "$DOMAIN" ] || DOMAIN="${OLD_URL#https://}"
  [ -n "$OFFICE_IPS" ] || OFFICE_IPS=$(sed -n 's/^OFFICE_IPS=//p' "$ENV_FILE")
  [ -n "$ADMIN_MODE" ] || ADMIN_MODE=$(sed -n 's/^# ADMIN_MODE=//p' "$ENV_FILE")
fi
[ -n "$ADMIN_MODE" ] || ADMIN_MODE=anywhere

# ตรวจรูปแบบค่า (ค่าเหล่านี้จะถูกเขียนลงไฟล์ตั้งค่า)
if [ -n "$DOMAIN" ] && ! [[ "$DOMAIN" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ ]]; then
  die "ชื่อโดเมนไม่ถูกต้อง: $DOMAIN"
fi
if [ -n "$OFFICE_IPS" ] && ! [[ "$OFFICE_IPS" =~ ^[0-9A-Fa-f:.,/]+$ ]]; then
  die "รูปแบบ IP สำนักงานไม่ถูกต้อง: $OFFICE_IPS"
fi
if [ "$ADMIN_MODE" = office ] && [ -z "$OFFICE_IPS" ]; then
  die "--admin-office-only ต้องระบุ --office-ips ด้วย"
fi

say "ติดตั้งโปรแกรมที่จำเป็น"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https ufw >/dev/null

node_ok() { command -v node >/dev/null && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 18 ]; }
if ! node_ok; then
  apt-get install -y -qq nodejs >/dev/null 2>&1 || true
fi
if ! node_ok; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
node_ok || die "ติดตั้ง Node.js 18 ขึ้นไปไม่สำเร็จ"
NODE_BIN=$(command -v node)
echo "Node.js $(node -v)"

if ! command -v caddy >/dev/null; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key |
    gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
    >/etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy >/dev/null
fi
echo "$(caddy version | cut -d' ' -f1)"

if [ -z "$DOMAIN" ]; then
  say "ไม่ได้ระบุโดเมน — ใช้ชื่อชั่วคราวจาก sslip.io"
  PUBLIC_IP=$(curl -4 -fsS --max-time 10 https://api.ipify.org || curl -4 -fsS --max-time 10 https://ifconfig.me || true)
  [[ "$PUBLIC_IP" =~ ^[0-9]+(\.[0-9]+){3}$ ]] || die "หา IP สาธารณะของเครื่องไม่ได้ — กรุณาระบุ --domain="
  DOMAIN="${PUBLIC_IP//./-}.sslip.io"
fi
echo "ที่อยู่เว็บ: https://$DOMAIN"

say "ติดตั้งไฟล์ระบบที่ $APP_DIR"
id "$APP_USER" >/dev/null 2>&1 ||
  useradd --system --home-dir "$DATA_DIR" --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$APP_DIR" "$DATA_DIR"
# ไฟล์โปรแกรมเป็นของ root (ระบบอ่านได้อย่างเดียว) ข้อมูลเป็นของผู้ใช้ระบบเท่านั้น
tar -C "$SRC_DIR" --exclude=./data --exclude=./dist --exclude=./.git --exclude=./node_modules -cf - . |
  tar -C "$APP_DIR" --no-same-owner -xf -
chown -R root:root "$APP_DIR"
chmod -R go-w "$APP_DIR"
chown -R "$APP_USER:$APP_USER" "$DATA_DIR"
chmod 700 "$DATA_DIR"

cat >"$ENV_FILE" <<EOF
# ตั้งค่าระบบจองห้องประชุม (แก้แล้วรัน: sudo systemctl restart $SERVICE)
PORT=$PORT
HOST=127.0.0.1
DATA_DIR=$DATA_DIR
PUBLIC_URL=https://$DOMAIN
TRUST_PROXY=loopback
OFFICE_IPS=$OFFICE_IPS
# ADMIN_MODE=$ADMIN_MODE
EOF
chmod 644 "$ENV_FILE"

cat >/etc/systemd/system/$SERVICE.service <<EOF
[Unit]
Description=ระบบจองห้องประชุม สำนักงานเขตบางรัก
After=network-online.target
Wants=network-online.target

[Service]
User=$APP_USER
Group=$APP_USER
EnvironmentFile=$ENV_FILE
WorkingDirectory=$APP_DIR
ExecStart=$NODE_BIN $APP_DIR/server.js
Restart=always
RestartSec=3
KillSignal=SIGTERM
TimeoutStopSec=10
# จำกัดสิทธิ์: เขียนได้เฉพาะโฟลเดอร์ข้อมูล
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
PrivateDevices=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
LockPersonality=true
ReadWritePaths=$DATA_DIR
UMask=0077

[Install]
WantedBy=multi-user.target
EOF

say "ตั้งค่า HTTPS (Caddy)"
ADMIN_BLOCK=""
if [ "$ADMIN_MODE" = office ]; then
  ADMIN_BLOCK="
	# หน้าผู้ดูแลเปิดได้เฉพาะจากเครือข่ายสำนักงาน
	@adminOutside {
		path /admin /admin.html /admin-* /api/admin/*
		not remote_ip ${OFFICE_IPS//,/ }
	}
	respond @adminOutside \"Admin pages are available from the office network only\" 403
"
fi
cat >/etc/caddy/Caddyfile <<EOF
# สร้างโดย deploy/install-vm.sh — ระบบจองห้องประชุม
$DOMAIN {
	header Strict-Transport-Security "max-age=31536000"
	header -Server
$ADMIN_BLOCK
	reverse_proxy 127.0.0.1:$PORT
}
EOF
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null ||
  die "ไฟล์ตั้งค่า Caddy ไม่ถูกต้อง"

say "เปิดไฟร์วอลล์ (SSH, HTTP, HTTPS)"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
ufw status | sed -n '1,12p'

say "เริ่มระบบ"
systemctl daemon-reload
systemctl enable "$SERVICE" >/dev/null 2>&1
systemctl restart "$SERVICE"
systemctl enable caddy >/dev/null 2>&1
systemctl reload caddy 2>/dev/null || systemctl restart caddy

for _ in $(seq 1 20); do
  curl -fsS -o /dev/null -H "Host: $DOMAIN" "http://127.0.0.1:$PORT/" 2>/dev/null && break
  sleep 0.5
done
systemctl is-active --quiet "$SERVICE" ||
  die "ระบบเริ่มไม่สำเร็จ — ดูสาเหตุ: journalctl -u $SERVICE -n 50"

RESOLVED=$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}' || true)
MYIP=$(curl -4 -fsS --max-time 10 https://api.ipify.org 2>/dev/null || true)

echo
echo "  ----------------------------------------------------------"
echo "   ติดตั้งเสร็จแล้ว"
echo "  ----------------------------------------------------------"
echo "   เปิดใช้งาน:     https://$DOMAIN"
echo "   หน้าผู้ดูแล:     https://$DOMAIN/admin.html"
echo "   เก็บข้อมูลที่:    $DATA_DIR  (สำรองอัตโนมัติทุกวันใน $DATA_DIR/backups)"
if [ -f "$DATA_DIR/initial-admin-password.txt" ]; then
  echo
  echo "   บัญชีผู้ดูแลเริ่มต้น (ระบบจะให้ตั้งรหัสใหม่เมื่อเข้าครั้งแรก)"
  echo "     ชื่อผู้ใช้: admin"
  echo "     $(sed -n 's/\r$//; s/^รหัสผ่าน: /รหัสผ่าน: /p' "$DATA_DIR/initial-admin-password.txt")"
fi
if [ -n "$MYIP" ] && [ "$RESOLVED" != "$MYIP" ]; then
  echo
  echo "   คำเตือน: $DOMAIN ยังไม่ชี้มาที่เครื่องนี้ ($MYIP) — ตั้ง DNS A record แล้วรอสักครู่"
  echo "   Caddy จะขอใบรับรอง HTTPS ให้เองเมื่อ DNS ถูกต้อง"
fi
[ -n "$OFFICE_IPS" ] || {
  echo
  echo "   ยังไม่ได้ระบุ IP สำนักงาน: เปิดหน้าผู้ดูแล › การเชื่อมต่อ จากเครื่องในสำนักงาน"
  echo "   จะเห็น IP ที่ต้องใช้ แล้วรัน: sudo bash deploy/install-vm.sh --office-ips=<IP นั้น>"
}
echo
echo "   ดูการทำงาน:  journalctl -u $SERVICE -f"
echo "  ----------------------------------------------------------"
echo
