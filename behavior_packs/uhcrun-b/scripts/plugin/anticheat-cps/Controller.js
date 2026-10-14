import { system } from '@minecraft/server';
import model from './Model.js';
import service from './Service.js';

class Controller {
   onPlayerLeave = ({ playerId }) => {
      model.playerState.delete(playerId);
      model.adminPlayers.delete(playerId);
   };

   onPlayerSpawn = (event) => {
      const player = event.player;
      if (!player?.isValid) return;
      if (player.hasTag('admin')) {
         model.adminPlayers.set(player.id, player);
      }
   };

   onEntityHitEntity = (event) => {
      const attacker = event.damagingEntity;
      if (!attacker?.isValid || attacker.typeId !== 'minecraft:player') return;

      const currentTick = system.currentTick;
      const playerId = attacker.id;

      let data = model.playerState.get(playerId);
      if (!data) {
         data = model.createPlayerData();
         model.playerState.set(playerId, data);
      }

      data.buf[data.head] = currentTick & 0xff;
      data.head = (data.head + 1) % model.BUF_SIZE;
      if (data.count < model.BUF_SIZE) data.count++;

      const cps = service.countRecentHits(data, currentTick);

      if (cps >= model.HARD_LIMIT) {
         service.kickPlayer(attacker, cps);
         data.buf.fill(0);
         data.head = 0;
         data.count = 0;
         return;
      }

      if (cps >= model.MAX_CPS) {
         if (currentTick - data.lastWarnTick >= 20) {
            data.lastWarnTick = currentTick;
            service.warnPlayer(attacker, cps);
            service.alertAdmins(attacker, cps);
         }
      }
   };
}

export default new Controller();
