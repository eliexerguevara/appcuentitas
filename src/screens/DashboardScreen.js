import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl
} from 'react-native';
import { collection, getDocs } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import { formatCurrency } from '../utils/formatters';

export default function DashboardScreen() {
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [savings, setSavings] = useState({ pesos: 0, usd: 0 });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    if (!auth.currentUser) return;

    try {
      const userId = auth.currentUser.uid;
      
      // Cargar cuentas
      const accountsSnapshot = await getDocs(collection(db, 'users', userId, 'accounts'));
      const accountsData = accountsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAccounts(accountsData);

      // Cargar transacciones
      const transactionsSnapshot = await getDocs(collection(db, 'users', userId, 'transactions'));
      const transactionsData = transactionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(transactionsData);

    } catch (error) {
      console.error('Error cargando datos:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserData();
    setRefreshing(false);
  };

  const calculateTotals = () => {
    let balanceCaja = 0;
    let balanceCredito = 0;
    let totalIngresos = 0;
    let totalEgresos = 0;

    accounts.forEach(account => {
      if (account.tipo === 'caja') {
        balanceCaja += account.saldo;
      } else if (account.tipo === 'tarjeta') {
        balanceCredito += account.saldo;
      }
    });

    transactions.forEach(trans => {
      if (trans.tipo === 'ingreso') {
        totalIngresos += trans.monto;
      } else if (trans.tipo === 'egreso' || trans.tipo === 'pago_tarjeta') {
        totalEgresos += trans.monto;
      }
    });

    return { balanceCaja, balanceCredito, totalIngresos, totalEgresos };
  };

  const { balanceCaja, balanceCredito, totalIngresos, totalEgresos } = calculateTotals();

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.title}>Resumen General</Text>

      <View style={styles.grid}>
        <View style={[styles.card, styles.primaryCard]}>
          <Text style={styles.cardTitle}>Balance Caja</Text>
          <Text style={styles.balanceAmount}>{formatCurrency(balanceCaja)}</Text>
        </View>

        <View style={[styles.card, styles.warningCard]}>
          <Text style={styles.cardTitle}>Balance Crédito</Text>
          <Text style={styles.balanceAmount}>{formatCurrency(balanceCredito)}</Text>
        </View>

        <View style={[styles.card, styles.successCard]}>
          <Text style={styles.cardTitle}>Total Ingresos</Text>
          <Text style={styles.balanceAmount}>{formatCurrency(totalIngresos)}</Text>
        </View>

        <View style={[styles.card, styles.dangerCard]}>
          <Text style={styles.cardTitle}>Total Egresos</Text>
          <Text style={styles.balanceAmount}>{formatCurrency(totalEgresos)}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Resumen de Cuentas</Text>
        {accounts.map(account => (
          <View key={account.id} style={styles.accountItem}>
            <View>
              <Text style={styles.accountName}>{account.nombre}</Text>
              <Text style={styles.accountType}>
                {account.tipo === 'caja' ? '💳 Caja de Ahorro' : '💳 Tarjeta de Crédito'}
              </Text>
            </View>
            <Text style={[
              styles.accountBalance,
              { color: account.saldo >= 0 ? '#28a745' : '#dc3545' }
            ]}>
              {formatCurrency(account.saldo)}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ahorros</Text>
        <View style={styles.savingsGrid}>
          <View style={[styles.savingsCard, styles.successCard]}>
            <Text style={styles.savingsTitle}>Pesos (ARS)</Text>
            <Text style={styles.savingsAmount}>{formatCurrency(savings.pesos)}</Text>
          </View>
          <View style={[styles.savingsCard, styles.infoCard]}>
            <Text style={styles.savingsTitle}>Dólares (USD)</Text>
            <Text style={styles.savingsAmount}>${savings.usd.toFixed(2)}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  card: {
    width: '48%',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
  },
  primaryCard: {
    backgroundColor: '#667eea',
  },
  warningCard: {
    backgroundColor: '#ffc107',
  },
  successCard: {
    backgroundColor: '#28a745',
  },
  dangerCard: {
    backgroundColor: '#dc3545',
  },
  infoCard: {
    backgroundColor: '#17a2b8',
  },
  cardTitle: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
  },
  balanceAmount: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  section: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  accountItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  accountName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  accountType: {
    fontSize: 12,
    color: '#6c757d',
  },
  accountBalance: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  savingsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  savingsCard: {
    width: '48%',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  savingsTitle: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
  },
  savingsAmount: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});