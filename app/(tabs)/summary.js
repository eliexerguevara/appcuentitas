import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import { ensureHousehold, dataCol, dataDoc } from '../../src/services/household';
import { formatCurrency } from '../../src/utils/formatters';
import { globalStyles, colors } from '../../src/styles/global';
import {
  addMonths,
  cuotasDelMes,
  currentMonthKey,
  monthKey,
  monthLabel,
  monthStats,
  proyeccionCuotas,
  recomendaciones,
} from '../../src/utils/finance';
import MonthPicker from '../../src/components/MonthPicker';
import Recommendations from '../../src/components/Recommendations';

export default function SummaryScreen() {
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [savings, setSavings] = useState({ pesos: 0, usd: 0 });
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    if (!auth.currentUser) return;

    try {
      await ensureHousehold();

      const [accountsSnapshot, transactionsSnapshot, savingsDoc] = await Promise.all([
        getDocs(dataCol('accounts')),
        getDocs(dataCol('transactions')),
        getDoc(dataDoc('data', 'savings')),
      ]);
      setAccounts(accountsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setTransactions(transactionsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      if (savingsDoc.exists()) {
        setSavings(savingsDoc.data());
      }

    } catch (error) {
      console.error('Error cargando datos:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const stats = monthStats(transactions, selectedMonth);
  const anterior = monthStats(transactions, addMonths(selectedMonth, -1));
  const monthTransactions = transactions.filter(t => monthKey(t.fecha) === selectedMonth);
  const cuotasMes = cuotasDelMes(transactions, selectedMonth);
  const totalTarjetasMes = cuotasMes.reduce((s, t) => s + t.montoMes, 0);
  const proyeccion = proyeccionCuotas(transactions, addMonths(selectedMonth, 1), 6);
  const recs = recomendaciones(transactions, accounts, selectedMonth, savings);
  const nombreCuenta = (id) => accounts.find(a => a.id === id)?.nombre || '';

  const anteriorPorCategoria = Object.fromEntries(anterior.porCategoria.map(c => [c.categoria, c.monto]));
  const variacion = (actual, previo) => {
    if (!previo) return null;
    const v = Math.round((actual / previo - 1) * 100);
    return v === 0 ? null : v;
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.title}>Resumen Mensual</Text>

      <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />

      {/* Resumen general */}
      <View style={globalStyles.card}>
        <View style={styles.resumeHeader}>
          <Text style={styles.resumeTitle}>{monthLabel(selectedMonth)}</Text>
          <Text style={styles.transactionCount}>
            {monthTransactions.length} transacciones
          </Text>
        </View>

        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCard, styles.incomeCard]}>
            <Text style={styles.summaryTitle}>Ingresos</Text>
            <Text style={styles.summaryAmount}>{formatCurrency(stats.ingresos)}</Text>
          </View>
          <View style={[styles.summaryCard, styles.expenseCard]}>
            <Text style={styles.summaryTitle}>Gastos del hogar</Text>
            <Text style={styles.summaryAmount}>{formatCurrency(stats.gastos)}</Text>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCard, styles.savingCard]}>
            <Text style={styles.summaryTitle}>Ahorrado</Text>
            <Text style={styles.summaryAmount}>{formatCurrency(stats.ahorro)}</Text>
          </View>
          <View style={[styles.summaryCard, styles.balanceCard]}>
            <Text style={styles.summaryTitle}>Queda libre</Text>
            <Text style={styles.summaryAmount}>{formatCurrency(stats.balance)}</Text>
          </View>
        </View>

        {stats.ingresos > 0 && (
          <Text style={styles.ratio}>
            Gastaron el {Math.round((stats.gastos / stats.ingresos) * 100)}% y ahorraron el {Math.round((stats.ahorro / stats.ingresos) * 100)}% de los ingresos.
          </Text>
        )}
        {variacion(stats.gastos, anterior.gastos) !== null && (
          <Text style={styles.ratio}>
            Gastos {variacion(stats.gastos, anterior.gastos) > 0 ? '↑' : '↓'} {Math.abs(variacion(stats.gastos, anterior.gastos))}% vs {monthLabel(addMonths(selectedMonth, -1))}.
          </Text>
        )}
        {(stats.transferencias > 0 || stats.pagosTarjeta > 0) && (
          <Text style={styles.footnote}>
            No cuentan como gasto: transferencias entre cuentas {formatCurrency(stats.transferencias)} • pagos de tarjeta {formatCurrency(stats.pagosTarjeta)}
          </Text>
        )}
      </View>

      <Recommendations items={recs} />

      {/* Gastos por categoría */}
      {stats.porCategoria.length > 0 && (
        <View style={globalStyles.card}>
          <Text style={styles.sectionTitle}>📊 Gastos por Categoría</Text>
          {stats.porCategoria.map((item) => {
            const porcentaje = stats.gastos > 0 ? (item.monto / stats.gastos) * 100 : 0;
            const v = variacion(item.monto, anteriorPorCategoria[item.categoria]);
            return (
              <View key={item.categoria} style={styles.categoryItem}>
                <View style={styles.categoryInfo}>
                  <Text style={styles.categoryName}>{item.categoria}</Text>
                  <Text style={styles.categoryAmount}>{formatCurrency(item.monto)}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${porcentaje}%` }]} />
                </View>
                <View style={styles.categoryInfo}>
                  <Text style={styles.categoryPercentage}>{porcentaje.toFixed(1)}% del gasto</Text>
                  {v !== null && (
                    <Text style={[styles.categoryPercentage, { color: v > 0 ? colors.danger : colors.success }]}>
                      {v > 0 ? '↑' : '↓'} {Math.abs(v)}% vs mes anterior
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Tarjetas: lo que se paga este mes */}
      {cuotasMes.length > 0 && (
        <View style={globalStyles.card}>
          <Text style={styles.sectionTitle}>💳 Tarjetas a pagar en {monthLabel(selectedMonth)}</Text>
          {cuotasMes.map(t => (
            <View key={t.id} style={styles.accountItem}>
              <View style={styles.accountInfo}>
                <Text style={styles.accountName}>{t.descripcion}</Text>
                <Text style={styles.accountType}>
                  {nombreCuenta(t.cuentaId)} • {(t.cuotas || 1) > 1 ? `Cuota ${t.numeroCuota}/${t.cuotas}` : '1 pago'}
                </Text>
              </View>
              <Text style={styles.accountBalance}>{formatCurrency(t.montoMes)}</Text>
            </View>
          ))}
          <View style={[styles.accountItem, { borderBottomWidth: 0 }]}>
            <Text style={[styles.accountName, { flex: 1 }]}>Total</Text>
            <Text style={[styles.accountBalance, { color: colors.danger }]}>{formatCurrency(totalTarjetasMes)}</Text>
          </View>
        </View>
      )}

      {/* Proyección */}
      {proyeccion.some(p => p.total > 0) && (
        <View style={globalStyles.card}>
          <Text style={styles.sectionTitle}>📅 Cuotas ya comprometidas</Text>
          {proyeccion.map(p => (
            <View key={p.key} style={styles.accountItem}>
              <Text style={[styles.accountName, { flex: 1 }]}>{monthLabel(p.key)}</Text>
              <Text style={styles.accountBalance}>{formatCurrency(p.total)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Ingresos por categoría */}
      {stats.ingresosPorCategoria.length > 0 && (
        <View style={globalStyles.card}>
          <Text style={styles.sectionTitle}>💰 Ingresos por Categoría</Text>
          {stats.ingresosPorCategoria.map((item) => {
            const porcentaje = stats.ingresos > 0 ? ((item.monto / stats.ingresos) * 100).toFixed(1) : 0;
            return (
              <View key={item.categoria} style={styles.accountItem}>
                <Text style={[styles.accountName, { flex: 1 }]}>{item.categoria}</Text>
                <Text style={styles.categoryPercentage}>{porcentaje}%  </Text>
                <Text style={styles.accountBalance}>{formatCurrency(item.monto)}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Mensaje si no hay transacciones */}
      {monthTransactions.length === 0 && cuotasMes.length === 0 && (
        <View style={globalStyles.card}>
          <Text style={styles.emptyText}>
            No hay transacciones registradas para {monthLabel(selectedMonth)}
          </Text>
        </View>
      )}
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
    marginBottom: 15,
    textAlign: 'center',
  },
  resumeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#dee2e6',
  },
  resumeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  transactionCount: {
    fontSize: 14,
    color: '#666',
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  summaryCard: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  incomeCard: {
    backgroundColor: colors.success,
  },
  expenseCard: {
    backgroundColor: colors.danger,
  },
  savingCard: {
    backgroundColor: colors.info,
  },
  balanceCard: {
    backgroundColor: colors.primary,
  },
  summaryTitle: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 5,
  },
  summaryAmount: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
  },
  ratio: {
    fontSize: 13,
    color: '#444',
    marginTop: 4,
  },
  footnote: {
    fontSize: 11,
    color: '#999',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  categoryItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categoryInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  categoryPercentage: {
    fontSize: 12,
    color: '#666',
  },
  categoryAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  barTrack: {
    height: 8,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    overflow: 'hidden',
    marginVertical: 6,
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  accountItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  accountType: {
    fontSize: 12,
    color: '#666',
  },
  accountBalance: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
});
