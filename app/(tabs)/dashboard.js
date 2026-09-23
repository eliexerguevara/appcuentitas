import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getDocs, getDoc } from 'firebase/firestore';
import { auth } from '../../firebase/config';
import { ensureHousehold, dataCol, dataDoc } from '../../src/services/household';
import { formatCurrency } from '../../src/utils/formatters';
import {
  currentMonthKey,
  esMovimientoAhorro,
  estadoPresupuesto,
  infoTarjeta,
  metaAhorroDe,
  monthLabel,
  monthStats,
  planAhorro,
  proyeccionCuotas,
  recomendaciones,
  addMonths,
} from '../../src/utils/finance';
import { theme, shadow, iconoCategoria, nombreCategoria } from '../../src/styles/theme';
import MonthPicker from '../../src/components/MonthPicker';
import Fab from '../../src/components/Fab';

const ESTILO_REC = {
  alerta: { icon: 'alert-circle-outline', color: theme.danger, bg: theme.dangerSoft },
  consejo: { icon: 'bulb-outline', color: theme.warning, bg: theme.warningSoft },
  bien: { icon: 'checkmark-circle-outline', color: theme.success, bg: theme.successSoft },
};

export default function DashboardScreen() {
  const router = useRouter();
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [savings, setSavings] = useState({ pesos: 0, usd: 0 });
  const [topes, setTopes] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [mes, setMes] = useState(currentMonthKey());
  const [verTodos, setVerTodos] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    if (!auth.currentUser) return;

    try {
      await ensureHousehold();
      const [accountsSnapshot, transactionsSnapshot, savingsDoc, presupuestoDoc] = await Promise.all([
        getDocs(dataCol('accounts')),
        getDocs(dataCol('transactions')),
        getDoc(dataDoc('data', 'savings')),
        getDoc(dataDoc('data', 'presupuesto')),
      ]);
      setAccounts(accountsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setTransactions(transactionsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      if (savingsDoc.exists()) setSavings(savingsDoc.data());
      setTopes(presupuestoDoc.exists() ? presupuestoDoc.data().topes || {} : {});
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
  const tarjetas = accounts.filter(a => a.tipo === 'tarjeta');
  const enCuentas = accounts.filter(a => a.tipo === 'caja').reduce((s, a) => s + (a.saldo || 0), 0);
  const deudaTarjetas = tarjetas.reduce((s, a) => s + infoTarjeta(a).deuda, 0);
  const deudasPersonales = accounts
    .filter(a => a.tipo === 'deuda' && !a.finalizada)
    .reduce((s, a) => s + infoTarjeta(a).deuda, 0);
  const meta = metaAhorroDe(savings, mes);
  const plan = meta ? planAhorro(transactions, meta, mes) : null;
  const presupuesto = estadoPresupuesto(transactions, topes, mes);
  const recs = recomendaciones(transactions, accounts, mes, savings, topes);
  const aPagarTarjetas = proyeccionCuotas(transactions, addMonths(mes, 1), 1)[0].total;

  const ingresos = stats.ingresos;
  const libre = stats.balance;
  const pctGastado = ingresos > 0 ? Math.min(1, stats.gastos / ingresos) : 0;
  const pctAhorro = ingresos > 0 ? Math.max(0, Math.min(1 - pctGastado, stats.ahorro / ingresos)) : 0;

  const ultimas = [...transactions]
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) ||
      String(b.fechaCreacion || '').localeCompare(String(a.fechaCreacion || '')))
    .slice(0, 5);
  const nombreCuenta = (id) => accounts.find(a => a.id === id)?.nombre || '';
  const topCategorias = stats.porCategoria.slice(0, 5);
  const maxCat = Math.max(1, ...topCategorias.map(c => c.monto));
  const recsVisibles = verTodos ? recs : recs.slice(0, 2);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <MonthPicker value={mes} onChange={setMes} />

        {/* Número principal */}
        <View style={[styles.hero, shadow]}>
          <Text style={styles.heroLabel}>
            {libre >= 0 ? 'Les queda libre este mes' : 'Este mes gastaron de más'}
          </Text>
          <Text style={[styles.heroAmount, { color: libre >= 0 ? theme.success : theme.danger }]}>
            {formatCurrency(Math.abs(libre))}
          </Text>
          <Text style={styles.heroSub}>
            {ingresos > 0 ? `de ${formatCurrency(ingresos)} que ingresaron` : 'Carguen sus ingresos para ver cuánto les queda'}
          </Text>

          {ingresos > 0 && (
            <>
              <View style={styles.stackBar}>
                <View style={{ width: `${pctGastado * 100}%`, backgroundColor: theme.danger }} />
                <View style={{ width: `${pctAhorro * 100}%`, backgroundColor: theme.accent }} />
              </View>
              <View style={styles.legendRow}>
                <Legend color={theme.danger} text={`Gastado ${Math.round(pctGastado * 100)}%`} />
                <Legend color={theme.accent} text={`Ahorrado ${Math.round(pctAhorro * 100)}%`} />
                <Legend color={theme.border} text={`Libre ${Math.max(0, Math.round((1 - pctGastado - pctAhorro) * 100))}%`} />
              </View>
            </>
          )}
        </View>

        {/* Consejos */}
        {recsVisibles.map((r, i) => {
          const e = ESTILO_REC[r.nivel] || ESTILO_REC.consejo;
          return (
            <View key={i} style={[styles.rec, { backgroundColor: e.bg }]}>
              <Ionicons name={e.icon} size={20} color={e.color} style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.recTitle, { color: e.color }]}>{r.titulo}</Text>
                <Text style={styles.recText}>{r.texto}</Text>
              </View>
            </View>
          );
        })}
        {recs.length > 2 && (
          <TouchableOpacity onPress={() => setVerTodos(!verTodos)}>
            <Text style={styles.link}>{verTodos ? 'Ver menos consejos' : `Ver ${recs.length - 2} consejos más`}</Text>
          </TouchableOpacity>
        )}

        {/* Mosaico */}
        <View style={styles.grid}>
          <Tile
            icon="card-outline"
            label="Deuda tarjetas"
            value={formatCurrency(deudaTarjetas)}
            sub={aPagarTarjetas > 0 ? `${formatCurrency(aPagarTarjetas)} el mes que viene` : 'Sin cuotas el mes que viene'}
            color={deudaTarjetas > 0 ? theme.danger : theme.text}
            onPress={() => router.push('/accounts')}
          />
          <Tile
            icon="flag-outline"
            label="Meta de ahorro"
            value={plan ? `${Math.round(plan.progreso * 100)}%` : 'Sin meta'}
            sub={plan ? `para ${monthLabel(plan.mesObjetivo)}` : 'Tocá para crear una'}
            color={theme.accent}
            onPress={() => router.push('/savings')}
          />
          <Tile
            icon="pie-chart-outline"
            label="Presupuesto"
            value={presupuesto.totalTope > 0
              ? (presupuesto.excedidas.length > 0 ? `${presupuesto.excedidas.length} pasada${presupuesto.excedidas.length > 1 ? 's' : ''}` : 'En orden')
              : 'Sin topes'}
            sub={presupuesto.totalTope > 0 && presupuesto.diasRestantes > 0
              ? `${formatCurrency(presupuesto.porDia)} por día`
              : 'Tocá para definir topes'}
            color={presupuesto.excedidas.length > 0 ? theme.danger : theme.success}
            onPress={() => router.push('/budget')}
          />
          <Tile
            icon="wallet-outline"
            label="En cuentas"
            value={formatCurrency(enCuentas)}
            sub={deudasPersonales > 0 ? `Deudas personales ${formatCurrency(deudasPersonales)}` : 'Disponible hoy'}
            color={theme.text}
            onPress={() => router.push('/accounts')}
          />
        </View>

        {/* En qué se fue la plata */}
        <View style={[styles.card, shadow]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>En qué se fue la plata</Text>
            <TouchableOpacity onPress={() => router.push('/summary')}>
              <Text style={styles.link}>Ver resumen</Text>
            </TouchableOpacity>
          </View>
          {topCategorias.length === 0 ? (
            <Text style={styles.empty}>Todavía no hay gastos en {monthLabel(mes)}</Text>
          ) : topCategorias.map(c => (
            <View key={c.categoria} style={styles.catRow}>
              <View style={styles.catIcon}>
                <Ionicons name={iconoCategoria(c.categoria)} size={16} color={theme.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.catName}>{nombreCategoria(c.categoria)}</Text>
                  <Text style={styles.catAmount}>{formatCurrency(c.monto)}</Text>
                </View>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: `${(c.monto / maxCat) * 100}%` }]} />
                </View>
              </View>
            </View>
          ))}
          <Text style={styles.footnote}>Sin transferencias, pagos de tarjeta ni ahorro. Las cuotas cuentan mes a mes.</Text>
        </View>

        {/* Últimos movimientos */}
        <View style={[styles.card, shadow]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Últimos movimientos</Text>
            <TouchableOpacity onPress={() => router.push('/transactions')}>
              <Text style={styles.link}>Ver todos</Text>
            </TouchableOpacity>
          </View>
          {ultimas.length === 0 && <Text style={styles.empty}>Todavía no cargaron movimientos</Text>}
          {ultimas.map(t => {
            const esAhorroMov = esMovimientoAhorro(t);
            const entra = t.tipo === 'ingreso' && !esAhorroMov;
            const neutro = esAhorroMov || t.tipo === 'transferencia' || t.tipo === 'pago_tarjeta';
            return (
              <View key={t.id} style={styles.movRow}>
                <View style={[styles.catIcon, { backgroundColor: entra ? theme.successSoft : neutro ? theme.accentSoft : theme.dangerSoft }]}>
                  <Ionicons
                    name={entra ? 'arrow-up' : neutro ? 'swap-horizontal' : iconoCategoria(t.categoria)}
                    size={16}
                    color={entra ? theme.success : neutro ? theme.accent : theme.danger}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.movDesc} numberOfLines={1}>{t.descripcion}</Text>
                  <Text style={styles.movMeta}>{nombreCuenta(t.cuentaId)}</Text>
                </View>
                <Text style={[styles.movAmount, { color: entra ? theme.success : neutro ? theme.textSecondary : theme.danger }]}>
                  {entra ? '+' : neutro ? '' : '−'}{formatCurrency(t.monto)}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
      <Fab label="Cargar movimiento" />
    </View>
  );
}

function Legend({ color, text }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color }} />
      <Text style={{ fontSize: 12, color: theme.textSecondary }}>{text}</Text>
    </View>
  );
}

function Tile({ icon, label, value, sub, color, onPress }) {
  return (
    <TouchableOpacity style={[styles.tile, shadow]} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.tileHeader}>
        <Ionicons name={icon} size={16} color={theme.textSecondary} />
        <Text style={styles.tileLabel}>{label}</Text>
      </View>
      <Text style={[styles.tileValue, { color }]} numberOfLines={1}>{value}</Text>
      <Text style={styles.tileSub} numberOfLines={2}>{sub}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  hero: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
  },
  heroLabel: { fontSize: 14, color: theme.textSecondary },
  heroAmount: { fontSize: 36, fontWeight: '700', marginVertical: 4 },
  heroSub: { fontSize: 13, color: theme.textMuted, textAlign: 'center' },
  stackBar: {
    flexDirection: 'row',
    height: 10,
    width: '100%',
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: theme.surfaceMuted,
    marginTop: 16,
  },
  legendRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 14, marginTop: 10 },
  rec: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  recTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  recText: { fontSize: 13, color: theme.text, lineHeight: 18 },
  link: { color: theme.accent, fontWeight: '600', fontSize: 13, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 4 },
  tile: {
    width: '48.5%',
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    padding: 14,
    marginBottom: 10,
  },
  tileHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  tileLabel: { fontSize: 12, color: theme.textSecondary },
  tileValue: { fontSize: 19, fontWeight: '700' },
  tileSub: { fontSize: 11, color: theme.textMuted, marginTop: 3 },
  card: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    padding: 16,
    marginTop: 4,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: theme.text },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
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
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between' },
  barBg: { height: 6, backgroundColor: theme.surfaceMuted, borderRadius: 3, overflow: 'hidden', marginTop: 5 },
  barFill: { height: '100%', backgroundColor: theme.accent, borderRadius: 3 },
  footnote: { fontSize: 11, color: theme.textMuted, marginTop: 8 },
  empty: { fontSize: 13, color: theme.textMuted, paddingVertical: 12, textAlign: 'center' },
  movRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  movDesc: { fontSize: 14, color: theme.text, fontWeight: '500' },
  movMeta: { fontSize: 12, color: theme.textMuted },
  movAmount: { fontSize: 14, fontWeight: '600' },
});
