import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { MODES } from '@forge/core';

export default function ModeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const mode = MODES.find((m) => m.id === id);

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{mode?.icon || '✦'}</Text>
      <Text style={styles.title}>{mode?.label || 'Mode'}</Text>
      <Text style={styles.persona}>with {mode?.persona}</Text>
      <Text style={styles.note}>
        Chat and project creation on mobile aren't built yet -- this screen is a
        placeholder. The web app already has the full flow at /projects.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B2B1A', alignItems: 'center', justifyContent: 'center', padding: 24 },
  icon: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 24, color: '#F0D48A', fontFamily: 'serif' },
  persona: { fontSize: 14, color: '#A8C79A', fontStyle: 'italic', marginTop: 4, marginBottom: 24 },
  note: { fontSize: 13, color: '#6B6357', textAlign: 'center', lineHeight: 20 },
});
