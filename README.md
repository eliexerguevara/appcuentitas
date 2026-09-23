# Cuentitas

App para organizar las finanzas del hogar entre dos personas: cuentas, tarjetas de crédito con cuotas, deudas personales, ahorro con meta anual y recomendaciones.

Publicada en **https://cuentitas-b57b4.web.app**

## Funciones

- **Transacciones:** ingresos, gastos, transferencias entre cuentas (desde tarjeta, con comisión), pagos de tarjeta/deuda y movimientos de ahorro (guardar / retirar).
- **Tarjetas de crédito:** límite, deuda, disponible, compras en cuotas y proyección mes a mes.
- **Deudas personales:** seguimiento de lo pagado y lo pendiente; al terminar de pagarse desaparecen de la lista.
- **Ahorros:** saldo en pesos y dólares, compra/venta de USD y meta anual que calcula cuánto ahorrar cada mes y se recalcula con cada movimiento.
- **Resumen e Inicio:** consumo del hogar por categoría (sin transferencias, pagos de tarjeta ni ahorro) y recomendaciones según ingresos y gastos.
- **Hogar compartido:** varias cuentas de usuario ven y cargan los mismos datos, mediante un código de invitación.
- **Exportar / importar** a Excel.

## Tecnología

- [Expo](https://expo.dev) + Expo Router (React Native, también compilado para web)
- Firebase Authentication, Cloud Firestore y Firebase Hosting

## Estructura

```
app/                 Pantallas (Expo Router)
  (tabs)/            Inicio, Transacciones, Cuentas, Ahorros, Resumen, Exportar, Hogar
src/utils/finance.js Cálculos: consumo, cuotas, tarjetas, metas y recomendaciones
src/services/        Hogar compartido (de dónde se leen los datos)
src/components/      Componentes reutilizables
firebase/config.js   Configuración del proyecto Firebase
firestore.rules      Reglas de seguridad de Firestore
```

## Desarrollo

```bash
npm install
npx expo start
```

## Publicar

```bash
npx expo export -p web
firebase deploy --only hosting
```

Para publicar también las reglas de seguridad: `firebase deploy --only firestore:rules,hosting`.

## App para Android (APK)

La carpeta `android-twa/` es una app Android mínima que abre la web publicada a pantalla completa usando Chrome (Trusted Web Activity). Al publicar cambios en la web, la app se actualiza sola.

- La clave de firma **no está en el repositorio**: se guarda en `../CuentitasAndroid-firma/` (hacer copia de seguridad).
- El sitio publica `/.well-known/assetlinks.json` (en `public/`) para que Android confíe en la app y la abra sin barra de dirección.

Para compilar (con el JDK de Android Studio):

```bash
cd android-twa
gradlew.bat assembleRelease
```

El APK queda en `android-twa/app/build/outputs/apk/release/app-release.apk`.
