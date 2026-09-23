import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase/config';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import TransactionsScreen from './src/screens/TransactionsScreen';
import AccountsScreen from './src/screens/AccountsScreen';
import SavingsScreen from './src/screens/SavingsScreen';
import MonthlySummaryScreen from './src/screens/MonthlySummaryScreen';
import ImportExportScreen from './src/screens/ImportExportScreen';

// Components
import Loader from './src/components/Loader';

const Tab = createBottomTabNavigator();

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return <Loader />;
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          tabBarStyle: { backgroundColor: '#1a1a1a' },
          tabBarActiveTintColor: '#667eea',
          tabBarInactiveTintColor: '#999',
        }}
      >
        <Tab.Screen 
          name="Dashboard" 
          component={DashboardScreen}
          options={{ tabBarIcon: ({ color }) => '📊' }}
        />
        <Tab.Screen 
          name="Transacciones" 
          component={TransactionsScreen}
          options={{ tabBarIcon: ({ color }) => '💸' }}
        />
        <Tab.Screen 
          name="Cuentas" 
          component={AccountsScreen}
          options={{ tabBarIcon: ({ color }) => '💳' }}
        />
        <Tab.Screen 
          name="Ahorros" 
          component={SavingsScreen}
          options={{ tabBarIcon: ({ color }) => '💰' }}
        />
        <Tab.Screen 
          name="Resumen" 
          component={MonthlySummaryScreen}
          options={{ tabBarIcon: ({ color }) => '📅' }}
        />
        <Tab.Screen 
          name="Exportar" 
          component={ImportExportScreen}
          options={{ tabBarIcon: ({ color }) => '📥' }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}