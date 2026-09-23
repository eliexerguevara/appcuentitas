import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  StyleSheet,
  RefreshControl,
  Modal
} from 'react-native';
import { collection, getDocs, addDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import { formatCurrency } from '../utils/formatters';

export default function SavingsScreen() {
  const [savings, setSavings] = useState({ pesos: 0, usd: 0, history: [] });
  const [accounts, setAccounts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  
  // Estados del formulario
  const [tipoAhorro, setTipoAhorro] = useState('ingreso_pesos');
  const [montoAhorro, setMontoAhorro] = useState('');
  const [descripcionAhorro, setDescripcionAhorro] = useState('');
  const [cuentaAhorro, setCuentaAhorro] = useState('');
  const [montoPesosUSD, setMontoPesosUSD] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!auth.currentUser) return;

    try {
      const userId = auth.currentUser.uid;
      
      // Cargar cuentas
      const accountsSnapshot = await getDocs(collection(db, 'users', userId, 'accounts'));
      const accountsData = accountsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAccounts(accountsData);

      // Cargar ahorros
      const savingsRef = doc(db, 'users', userId, 'data', 'savings');
      const savingsDoc = await getDoc(savingsRef);
      if (savingsDoc.exists()) {
        setSavings(savingsDoc.data());
      } else {
        // Crear estructura inicial
        const initialSavings = { pesos: 0, usd: 0, history: [] };
        await setDoc(savingsRef, initialSavings);
        setSavings(initialSavings);
      }

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

  const handleSubmit = async () => {
    if (!montoAhorro || parseFloat(montoAhorro) <= 0) {
      Alert.alert('Error', 'El monto debe ser mayor a 0');
      return;
    }

    if (!descripcionAhorro.trim()) {
      Alert.alert('Error', 'La descripción es obligatoria');
      return;
    }

    if (tipoAhorro !== 'egreso_usd' && !cuentaAhorro) {
      Alert.alert('Error', 'Debes seleccionar una cuenta');
      return;
    }

    try {
      const userId = auth.currentUser.uid;
      const monto = parseFloat(montoAhorro);
      const montoPesos = parseFloat(montoPesosUSD) || 0;

      let nuevaTransaccion = null;
      let cuentaActualizada = null;
      const nuevosAhorros = { ...savings };
      const movimiento = {
        fecha: new Date().toISOString().split('T')[0],
        tipo: tipoAhorro,
        descripcion: descripcionAhorro,
        monto: monto,
        montoPesos: montoPesos
      };

      switch(tipoAhorro) {
        case 'ingreso_pesos':
          const cuentaIngreso = accounts.find(acc => acc.id === cuentaAhorro);
          if (cuentaIngreso.saldo < monto) {
            Alert.alert('Error', `Saldo insuficiente en ${cuentaIngreso.nombre}`);
            return;
          }
          
          // Actualizar cuenta y ahorros
          cuentaIngreso.saldo -= monto;
          nuevosAhorros.pesos += monto;
          
          nuevaTransaccion = {
            tipo: 'egreso',
            cuentaId: cuentaIngreso.id,
            categoria: 'AHORRO',
            monto: monto,
            descripcion: `Ahorro pesos: ${descripcionAhorro}`,
            fecha: movimiento.fecha,
            notas: `Transferencia a cuenta de ahorros desde ${cuentaIngreso.nombre}`
          };
          cuentaActualizada = cuentaIngreso;
          break;

        case 'ingreso_usd':
          if (!montoPesos || montoPesos <= 0) {
            Alert.alert('Error', 'El monto en pesos es requerido');
            return;
          }

          const cuentaUSD = accounts.find(acc => acc.id === cuentaAhorro);
          if (cuentaUSD.saldo < montoPesos) {
            Alert.alert('Error', `Saldo insuficiente en ${cuentaUSD.nombre}`);
            return;
          }

          cuentaUSD.saldo -= montoPesos;
          nuevosAhorros.usd += monto;
          
          nuevaTransaccion = {
            tipo: 'egreso',
            cuentaId: cuentaUSD.id,
            categoria: 'AHORRO_USD',
            monto: montoPesos,
            descripcion: `Compra USD: ${descripcionAhorro}`,
            fecha: movimiento.fecha,
            notas: `Compra de USD ${monto} por ${formatCurrency(montoPesos)}`
          };
          cuentaActualizada = cuentaUSD;
          break;

        case 'egreso_pesos':
          if (nuevosAhorros.pesos < monto) {
            Alert.alert('Error', 'Ahorros en pesos insuficientes');
            return;
          }

          const cuentaEgreso = accounts.find(acc => acc.id === cuentaAhorro);
          nuevosAhorros.pesos -= monto;
          cuentaEgreso.saldo += monto;
          
          nuevaTransaccion = {
            tipo: 'ingreso',
            cuentaId: cuentaEgreso.id,
            categoria: 'AHORRO',
            monto: monto,
            descripcion: `Retiro ahorro pesos: ${descripcionAhorro}`,
            fecha: movimiento.fecha,
            notas: `Retiro de cuenta de ahorros a ${cuentaEgreso.nombre}`
          };
          cuentaActualizada = cuentaEgreso;
          break;

        case 'egreso_usd':
          if (!montoPesos || montoPesos <= 0) {
            Alert.alert('Error', 'El monto en pesos es requerido');
            return;
          }

          if (nuevosAhorros.usd < monto) {
            Alert.alert('Error', 'Ahorros USD insuficientes');
            return;
          }

          nuevosAhorros.usd -= monto;
          nuevosAhorros.pesos += montoPesos;
          movimiento.cotizacion = montoPesos / monto;
          break;
      }

      // Guardar en Firebase
      if (nuevaTransaccion) {
        await addDoc(collection(db, 'users', userId, 'transactions'), nuevaTransaccion);
      }

      if (cuentaActualizada) {
        // Aquí deberías actualizar la cuenta en Firebase
        // await updateDoc(doc(db, 'users', userId, 'accounts', cuentaActualizada.id), cuentaActualizada);
      }

      // Actualizar ahorros
      nuevosAhorros.history = [movimiento, ...savings.history];
      await setDoc(doc(db, 'users', userId, 'data', 'savings'), nuevosAhorros);
      setSavings(nuevosAhorros);

      Alert.alert('Éxito', 'Movimiento de ahorro registrado correctamente');
      resetForm();
      
    } catch (error) {
      console.error('Error en movimiento de ahorro:', error);
      Alert.alert('Error', 'No se pudo registrar el movimiento');
    }
  };

  const resetForm = () => {
    setTipoAhorro('ingreso_pesos');
    setMontoAhorro('');
    setDescripcionAhorro('');
    setCuentaAhorro('');
    setMontoPesosUSD('');
    setModalVisible(false);
  };

  const getCuentasCaja = () => {
    return accounts.filter(acc => acc.tipo === 'caja');
  };

  const getLabelText = () => {
    switch(tipoAhorro) {
      case 'ingreso_pesos': return 'Monto en Pesos a Ahorrar';
      case 'ingreso_usd': return 'Monto en USD a Comprar';
      case 'egreso_pesos': return 'Monto en Pesos a Retirar';
      case 'egreso_usd': return 'Monto en USD a Vender';
      default: return 'Monto';
    }
  };

  const getCuentaLabel = () => {
    switch(tipoAhorro) {
      case 'ingreso_pesos': return 'Cuenta de Origen (Caja de Ahorro)';
      case 'ingreso_usd': return 'Cuenta de Origen (Caja de Ahorro)';
      case 'egreso_pesos': return 'Cuenta de Destino (Caja de Ahorro)';
      default: return 'Cuenta';
    }
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.title}>Gestión de Ahorros</Text>

      {/* Tarjetas de Ahorros */}
      <View style={styles.savingsGrid}>
        <View style={[styles.savingsCard, styles.pesosCard]}>
          <Text style={styles.savingsTitle}>Ahorro en Pesos (ARS)</Text>
          <Text style={styles.savingsAmount}>{formatCurrency(savings.pesos)}</Text>
        </View>
        <View style={[styles.savingsCard, styles.usdCard]}>
          <Text style={styles.savingsTitle}>Ahorro en Dólares (USD)</Text>
          <Text style={styles.savingsAmount}>${savings.usd.toFixed(2)}</Text>
        </View>
      </View>

      {/* Botón para agregar movimiento */}
      <TouchableOpacity 
        style={styles.addButton}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.addButtonText}>+ Nuevo Movimiento de Ahorro</Text>
      </TouchableOpacity>

      {/* Historial */}
      <Text style={styles.sectionTitle}>Historial de Movimientos</Text>
      {savings.history.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No hay movimientos registrados</Text>
        </View>
      ) : (
        savings.history.slice(0, 10).map((movimiento, index) => (
          <View key={index} style={styles.historyItem}>
            <View style={styles.historyInfo}>
              <Text style={styles.historyDesc}>{movimiento.descripcion}</Text>
              <Text style={styles.historyDate}>{movimiento.fecha}</Text>
              <Text style={styles.historyType}>
                {movimiento.tipo === 'ingreso_pesos' && 'Ingreso Pesos'}
                {movimiento.tipo === 'ingreso_usd' && 'Ingreso USD'}
                {movimiento.tipo === 'egreso_pesos' && 'Egreso Pesos'}
                {movimiento.tipo === 'egreso_usd' && 'Egreso USD'}
              </Text>
            </View>
            <View style={styles.historyAmount}>
              <Text style={[
                styles.historyValue,
                { color: movimiento.tipo.includes('ingreso') ? '#28a745' : '#dc3545' }
              ]}>
                {movimiento.tipo.includes('ingreso') ? '+' : '-'}
                {movimiento.tipo.includes('usd') ? `$${movimiento.monto}` : formatCurrency(movimiento.monto)}
              </Text>
              {movimiento.montoPesos > 0 && (
                <Text style={styles.historyConversion}>
                  {formatCurrency(movimiento.montoPesos)}
                </Text>
              )}
            </View>
          </View>
        ))
      )}

      {/* Modal de Nuevo Movimiento */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={resetForm}
      >
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nuevo Movimiento de Ahorro</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Tipo de Movimiento</Text>
              <View style={styles.segmentedGrid}>
                <TouchableOpacity
                  style={[styles.segment, tipoAhorro === 'ingreso_pesos' && styles.segmentActive]}
                  onPress={() => setTipoAhorro('ingreso_pesos')}
                >
                  <Text style={[styles.segmentText, tipoAhorro === 'ingreso_pesos' && styles.segmentTextActive]}>
                    Ingreso $
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segment, tipoAhorro === 'ingreso_usd' && styles.segmentActive]}
                  onPress={() => setTipoAhorro('ingreso_usd')}
                >
                  <Text style={[styles.segmentText, tipoAhorro === 'ingreso_usd' && styles.segmentTextActive]}>
                    Ingreso USD
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segment, tipoAhorro === 'egreso_pesos' && styles.segmentActive]}
                  onPress={() => setTipoAhorro('egreso_pesos')}
                >
                  <Text style={[styles.segmentText, tipoAhorro === 'egreso_pesos' && styles.segmentTextActive]}>
                    Egreso $
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segment, tipoAhorro === 'egreso_usd' && styles.segmentActive]}
                  onPress={() => setTipoAhorro('egreso_usd')}
                >
                  <Text style={[styles.segmentText, tipoAhorro === 'egreso_usd' && styles.segmentTextActive]}>
                    Egreso USD
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{getLabelText()}</Text>
              <TextInput
                style={styles.input}
                value={montoAhorro}
                onChangeText={setMontoAhorro}
                placeholder="0.00"
                keyboardType="numeric"
              />
            </View>

            {(tipoAhorro === 'ingreso_usd' || tipoAhorro === 'egreso_usd') && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  {tipoAhorro === 'ingreso_usd' ? 'Monto en Pesos a Pagar' : 'Monto en Pesos a Recibir'}
                </Text>
                <TextInput
                  style={styles.input}
                  value={montoPesosUSD}
                  onChangeText={setMontoPesosUSD}
                  placeholder="0.00"
                  keyboardType="numeric"
                />
              </View>
            )}

            {tipoAhorro !== 'egreso_usd' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{getCuentaLabel()}</Text>
                <View style={styles.picker}>
                  {getCuentasCaja().map(account => (
                    <TouchableOpacity
                      key={account.id}
                      style={[styles.pickerOption, cuentaAhorro === account.id && styles.pickerOptionActive]}
                      onPress={() => setCuentaAhorro(account.id)}
                    >
                      <Text style={[styles.pickerText, cuentaAhorro === account.id && styles.pickerTextActive]}>
                        {account.nombre} - {formatCurrency(account.saldo)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Descripción</Text>
              <TextInput
                style={styles.input}
                value={descripcionAhorro}
                onChangeText={setDescripcionAhorro}
                placeholder="Ej: Ahorro mensual, Compra dólares..."
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={resetForm}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.submitButton]}
                onPress={handleSubmit}
              >
                <Text style={styles.submitButtonText}>Registrar Movimiento</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  savingsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  savingsCard: {
    width: '48%',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  pesosCard: {
    backgroundColor: '#28a745',
  },
  usdCard: {
    backgroundColor: '#17a2b8',
  },
  savingsTitle: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
  },
  savingsAmount: {
    color: 'white',
    fontSize: 18,
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
  },
  historyItem: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  historyInfo: {
    flex: 1,
  },
  historyDesc: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  historyDate: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 2,
  },
  historyType: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '600',
  },
  historyAmount: {
    alignItems: 'flex-end',
  },
  historyValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  historyConversion: {
    fontSize: 12,
    color: '#6c757d',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  segmentedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segment: {
    flex: 1,
    minWidth: '48%',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#dee2e6',
  },
  segmentActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#495057',
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
  picker: {
    gap: 8,
  },
  pickerOption: {
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#dee2e6',
  },
  pickerOptionActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  pickerText: {
    fontSize: 14,
    color: '#495057',
  },
  pickerTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  modalButton: {
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
});