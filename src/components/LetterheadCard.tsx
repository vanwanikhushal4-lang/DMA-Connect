import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Calendar, FileText, Hash, Printer, Share2 } from 'lucide-react-native';
import { ui } from './Screen';
import { MemberField } from './MemberField';
import { ActionButton } from './ActionButton';
import { previewLetterheadPdf, shareLetterheadPdf } from '../lib/letterhead';

function getTodayDateString(): string {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
}

export function LetterheadCard() {
  const [customText, setCustomText] = useState('');
  const [refNo, setRefNo] = useState('');
  const [date, setDate] = useState(getTodayDateString);
  const [busy, setBusy] = useState<'share' | 'preview' | ''>('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function handleShare() {
    console.log('[LetterheadCard] User tapped Share PDF button');
    setBusy('share');
    setError('');
    setMessage('');
    try {
      const res = await shareLetterheadPdf({ customText, refNo, date });
      if (!res.success) {
        console.warn('[LetterheadCard] Share failed:', res.error);
        setError(res.error || 'Failed to share letterhead PDF.');
      } else {
        console.log('[LetterheadCard] Share initiated successfully');
        setMessage('Letterhead PDF generated and share options opened.');
      }
    } catch (e) {
      console.error('[LetterheadCard] Unexpected exception in handleShare:', e);
      setError(e instanceof Error ? e.message : 'Failed to share PDF.');
    } finally {
      setBusy('');
    }
  }

  async function handlePreview() {
    console.log('[LetterheadCard] User tapped Preview / Print button');
    setBusy('preview');
    setError('');
    setMessage('');
    try {
      const res = await previewLetterheadPdf({ customText, refNo, date });
      if (!res.success) {
        console.warn('[LetterheadCard] Preview failed:', res.error);
        setError(res.error || 'Failed to preview PDF.');
      } else {
        console.log('[LetterheadCard] Preview launched successfully');
      }
    } catch (e) {
      console.error('[LetterheadCard] Unexpected exception in handlePreview:', e);
      setError(e instanceof Error ? e.message : 'Failed to preview PDF.');
    } finally {
      setBusy('');
    }
  }

  return (
    <View style={ui.card}>
      <Text style={ui.heading}>Official letterhead</Text>
      <Text style={ui.body}>
        Generate and share the official Dr. Mangesh Amale Foundation letterhead with custom text.
      </Text>

      {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
      {!!message && <Text accessibilityRole="alert" style={ui.success}>{message}</Text>}

      <MemberField
        label="Ref. No."
        icon={Hash}
        optional
        placeholder="e.g. DMA/2026/01"
        value={refNo}
        onChangeText={setRefNo}
      />

      <MemberField
        label="Date"
        icon={Calendar}
        optional
        placeholder="DD/MM/YYYY"
        value={date}
        onChangeText={setDate}
      />

      <MemberField
        label="Letterhead custom text"
        icon={FileText}
        optional
        multiline
        numberOfLines={6}
        placeholder="Enter custom notice, message, or resolution text to print on the letterhead..."
        value={customText}
        onChangeText={setCustomText}
      />

      <View style={styles.actions}>
        <ActionButton
          title="Share PDF"
          icon={Share2}
          disabled={!!busy}
          busy={busy === 'share'}
          onPress={handleShare}
        />
        <ActionButton
          title="Preview / Print"
          secondary
          icon={Printer}
          disabled={!!busy}
          busy={busy === 'preview'}
          onPress={handlePreview}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 10,
    marginTop: 4,
  },
});
