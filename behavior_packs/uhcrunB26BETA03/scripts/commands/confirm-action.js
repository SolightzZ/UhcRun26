import { MessageFormData } from '@minecraft/server-ui';
import { logError } from '../shared/Util.js';

export function confirmAction(player, title, body, onConfirm) {
   if (!player?.isValid) return;
   new MessageFormData()
      .title(title)
      .body(body)
      .button1('§cCancel')
      .button2('Confirm')

      .show(player)
      .then((response) => {
         if (response?.canceled || response?.selection !== 1) {
            return;
         }
         onConfirm();
      })
      .catch((error) => {
         logError('Confirm', 'Form failed', error);
      });
}
