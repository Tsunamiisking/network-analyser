import { View, Text, StyleSheet } from 'react-native';
import React from 'react';

export default function History() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Signal History</Text>
      <Text style={styles.subtitle}>View your past network measurements</Text>
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