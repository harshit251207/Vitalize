import { Platform } from 'react-native';

/**
 * Best-effort deletion of a temp cropped image. Never throws.
 */
export async function deleteTempImage(uri: string | null | undefined): Promise<void> {
  if (!uri || Platform.OS === 'web') return;
  if (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('data:')) {
    return;
  }

  try {
    const FileSystem = await import('expo-file-system/legacy');
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    try {
      const FileSystem = await import('expo-file-system');
      const deleteAsync = (
        FileSystem as { deleteAsync?: (u: string, o?: { idempotent?: boolean }) => Promise<void> }
      ).deleteAsync;
      if (deleteAsync) {
        await deleteAsync(uri, { idempotent: true });
      }
    } catch {
      // Cache files are ephemeral; ignore failures.
    }
  }
}
