import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors, fonts } from '../theme';

type Props = TextInputProps & {
  label: string;
  icon: LucideIcon;
  error?: string;
  optional?: boolean;
  prefix?: string;
  onIconPress?: () => void;
  iconLabel?: string;
};

export const MemberField = forwardRef<TextInput, Props>(function MemberField(
  { label, icon: Icon, error, optional, prefix, multiline, onIconPress, iconLabel, ...props }, ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {optional ? <Text style={styles.optional}>Optional</Text> : <Text style={styles.required}>*</Text>}
      </View>
      <View style={[styles.inputBox, multiline && styles.multilineBox, focused && styles.focused, !!error && styles.invalid]}>
        {!onIconPress && <View style={multiline ? styles.multilineIcon : undefined}><Icon size={18} color={focused ? colors.purple : '#938B9F'} strokeWidth={1.6} /></View>}
        {prefix && <Text style={styles.prefix}>{prefix}</Text>}
        <TextInput
          {...props}
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={error || props.accessibilityHint}
          placeholderTextColor={colors.placeholder}
          selectionColor={colors.purple}
          underlineColorAndroid="transparent"
          editable={props.editable ?? true}
          multiline={multiline}
          onFocus={event => { setFocused(true); props.onFocus?.(event); }}
          onBlur={event => { setFocused(false); props.onBlur?.(event); }}
          style={[styles.input, multiline && styles.multilineInput, props.style]}
        />
        {onIconPress && <Pressable onPress={onIconPress} disabled={props.editable === false} accessibilityRole="button" accessibilityLabel={iconLabel} accessibilityState={{ disabled: props.editable === false }} hitSlop={8} style={styles.iconButton}><Icon size={19} color={colors.muted} strokeWidth={1.6} /></Pressable>}
      </View>
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    </View>
  );
});

const styles = StyleSheet.create({
  field: { flex: 1, minWidth: 0 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 9 },
  label: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  required: { fontFamily: fonts.regular, fontSize: 13, color: '#93829E' },
  optional: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, marginLeft: 3 },
  inputBox: { minHeight: 51, borderWidth: 1, borderColor: colors.border, borderRadius: 9, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 11, backgroundColor: colors.white },
  focused: { borderColor: '#8167A5', boxShadow: '0 0 0 3px rgba(96, 59, 144, 0.07)' },
  invalid: { borderColor: '#CB8790' },
  input: { flex: 1, minWidth: 0, minHeight: 49, paddingVertical: 12, paddingHorizontal: 0, fontFamily: fonts.regular, fontSize: 14, color: colors.ink, outlineWidth: 0 },
  prefix: { fontFamily: fonts.regular, fontSize: 14, color: colors.ink, paddingRight: 11, borderRightWidth: 1, borderColor: colors.border },
  multilineBox: { alignItems: 'flex-start', minHeight: 88 },
  multilineInput: { minHeight: 86, textAlignVertical: 'top', paddingTop: 14 },
  multilineIcon: { marginTop: 15 },
  iconButton: { padding: 5 },
  error: { fontFamily: fonts.regular, fontSize: 12, color: colors.error, marginTop: 6, lineHeight: 17 },
});
