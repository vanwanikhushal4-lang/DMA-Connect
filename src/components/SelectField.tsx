import { useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronDown, X } from 'lucide-react-native';
import { colors, fonts } from '../theme';
import { useEntrance } from '../hooks/useMotion';

export function SelectField({ label, value, options, placeholder = 'Select an option', error, onChange, disabled = false }: {
  label: string; value: string; options: readonly { value: string; label: string; description?: string }[];
  placeholder?: string; error?: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.value === value);
  return <View>
    <Text style={styles.label}>{label} <Text style={styles.star}>*</Text></Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${selected?.label || placeholder}`} accessibilityState={{ expanded: open, disabled }}
      disabled={disabled} onPress={() => setOpen(true)} style={[styles.trigger, !!error && styles.errorBorder]}>
      <Text style={[styles.value, !selected && { color: colors.placeholder }]}>{selected?.label || placeholder}</Text><ChevronDown size={18} color={colors.muted} />
    </Pressable>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {open && <SelectionModal label={label} options={options} value={value} onClose={() => setOpen(false)} onSelect={next => { onChange(next); setOpen(false); }} />}
  </View>;
}

function SelectionModal({ label, options, value, onSelect, onClose }: {
  label: string; value: string; options: readonly { value: string; label: string; description?: string }[];
  onSelect: (value: string) => void; onClose: () => void;
}) {
  const entrance = useEntrance();
  return <Modal transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.backdrop}><Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={`Close ${label}`} />
      <Animated.View style={[styles.modal, entrance]} accessibilityViewIsModal>
        <View style={styles.heading}><Text accessibilityRole="header" style={styles.title}>{label}</Text><Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={`Close ${label}`} hitSlop={12}><X size={21} color={colors.muted} /></Pressable></View>
        <ScrollView style={{ maxHeight: 440 }}>
          {options.map(option => <Pressable key={option.value} accessibilityRole="button" accessibilityLabel={option.label} accessibilityState={{ selected: option.value === value }}
            onPress={() => onSelect(option.value)} style={[styles.option, value === option.value && styles.selected]}>
            <View style={{ flex: 1 }}><Text style={styles.optionTitle}>{option.label}</Text>{option.description && <Text style={styles.description}>{option.description}</Text>}</View>
            {value === option.value && <Check size={18} color={colors.purple} />}
          </Pressable>)}
        </ScrollView>
      </Animated.View>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  label: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink, marginBottom: 9 }, star: { color: '#93829E' },
  trigger: { minHeight: 51, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 14, backgroundColor: colors.white },
  value: { fontFamily: fonts.regular, fontSize: 14, color: colors.ink }, errorBorder: { borderColor: '#CB8790' }, error: { fontFamily: fonts.regular, color: colors.error, fontSize: 12, marginTop: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(30,21,49,0.3)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modal: { width: '100%', maxWidth: 420, backgroundColor: colors.white, borderRadius: 20, padding: 22 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontFamily: fonts.bold, fontSize: 21, color: colors.ink },
  option: { paddingHorizontal: 14, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', borderRadius: 11, marginBottom: 5 },
  selected: { backgroundColor: colors.lavender }, optionTitle: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  description: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 4 },
});
