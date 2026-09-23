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
import { getDocs, addDoc, deleteDoc, doc, updateDoc, writeBatch, increment } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import { ensureHousehold, dataCol, dataDoc } from '../../src/services/household';
import { formatCurrency } from '../../src/utils/formatters';
import { Alert } from '../../src/utils/dialog';
import {
  COMISION_TRANSFERENCIA_TARJETA,
  todayISO,
  infoTarjeta,
  currentMonthKey,
  monthLabel,
  proyeccionCuotas,
  cuotasPendientes,
} from '../../src/utils/finance';
import CreditCardStatus from '../../src/components/CreditCardStatus';

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
      const [accountsSnapshot, transactionsSnapshot] = await Promise.all([
        getDocs(dataCol('accounts')),
        getDocs(dataCol('transactions')),
      ]);
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
      ? `Esta cuenta tiene saldo ${formatCurrency(account.saldo)}. `
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
      Alert.alert(termina ? '🎉 ¡Deuda terminada!' : 'Pago registrado',
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
  const totalCaja = cajas.reduce((s, a) => s + (a.saldo || 0), 0);
  const deudaTarjetas = tarjetas.reduce((s, a) => s + infoTarjeta(a).deuda, 0);
  const creditoDisponible = tarjetas.reduce((s, a) => s + Math.max(0, infoTarjeta(a).disponible || 0), 0);
  const mesActual = currentMonthKey();

  const renderTarjeta = (account) => {
    const proyeccion = proyeccionCuotas(transactions, mesActual, 6, account.id);
    const pendientes = cuotasPendientes(transactions, mesActual, account.id);
    const expanded = expandedCard === account.id;

    return (
      <View key={account.id} style={[styles.accountItem, styles.tarjetaItem]}>
        <View style={styles.accountHeader}>
          <Text style={styles.accountName}>💳 {account.nombre}</Text>
          <View style={styles.inlineActions}>
            <TouchableOpacity style={styles.editButton} onPress={() => startEdit(account)}>
              <Text style={styles.smallButtonText}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteButton} onPress={() => deleteAccount(account)}>
              <Text style={styles.smallButtonText}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        </View>

        <CreditCardStatus account={account} />

        {(account.diaCierre || account.diaVencimiento) && (
          <Text style={styles.accountDate}>
            {account.diaCierre ? `Cierre: día ${account.diaCierre}` : ''}
            {account.diaCierre && account.diaVencimiento ? '  •  ' : ''}
            {account.diaVencimiento ? `Vencimiento: día ${account.diaVencimiento}` : ''}
          </Text>
        )}

        <View style={styles.cuotasBox}>
          <View style={styles.row}>
            <Text style={styles.cuotasLabel}>A pagar en {monthLabel(mesActual)}</Text>
            <Text style={styles.cuotasValue}>{formatCurrency(proyeccion[0].total)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cuotasLabel}>Compras en cuotas activas</Text>
            <Text style={styles.cuotasValue}>{pendientes.length}</Text>
          </View>

          <TouchableOpacity onPress={() => setExpandedCard(expanded ? null : account.id)}>
            <Text style={styles.linkText}>{expanded ? '▲ Ocultar detalle' : '▼ Ver cuotas mes a mes'}</Text>
          </TouchableOpacity>

          {expanded && (
            <>
              <Text style={styles.subTitle}>Próximos 6 meses</Text>
              {proyeccion.map(p => (
                <View key={p.key} style={styles.row}>
                  <Text style={styles.cuotasLabel}>{monthLabel(p.key)}</Text>
                  <Text style={styles.cuotasValue}>{formatCurrency(p.total)}</Text>
                </View>
              ))}

              <Text style={styles.subTitle}>Cuotas pendientes</Text>
              {pendientes.length === 0 ? (
                <Text style={styles.accountDate}>No hay compras en cuotas.</Text>
              ) : (
                pendientes.map(t => (
                  <View key={t.id} style={styles.cuotaItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cuotaDesc}>{t.descripcion}</Text>
                      <Text style={styles.accountDate}>
                        {t.pagadas > 0
                          ? `Cuota ${t.pagadas}/${t.cuotas}`
                          : `${t.cuotas} cuotas desde ${monthLabel(t.primerMesCuota)}`} de {formatCurrency(t.montoCuota)} • Total {formatCurrency(t.monto)}
                      </Text>
                    </View>
                    <Text style={styles.cuotaRestante}>
                      Resta {formatCurrency(t.montoRestante)}
                    </Text>
                  </View>
                ))
              )}
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.title}>Gestión de Cuentas</Text>

      {/* Resumen */}
      <View style={styles.summaryGrid}>
        <View style={[styles.summaryCard, styles.primaryCard]}>
          <Text style={styles.summaryTitle}>Dinero en cuentas</Text>
          <Text style={styles.summaryAmount}>{formatCurrency(totalCaja)}</Text>
        </View>
        <View style={[styles.summaryCard, styles.dangerCard]}>
          <Text style={styles.summaryTitle}>Deuda tarjetas</Text>
          <Text style={styles.summaryAmount}>{formatCurrency(deudaTarjetas)}</Text>
        </View>
        <View style={[styles.summaryCard, styles.warningCard]}>
          <Text style={styles.summaryTitle}>Deudas personales</Text>
          <Text style={styles.summaryAmount}>{formatCurrency(totalDeudas)}</Text>
        </View>
        <View style={[styles.summaryCard, styles.successCard]}>
          <Text style={styles.summaryTitle}>Neto (cuentas − deudas)</Text>
          <Text style={styles.summaryAmount}>{formatCurrency(totalCaja - deudaTarjetas - totalDeudas)}</Text>
        </View>
        <View style={[styles.summaryCard, styles.infoCard]}>
          <Text style={styles.summaryTitle}>Crédito disponible</Text>
          <Text style={styles.summaryAmount}>{formatCurrency(creditoDisponible)}</Text>
        </View>
      </View>

      {/* Botón para mostrar formulario */}
      {!showForm && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowForm(true)}
        >
          <Text style={styles.addButtonText}>+ Agregar Nueva Cuenta</Text>
        </TouchableOpacity>
      )}

      {/* Formulario de cuenta */}
      {showForm && (
        <View style={styles.form}>
          <Text style={styles.formTitle}>{editingId ? 'Editar Cuenta' : 'Nueva Cuenta'}</Text>

          {!editingId && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Tipo de Cuenta</Text>
              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[styles.segment, tipoCuenta === 'caja' && styles.segmentActive]}
                  onPress={() => setTipoCuenta('caja')}
                >
                  <Text style={[styles.segmentText, tipoCuenta === 'caja' && styles.segmentTextActive]}>
                    🏦 Cuenta / Efectivo
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segment, tipoCuenta === 'tarjeta' && styles.segmentActive]}
                  onPress={() => setTipoCuenta('tarjeta')}
                >
                  <Text style={[styles.segmentText, tipoCuenta === 'tarjeta' && styles.segmentTextActive]}>
                    💳 Tarjeta de Crédito
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segment, tipoCuenta === 'deuda' && styles.segmentActive]}
                  onPress={() => setTipoCuenta('deuda')}
                >
                  <Text style={[styles.segmentText, tipoCuenta === 'deuda' && styles.segmentTextActive]}>
                    🤝 Deuda personal
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nombre</Text>
            <TextInput
              placeholderTextColor={PLACEHOLDER_COLOR}
              style={styles.input}
              value={nombreCuenta}
              onChangeText={setNombreCuenta}
              placeholder={tipoCuenta === 'tarjeta' ? 'Ej: Visa Galicia, Mastercard...'
                : tipoCuenta === 'deuda' ? 'Ej: Préstamo de papá, Crédito del banco...'
                : 'Ej: Banco Nación, Mercado Pago...'}
            />
          </View>

          {tipoCuenta === 'deuda' ? (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Monto total de la deuda</Text>
                <TextInput
                  placeholderTextColor={PLACEHOLDER_COLOR}
                  style={styles.input}
                  value={montoTotal}
                  onChangeText={setMontoTotal}
                  placeholder="Ej: 1000000"
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Lo que falta pagar</Text>
                <TextInput
                  placeholderTextColor={PLACEHOLDER_COLOR}
                  style={styles.input}
                  value={deudaActual}
                  onChangeText={setDeudaActual}
                  placeholder={montoTotal || 'Igual al total si todavía no pagaste nada'}
                  keyboardType="numeric"
                />
                <Text style={styles.help}>Dejalo vacío si todavía no pagaste nada.</Text>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Cuota mensual (opcional)</Text>
                <TextInput
                  placeholderTextColor={PLACEHOLDER_COLOR}
                  style={styles.input}
                  value={cuotaMensual}
                  onChangeText={setCuotaMensual}
                  placeholder="Ej: 50000"
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Notas (opcional)</Text>
                <TextInput
                  placeholderTextColor={PLACEHOLDER_COLOR}
                  style={styles.input}
                  value={notasDeuda}
                  onChangeText={setNotasDeuda}
                  placeholder="Ej: a quién se le debe, fecha acordada..."
                />
              </View>
            </>
          ) : tipoCuenta === 'caja' ? (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{editingId ? 'Saldo actual' : 'Saldo inicial'}</Text>
              <TextInput
                placeholderTextColor={PLACEHOLDER_COLOR}
                style={styles.input}
                value={saldoInicial}
                onChangeText={setSaldoInicial}
                placeholder="0.00"
                keyboardType="numeric"
              />
            </View>
          ) : (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Límite de crédito</Text>
                <TextInput
                  placeholderTextColor={PLACEHOLDER_COLOR}
                  style={styles.input}
                  value={limite}
                  onChangeText={setLimite}
                  placeholder="Ej: 500000"
                  keyboardType="numeric"
                />
                <Text style={styles.help}>El máximo que el banco te permite gastar con esta tarjeta.</Text>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Deuda actual</Text>
                <TextInput
                  placeholderTextColor={PLACEHOLDER_COLOR}
                  style={styles.input}
                  value={deudaActual}
                  onChangeText={setDeudaActual}
                  placeholder="0.00"
                  keyboardType="numeric"
                />
                <Text style={styles.help}>Lo que ya debés hoy en la tarjeta (incluyendo cuotas a vencer).</Text>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Comisión al transferir a una cuenta (%)</Text>
                <TextInput
                  placeholderTextColor={PLACEHOLDER_COLOR}
                  style={styles.input}
                  value={comision}
                  onChangeText={setComision}
                  placeholder={String(COMISION_TRANSFERENCIA_TARJETA)}
                  keyboardType="numeric"
                />
                <Text style={styles.help}>Lo que cobra la tarjeta al pasar plata a una cuenta. Por defecto {COMISION_TRANSFERENCIA_TARJETA}%.</Text>
              </View>
              <View style={styles.rowInputs}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Día de cierre</Text>
                  <TextInput
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    style={styles.input}
                    value={diaCierre}
                    onChangeText={setDiaCierre}
                    placeholder="Ej: 25"
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Día de vencimiento</Text>
                  <TextInput
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    style={styles.input}
                    value={diaVencimiento}
                    onChangeText={setDiaVencimiento}
                    placeholder="Ej: 5"
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </>
          )}

          <View style={styles.formButtons}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={resetForm}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.submitButton]}
              onPress={handleSubmit}
            >
              <Text style={styles.submitButtonText}>{editingId ? 'Guardar' : 'Crear Cuenta'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {accounts.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No hay cuentas creadas</Text>
          <Text style={styles.emptyStateSubtext}>
            Presiona "Agregar Nueva Cuenta" para comenzar
          </Text>
        </View>
      )}

      {/* Cuentas y efectivo */}
      {cajas.length > 0 && (
        <Text style={styles.sectionTitle}>🏦 Cuentas ({cajas.length})</Text>
      )}
      {cajas.map(account => (
        <View key={account.id} style={[styles.accountItem, styles.cajaItem]}>
          <View style={styles.accountHeader}>
            <Text style={styles.accountName}>{account.nombre}</Text>
            <Text style={[
              styles.accountBalance,
              { color: account.saldo >= 0 ? '#28a745' : '#dc3545' }
            ]}>
              {formatCurrency(account.saldo)}
            </Text>
          </View>
          <View style={styles.accountFooter}>
            <Text style={styles.accountDate}>
              {account.fechaCreacion ? `Creada: ${new Date(account.fechaCreacion).toLocaleDateString('es-AR')}` : ''}
            </Text>
            <View style={styles.inlineActions}>
              <TouchableOpacity style={styles.editButton} onPress={() => startEdit(account)}>
                <Text style={styles.smallButtonText}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteButton} onPress={() => deleteAccount(account)}>
                <Text style={styles.smallButtonText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ))}

      {/* Tarjetas de crédito */}
      {tarjetas.length > 0 && (
        <Text style={[styles.sectionTitle, { marginTop: 10 }]}>💳 Tarjetas de crédito ({tarjetas.length})</Text>
      )}
      {tarjetas.map(renderTarjeta)}

      {/* Deudas personales */}
      {deudas.length > 0 && (
        <Text style={[styles.sectionTitle, { marginTop: 10 }]}>🤝 Deudas personales ({deudas.length})</Text>
      )}
      {deudas.map(deuda => {
        const pendiente = infoTarjeta(deuda).deuda;
        const total = Number(deuda.montoTotal) || pendiente;
        const pagado = Math.max(0, total - pendiente);
        const progreso = total > 0 ? pagado / total : 0;
        const pagando = pagoDeudaId === deuda.id;
        return (
          <View key={deuda.id} style={[styles.accountItem, styles.deudaItem]}>
            <View style={styles.accountHeader}>
              <Text style={styles.accountName}>🤝 {deuda.nombre}</Text>
              <View style={styles.inlineActions}>
                <TouchableOpacity style={styles.editButton} onPress={() => startEdit(deuda)}>
                  <Text style={styles.smallButtonText}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteButton} onPress={() => deleteAccount(deuda)}>
                  <Text style={styles.smallButtonText}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.row}>
              <Text style={styles.cuotasLabel}>Falta pagar</Text>
              <Text style={[styles.accountBalance, { color: '#dc3545' }]}>{formatCurrency(pendiente)}</Text>
            </View>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${progreso * 100}%` }]} />
            </View>
            <View style={styles.row}>
              <Text style={styles.accountDate}>Pagado {formatCurrency(pagado)} de {formatCurrency(total)} ({Math.round(progreso * 100)}%)</Text>
              {deuda.cuotaMensual ? (
                <Text style={styles.accountDate}>
                  Cuota {formatCurrency(deuda.cuotaMensual)} • ~{Math.ceil(pendiente / deuda.cuotaMensual)} meses
                </Text>
              ) : null}
            </View>
            {!!deuda.notas && <Text style={styles.accountDate}>{deuda.notas}</Text>}

            {pagando ? (
              <View style={styles.cuotasBox}>
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
                  <Text style={styles.linkText}>Pagar todo ({formatCurrency(pendiente)})</Text>
                </TouchableOpacity>
                <Text style={[styles.label, { marginTop: 10 }]}>Desde la cuenta</Text>
                <View style={styles.chips}>
                  {cajas.map(c => (
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
                  <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => setPagoDeudaId(null)}>
                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.button, styles.submitButton]} onPress={() => registrarPagoDeuda(deuda)}>
                    <Text style={styles.submitButtonText}>Registrar pago</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.payButton}
                onPress={() => { setPagoDeudaId(deuda.id); setPagoMonto(''); setPagoCuentaId(''); }}
              >
                <Text style={styles.submitButtonText}>💸 Registrar pago</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      {deudasFinalizadas.length > 0 && (
        <TouchableOpacity onPress={() => setVerFinalizadas(!verFinalizadas)}>
          <Text style={[styles.linkText, { textAlign: 'center', marginTop: 6 }]}>
            {verFinalizadas ? '▲ Ocultar' : '▼ Ver'} deudas terminadas ({deudasFinalizadas.length})
          </Text>
        </TouchableOpacity>
      )}
      {verFinalizadas && deudasFinalizadas.map(deuda => (
        <View key={deuda.id} style={[styles.accountItem, { opacity: 0.6 }]}>
          <View style={styles.accountHeader}>
            <Text style={styles.accountName}>✅ {deuda.nombre}</Text>
            <TouchableOpacity style={styles.deleteButton} onPress={() => deleteAccount(deuda)}>
              <Text style={styles.smallButtonText}>Eliminar</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.accountDate}>
            Pagada {formatCurrency(Number(deuda.montoTotal) || 0)}{deuda.fechaFinalizada ? ` • terminada el ${deuda.fechaFinalizada.split('-').reverse().join('/')}` : ''}
          </Text>
        </View>
      ))}

      <View style={{ height: 30 }} />
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
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  summaryCard: {
    width: '48%',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  primaryCard: {
    backgroundColor: '#667eea',
  },
  dangerCard: {
    backgroundColor: '#dc3545',
  },
  successCard: {
    backgroundColor: '#28a745',
  },
  warningCard: {
    backgroundColor: '#fd7e14',
  },
  deudaItem: {
    borderLeftWidth: 4,
    borderLeftColor: '#fd7e14',
  },
  barBg: {
    height: 10,
    backgroundColor: '#e9ecef',
    borderRadius: 5,
    overflow: 'hidden',
    marginVertical: 6,
  },
  barFill: {
    height: '100%',
    backgroundColor: '#28a745',
    borderRadius: 5,
  },
  payButton: {
    backgroundColor: '#28a745',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 10,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  chipActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  chipText: {
    fontSize: 12,
    color: '#495057',
  },
  chipTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#17a2b8',
  },
  summaryTitle: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 5,
    textAlign: 'center',
  },
  summaryAmount: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: '#667eea',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  form: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 15,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  help: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentActive: {
    backgroundColor: '#667eea',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c757d',
    textAlign: 'center',
  },
  segmentTextActive: {
    color: 'white',
  },
  input: {
    borderWidth: 2,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  formButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
  },
  submitButton: {
    backgroundColor: '#28a745',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  emptyState: {
    backgroundColor: 'white',
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6c757d',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#adb5bd',
    textAlign: 'center',
  },
  accountItem: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cajaItem: {
    borderLeftWidth: 4,
    borderLeftColor: '#28a745',
  },
  tarjetaItem: {
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 6,
  },
  accountFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accountName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flexShrink: 1,
  },
  accountDate: {
    fontSize: 12,
    color: '#adb5bd',
    marginTop: 2,
  },
  accountBalance: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  inlineActions: {
    flexDirection: 'row',
    gap: 6,
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#667eea',
    borderRadius: 5,
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#dc3545',
    borderRadius: 5,
  },
  smallButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  cuotasBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cuotasLabel: {
    fontSize: 13,
    color: '#555',
  },
  cuotasValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
  },
  linkText: {
    color: '#667eea',
    fontWeight: '600',
    fontSize: 13,
    marginTop: 6,
  },
  subTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
    marginBottom: 6,
  },
  cuotaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  cuotaDesc: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  cuotaRestante: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#dc3545',
    marginLeft: 8,
  },
});
