import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

export default function Loader() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>💰</Text>
      <ActivityIndicator size="large" color="#fff" />
      <Text style={styles.text}>Cargando Cuentitas...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    fontSize: 60,
    marginBottom: 20,
  },
  text: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
  },
});