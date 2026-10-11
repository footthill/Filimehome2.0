import { StyleSheet } from 'react-native';
export const colors = { background: '#0e0e0e', surface: '#1a1a1a', brand: '#E50914', gold: '#EAB308', text: '#ffffff', muted: '#a1a1aa', border: '#303036' };
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 18, paddingBottom: 40 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.8 },
  heading: { color: colors.text, fontSize: 19, fontWeight: '800' },
  text: { color: colors.text, fontSize: 15, lineHeight: 23 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  input: { color: colors.text, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 15, fontSize: 16 },
  button: { backgroundColor: colors.brand, padding: 15, borderRadius: 16, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  buttonText: { color: colors.text, fontWeight: '800', fontSize: 15 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 18, gap: 12 },
  error: { color: '#fca5a5', lineHeight: 22 },
});
