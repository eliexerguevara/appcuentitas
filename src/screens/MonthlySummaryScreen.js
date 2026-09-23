import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  RefreshControl
} from 'react-native';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import { formatCurrency } from '../utils/formatters';

export default function MonthlySummaryScreen() {
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [savings, setSavings] = useState({ pesos: 0, usd: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7) // YYYY-MM
  );

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  const loadData = async () => {
    if (!auth.currentUser) return;

    try {
      const userId = auth.currentUser.uid;
      
      // Cargar cuentas
      const accountsSnapshot = await getDocs(collection(db, 'users', userId, 'accounts'));
      const accountsData = accountsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAccounts(accountsData);

      // Cargar transacciones del mes seleccionado
      const [year, month] = selectedMonth.split('-');
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      
      const transactionsRef = collection(db, 'users', userId, 'transactions');
      const q = query(
        transactionsRef,
        where('fecha', '>=', startDate.toISOString().split('T')[0]),
        where('fecha', '<=', endDate.toISOString().split('T')[0])
      );
      
      const transactionsSnapshot = await getDocs(q);
      const transactionsData = transactionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(transactionsData);

    } catch (error) {
      console.error('Error cargando datos:', error);
      Alert.alert('Error', 'No se pudieron cargar los datos del mes');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const generateResume = () => {
    const [year, month] = selectedMonth.split('-');
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    let totalIngresos = 0;
    let totalEgresos = 0;
    const gastosPorCategoria = {};
    const ingresosPorCategoria = {};

    transactions.forEach(trans => {
      if (trans.tipo === 'ingreso') {
        totalIngresos += trans.monto;
        ingresosPorCategoria[trans.categoria] = (ingresosPorCategoria[trans.categoria] || 0) + trans.monto;
      } else if (trans.tipo === 'egreso' || trans.tipo === 'pago_tarjeta') {
        totalEgresos += trans.monto;
        gastosPorCategoria[trans.categoria] = (gastosPorCategoria[trans.categoria] || 0) + trans.monto;
      }
    });

    const balance = totalIngresos - totalEgresos;

    return {
      monthName: monthNames[parseInt(month) - 1],
      year,
      totalIngresos,
      totalEgresos,
      balance,
      gastosPorCategoria,
      ingresosPorCategoria,
      transactionCount: transactions.length
    };
  };

  const { 
    monthName, 
    year, 
    totalIngresos, 
    totalEgresos, 
    balance, 
    gastosPorCategoria,
    ingresosPorCategoria,
    transactionCount 
  } = generateResume();

  const exportResume = () => {
    Alert.alert(
      'Exportar Resumen',
      'Esta funcionalidad exportaría el resumen a Excel. En una app nativa, podrías usar librerías como react-native-xlsx.',
      [{ text: 'OK' }]
    );
  };

  const showCharts = () => {
    Alert.alert(
      'Gráficos del Mes',
      'Aquí se mostrarían gráficos interactivos del mes seleccionado.',
      [{ text: 'OK' }]
    );
  };

  // Generar años para el selector (últimos 5 años)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.title}>Resumen Mensual</Text>

      {/* Selector de Mes */}
      <View style={styles.selector}>
        <Text style={styles.selectorLabel}>Seleccionar Mes:</Text>
        <View style={styles.pickerRow}>
          <View style={styles.pickerContainer}>
            <Text style={styles.pickerLabel}>Año</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.pickerOptions}>
                {years.map(year => (
                  <TouchableOpacity
                    key={year}
                    style={[
                      styles.pickerOption,
                      selectedMonth.startsWith(year.toString()) && styles.pickerOptionActive
                    ]}
                    onPress={() => setSelectedMonth(`${year}-${selectedMonth.split('-')[1]}`)}
                  >
                    <Text style={[
                      styles.pickerOptionText,
                      selectedMonth.startsWith(year.toString()) && styles.pickerOptionTextActive
                    ]}>
                      {year}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.pickerContainer}>
            <Text style={styles.pickerLabel}>Mes</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.pickerOptions}>
                {months.map(month => {
                  const monthStr = month.toString().padStart(2, '0');
                  const isActive = selectedMonth.endsWith(monthStr);
                  return (
                    <TouchableOpacity
                      key={month}
                      style={[styles.pickerOption, isActive && styles.pickerOptionActive]}
                      onPress={() => setSelectedMonth(`${selectedMonth.split('-')[0]}-${monthStr}`)}
                    >
                      <Text style={[
                        styles.pickerOptionText,
                        isActive && styles.pickerOptionTextActive
                      ]}>
                        {month}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </View>

      {/* Resumen Principal */}
      <View style={styles.resumeCard}>
        <View style={styles.resumeHeader}>
          <Text style={styles.resumeTitle}>Resumen de {monthName} {year}</Text>
          <Text style={styles.resumeSubtitle}>{transactionCount} transacciones</Text>
        </View>

        <View style={styles.summaryGrid}>
          <View style={[styles.summaryItem, styles.incomeCard]}>
            <Text style={styles.summaryLabel}>Ingresos</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totalIngresos)}</Text>
          </View>
          <View style={[styles.summaryItem, styles.expenseCard]}>
            <Text style={styles.summaryLabel}>Egresos</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totalEgresos)}</Text>
          </View>
          <View style={[styles.summaryItem, styles.balanceCard]}>
            <Text style={styles.summaryLabel}>Balance</Text>
            <Text style={[styles.summaryValue, { color: balance >= 0 ? '#28a745' : '#dc3545' }]}>
              {formatCurrency(balance)}
            </Text>
          </View>
        </View>

        {/* Gastos por Categoría */}
        {Object.keys(gastosPorCategoria).length > 0 && (
          <View style={styles.categorySection}>
            <Text style={styles.sectionTitle}>📊 Gastos por Categoría</Text>
            {Object.entries(gastosPorCategoria)
              .sort(([,a], [,b]) => b - a)
              .map(([categoria, monto]) => {
                const porcentaje = ((monto / totalEgresos) * 100).toFixed(1);
                return (
                  <View key={categoria} style={styles.categoryItem}>
                    <View style={styles.categoryInfo}>
                      <Text style={styles.categoryName}>{categoria}</Text>
                      <Text style={styles.categoryPercentage}>{porcentaje}%</Text>
                    </View>
                    <Text style={styles.categoryAmount}>{formatCurrency(monto)}</Text>
                  </View>
                );
              })}
          </View>
        )}

        {/* Ingresos por Categoría */}
        {Object.keys(ingresosPorCategoria).length > 0 && (
          <View style={styles.categorySection}>
            <Text style={styles.sectionTitle}>💰 Ingresos por Categoría</Text>
            {Object.entries(ingresosPorCategoria)
              .sort(([,a], [,b]) => b - a)
              .map(([categoria, monto]) => {
                const porcentaje = ((monto / totalIngresos) * 100).toFixed(1);
                return (
                  <View key={categoria} style={styles.categoryItem}>
                    <View style={styles.categoryInfo}>
                      <Text style={styles.categoryName}>{categoria}</Text>
                      <Text style={styles.categoryPercentage}>{porcentaje}%</Text>
                    </View>
                    <Text style={styles.categoryAmount}>{formatCurrency(monto)}</Text>
                  </View>
                );
              })}
          </View>
        )}

        {/* Estado de Cuentas */}
        <View style={styles.accountsSection}>
          <Text style={styles.sectionTitle}>💳 Estado de Cuentas</Text>
          {accounts.map(account => (
            <View key={account.id} style={styles.accountItem}>
              <View>
                <Text style={styles.accountName}>{account.nombre}</Text>
                <Text style={styles.accountType}>
                  {account.tipo === 'caja' ? 'Caja de Ahorro' : 'Tarjeta de Crédito'}
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

        {/* Ahorros */}
        <View style={styles.savingsSection}>
          <Text style={styles.sectionTitle}>💰 Ahorros</Text>
          <View style={styles.savingsItem}>
            <Text style={styles.savingsLabel}>Pesos (ARS)</Text>
            <Text style={[styles.savingsAmount, { color: '#28a745' }]}>
              {formatCurrency(savings.pesos)}
            </Text>
          </View>
          <View style={styles.savingsItem}>
            <Text style={styles.savingsLabel}>Dólares (USD)</Text>
            <Text style={[styles.savingsAmount, { color: '#17a2b8' }]}>
              ${savings.usd.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Botones de Acción */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={exportResume}>
            <Text style={styles.actionButtonText}>📊 Exportar Resumen</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.chartButton]} onPress={showCharts}>
            <Text style={styles.actionButtonText}>📈 Ver Gráficos</Text>
          </TouchableOpacity>
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  selector: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectorLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 15,
  },
  pickerContainer: {
    flex: 1,
  },
  pickerLabel: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 8,
  },
  pickerOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  pickerOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#dee2e6',
  },
  pickerOptionActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  pickerOptionText: {
    fontSize: 14,
    color: '#495057',
    fontWeight: '600',
  },
  pickerOptionTextActive: {
    color: 'white',
  },
  resumeCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resumeHeader: {
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: '#dee2e6',
  },
  resumeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  resumeSubtitle: {
    fontSize: 14,
    color: '#6c757d',
    marginTop: 5,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  summaryItem: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  incomeCard: {
    backgroundColor: '#28a745',
  },
  expenseCard: {
    backgroundColor: '#dc3545',
  },
  balanceCard: {
    backgroundColor: '#667eea',
  },
  summaryLabel: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 5,
  },
  summaryValue: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  categorySection: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  categoryPercentage: {
    fontSize: 12,
    color: '#6c757d',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  categoryAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  accountsSection: {
    marginBottom: 25,
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
  savingsSection: {
    marginBottom: 25,
  },
  savingsItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  savingsLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  savingsAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#28a745',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  chartButton: {
    backgroundColor: '#6f42c1',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});