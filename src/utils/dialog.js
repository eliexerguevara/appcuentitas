// src/utils/dialog.js
// Reemplazo de Alert de react-native que también funciona en la web.
// En react-native-web, Alert.alert no hace nada, por eso los mensajes y
// confirmaciones (ej: "¿Eliminar?") no aparecían en la versión web.
import { Alert as RNAlert, Platform } from 'react-native';

export const Alert = {
  alert: (title, message, buttons) => {
    if (Platform.OS !== 'web') {
      RNAlert.alert(title, message, buttons);
      return;
    }

    const text = [title, message].filter(Boolean).join('\n\n');
    const actions = (buttons || []).filter(b => b.style !== 'cancel');
    const cancel = (buttons || []).find(b => b.style === 'cancel');

    // Solo informativo
    if (!buttons || buttons.length === 0 || !cancel) {
      window.alert(text);
      if (actions[0]?.onPress) actions[0].onPress();
      return;
    }

    // Confirmación: Aceptar ejecuta la primera acción no-cancelar
    if (window.confirm(text)) {
      actions[0]?.onPress?.();
    } else {
      cancel.onPress?.();
    }
  }
};
