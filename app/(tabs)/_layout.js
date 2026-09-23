import { Tabs } from 'expo-router';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { TouchableOpacity, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

// Si una pantalla falla, se muestra un mensaje en vez de dejar la página en blanco.
export function ErrorBoundary({ error, retry }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#f8f9fa' }}>
      <Text style={{ fontSize: 40, marginBottom: 10 }}>😕</Text>
      <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 8 }}>Algo salió mal en esta pantalla</Text>
      <Text style={{ fontSize: 13, color: '#666', textAlign: 'center', marginBottom: 20 }}>{error?.message}</Text>
      <TouchableOpacity onPress={retry} style={{ backgroundColor: '#667eea', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 }}>
        <Text style={{ color: 'white', fontWeight: '600' }}>Reintentar</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function TabLayout() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/');
    } catch (error) {
      console.error('Error cerrando sesión:', error);
    }
  };

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: '#1a1a1a' },
        tabBarActiveTintColor: '#667eea',
        tabBarInactiveTintColor: '#999',
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => router.push('/household')} style={{ marginRight: 18 }}>
              <Text style={{ color: '#667eea', fontWeight: '600' }}>👥 Hogar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} style={{ marginRight: 15 }}>
              <Text style={{ color: '#dc3545', fontWeight: '600' }}>Salir</Text>
            </TouchableOpacity>
          </View>
        ),
      }}
    >
      <Tabs.Screen 
        name="dashboard" 
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color }) => <Text style={{ color }}>📊</Text>,
        }}
      />
      <Tabs.Screen 
        name="transactions" 
        options={{
          title: 'Transacciones',
          tabBarIcon: ({ color }) => <Text style={{ color }}>💸</Text>,
        }}
      />
      <Tabs.Screen 
        name="accounts" 
        options={{
          title: 'Cuentas',
          tabBarIcon: ({ color }) => <Text style={{ color }}>💳</Text>,
        }}
      />
      <Tabs.Screen 
        name="savings" 
        options={{
          title: 'Ahorros',
          tabBarIcon: ({ color }) => <Text style={{ color }}>💰</Text>,
        }}
      />
      <Tabs.Screen 
        name="summary" 
        options={{
          title: 'Resumen',
          tabBarIcon: ({ color }) => <Text style={{ color }}>📅</Text>,
        }}
      />
      <Tabs.Screen
        name="household"
        options={{
          title: 'Hogar',
          href: null,
        }}
      />
      <Tabs.Screen 
        name="export" 
        options={{
          title: 'Exportar',
          tabBarIcon: ({ color }) => <Text style={{ color }}>📥</Text>,
        }}
      />
    </Tabs>
  );
}