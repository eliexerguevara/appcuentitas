import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatCurrency } from '../utils/formatters';
import { infoTarjeta } from '../utils/finance';

// Barra de uso del límite de una tarjeta de crédito.
export default function CreditCardStatus({ account, compact = false }) {
  const { limite, deuda, aFavor, disponible, uso } = infoTarjeta(account);
  const color = uso >= 0.8 ? '#dc3545' : uso >= 0.5 ? '#ffc107' : '#28a745';

  return (
    <View>
      <View style={styles.row}>
        <Text style={styles.label}>Deuda</Text>
        <Text style={[styles.value, { color: deuda > 0 ? '#dc3545' : '#28a745' }]}>
          {formatCurrency(deuda)}
        </Text>
      </View>
      {aFavor > 0 && (
        <View style={styles.row}>
          <Text style={styles.label}>Saldo a favor</Text>
          <Text style={[styles.value, { color: '#28a745' }]}>{formatCurrency(aFavor)}</Text>
        </View>
      )}
      {limite > 0 ? (
        <>
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: `${Math.min(100, uso * 100)}%`, backgroundColor: color }]} />
          </View>
          <View style={styles.row}>
            <Text style={styles.small}>Usado {Math.round(uso * 100)}% de {formatCurrency(limite)}</Text>
            <Text style={[styles.small, { fontWeight: 'bold', color: disponible >= 0 ? '#333' : '#dc3545' }]}>
              Disponible {formatCurrency(disponible)}
            </Text>
          </View>
        </>
      ) : (
        !compact && <Text style={styles.warning}>Sin límite configurado. Tocá "Editar" para cargarlo.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  label: {
    fontSize: 13,
    color: '#666',
  },
  value: {
    fontSize: 16,
    fontWeight: 'bold',
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
    borderRadius: 5,
  },
  small: {
    fontSize: 12,
    color: '#666',
  },
  warning: {
    fontSize: 12,
    color: '#b58100',
    marginTop: 4,
  },
});
