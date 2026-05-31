import { system } from '@minecraft/server';
import { handlerHit } from '../Manager/StatsManager.js';

system.runInterval(handlerHit, 200);
