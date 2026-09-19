import { ScrollView, Text, View, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { MODES } from '@forge/core';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>FORGE</Text>
      <Text style={styles.subtitle}>design in Eden</Text>

      <View style={styles.grid}>
        {MODES.map((m) => (
          <TouchableOpacity
            key={m.id}
            style={styles.card}
            onPress={() => router.push({ pathname: '/mode/[id]', params: { id: m.id } })}
          >
            <Text style={styles.cardIcon}>{m.icon}</Text>
            <Text style={styles.cardLabel}>{m.label}</Text>
            <Text style={styles.cardTier}>{m.tier} tier</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B2B1A' },
  content: { padding: 20, paddingTop: 40, alignItems: 'center' },
  title: { fontSize: 36, color: '#F5EFE0', fontFamily: 'serif', letterSpacing: 4 },
  subtitle: { fontSize: 16, color: '#D4A64B', fontStyle: 'italic', marginTop: 4, marginBottom: 28 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', width: '100%', gap: 12 },
  card: {
    width: '47%',
    backgroundColor: '#1E4D2B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(62,123,71,0.6)',
  },
  cardIcon: { fontSize: 28, marginBottom: 8 },
  cardLabel: { fontSize: 15, color: '#F0D48A', fontFamily: 'serif' },
  cardTier: { fontSize: 10, color: '#A8C79A', textTransform: 'uppercase', letterSpacing: 1, marginTop: 6 },
});
