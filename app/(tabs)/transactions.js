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
import { PLACEHOLDER_COLOR } from '../../src/styles/global';
import { useFocusEffect } from '@react-navigation/native';
import { getDoc, getDocs, doc, writeBatch, increment, arrayUnion, arrayRemove } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import { ensureHousehold, dataCol, dataDoc } from '../../src/services/household';
import { formatCurrency } from '../../src/utils/formatters';
import { Alert } from '../../src/utils/dialog';
import {
  CATEGORIAS_GASTO,
  CATEGORIAS_INGRESO,
  CATEGORIAS_NO_CONSUMO,
  OPCIONES_CUOTAS,
  TIPOS,
  COMISION_TRANSFERENCIA_TARJETA,
  addMonths,
  currentMonthKey,
  esMovimientoAhorro,
  infoTarjeta,
  metaAhorroDe,
  planAhorro,
  monthKey,
  monthLabel,
  monthStats,
  tieneCuotas,
  todayISO,
} from '../../src/utils/finance';
import MonthPicker from '../../src/components/MonthPicker';

// Función para formatear fecha (se arma a mano para evitar corrimientos por zona horaria)
const formatDate = (dateString) => {
  if (!dateString) return '';
  const [y, m, d] = String(dateString).slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : dateString;
};

const parseMonto = (v) => parseFloat(String(v).replace(',', '.'));

// Texto secundario que se muestra para cada cuenta en los desplegables
const accountSubtitle = (option) => {
  if (option.tipo === 'deuda') {
    return `Debés ${formatCurrency(infoTarjeta(option).deuda)}`;
  }
  if (option.tipo === 'tarjeta') {
    const { disponible, deuda } = infoTarjeta(option);
    return disponible !== null
      ? `Disponible ${formatCurrency(disponible)}`
      : `Deuda ${formatCurrency(deuda)}`;
  }
  return formatCurrency(option.saldo);
};

// Componente para lista desplegable MEJORADO
const DropdownList = ({
  options,
  selectedValue,
  onSelect,
  placeholder,
  showBalance = false
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = options.find(opt => opt.id === selectedValue);

  return (
    <View style={[styles.dropdownWrapper, isOpen && styles.dropdownWrapperOpen]}>
      <TouchableOpacity
        style={styles.dropdownHeader}
        onPress={() => setIsOpen(!isOpen)}
        activeOpacity={0.7}
      >
        <Text style={selectedValue ? styles.dropdownHeaderText : styles.dropdownPlaceholder}>
          {selectedOption ?
            (showBalance ?
              `${selectedOption.nombre} - ${accountSubtitle(selectedOption)}` :
              selectedOption.nombre
            ) :
            placeholder
          }
        </Text>
        <Text style={styles.dropdownArrow}>{isOpen ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {isOpen && (
        <>
          <TouchableOpacity
            style={styles.dropdownBackdrop}
            activeOpacity={1}
            onPress={() => setIsOpen(false)}
          />
          <View style={styles.dropdownList}>
            <ScrollView
              style={styles.dropdownScroll}
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled"
            >
              {options.length === 0 && (
                <Text style={styles.dropdownEmpty}>No hay cuentas disponibles</Text>
              )}
              {options.map(option => (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.dropdownItem,
                    selectedValue === option.id && styles.dropdownItemSelected
                  ]}
                  onPress={() => {
                    onSelect(option.id);
                    setIsOpen(false);
                  }}
                >
                  <View style={styles.dropdownItemContent}>
                    <Text style={[
                      styles.dropdownItemText,
                      selectedValue === option.id && styles.dropdownItemTextSelected
                    ]}>
                      {option.nombre}
                    </Text>
                    {showBalance && (
                      <Text style={[
                        styles.dropdownItemBalance,
                        selectedValue === option.id && styles.dropdownItemBalanceSelected
                      ]}>
                        {accountSubtitle(option)}
                      </Text>
                    )}
                  </View>
                  <View style={[
                    styles.accountTypeBadge,
                    option.tipo === 'caja' ? styles.cajaBadge : styles.tarjetaBadge
                  ]}>
                    <Text style={styles.accountTypeText}>
                      {option.tipo === 'caja' ? 'CUENTA' : option.tipo === 'deuda' ? 'DEUDA' : 'TARJETA'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </>
      )}
    </View>
  );
};

// Componente para lista de categorías MEJORADO
const CategoryList = ({
  categories,
  selectedValue,
  onSelect
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const selectedCategory = categories.find(cat => cat === selectedValue);

  return (
    <View style={[styles.dropdownWrapper, isOpen && styles.dropdownWrapperOpen]}>
      <TouchableOpacity
        style={styles.dropdownHeader}
        onPress={() => setIsOpen(!isOpen)}
        activeOpacity={0.7}
      >
        <Text style={selectedValue ? styles.dropdownHeaderText : styles.dropdownPlaceholder}>
          {selectedCategory || 'Seleccionar categoría'}
        </Text>
        <Text style={styles.dropdownArrow}>{isOpen ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {isOpen && (
        <>
          <TouchableOpacity
            style={styles.dropdownBackdrop}
            activeOpacity={1}
            onPress={() => setIsOpen(false)}
          />
          <View style={styles.dropdownList}>
            <ScrollView
              style={styles.dropdownScroll}
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled"
            >
              {categories.map(category => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.dropdownItem,
                    selectedValue === category && styles.dropdownItemSelected
                  ]}
                  onPress={() => {
                    onSelect(category);
                    setIsOpen(false);
                  }}
                >
                  <Text style={[
                    styles.dropdownItemText,
                    selectedValue === category && styles.dropdownItemTextSelected
                  ]}>
                    {category === 'TRANSFERENCIA' ? 'TRANSFERENCIA ENTRE CUENTAS' : category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </>
      )}
    </View>
  );
};

const ICONOS = {
  ingreso: '⬆️',
  egreso: '⬇️',
  transferencia: '🔁',
  pago_tarjeta: '💳',
  ahorro: '🐷',
};

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [mesFiltro, setMesFiltro] = useState(currentMonthKey());
  const [saving, setSaving] = useState(false);

  // Estados del formulario
  const [tipo, setTipo] = useState('egreso');
  const [cuentaId, setCuentaId] = useState('');
  const [categoria, setCategoria] = useState('HOGAR');
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fecha, setFecha] = useState(todayISO());
  const [notas, setNotas] = useState('');
  const [tarjetaId, setTarjetaId] = useState('');
  const [cuentaDestinoId, setCuentaDestinoId] = useState('');
  const [cuotas, setCuotas] = useState(1);
  const [cuotasCustom, setCuotasCustom] = useState('');
  const [ajusteMes, setAjusteMes] = useState(0);
  const [savings, setSavings] = useState({ pesos: 0 });
  const [direccionAhorro, setDireccionAhorro] = useState('guardar');
  const [totalTarjeta, setTotalTarjeta] = useState('');

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
      setSavings(savingsDoc.exists() ? savingsDoc.data() : { pesos: 0 });
      setAccounts(accountsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      const transactionsData = transactionsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setTransactions(transactionsData.sort((a, b) =>
        String(b.fecha).localeCompare(String(a.fecha)) ||
        String(b.fechaCreacion || '').localeCompare(String(a.fechaCreacion || ''))
      ));

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

  const cuentasCaja = accounts.filter(acc => acc.tipo === 'caja');
  const tarjetasCredito = accounts.filter(acc => acc.tipo === 'tarjeta');
  const deudasActivas = accounts.filter(acc => acc.tipo === 'deuda' && !acc.finalizada);
  const cuenta = accounts.find(acc => acc.id === cuentaId);
  const ahorroPesos = Number(savings.pesos) || 0;
  const metaAhorro = metaAhorroDe(savings);
  const planMeta = metaAhorro ? planAhorro(transactions, metaAhorro) : null;
  const esCompraConTarjeta = tipo === 'egreso' && cuenta?.tipo === 'tarjeta';
  const cuotasFinal = cuotas === 'otra' ? parseInt(cuotasCustom, 10) || 0 : cuotas;
  const montoNum = parseMonto(monto);

  // Transferencia desde tarjeta de crédito: se cobra una comisión (7% por defecto)
  const esTransferenciaTarjeta = tipo === 'transferencia' && cuenta?.tipo === 'tarjeta';
  const tasaComision = Number(cuenta?.comisionTransferencia ?? COMISION_TRANSFERENCIA_TARJETA) || 0;
  const totalSugerido = montoNum > 0 ? Math.round(montoNum * (1 + tasaComision / 100) * 100) / 100 : 0;
  const totalTarjetaNum = totalTarjeta ? parseMonto(totalTarjeta) : totalSugerido;

  // Mes en que se paga la primera cuota: si la compra es antes del cierre entra en
  // el resumen de este mes (se paga el mes que viene); si es después, en el siguiente.
  const primerMesAuto = () => {
    const base = monthKey(fecha) || currentMonthKey();
    const dia = parseInt(String(fecha).slice(8, 10), 10);
    const pasoCierre = cuenta?.diaCierre && dia > cuenta.diaCierre;
    return addMonths(base, pasoCierre ? 2 : 1);
  };
  const primerMesCuota = esCompraConTarjeta ? addMonths(primerMesAuto(), ajusteMes) : null;

  const changeTipo = (nuevoTipo) => {
    setTipo(nuevoTipo);
    setCuentaId('');
    setTarjetaId('');
    setCuentaDestinoId('');
    setCategoria(nuevoTipo === 'ingreso' ? CATEGORIAS_INGRESO[0] : nuevoTipo === 'ahorro' ? 'AHORRO' : 'HOGAR');
    setCuotas(1);
    setAjusteMes(0);
  };

  const handleSubmit = async () => {
    if (saving) return;

    if (!cuentaId || !monto || (!descripcion.trim() && tipo !== 'ahorro')) {
      Alert.alert('Error', 'Completa todos los campos obligatorios');
      return;
    }

    if (isNaN(montoNum) || montoNum <= 0) {
      Alert.alert('Error', 'El monto debe ser un número mayor a 0');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      Alert.alert('Error', 'La fecha debe tener el formato AAAA-MM-DD');
      return;
    }

    if (!cuenta) {
      Alert.alert('Error', 'Cuenta no encontrada');
      return;
    }

    await ensureHousehold();
    const accountRef = (id) => dataDoc('accounts', id);
    const batch = writeBatch(db);
    // Movimientos de saldo: [cuentaId, diferencia]
    const movimientos = [];

    const transactionData = {
      tipo,
      cuentaId,
      categoria,
      monto: montoNum,
      descripcion: descripcion.trim() ||
        (tipo === 'ahorro' ? (direccionAhorro === 'guardar' ? 'Guardado en ahorro' : 'Retiro de ahorro') : ''),
      fecha,
      notas: notas.trim(),
      fechaCreacion: new Date().toISOString(),
      registradoPor: auth.currentUser.email || '',
      afectaSaldo: true,
    };

    if (tipo === 'egreso') {
      if (cuenta.tipo === 'tarjeta') {
        const { disponible } = infoTarjeta(cuenta);
        if (disponible !== null && montoNum > disponible) {
          Alert.alert('Límite superado', `La compra supera el disponible de ${cuenta.nombre}: ${formatCurrency(disponible)}`);
          return;
        }
        if (!cuotasFinal || cuotasFinal < 1 || cuotasFinal > 60) {
          Alert.alert('Error', 'Ingresá una cantidad de cuotas válida (1 a 60)');
          return;
        }
        transactionData.cuotas = cuotasFinal;
        transactionData.montoCuota = Math.round((montoNum / cuotasFinal) * 100) / 100;
        transactionData.primerMesCuota = primerMesCuota;
      } else if (cuenta.saldo < montoNum) {
        Alert.alert('Error', `Saldo insuficiente en ${cuenta.nombre}. Disponible: ${formatCurrency(cuenta.saldo)}`);
        return;
      }
      movimientos.push([cuentaId, -montoNum]);
    }

    if (tipo === 'ingreso') {
      movimientos.push([cuentaId, montoNum]);
    }

    if (tipo === 'transferencia') {
      const destino = accounts.find(acc => acc.id === cuentaDestinoId);
      if (!destino) {
        Alert.alert('Error', 'Seleccioná la cuenta de destino');
        return;
      }
      if (destino.id === cuentaId) {
        Alert.alert('Error', 'La cuenta de origen y destino deben ser distintas');
        return;
      }
      transactionData.categoria = 'TRANSFERENCIA';
      transactionData.cuentaDestinoId = destino.id;

      if (cuenta.tipo === 'tarjeta') {
        if (isNaN(totalTarjetaNum) || totalTarjetaNum < montoNum) {
          Alert.alert('Error', 'El total que sale de la tarjeta no puede ser menor a lo que llega a la cuenta');
          return;
        }
        const { disponible } = infoTarjeta(cuenta);
        if (disponible !== null && totalTarjetaNum > disponible) {
          Alert.alert('Límite superado', `Con la comisión se descuentan ${formatCurrency(totalTarjetaNum)} y el disponible de ${cuenta.nombre} es ${formatCurrency(disponible)}`);
          return;
        }
        transactionData.comision = Math.round((totalTarjetaNum - montoNum) * 100) / 100;
        movimientos.push([cuentaId, -totalTarjetaNum], [destino.id, montoNum]);
      } else {
        if (cuenta.saldo < montoNum) {
          Alert.alert('Error', `Saldo insuficiente en ${cuenta.nombre}. Disponible: ${formatCurrency(cuenta.saldo)}`);
          return;
        }
        movimientos.push([cuentaId, -montoNum], [destino.id, montoNum]);
      }
    }

    if (tipo === 'ahorro') {
      const guardar = direccionAhorro === 'guardar';
      if (guardar && cuenta.saldo < montoNum) {
        Alert.alert('Error', `Saldo insuficiente en ${cuenta.nombre}. Disponible: ${formatCurrency(cuenta.saldo)}`);
        return;
      }
      if (!guardar && ahorroPesos < montoNum) {
        Alert.alert('Error', `No hay suficiente ahorro en pesos. Disponible: ${formatCurrency(ahorroPesos)}`);
        return;
      }
      // Se guarda como egreso/ingreso con categoría AHORRO (así lo leen gráficas y metas)
      transactionData.tipo = guardar ? 'egreso' : 'ingreso';
      transactionData.categoria = 'AHORRO';
      const movimiento = {
        id: `savings-${Date.now()}`,
        fecha,
        tipo: guardar ? 'ingreso_pesos' : 'egreso_pesos',
        descripcion: transactionData.descripcion,
        monto: montoNum,
        montoPesos: 0,
        cuenta: cuenta.nombre,
        fechaCreacion: transactionData.fechaCreacion,
      };
      transactionData.movimientoAhorro = movimiento;
      batch.set(dataDoc('data', 'savings'), {
        pesos: increment(guardar ? montoNum : -montoNum),
        history: arrayUnion(movimiento),
      }, { merge: true });
      movimientos.push([cuentaId, guardar ? -montoNum : montoNum]);
    }

    if (tipo === 'pago_tarjeta') {
      const tarjeta = accounts.find(acc => acc.id === tarjetaId);
      if (!tarjeta) {
        Alert.alert('Error', 'Seleccioná la tarjeta o deuda a pagar');
        return;
      }
      if (cuenta.saldo < montoNum) {
        Alert.alert('Error', `Saldo insuficiente en ${cuenta.nombre}. Disponible: ${formatCurrency(cuenta.saldo)}`);
        return;
      }
      const esDeuda = tarjeta.tipo === 'deuda';
      const pendiente = infoTarjeta(tarjeta).deuda;
      if (esDeuda && montoNum > pendiente + 0.001) {
        Alert.alert('Error', `En "${tarjeta.nombre}" solo quedan ${formatCurrency(pendiente)} por pagar`);
        return;
      }
      transactionData.categoria = esDeuda ? 'PAGO_DEUDA' : 'PAGO_TARJETA';
      transactionData.tarjetaId = tarjetaId;
      movimientos.push([cuentaId, -montoNum], [tarjetaId, montoNum]);
      // La deuda personal se da por terminada cuando se paga todo
      if (esDeuda && montoNum >= pendiente - 0.001) {
        batch.update(dataDoc('accounts', tarjetaId), { finalizada: true, fechaFinalizada: fecha });
      }
    }

    try {
      setSaving(true);
      // Transacción y saldos se guardan juntos: o se guarda todo o nada.
      batch.set(doc(dataCol('transactions')), transactionData);
      movimientos.forEach(([id, diff]) => batch.update(accountRef(id), { saldo: increment(diff) }));
      await batch.commit();

      const extra = transactionData.cuotas > 1
        ? `\n${transactionData.cuotas} cuotas de ${formatCurrency(transactionData.montoCuota)} desde ${monthLabel(transactionData.primerMesCuota)}`
        : '';
      Alert.alert('Éxito', `Transacción registrada correctamente${extra}`);
      resetForm();
      loadData();

    } catch (error) {
      console.error('Error guardando transacción:', error);
      Alert.alert('Error', 'No se pudo guardar la transacción');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setTipo('egreso');
    setCuentaId('');
    setCategoria('HOGAR');
    setMonto('');
    setDescripcion('');
    setFecha(todayISO());
    setNotas('');
    setTarjetaId('');
    setCuentaDestinoId('');
    setCuotas(1);
    setCuotasCustom('');
    setAjusteMes(0);
    setDireccionAhorro('guardar');
  };

  // Diferencias de saldo que hay que deshacer al borrar una transacción
  const reversiones = (t) => {
    switch (t.tipo) {
      case 'ingreso': return [[t.cuentaId, -t.monto]];
      case 'egreso': return [[t.cuentaId, t.monto]];
      case 'transferencia': return [[t.cuentaId, t.monto + (Number(t.comision) || 0)], [t.cuentaDestinoId, -t.monto]];
      case 'pago_tarjeta': return [[t.cuentaId, t.monto], [t.tarjetaId, -t.monto]];
      default: return [];
    }
  };

  const removeTransaction = async (transaction, revertir) => {
    try {
      await ensureHousehold();
      const batch = writeBatch(db);
      batch.delete(dataDoc('transactions', transaction.id));
      const esUSD = transaction.categoria === 'AHORRO_USD' && transaction.movimientoAhorro;
      if (revertir && esMovimientoAhorro(transaction) && (transaction.categoria === 'AHORRO' || esUSD)) {
        // Deshacer también el movimiento en el ahorro (pesos o dólares)
        const guardado = transaction.tipo === 'egreso';
        const cambios = esUSD
          ? { usd: increment(guardado ? -transaction.movimientoAhorro.monto : transaction.movimientoAhorro.monto) }
          : { pesos: increment(guardado ? -transaction.monto : transaction.monto) };
        if (transaction.movimientoAhorro) cambios.history = arrayRemove(transaction.movimientoAhorro);
        batch.set(dataDoc('data', 'savings'), cambios, { merge: true });
      }
      if (revertir) {
        reversiones(transaction)
          .filter(([id]) => id && accounts.some(a => a.id === id))
          .forEach(([id, diff]) =>
            batch.update(dataDoc('accounts', id), { saldo: increment(diff) })
          );
        // Si se borra un pago de deuda personal, la deuda vuelve a estar activa
        const deuda = accounts.find(a => a.id === transaction.tarjetaId && a.tipo === 'deuda');
        if (deuda && deuda.finalizada) {
          batch.update(dataDoc('accounts', deuda.id), { finalizada: false });
        }
      }
      await batch.commit();
      setModalVisible(false);
      loadData();
    } catch (error) {
      console.error('Error eliminando transacción:', error);
      Alert.alert('Error', 'No se pudo eliminar la transacción');
    }
  };

  const deleteTransaction = (transaction) => {
    if (transaction.afectaSaldo) {
      Alert.alert(
        'Eliminar Transacción',
        `¿Eliminar "${transaction.descripcion}"?\nEl saldo de las cuentas se va a ajustar automáticamente.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: () => removeTransaction(transaction, true) }
        ]
      );
      return;
    }

    // Transacciones viejas o importadas: no sabemos si movieron el saldo, se pregunta.
    Alert.alert(
      'Eliminar Transacción',
      `¿Eliminar "${transaction.descripcion}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => Alert.alert(
            'Ajustar saldo',
            `¿Querés también devolver ${formatCurrency(transaction.monto)} al saldo de la cuenta?\n\nAceptar = sí, ajustar saldo\nCancelar = solo borrar el registro`,
            [
              { text: 'Solo borrar', style: 'cancel', onPress: () => removeTransaction(transaction, false) },
              { text: 'Sí, ajustar saldo', onPress: () => removeTransaction(transaction, true) }
            ]
          )
        }
      ]
    );
  };

  const showTransactionDetails = (transaction) => {
    setSelectedTransaction(transaction);
    setModalVisible(true);
  };

  const stats = monthStats(transactions, mesFiltro);
  const transaccionesMes = transactions.filter(t => monthKey(t.fecha) === mesFiltro);
  const nombreCuenta = (id) => accounts.find(acc => acc.id === id)?.nombre || 'Cuenta eliminada';

  const cuentaLabel = {
    ingreso: 'Cuenta donde entra el dinero',
    egreso: 'Pagar con (cuenta o tarjeta)',
    transferencia: 'Desde la cuenta',
    pago_tarjeta: 'Pagar desde la cuenta',
    ahorro: direccionAhorro === 'guardar' ? 'Sacar de la cuenta' : 'Depositar en la cuenta',
  }[tipo];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>💸 Transacciones</Text>

      {/* Formulario de transacción */}
      <View style={styles.card}>
        <Text style={styles.formTitle}>Nueva Transacción</Text>

        {/* Tipo de Transacción */}
        <View style={styles.formSection}>
          <Text style={styles.sectionLabel}>Tipo</Text>
          <View style={styles.segmentedGrid}>
            {Object.entries(TIPOS).map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={[styles.segment, tipo === key && styles.segmentActive]}
                onPress={() => changeTipo(key)}
              >
                <Text style={[styles.segmentText, tipo === key && styles.segmentTextActive]}>
                  {ICONOS[key]} {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {tipo === 'transferencia' && (
            <Text style={styles.help}>Mover dinero entre sus propias cuentas. No cuenta como gasto del hogar.</Text>
          )}
          {tipo === 'ahorro' && (
            <View style={styles.ahorroBox}>
              <View style={styles.segmentedGrid}>
                <TouchableOpacity
                  style={[styles.segment, direccionAhorro === 'guardar' && styles.segmentActive]}
                  onPress={() => setDireccionAhorro('guardar')}
                >
                  <Text style={[styles.segmentText, direccionAhorro === 'guardar' && styles.segmentTextActive]}>
                    ➕ Guardar en ahorro
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segment, direccionAhorro === 'retirar' && styles.segmentActive]}
                  onPress={() => setDireccionAhorro('retirar')}
                >
                  <Text style={[styles.segmentText, direccionAhorro === 'retirar' && styles.segmentTextActive]}>
                    ➖ Retirar del ahorro
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.ahorroText}>Ahorro en pesos disponible: <Text style={{ fontWeight: 'bold' }}>{formatCurrency(ahorroPesos)}</Text></Text>
              {planMeta ? (
                <Text style={styles.ahorroText}>
                  🎯 Meta para {monthLabel(metaAhorro.mesObjetivo)}: {formatCurrency(planMeta.netoAnio)} de {formatCurrency(metaAhorro.monto)}.
                  {planMeta.faltaMes > 0
                    ? ` Este mes te faltan ${formatCurrency(planMeta.faltaMes)}.`
                    : ' Este mes ya cumpliste. 🎉'}
                </Text>
              ) : (
                <Text style={styles.help}>Definí tu meta anual en la solapa Ahorros para ver cuánto te toca por mes.</Text>
              )}
              <Text style={styles.help}>Los dólares se compran y venden desde la solapa Ahorros.</Text>
            </View>
          )}
        </View>

        {/* Cuenta */}
        <View style={[styles.formSection, { zIndex: 5000 }]}>
          <Text style={styles.label}>{cuentaLabel}</Text>
          <DropdownList
            options={tipo === 'egreso' || tipo === 'transferencia' ? [...cuentasCaja, ...tarjetasCredito] : cuentasCaja}
            selectedValue={cuentaId}
            onSelect={(id) => { setCuentaId(id); setAjusteMes(0); setTotalTarjeta(''); }}
            placeholder="Seleccionar cuenta"
            showBalance={true}
          />
        </View>

        {/* Cuenta destino (solo transferencias) */}
        {tipo === 'transferencia' && (
          <View style={[styles.formSection, { zIndex: 4500 }]}>
            <Text style={styles.label}>Hacia la cuenta</Text>
            <DropdownList
              options={cuentasCaja.filter(c => c.id !== cuentaId)}
              selectedValue={cuentaDestinoId}
              onSelect={setCuentaDestinoId}
              placeholder="Seleccionar cuenta destino"
              showBalance={true}
            />
          </View>
        )}

        {/* Tarjeta a Pagar (solo para pago_tarjeta) */}
        {tipo === 'pago_tarjeta' && (
          <View style={[styles.formSection, { zIndex: 4500 }]}>
            <Text style={styles.label}>Tarjeta o deuda a pagar</Text>
            <DropdownList
              options={[...tarjetasCredito, ...deudasActivas]}
              selectedValue={tarjetaId}
              onSelect={setTarjetaId}
              placeholder="Seleccionar tarjeta o deuda"
              showBalance={true}
            />
            {tarjetaId ? (
              <TouchableOpacity
                onPress={() => setMonto(String(infoTarjeta(accounts.find(a => a.id === tarjetaId)).deuda))}
              >
                <Text style={styles.linkText}>
                  Pagar el total ({formatCurrency(infoTarjeta(accounts.find(a => a.id === tarjetaId)).deuda)})
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {/* Monto */}
        <View style={[styles.formSection, { zIndex: 3000 }]}>
          <Text style={styles.label}>{esCompraConTarjeta ? 'Monto total de la compra' : 'Monto'}</Text>
          <TextInput
            placeholderTextColor={PLACEHOLDER_COLOR}
            style={styles.input}
            value={monto}
            onChangeText={setMonto}
            placeholder="0.00"
            keyboardType="numeric"
          />
        </View>

        {/* Comisión al sacar plata de la tarjeta */}
        {esTransferenciaTarjeta && (
          <View style={styles.cuotasBox}>
            <Text style={styles.label}>Total que sale de la tarjeta (con {tasaComision}% de comisión)</Text>
            <TextInput
              placeholderTextColor={PLACEHOLDER_COLOR}
              style={styles.input}
              value={totalTarjeta}
              onChangeText={setTotalTarjeta}
              placeholder={totalSugerido ? String(totalSugerido) : '0.00'}
              keyboardType="numeric"
            />
            {montoNum > 0 && (
              <Text style={styles.cuotasResumen}>
                Llegan {formatCurrency(montoNum)} a la cuenta • salen {formatCurrency(totalTarjetaNum || 0)} de la tarjeta • comisión {formatCurrency(Math.max(0, (totalTarjetaNum || 0) - montoNum))}
              </Text>
            )}
            <Text style={styles.help}>Si el banco cobró otro monto, escribí el total exacto. La comisión se cuenta como gasto (COMISIONES).</Text>
          </View>
        )}

        {/* Cuotas (solo compras con tarjeta de crédito) */}
        {esCompraConTarjeta && (
          <View style={styles.cuotasBox}>
            <Text style={styles.label}>Cuotas</Text>
            <View style={styles.chips}>
              {OPCIONES_CUOTAS.map(n => (
                <TouchableOpacity
                  key={n}
                  style={[styles.chip, cuotas === n && styles.chipActive]}
                  onPress={() => setCuotas(n)}
                >
                  <Text style={[styles.chipText, cuotas === n && styles.chipTextActive]}>
                    {n === 1 ? '1 pago' : n}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.chip, cuotas === 'otra' && styles.chipActive]}
                onPress={() => setCuotas('otra')}
              >
                <Text style={[styles.chipText, cuotas === 'otra' && styles.chipTextActive]}>Otra</Text>
              </TouchableOpacity>
            </View>
            {cuotas === 'otra' && (
              <TextInput
                placeholderTextColor={PLACEHOLDER_COLOR}
                style={[styles.input, { marginTop: 8 }]}
                value={cuotasCustom}
                onChangeText={setCuotasCustom}
                placeholder="Cantidad de cuotas"
                keyboardType="numeric"
              />
            )}

            <View style={styles.primerMesRow}>
              <Text style={styles.cuotasText}>
                {cuotasFinal > 1 ? 'Primera cuota:' : 'Se paga en:'}
              </Text>
              <TouchableOpacity style={styles.miniArrow} onPress={() => setAjusteMes(ajusteMes - 1)}>
                <Text style={styles.miniArrowText}>◀</Text>
              </TouchableOpacity>
              <Text style={styles.primerMesText}>{monthLabel(primerMesCuota)}</Text>
              <TouchableOpacity style={styles.miniArrow} onPress={() => setAjusteMes(ajusteMes + 1)}>
                <Text style={styles.miniArrowText}>▶</Text>
              </TouchableOpacity>
            </View>

            {montoNum > 0 && cuotasFinal > 1 && (
              <Text style={styles.cuotasResumen}>
                {cuotasFinal} cuotas de {formatCurrency(montoNum / cuotasFinal)} • hasta {monthLabel(addMonths(primerMesCuota, cuotasFinal - 1))}
              </Text>
            )}
            {montoNum > 0 && (() => {
              const { disponible } = infoTarjeta(cuenta);
              if (disponible === null) return null;
              const restante = disponible - montoNum;
              return (
                <Text style={[styles.help, restante < 0 && { color: '#dc3545', fontWeight: 'bold' }]}>
                  {restante < 0
                    ? `Supera el disponible por ${formatCurrency(-restante)}`
                    : `Después de esta compra te quedan ${formatCurrency(restante)} disponibles`}
                </Text>
              );
            })()}
          </View>
        )}

        {/* Categoría */}
        {(tipo === 'egreso' || tipo === 'ingreso') && (
          <View style={[styles.formSection, { zIndex: 2000 }]}>
            <Text style={styles.label}>Categoría</Text>
            <CategoryList
              categories={tipo === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_GASTO}
              selectedValue={categoria}
              onSelect={setCategoria}
            />
            {tipo === 'egreso' && CATEGORIAS_NO_CONSUMO.includes(categoria) && (
              <Text style={styles.help}>Esta categoría no se cuenta en las gráficas de consumo del hogar.</Text>
            )}
          </View>
        )}

        {/* Descripción */}
        <View style={[styles.formSection, { zIndex: 1000 }]}>
          <Text style={styles.label}>Descripción</Text>
          <TextInput
            placeholderTextColor={PLACEHOLDER_COLOR}
            style={[styles.input, styles.textArea]}
            value={descripcion}
            onChangeText={setDescripcion}
            placeholder="Descripción de la transacción"
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Fecha */}
        <View style={styles.formSection}>
          <Text style={styles.label}>Fecha</Text>
          <TextInput
            placeholderTextColor={PLACEHOLDER_COLOR}
            style={styles.input}
            value={fecha}
            onChangeText={(v) => { setFecha(v); setAjusteMes(0); }}
            placeholder="AAAA-MM-DD"
          />
        </View>

        {/* Notas */}
        <View style={styles.formSection}>
          <Text style={styles.label}>Notas / Productos Comprados</Text>
          <TextInput
            placeholderTextColor={PLACEHOLDER_COLOR}
            style={[styles.input, styles.textArea]}
            value={notas}
            onChangeText={setNotas}
            placeholder="Ej: Pan, leche, huevos..."
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Botones */}
        <View style={styles.formButtons}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={resetForm}
          >
            <Text style={styles.buttonText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.submitButton, saving && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={saving}
          >
            <Text style={styles.buttonText}>{saving ? 'Guardando...' : 'Registrar'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Resumen del mes */}
      <Text style={styles.sectionTitle}>Historial</Text>
      <MonthPicker value={mesFiltro} onChange={setMesFiltro} />

      <View style={styles.summaryGrid}>
        <View style={[styles.summaryCard, styles.incomeCard]}>
          <Text style={styles.summaryTitle}>Ingresos</Text>
          <Text style={styles.summaryAmount}>{formatCurrency(stats.ingresos)}</Text>
        </View>
        <View style={[styles.summaryCard, styles.expenseCard]}>
          <Text style={styles.summaryTitle}>Gastos</Text>
          <Text style={styles.summaryAmount}>{formatCurrency(stats.gastos)}</Text>
        </View>
        <View style={[styles.summaryCard, styles.balanceCard]}>
          <Text style={styles.summaryTitle}>Balance</Text>
          <Text style={styles.summaryAmount}>{formatCurrency(stats.ingresos - stats.gastos)}</Text>
        </View>
      </View>
      <Text style={styles.footnote}>
        Gastos = consumo del hogar (incluye cuotas del mes). No incluye transferencias, pagos de tarjeta ni ahorro.
      </Text>

      {/* Lista de Transacciones */}
      {transaccionesMes.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No hay transacciones en {monthLabel(mesFiltro)}</Text>
        </View>
      ) : (
        transaccionesMes.map(transaction => {
          const esAhorroMov = esMovimientoAhorro(transaction);
          const esIngreso = transaction.tipo === 'ingreso' && !esAhorroMov;
          const esMovimiento = esAhorroMov || transaction.tipo === 'transferencia' || transaction.tipo === 'pago_tarjeta';
          const destino = transaction.cuentaDestinoId || transaction.tarjetaId;
          const autor = transaction.registradoPor && transaction.registradoPor !== auth.currentUser?.email
            ? transaction.registradoPor.split('@')[0]
            : null;

          return (
            <TouchableOpacity
              key={transaction.id}
              style={[
                styles.transactionItem,
                esIngreso ? styles.incomeItem :
                esMovimiento ? styles.paymentItem : styles.expenseItem
              ]}
              onPress={() => showTransactionDetails(transaction)}
            >
              <View style={styles.transactionInfo}>
                <Text style={styles.transactionDesc}>
                  {esAhorroMov ? ICONOS.ahorro : ICONOS[transaction.tipo] || ''} {transaction.descripcion}
                </Text>
                <Text style={styles.transactionMeta}>
                  {transaction.categoria} • {nombreCuenta(transaction.cuentaId)}
                  {destino ? ` → ${nombreCuenta(destino)}` : ''} • {formatDate(transaction.fecha)}
                </Text>
                {Number(transaction.comision) > 0 && (
                  <Text style={styles.cuotasTag}>
                    Comisión tarjeta {formatCurrency(transaction.comision)} • salió {formatCurrency(transaction.monto + Number(transaction.comision))}
                  </Text>
                )}
                {tieneCuotas(transaction) && (
                  <Text style={styles.cuotasTag}>
                    {transaction.cuotas} cuotas de {formatCurrency(transaction.montoCuota)} desde {monthLabel(transaction.primerMesCuota)}
                  </Text>
                )}
                {!!transaction.notas && (
                  <Text style={styles.transactionNotes}>{transaction.notas}</Text>
                )}
                {autor && <Text style={styles.transactionNotes}>Cargado por {autor}</Text>}
              </View>
              <View style={styles.transactionAmount}>
                <Text style={[
                  styles.amount,
                  esIngreso ? styles.incomeAmount :
                  esMovimiento ? styles.paymentAmount : styles.expenseAmount
                ]}>
                  {esIngreso ? '+' : esAhorroMov ? (transaction.tipo === 'egreso' ? '→🐷 ' : '🐷→ ') : esMovimiento ? '' : '-'}{formatCurrency(transaction.monto)}
                </Text>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteTransaction(transaction)}
                >
                  <Text style={styles.deleteButtonText}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })
      )}

      <View style={{ height: 30 }} />

      {/* Modal de Detalles */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedTransaction && (
              <>
                <Text style={styles.modalTitle}>📝 Detalles de la Transacción</Text>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Descripción:</Text>
                  <Text style={styles.detailValue}>{selectedTransaction.descripcion}</Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Monto:</Text>
                  <Text style={styles.detailValue}>
                    {formatCurrency(selectedTransaction.monto)}
                  </Text>
                </View>

                {tieneCuotas(selectedTransaction) && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Cuotas:</Text>
                    <Text style={styles.detailValue}>
                      {selectedTransaction.cuotas} × {formatCurrency(selectedTransaction.montoCuota)}{'\n'}
                      De {monthLabel(selectedTransaction.primerMesCuota)} a {monthLabel(addMonths(selectedTransaction.primerMesCuota, selectedTransaction.cuotas - 1))}
                    </Text>
                  </View>
                )}

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Fecha:</Text>
                  <Text style={styles.detailValue}>{formatDate(selectedTransaction.fecha)}</Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Tipo:</Text>
                  <Text style={styles.detailValue}>
                    {esMovimientoAhorro(selectedTransaction)
                      ? (selectedTransaction.tipo === 'egreso' ? 'Guardado en ahorro' : 'Retiro de ahorro')
                      : TIPOS[selectedTransaction.tipo] || selectedTransaction.tipo}
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Categoría:</Text>
                  <Text style={styles.detailValue}>{selectedTransaction.categoria}</Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Cuenta:</Text>
                  <Text style={styles.detailValue}>
                    {nombreCuenta(selectedTransaction.cuentaId)}
                    {(selectedTransaction.cuentaDestinoId || selectedTransaction.tarjetaId)
                      ? ` → ${nombreCuenta(selectedTransaction.cuentaDestinoId || selectedTransaction.tarjetaId)}`
                      : ''}
                  </Text>
                </View>

                {!!selectedTransaction.notas && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Notas:</Text>
                    <Text style={styles.detailValue}>{selectedTransaction.notas}</Text>
                  </View>
                )}

                {!!selectedTransaction.registradoPor && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Cargado por:</Text>
                    <Text style={styles.detailValue}>{selectedTransaction.registradoPor}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.button, styles.primaryButton]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.buttonText}>Cerrar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
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
  card: {
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  formSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  help: {
    fontSize: 12,
    color: '#888',
    marginTop: 6,
  },
  linkText: {
    color: '#667eea',
    fontWeight: '600',
    fontSize: 13,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
    minHeight: 50,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  // Selector de tipo (2x2)
  segmentedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segment: {
    flexGrow: 1,
    flexBasis: '45%',
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
    backgroundColor: '#f8f9fa',
  },
  segmentActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c757d',
  },
  segmentTextActive: {
    color: 'white',
  },
  // Ahorro
  ahorroBox: {
    marginTop: 10,
    padding: 12,
    backgroundColor: '#e8f6f8',
    borderRadius: 10,
  },
  ahorroText: {
    fontSize: 13,
    color: '#333',
    marginTop: 8,
  },
  // Cuotas
  cuotasBox: {
    backgroundColor: '#fff8e1',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ffe08a',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 12,
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
    fontSize: 13,
    fontWeight: '600',
    color: '#495057',
  },
  chipTextActive: {
    color: 'white',
  },
  primerMesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  cuotasText: {
    fontSize: 13,
    color: '#555',
    marginRight: 6,
  },
  primerMesText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    minWidth: 120,
    textAlign: 'center',
  },
  miniArrow: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  miniArrowText: {
    color: '#667eea',
    fontWeight: 'bold',
  },
  cuotasResumen: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#8a6d00',
  },
  // Dropdown Styles MEJORADOS CON Z-INDEX
  dropdownWrapper: {
    position: 'relative',
  },
  dropdownWrapperOpen: {
    marginBottom: 180, // Espacio extra cuando está abierto
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'white',
    minHeight: 50,
  },
  dropdownHeaderText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  dropdownPlaceholder: {
    fontSize: 16,
    color: PLACEHOLDER_COLOR,
    flex: 1,
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#6c757d',
    marginLeft: 10,
  },
  dropdownBackdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9998,
  },
  dropdownList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    marginTop: 5,
    maxHeight: 200,
    zIndex: 9999,
    elevation: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownEmpty: {
    padding: 15,
    color: '#999',
    fontStyle: 'italic',
  },
  dropdownItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownItemSelected: {
    backgroundColor: '#667eea',
  },
  dropdownItemContent: {
    flex: 1,
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '600',
  },
  dropdownItemTextSelected: {
    color: 'white',
  },
  dropdownItemBalance: {
    fontSize: 13,
    color: '#6c757d',
    marginTop: 4,
  },
  dropdownItemBalanceSelected: {
    color: '#e0e0e0',
  },
  accountTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 10,
  },
  cajaBadge: {
    backgroundColor: '#28a745',
  },
  tarjetaBadge: {
    backgroundColor: '#ffc107',
  },
  accountTypeText: {
    fontSize: 10,
    color: 'white',
    fontWeight: 'bold',
  },
  // Botones del formulario
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
    minHeight: 50,
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
  },
  submitButton: {
    backgroundColor: '#28a745',
  },
  primaryButton: {
    backgroundColor: '#667eea',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  // Resumen
  summaryGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },
  summaryCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 70,
    justifyContent: 'center',
  },
  balanceCard: {
    backgroundColor: '#667eea',
  },
  incomeCard: {
    backgroundColor: '#28a745',
  },
  expenseCard: {
    backgroundColor: '#dc3545',
  },
  summaryTitle: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 5,
  },
  summaryAmount: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  footnote: {
    fontSize: 11,
    color: '#999',
    marginBottom: 15,
    textAlign: 'center',
  },
  // Lista de transacciones
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
    textAlign: 'center',
  },
  transactionItem: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderLeftWidth: 4,
  },
  incomeItem: {
    borderLeftColor: '#28a745',
  },
  expenseItem: {
    borderLeftColor: '#dc3545',
  },
  paymentItem: {
    borderLeftColor: '#17a2b8',
  },
  transactionInfo: {
    flex: 1,
    marginRight: 10,
  },
  transactionDesc: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  transactionMeta: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 4,
  },
  cuotasTag: {
    fontSize: 12,
    color: '#8a6d00',
    fontWeight: '600',
    marginBottom: 4,
  },
  transactionNotes: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  incomeAmount: {
    color: '#28a745',
  },
  expenseAmount: {
    color: '#dc3545',
  },
  paymentAmount: {
    color: '#17a2b8',
  },
  deleteButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#dc3545',
    borderRadius: 5,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 25,
    borderRadius: 15,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  detailSection: {
    marginBottom: 15,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 5,
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
  },
});
