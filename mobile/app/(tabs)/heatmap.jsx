import { View, Text, StyleSheet } from 'react-native';
import React from 'react';

export default function Heatmap() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Network Heatmap</Text>
      <Text style={styles.subtitle}>View signal strength across Nigeria</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
});