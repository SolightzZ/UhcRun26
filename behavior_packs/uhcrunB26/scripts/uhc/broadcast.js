// ส่งข้อความ/เสียง/title ให้ผู้เล่นหลายคน แบบ function
// Minecraft Bedrock Script API v1.21.120+ @minecraft/server v2.4.0-beta

import { num } from "./config.js";

// ส่ง message, title, subtitle, sound, actionBar ให้ทุกคนใน list — O(players)
export async function say(players, opts) {
  const list = [];
  for (const p of players) {
    if (opts.message) list.push(p.sendMessage(opts.message));
    if (opts.title || opts.subtitle) {
      list.push(
        p.onScreenDisplay.setTitle(opts.title ?? "", {
          stayDuration: num.titleStay,
          fadeInDuration: num.titleFadeIn,
          fadeOutDuration: num.titleFadeOut,
          subtitle: opts.subtitle ?? "",
        })
      );
    }
    if (opts.sound) list.push(p.playSound(opts.sound, { volume: num.soundVol, pitch: num.soundPitch }));
    if (opts.actionBar) list.push(p.onScreenDisplay.setActionBar(opts.actionBar));
  }
  await Promise.all(list);
}
