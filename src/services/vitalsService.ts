import AsyncStorage from '@react-native-async-storage/async-storage';
import { Vitals, UserProfile, DEFAULT_RANGES } from '@/types';

export const VitalsService = {
  async getVitals(username: string): Promise<Vitals[]> {
    try {
      const data = await AsyncStorage.getItem(`@vitals_${username}`);
      if (data) {
        return JSON.parse(data);
      }
      return [];
    } catch (e) {
      console.error('Error getting vitals', e);
      return [];
    }
  },

  async addVital(username: string, vital: Omit<Vitals, 'id'>): Promise<void> {
    try {
      const vitals = await this.getVitals(username);
      const newVital = { ...vital, id: Date.now().toString() };
      vitals.push(newVital);
      await AsyncStorage.setItem(`@vitals_${username}`, JSON.stringify(vitals));
    } catch (e) {
      console.error('Error adding vital', e);
    }
  },

  async getUserProfile(username: string): Promise<UserProfile> {
    try {
      const data = await AsyncStorage.getItem(`@profile_${username}`);
      if (data) {
        return JSON.parse(data);
      }
      return { username, healthyRanges: DEFAULT_RANGES };
    } catch (e) {
      return { username, healthyRanges: DEFAULT_RANGES };
    }
  },

  async updateUserProfile(username: string, profile: Partial<UserProfile>): Promise<void> {
    try {
      const current = await this.getUserProfile(username);
      const updated = { ...current, ...profile };
      await AsyncStorage.setItem(`@profile_${username}`, JSON.stringify(updated));
    } catch (e) {
      console.error('Error updating profile', e);
    }
  }
};
