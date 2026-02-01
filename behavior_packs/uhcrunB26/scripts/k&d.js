import { world, system } from "@minecraft/server";
import { dynamicToast } from "./message";
import { broadcast } from "./broadcast.js";

const TAG = {
  UHC: "uhc",
};

const SCORE = {
  KILLS: "kills",
  DEATHS: "deaths",
};

const lastAttacker = new Map();
const deathLocation = new Map();

const isPlayer = (e) => e?.typeId === "minecraft:player";
const isUHCPlayer = (p) => isPlayer(p) && p.hasTag(TAG.UHC);

function getObjective(id, name = id) {
  return world.scoreboard.getObjective(id) || world.scoreboard.addObjective(id, name);
}

function addScore(player, objectiveId) {
  const obj = getObjective(objectiveId);
  obj.addScore(player.scoreboardIdentity, 1);
}

function trackHit(attacker, victim) {
  if (!attacker || !victim) return;
  if (attacker.id === victim.id) return;
  lastAttacker.set(victim.id, attacker.id);
}

function recordDeathPoint(player) {
  const { x, y, z } = player.location;
  deathLocation.set(player.id, { x, y, z });
}

function teleportToDeathPoint(player) {
  const loc = deathLocation.get(player.id);
  if (!loc) return;

  player.teleport({ x: loc.x + 0.5, y: loc.y, z: loc.z + 0.5 }, { dimension: player.dimension });

  deathLocation.delete(player.id);
}

function announceKill(killer, victim) {
  world.sendMessage(dynamicToast(`${killer.nameTag} killed ${victim.nameTag}`, "textures/items/dye_powder_red"));

  broadcast({
    message: `${killer.nameTag} §cFirst kill!`,
    title: "§cFirst Kill!",
    subtitle: killer.nameTag,
    sound: "mob.wither.spawn",
  });
}

function handleKill(killer, victim) {
  addScore(killer, SCORE.KILLS);
  announceKill(killer, victim);
}

function handleDeath(player) {
  addScore(player, SCORE.DEATHS);
  lastAttacker.delete(player.id);
}

function onEntityHurt(e) {
  const { damagingEntity, hurtEntity } = e.damageSource ?? {};
  if (!isUHCPlayer(damagingEntity)) return;
  if (!isUHCPlayer(hurtEntity)) return;
  trackHit(damagingEntity, hurtEntity);
}

function onEntityDie(e) {
  const victim = e.deadEntity;
  if (!isUHCPlayer(victim)) return;

  recordDeathPoint(victim);
  victim.runCommand("function sets/sets");

  const killerId = lastAttacker.get(victim.id);
  const killer = world.getAllPlayers().find((p) => p.id === killerId);

  if (killer) handleKill(killer, victim);
  handleDeath(victim);
}

function onPlayerSpawn(e) {
  teleportToDeathPoint(e.player);
}

function onScriptCommand(e) {
  if (e.id !== "kd:clear") return;
  lastAttacker.clear();
  deathLocation.clear();
  console.warn("[KD] Tracking data cleared.");
}

/* ================= SUBSCRIBE ================= */

world.afterEvents.entityHurt.subscribe(onEntityHurt);
world.afterEvents.entityDie.subscribe(onEntityDie);
world.afterEvents.playerSpawn.subscribe(onPlayerSpawn);
system.afterEvents.scriptEventReceive.subscribe(onScriptCommand);
