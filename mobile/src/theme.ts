import { StyleSheet } from 'react-native';
export const colors = { background: '#000000', surface: '#141414', brand: '#16a34a', gold: '#facc15', text: '#ffffff', muted: '#a1a1aa', border: '#374151', navigation: '#111827' };
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 20, paddingBottom: 40 },
  title: { color: colors.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.8 },
  heading: { color: colors.text, fontSize: 20, fontWeight: '700' },
  text: { color: colors.text, fontSize: 15, lineHeight: 23 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  input: { color: colors.text, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, fontSize: 16 },
  button: { backgroundColor: colors.brand, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  buttonText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 12 },
  error: { color: '#fca5a5', lineHeight: 22 },
});
