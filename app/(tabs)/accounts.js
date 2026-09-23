import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  RefreshControl
} from 'react-native';
import { PLACEHOLDER_COLOR } from '../../src/styles/global';
import { useFocusEffect } from '@react-navigation/native';
import { getDoc, getDocs, addDoc, deleteDoc, doc, updateDoc, writeBatch, increment } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import { ensureHousehold, dataCol, dataDoc } from '../../src/services/household';
import { formatCurrency, formatUSD } from '../../src/utils/formatters';
import { Alert } from '../../src/utils/dialog';
import {
  COMISION_TRANSFERENCIA_TARJETA,
  esUSD,
  saldoEnPesos,
  tasaDe,
  todayISO,
  infoTarjeta,
  currentMonthKey,
  monthLabel,
  proyeccionCuotas,
  cuotasPendientes,
} from '../../src/utils/finance';
import { Ionicons } from '@expo/vector-icons';
import { theme, shadow } from '../../src/styles/theme';
import { QuickActions } from '../../src/components/Fab';

const parseMonto = (v) => parseFloat(String(v).replace(',', '.')) || 0;

export default function AccountsScreen() {
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [expandedCard, setExpandedCard] = useState(null);

  // Estados del formulario
  const [tipoCuenta, setTipoCuenta] = useState('caja');
  const [moneda, setMoneda] = useState('ARS');
  const [tasa, setTasa] = useState(tasaDe());
  const [nombreCuenta, setNombreCuenta] = useState('');
  const [saldoInicial, setSaldoInicial] = useState('');
  const [limite, setLimite] = useState('');
  const [deudaActual, setDeudaActual] = useState('');
  const [diaCierre, setDiaCierre] = useState('');
  const [diaVencimiento, setDiaVencimiento] = useState('');
  const [comision, setComision] = useState('');
  const [montoTotal, setMontoTotal] = useState('');
  const [cuotaMensual, setCuotaMensual] = useState('');
  const [notasDeuda, setNotasDeuda] = useState('');

  // Pago de deuda personal
  const [pagoDeudaId, setPagoDeudaId] = useState(null);
  const [pagoMonto, setPagoMonto] = useState('');
  const [pagoCuentaId, setPagoCuentaId] = useState('');
  const [verFinalizadas, setVerFinalizadas] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      loadAccounts();
    }, [])
  );

  const loadAccounts = async () => {
    if (!auth.currentUser) return;

    try {
      await ensureHousehold();
      const [accountsSnapshot, transactionsSnapshot, savingsDoc] = await Promise.all([
        getDocs(dataCol('accounts')),
        getDocs(dataCol('transactions')),
        getDoc(dataDoc('data', 'savings')),
      ]);
      setTasa(tasaDe(savingsDoc.exists() ? savingsDoc.data() : {}));
      setAccounts(accountsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setTransactions(transactionsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('Error cargando cuentas:', error);
      Alert.alert('Error', 'No se pudieron cargar las cuentas');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAccounts();
    setRefreshing(false);
  };

  const handleSubmit = async () => {
    if (!nombreCuenta.trim()) {
      Alert.alert('Error', 'El nombre de la cuenta es obligatorio');
      return;
    }

    // Verificar si ya existe una cuenta con el mismo nombre
    const cuentaExistente = accounts.find(acc =>
      acc.id !== editingId &&
      acc.nombre.toLowerCase() === nombreCuenta.toLowerCase().trim()
    );

    if (cuentaExistente) {
      Alert.alert('Error', `Ya existe una cuenta con el nombre "${cuentaExistente.nombre}"`);
      return;
    }

    if (tipoCuenta === 'deuda' && parseMonto(montoTotal) <= 0) {
      Alert.alert('Error', 'Ingresá el monto total de la deuda');
      return;
    }

    if (tipoCuenta === 'tarjeta' && parseMonto(limite) <= 0) {
      Alert.alert('Error', 'Ingresá el límite de crédito de la tarjeta');
      return;
    }

    const dia = (v) => {
      const n = parseInt(v, 10);
      return n >= 1 && n <= 31 ? n : null;
    };

    try {
      await ensureHousehold();
      // En tarjetas y deudas el saldo negativo representa lo que se debe
      const total = parseMonto(montoTotal);
      const pendiente = deudaActual === '' ? total : parseMonto(deudaActual);
      const accountData = {
        tipo: tipoCuenta,
        nombre: nombreCuenta.trim(),
        saldo: tipoCuenta === 'tarjeta' ? -parseMonto(deudaActual)
          : tipoCuenta === 'deuda' ? -pendiente
          : parseMonto(saldoInicial),
      };

      if (tipoCuenta === 'caja') {
        accountData.moneda = moneda;
      }

      if (tipoCuenta === 'tarjeta') {
        accountData.limite = parseMonto(limite);
        accountData.diaCierre = dia(diaCierre);
        accountData.diaVencimiento = dia(diaVencimiento);
        accountData.comisionTransferencia = comision === '' ? COMISION_TRANSFERENCIA_TARJETA : parseMonto(comision);
      }

      if (tipoCuenta === 'deuda') {
        accountData.montoTotal = total;
        accountData.cuotaMensual = parseMonto(cuotaMensual) || null;
        accountData.notas = notasDeuda.trim();
        accountData.finalizada = pendiente <= 0;
      }

      if (editingId) {
        await updateDoc(dataDoc('accounts', editingId), accountData);
        Alert.alert('Éxito', `Cuenta "${accountData.nombre}" actualizada`);
      } else {
        accountData.fechaCreacion = new Date().toISOString();
        await addDoc(dataCol('accounts'), accountData);
        Alert.alert('Éxito', `Cuenta "${accountData.nombre}" creada exitosamente`);
      }

      resetForm();
      loadAccounts();

    } catch (error) {
      console.error('Error guardando cuenta:', error);
      Alert.alert('Error', 'No se pudo guardar la cuenta');
    }
  };

  const resetForm = () => {
    setTipoCuenta('caja');
    setMoneda('ARS');
    setNombreCuenta('');
    setSaldoInicial('');
    setLimite('');
    setDeudaActual('');
    setDiaCierre('');
    setDiaVencimiento('');
    setComision('');
    setMontoTotal('');
    setCuotaMensual('');
    setNotasDeuda('');
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (account) => {
    setEditingId(account.id);
    setTipoCuenta(account.tipo);
    setMoneda(esUSD(account) ? 'USD' : 'ARS');
    setNombreCuenta(account.nombre);
    if (account.tipo === 'deuda') {
      setMontoTotal(String(account.montoTotal || infoTarjeta(account).deuda));
      setDeudaActual(String(infoTarjeta(account).deuda));
      setCuotaMensual(account.cuotaMensual ? String(account.cuotaMensual) : '');
      setNotasDeuda(account.notas || '');
    } else if (account.tipo === 'tarjeta') {
      const { deuda } = infoTarjeta(account);
      setDeudaActual(deuda ? String(deuda) : '');
      setComision(String(account.comisionTransferencia ?? COMISION_TRANSFERENCIA_TARJETA));
      setLimite(account.limite ? String(account.limite) : '');
      setDiaCierre(account.diaCierre ? String(account.diaCierre) : '');
      setDiaVencimiento(account.diaVencimiento ? String(account.diaVencimiento) : '');
    } else {
      setSaldoInicial(String(account.saldo || 0));
    }
    setShowForm(true);
  };

  const deleteAccount = (account) => {
    const aviso = account.saldo !== 0
      ? `Esta cuenta tiene saldo ${esUSD(account) ? formatUSD(account.saldo) : formatCurrency(account.saldo)}. `
      : '';
    Alert.alert(
      'Eliminar Cuenta',
      `${aviso}¿Estás seguro de eliminar "${account.nombre}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await ensureHousehold();
              await deleteDoc(dataDoc('accounts', account.id));
              loadAccounts();
            } catch (error) {
              Alert.alert('Error', 'No se pudo eliminar la cuenta');
            }
          }
        }
      ]
    );
  };

  const registrarPagoDeuda = async (deuda) => {
    const montoPago = parseMonto(pagoMonto);
    const pendiente = infoTarjeta(deuda).deuda;
    const cuenta = accounts.find(a => a.id === pagoCuentaId);
    if (!(montoPago > 0)) {
      Alert.alert('Error', 'Ingresá cuánto pagaste');
      return;
    }
    if (montoPago > pendiente + 0.001) {
      Alert.alert('Error', `Solo quedan ${formatCurrency(pendiente)} por pagar`);
      return;
    }
    if (!cuenta) {
      Alert.alert('Error', 'Elegí de qué cuenta sale el pago');
      return;
    }
    if (cuenta.saldo < montoPago) {
      Alert.alert('Error', `Saldo insuficiente en ${cuenta.nombre}. Disponible: ${formatCurrency(cuenta.saldo)}`);
      return;
    }

    try {
      await ensureHousehold();
      const fecha = todayISO();
      const termina = montoPago >= pendiente - 0.001;
      const batch = writeBatch(db);
      batch.set(doc(dataCol('transactions')), {
        tipo: 'pago_tarjeta',
        cuentaId: cuenta.id,
        tarjetaId: deuda.id,
        categoria: 'PAGO_DEUDA',
        monto: montoPago,
        descripcion: `Pago deuda: ${deuda.nombre}`,
        fecha,
        notas: '',
        fechaCreacion: new Date().toISOString(),
        registradoPor: auth.currentUser.email || '',
        afectaSaldo: true,
      });
      batch.update(dataDoc('accounts', cuenta.id), { saldo: increment(-montoPago) });
      batch.update(dataDoc('accounts', deuda.id), {
        saldo: increment(montoPago),
        ...(termina ? { finalizada: true, fechaFinalizada: fecha } : {}),
      });
      await batch.commit();

      setPagoDeudaId(null);
      setPagoMonto('');
      setPagoCuentaId('');
      await loadAccounts();
      Alert.alert(termina ? 'Deuda terminada' : 'Pago registrado',
        termina ? `"${deuda.nombre}" quedó pagada por completo.` : `Quedan ${formatCurrency(pendiente - montoPago)} por pagar.`);
    } catch (error) {
      console.error('Error registrando pago:', error);
      Alert.alert('Error', 'No se pudo registrar el pago');
    }
  };

  const cajas = accounts.filter(a => a.tipo === 'caja');
  const deudas = accounts.filter(a => a.tipo === 'deuda' && !a.finalizada);
  const deudasFinalizadas = accounts.filter(a => a.tipo === 'deuda' && a.finalizada);
  const totalDeudas = deudas.reduce((s, a) => s + infoTarjeta(a).deuda, 0);
  const tarjetas = accounts.filter(a => a.tipo === 'tarjeta');
  const totalCaja = cajas.reduce((s, a) => s + saldoEnPesos(a, tasa), 0);
  const deudaTarjetas = tarjetas.reduce((s, a) => s + infoTarjeta(a).deuda, 0);
  const creditoDisponible = tarjetas.reduce((s, a) => s + Math.max(0, infoTarjeta(a).disponible || 0), 0);
  const mesActual = currentMonthKey();

  const renderAcciones = (account, claro = true) => (
    <View style={styles.inlineActions}>
      <TouchableOpacity style={[styles.iconButton, !claro && styles.iconButtonDark]} onPress={() => startEdit(account)}>
        <Ionicons name="create-outline" size={17} color={claro ? 'white' : theme.textSecondary} />
      </TouchableOpacity>
      <TouchableOpacity style={[styles.iconButton, !claro && styles.iconButtonDark]} onPress={() => deleteAccount(account)}>
        <Ionicons name="trash-outline" size={17} color={claro ? 'white' : theme.textSecondary} />
      </TouchableOpacity>
    </View>
  );

  const renderTarjeta = (account) => {
    const proyeccion = proyeccionCuotas(transactions, mesActual, 6, account.id);
    const pendientes = cuotasPendientes(transactions, mesActual, account.id);
    const expanded = expandedCard === account.id;
    const { limite, deuda, disponible, uso } = infoTarjeta(account);

    return (
      <View key={account.id} style={[styles.walletCard, { backgroundColor: theme.cardTarjeta }]}>
        <View style={styles.walletHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
            <Ionicons name="card-outline" size={18} color={theme.cardTarjetaSoft} />
            <Text style={[styles.walletName, { color: theme.cardTarjetaSoft }]} numberOfLines={1}>{account.nombre}</Text>
          </View>
          {renderAcciones(account)}
        </View>

        {limite > 0 ? (
          <>
            <Text style={styles.walletAmount}>
              {formatCurrency(disponible)} <Text style={[styles.walletAmountSub, { color: theme.cardTarjetaSoft }]}>disponible</Text>
            </Text>
            <View style={[styles.walletBar, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
              <View style={{
                width: `${Math.min(100, uso * 100)}%`,
                height: '100%',
                borderRadius: 3,
                backgroundColor: uso >= 0.8 ? '#F09595' : uso >= 0.5 ? '#FAC775' : '#9FE1CB',
              }} />
            </View>
            <Text style={[styles.walletMeta, { color: theme.cardTarjetaSoft }]}>
              Debés {formatCurrency(deuda)} de {formatCurrency(limite)} ({Math.round(uso * 100)}%)
              {account.diaVencimiento ? ` · vence día ${account.diaVencimiento}` : ''}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.walletAmount}>{formatCurrency(deuda)} <Text style={[styles.walletAmountSub, { color: theme.cardTarjetaSoft }]}>de deuda</Text></Text>
            <Text style={[styles.walletMeta, { color: '#FAC775' }]}>Sin límite cargado. Tocá el lápiz para agregarlo.</Text>
          </>
        )}

        <View style={styles.walletFooter}>
          <View>
            <Text style={[styles.walletMeta, { color: theme.cardTarjetaSoft }]}>A pagar este mes</Text>
            <Text style={styles.walletFooterValue}>{formatCurrency(proyeccion[0].total)}</Text>
          </View>
          <View>
            <Text style={[styles.walletMeta, { color: theme.cardTarjetaSoft }]}>Cuotas activas</Text>
            <Text style={styles.walletFooterValue}>{pendientes.length}</Text>
          </View>
          <TouchableOpacity onPress={() => setExpandedCard(expanded ? null : account.id)} style={styles.walletToggle}>
            <Text style={styles.walletToggleText}>{expanded ? 'Ocultar' : 'Ver cuotas'}</Text>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="white" />
          </TouchableOpacity>
        </View>

        {expanded && (
          <View style={styles.walletDetail}>
            <Text style={styles.detailTitle}>Próximos 6 meses</Text>
            {proyeccion.map(p => (
              <View key={p.key} style={styles.rowBetween}>
                <Text style={styles.detailText}>{monthLabel(p.key)}</Text>
                <Text style={styles.detailValue}>{formatCurrency(p.total)}</Text>
              </View>
            ))}
            <Text style={[styles.detailTitle, { marginTop: 12 }]}>Compras en cuotas</Text>
            {pendientes.length === 0 ? (
              <Text style={styles.detailMuted}>No hay compras en cuotas.</Text>
            ) : pendientes.map(t => (
              <View key={t.id} style={styles.cuotaItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailText}>{t.descripcion}</Text>
                  <Text style={styles.detailMuted}>
                    {t.pagadas > 0
                      ? `Cuota ${t.pagadas}/${t.cuotas}`
                      : `${t.cuotas} cuotas desde ${monthLabel(t.primerMesCuota)}`} de {formatCurrency(t.montoCuota)}
                  </Text>
                </View>
                <Text style={[styles.detailValue, { color: theme.danger }]}>Resta {formatCurrency(t.montoRestante)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderDeuda = (deuda) => {
    const pendiente = infoTarjeta(deuda).deuda;
    const total = Number(deuda.montoTotal) || pendiente;
    const pagado = Math.max(0, total - pendiente);
    const progreso = total > 0 ? pagado / total : 0;
    const pagando = pagoDeudaId === deuda.id;

    return (
      <View key={deuda.id} style={[styles.walletCard, { backgroundColor: theme.cardDeuda }]}>
        <View style={styles.walletHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
            <Ionicons name="people-outline" size={18} color={theme.cardDeudaSoft} />
            <Text style={[styles.walletName, { color: theme.cardDeudaSoft }]} numberOfLines={1}>{deuda.nombre}</Text>
          </View>
          {renderAcciones(deuda)}
        </View>
        <Text style={styles.walletAmount}>
          {formatCurrency(pendiente)} <Text style={[styles.walletAmountSub, { color: theme.cardDeudaSoft }]}>por pagar</Text>
        </Text>
        <View style={[styles.walletBar, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
          <View style={{ width: `${progreso * 100}%`, height: '100%', borderRadius: 3, backgroundColor: '#9FE1CB' }} />
        </View>
        <Text style={[styles.walletMeta, { color: theme.cardDeudaSoft }]}>
          Pagado {formatCurrency(pagado)} de {formatCurrency(total)} ({Math.round(progreso * 100)}%)
          {deuda.cuotaMensual ? ` · cuota ${formatCurrency(deuda.cuotaMensual)}, ~${Math.ceil(pendiente / deuda.cuotaMensual)} meses` : ''}
        </Text>
        {!!deuda.notas && <Text style={[styles.walletMeta, { color: theme.cardDeudaSoft }]}>{deuda.notas}</Text>}

        {pagando ? (
          <View style={styles.walletDetail}>
            <Text style={styles.label}>¿Cuánto pagaste?</Text>
            <TextInput
              placeholderTextColor={PLACEHOLDER_COLOR}
              style={styles.input}
              value={pagoMonto}
              onChangeText={setPagoMonto}
              placeholder={String(deuda.cuotaMensual || pendiente)}
              keyboardType="numeric"
            />
            <TouchableOpacity onPress={() => setPagoMonto(String(pendiente))}>
              <Text style={styles.link}>Pagar todo ({formatCurrency(pendiente)})</Text>
            </TouchableOpacity>
            <Text style={[styles.label, { marginTop: 8 }]}>Desde la cuenta</Text>
            <View style={styles.chips}>
              {cajas.filter(c => !esUSD(c)).map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.chip, pagoCuentaId === c.id && styles.chipActive]}
                  onPress={() => setPagoCuentaId(c.id)}
                >
                  <Text style={[styles.chipText, pagoCuentaId === c.id && styles.chipTextActive]}>
                    {c.nombre} ({formatCurrency(c.saldo)})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.formButtons}>
              <TouchableOpacity style={[styles.button, styles.buttonGhost]} onPress={() => setPagoDeudaId(null)}>
                <Text style={[styles.buttonText, { color: theme.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.buttonSuccess]} onPress={() => registrarPagoDeuda(deuda)}>
                <Text style={styles.buttonText}>Registrar pago</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.walletAction}
            onPress={() => { setPagoDeudaId(deuda.id); setPagoMonto(''); setPagoCuentaId(''); }}
          >
            <Ionicons name="cash-outline" size={16} color={theme.cardDeuda} />
            <Text style={[styles.walletActionText, { color: theme.cardDeuda }]}>Registrar pago</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderFormulario = () => (
    <View style={[styles.form, shadow]}>
      <Text style={styles.formTitle}>{editingId ? 'Editar' : 'Agregar a la billetera'}</Text>

      {!editingId && (
        <View style={styles.typeRow}>
          {[
            ['caja', 'Cuenta', 'business-outline'],
            ['tarjeta', 'Tarjeta', 'card-outline'],
            ['deuda', 'Deuda', 'people-outline'],
          ].map(([key, label, icon]) => (
            <TouchableOpacity
              key={key}
              style={[styles.typeOption, tipoCuenta === key && styles.typeOptionActive]}
              onPress={() => setTipoCuenta(key)}
            >
              <Ionicons name={icon} size={20} color={tipoCuenta === key ? 'white' : theme.textSecondary} />
              <Text style={[styles.typeText, tipoCuenta === key && { color: 'white' }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Campo label="Nombre">
        <TextInput
          placeholderTextColor={PLACEHOLDER_COLOR}
          style={styles.input}
          value={nombreCuenta}
          onChangeText={setNombreCuenta}
          placeholder={tipoCuenta === 'tarjeta' ? 'Visa Galicia'
            : tipoCuenta === 'deuda' ? 'Préstamo de papá'
            : 'Banco Nación, Mercado Pago, Efectivo'}
        />
      </Campo>

      {tipoCuenta === 'caja' && (
        <>
          <Campo label="Moneda">
            <View style={styles.chips}>
              {[['ARS', 'Pesos ($)'], ['USD', 'Dólares (US$)']].map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.chip, moneda === key && styles.chipActive]}
                  onPress={() => setMoneda(key)}
                >
                  <Text style={[styles.chipText, moneda === key && styles.chipTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Campo>
          <Campo
            label={`${editingId ? 'Saldo actual' : 'Saldo inicial'} (${moneda === 'USD' ? 'US$' : '$'})`}
            help={moneda === 'USD' ? `Se muestra también en pesos con la tasa de la solapa Dólares ($${tasa}).` : undefined}
          >
            <TextInput placeholderTextColor={PLACEHOLDER_COLOR} style={styles.input} value={saldoInicial} onChangeText={setSaldoInicial} placeholder="0" keyboardType="numeric" />
          </Campo>
        </>
      )}

      {tipoCuenta === 'tarjeta' && (
        <>
          <Campo label="Límite de crédito" help="El máximo que el banco te deja gastar.">
            <TextInput placeholderTextColor={PLACEHOLDER_COLOR} style={styles.input} value={limite} onChangeText={setLimite} placeholder="500000" keyboardType="numeric" />
          </Campo>
          <Campo label="Deuda actual" help="Lo que ya debés, incluyendo cuotas a vencer.">
            <TextInput placeholderTextColor={PLACEHOLDER_COLOR} style={styles.input} value={deudaActual} onChangeText={setDeudaActual} placeholder="0" keyboardType="numeric" />
          </Campo>
          <View style={styles.rowInputs}>
            <View style={{ flex: 1 }}>
              <Campo label="Día de cierre">
                <TextInput placeholderTextColor={PLACEHOLDER_COLOR} style={styles.input} value={diaCierre} onChangeText={setDiaCierre} placeholder="25" keyboardType="numeric" />
              </Campo>
            </View>
            <View style={{ flex: 1 }}>
              <Campo label="Día de vencimiento">
                <TextInput placeholderTextColor={PLACEHOLDER_COLOR} style={styles.input} value={diaVencimiento} onChangeText={setDiaVencimiento} placeholder="5" keyboardType="numeric" />
              </Campo>
            </View>
          </View>
          <Campo label="Comisión al pasar plata a una cuenta (%)" help={`Por defecto ${COMISION_TRANSFERENCIA_TARJETA}%.`}>
            <TextInput placeholderTextColor={PLACEHOLDER_COLOR} style={styles.input} value={comision} onChangeText={setComision} placeholder={String(COMISION_TRANSFERENCIA_TARJETA)} keyboardType="numeric" />
          </Campo>
        </>
      )}

      {tipoCuenta === 'deuda' && (
        <>
          <Campo label="Monto total de la deuda">
            <TextInput placeholderTextColor={PLACEHOLDER_COLOR} style={styles.input} value={montoTotal} onChangeText={setMontoTotal} placeholder="1000000" keyboardType="numeric" />
          </Campo>
          <Campo label="Lo que falta pagar" help="Dejalo vacío si todavía no pagaste nada.">
            <TextInput placeholderTextColor={PLACEHOLDER_COLOR} style={styles.input} value={deudaActual} onChangeText={setDeudaActual} placeholder={montoTotal || 'Igual al total'} keyboardType="numeric" />
          </Campo>
          <Campo label="Cuota mensual (opcional)">
            <TextInput placeholderTextColor={PLACEHOLDER_COLOR} style={styles.input} value={cuotaMensual} onChangeText={setCuotaMensual} placeholder="50000" keyboardType="numeric" />
          </Campo>
          <Campo label="Notas (opcional)">
            <TextInput placeholderTextColor={PLACEHOLDER_COLOR} style={styles.input} value={notasDeuda} onChangeText={setNotasDeuda} placeholder="A quién se le debe, fecha acordada" />
          </Campo>
        </>
      )}

      <View style={styles.formButtons}>
        <TouchableOpacity style={[styles.button, styles.buttonGhost]} onPress={resetForm}>
          <Text style={[styles.buttonText, { color: theme.textSecondary }]}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.buttonPrimary]} onPress={handleSubmit}>
          <Text style={styles.buttonText}>{editingId ? 'Guardar' : 'Agregar'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const patrimonio = totalCaja - deudaTarjetas - totalDeudas;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Resumen */}
        <View style={[styles.summary, shadow]}>
          <Text style={styles.summaryLabel}>Neto (cuentas menos deudas)</Text>
          <Text style={[styles.summaryAmount, { color: patrimonio >= 0 ? theme.text : theme.danger }]}>
            {formatCurrency(patrimonio)}
          </Text>
          <View style={styles.summaryRow}>
            <SummaryItem label="En cuentas" value={totalCaja} color={theme.success} />
            <SummaryItem label="Tarjetas" value={-deudaTarjetas} color={theme.danger} />
            <SummaryItem label="Deudas" value={-totalDeudas} color={theme.danger} />
          </View>
          {creditoDisponible > 0 && (
            <Text style={styles.summaryHint}>Crédito disponible en tarjetas: {formatCurrency(creditoDisponible)}</Text>
          )}
        </View>

        <QuickActions />

        {showForm && renderFormulario()}

        {accounts.length === 0 && !showForm && (
          <View style={[styles.form, shadow, { alignItems: 'center' }]}>
            <Ionicons name="wallet-outline" size={40} color={theme.accent} />
            <Text style={[styles.formTitle, { marginTop: 8 }]}>Agreguen su primera cuenta</Text>
            <Text style={styles.help}>Banco, billetera virtual, efectivo, tarjetas de crédito o deudas.</Text>
          </View>
        )}

        {/* Cuentas */}
        {cajas.length > 0 && <Text style={styles.sectionTitle}>Cuentas</Text>}
        {cajas.map(account => {
          const usd = esUSD(account);
          const soft = usd ? theme.cardUsdSoft : theme.cardCuentaSoft;
          return (
            <View key={account.id} style={[styles.walletCard, { backgroundColor: usd ? theme.cardUsd : theme.cardCuenta }]}>
              <View style={styles.walletHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
                  <Ionicons name={usd ? 'logo-usd' : 'business-outline'} size={18} color={soft} />
                  <Text style={[styles.walletName, { color: soft }]} numberOfLines={1}>{account.nombre}</Text>
                </View>
                {renderAcciones(account)}
              </View>
              <Text style={[styles.walletAmount, account.saldo < 0 && { color: '#F7C1C1' }]}>
                {usd ? formatUSD(account.saldo) : formatCurrency(account.saldo)}
              </Text>
              <Text style={[styles.walletMeta, { color: soft }]}>
                {usd ? `≈ ${formatCurrency(account.saldo * tasa)} (a $${tasa})` : 'Disponible'}
              </Text>
            </View>
          );
        })}

        {/* Tarjetas */}
        {tarjetas.length > 0 && <Text style={styles.sectionTitle}>Tarjetas de crédito</Text>}
        {tarjetas.map(renderTarjeta)}

        {/* Deudas personales */}
        {deudas.length > 0 && <Text style={styles.sectionTitle}>Deudas personales</Text>}
        {deudas.map(renderDeuda)}

        {deudasFinalizadas.length > 0 && (
          <TouchableOpacity onPress={() => setVerFinalizadas(!verFinalizadas)}>
            <Text style={[styles.link, { textAlign: 'center' }]}>
              {verFinalizadas ? 'Ocultar' : 'Ver'} deudas terminadas ({deudasFinalizadas.length})
            </Text>
          </TouchableOpacity>
        )}
        {verFinalizadas && deudasFinalizadas.map(deuda => (
          <View key={deuda.id} style={[styles.doneCard, shadow]}>
            <Ionicons name="checkmark-circle" size={22} color={theme.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.doneName}>{deuda.nombre}</Text>
              <Text style={styles.help}>
                Pagada {formatCurrency(Number(deuda.montoTotal) || 0)}
                {deuda.fechaFinalizada ? ` · terminada el ${deuda.fechaFinalizada.split('-').reverse().join('/')}` : ''}
              </Text>
            </View>
            {renderAcciones(deuda, false)}
          </View>
        ))}

        {!showForm && (
          <TouchableOpacity style={styles.addButton} onPress={() => setShowForm(true)}>
            <Ionicons name="add-circle-outline" size={20} color={theme.accent} />
            <Text style={styles.addButtonText}>Agregar cuenta, tarjeta o deuda</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

function Campo({ label, help, children }) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {help ? <Text style={styles.help}>{help}</Text> : null}
    </View>
  );
}

function SummaryItem({ label, value, color }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={styles.summaryItemLabel}>{label}</Text>
      <Text style={[styles.summaryItemValue, { color }]} numberOfLines={1}>{formatCurrency(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  summary: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    padding: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryLabel: { fontSize: 13, color: theme.textSecondary },
  summaryAmount: { fontSize: 30, fontWeight: '700', marginVertical: 4 },
  summaryRow: { flexDirection: 'row', marginTop: 10, width: '100%' },
  summaryItemLabel: { fontSize: 12, color: theme.textMuted },
  summaryItemValue: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  summaryHint: { fontSize: 12, color: theme.textMuted, marginTop: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.text, marginTop: 8, marginBottom: 10 },
  walletCard: { borderRadius: 16, padding: 16, marginBottom: 12 },
  walletHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  walletName: { fontSize: 14, fontWeight: '600' },
  walletAmount: { fontSize: 26, fontWeight: '700', color: 'white' },
  walletAmountSub: { fontSize: 13, fontWeight: '400' },
  walletBar: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 10, marginBottom: 6 },
  walletMeta: { fontSize: 12, marginTop: 2 },
  walletFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  walletFooterValue: { color: 'white', fontSize: 15, fontWeight: '600', marginTop: 2 },
  walletToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  walletToggleText: { color: 'white', fontSize: 12, fontWeight: '600' },
  walletDetail: { backgroundColor: theme.surface, borderRadius: 12, padding: 12, marginTop: 12 },
  walletAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'white',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 12,
  },
  walletActionText: { fontSize: 14, fontWeight: '600' },
  detailTitle: { fontSize: 13, fontWeight: '700', color: theme.text, marginBottom: 6 },
  detailText: { fontSize: 13, color: theme.text },
  detailValue: { fontSize: 13, fontWeight: '600', color: theme.text },
  detailMuted: { fontSize: 12, color: theme.textMuted },
  cuotaItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.surfaceMuted },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  inlineActions: { flexDirection: 'row', gap: 6 },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonDark: { backgroundColor: theme.surfaceMuted },
  doneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  doneName: { fontSize: 14, fontWeight: '600', color: theme.text },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: theme.accent,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 8,
  },
  addButtonText: { color: theme.accent, fontSize: 15, fontWeight: '600' },
  form: { backgroundColor: theme.surface, borderRadius: theme.radius, padding: 18, marginBottom: 16 },
  formTitle: { fontSize: 18, fontWeight: '700', color: theme.text, marginBottom: 14 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeOption: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surfaceMuted,
  },
  typeOptionActive: { backgroundColor: theme.accent, borderColor: theme.accent },
  typeText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  inputGroup: { marginBottom: 14 },
  rowInputs: { flexDirection: 'row', gap: 10 },
  label: { fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginBottom: 6 },
  help: { fontSize: 12, color: theme.textMuted, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: theme.surface,
    color: theme.text,
  },
  link: { color: theme.accent, fontWeight: '600', fontSize: 13, marginVertical: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: theme.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.border,
  },
  chipActive: { backgroundColor: theme.accent, borderColor: theme.accent },
  chipText: { fontSize: 12, color: theme.textSecondary },
  chipTextActive: { color: 'white', fontWeight: '600' },
  formButtons: { flexDirection: 'row', gap: 10, marginTop: 10 },
  button: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  buttonPrimary: { backgroundColor: theme.accent },
  buttonSuccess: { backgroundColor: theme.success },
  buttonGhost: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  buttonText: { color: 'white', fontSize: 15, fontWeight: '600' },
});
