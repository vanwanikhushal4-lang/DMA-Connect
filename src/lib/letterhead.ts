import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { generateLetterheadHtml, LetterheadData } from './letterheadTemplate.ts';

export * from './letterheadTemplate.ts';

export async function shareLetterheadPdf(data: LetterheadData): Promise<{ success: boolean; error?: string }> {
  console.log('[Letterhead] shareLetterheadPdf called with:', {
    refNo: data.refNo,
    date: data.date,
    textLength: data.customText?.length || 0,
    platform: Platform.OS,
  });

  try {
    const html = generateLetterheadHtml(data);
    console.log('[Letterhead] HTML template generated, length:', html.length);

    if (Platform.OS === 'web') {
      console.log('[Letterhead] Web platform detected; opening print dialog');
      await Print.printAsync({ html });
      return { success: true };
    }

    console.log('[Letterhead] Calling Print.printToFileAsync with base64 enabled...');
    const printResult = await Print.printToFileAsync({ html, base64: true });
    console.log('[Letterhead] PDF generated from HTML:', {
      uri: printResult.uri,
      numberOfPages: printResult.numberOfPages,
      hasBase64: !!printResult.base64,
      base64Length: printResult.base64?.length,
    });

    // Android/Expo Go scoped permissions require sharing files from cacheDirectory or documentDirectory
    const targetDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    let sharableUri = printResult.uri;

    if (targetDir) {
      const fileName = `DMA_Foundation_Letterhead_${Date.now()}.pdf`;
      const targetPath = `${targetDir}${fileName}`;

      if (printResult.base64) {
        console.log('[Letterhead] Writing base64 PDF into app cache directory:', targetPath);
        await FileSystem.writeAsStringAsync(targetPath, printResult.base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        sharableUri = targetPath;
      } else if (printResult.uri) {
        console.log('[Letterhead] Copying generated PDF to cache directory:', {
          from: printResult.uri,
          to: targetPath,
        });
        await FileSystem.copyAsync({
          from: printResult.uri,
          to: targetPath,
        });
        sharableUri = targetPath;
      }
    }

    console.log('[Letterhead] Final sharable URI:', sharableUri);

    const isAvailable = await Sharing.isAvailableAsync();
    console.log('[Letterhead] Sharing.isAvailableAsync():', isAvailable);

    if (isAvailable) {
      console.log('[Letterhead] Invoking Sharing.shareAsync...');
      await Sharing.shareAsync(sharableUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share DMA Foundation Letterhead',
        UTI: 'com.adobe.pdf',
      });
      console.log('[Letterhead] Sharing.shareAsync completed successfully');
      return { success: true };
    }

    console.warn('[Letterhead] Sharing unavailable; falling back to Print.printAsync');
    await Print.printAsync({ html });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Letterhead] Error in shareLetterheadPdf:', err);
    return {
      success: false,
      error: message || 'Could not generate or share PDF.',
    };
  }
}

export async function previewLetterheadPdf(data: LetterheadData): Promise<{ success: boolean; error?: string }> {
  console.log('[Letterhead] previewLetterheadPdf called with:', {
    refNo: data.refNo,
    date: data.date,
    textLength: data.customText?.length || 0,
    platform: Platform.OS,
  });

  try {
    const html = generateLetterheadHtml(data);
    console.log('[Letterhead] Invoking Print.printAsync for preview...');
    await Print.printAsync({ html });
    console.log('[Letterhead] Preview completed successfully');
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Letterhead] Error in previewLetterheadPdf:', err);
    return {
      success: false,
      error: message || 'Could not preview PDF.',
    };
  }
}
