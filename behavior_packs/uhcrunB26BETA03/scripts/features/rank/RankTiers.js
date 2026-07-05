const TIER_CONFIG = [
   { name: 'Unranked', color: '§7', minKD: -Infinity },
   { name: 'Bronze', color: '§6', minKD: 0 },
   { name: 'Silver', color: '§f', minKD: 1.0 },
   { name: 'Gold', color: '§e', minKD: 2.0 },
   { name: 'Diamond', color: '§b', minKD: 3.0 },
   { name: 'Master', color: '§5', minKD: 4.0 },
];

export function calcKD(kills, deaths) {
   return deaths > 0 ? kills / deaths : kills;
}

export function getRankTier(kd, totalGames) {
   if (totalGames <= 0) return TIER_CONFIG[0];

   let tier = TIER_CONFIG[0];
   for (let i = 1; i < TIER_CONFIG.length; i++) {
      if (kd >= TIER_CONFIG[i].minKD) {
         tier = TIER_CONFIG[i];
      }
   }
   return tier;
}

// #1=5, #2=4, #3=3, #4=2, #5+=1
export function calcPlacementPoints(placement) {
   if (placement <= 1) return 5;
   if (placement === 2) return 4;
   if (placement === 3) return 3;
   if (placement === 4) return 2;
   return 1;
}
