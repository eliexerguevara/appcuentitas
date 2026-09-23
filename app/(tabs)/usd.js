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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getDocs, getDoc, setDoc, addDoc } from 'firebase/firestore';
import { auth } from '../../firebase/config';
import { ensureHousehold, dataCol, dataDoc } from '../../src/services/household';
import { formatCurrency, formatUSD } from '../../src/utils/formatters';
import { Alert } from '../../src/utils/dialog';
import {
  currentMonthKey,
  esMovimientoAhorro,
  esUSD,
  monthKey,
  monthLabel,
  tasaDe,
  TIPOS,
} from '../../src/utils/finance';
import { theme, shadow, iconoCategoria, nombreCategoria } from '../../src/styles/theme';
import { PLACEHOLDER_COLOR } from '../../src/styles/global';
import MonthPicker from '../../src/components/MonthPicker';

const parseMonto = (v) => parseFloat(String(v).replace(',', '.'));

export default function UsdScreen() {
  const router = useRouter();
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [savings, setSavings] = useState({});
  const [mes, setMes] = useState(currentMonthKey());
  const [refreshing, setRefreshing] = useState(false);
  const [tasaInput, setTasaInput] = useState('');
  const [editandoTasa, setEditandoTasa] = useState(false);
  const [nombreNueva, setNombreNueva] = useState('');
  const [saldoNueva, setSaldoNueva] = useState('');

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
      setSavings(savingsDoc.exists() ? savingsDoc.data() : {});
    } catch (error) {
      console.error('Error cargando dólares:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const tasa = tasaDe(savings);
  const cuentasUSD = accounts.filter(a => a.tipo === 'caja' && esUSD(a));
  const idsUSD = new Set(cuentasUSD.map(a => a.id));
  const totalUSD = cuentasUSD.reduce((s, a) => s + (a.saldo || 0), 0);
  const nombreCuenta = (id) => accounts.find(a => a.id === id)?.nombre || '';

  // Movimientos del mes que tocan una cuenta en dólares, con su efecto en US$
  const movimientosMes = transactions
    .filter(t => monthKey(t.fecha) === mes)
    .filter(t => idsUSD.has(t.cuentaId) || idsUSD.has(t.cuentaDestinoId))
    .map(t => {
      const usd = Number(t.montoUSD) || (t.tasa ? t.monto / t.tasa : t.monto / tasa);
      const entra = idsUSD.has(t.cuentaDestinoId) || (t.tipo === 'ingreso' && idsUSD.has(t.cuentaId));
      return { ...t, usd, entra };
    })
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  const entradoUSD = movimientosMes.filter(t => t.entra).reduce((s, t) => s + t.usd, 0);
  const salidoUSD = movimientosMes.filter(t => !t.entra).reduce((s, t) => s + t.usd, 0);

  const guardarTasa = async () => {
    const n = parseMonto(tasaInput);
    if (!(n > 0)) {
      Alert.alert('Error', 'Ingresá una tasa de cambio válida');
      return;
    }
    try {
      await ensureHousehold();
      await setDoc(dataDoc('data', 'savings'), { cotizacionUSD: n, cotizacionFecha: new Date().toISOString() }, { merge: true });
      setSavings({ ...savings, cotizacionUSD: n });
      setTasaInput('');
      setEditandoTasa(false);
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar la tasa');
    }
  };

  const crearCuenta = async () => {
    if (!nombreNueva.trim()) {
      Alert.alert('Error', 'Poné un nombre para la cuenta');
      return;
    }
    try {
      await ensureHousehold();
      await addDoc(dataCol('accounts'), {
        tipo: 'caja',
        moneda: 'USD',
        nombre: nombreNueva.trim(),
        saldo: parseMonto(saldoNueva) || 0,
        fechaCreacion: new Date().toISOString(),
      });
      setNombreNueva('');
      setSaldoNueva('');
      await loadData();
    } catch (error) {
      Alert.alert('Error', 'No se pudo crear la cuenta');
    }
  };

  const ir = (tipo, cuentaId) =>
    router.push({ pathname: '/transactions', params: { tipo, cuentaId, t: Date.now() } });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Tasa de cambio */}
      <View style={[styles.card, shadow]}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.label}>Tasa de cambio</Text>
            <Text style={styles.tasa}>1 US$ = {formatCurrency(tasa)}</Text>
          </View>
          {!editandoTasa && (
            <TouchableOpacity style={styles.smallButton} onPress={() => { setTasaInput(String(tasa)); setEditandoTasa(true); }}>
              <Ionicons name="create-outline" size={16} color={theme.accent} />
              <Text style={styles.smallButtonText}>Cambiar</Text>
            </TouchableOpacity>
          )}
        </View>
        {editandoTasa && (
          <View style={styles.editRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={tasaInput}
              onChangeText={setTasaInput}
              placeholder="1200"
              placeholderTextColor={PLACEHOLDER_COLOR}
              keyboardType="numeric"
            />
            <TouchableOpacity style={[styles.button, { backgroundColor: theme.textMuted }]} onPress={() => setEditandoTasa(false)}>
              <Text style={styles.buttonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={guardarTasa}>
              <Text style={styles.buttonText}>Guardar</Text>
            </TouchableOpacity>
          </View>
        )}
        <Text style={styles.help}>
          Se usa para pasar a pesos los movimientos en dólares (gastos, gráficas y presupuesto) y el ahorro en USD.
          Cada movimiento guarda la tasa del día en que se cargó.
        </Text>
      </View>

      {/* Cuentas en dólares */}
      {cuentasUSD.length === 0 ? (
        <View style={[styles.card, shadow]}>
          <Text style={styles.cardTitle}>Agregá tu cuenta en dólares</Text>
          <Text style={styles.help}>Por ejemplo tu cuenta americana. El saldo se lleva en US$ y se muestra también en pesos.</Text>
          <Text style={[styles.label, { marginTop: 12 }]}>Nombre</Text>
          <TextInput
            style={styles.input}
            value={nombreNueva}
            onChangeText={setNombreNueva}
            placeholder="Cuenta USA"
            placeholderTextColor={PLACEHOLDER_COLOR}
          />
          <Text style={[styles.label, { marginTop: 10 }]}>Saldo actual (US$)</Text>
          <TextInput
            style={styles.input}
            value={saldoNueva}
            onChangeText={setSaldoNueva}
            placeholder="0"
            placeholderTextColor={PLACEHOLDER_COLOR}
            keyboardType="numeric"
          />
          <TouchableOpacity style={[styles.button, { marginTop: 14 }]} onPress={crearCuenta}>
            <Text style={styles.buttonText}>Crear cuenta en dólares</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {cuentasUSD.length > 1 && (
            <Text style={styles.total}>Total: {formatUSD(totalUSD)} ≈ {formatCurrency(totalUSD * tasa)}</Text>
          )}
          {cuentasUSD.map(cuenta => (
            <View key={cuenta.id} style={styles.usdCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="logo-usd" size={18} color={theme.cardUsdSoft} />
                <Text style={styles.usdName}>{cuenta.nombre}</Text>
              </View>
              <Text style={styles.usdAmount}>{formatUSD(cuenta.saldo)}</Text>
              <Text style={styles.usdSub}>≈ {formatCurrency((cuenta.saldo || 0) * tasa)}</Text>
              <View style={styles.actions}>
                {[
                  ['egreso', 'Gasto', 'arrow-down'],
                  ['ingreso', 'Ingreso', 'arrow-up'],
                  ['transferencia', 'Transferir', 'swap-horizontal'],
                  ['pago_tarjeta', 'Pagar tarjeta', 'card-outline'],
                ].map(([tipo, label, icon]) => (
                  <TouchableOpacity key={tipo} style={styles.action} onPress={() => ir(tipo, cuenta.id)}>
                    <Ionicons name={icon} size={18} color="white" />
                    <Text style={styles.actionText}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </>
      )}

      {/* Movimientos en dólares */}
      {cuentasUSD.length > 0 && (
        <>
          <MonthPicker value={mes} onChange={setMes} />
          <View style={styles.summaryRow}>
            <View style={[styles.summaryBox, shadow]}>
              <Text style={styles.label}>Entró</Text>
              <Text style={[styles.summaryValue, { color: theme.success }]}>{formatUSD(entradoUSD)}</Text>
            </View>
            <View style={[styles.summaryBox, shadow]}>
              <Text style={styles.label}>Salió</Text>
              <Text style={[styles.summaryValue, { color: theme.danger }]}>{formatUSD(salidoUSD)}</Text>
            </View>
          </View>

          <View style={[styles.card, shadow]}>
            <Text style={styles.cardTitle}>Movimientos de {monthLabel(mes)}</Text>
            {movimientosMes.length === 0 && (
              <Text style={styles.empty}>No hay movimientos en dólares este mes</Text>
            )}
            {movimientosMes.map(t => {
              const neutro = esMovimientoAhorro(t) || t.tipo === 'transferencia' || t.tipo === 'pago_tarjeta';
              const destino = t.cuentaDestinoId || t.tarjetaId;
              return (
                <View key={t.id} style={styles.movRow}>
                  <View style={[styles.movIcon, { backgroundColor: t.entra ? theme.successSoft : neutro ? theme.accentSoft : theme.dangerSoft }]}>
                    <Ionicons
                      name={t.entra ? 'arrow-down' : neutro ? 'swap-horizontal' : iconoCategoria(t.categoria)}
                      size={16}
                      color={t.entra ? theme.success : neutro ? theme.accent : theme.danger}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.movDesc} numberOfLines={1}>{t.descripcion}</Text>
                    <Text style={styles.movMeta} numberOfLines={1}>
                      {TIPOS[t.tipo] || t.tipo} · {nombreCategoria(t.categoria)}
                      {destino ? ` · ${nombreCuenta(t.cuentaId)} → ${nombreCuenta(destino)}` : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.movAmount, { color: t.entra ? theme.success : theme.danger }]}>
                      {t.entra ? '+' : '−'}{formatUSD(t.usd)}
                    </Text>
                    <Text style={styles.movMeta}>{formatCurrency(t.monto)}{t.tasa ? ` a $${t.tasa}` : ''}</Text>
                  </View>
                </View>
              );
            })}
          </View>
          <Text style={styles.help}>
            Los gastos en dólares también aparecen en Inicio y Presupuesto, convertidos a pesos.
            Para agregar otra cuenta en dólares usá Billetera → Agregar → Cuenta → Dólares.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, padding: 16 },
  card: { backgroundColor: theme.surface, borderRadius: theme.radius, padding: 16, marginBottom: 14 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: theme.text, marginBottom: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 13, color: theme.textSecondary, fontWeight: '600' },
  tasa: { fontSize: 24, fontWeight: '700', color: theme.text, marginTop: 2 },
  help: { fontSize: 12, color: theme.textMuted, marginTop: 8, lineHeight: 17 },
  smallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  smallButtonText: { color: theme.accent, fontWeight: '600', fontSize: 13 },
  editRow: { flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: theme.surface,
    color: theme.text,
  },
  button: { backgroundColor: theme.accent, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600', fontSize: 14 },
  total: { fontSize: 13, color: theme.textSecondary, marginBottom: 8, fontWeight: '600' },
  usdCard: { backgroundColor: theme.cardUsd, borderRadius: 16, padding: 16, marginBottom: 14 },
  usdName: { color: theme.cardUsdSoft, fontSize: 14, fontWeight: '600' },
  usdAmount: { color: 'white', fontSize: 30, fontWeight: '700', marginTop: 6 },
  usdSub: { color: theme.cardUsdSoft, fontSize: 13 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  actionText: { color: 'white', fontSize: 13, fontWeight: '600' },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  summaryBox: { flex: 1, backgroundColor: theme.surface, borderRadius: theme.radius, padding: 14 },
  summaryValue: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  empty: { fontSize: 13, color: theme.textMuted, textAlign: 'center', paddingVertical: 12 },
  movRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  movIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  movDesc: { fontSize: 14, color: theme.text, fontWeight: '500' },
  movMeta: { fontSize: 12, color: theme.textMuted },
  movAmount: { fontSize: 14, fontWeight: '700' },
});
