import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { getHousehold } from '../../src/services/household';
import { Alert } from '../../src/utils/dialog';
import { theme, shadow } from '../../src/styles/theme';

export default function MoreScreen() {
  const router = useRouter();
  const [hogar, setHogar] = useState(null);

  useFocusEffect(
    React.useCallback(() => {
      if (auth.currentUser) getHousehold().then(setHogar).catch(() => setHogar(null));
    }, [])
  );

  const salir = () => Alert.alert('Cerrar sesión', '¿Querés salir de la app?', [
    { text: 'Cancelar', style: 'cancel' },
    {
      text: 'Salir',
      style: 'destructive',
      onPress: async () => {
        await signOut(auth);
        router.replace('/');
      },
    },
  ]);

  const opciones = [
    { icon: 'wallet-outline', titulo: 'Ahorros', sub: 'Meta de ahorro y dólares', ruta: '/savings' },
    { icon: 'calendar-outline', titulo: 'Resumen mensual', sub: 'Comparar meses y ver cuotas', ruta: '/summary' },
    {
      icon: 'people-outline',
      titulo: 'Hogar compartido',
      sub: hogar ? `${hogar.nombre} · ${(hogar.miembros || []).length} miembros` : 'Compartir los datos con tu pareja',
      ruta: '/household',
    },
    { icon: 'download-outline', titulo: 'Exportar e importar', sub: 'Excel de movimientos y cuentas', ruta: '/export' },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.profile, shadow]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(auth.currentUser?.email || '?').charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.email} numberOfLines={1}>{auth.currentUser?.email}</Text>
          <Text style={styles.sub}>{hogar ? `Hogar: ${hogar.nombre}` : 'Datos personales'}</Text>
        </View>
      </View>

      <View style={[styles.list, shadow]}>
        {opciones.map((o, i) => (
          <TouchableOpacity
            key={o.ruta}
            style={[styles.item, i < opciones.length - 1 && styles.itemBorder]}
            onPress={() => router.push(o.ruta)}
          >
            <View style={styles.icon}>
              <Ionicons name={o.icon} size={20} color={theme.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{o.titulo}</Text>
              <Text style={styles.sub}>{o.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={[styles.list, styles.item, shadow]} onPress={salir}>
        <View style={[styles.icon, { backgroundColor: theme.dangerSoft }]}>
          <Ionicons name="log-out-outline" size={20} color={theme.danger} />
        </View>
        <Text style={[styles.itemTitle, { color: theme.danger, flex: 1 }]}>Cerrar sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, padding: 16 },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    padding: 16,
    marginBottom: 16,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: theme.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: theme.accent },
  email: { fontSize: 15, fontWeight: '600', color: theme.text },
  sub: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  list: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    marginBottom: 16,
    overflow: 'hidden',
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: theme.border },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: theme.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: { fontSize: 15, fontWeight: '600', color: theme.text },
});
