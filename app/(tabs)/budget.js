import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getDocs, getDoc, setDoc } from 'firebase/firestore';
import { auth } from '../../firebase/config';
import { ensureHousehold, dataCol, dataDoc } from '../../src/services/household';
import { formatCurrency } from '../../src/utils/formatters';
import { Alert } from '../../src/utils/dialog';
import {
  CATEGORIAS_GASTO,
  CATEGORIAS_NO_CONSUMO,
  currentMonthKey,
  estadoPresupuesto,
  monthLabel,
  sugerirTopes,
} from '../../src/utils/finance';
import { theme, shadow, iconoCategoria, nombreCategoria } from '../../src/styles/theme';
import { PLACEHOLDER_COLOR } from '../../src/styles/global';
import MonthPicker from '../../src/components/MonthPicker';
import Fab from '../../src/components/Fab';

// Categorías que tienen sentido con tope (las de consumo del hogar)
const CATEGORIAS_PRESUPUESTO = [
  ...CATEGORIAS_GASTO.filter(c => !CATEGORIAS_NO_CONSUMO.includes(c)),
  'COMISIONES',
];

const parseMonto = (v) => parseFloat(String(v).replace(',', '.'));

export default function BudgetScreen() {
  const [transactions, setTransactions] = useState([]);
  const [topes, setTopes] = useState({});
  const [mes, setMes] = useState(currentMonthKey());
  const [refreshing, setRefreshing] = useState(false);
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState({});
  const [guardando, setGuardando] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    if (!auth.currentUser) return;
    try {
      await ensureHousehold();
      const [transactionsSnapshot, presupuestoDoc] = await Promise.all([
        getDocs(dataCol('transactions')),
        getDoc(dataDoc('data', 'presupuesto')),
      ]);
      setTransactions(transactionsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setTopes(presupuestoDoc.exists() ? presupuestoDoc.data().topes || {} : {});
    } catch (error) {
      console.error('Error cargando presupuesto:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const estado = estadoPresupuesto(transactions, topes, mes);
  const sinTopes = estado.totalTope === 0;
  const esMesActual = mes === currentMonthKey();

  const empezarEdicion = (base = topes) => {
    setBorrador(Object.fromEntries(
      CATEGORIAS_PRESUPUESTO.map(c => [c, base[c] ? String(base[c]) : ''])
    ));
    setEditando(true);
  };

  const usarSugeridos = () => {
    const sugeridos = sugerirTopes(transactions, currentMonthKey());
    if (Object.keys(sugeridos).length === 0) {
      Alert.alert('Sin datos', 'Todavía no hay gastos para calcular topes. Cargalos a mano.');
      return;
    }
    empezarEdicion({ ...topes, ...sugeridos });
  };

  const guardar = async () => {
    const nuevos = {};
    for (const [cat, valor] of Object.entries(borrador)) {
      if (String(valor).trim() === '') continue;
      const n = parseMonto(valor);
      if (isNaN(n) || n < 0) {
        Alert.alert('Error', `El tope de ${nombreCategoria(cat)} no es un número válido`);
        return;
      }
      if (n > 0) nuevos[cat] = n;
    }
    try {
      setGuardando(true);
      await ensureHousehold();
      await setDoc(dataDoc('data', 'presupuesto'), { topes: nuevos }, { merge: false });
      setTopes(nuevos);
      setEditando(false);
    } catch (error) {
      console.error('Error guardando presupuesto:', error);
      Alert.alert('Error', 'No se pudo guardar el presupuesto');
    } finally {
      setGuardando(false);
    }
  };

  const totalBorrador = Object.values(borrador).reduce((s, v) => s + (parseMonto(v) || 0), 0);

  if (editando) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
          <Text style={styles.title}>Topes por mes</Text>
          <Text style={styles.subtitle}>
            Cuánto quieren gastar como máximo en cada categoría. Dejá vacío lo que no quieras controlar.
          </Text>
          <View style={[styles.card, shadow]}>
            {CATEGORIAS_PRESUPUESTO.map(cat => (
              <View key={cat} style={styles.editRow}>
                <View style={styles.catIcon}>
                  <Ionicons name={iconoCategoria(cat)} size={16} color={theme.accent} />
                </View>
                <Text style={styles.editName}>{nombreCategoria(cat)}</Text>
                <TextInput
                  style={styles.editInput}
                  value={borrador[cat] || ''}
                  onChangeText={(v) => setBorrador({ ...borrador, [cat]: v })}
                  placeholder="Sin tope"
                  placeholderTextColor={PLACEHOLDER_COLOR}
                  keyboardType="numeric"
                />
              </View>
            ))}
            <View style={[styles.rowBetween, { marginTop: 12 }]}>
              <Text style={styles.editName}>Total por mes</Text>
              <Text style={styles.totalValue}>{formatCurrency(totalBorrador)}</Text>
            </View>
          </View>
          <View style={styles.buttons}>
            <TouchableOpacity style={[styles.button, styles.buttonGhost]} onPress={() => setEditando(false)}>
              <Text style={[styles.buttonText, { color: theme.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonPrimary]} onPress={guardar} disabled={guardando}>
              <Text style={styles.buttonText}>{guardando ? 'Guardando...' : 'Guardar topes'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <MonthPicker value={mes} onChange={setMes} />

        {sinTopes ? (
          <View style={[styles.card, shadow, { alignItems: 'center' }]}>
            <Ionicons name="pie-chart-outline" size={40} color={theme.accent} />
            <Text style={[styles.title, { textAlign: 'center', marginTop: 8 }]}>Armen su presupuesto</Text>
            <Text style={[styles.subtitle, { textAlign: 'center' }]}>
              Pongan un tope mensual a cada categoría y la app les avisa cuánto pueden gastar por día y cuándo se pasan.
            </Text>
            <TouchableOpacity style={[styles.button, styles.buttonPrimary, { alignSelf: 'stretch' }]} onPress={usarSugeridos}>
              <Text style={styles.buttonText}>Sugerir topes según mis gastos</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonGhost, { alignSelf: 'stretch', marginTop: 8 }]} onPress={() => empezarEdicion()}>
              <Text style={[styles.buttonText, { color: theme.accent }]}>Cargar a mano</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Resumen */}
            <View style={[styles.hero, shadow]}>
              {esMesActual && estado.diasRestantes > 0 ? (
                <>
                  <Text style={styles.heroLabel}>Pueden gastar por día</Text>
                  <Text style={[styles.heroAmount, { color: estado.quedaTotal > 0 ? theme.text : theme.danger }]}>
                    {formatCurrency(estado.porDia)}
                  </Text>
                  <Text style={styles.heroSub}>
                    Quedan {formatCurrency(Math.max(0, estado.quedaTotal))} para {estado.diasRestantes} {estado.diasRestantes === 1 ? 'día' : 'días'}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.heroLabel}>{monthLabel(mes)}</Text>
                  <Text style={[styles.heroAmount, { color: estado.quedaTotal >= 0 ? theme.success : theme.danger }]}>
                    {formatCurrency(Math.abs(estado.quedaTotal))}
                  </Text>
                  <Text style={styles.heroSub}>{estado.quedaTotal >= 0 ? 'quedaron sin gastar del presupuesto' : 'gastados de más sobre el presupuesto'}</Text>
                </>
              )}
              <View style={styles.bigBar}>
                <View style={{
                  width: `${Math.min(100, (estado.gastadoConTope / estado.totalTope) * 100)}%`,
                  height: '100%',
                  borderRadius: 5,
                  backgroundColor: estado.gastadoConTope > estado.totalTope ? theme.danger : theme.accent,
                }} />
              </View>
              <Text style={styles.heroSub}>
                Gastado {formatCurrency(estado.gastadoConTope)} de {formatCurrency(estado.totalTope)}
              </Text>
            </View>

            {estado.excedidas.length > 0 && (
              <View style={styles.alert}>
                <Ionicons name="alert-circle-outline" size={20} color={theme.danger} />
                <Text style={styles.alertText}>
                  {estado.excedidas.map(i => `${nombreCategoria(i.categoria)} pasó el tope por ${formatCurrency(-i.restante)}`).join(' • ')}
                </Text>
              </View>
            )}

            {/* Categorías */}
            <View style={[styles.card, shadow]}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>Por categoría</Text>
                <TouchableOpacity onPress={() => empezarEdicion()}>
                  <Text style={styles.link}>Editar topes</Text>
                </TouchableOpacity>
              </View>
              {estado.items.map(i => {
                const color = i.tope === 0 ? theme.textMuted
                  : i.uso > 1 ? theme.danger
                  : i.uso >= 0.85 ? theme.warning
                  : theme.success;
                return (
                  <View key={i.categoria} style={styles.catRow}>
                    <View style={styles.catIcon}>
                      <Ionicons name={iconoCategoria(i.categoria)} size={16} color={theme.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.catName}>{nombreCategoria(i.categoria)}</Text>
                        <Text style={[styles.catAmount, i.uso > 1 && { color: theme.danger }]}>
                          {formatCurrency(i.gastado)}
                          <Text style={styles.catTope}>{i.tope > 0 ? ` / ${formatCurrency(i.tope)}` : ' · sin tope'}</Text>
                        </Text>
                      </View>
                      {i.tope > 0 && (
                        <>
                          <View style={styles.barBg}>
                            <View style={[styles.barFill, { width: `${Math.min(100, i.uso * 100)}%`, backgroundColor: color }]} />
                          </View>
                          <Text style={[styles.catHint, { color }]}>
                            {i.restante >= 0 ? `Quedan ${formatCurrency(i.restante)}` : `Pasado por ${formatCurrency(-i.restante)}`}
                          </Text>
                        </>
                      )}
                    </View>
                  </View>
                );
              })}
              {estado.gastadoSinTope > 0 && (
                <Text style={styles.footnote}>
                  {formatCurrency(estado.gastadoSinTope)} en categorías sin tope. Ponerles tope ayuda a controlar todo el gasto.
                </Text>
              )}
            </View>

            <TouchableOpacity onPress={usarSugeridos}>
              <Text style={[styles.link, { textAlign: 'center' }]}>Recalcular topes según los últimos 3 meses</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
      <Fab label="Cargar gasto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: '700', color: theme.text, marginBottom: 6 },
  subtitle: { fontSize: 14, color: theme.textSecondary, marginBottom: 16, lineHeight: 20 },
  hero: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
  },
  heroLabel: { fontSize: 14, color: theme.textSecondary },
  heroAmount: { fontSize: 34, fontWeight: '700', marginVertical: 4 },
  heroSub: { fontSize: 13, color: theme.textMuted, textAlign: 'center' },
  bigBar: {
    height: 10,
    width: '100%',
    backgroundColor: theme.surfaceMuted,
    borderRadius: 5,
    overflow: 'hidden',
    marginTop: 14,
    marginBottom: 8,
  },
  alert: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: theme.dangerSoft,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  alertText: { flex: 1, color: theme.danger, fontSize: 13, fontWeight: '500' },
  card: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: theme.text },
  link: { color: theme.accent, fontWeight: '600', fontSize: 13, marginVertical: 6 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  catIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catName: { fontSize: 14, color: theme.text, fontWeight: '500' },
  catAmount: { fontSize: 14, color: theme.text, fontWeight: '600' },
  catTope: { fontSize: 12, color: theme.textMuted, fontWeight: '400' },
  catHint: { fontSize: 12, marginTop: 3 },
  barBg: { height: 7, backgroundColor: theme.surfaceMuted, borderRadius: 4, overflow: 'hidden', marginTop: 6 },
  barFill: { height: '100%', borderRadius: 4 },
  footnote: { fontSize: 12, color: theme.textMuted, marginTop: 10 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  editName: { flex: 1, fontSize: 14, color: theme.text, fontWeight: '500' },
  editInput: {
    width: 130,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    textAlign: 'right',
    backgroundColor: theme.surface,
    color: theme.text,
  },
  totalValue: { fontSize: 17, fontWeight: '700', color: theme.accent },
  buttons: { flexDirection: 'row', gap: 10 },
  button: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  buttonPrimary: { backgroundColor: theme.accent },
  buttonGhost: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  buttonText: { color: 'white', fontSize: 15, fontWeight: '600' },
});
