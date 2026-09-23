import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Platform
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import { formatCurrency } from '../utils/formatters';

export default function ImportExportScreen() {
  const [loading, setLoading] = useState(false);

  const exportAllTransactions = async () => {
    setLoading(true);
    try {
      const userId = auth.currentUser.uid;
      const transactionsSnapshot = await getDocs(collection(db, 'users', userId, 'transactions'));
      const transactions = transactionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (transactions.length === 0) {
        Alert.alert('Info', 'No hay transacciones para exportar');
        return;
      }

      // Crear contenido CSV
      let csvContent = 'Fecha,Tipo,Categoría,Descripción,Monto,Cuenta,Notas\n';
      
      transactions.forEach(trans => {
        const row = [
          trans.fecha,
          trans.tipo === 'ingreso' ? 'INGRESO' : trans.tipo === 'pago_tarjeta' ? 'PAGO TARJETA' : 'EGRESO',
          trans.categoria || '',
          `"${trans.descripcion}"`,
          trans.tipo === 'ingreso' ? trans.monto : -trans.monto,
          trans.cuentaId,
          `"${trans.notas || ''}"`
        ].join(',');
        
        csvContent += row + '\n';
      });

      // Guardar archivo temporal
      const fileName = `transacciones_${new Date().toISOString().split('T')[0]}.csv`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8
      });

      // Compartir archivo
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Exportar Transacciones'
        });
      } else {
        Alert.alert('Éxito', `Archivo guardado en: ${fileUri}`);
      }

      Alert.alert('Éxito', `${transactions.length} transacciones exportadas`);

    } catch (error) {
      console.error('Error exportando:', error);
      Alert.alert('Error', 'No se pudieron exportar las transacciones');
    }
    setLoading(false);
  };

  const exportExpenses = async () => {
    setLoading(true);
    try {
      const userId = auth.currentUser.uid;
      const transactionsSnapshot = await getDocs(collection(db, 'users', userId, 'transactions'));
      const transactions = transactionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const expenses = transactions.filter(trans => 
        trans.tipo === 'egreso' || trans.tipo === 'pago_tarjeta'
      );

      if (expenses.length === 0) {
        Alert.alert('Info', 'No hay gastos para exportar');
        return;
      }

      // Crear contenido CSV
      let csvContent = 'Fecha,Tipo,Categoría,Descripción,Monto,Cuenta,Notas\n';
      
      expenses.forEach(trans => {
        const row = [
          trans.fecha,
          trans.tipo === 'pago_tarjeta' ? 'PAGO TARJETA' : 'EGRESO',
          trans.categoria || '',
          `"${trans.descripcion}"`,
          -trans.monto,
          trans.cuentaId,
          `"${trans.notas || ''}"`
        ].join(',');
        
        csvContent += row + '\n';
      });

      const fileName = `gastos_${new Date().toISOString().split('T')[0]}.csv`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Éxito', `Archivo guardado en: ${fileUri}`);
      }

      Alert.alert('Éxito', `${expenses.length} gastos exportados`);

    } catch (error) {
      console.error('Error exportando gastos:', error);
      Alert.alert('Error', 'No se pudieron exportar los gastos');
    }
    setLoading(false);
  };

  const importFromFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/csv',
        copyToCacheDirectory: true
      });

      if (result.type === 'success') {
        Alert.alert(
          'Importar Datos',
          'Esta funcionalidad procesaría el archivo CSV y cargaría las transacciones. ¿Quieres ver el formato requerido?',
          [
            { text: 'Cancelar', style: 'cancel' },
            { 
              text: 'Ver Formato', 
              onPress: () => Alert.alert(
                'Formato Requerido',
                'El archivo CSV debe tener las columnas:\n\n• FECHA (YYYY-MM-DD)\n• TIPO (INGRESO/EGRESO)\n• CATEGORÍA\n• DESCRIPCIÓN\n• MONTO\n• CUENTA\n• NOTAS\n\nExporta primero para ver el formato exacto.'
              )
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error importando:', error);
      Alert.alert('Error', 'No se pudo importar el archivo');
    }
  };

  const deleteAllTransactions = async () => {
    Alert.alert(
      'ELIMINAR TODAS LAS TRANSACCIONES',
      '⚠️ ESTA ACCIÓN ES IRREVERSIBLE ⚠️\n\n¿Estás seguro de eliminar TODAS las transacciones? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const confirmation = await new Promise(resolve => {
              Alert.alert(
                'Confirmación Final',
                'Escribe "ELIMINAR" para confirmar:',
                [
                  { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
                  {
                    text: 'Confirmar',
                    onPress: () => resolve(true)
                  }
                ],
                'plain-text'
              );
            });

            if (!confirmation) return;

            try {
              const userId = auth.currentUser.uid;
              const transactionsSnapshot = await getDocs(collection(db, 'users', userId, 'transactions'));
              
              const deletePromises = transactionsSnapshot.docs.map(doc => 
                deleteDoc(doc.ref)
              );
              
              await Promise.all(deletePromises);
              Alert.alert('Éxito', 'Todas las transacciones han sido eliminadas');

            } catch (error) {
              console.error('Error eliminando:', error);
              Alert.alert('Error', 'No se pudieron eliminar las transacciones');
            }
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Importar y Exportar Datos</Text>

      {/* Sección Exportar */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📤 Exportar Datos</Text>
        <Text style={styles.sectionDescription}>
          Descarga tus datos en formato CSV para backup o análisis externo.
        </Text>

        <TouchableOpacity 
          style={[styles.exportButton, styles.primaryButton]}
          onPress={exportAllTransactions}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Exportando...' : '📋 Exportar Todas las Transacciones'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.exportButton, styles.dangerButton]}
          onPress={exportExpenses}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Exportando...' : '💰 Exportar Solo Gastos'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sección Importar */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📥 Importar Datos</Text>
        <Text style={styles.sectionDescription}>
          Importa transacciones desde un archivo CSV.
        </Text>

        <TouchableOpacity 
          style={[styles.importButton, styles.infoButton]}
          onPress={importFromFile}
          disabled={loading}
        >
          <Text style={styles.buttonText}>📤 Seleccionar Archivo CSV</Text>
        </TouchableOpacity>

        <View style={styles.helpBox}>
          <Text style={styles.helpTitle}>⚠️ Formato Requerido:</Text>
          <Text style={styles.helpText}>
            • FECHA (YYYY-MM-DD){'\n'}
            • TIPO (INGRESO/EGRESO){'\n'}
            • CATEGORÍA{'\n'}
            • DESCRIPCIÓN{'\n'}
            • MONTO{'\n'}
            • CUENTA{'\n'}
            • NOTAS{'\n\n'}
            Se recomienda exportar primero para ver el formato exacto.
          </Text>
        </View>
      </View>

      {/* Sección Peligrosa */}
      <View style={[styles.section, styles.dangerSection]}>
        <Text style={[styles.sectionTitle, styles.dangerTitle]}>
          🗑️ Eliminar Todas las Transacciones
        </Text>
        <Text style={[styles.sectionDescription, styles.dangerText]}>
          <Text style={styles.warningText}>⚠️ ADVERTENCIA: </Text>
          Esta acción eliminará TODAS tus transacciones de forma permanente. No se puede deshacer.
        </Text>

        <TouchableOpacity 
          style={[styles.deleteButton, styles.dangerButton]}
          onPress={deleteAllTransactions}
        >
          <Text style={styles.buttonText}>🗑️ Eliminar Todas las Transacciones</Text>
        </TouchableOpacity>
      </View>

      {/* Información de la App */}
      <View style={[styles.section, styles.infoSection]}>
        <Text style={styles.sectionTitle}>ℹ️ Información</Text>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Versión:</Text>
          <Text style={styles.infoValue}>Cuentitas 1.0.0</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Desarrollado con:</Text>
          <Text style={styles.infoValue}>React Native + Firebase</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Soporte:</Text>
          <Text style={styles.infoValue}>contacto@cuentitas.com</Text>
        </View>
      </View>
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
  section: {
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
  dangerSection: {
    backgroundColor: '#f8d7da',
    borderWidth: 1,
    borderColor: '#f5c6cb',
  },
  infoSection: {
    backgroundColor: '#d1edff',
    borderWidth: 1,
    borderColor: '#b8daff',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  dangerTitle: {
    color: '#721c24',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 15,
    lineHeight: 20,
  },
  dangerText: {
    color: '#721c24',
  },
  warningText: {
    fontWeight: 'bold',
  },
  exportButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  importButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  deleteButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#28a745',
  },
  infoButton: {
    backgroundColor: '#17a2b8',
  },
  dangerButton: {
    backgroundColor: '#dc3545',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  helpBox: {
    backgroundColor: '#fff3cd',
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 12,
    color: '#856404',
    lineHeight: 18,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#b8daff',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#004085',
  },
  infoValue: {
    fontSize: 14,
    color: '#004085',
  },
});