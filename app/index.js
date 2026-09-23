import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform
} from 'react-native';
import { PLACEHOLDER_COLOR } from '../src/styles/global';
import { Alert } from '../src/utils/dialog';
import { useRouter } from 'expo-router';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase/config';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

// Necesario para el flujo de autenticación en web
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Configuración de Google Sign In
  // En la web se usa el login de Google que maneja Firebase (no necesita client IDs).
  // En Android/iOS se usa el client ID web del proyecto de Firebase.
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: '30070913023-q5i1ed24qa8n89esqgc1mqcbd6tjtlah.apps.googleusercontent.com',
  });

  const handleGooglePress = async () => {
    if (Platform.OS !== 'web') {
      promptAsync();
      return;
    }
    try {
      setLoading(true);
      await signInWithPopup(auth, googleProvider);
      router.replace('/(tabs)/dashboard');
    } catch (error) {
      if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
        console.error('Error con Google Sign In:', error);
        Alert.alert('Error', error.code === 'auth/popup-blocked'
          ? 'El navegador bloqueó la ventana de Google. Permití las ventanas emergentes e intentá de nuevo.'
          : 'No se pudo iniciar sesión con Google');
      }
    } finally {
      setLoading(false);
    }
  };

  // Manejar respuesta de Google
  React.useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      handleGoogleSignIn(id_token);
    }
  }, [response]);

  const handleGoogleSignIn = async (idToken) => {
    try {
      setLoading(true);
      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);
      Alert.alert('Éxito', '¡Bienvenido!');
      router.replace('/(tabs)/dashboard');
    } catch (error) {
      console.error('Error con Google Sign In:', error);
      Alert.alert('Error', 'No se pudo iniciar sesión con Google');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      Alert.alert('Éxito', '¡Bienvenido!');
      router.replace('/(tabs)/dashboard');
    } catch (error) {
      Alert.alert('Error', getAuthErrorMessage(error.code));
    }
    setLoading(false);
  };

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      Alert.alert('Éxito', '¡Cuenta creada exitosamente!');
      setIsLogin(true);
    } catch (error) {
      Alert.alert('Error', getAuthErrorMessage(error.code));
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Por favor ingresa tu correo electrónico');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert('Éxito', 'Enlace de recuperación enviado a tu correo');
      setIsForgotPassword(false);
    } catch (error) {
      Alert.alert('Error', getAuthErrorMessage(error.code));
    }
    setLoading(false);
  };

  const getAuthErrorMessage = (errorCode) => {
    const errorMessages = {
      'auth/invalid-email': 'El correo electrónico no es válido',
      'auth/user-disabled': 'Esta cuenta ha sido deshabilitada',
      'auth/user-not-found': 'No existe una cuenta con este correo',
      'auth/wrong-password': 'Contraseña incorrecta',
      'auth/email-already-in-use': 'Ya existe una cuenta con este correo',
      'auth/weak-password': 'La contraseña es demasiado débil',
      'auth/network-request-failed': 'Error de conexión. Verifica tu internet',
    };
    return errorMessages[errorCode] || 'Error desconocido';
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>💰</Text>
        <Text style={styles.title}>Cuentitas</Text>
        <Text style={styles.subtitle}>Control Financiero Personal</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, isLogin && styles.activeTab]}
          onPress={() => {
            setIsLogin(true);
            setIsForgotPassword(false);
          }}
        >
          <Text style={[styles.tabText, isLogin && styles.activeTabText]}>
            Iniciar Sesión
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, !isLogin && !isForgotPassword && styles.activeTab]}
          onPress={() => {
            setIsLogin(false);
            setIsForgotPassword(false);
          }}
        >
          <Text style={[styles.tabText, !isLogin && !isForgotPassword && styles.activeTabText]}>
            Registrarse
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.form}>
        {!isForgotPassword ? (
          <>
            {/* Botón de Google Sign In */}
            <TouchableOpacity 
              style={styles.googleButton}
              onPress={handleGooglePress}
              disabled={loading || (Platform.OS !== 'web' && !request)}
            >
              <Text style={styles.googleButtonText}>
                🌐 Continuar con Google
              </Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>o</Text>
              <View style={styles.dividerLine} />
            </View>

            <TextInput
              placeholderTextColor={PLACEHOLDER_COLOR}
              style={styles.input}
              placeholder="Correo Electrónico"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            
            <TextInput
              placeholderTextColor={PLACEHOLDER_COLOR}
              style={styles.input}
              placeholder="Contraseña"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            {!isLogin && (
              <TextInput
                placeholderTextColor={PLACEHOLDER_COLOR}
                style={styles.input}
                placeholder="Confirmar Contraseña"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
            )}

            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={isLogin ? handleLogin : handleRegister}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Cargando...' : (isLogin ? 'Iniciar Sesión' : 'Crear Cuenta')}
              </Text>
            </TouchableOpacity>

            {isLogin && (
              <TouchableOpacity 
                style={styles.linkButton}
                onPress={() => setIsForgotPassword(true)}
              >
                <Text style={styles.linkText}>¿Olvidaste tu contraseña?</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Recuperar Contraseña</Text>
            <TextInput
              placeholderTextColor={PLACEHOLDER_COLOR}
              style={styles.input}
              placeholder="Correo Electrónico"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            
            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={handleForgotPassword}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Enviando...' : 'Enviar Enlace de Recuperación'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.linkButton}
              onPress={() => {
                setIsForgotPassword(false);
                setIsLogin(true);
              }}
            >
              <Text style={styles.linkText}>← Volver al inicio de sesión</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#667eea',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  logo: {
    fontSize: 60,
    marginBottom: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: 'white',
    opacity: 0.9,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: 'white',
  },
  tabText: {
    color: 'white',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#667eea',
  },
  form: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    padding: 25,
    borderRadius: 15,
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  // Estilo del botón de Google
  googleButton: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 2,
    borderColor: '#dee2e6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  googleButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  // Divisor
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#dee2e6',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#6c757d',
    fontSize: 14,
  },
  input: {
    borderWidth: 2,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    marginBottom: 15,
  },
  primaryButton: {
    backgroundColor: '#667eea',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    alignItems: 'center',
    padding: 10,
  },
  linkText: {
    color: '#667eea',
    fontSize: 14,
  },
});