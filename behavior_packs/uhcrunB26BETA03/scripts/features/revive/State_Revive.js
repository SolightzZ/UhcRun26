import { system } from '@minecraft/server';

// ไอเทมหัวผู้เล่นสำหรับ revive
export const REVIVE_ITEM_ID = 'minecraft:player_head';
// ระยะเวลาชุบ 30 วิ (600 ticks)
export const REVIVE_DURATION_TICKS = 30 * 20;
// คูลดาวน์ 30 วิ
export const REVIVE_COOLDOWN_TICKS = 30 * 20;
// ระยะที่ถือว่าเคลื่อนที่ = ยกเลิก
export const REVIVE_CANCEL_MOVE_DISTANCE = 1;
// ความถี่อัปเดต actionbar 10 ticks
export const REVIVE_ACTIONBAR_INTERVAL = 10;

// target id -> session ผู้ถูกชุบ
export const reviveSessions = new Map();
// reviver id -> session ผู้ชุบ
export const reviverSessions = new Map();
// reviver id -> tick ที่ revive ล่าสุด
export const reviverCooldown = new Map();
export let reviveIntervalId = null;

export function setReviveIntervalId(id) {
   reviveIntervalId = id;
}

// หยุด tick revive ถ้าไม่มี session
export function stopReviveTickIfIdle() {
   if (reviveSessions.size > 0) return;
   if (reviveIntervalId === null) return;
   system.clearRun(reviveIntervalId);
   setReviveIntervalId(null);
}

// ล้าง state revive ทั้งหมด
export function clearAllReviveRuntime() {
   reviveSessions.clear();
   reviverSessions.clear();
   reviverCooldown.clear();
   stopReviveTickIfIdle();
}
