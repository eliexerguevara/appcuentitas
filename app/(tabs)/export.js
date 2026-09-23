import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform
} from 'react-native';
import { Alert } from '../../src/utils/dialog';
import { esConsumo } from '../../src/utils/finance';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { collection, getDocs, deleteDoc, doc, addDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import { ensureHousehold, dataCol, dataDoc } from '../../src/services/household';
import { formatCurrency } from '../../src/utils/formatters';
import * as XLSX from 'xlsx';

export default function ExportScreen() {
  const [loading, setLoading] = useState(false);

  // Función auxiliar para descargar en web
  const downloadFileWeb = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Función auxiliar para crear y compartir archivo Excel
  const createAndShareExcel = async (data, worksheetName, fileName) => {
    try {
      // Crear workbook y worksheet
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, worksheetName);

      if (Platform.OS === 'web') {
        // Para web: generar y descargar directamente
        const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
        downloadFileWeb(
          wbout,
          fileName,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
      } else {
        // Para móvil: guardar en FileSystem y compartir
        const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
        const uri = `${FileSystem.documentDirectory}${fileName}`;
        
        await FileSystem.writeAsStringAsync(uri, wbout, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Compartir archivo
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Exportar a Excel',
            UTI: 'com.microsoft.excel.xlsx'
          });
        }
      }

      return true;
    } catch (error) {
      console.error('Error creando Excel:', error);
      throw error;
    }
  };

  const exportAllTransactions = async () => {
    setLoading(true);
    try {
      await ensureHousehold();
      
      // Cargar transacciones
      const transactionsSnapshot = await getDocs(dataCol('transactions'));
      const transactions = transactionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Cargar cuentas para obtener nombres
      const accountsSnapshot = await getDocs(dataCol('accounts'));
      const accounts = accountsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const accountsMap = Object.fromEntries(accounts.map(acc => [acc.id, acc.nombre]));

      if (transactions.length === 0) {
        Alert.alert('Info', 'No hay transacciones para exportar');
        setLoading(false);
        return;
      }

      // Preparar datos para Excel
      const excelData = transactions.map(trans => ({
        'Fecha': trans.fecha,
        'Tipo': trans.tipo === 'ingreso' ? 'INGRESO' : 
                trans.tipo === 'pago_tarjeta' ? 'PAGO TARJETA' :
                trans.tipo === 'transferencia' ? 'TRANSFERENCIA' : 'EGRESO',
        'Categoría': trans.categoria || '',
        'Descripción': trans.descripcion,
        'Monto': trans.tipo === 'ingreso' ? trans.monto : -trans.monto,
        'Cuenta': accountsMap[trans.cuentaId] || trans.cuentaId,
        'Cuenta Destino': accountsMap[trans.cuentaDestinoId || trans.tarjetaId] || '',
        'Cuotas': trans.cuotas || '',
        'Valor Cuota': trans.montoCuota || '',
        'Primera Cuota': trans.primerMesCuota || '',
        'Comisión': trans.comision || '',
        'Notas': trans.notas || ''
      }));

      const fileName = `transacciones_${new Date().toISOString().split('T')[0]}.xlsx`;
      await createAndShareExcel(excelData, 'Transacciones', fileName);

      Alert.alert('Éxito', `Se exportaron ${transactions.length} transacciones a Excel`);

    } catch (error) {
      console.error('Error exportando:', error);
      Alert.alert('Error', 'No se pudieron exportar las transacciones: ' + error.message);
    }
    setLoading(false);
  };

  const exportExpenses = async () => {
    setLoading(true);
    try {
      await ensureHousehold();
      
      const transactionsSnapshot = await getDocs(dataCol('transactions'));
      const transactions = transactionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const accountsSnapshot = await getDocs(dataCol('accounts'));
      const accounts = accountsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const accountsMap = Object.fromEntries(accounts.map(acc => [acc.id, acc.nombre]));

      // Solo consumo del hogar: sin transferencias, pagos de tarjeta ni ahorro
      const expenses = transactions.filter(esConsumo);

      if (expenses.length === 0) {
        Alert.alert('Info', 'No hay gastos para exportar');
        setLoading(false);
        return;
      }

      const excelData = expenses.map(trans => ({
        'Fecha': trans.fecha,
        'Tipo': 'EGRESO',
        'Categoría': trans.categoria || '',
        'Descripción': trans.descripcion,
        'Monto': -trans.monto,
        'Cuenta': accountsMap[trans.cuentaId] || trans.cuentaId,
        'Cuotas': trans.cuotas || '',
        'Valor Cuota': trans.montoCuota || '',
        'Notas': trans.notas || ''
      }));

      const fileName = `gastos_${new Date().toISOString().split('T')[0]}.xlsx`;
      await createAndShareExcel(excelData, 'Gastos', fileName);

      Alert.alert('Éxito', `Se exportaron ${expenses.length} gastos a Excel`);

    } catch (error) {
      console.error('Error exportando gastos:', error);
      Alert.alert('Error', 'No se pudieron exportar los gastos: ' + error.message);
    }
    setLoading(false);
  };

  const exportAccounts = async () => {
    setLoading(true);
    try {
      await ensureHousehold();
      const accountsSnapshot = await getDocs(dataCol('accounts'));
      const accounts = accountsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (accounts.length === 0) {
        Alert.alert('Info', 'No hay cuentas para exportar');
        setLoading(false);
        return;
      }

      const excelData = accounts.map(account => ({
        'Nombre': account.nombre,
        'Tipo': account.tipo === 'caja' ? 'CAJA' : account.tipo === 'deuda' ? 'DEUDA' : 'TARJETA',
        'Saldo': account.saldo,
        'Límite': account.limite || '',
        'Fecha Creación': account.fechaCreacion ? 
          new Date(account.fechaCreacion).toISOString().split('T')[0] : ''
      }));

      const fileName = `cuentas_${new Date().toISOString().split('T')[0]}.xlsx`;
      await createAndShareExcel(excelData, 'Cuentas', fileName);

      Alert.alert('Éxito', `Se exportaron ${accounts.length} cuentas a Excel`);

    } catch (error) {
      console.error('Error exportando cuentas:', error);
      Alert.alert('Error', 'No se pudieron exportar las cuentas: ' + error.message);
    }
    setLoading(false);
  };

  const importFromFile = async () => {
    try {
      setLoading(true);
      
      let fileContent;
      let workbook;

      if (Platform.OS === 'web') {
        // Para web: usar input file
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xlsx,.xls';
        
        input.onchange = async (e) => {
          const file = e.target.files[0];
          if (!file) {
            setLoading(false);
            return;
          }

          const reader = new FileReader();
          reader.onload = async (event) => {
            try {
              const data = new Uint8Array(event.target.result);
              workbook = XLSX.read(data, { type: 'array' });
              await processImportedWorkbook(workbook);
            } catch (error) {
              console.error('Error leyendo archivo:', error);
              Alert.alert('Error', 'No se pudo leer el archivo: ' + error.message);
              setLoading(false);
            }
          };
          reader.readAsArrayBuffer(file);
        };
        
        input.click();
      } else {
        // Para móvil: usar DocumentPicker
        const result = await DocumentPicker.getDocumentAsync({
          type: [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel'
          ],
          copyToCacheDirectory: true
        });

        if (result.canceled) {
          setLoading(false);
          return;
        }

        // Leer archivo
        fileContent = await FileSystem.readAsStringAsync(result.assets[0].uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Parsear Excel
        workbook = XLSX.read(fileContent, { type: 'base64' });
        await processImportedWorkbook(workbook);
      }

    } catch (error) {
      console.error('Error al seleccionar archivo:', error);
      Alert.alert('Error', 'No se pudo leer el archivo: ' + error.message);
      setLoading(false);
    }
  };

  const processImportedWorkbook = async (workbook) => {
    try {
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      if (data.length === 0) {
        Alert.alert('Error', 'El archivo no contiene datos');
        setLoading(false);
        return;
      }

      // Validar estructura del archivo
      const requiredColumns = ['Fecha', 'Tipo', 'Descripción', 'Monto'];
      const firstRow = data[0];
      const hasRequiredColumns = requiredColumns.every(col => col in firstRow);

      if (!hasRequiredColumns) {
        Alert.alert(
          'Error de Formato',
          `El archivo debe contener las columnas: ${requiredColumns.join(', ')}`
        );
        setLoading(false);
        return;
      }

      // Confirmar importación
      Alert.alert(
        'Confirmar Importación',
        `Se encontraron ${data.length} transacciones.\n\n¿Deseas importarlas?`,
        [
          { text: 'Cancelar', style: 'cancel', onPress: () => setLoading(false) },
          {
            text: 'Importar',
            onPress: async () => {
              try {
                await ensureHousehold();
                
                // Cargar cuentas existentes para mapear nombres a IDs
                const accountsSnapshot = await getDocs(dataCol('accounts'));
                const accounts = accountsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const accountsNameMap = Object.fromEntries(accounts.map(acc => [acc.nombre, acc.id]));

                let importedCount = 0;
                let errorCount = 0;

                for (const row of data) {
                  try {
                    // Buscar ID de cuenta
                    const cuentaId = accountsNameMap[row.Cuenta] || accounts[0]?.id;
                    
                    if (!cuentaId) {
                      errorCount++;
                      continue;
                    }

                    const transactionData = {
                      tipo: row.Tipo === 'INGRESO' ? 'ingreso' : 
                            row.Tipo === 'PAGO TARJETA' ? 'pago_tarjeta' :
                            row.Tipo === 'TRANSFERENCIA' ? 'transferencia' : 'egreso',
                      cuentaId: cuentaId,
                      categoria: row.Categoría || 'OTROS',
                      monto: Math.abs(parseFloat(row.Monto)),
                      descripcion: row.Descripción,
                      fecha: row.Fecha,
                      notas: row.Notas || '',
                      fechaCreacion: new Date().toISOString()
                    };

                    await addDoc(dataCol('transactions'), transactionData);
                    importedCount++;
                  } catch (rowError) {
                    console.error('Error en fila:', rowError);
                    errorCount++;
                  }
                }

                Alert.alert(
                  'Importación Completada',
                  `✅ Importadas: ${importedCount}\n${errorCount > 0 ? `❌ Errores: ${errorCount}` : ''}`
                );

              } catch (error) {
                console.error('Error importando:', error);
                Alert.alert('Error', 'No se pudieron importar las transacciones: ' + error.message);
              }
              setLoading(false);
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error procesando archivo:', error);
      Alert.alert('Error', 'No se pudo procesar el archivo: ' + error.message);
      setLoading(false);
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
            try {
              setLoading(true);
              await ensureHousehold();
              const transactionsSnapshot = await getDocs(dataCol('transactions'));
              
              const deletePromises = transactionsSnapshot.docs.map(doc => 
                deleteDoc(doc.ref)
              );
              
              await Promise.all(deletePromises);
              Alert.alert('Éxito', 'Todas las transacciones han sido eliminadas');
              setLoading(false);

            } catch (error) {
              console.error('Error eliminando:', error);
              Alert.alert('Error', 'No se pudieron eliminar las transacciones');
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const showFormatInfo = () => {
    Alert.alert(
      'Formato de Archivo Excel',
      'Para importar datos, el archivo Excel debe tener las siguientes columnas:\n\n' +
      '• Fecha (YYYY-MM-DD)\n' +
      '• Tipo (INGRESO/EGRESO/PAGO TARJETA)\n' + 
      '• Categoría\n' +
      '• Descripción\n' +
      '• Monto (número sin símbolos)\n' +
      '• Cuenta (nombre de la cuenta)\n' +
      '• Notas (opcional)\n\n' +
      '💡 Recomendación: Exporta primero para ver el formato exacto.',
      [{ text: 'Entendido' }]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>📊 Importar y Exportar Datos</Text>

      {/* Sección Exportar */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📤 Exportar a Excel</Text>
        <Text style={styles.sectionDescription}>
          Descarga tus datos en formato Excel (.xlsx) para backup o análisis externo.
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

        <TouchableOpacity 
          style={[styles.exportButton, styles.infoButton]}
          onPress={exportAccounts}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Exportando...' : '💳 Exportar Cuentas'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sección Importar */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📥 Importar desde Excel</Text>
        <Text style={styles.sectionDescription}>
          Importa transacciones desde un archivo Excel (.xlsx).
        </Text>

        <TouchableOpacity 
          style={[styles.importButton, styles.warningButton]}
          onPress={importFromFile}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Procesando...' : '📁 Seleccionar Archivo Excel'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.helpButton}
          onPress={showFormatInfo}
        >
          <Text style={styles.helpButtonText}>ℹ️ Ver Formato Requerido</Text>
        </TouchableOpacity>

        <View style={styles.helpBox}>
          <Text style={styles.helpTitle}>📝 Recomendaciones:</Text>
          <Text style={styles.helpText}>
            • Exporta primero para ver el formato exacto{'\n'}
            • Usa fechas en formato YYYY-MM-DD{'\n'}
            • Los montos deben ser números sin símbolos{'\n'}
            • Los nombres de cuenta deben coincidir exactamente{'\n'}
            • Las categorías deben existir en la app
          </Text>
        </View>
      </View>

      {/* Sección Backup */}
      <View style={[styles.section, styles.backupSection]}>
        <Text style={styles.sectionTitle}>💾 Backup Completo</Text>
        <Text style={styles.sectionDescription}>
          Realiza backup completo de todos tus datos en Excel.
        </Text>

        <TouchableOpacity 
          style={[styles.backupButton, styles.successButton]}
          onPress={exportAllTransactions}
          disabled={loading}
        >
          <Text style={styles.buttonText}>💾 Crear Backup en Excel</Text>
        </TouchableOpacity>

        <Text style={styles.backupNote}>
          💡 Realiza backups regularmente para proteger tu información.
        </Text>
      </View>

      {/* Sección Peligrosa */}
      <View style={[styles.section, styles.dangerSection]}>
        <Text style={[styles.sectionTitle, styles.dangerTitle]}>
          🗑️ Zona Peligrosa
        </Text>
        <Text style={[styles.sectionDescription, styles.dangerText]}>
          <Text style={styles.warningText}>⚠️ ADVERTENCIA: </Text>
          Esta acción eliminará TODAS tus transacciones de forma permanente.
        </Text>

        <TouchableOpacity 
          style={[styles.deleteButton, styles.dangerButton]}
          onPress={deleteAllTransactions}
          disabled={loading}
        >
          <Text style={styles.buttonText}>🗑️ Eliminar Todas las Transacciones</Text>
        </TouchableOpacity>
      </View>

      {/* Información de la App */}
      <View style={[styles.section, styles.infoSection]}>
        <Text style={styles.sectionTitle}>ℹ️ Información</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Versión:</Text>
            <Text style={styles.infoValue}>Cuentitas 2.0.0</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Formato:</Text>
            <Text style={styles.infoValue}>Excel (.xlsx)</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Plataforma:</Text>
            <Text style={styles.infoValue}>{Platform.OS}</Text>
          </View>
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
  backupSection: {
    backgroundColor: '#d1edff',
    borderWidth: 1,
    borderColor: '#b8daff',
  },
  dangerSection: {
    backgroundColor: '#f8d7da',
    borderWidth: 1,
    borderColor: '#f5c6cb',
  },
  infoSection: {
    backgroundColor: '#e2e3e5',
    borderWidth: 1,
    borderColor: '#d6d8db',
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
  backupButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  deleteButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  helpButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#dee2e6',
  },
  primaryButton: {
    backgroundColor: '#28a745',
  },
  dangerButton: {
    backgroundColor: '#dc3545',
  },
  infoButton: {
    backgroundColor: '#17a2b8',
  },
  warningButton: {
    backgroundColor: '#ffc107',
  },
  successButton: {
    backgroundColor: '#20c997',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  helpButtonText: {
    color: '#495057',
    fontSize: 14,
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
  backupNote: {
    fontSize: 12,
    color: '#0c5460',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 10,
  },
  infoGrid: {
    gap: 10,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
  },
  infoValue: {
    fontSize: 14,
    color: '#6c757d',
  },
});