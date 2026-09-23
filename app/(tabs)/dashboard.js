import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Dimensions
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import { ensureHousehold, dataCol, dataDoc } from '../../src/services/household';
import { formatCurrency } from '../../src/utils/formatters';
import { globalStyles, colors } from '../../src/styles/global';
import { PieChart } from 'react-native-chart-kit';
import {
  currentMonthKey,
  esMovimientoAhorro,
  infoTarjeta,
  monthLabel,
  monthStats,
  proyeccionCuotas,
  recomendaciones,
  TIPOS,
} from '../../src/utils/finance';
import MonthPicker from '../../src/components/MonthPicker';
import Recommendations from '../../src/components/Recommendations';
import CreditCardStatus from '../../src/components/CreditCardStatus';

const screenWidth = Math.min(Dimensions.get('window').width, 600);

const chartColors = [
  '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
  '#FF9F40', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#06B6D4', '#84CC16'
];

const getColorByIndex = (index) => chartColors[index % chartColors.length];

export default function DashboardScreen() {
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [savings, setSavings] = useState({ pesos: 0, usd: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [mes, setMes] = useState(currentMonthKey());

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

  const stats = monthStats(transactions, mes);
  const cajas = accounts.filter(a => a.tipo === 'caja');
  const tarjetas = accounts.filter(a => a.tipo === 'tarjeta');
  const enCuentas = cajas.reduce((s, a) => s + (a.saldo || 0), 0);
  const deudaTarjetas = tarjetas.reduce((s, a) => s + infoTarjeta(a).deuda, 0);
  const deudasPersonales = accounts
    .filter(a => a.tipo === 'deuda' && !a.finalizada)
    .reduce((s, a) => s + infoTarjeta(a).deuda, 0);
  const cotizacion = Number(savings.cotizacionUSD) || 1000;
  const ahorroTotal = (savings.pesos || 0) + (savings.usd || 0) * cotizacion;
  const patrimonio = enCuentas - deudaTarjetas - deudasPersonales + ahorroTotal;
  const recs = recomendaciones(transactions, accounts, mes, savings);
  const proyeccion = proyeccionCuotas(transactions, mes, 4);

  const ultimasTransacciones = [...transactions]
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
    .slice(0, 5);

  const pieChartData = stats.porCategoria.map((item, index) => ({
    name: '', // Dejamos vacío para evitar texto superpuesto
    population: item.monto,
    color: getColorByIndex(index),
    legendFontColor: '#333',
    legendFontSize: 11
  }));

  const maxProyeccion = Math.max(1, ...proyeccion.map(p => p.total));

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.title}>📊 Resumen</Text>
      <MonthPicker value={mes} onChange={setMes} />

      {/* Tarjetas de resumen del mes */}
      <View style={styles.grid}>
        <View style={[globalStyles.card, styles.tile, { backgroundColor: colors.success }]}>
          <Text style={styles.cardTitle}>Ingresos</Text>
          <Text style={styles.cardAmount}>{formatCurrency(stats.ingresos)}</Text>
        </View>
        <View style={[globalStyles.card, styles.tile, { backgroundColor: colors.danger }]}>
          <Text style={styles.cardTitle}>Gastos del hogar</Text>
          <Text style={styles.cardAmount}>{formatCurrency(stats.gastos)}</Text>
        </View>
        <View style={[globalStyles.card, styles.tile, { backgroundColor: colors.info }]}>
          <Text style={styles.cardTitle}>Ahorrado</Text>
          <Text style={styles.cardAmount}>{formatCurrency(stats.ahorro)}</Text>
        </View>
        <View style={[globalStyles.card, styles.tile, { backgroundColor: colors.primary }]}>
          <Text style={styles.cardTitle}>Queda libre</Text>
          <Text style={[styles.cardAmount, stats.balance < 0 && { color: '#ffd6d6' }]}>
            {formatCurrency(stats.balance)}
          </Text>
        </View>
      </View>

      {/* Situación actual */}
      <View style={globalStyles.card}>
        <Text style={styles.sectionTitle}>🏦 Situación actual</Text>
        <View style={styles.rowItem}>
          <Text style={styles.rowLabel}>Dinero en cuentas</Text>
          <Text style={[styles.rowValue, { color: colors.success }]}>{formatCurrency(enCuentas)}</Text>
        </View>
        <View style={styles.rowItem}>
          <Text style={styles.rowLabel}>Deuda de tarjetas</Text>
          <Text style={[styles.rowValue, { color: colors.danger }]}>− {formatCurrency(deudaTarjetas)}</Text>
        </View>
        {deudasPersonales > 0 && (
          <View style={styles.rowItem}>
            <Text style={styles.rowLabel}>Deudas personales</Text>
            <Text style={[styles.rowValue, { color: colors.danger }]}>− {formatCurrency(deudasPersonales)}</Text>
          </View>
        )}
        <View style={styles.rowItem}>
          <Text style={styles.rowLabel}>Ahorros (USD a ${cotizacion})</Text>
          <Text style={[styles.rowValue, { color: colors.info }]}>{formatCurrency(ahorroTotal)}</Text>
        </View>
        <View style={[styles.rowItem, { borderBottomWidth: 0 }]}>
          <Text style={[styles.rowLabel, { fontWeight: 'bold' }]}>Patrimonio neto</Text>
          <Text style={[styles.rowValue, { fontSize: 18, color: patrimonio >= 0 ? colors.primary : colors.danger }]}>
            {formatCurrency(patrimonio)}
          </Text>
        </View>
      </View>

      {/* Recomendaciones */}
      <Recommendations items={recs} max={5} />

      {/* Gráfica de Pastel - Gastos por Categoría */}
      <View style={[globalStyles.card, styles.chartCard]}>
        <Text style={styles.sectionTitle}>📈 Consumo del hogar por categoría</Text>
        <Text style={styles.footnote}>
          No incluye transferencias entre cuentas, pagos de tarjeta ni ahorro. Las compras en cuotas se cuentan mes a mes.
        </Text>
        {pieChartData.length > 0 ? (
          <>
            <View style={styles.chartContainer}>
              <PieChart
                data={pieChartData}
                width={screenWidth - 60}
                height={200}
                chartConfig={{
                  backgroundColor: '#ffffff',
                  backgroundGradientFrom: '#ffffff',
                  backgroundGradientTo: '#ffffff',
                  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  decimalPlaces: 0,
                }}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="0"
                center={[(screenWidth - 60) / 4, 0]}
                hasLegend={false}
              />
            </View>

            {/* Leyenda personalizada mejorada */}
            <View style={styles.legendContainer}>
              {stats.porCategoria.map((item, index) => {
                const porcentaje = stats.gastos > 0 ? ((item.monto / stats.gastos) * 100).toFixed(1) : '0';
                return (
                  <View key={item.categoria} style={styles.legendItem}>
                    <View style={styles.legendLeft}>
                      <View style={[styles.legendDot, { backgroundColor: getColorByIndex(index) }]} />
                      <Text style={styles.legendCategory}>{item.categoria}</Text>
                    </View>
                    <View style={styles.legendRight}>
                      <Text style={styles.legendAmount}>{formatCurrency(item.monto)}</Text>
                      <Text style={styles.legendPercentage}>{porcentaje}%</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        ) : (
          <View style={styles.emptyChartContainer}>
            <Text style={styles.emptyChartIcon}>📊</Text>
            <Text style={styles.emptyText}>No hay gastos en {monthLabel(mes)}</Text>
          </View>
        )}
        {(stats.transferencias > 0 || stats.pagosTarjeta > 0) && (
          <Text style={styles.footnote}>
            Fuera de la gráfica: transferencias {formatCurrency(stats.transferencias)} • pagos de tarjeta {formatCurrency(stats.pagosTarjeta)}
          </Text>
        )}
      </View>

      {/* Tarjetas de crédito */}
      {tarjetas.length > 0 && (
        <View style={globalStyles.card}>
          <Text style={styles.sectionTitle}>💳 Tarjetas de crédito</Text>
          {tarjetas.map(card => (
            <View key={card.id} style={styles.cardBlock}>
              <Text style={styles.accountName}>{card.nombre}</Text>
              <CreditCardStatus account={card} compact />
            </View>
          ))}

          <Text style={[styles.subTitle, { marginTop: 10 }]}>A pagar de tarjetas (compras y cuotas)</Text>
          {proyeccion.map(p => (
            <View key={p.key} style={styles.barRow}>
              <Text style={styles.barLabel}>{monthLabel(p.key)}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${(p.total / maxProyeccion) * 100}%` }]} />
              </View>
              <Text style={styles.barValue}>{formatCurrency(p.total)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Últimas transacciones */}
      <View style={globalStyles.card}>
        <Text style={styles.sectionTitle}>🕐 Últimas Transacciones</Text>
        {ultimasTransacciones.map(transaction => {
          const cuenta = accounts.find(acc => acc.id === transaction.cuentaId);
          const esAhorroMov = esMovimientoAhorro(transaction);
          const esIngreso = transaction.tipo === 'ingreso' && !esAhorroMov;
          const esMovimiento = esAhorroMov || transaction.tipo === 'transferencia' || transaction.tipo === 'pago_tarjeta';
          return (
            <View key={transaction.id} style={styles.transactionItem}>
              <View style={styles.transactionInfo}>
                <Text style={styles.transactionDesc}>{transaction.descripcion}</Text>
                <Text style={styles.transactionMeta}>
                  {TIPOS[transaction.tipo] || transaction.tipo} • {transaction.categoria} • {cuenta?.nombre || 'Cuenta no encontrada'}
                </Text>
              </View>
              <Text style={[
                styles.transactionAmount,
                { color: esIngreso ? colors.success : esMovimiento ? colors.info : colors.danger }
              ]}>
                {esIngreso ? '+' : esMovimiento ? '' : '-'}{formatCurrency(transaction.monto)}
              </Text>
            </View>
          );
        })}
        {ultimasTransacciones.length === 0 && (
          <Text style={styles.emptyText}>No hay transacciones recientes</Text>
        )}
      </View>

      {/* Detalle de ahorros */}
      <View style={globalStyles.card}>
        <Text style={styles.sectionTitle}>💰 Ahorros</Text>
        <View style={styles.savingsGrid}>
          <View style={styles.savingsItem}>
            <Text style={styles.savingsLabel}>Pesos (ARS)</Text>
            <Text style={[styles.savingsAmount, { color: colors.success }]}>
              {formatCurrency(savings.pesos || 0)}
            </Text>
          </View>
          <View style={styles.savingsItem}>
            <Text style={styles.savingsLabel}>Dólares (USD)</Text>
            <Text style={[styles.savingsAmount, { color: colors.info }]}>
              ${(savings.usd || 0).toFixed(2)}
            </Text>
          </View>
        </View>
        <View style={styles.totalSavings}>
          <Text style={styles.totalSavingsLabel}>Ahorro Total Aproximado</Text>
          <Text style={styles.totalSavingsAmount}>
            {formatCurrency(ahorroTotal)}
          </Text>
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
    marginBottom: 15,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tile: {
    width: '48.5%',
  },
  cardTitle: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 5,
  },
  cardAmount: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  subTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  footnote: {
    fontSize: 11,
    color: '#999',
    marginBottom: 8,
  },
  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rowLabel: {
    fontSize: 14,
    color: '#555',
    flex: 1,
  },
  rowValue: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  // Estilos mejorados para la gráfica
  chartCard: {
    marginBottom: 20,
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 5,
    overflow: 'hidden',
  },
  emptyChartContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyChartIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  legendContainer: {
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  legendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 5,
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  legendDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 10,
  },
  legendCategory: {
    fontSize: 13,
    color: '#333',
    fontWeight: '600',
    flex: 1,
  },
  legendRight: {
    alignItems: 'flex-end',
  },
  legendAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  legendPercentage: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  cardBlock: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  accountName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  barLabel: {
    width: 110,
    fontSize: 12,
    color: '#555',
  },
  barTrack: {
    flex: 1,
    height: 10,
    backgroundColor: '#e9ecef',
    borderRadius: 5,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  barFill: {
    height: '100%',
    backgroundColor: '#ffc107',
    borderRadius: 5,
  },
  barValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    minWidth: 90,
    textAlign: 'right',
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  transactionInfo: {
    flex: 1,
    marginRight: 10,
  },
  transactionDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  transactionMeta: {
    fontSize: 12,
    color: '#666',
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  savingsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  savingsItem: {
    alignItems: 'center',
    flex: 1,
  },
  savingsLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  savingsAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  totalSavings: {
    alignItems: 'center',
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  totalSavingsLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  totalSavingsAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
});
