import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  RefreshControl
} from 'react-native';
import { theme } from '../../src/styles/theme';
import { PLACEHOLDER_COLOR } from '../../src/styles/global';
import { useFocusEffect } from '@react-navigation/native';
import { getDocs, doc, getDoc, setDoc, writeBatch, increment, arrayUnion } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import { ensureHousehold, dataCol, dataDoc } from '../../src/services/household';
import { formatCurrency, formatDate, getMonthName } from '../../src/utils/formatters';
import { Alert } from '../../src/utils/dialog';
import MonthPicker from '../../src/components/MonthPicker';
import {
  addMonths,
  currentMonthKey,
  metaAhorroDe,
  monthDiff,
  monthLabel,
  planAhorro,
  planDeAhorro,
  sugerirMetaAhorro,
  todayISO,
} from '../../src/utils/finance';

// Los datos viejos pueden tener campos faltantes o como texto: se normalizan
// para que un registro incompleto no rompa la pantalla.
const normalizarAhorros = (data = {}) => ({
  ...data,
  pesos: Number(data.pesos) || 0,
  usd: Number(data.usd) || 0,
  history: (Array.isArray(data.history) ? data.history : [])
    .filter(Boolean)
    .map((h, i) => ({
      ...h,
      id: h.id || `mov-${i}`,
      tipo: String(h.tipo || ''),
      descripcion: h.descripcion || '',
      monto: Number(h.monto) || 0,
      montoPesos: Number(h.montoPesos) || 0,
      cotizacion: Number(h.cotizacion) || null,
    }))
    .sort((a, b) => String(b.fechaCreacion || b.fecha).localeCompare(String(a.fechaCreacion || a.fecha))),
});

const parseMonto = (v) => parseFloat(String(v).replace(',', '.'));

const TIPOS_MOV = {
  ingreso_pesos: 'Guardado en pesos',
  egreso_pesos: 'Retiro de pesos',
  ingreso_usd: 'Compra USD',
  egreso_usd: 'Venta USD',
};

export default function SavingsScreen() {
  const [savings, setSavings] = useState(normalizarAhorros());
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editandoMeta, setEditandoMeta] = useState(false);
  const [metaInput, setMetaInput] = useState('');
  const [mesObjetivoInput, setMesObjetivoInput] = useState(`${currentMonthKey().slice(0, 4)}-12`);
  const [cotizacionInput, setCotizacionInput] = useState('');
  const [verMeses, setVerMeses] = useState(false);

  // Formulario de dólares
  const [tipoUSD, setTipoUSD] = useState('ingreso_usd');
  const [montoUSD, setMontoUSD] = useState('');
  const [montoPesos, setMontoPesos] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [cuentaId, setCuentaId] = useState('');
  const [saving, setSaving] = useState(false);

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
      setSavings(normalizarAhorros(savingsDoc.exists() ? savingsDoc.data() : {}));
    } catch (error) {
      console.error('Error cargando datos:', error);
      Alert.alert('Error', 'No se pudieron cargar los datos');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // ---------- Meta anual ----------
  const mesActual = currentMonthKey();
  const anio = mesActual.slice(0, 4);
  const meta = metaAhorroDe(savings, mesActual);
  const metaAnual = meta ? meta.monto : 0;
  const plan = meta ? planAhorro(transactions, meta, mesActual) : null;
  // Sugerencia: 20% de los ingresos por cada mes hasta el mes objetivo elegido
  const mesesHastaObjetivo = Math.max(1, monthDiff(mesActual, mesObjetivoInput) + 1);
  const metaSugerida = sugerirMetaAhorro(transactions, mesActual) * mesesHastaObjetivo;
  const recortes = plan && plan.faltaAnio > 0
    ? planDeAhorro(transactions, Math.max(plan.faltaMes, plan.cuotaSiguientes), mesActual).plan
    : [];
  const cotizacion = Number(savings.cotizacionUSD) || 1000;

  const guardarCampo = async (campos) => {
    try {
      await ensureHousehold();
      await setDoc(dataDoc('data', 'savings'), campos, { merge: true });
      await loadData();
    } catch (error) {
      console.error('Error guardando ahorro:', error);
      Alert.alert('Error', 'No se pudo guardar');
    }
  };

  const guardarMeta = async (valor) => {
    const n = typeof valor === 'number' ? valor : parseMonto(valor);
    if (isNaN(n) || n <= 0) {
      Alert.alert('Error', 'Ingresá un monto válido');
      return;
    }
    if (monthDiff(mesActual, mesObjetivoInput) < 0) {
      Alert.alert('Error', 'El mes objetivo no puede ser un mes que ya pasó');
      return;
    }
    // Se cuenta lo ahorrado desde enero del año en curso (o desde donde empezó la meta actual)
    const mesInicio = meta && monthDiff(meta.mesInicio, mesActual) >= 0 && !plan?.vencida
      ? meta.mesInicio
      : `${anio}-01`;
    await guardarCampo({ metaAhorro: { monto: n, mesInicio, mesObjetivo: mesObjetivoInput } });
    setEditandoMeta(false);
  };

  const empezarEdicion = () => {
    setMetaInput(meta ? String(meta.monto) : '');
    setMesObjetivoInput(meta && !plan?.vencida ? meta.mesObjetivo : `${anio}-12`);
    setEditandoMeta(true);
  };

  const guardarCotizacion = async () => {
    const n = parseMonto(cotizacionInput);
    if (isNaN(n) || n <= 0) {
      Alert.alert('Error', 'Ingresá una cotización válida');
      return;
    }
    await guardarCampo({ cotizacionUSD: n });
    setCotizacionInput('');
  };

  // ---------- Compra / venta de dólares ----------
  const cuentasCaja = accounts.filter(acc => acc.tipo === 'caja');

  const resetForm = () => {
    setTipoUSD('ingreso_usd');
    setMontoUSD('');
    setMontoPesos('');
    setDescripcion('');
    setCuentaId('');
    setModalVisible(false);
  };

  const handleSubmitUSD = async () => {
    if (saving) return;
    const usd = parseMonto(montoUSD);
    const pesos = parseMonto(montoPesos);
    const compra = tipoUSD === 'ingreso_usd';

    if (isNaN(usd) || usd <= 0 || isNaN(pesos) || pesos <= 0) {
      Alert.alert('Error', 'Ingresá el monto en dólares y en pesos');
      return;
    }
    const cuenta = accounts.find(acc => acc.id === cuentaId);
    if (!cuenta) {
      Alert.alert('Error', compra ? 'Elegí de qué cuenta salen los pesos' : 'Elegí a qué cuenta entran los pesos');
      return;
    }
    if (compra && cuenta.saldo < pesos) {
      Alert.alert('Error', `Saldo insuficiente en ${cuenta.nombre}. Disponible: ${formatCurrency(cuenta.saldo)}`);
      return;
    }
    if (!compra && savings.usd < usd) {
      Alert.alert('Error', `No tenés suficientes dólares. Disponible: US$ ${savings.usd.toFixed(2)}`);
      return;
    }

    const fecha = todayISO();
    const cot = pesos / usd;
    const desc = descripcion.trim() || (compra ? 'Compra de dólares' : 'Venta de dólares');
    const movimiento = {
      id: `savings-${Date.now()}`,
      fecha,
      tipo: tipoUSD,
      descripcion: desc,
      monto: usd,
      montoPesos: pesos,
      cotizacion: cot,
      cuenta: cuenta.nombre,
      fechaCreacion: new Date().toISOString(),
    };

    try {
      setSaving(true);
      await ensureHousehold();
      const batch = writeBatch(db);
      // Compra: salen pesos de la cuenta (cuenta como ahorro del mes).
      // Venta: los pesos vuelven a la cuenta (descuenta del ahorro del mes).
      batch.set(doc(dataCol('transactions')), {
        tipo: compra ? 'egreso' : 'ingreso',
        cuentaId: cuenta.id,
        categoria: 'AHORRO_USD',
        monto: pesos,
        descripcion: `${compra ? 'Compra' : 'Venta'} USD: ${desc}`,
        fecha,
        notas: `US$ ${usd} a $${cot.toFixed(2)}`,
        fechaCreacion: movimiento.fechaCreacion,
        registradoPor: auth.currentUser.email || '',
        afectaSaldo: true,
        movimientoAhorro: movimiento,
      });
      batch.update(dataDoc('accounts', cuenta.id), { saldo: increment(compra ? -pesos : pesos) });
      batch.set(dataDoc('data', 'savings'), {
        usd: increment(compra ? usd : -usd),
        cotizacionUSD: cot,
        history: arrayUnion(movimiento),
      }, { merge: true });
      await batch.commit();

      resetForm();
      await loadData();
      Alert.alert('Listo', `${compra ? 'Compra' : 'Venta'} de US$ ${usd} registrada`);
    } catch (error) {
      console.error('Error en movimiento de dólares:', error);
      Alert.alert('Error', 'No se pudo registrar el movimiento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >

      {/* Saldos */}
      <View style={styles.savingsGrid}>
        <View style={[styles.savingsCard, styles.pesosCard]}>
          <Text style={styles.savingsTitle}>Ahorro en Pesos</Text>
          <Text style={styles.savingsAmount}>{formatCurrency(savings.pesos)}</Text>
        </View>
        <View style={[styles.savingsCard, styles.usdCard]}>
          <Text style={styles.savingsTitle}>Ahorro en Dólares</Text>
          <Text style={styles.savingsAmount}>US$ {savings.usd.toFixed(2)}</Text>
          <Text style={styles.savingsSubtitle}>≈ {formatCurrency(savings.usd * cotizacion)}</Text>
        </View>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          🐷 Para <Text style={{ fontWeight: 'bold' }}>guardar o retirar pesos</Text> usá Transacciones → Ahorro.
        </Text>
      </View>

      {/* Meta anual */}
      <View style={styles.metaCard}>
        <Text style={styles.metaTitle}>
          🎯 Meta de ahorro{meta ? ` para ${monthLabel(meta.mesObjetivo)}` : ''}
        </Text>

        {plan?.vencida && (
          <Text style={[styles.metaHint, { color: theme.danger, fontWeight: 'bold' }]}>
            La fecha de esta meta ya pasó ({plan.faltaAnio > 0 ? `faltaron ${formatCurrency(plan.faltaAnio)}` : '¡se cumplió!'}). Poné una meta nueva.
          </Text>
        )}

        {plan ? (
          <>
            <View style={styles.metaRow}>
              <Text style={styles.metaAmount}>{formatCurrency(plan.netoAnio)}</Text>
              <Text style={styles.metaOf}>de {formatCurrency(metaAnual)}</Text>
            </View>
            <View style={styles.metaBarBg}>
              <View style={[styles.metaBarFill, { width: `${plan.progreso * 100}%` }]} />
            </View>
            <Text style={styles.metaHint}>
              {Math.round(plan.progreso * 100)}% cumplido
              {plan.faltaAnio > 0 ? ` • faltan ${formatCurrency(plan.faltaAnio)}` : ' • ¡Meta cumplida! 🎉'}
            </Text>
            <Text style={styles.metaHint}>
              Cuenta lo ahorrado desde {monthLabel(plan.mesInicio)}.
            </Text>

            {!plan.vencida && <View style={styles.cuotaBox}>
              <Text style={styles.cuotaLabel}>Este mes te toca ahorrar</Text>
              <Text style={styles.cuotaValue}>{formatCurrency(plan.cuotaMes)}</Text>
              <Text style={styles.metaHint}>
                Llevás {formatCurrency(plan.aporteMes)} este mes
                {plan.faltaMes > 0 ? ` • te faltan ${formatCurrency(plan.faltaMes)}` : ' • ¡cumplido! 🎉'}
              </Text>
            </View>}

            {plan.mesesDespues > 0 && (
              <View style={styles.cuotaBox}>
                <Text style={styles.cuotaLabel}>Desde el mes que viene</Text>
                <Text style={styles.cuotaValue}>{formatCurrency(plan.cuotaSiguientes)} / mes</Text>
                <Text style={styles.metaHint}>
                  Durante {plan.mesesDespues} {plan.mesesDespues === 1 ? 'mes' : 'meses'}, hasta {monthLabel(plan.mesObjetivo)}. Se recalcula solo cada vez que guardás o retirás ahorro.
                </Text>
              </View>
            )}

            {plan.capacidad !== null && plan.faltaAnio > 0 && (
              <Text style={[styles.metaHint, plan.capacidad < plan.cuotaSiguientes && { color: theme.danger, fontWeight: 'bold' }]}>
                {plan.capacidad < plan.cuotaSiguientes
                  ? `⚠️ Según sus ingresos y gastos les sobran unos ${formatCurrency(plan.capacidad)} por mes: no alcanza para la meta sin recortar gastos.`
                  : `✅ Según sus ingresos y gastos les sobran unos ${formatCurrency(plan.capacidad)} por mes: la meta es alcanzable.`}
              </Text>
            )}

            <TouchableOpacity onPress={() => setVerMeses(!verMeses)}>
              <Text style={[styles.linkText, { marginTop: 10 }]}>{verMeses ? '▲ Ocultar mes a mes' : '▼ Ver plan mes a mes'}</Text>
            </TouchableOpacity>

            {verMeses && (
              <View style={styles.tabla}>
                <View style={[styles.filaMes, styles.filaHeader]}>
                  <Text style={[styles.colMes, styles.headerText]}>Mes</Text>
                  <Text style={[styles.colNum, styles.headerText]}>Ahorrado</Text>
                  <Text style={[styles.colNum, styles.headerText]}>Objetivo</Text>
                </View>
                {plan.filas.map(f => (
                  <View key={f.key} style={[styles.filaMes, f.estado === 'actual' && styles.filaActual]}>
                    <Text style={styles.colMes}>
                      {monthLabel(f.key)}{f.estado === 'actual' ? ' (hoy)' : ''}
                    </Text>
                    <Text style={[styles.colNum, f.aporte < 0 && { color: theme.danger }]}>
                      {f.estado === 'futuro' ? '—' : formatCurrency(f.aporte)}
                    </Text>
                    <Text style={styles.colNum}>
                      {f.objetivo === null ? '' : formatCurrency(f.objetivo)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {recortes.length > 0 && (
              <View style={styles.planBox}>
                <Text style={styles.planTitle}>Ideas para llegar recortando gastos:</Text>
                {recortes.map(p => (
                  <Text key={p.categoria} style={styles.planItem}>
                    • Bajar {p.categoria} de {formatCurrency(p.actual)} a {formatCurrency(p.actual - p.recorte)} → +{formatCurrency(p.recorte)} por mes
                  </Text>
                ))}
              </View>
            )}
          </>
        ) : (
          <Text style={styles.metaHint}>
            Poné cuánto quieren tener ahorrado y para qué mes, y la app te dice cuánto separar cada mes.
            {metaSugerida > 0 ? ` Sugerencia para ${monthLabel(mesObjetivoInput)}: ${formatCurrency(metaSugerida)} (20% de sus ingresos).` : ''}
          </Text>
        )}

        {editandoMeta || !plan || plan.vencida ? (
          <View style={styles.metaForm}>
            <Text style={styles.label}>¿Cuánto quieren tener ahorrado?</Text>
            <TextInput
              placeholderTextColor={PLACEHOLDER_COLOR}
              style={styles.input}
              value={metaInput}
              onChangeText={setMetaInput}
              placeholder="Ej: 3000000"
              keyboardType="numeric"
            />
            <Text style={[styles.label, { marginTop: 12 }]}>¿Para qué mes?</Text>
            <MonthPicker
              value={mesObjetivoInput}
              onChange={(k) => setMesObjetivoInput(monthDiff(mesActual, k) < 0 ? mesActual : k)}
            />
            <Text style={styles.metaHint}>
              {mesesHastaObjetivo} {mesesHastaObjetivo === 1 ? 'mes' : 'meses'} desde hoy
              {parseMonto(metaInput) > 0 ? ` • unos ${formatCurrency(parseMonto(metaInput) / mesesHastaObjetivo)} por mes si empiezan de cero` : ''}
            </Text>
            <View style={styles.metaEditRow}>
              {editandoMeta && (
                <TouchableOpacity style={[styles.smallButton, { backgroundColor: theme.textSecondary }]} onPress={() => setEditandoMeta(false)}>
                  <Text style={styles.smallButtonText}>Cancelar</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.smallButton} onPress={() => guardarMeta(metaInput)}>
                <Text style={styles.smallButtonText}>Guardar meta</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.linkButton} onPress={empezarEdicion}>
            <Text style={styles.linkText}>✏️ Cambiar monto o mes</Text>
          </TouchableOpacity>
        )}
        {(!plan || plan.vencida) && metaSugerida > 0 && (
          <TouchableOpacity style={styles.linkButton} onPress={() => guardarMeta(metaSugerida)}>
            <Text style={styles.linkText}>Usar sugerida ({formatCurrency(metaSugerida)})</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Dólares */}
      <View style={styles.cotizacionRow}>
        <Text style={styles.cotizacionText}>Cotización USD: ${cotizacion}</Text>
        <TextInput
          placeholderTextColor={PLACEHOLDER_COLOR}
          style={styles.cotizacionInput}
          value={cotizacionInput}
          onChangeText={setCotizacionInput}
          placeholder="Nueva"
          keyboardType="numeric"
        />
        <TouchableOpacity style={styles.smallButton} onPress={guardarCotizacion}>
          <Text style={styles.smallButtonText}>OK</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
        <Text style={styles.addButtonText}>💵 Comprar / Vender dólares</Text>
      </TouchableOpacity>

      {/* Historial */}
      <Text style={styles.sectionTitle}>Historial de Movimientos</Text>
      {savings.history.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No hay movimientos registrados</Text>
        </View>
      ) : (
        savings.history.map((movimiento) => {
          const entra = movimiento.tipo.includes('ingreso');
          const esUSD = movimiento.tipo.includes('usd');
          return (
            <View key={movimiento.id} style={[styles.historyItem, entra ? styles.ingresoItem : styles.egresoItem]}>
              <View style={styles.historyInfo}>
                <Text style={styles.historyDesc}>{movimiento.descripcion}</Text>
                <View style={styles.historyMeta}>
                  <Text style={styles.historyDate}>{formatDate(movimiento.fecha)}</Text>
                  <Text style={styles.historyType}>{TIPOS_MOV[movimiento.tipo] || movimiento.tipo}</Text>
                </View>
                {!!movimiento.cotizacion && (
                  <Text style={styles.historyCotizacion}>Cotización: ${movimiento.cotizacion.toFixed(2)}</Text>
                )}
              </View>
              <View style={styles.historyAmount}>
                <Text style={[styles.historyValue, { color: entra ? theme.success : theme.danger }]}>
                  {entra ? '+' : '-'}
                  {esUSD ? `US$ ${movimiento.monto.toFixed(2)}` : formatCurrency(movimiento.monto)}
                </Text>
                {movimiento.montoPesos > 0 && (
                  <Text style={styles.historyConversion}>{formatCurrency(movimiento.montoPesos)}</Text>
                )}
              </View>
            </View>
          );
        })
      )}
      <View style={{ height: 30 }} />

      {/* Modal de dólares */}
      <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={resetForm}>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalTitle}>💵 Dólares</Text>

            <View style={styles.segmentedGrid}>
              {[['ingreso_usd', 'Comprar USD'], ['egreso_usd', 'Vender USD']].map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.segment, tipoUSD === key && styles.segmentActive]}
                  onPress={() => setTipoUSD(key)}
                >
                  <Text style={[styles.segmentText, tipoUSD === key && styles.segmentTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Dólares (US$)</Text>
              <TextInput placeholderTextColor={PLACEHOLDER_COLOR} style={styles.input} value={montoUSD} onChangeText={setMontoUSD} placeholder="0.00" keyboardType="numeric" />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{tipoUSD === 'ingreso_usd' ? 'Pesos que pagaste' : 'Pesos que recibiste'}</Text>
              <TextInput placeholderTextColor={PLACEHOLDER_COLOR} style={styles.input} value={montoPesos} onChangeText={setMontoPesos} placeholder="0.00" keyboardType="numeric" />
              {parseMonto(montoUSD) > 0 && parseMonto(montoPesos) > 0 && (
                <Text style={styles.metaHint}>Cotización: ${(parseMonto(montoPesos) / parseMonto(montoUSD)).toFixed(2)}</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{tipoUSD === 'ingreso_usd' ? 'Cuenta de donde salen los pesos' : 'Cuenta donde entran los pesos'}</Text>
              <View style={styles.picker}>
                {cuentasCaja.map(account => (
                  <TouchableOpacity
                    key={account.id}
                    style={[styles.pickerOption, cuentaId === account.id && styles.pickerOptionActive]}
                    onPress={() => setCuentaId(account.id)}
                  >
                    <Text style={[styles.pickerText, cuentaId === account.id && styles.pickerTextActive]}>
                      {account.nombre} - {formatCurrency(account.saldo)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Descripción (opcional)</Text>
              <TextInput placeholderTextColor={PLACEHOLDER_COLOR} style={styles.input} value={descripcion} onChangeText={setDescripcion} placeholder="Ej: Dólares para vacaciones" />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={resetForm}>
                <Text style={styles.buttonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.submitButton]} onPress={handleSubmitUSD} disabled={saving}>
                <Text style={styles.buttonText}>{saving ? 'Guardando...' : 'Registrar'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, padding: 15 },
  title: { fontSize: 24, fontWeight: 'bold', color: theme.text, marginBottom: 20 },
  savingsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  savingsCard: { width: '48.5%', padding: 16, borderRadius: 12, alignItems: 'center' },
  pesosCard: { backgroundColor: theme.success },
  usdCard: { backgroundColor: '#17a2b8' },
  savingsTitle: { color: 'white', fontSize: 13, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  savingsAmount: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  savingsSubtitle: { color: 'white', fontSize: 12, opacity: 0.9, marginTop: 4 },
  infoBox: { backgroundColor: '#eef0fd', borderRadius: 10, padding: 10, marginBottom: 15 },
  infoText: { fontSize: 13, color: theme.text },
  metaCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#17a2b8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  metaTitle: { fontSize: 17, fontWeight: 'bold', color: theme.text, marginBottom: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  metaAmount: { fontSize: 22, fontWeight: 'bold', color: '#17a2b8' },
  metaOf: { fontSize: 14, color: '#666' },
  metaBarBg: { height: 12, backgroundColor: '#e9ecef', borderRadius: 6, overflow: 'hidden', marginVertical: 8 },
  metaBarFill: { height: '100%', backgroundColor: '#17a2b8', borderRadius: 6 },
  metaHint: { fontSize: 12, color: '#666', marginTop: 4, lineHeight: 17 },
  cuotaBox: { backgroundColor: '#f1fafb', borderRadius: 10, padding: 12, marginTop: 10 },
  cuotaLabel: { fontSize: 13, color: '#555' },
  cuotaValue: { fontSize: 20, fontWeight: 'bold', color: theme.text, marginTop: 2 },
  metaForm: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  metaEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  linkButton: { paddingVertical: 6, marginTop: 4 },
  linkText: { color: theme.accent, fontWeight: '600', fontSize: 13 },
  tabla: { marginTop: 8, borderWidth: 1, borderColor: '#eee', borderRadius: 10, overflow: 'hidden' },
  filaMes: { flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#f3f3f3' },
  filaHeader: { backgroundColor: theme.bg },
  filaActual: { backgroundColor: '#fff8e1' },
  headerText: { fontWeight: 'bold', color: '#555' },
  colMes: { flex: 1.1, fontSize: 12, color: theme.text },
  colNum: { flex: 1, fontSize: 12, color: theme.text, textAlign: 'right' },
  planBox: { marginTop: 12, padding: 10, backgroundColor: '#e9f7ef', borderRadius: 8 },
  planTitle: { fontSize: 13, fontWeight: 'bold', color: '#1e7e34', marginBottom: 6 },
  planItem: { fontSize: 13, color: theme.text, marginBottom: 4 },
  cotizacionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  cotizacionText: { flex: 1, fontSize: 13, color: '#555' },
  cotizacionInput: {
    width: 80,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
    backgroundColor: 'white',
  },
  smallButton: { backgroundColor: theme.accent, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 6, justifyContent: 'center' },
  smallButtonText: { color: 'white', fontWeight: '600', fontSize: 13 },
  addButton: { backgroundColor: '#17a2b8', padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 20 },
  addButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: theme.text, marginBottom: 15 },
  emptyState: { backgroundColor: 'white', padding: 40, borderRadius: 12, alignItems: 'center' },
  emptyStateText: { fontSize: 16, color: theme.textSecondary },
  historyItem: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderLeftWidth: 4,
  },
  ingresoItem: { borderLeftColor: theme.success },
  egresoItem: { borderLeftColor: theme.danger },
  historyInfo: { flex: 1, marginRight: 10 },
  historyDesc: { fontSize: 15, fontWeight: '600', color: theme.text, marginBottom: 5 },
  historyMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  historyDate: { fontSize: 12, color: theme.textSecondary },
  historyType: { fontSize: 12, color: theme.accent, fontWeight: '600' },
  historyCotizacion: { fontSize: 11, color: '#999', fontStyle: 'italic' },
  historyAmount: { alignItems: 'flex-end' },
  historyValue: { fontSize: 15, fontWeight: 'bold', marginBottom: 4 },
  historyConversion: { fontSize: 12, color: theme.textSecondary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: 'white', borderRadius: 15, padding: 20, maxHeight: '85%', width: '100%', maxWidth: 480, alignSelf: 'center' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: theme.text, marginBottom: 15, textAlign: 'center' },
  segmentedGrid: { flexDirection: 'row', gap: 8, marginBottom: 15 },
  segment: {
    flex: 1,
    padding: 12,
    backgroundColor: theme.bg,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.border,
  },
  segmentActive: { backgroundColor: '#17a2b8', borderColor: '#17a2b8' },
  segmentText: { fontSize: 14, fontWeight: '600', color: theme.textSecondary },
  segmentTextActive: { color: 'white' },
  inputGroup: { marginBottom: 15 },
  label: { fontSize: 14, fontWeight: '600', color: theme.textSecondary, marginBottom: 8 },
  input: { borderWidth: 2, borderColor: theme.border, borderRadius: 10, padding: 12, fontSize: 16, backgroundColor: 'white' },
  picker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickerOption: { padding: 10, backgroundColor: theme.bg, borderRadius: 10, borderWidth: 2, borderColor: theme.border },
  pickerOptionActive: { backgroundColor: theme.accent, borderColor: theme.accent },
  pickerText: { fontSize: 13, color: theme.textSecondary },
  pickerTextActive: { color: 'white', fontWeight: '600' },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 10 },
  modalButton: { flex: 1, padding: 15, borderRadius: 10, alignItems: 'center' },
  cancelButton: { backgroundColor: theme.textSecondary },
  submitButton: { backgroundColor: theme.success },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});
