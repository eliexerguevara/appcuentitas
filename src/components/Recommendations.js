import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { globalStyles } from '../styles/global';

const ESTILO = {
  alerta: { icon: '⚠️', color: '#dc3545', bg: '#fdecee' },
  consejo: { icon: '💡', color: '#b58100', bg: '#fff8e1' },
  bien: { icon: '✅', color: '#28a745', bg: '#e9f7ef' },
};

export default function Recommendations({ items, title = '💡 Recomendaciones', max }) {
  const lista = max ? items.slice(0, max) : items;
  if (lista.length === 0) return null;

  return (
    <View style={globalStyles.card}>
      <Text style={styles.title}>{title}</Text>
      {lista.map((r, i) => {
        const e = ESTILO[r.nivel] || ESTILO.consejo;
        return (
          <View key={i} style={[styles.item, { backgroundColor: e.bg, borderLeftColor: e.color }]}>
            <Text style={[styles.itemTitle, { color: e.color }]}>{e.icon} {r.titulo}</Text>
            <Text style={styles.itemText}>{r.texto}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  item: {
    borderLeftWidth: 4,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  itemText: {
    fontSize: 13,
    color: '#444',
    lineHeight: 18,
  },
});
