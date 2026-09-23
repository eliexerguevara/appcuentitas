import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { addMonths, monthLabel, currentMonthKey } from '../utils/finance';

export default function MonthPicker({ value, onChange }) {
  const esActual = value === currentMonthKey();

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.arrow} onPress={() => onChange(addMonths(value, -1))}>
        <Text style={styles.arrowText}>◀</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.center} onPress={() => onChange(currentMonthKey())}>
        <Text style={styles.label}>{monthLabel(value)}</Text>
        {!esActual && <Text style={styles.hint}>Tocar para volver a hoy</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={styles.arrow} onPress={() => onChange(addMonths(value, 1))}>
        <Text style={styles.arrowText}>▶</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  arrow: {
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  arrowText: {
    fontSize: 16,
    color: '#667eea',
    fontWeight: 'bold',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  label: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#333',
  },
  hint: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
});
