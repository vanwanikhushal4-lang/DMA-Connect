import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { parseDob } from '../lib/members';
import { colors, fonts } from '../theme';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function BirthDatePicker({ value, onSelect, onClose }: {
  value: string; onSelect: (date: string) => void; onClose: () => void;
}) {
  const inputDate = parseDob(value);
  const initial = inputDate && inputDate.getFullYear() >= 1900 && inputDate <= new Date() ? inputDate : new Date(2000, 0, 1);
  const [day, setDay] = useState(initial.getDate());
  const [month, setMonth] = useState(initial.getMonth());
  const [year, setYear] = useState(initial.getFullYear());
  const currentYear = new Date().getFullYear();
  const maxDay = new Date(year, month + 1, 0).getDate();
  const actualDay = Math.min(day, maxDay);
  const future = new Date(year, month, actualDay) > new Date();


  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close date picker" />
        <View style={styles.dialog} accessibilityViewIsModal>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Date of birth</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close date picker" hitSlop={12}><X size={21} color={colors.muted} /></Pressable>
          </View>
          <Text style={styles.description}>Choose the member’s birth date.</Text>
          <Text style={styles.selectedDate}>{String(actualDay).padStart(2, '0')} {months[month]} {year}</Text>
          <View style={styles.columns}>
            <DateColumn title="Day" options={Array.from({ length: maxDay }, (_, i) => ({ label: String(i + 1).padStart(2, '0'), value: i + 1 }))} selected={actualDay} onChange={setDay} />
            <DateColumn title="Month" options={months.map((label, value) => ({ label, value }))} selected={month} onChange={setMonth} />
            <DateColumn title="Year" options={Array.from({ length: currentYear - 1899 }, (_, i) => ({ label: String(currentYear - i), value: currentYear - i }))} selected={year} onChange={setYear} />
          </View>
          {future && <Text style={styles.error}>Choose a date that isn’t in the future.</Text>}
          <Pressable accessibilityRole="button" accessibilityLabel="Use selected date" accessibilityState={{ disabled: future }} disabled={future}
            onPress={() => { onSelect(`${String(actualDay).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`); onClose(); }}
            style={[styles.confirm, future && { opacity: 0.5 }]}>
            <Check size={18} color={colors.white} /><Text style={styles.confirmText}>Use this date</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function DateColumn({ title, options, selected, onChange }: {
  title: string; options: { label: string; value: number }[];
  selected: number; onChange: (value: number) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const selectedIndex = options.findIndex(option => option.value === selected);
  return (
    <View style={styles.column}>
      <Text style={styles.columnLabel}>{title}</Text>
      <ScrollView ref={scrollRef} style={styles.options}
        onContentSizeChange={() => scrollRef.current?.scrollTo({ y: Math.max(0, selectedIndex - 2) * 43, animated: false })}>
        {options.map(option => (
          <Pressable key={option.value} accessibilityRole="button" accessibilityLabel={`${title} ${option.label}`}
            accessibilityState={{ selected: selected === option.value }} onPress={() => onChange(option.value)}
            style={[styles.option, selected === option.value && styles.selected]}>
            <Text style={[styles.optionText, selected === option.value && styles.selectedText]}>{option.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(30, 21, 49, 0.35)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 380, backgroundColor: colors.white, borderRadius: 20, padding: 24 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fonts.bold, color: colors.ink, fontSize: 21 },
  description: { fontFamily: fonts.regular, color: colors.muted, fontSize: 13, marginTop: 7 },
  selectedDate: { fontFamily: fonts.semibold, color: colors.purple, fontSize: 14, marginTop: 14 },
  columns: { flexDirection: 'row', gap: 12, marginTop: 18, marginBottom: 22 },
  column: { flex: 1 },
  columnLabel: { fontFamily: fonts.medium, color: colors.muted, fontSize: 12, textAlign: 'center', marginBottom: 10 },
  options: { height: 224, borderWidth: 1, borderColor: colors.border, borderRadius: 10 },
  option: { height: 43, alignItems: 'center', justifyContent: 'center', marginHorizontal: 3 },
  optionText: { fontFamily: fonts.regular, color: colors.ink, fontSize: 15 },
  selected: { backgroundColor: colors.lavender, borderRadius: 7 },
  selectedText: { fontFamily: fonts.bold, color: colors.purple },
  error: { fontFamily: fonts.regular, color: colors.error, fontSize: 12, marginBottom: 12 },
  confirm: { minHeight: 48, backgroundColor: colors.purple, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  confirmText: { fontFamily: fonts.semibold, color: colors.white, fontSize: 14 },
});
