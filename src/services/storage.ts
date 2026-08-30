import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const Storage = {
  async setItem(key: string, value: string) {
    if (Platform.OS === 'web') {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        console.error('Local storage is unavailable:', e);
      }
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },

  async getItem(key: string) {
    if (Platform.OS === 'web') {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        console.error('Local storage is unavailable:', e);
        return null;
      }
    } else {
      return await SecureStore.getItemAsync(key);
    }
  },

  async removeItem(key: string) {
    if (Platform.OS === 'web') {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.error('Local storage is unavailable:', e);
      }
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  },
};
