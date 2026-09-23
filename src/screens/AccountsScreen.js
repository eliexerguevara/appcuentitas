import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  StyleSheet,
  RefreshControl
} from 'react-native';
import { collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import { formatCurrency } from '../utils/formatters';

export default function AccountsScreen() {
  const [accounts, setAccounts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  // Estados del formulario
  const [tipoCuenta, setTipoCuenta] = useState('caja');
  const [nombreCuenta, setNombreCuenta] = useState('');
  const [saldoInicial, setSaldoInicial] = useState('');

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    if (!auth.currentUser) return;

    try {
      const userId = auth.currentUser.uid;
      const accountsSnapshot = await getDocs(collection(db, 'users', userId, 'accounts'));
      const accountsData = accountsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAccounts(accountsData);
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
      acc.nombre.toLowerCase() === nombreCuenta.toLowerCase().trim()
    );

    if (cuentaExistente) {
      Alert.alert('Error', `Ya existe una cuenta con el nombre "${cuentaExistente.nombre}"`);
      return;
    }

    try {
      const userId = auth.currentUser.uid;
      const accountData = {
        tipo: tipoCuenta,
        nombre: nombreCuenta.trim(),
        saldo: parseFloat(saldoInicial) || 0
      };

      await addDoc(collection(db, 'users', userId, 'accounts'), accountData);
      
      Alert.alert('Éxito', `Cuenta "${nombreCuenta}" creada exitosamente`);
      resetForm();
      loadAccounts();
      
    } catch (error) {
      console.error('Error creando cuenta:', error);
      Alert.alert('Error', 'No se pudo crear la cuenta');
    }
  };

  const resetForm = () => {
    setTipoCuenta('caja');
    setNombreCuenta('');
    setSaldoInicial('');
    setShowForm(false);
  };

  const deleteAccount = async (accountId, accountName) => {
    const account = accounts.find(acc => acc.id === accountId);
    
    if (account.saldo !== 0) {
      Alert.alert(
        'Advertencia',
        `Esta cuenta tiene saldo ${formatCurrency(account.saldo)}. ¿Estás seguro de eliminarla?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: () => confirmDelete(accountId)
          }
        ]
      );
    } else {
      confirmDelete(accountId);
    }
  };

  const confirmDelete = async (accountId) => {
    Alert.alert(
      'Eliminar Cuenta',
      '¿Estás seguro de eliminar esta cuenta? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const userId = auth.currentUser.uid;
              await deleteDoc(doc(db, 'users', userId, 'accounts', accountId));
              loadAccounts();
              Alert.alert('Éxito', 'Cuenta eliminada');
            } catch (error) {
              Alert.alert('Error', 'No se pudo eliminar la cuenta');
            }
          }
        }
      ]
    );
  };

  const calculateTotals = () => {
    let totalCaja = 0;
    let totalTarjetas = 0;

    accounts.forEach(account => {
      if (account.tipo === 'caja') {
        totalCaja += account.saldo;
      } else if (account.tipo === 'tarjeta') {
        totalTarjetas += account.saldo;
      }
    });

    return { totalCaja, totalTarjetas, totalGeneral: totalCaja + totalTarjetas };
  };

  const { totalCaja, totalTarjetas, totalGeneral } = calculateTotals();

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
          <Text style={styles.summaryTitle}>Total Caja</Text>
          <Text style={styles.summaryAmount}>{formatCurrency(totalCaja)}</Text>
        </View>
        <View style={[styles.summaryCard, styles.warningCard]}>
          <Text style={styles.summaryTitle}>Total Tarjetas</Text>
          <Text style={styles.summaryAmount}>{formatCurrency(totalTarjetas)}</Text>
        </View>
        <View style={[styles.summaryCard, styles.successCard]}>
          <Text style={styles.summaryTitle}>Total General</Text>
          <Text style={styles.summaryAmount}>{formatCurrency(totalGeneral)}</Text>
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

      {/* Formulario de nueva cuenta */}
      {showForm && (
        <View style={styles.form}>
          <Text style={styles.formTitle}>Nueva Cuenta</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Tipo de Cuenta</Text>
            <View style={styles.segmentedControl}>
              <TouchableOpacity
                style={[styles.segment, tipoCuenta === 'caja' && styles.segmentActive]}
                onPress={() => setTipoCuenta('caja')}
              >
                <Text style={[styles.segmentText, tipoCuenta === 'caja' && styles.segmentTextActive]}>
                  Caja de Ahorro
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segment, tipoCuenta === 'tarjeta' && styles.segmentActive]}
                onPress={() => setTipoCuenta('tarjeta')}
              >
                <Text style={[styles.segmentText, tipoCuenta === 'tarjeta' && styles.segmentTextActive]}>
                  Tarjeta de Crédito
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nombre de la Cuenta</Text>
            <TextInput
              style={styles.input}
              value={nombreCuenta}
              onChangeText={setNombreCuenta}
              placeholder="Ej: Banco Nación, Mercado Pago..."
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Saldo Inicial</Text>
            <TextInput
              style={styles.input}
              value={saldoInicial}
              onChangeText={setSaldoInicial}
              placeholder="0.00"
              keyboardType="numeric"
            />
          </View>

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
              <Text style={styles.submitButtonText}>Crear Cuenta</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Lista de Cuentas */}
      <Text style={styles.sectionTitle}>Mis Cuentas</Text>
      {accounts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No hay cuentas creadas</Text>
          <Text style={styles.emptyStateSubtext}>
            Presiona "Agregar Nueva Cuenta" para comenzar
          </Text>
        </View>
      ) : (
        accounts.map(account => (
          <View 
            key={account.id} 
            style={[
              styles.accountItem,
              account.tipo === 'caja' ? styles.cajaItem : styles.tarjetaItem
            ]}
          >
            <View style={styles.accountInfo}>
              <Text style={styles.accountName}>{account.nombre}</Text>
              <Text style={styles.accountType}>
                {account.tipo === 'caja' ? '💳 Caja de Ahorro' : '💳 Tarjeta de Crédito'}
              </Text>
            </View>
            <View style={styles.accountActions}>
              <Text style={[
                styles.accountBalance,
                { color: account.saldo >= 0 ? '#28a745' : '#dc3545' }
              ]}>
                {formatCurrency(account.saldo)}
              </Text>
              <TouchableOpacity 
                style={styles.deleteButton}
                onPress={() => deleteAccount(account.id, account.nombre)}
              >
                <Text style={styles.deleteButtonText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
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
    marginBottom: 20,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  primaryCard: {
    backgroundColor: '#667eea',
  },
  warningCard: {
    backgroundColor: '#ffc107',
  },
  successCard: {
    backgroundColor: '#28a745',
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
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  accountType: {
    fontSize: 12,
    color: '#6c757d',
  },
  accountActions: {
    alignItems: 'flex-end',
  },
  accountBalance: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#dc3545',
    borderRadius: 5,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
});