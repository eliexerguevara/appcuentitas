import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  Share,
} from 'react-native';
import { PLACEHOLDER_COLOR } from '../../src/styles/global';
import { useFocusEffect } from '@react-navigation/native';
import { auth } from '../../firebase/config';
import { Alert } from '../../src/utils/dialog';
import { globalStyles, colors } from '../../src/styles/global';
import {
  createHousehold,
  getHousehold,
  joinHousehold,
  leaveHousehold,
  setInvitacionAbierta,
} from '../../src/services/household';

export default function HouseholdScreen() {
  const [household, setHousehold] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');

  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [])
  );

  const load = async () => {
    if (!auth.currentUser) return;
    try {
      setHousehold(await getHousehold());
    } catch (error) {
      console.error('Error cargando hogar:', error);
    }
    setLoading(false);
  };

  const run = async (fn, okMsg) => {
    setBusy(true);
    try {
      await fn();
      await load();
      if (okMsg) Alert.alert('Listo', okMsg);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', error.code === 'permission-denied' || error.code === 'not-found'
        ? 'Código inválido o el hogar no acepta nuevos miembros.'
        : 'No se pudo completar la operación: ' + error.message);
    }
    setBusy(false);
  };

  const crear = () => run(
    () => createHousehold(nombre.trim()),
    'Hogar creado. Tus cuentas y transacciones se copiaron al hogar. Compartí el código con tu pareja.'
  );

  const unirse = () => {
    if (!codigo.trim()) {
      Alert.alert('Error', 'Pegá el código que te compartieron');
      return;
    }
    Alert.alert(
      'Unirse al hogar',
      'Vas a ver y cargar los datos del hogar compartido. Tus datos personales actuales no se borran, pero dejarás de verlos mientras estés en el hogar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Unirme', onPress: () => run(() => joinHousehold(codigo), '¡Te uniste al hogar!') },
      ]
    );
  };

  const salir = () => Alert.alert(
    'Salir del hogar',
    'Dejarás de ver los datos compartidos y volverás a tus datos personales. ¿Continuar?',
    [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: () => run(leaveHousehold) },
    ]
  );

  const compartir = async () => {
    const mensaje = `Unite a nuestro hogar en Cuentitas (https://cuentitas-b57b4.web.app). Entrá a "Hogar" y pegá este código:\n\n${household.id}`;
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(household.id);
        Alert.alert('Copiado', 'El código se copió. Mandáselo por WhatsApp a tu pareja.');
      } else {
        await Share.share({ message: mensaje });
      }
    } catch (error) {
      Alert.alert('Código', household.id);
    }
  };

  if (loading) {
    return <View style={styles.container}><Text style={styles.muted}>Cargando...</Text></View>;
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>👥 Hogar compartido</Text>

      {household ? (
        <>
          <View style={globalStyles.card}>
            <Text style={styles.sectionTitle}>{household.nombre}</Text>
            <Text style={styles.muted}>Todos los miembros ven y cargan las mismas cuentas, tarjetas, transacciones y ahorros.</Text>

            <Text style={styles.label}>Miembros</Text>
            {(household.miembrosEmail || []).map(email => (
              <Text key={email} style={styles.member}>
                • {email}{email === auth.currentUser?.email ? ' (vos)' : ''}
              </Text>
            ))}
          </View>

          <View style={globalStyles.card}>
            <Text style={styles.sectionTitle}>Invitar</Text>
            <Text style={styles.muted}>Tu pareja tiene que crear su propia cuenta en la app, entrar a "Hogar" y pegar este código:</Text>
            <Text selectable style={styles.code}>{household.id}</Text>
            <TouchableOpacity style={[styles.button, styles.primary]} onPress={compartir}>
              <Text style={styles.buttonText}>{Platform.OS === 'web' ? '📋 Copiar código' : '📤 Compartir código'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.secondary]}
              disabled={busy}
              onPress={() => run(() => setInvitacionAbierta(!household.invitacionAbierta))}
            >
              <Text style={styles.buttonText}>
                {household.invitacionAbierta ? '🔒 Cerrar invitaciones' : '🔓 Abrir invitaciones'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.muted}>
              {household.invitacionAbierta
                ? 'Invitaciones abiertas: cualquiera con el código puede unirse. Cerralas cuando tu pareja ya esté dentro.'
                : 'Invitaciones cerradas: nadie más puede unirse.'}
            </Text>
          </View>

          <TouchableOpacity style={[styles.button, styles.danger]} onPress={salir} disabled={busy}>
            <Text style={styles.buttonText}>Salir del hogar</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <View style={globalStyles.card}>
            <Text style={styles.sectionTitle}>Crear un hogar</Text>
            <Text style={styles.muted}>
              Tus cuentas, tarjetas, transacciones y ahorros actuales se copian al hogar. Después invitás a tu pareja con un código.
            </Text>
            <TextInput
              placeholderTextColor={PLACEHOLDER_COLOR}
              style={styles.input}
              value={nombre}
              onChangeText={setNombre}
              placeholder="Nombre (ej: Casa Guevara)"
            />
            <TouchableOpacity style={[styles.button, styles.primary]} onPress={crear} disabled={busy}>
              <Text style={styles.buttonText}>{busy ? 'Creando...' : 'Crear hogar'}</Text>
            </TouchableOpacity>
          </View>

          <View style={globalStyles.card}>
            <Text style={styles.sectionTitle}>Unirme a un hogar</Text>
            <Text style={styles.muted}>Si tu pareja ya creó el hogar, pegá el código que te mandó.</Text>
            <TextInput
              placeholderTextColor={PLACEHOLDER_COLOR}
              style={styles.input}
              value={codigo}
              onChangeText={setCodigo}
              placeholder="Código del hogar"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={[styles.button, styles.success]} onPress={unirse} disabled={busy}>
              <Text style={styles.buttonText}>{busy ? 'Uniendo...' : 'Unirme'}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
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
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginTop: 12,
    marginBottom: 6,
  },
  muted: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
    lineHeight: 18,
  },
  member: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  code: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
    backgroundColor: '#eef0fd',
    padding: 12,
    borderRadius: 8,
    textAlign: 'center',
    marginVertical: 8,
    letterSpacing: 1,
  },
  input: {
    borderWidth: 2,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginVertical: 8,
    backgroundColor: 'white',
  },
  button: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 6,
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: '#6c757d' },
  success: { backgroundColor: colors.success },
  danger: { backgroundColor: colors.danger },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
});
