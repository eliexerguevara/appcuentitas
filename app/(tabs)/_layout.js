import { Tabs, useRouter } from 'expo-router';
import { TouchableOpacity, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../src/styles/theme';

// Si una pantalla falla, se muestra un mensaje en vez de dejar la página en blanco.
export function ErrorBoundary({ error, retry }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: theme.bg }}>
      <Ionicons name="sad-outline" size={44} color={theme.textMuted} />
      <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginVertical: 8 }}>Algo salió mal en esta pantalla</Text>
      <Text style={{ fontSize: 13, color: theme.textSecondary, textAlign: 'center', marginBottom: 20 }}>{error?.message}</Text>
      <TouchableOpacity onPress={retry} style={{ backgroundColor: theme.accent, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 }}>
        <Text style={{ color: 'white', fontWeight: '600' }}>Reintentar</Text>
      </TouchableOpacity>
    </View>
  );
}

const icono = (nombre) => ({ color, focused }) => (
  <Ionicons name={focused ? nombre : `${nombre}-outline`} size={22} color={color} />
);

export default function TabLayout() {
  const router = useRouter();

  // Pantallas que se abren desde "Más": tienen flecha para volver
  const pantallaSecundaria = (title) => ({
    title,
    href: null,
    headerLeft: () => (
      <TouchableOpacity
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/more'))}
        style={{ paddingHorizontal: 14 }}
      >
        <Ionicons name="arrow-back" size={22} color={theme.text} />
      </TouchableOpacity>
    ),
  });

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg, borderBottomWidth: 0, elevation: 0, shadowOpacity: 0 },
        headerTitleStyle: { fontSize: 20, fontWeight: '700', color: theme.text },
        headerTitleAlign: 'left',
        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border, height: 62, paddingBottom: 8, paddingTop: 6 },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Inicio', tabBarIcon: icono('home') }} />
      <Tabs.Screen name="transactions" options={{ title: 'Movimientos', tabBarIcon: icono('list') }} />
      <Tabs.Screen name="budget" options={{ title: 'Presupuesto', tabBarIcon: icono('pie-chart') }} />
      <Tabs.Screen name="accounts" options={{ title: 'Billetera', tabBarIcon: icono('wallet') }} />
      <Tabs.Screen name="more" options={{ title: 'Más', tabBarIcon: icono('ellipsis-horizontal-circle') }} />

      <Tabs.Screen name="savings" options={pantallaSecundaria('Ahorros')} />
      <Tabs.Screen name="summary" options={pantallaSecundaria('Resumen mensual')} />
      <Tabs.Screen name="household" options={pantallaSecundaria('Hogar compartido')} />
      <Tabs.Screen name="export" options={pantallaSecundaria('Exportar e importar')} />
    </Tabs>
  );
}
