import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Modal,
  TextInput,
  RefreshControl
} from 'react-native';
import { collection, getDocs, addDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import { formatCurrency, formatDate } from '../utils/formatters';

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  // Estados del formulario
  const [tipo, setTipo] = useState('egreso');
  const [cuentaId, setCuentaId] = useState('');
  const [categoria, setCategoria] = useState('HOGAR');
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [notas, setNotas] = useState('');

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

      // Cargar transacciones
      const transactionsSnapshot = await getDocs(collection(db, 'users', userId, 'transactions'));
      const transactionsData = transactionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(transactionsData.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)));

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
    if (!cuentaId || !monto || !descripcion) {
      Alert.alert('Error', 'Completa todos los campos obligatorios');
      return;
    }

    try {
      const userId = auth.currentUser.uid;
      const transactionData = {
        tipo,
        cuentaId,
        categoria,
        monto: parseFloat(monto),
        descripcion,
        fecha,
        notas,
        fechaCreacion: new Date().toISOString()
      };

      // Guardar en Firebase
      await addDoc(collection(db, 'users', userId, 'transactions'), transactionData);

      // Actualizar saldo de la cuenta
      const cuenta = accounts.find(acc => acc.id === cuentaId);
      if (cuenta) {
        const nuevoSaldo = tipo === 'ingreso' 
          ? cuenta.saldo + parseFloat(monto)
          : cuenta.saldo - parseFloat(monto);
        
        // Aquí deberías actualizar la cuenta en Firebase
        // await updateDoc(doc(db, 'users', userId, 'accounts', cuentaId), { saldo: nuevoSaldo });
      }

      Alert.alert('Éxito', 'Transacción registrada correctamente');
      resetForm();
      loadData();
      
    } catch (error) {
      console.error('Error guardando transacción:', error);
      Alert.alert('Error', 'No se pudo guardar la transacción');
    }
  };

  const resetForm = () => {
    setTipo('egreso');
    setCuentaId('');
    setCategoria('HOGAR');
    setMonto('');
    setDescripcion('');
    setFecha(new Date().toISOString().split('T')[0]);
    setNotas('');
  };

  const deleteTransaction = async (transactionId) => {
    Alert.alert(
      'Eliminar Transacción',
      '¿Estás seguro de eliminar esta transacción?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const userId = auth.currentUser.uid;
              await deleteDoc(doc(db, 'users', userId, 'transactions', transactionId));
              loadData();
              Alert.alert('Éxito', 'Transacción eliminada');
            } catch (error) {
              Alert.alert('Error', 'No se pudo eliminar la transacción');
            }
          }
        }
      ]
    );
  };

  const showTransactionDetails = (transaction) => {
    setSelectedTransaction(transaction);
    setModalVisible(true);
  };

  const calculateTotals = () => {
    let totalIngresos = 0;
    let totalEgresos = 0;

    transactions.forEach(trans => {
      if (trans.tipo === 'ingreso') {
        totalIngresos += trans.monto;
      } else {
        totalEgresos += trans.monto;
      }
    });

    return { totalIngresos, totalEgresos, balance: totalIngresos - totalEgresos };
  };

  const { totalIngresos, totalEgresos, balance } = calculateTotals();

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.title}>Nueva Transacción</Text>

      {/* Formulario */}
      <View style={styles.form}>
        <View style={styles.row}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Tipo</Text>
            <View style={styles.segmentedControl}>
              <TouchableOpacity
                style={[styles.segment, tipo === 'ingreso' && styles.segmentActive]}
                onPress={() => setTipo('ingreso')}
              >
                <Text style={[styles.segmentText, tipo === 'ingreso' && styles.segmentTextActive]}>
                  Ingreso
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segment, tipo === 'egreso' && styles.segmentActive]}
                onPress={() => setTipo('egreso')}
              >
                <Text style={[styles.segmentText, tipo === 'egreso' && styles.segmentTextActive]}>
                  Egreso
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Monto</Text>
            <TextInput
              style={styles.input}
              value={monto}
              onChangeText={setMonto}
              placeholder="0.00"
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Cuenta</Text>
          <View style={styles.picker}>
            {accounts.map(account => (
              <TouchableOpacity
                key={account.id}
                style={[styles.pickerOption, cuentaId === account.id && styles.pickerOptionActive]}
                onPress={() => setCuentaId(account.id)}
              >
                <Text style={[styles.pickerText, cuentaId === account.id && styles.pickerTextActive]}>
                  {account.nombre}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Categoría</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.categories}>
              {['HOGAR', 'SALUD', 'COMIDA', 'ROPA', 'OCIO', 'TRANSPORTE', 'SERVICIOS'].map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.category, categoria === cat && styles.categoryActive]}
                  onPress={() => setCategoria(cat)}
                >
                  <Text style={[styles.categoryText, categoria === cat && styles.categoryTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Descripción</Text>
          <TextInput
            style={styles.input}
            value={descripcion}
            onChangeText={setDescripcion}
            placeholder="Descripción de la transacción"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Fecha</Text>
          <TextInput
            style={styles.input}
            value={fecha}
            onChangeText={setFecha}
            placeholder="YYYY-MM-DD"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Notas</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notas}
            onChangeText={setNotas}
            placeholder="Notas adicionales..."
            multiline
            numberOfLines={3}
          />
        </View>

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Registrar Transacción</Text>
        </TouchableOpacity>
      </View>

      {/* Resumen */}
      <View style={styles.summaryGrid}>
        <View style={[styles.summaryCard, styles.balanceCard]}>
          <Text style={styles.summaryTitle}>Balance Total</Text>
          <Text style={styles.summaryAmount}>{formatCurrency(balance)}</Text>
        </View>
        <View style={[styles.summaryCard, styles.incomeCard]}>
          <Text style={styles.summaryTitle}>Total Ingresos</Text>
          <Text style={styles.summaryAmount}>{formatCurrency(totalIngresos)}</Text>
        </View>
        <View style={[styles.summaryCard, styles.expenseCard]}>
          <Text style={styles.summaryTitle}>Total Egresos</Text>
          <Text style={styles.summaryAmount}>{formatCurrency(totalEgresos)}</Text>
        </View>
      </View>

      {/* Lista de Transacciones */}
      <Text style={styles.sectionTitle}>Últimas Transacciones</Text>
      {transactions.map(transaction => {
        const cuenta = accounts.find(acc => acc.id === transaction.cuentaId);
        return (
          <TouchableOpacity 
            key={transaction.id} 
            style={styles.transactionItem}
            onPress={() => showTransactionDetails(transaction)}
          >
            <View style={styles.transactionInfo}>
              <Text style={styles.transactionDesc}>{transaction.descripcion}</Text>
              <Text style={styles.transactionMeta}>
                {transaction.categoria} • {cuenta?.nombre} • {formatDate(transaction.fecha)}
              </Text>
            </View>
            <View style={styles.transactionAmount}>
              <Text style={[
                styles.amount,
                { color: transaction.tipo === 'ingreso' ? '#28a745' : '#dc3545' }
              ]}>
                {transaction.tipo === 'ingreso' ? '+' : '-'}{formatCurrency(transaction.monto)}
              </Text>
              <TouchableOpacity 
                style={styles.deleteButton}
                onPress={() => deleteTransaction(transaction.id)}
              >
                <Text style={styles.deleteButtonText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        );
      })}

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
                <Text style={styles.modalTitle}>Detalles de Transacción</Text>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Descripción:</Text>
                  <Text style={styles.detailValue}>{selectedTransaction.descripcion}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Monto:</Text>
                  <Text style={styles.detailValue}>
                    {formatCurrency(selectedTransaction.monto)}
                  </Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Fecha:</Text>
                  <Text style={styles.detailValue}>{formatDate(selectedTransaction.fecha)}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Categoría:</Text>
                  <Text style={styles.detailValue}>{selectedTransaction.categoria}</Text>
                </View>
                {selectedTransaction.notas && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Notas:</Text>
                    <Text style={styles.detailValue}>{selectedTransaction.notas}</Text>
                  </View>
                )}
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.closeButtonText}>Cerrar</Text>
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    paddingVertical: 8,
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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  picker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  categories: {
    flexDirection: 'row',
    gap: 8,
  },
  category: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#dee2e6',
  },
  categoryActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  categoryText: {
    fontSize: 12,
    color: '#495057',
    fontWeight: '600',
  },
  categoryTextActive: {
    color: 'white',
  },
  submitButton: {
    backgroundColor: '#667eea',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  transactionItem: {
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
  transactionInfo: {
    flex: 1,
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
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
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
  detailItem: {
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
  closeButton: {
    backgroundColor: '#667eea',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});