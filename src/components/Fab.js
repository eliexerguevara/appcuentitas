import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme } from '../styles/theme';

// Botón flotante "+ Cargar" que lleva al formulario de Movimientos.
// `tipo` preselecciona el tipo de movimiento (egreso, ingreso, transferencia, ahorro...).
export default function Fab({ label = 'Cargar', tipo = 'egreso' }) {
  const router = useRouter();
  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => router.push({ pathname: '/transactions', params: { tipo, t: Date.now() } })}
      >
        <Ionicons name="add" size={22} color="white" />
        <Text style={styles.text}>{label}</Text>
      </TouchableOpacity>
    </View>
  );
}

// Accesos rápidos (Gasto, Ingreso, Mover, Ahorrar)
export function QuickActions() {
  const router = useRouter();
  const acciones = [
    { tipo: 'egreso', label: 'Gasto', icon: 'arrow-down', color: theme.danger },
    { tipo: 'ingreso', label: 'Ingreso', icon: 'arrow-up', color: theme.success },
    { tipo: 'transferencia', label: 'Mover', icon: 'swap-horizontal', color: theme.accent },
    { tipo: 'ahorro', label: 'Ahorrar', icon: 'wallet-outline', color: theme.warning },
  ];
  return (
    <View style={styles.quick}>
      {acciones.map(a => (
        <TouchableOpacity
          key={a.tipo}
          style={styles.quickItem}
          onPress={() => router.push({ pathname: '/transactions', params: { tipo: a.tipo, t: Date.now() } })}
        >
          <View style={styles.quickCircle}>
            <Ionicons name={a.icon} size={20} color={a.color} />
          </View>
          <Text style={styles.quickText}>{a.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 18,
    alignItems: 'center',
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.accent,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  text: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  quick: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  quickItem: {
    alignItems: 'center',
    width: 72,
  },
  quickCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  quickText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '500',
  },
});
