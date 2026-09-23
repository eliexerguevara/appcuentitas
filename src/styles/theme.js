// src/styles/theme.js
// Colores del nuevo diseño. Cada color tiene un significado fijo:
// verde = te sobra / entra, rojo = te pasaste / sale, azul = acción, ámbar = atención.
import { Platform } from 'react-native';

export const theme = {
  bg: '#f4f5f7',
  surface: '#ffffff',
  surfaceMuted: '#f1f2f5',
  border: '#e4e6eb',
  text: '#1f2328',
  textSecondary: '#5f6670',
  textMuted: '#9aa1ab',

  accent: '#3b5bdb',
  accentSoft: '#e7ecfd',
  success: '#2f9e44',
  successSoft: '#e6f4ea',
  danger: '#e03131',
  dangerSoft: '#fdecec',
  warning: '#e8890c',
  warningSoft: '#fff4e0',

  // Tarjetas de la billetera
  cardCuenta: '#185FA5',
  cardCuentaSoft: '#B5D4F4',
  cardTarjeta: '#3C3489',
  cardTarjetaSoft: '#CECBF6',
  cardDeuda: '#993C1D',
  cardDeudaSoft: '#F5C4B3',

  radius: 14,
};

export const shadow = Platform.select({
  web: { boxShadow: '0 1px 3px rgba(16,24,40,0.08)' },
  default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
});

// Ícono (Ionicons) para cada categoría
const ICONOS_CATEGORIA = {
  HOGAR: 'home-outline',
  SALUD: 'medkit-outline',
  COMIDA: 'cart-outline',
  ROPA: 'shirt-outline',
  OCIO: 'game-controller-outline',
  TRANSPORTE: 'car-outline',
  SERVICIOS: 'flash-outline',
  'EDUCACIÓN': 'school-outline',
  'REGALO/CONTRIBUCIÓN': 'gift-outline',
  'IMPUESTOS/TRÁMITES': 'document-text-outline',
  'INVERSIÓN': 'trending-up-outline',
  'ING/CAMBIO': 'swap-horizontal-outline',
  TRANSFERENCIA: 'swap-horizontal-outline',
  COMISIONES: 'receipt-outline',
  AHORRO: 'wallet-outline',
  OTROS: 'ellipsis-horizontal-circle-outline',
};

export const iconoCategoria = (categoria) => ICONOS_CATEGORIA[categoria] || 'pricetag-outline';

// Nombre legible de la categoría ("REGALO/CONTRIBUCIÓN" → "Regalo/contribución")
export const nombreCategoria = (categoria = '') =>
  categoria.charAt(0) + categoria.slice(1).toLowerCase();
