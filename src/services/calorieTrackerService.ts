import AsyncStorage from '@react-native-async-storage/async-storage';

export interface MealEntry {
  id: string;
  name: string;
  calories: number;
  time: string;
  date: string; // YYYY-MM-DD
}

export function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

export const CalorieTrackerService = {
  getStorageKey(username: string, dateStr: string): string {
    return `@calorie_log_${username}_${dateStr}`;
  },

  async getMealsForDate(username: string, dateStr: string = getTodayDateString()): Promise<MealEntry[]> {
    try {
      const key = this.getStorageKey(username, dateStr);
      const data = await AsyncStorage.getItem(key);
      if (data) {
        return JSON.parse(data);
      }
      return [];
    } catch (error) {
      console.error('Error fetching meals from storage:', error);
      return [];
    }
  },

  async addMeal(
    username: string,
    name: string,
    calories: number,
    dateStr: string = getTodayDateString()
  ): Promise<MealEntry[]> {
    try {
      const currentMeals = await this.getMealsForDate(username, dateStr);
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const newEntry: MealEntry = {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: name.trim(),
        calories: Math.max(0, Math.round(calories)),
        time: timeStr,
        date: dateStr,
      };

      const updated = [newEntry, ...currentMeals];
      const key = this.getStorageKey(username, dateStr);
      await AsyncStorage.setItem(key, JSON.stringify(updated));
      return updated;
    } catch (error) {
      console.error('Error adding meal to storage:', error);
      throw error;
    }
  },

  async deleteMeal(
    username: string,
    mealId: string,
    dateStr: string = getTodayDateString()
  ): Promise<MealEntry[]> {
    try {
      const currentMeals = await this.getMealsForDate(username, dateStr);
      const updated = currentMeals.filter(m => m.id !== mealId);
      const key = this.getStorageKey(username, dateStr);
      await AsyncStorage.setItem(key, JSON.stringify(updated));
      return updated;
    } catch (error) {
      console.error('Error deleting meal from storage:', error);
      throw error;
    }
  },

  calculateTotalCalories(meals: MealEntry[]): number {
    return meals.reduce((sum, item) => sum + (item.calories || 0), 0);
  },
};
