import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { useAuth, useCategory } from '@/store/AuthContext';
import {
  cacheEssentials,
  deleteEssential,
  ESSENTIAL_CATEGORIES,
  hasCachedEssentials,
  newEssentialId,
  queueEssentialDelete,
  queueEssentialSave,
  readCachedEssentials,
  removeQueuedEssentialMutation,
  saveEssential,
  subscribeToEssentials,
  syncQueuedEssentials,
  type EssentialCategory,
  type EssentialItem,
} from '@/services/essentialsService';
import {
  cancelRefillReminder,
  scheduleRefillReminder,
} from '@/services/essentialsNotificationService';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const REMINDER_OPTIONS = [3, 5, 7, 10] as const;

const CATEGORY_NAMES: Record<EssentialCategory, string> = {
  Medicine: 'Medicine',
  Catheter: 'Catheter',
  Diapers: 'Diapers',
  'Vitamins/Supplements': 'Vitamins or supplements',
  Gloves: 'Gloves',
  'Skin care': 'Skin care',
  Wipes: 'Wipes',
  Other: '',
};

const CATEGORY_ICONS: Record<EssentialCategory, keyof typeof Ionicons.glyphMap> = {
  Medicine: 'medkit-outline',
  Catheter: 'water-outline',
  Diapers: 'body-outline',
  'Vitamins/Supplements': 'sunny-outline',
  Gloves: 'hand-left-outline',
  'Skin care': 'sparkles-outline',
  Wipes: 'bandage-outline',
  Other: 'cube-outline',
};

const STORE_OPTIONS = {
  amazon: {
    name: 'Amazon India',
    buildUrl: (name: string) => `https://www.amazon.in/s?k=${encodeURIComponent(name)}`,
  },
  flipkart: {
    name: 'Flipkart',
    buildUrl: (name: string) => `https://www.flipkart.com/search?q=${encodeURIComponent(name)}`,
  },
  google: {
    name: 'Google search',
    buildUrl: (name: string) => `https://www.google.com/search?q=${encodeURIComponent(`${name} buy online india`)}`,
  },
} as const;

function getFriendlyError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code === 'unavailable' || code === 'network-request-failed') {
    return 'You appear to be offline. Your saved list is still available on this device.';
  }
  if (code === 'permission-denied') return 'Firestore rejected this change. Confirm the latest firestore.rules are deployed to the Firebase project used by this app.';
  return 'We couldn’t sync this change. It remains saved on this device; reconnect and try again.';
}

function daysUntilRunOut(item: EssentialItem): number {
  return Math.max(0, Math.ceil((item.runOutDate.getTime() - Date.now()) / DAY_IN_MS));
}

function calculateRunOutDate(unitsLeft: number, unitsPerDay: number): Date {
  return new Date(Date.now() + (unitsLeft / unitsPerDay) * DAY_IN_MS);
}

function statusFor(item: EssentialItem, colors: ReturnType<typeof useTheme>): {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
} {
  const exactDays = (item.runOutDate.getTime() - Date.now()) / DAY_IN_MS;
  if (exactDays > 14) return { label: 'OK', icon: 'checkmark-circle', color: colors.success };
  if (exactDays > item.remindDaysBefore) return { label: 'Soon', icon: 'time', color: colors.warning };
  return { label: 'Reorder now', icon: 'alert-circle', color: colors.danger };
}

export default function EssentialsScreen() {
  const colors = useTheme();
  const actionColor = colors.primary === '#38BDF8' ? colors.primary : '#0369A1';
  const actionTextColor = colors.primary === '#38BDF8' ? '#0F172A' : '#FFFFFF';
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { category: condition } = useCategory();
  const [items, setItems] = useState<EssentialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [restockId, setRestockId] = useState<string | null>(null);
  const [restockCount, setRestockCount] = useState(0);
  const [storeItem, setStoreItem] = useState<EssentialItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<EssentialCategory>('Medicine');
  const [itemName, setItemName] = useState(CATEGORY_NAMES.Medicine);
  const [unitsLeft, setUnitsLeft] = useState(30);
  const [unitsPerDay, setUnitsPerDay] = useState(1);
  const [remindDaysBefore, setRemindDaysBefore] = useState<3 | 5 | 7 | 10>(5);
  const [saving, setSaving] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const syncingPending = useRef(false);
  const hasLocalCopy = useRef(false);

  useEffect(() => {
    if (!user) return;

    let active = true;
    let unsubscribe: (() => void) | undefined;
    hasLocalCopy.current = false;
    const start = async () => {
      try {
        const cached = await readCachedEssentials(user);
        hasLocalCopy.current = await hasCachedEssentials(user);
        if (active && hasLocalCopy.current) setItems(cached);
      } catch {
        if (active) setError('Saved items on this device could not be read.');
      } finally {
        if (active) setLoading(false);
      }
      if (!active) return;

      unsubscribe = subscribeToEssentials(
        user,
        (remoteItems, isFromCache) => {
          if (!active) return;
          setOffline(isFromCache);
          if (!isFromCache || !hasLocalCopy.current) {
            setItems(remoteItems);
            void cacheEssentials(user, remoteItems).then(() => {
              hasLocalCopy.current = true;
            }).catch(() => {
              if (active) setError('Items are showing, but the offline copy could not be updated.');
            });
          }
          setLoading(false);
          if (!isFromCache && !syncingPending.current) {
            syncingPending.current = true;
            void syncQueuedEssentials(user).catch((syncError: unknown) => {
              if (active) setError(getFriendlyError(syncError));
            }).finally(() => {
              syncingPending.current = false;
            });
          }
        },
        (listenerError) => {
          if (!active) return;
          setOffline(true);
          setError(getFriendlyError(listenerError));
          setLoading(false);
        },
      );
    };
    void start().catch(() => {
      if (active) {
        setError('Shopping essentials could not be loaded. Please try again.');
        setLoading(false);
      }
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [user]);

  const suggestions = useMemo(() => {
    if (condition === 'paraplegia' || condition === 'quadriplegia') {
      return ['Catheter', 'Diapers', 'Skin care', 'Wipes', 'Gloves'] as EssentialCategory[];
    }
    return ['Medicine', 'Vitamins/Supplements'] as EssentialCategory[];
  }, [condition]);

  const resetEditor = (category: EssentialCategory = 'Medicine') => {
    setSelectedCategory(category);
    setItemName(CATEGORY_NAMES[category]);
    setUnitsLeft(30);
    setUnitsPerDay(1);
    setRemindDaysBefore(5);
    setEditorOpen(true);
  };

  const commitLocalItems = (nextItems: EssentialItem[]) => {
    setItems(nextItems);
    setError('');
    if (user) {
      hasLocalCopy.current = true;
      void cacheEssentials(user, nextItems).catch(() => {
        setError('The list changed, but it could not be saved for offline use.');
      });
    }
  };

  const persistInBackground = (item: EssentialItem, isDelete = false) => {
    if (!user) return;
    void (async () => {
      const mutationId = isDelete
        ? await queueEssentialDelete(user, item.id)
        : await queueEssentialSave(user, item);
      if (offline) return;
      if (isDelete) await deleteEssential(user, item.id);
      else await saveEssential(user, item);
      await removeQueuedEssentialMutation(user, mutationId);
    })().catch((writeError: unknown) => setError(getFriendlyError(writeError)));
  };

  const saveItem = async () => {
    if (!user) return;
    const name = itemName.trim();
    if (!name) {
      Alert.alert('Add an item name', 'Enter a short name for this essential.');
      return;
    }
    if (!Number.isFinite(unitsPerDay) || unitsPerDay <= 0) {
      Alert.alert('Check daily use', 'Units per day must be greater than zero.');
      return;
    }

    setSaving(true);
    try {
      const runOutDate = calculateRunOutDate(unitsLeft, unitsPerDay);
      const scheduled = await scheduleRefillReminder(name, runOutDate, remindDaysBefore);
      const item: EssentialItem = {
        id: newEssentialId(user),
        name,
        category: selectedCategory,
        unitsLeft,
        unitsPerDay,
        runOutDate,
        remindDaysBefore,
        notificationId: scheduled.id,
      };
      commitLocalItems([item, ...items]);
      persistInBackground(item);
      setEditorOpen(false);
      if (!scheduled.nativeModuleAvailable) {
        Alert.alert(
          'Item saved; rebuild required for reminders',
          'Install a new EAS development build with expo-notifications to schedule refill reminders.',
        );
      } else if (!scheduled.permissionGranted) {
        Alert.alert(
          'Item saved without a reminder',
          'Allow notifications in your device settings to receive refill reminders.',
        );
      }
    } catch (saveError) {
      Alert.alert('Couldn’t schedule the reminder', getFriendlyError(saveError));
    } finally {
      setSaving(false);
    }
  };

  const updateItem = async (item: EssentialItem, updates: Partial<EssentialItem>) => {
    if (!user || busyItemId) return;
    setBusyItemId(item.id);
    try {
      const nextUnits = updates.unitsLeft ?? item.unitsLeft;
      const nextUsage = updates.unitsPerDay ?? item.unitsPerDay;
      const runOutDate = calculateRunOutDate(nextUnits, nextUsage);
      const nextName = updates.name ?? item.name;
      const nextReminderWindow = updates.remindDaysBefore ?? item.remindDaysBefore;
      const scheduled = await scheduleRefillReminder(nextName, runOutDate, nextReminderWindow);
      const nextItem: EssentialItem = {
        ...item,
        ...updates,
        unitsLeft: nextUnits,
        unitsPerDay: nextUsage,
        runOutDate,
        notificationId: scheduled.id,
      };
      commitLocalItems(items.map((current) => current.id === item.id ? nextItem : current));
      void cancelRefillReminder(item.notificationId).catch(() => {
        setError('The item updated, but its previous reminder could not be cancelled. Rebuild with expo-notifications if you recently changed app builds.');
      });
      persistInBackground(nextItem);
      if (!scheduled.nativeModuleAvailable) {
        Alert.alert(
          'Item updated; rebuild required for reminders',
          'Install a new EAS development build with expo-notifications to schedule refill reminders.',
        );
      } else if (!scheduled.permissionGranted) {
        Alert.alert('Item updated without a reminder', 'Allow notifications in device settings to receive refill reminders.');
      }
    } catch (updateError) {
      Alert.alert('Couldn’t update item', getFriendlyError(updateError));
    } finally {
      setBusyItemId(null);
    }
  };

  const removeItem = (item: EssentialItem) => {
    Alert.alert('Delete this item?', 'Its refill reminder will also be cancelled.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          commitLocalItems(items.filter((current) => current.id !== item.id));
          persistInBackground(item, true);
          void cancelRefillReminder(item.notificationId).catch(() => {
            setError('The item was removed, but its reminder could not be cancelled.');
          });
        },
      },
    ]);
  };

  const saveRestock = async () => {
    const item = items.find((current) => current.id === restockId);
    if (!item) return;
    await updateItem(item, { unitsLeft: restockCount });
    setRestockId(null);
  };

  const openStore = async (key: keyof typeof STORE_OPTIONS) => {
    if (!storeItem) return;
    try {
      await Linking.openURL(STORE_OPTIONS[key].buildUrl(storeItem.name));
      setStoreItem(null);
    } catch {
      Alert.alert('Couldn’t open store', 'Please try again or search for the item in your browser.');
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 104 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text }]}>Shopping essentials</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Track what you use. Refill when needed.</Text>
          </View>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: actionColor }]}
            onPress={() => resetEditor()}
            accessibilityRole="button"
            accessibilityLabel="Add an essential"
          >
            <Ionicons name="add" size={24} color={actionTextColor} />
            <Text style={[styles.addButtonText, { color: actionTextColor }]}>Add</Text>
          </TouchableOpacity>
        </View>

        <SafetyNotice />

        {offline && !error && (
          <View style={[styles.errorNotice, { backgroundColor: colors.warning + '1A', borderColor: colors.warning }]}>
            <Ionicons name="cloud-offline-outline" size={22} color={colors.warning} />
            <Text style={[styles.errorText, { color: colors.text }]}>Offline: showing locally saved items. Changes will sync when you reconnect.</Text>
          </View>
        )}
        {!!error && (
          <View style={[styles.errorNotice, { backgroundColor: colors.warning + '1A', borderColor: colors.warning }]}>
            <Ionicons name={offline ? 'cloud-offline-outline' : 'alert-circle-outline'} size={22} color={colors.warning} />
            <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
          </View>
        )}

        {loading ? (
          <ActivityIndicator style={styles.loader} size="large" color={colors.primary} accessibilityLabel="Loading shopping essentials" />
        ) : items.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
            <Ionicons name="bag-handle-outline" size={34} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Your essentials list is empty</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Start with a suggestion or add an item.</Text>
            <View style={styles.suggestions}>
              {suggestions.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion}
                  style={[styles.suggestion, { borderColor: colors.primary }]}
                  onPress={() => resetEditor(suggestion)}
                  accessibilityRole="button"
                  accessibilityLabel={`Add suggested category ${suggestion}`}
                >
                  <Ionicons name={CATEGORY_ICONS[suggestion]} size={19} color={colors.primary} />
                  <Text style={[styles.suggestionText, { color: colors.primary }]}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          items.map((item) => {
            const status = statusFor(item, colors);
            const days = daysUntilRunOut(item);
            return (
              <View key={item.id} style={[styles.itemCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                <View style={styles.itemHeader}>
                  <View style={[styles.categoryIcon, { backgroundColor: colors.primaryLight }]}>
                    <Ionicons name={CATEGORY_ICONS[item.category] ?? 'cube-outline'} size={23} color={colors.primary} />
                  </View>
                  <View style={styles.itemHeading}>
                    <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[styles.itemCategory, { color: colors.textSecondary }]}>{item.category}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => removeItem(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${item.name}`}
                  >
                    <Ionicons name="trash-outline" size={22} color={colors.danger} />
                  </TouchableOpacity>
                </View>

                <View style={styles.metricRow}>
                  <View style={styles.metric}>
                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Units left</Text>
                    <View style={styles.unitControls}>
                      <TouchableOpacity
                        style={[styles.stepButton, { borderColor: colors.border }]}
                        onPress={() => void updateItem(item, { unitsLeft: Math.max(0, item.unitsLeft - 1) })}
                        disabled={busyItemId === item.id || item.unitsLeft === 0}
                        accessibilityRole="button"
                        accessibilityLabel={`Decrease ${item.name} units left`}
                      >
                        <Ionicons name="remove" size={22} color={colors.text} />
                      </TouchableOpacity>
                      <Text style={[styles.unitValue, { color: colors.text }]} accessibilityLabel={`${item.unitsLeft} units left`}>{item.unitsLeft}</Text>
                      <TouchableOpacity
                        style={[styles.stepButton, { borderColor: colors.border }]}
                        onPress={() => void updateItem(item, { unitsLeft: item.unitsLeft + 1 })}
                        disabled={busyItemId === item.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Increase ${item.name} units left`}
                      >
                        <Ionicons name="add" size={22} color={colors.text} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.metric}>
                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Units used per day</Text>
                    <View style={styles.unitControls}>
                      <TouchableOpacity
                        style={[styles.stepButton, { borderColor: colors.border }]}
                        onPress={() => void updateItem(item, { unitsPerDay: Math.max(0.5, item.unitsPerDay - 0.5) })}
                        disabled={busyItemId === item.id || item.unitsPerDay <= 0.5}
                        accessibilityRole="button"
                        accessibilityLabel={`Decrease daily use for ${item.name}`}
                      >
                        <Ionicons name="remove" size={22} color={colors.text} />
                      </TouchableOpacity>
                      <Text style={[styles.unitValue, { color: colors.text }]} accessibilityLabel={`${item.unitsPerDay} units used per day`}>{item.unitsPerDay}</Text>
                      <TouchableOpacity
                        style={[styles.stepButton, { borderColor: colors.border }]}
                        onPress={() => void updateItem(item, { unitsPerDay: item.unitsPerDay + 0.5 })}
                        disabled={busyItemId === item.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Increase daily use for ${item.name}`}
                      >
                        <Ionicons name="add" size={22} color={colors.text} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.metric}>
                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Days left</Text>
                    <Text style={[styles.daysValue, { color: colors.text }]}>
                      {days} {days === 1 ? 'day' : 'days'}
                    </Text>
                  </View>
                </View>

                <View style={[styles.statusRow, { backgroundColor: status.color + '18' }]}>
                  <Ionicons name={status.icon} size={22} color={status.color} />
                  <Text style={[styles.statusText, { color: colors.text }]}>{status.label}</Text>
                  <Text style={[styles.reminderText, { color: colors.textSecondary }]}>· Remind {item.remindDaysBefore} days before</Text>
                </View>

                <View style={styles.itemActions}>
                  <TouchableOpacity
                    style={[styles.secondaryButton, { borderColor: colors.primary }]}
                    onPress={() => {
                      setRestockId(item.id);
                      setRestockCount(item.unitsLeft);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`I restocked ${item.name}`}
                  >
                    <Ionicons name="refresh-outline" size={20} color={colors.primary} />
                    <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>I restocked</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.secondaryButton, { borderColor: colors.border }]}
                    onPress={() => setStoreItem(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Search stores for ${item.name}`}
                  >
                    <Ionicons name="search-outline" size={20} color={colors.text} />
                    <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Buy / search</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={editorOpen} animationType="slide" onRequestClose={() => setEditorOpen(false)}>
        <SafeAreaView style={[styles.modalScreen, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add an essential</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setEditorOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Close add item form"
              >
                <Ionicons name="close" size={26} color={colors.text} />
              </TouchableOpacity>
            </View>
            <SafetyNotice />
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Category</Text>
            <View style={styles.categoryGrid}>
              {ESSENTIAL_CATEGORIES.map((itemCategory) => (
                <TouchableOpacity
                  key={itemCategory}
                  style={[styles.categoryChip, { backgroundColor: selectedCategory === itemCategory ? actionColor : colors.backgroundElement, borderColor: selectedCategory === itemCategory ? actionColor : colors.border }]}
                  onPress={() => {
                    setSelectedCategory(itemCategory);
                    setItemName(CATEGORY_NAMES[itemCategory]);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Category: ${itemCategory}`}
                  accessibilityState={{ selected: selectedCategory === itemCategory }}
                >
                  <Ionicons name={CATEGORY_ICONS[itemCategory]} size={20} color={selectedCategory === itemCategory ? actionTextColor : colors.primary} />
                  <Text style={[styles.categoryChipText, { color: selectedCategory === itemCategory ? actionTextColor : colors.text }]}>{itemCategory}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Item name</Text>
            <TextInput
              style={[styles.nameInput, { backgroundColor: colors.backgroundElement, borderColor: colors.border, color: colors.text }]}
              value={itemName}
              onChangeText={(value) => setItemName(value.slice(0, 80))}
              placeholder="Name this item"
              placeholderTextColor={colors.textSecondary}
              maxLength={80}
              accessibilityLabel="Item name, maximum 80 characters"
            />
            <Stepper
              label="Units left"
              value={unitsLeft}
              onDecrease={() => setUnitsLeft((value) => Math.max(0, value - 1))}
              onIncrease={() => setUnitsLeft((value) => value + 1)}
              colors={colors}
              minimum={0}
            />
            <Stepper
              label="Units per day"
              value={unitsPerDay}
              onDecrease={() => setUnitsPerDay((value) => Math.max(0.5, value - 0.5))}
              onIncrease={() => setUnitsPerDay((value) => value + 0.5)}
              colors={colors}
              minimum={0.5}
            />
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Remind me before</Text>
            <View style={styles.reminderOptions}>
              {REMINDER_OPTIONS.map((days) => (
                <TouchableOpacity
                  key={days}
                  style={[styles.reminderChip, { backgroundColor: remindDaysBefore === days ? actionColor : colors.backgroundElement, borderColor: remindDaysBefore === days ? actionColor : colors.border }]}
                  onPress={() => setRemindDaysBefore(days)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remind ${days} days before`}
                  accessibilityState={{ selected: remindDaysBefore === days }}
                >
                  <Text style={[styles.filterText, { color: remindDaysBefore === days ? actionTextColor : colors.text }]}>{days} days</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: actionColor, opacity: saving ? 0.7 : 1 }]}
              onPress={() => void saveItem()}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Save essential item"
            >
              {saving ? <ActivityIndicator color={actionTextColor} /> : <Text style={[styles.saveButtonText, { color: actionTextColor }]}>Save item</Text>}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={restockId !== null} transparent animationType="fade" onRequestClose={() => setRestockId(null)}>
        <View style={styles.backdrop}>
          <View style={[styles.dialog, { backgroundColor: colors.backgroundElement }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Restocked count</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Set how many units you have now.</Text>
            <Stepper
              label="Units left"
              value={restockCount}
              onDecrease={() => setRestockCount((value) => Math.max(0, value - 1))}
              onIncrease={() => setRestockCount((value) => value + 1)}
              colors={colors}
              minimum={0}
            />
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: actionColor }]}
              onPress={() => void saveRestock()}
              accessibilityRole="button"
              accessibilityLabel="Save restocked count"
            >
              <Text style={[styles.saveButtonText, { color: actionTextColor }]}>Save count</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: colors.border }]}
              onPress={() => setRestockId(null)}
              accessibilityRole="button"
              accessibilityLabel="Cancel restock"
            >
              <Text style={[styles.filterText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={storeItem !== null} transparent animationType="slide" onRequestClose={() => setStoreItem(null)}>
        <View style={styles.backdrop}>
          <View style={[styles.dialog, { backgroundColor: colors.backgroundElement }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Search stores</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setStoreItem(null)}
                accessibilityRole="button"
                accessibilityLabel="Close store options"
              >
                <Ionicons name="close" size={26} color={colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Vitalize does not sell items. Choose a store to search for “{storeItem?.name}”.
            </Text>
            {(Object.keys(STORE_OPTIONS) as (keyof typeof STORE_OPTIONS)[]).map((key) => (
              <TouchableOpacity
                key={key}
                style={[styles.storeOption, { borderColor: colors.border }]}
                onPress={() => void openStore(key)}
                accessibilityRole="button"
                accessibilityLabel={`Search ${STORE_OPTIONS[key].name}`}
              >
                <Ionicons name="open-outline" size={22} color={colors.primary} />
                <Text style={[styles.storeOptionText, { color: colors.text }]}>{STORE_OPTIONS[key].name}</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SafetyNotice() {
  const colors = useTheme();
  return (
    <View style={[styles.safetyCard, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
      <Ionicons name="shield-checkmark-outline" size={23} color={colors.primary} />
      <View style={styles.safetyTextGroup}>
        <Text style={[styles.safetyText, { color: colors.text }]}>Vitalize doesn&apos;t sell medicines. Prescription medicines need a prescription.</Text>
        <Text style={[styles.safetyText, { color: colors.text }]}>Ask your doctor which type and size of catheter or other medical items is right for you.</Text>
        <Text style={[styles.safetyText, { color: colors.text }]}>Talk to your doctor before starting any vitamin or supplement.</Text>
      </View>
    </View>
  );
}

function Stepper({
  label,
  value,
  onDecrease,
  onIncrease,
  colors,
  minimum,
}: {
  label: string;
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
  colors: ReturnType<typeof useTheme>;
  minimum: number;
}) {
  return (
    <View style={[styles.stepperRow, { borderColor: colors.border }]}>
      <Text style={[styles.stepperLabel, { color: colors.text }]}>{label}</Text>
      <TouchableOpacity
        style={[styles.stepButton, { borderColor: colors.border }]}
        onPress={onDecrease}
        disabled={value <= minimum}
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${label}`}
      >
        <Ionicons name="remove" size={22} color={colors.text} />
      </TouchableOpacity>
      <Text style={[styles.unitValue, { color: colors.text }]} accessibilityLabel={`${value} ${label}`}>{value}</Text>
      <TouchableOpacity
        style={[styles.stepButton, { borderColor: colors.border }]}
        onPress={onIncrease}
        accessibilityRole="button"
        accessibilityLabel={`Increase ${label}`}
      >
        <Ionicons name="add" size={22} color={colors.text} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 12, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerText: { flex: 1 },
  title: { fontSize: 28, lineHeight: 36, fontWeight: '800' },
  subtitle: { fontSize: 15, lineHeight: 22 },
  addButton: { minHeight: 56, paddingHorizontal: 15, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 4 },
  addButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  safetyCard: { borderWidth: 1, borderRadius: 16, padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  safetyTextGroup: { flex: 1, gap: 5 },
  safetyText: { fontSize: 13, lineHeight: 19, fontWeight: '600' },
  errorNotice: { borderWidth: 1, borderRadius: 14, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  errorText: { flex: 1, fontSize: 14, lineHeight: 20 },
  loader: { marginTop: 40 },
  emptyCard: { borderWidth: 1, borderRadius: 20, padding: 20, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 19, lineHeight: 26, fontWeight: '700', textAlign: 'center' },
  emptyText: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 3 },
  suggestion: { minHeight: 56, borderWidth: 1.5, borderRadius: 15, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 7 },
  suggestionText: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  itemCard: { borderWidth: 1, borderRadius: 18, padding: 15, gap: 13 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  categoryIcon: { width: 46, height: 46, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  itemHeading: { flex: 1 },
  itemName: { fontSize: 17, lineHeight: 24, fontWeight: '700' },
  itemCategory: { fontSize: 13, lineHeight: 19 },
  deleteButton: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  metricRow: { flexDirection: 'column', alignItems: 'stretch', gap: 14 },
  metric: { width: '100%', gap: 6 },
  metricLabel: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  unitControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepButton: { width: 56, height: 56, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  unitValue: { minWidth: 28, textAlign: 'center', fontSize: 17, fontWeight: '800' },
  daysValue: { fontSize: 18, lineHeight: 25, fontWeight: '800' },
  statusRow: { minHeight: 48, borderRadius: 12, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusText: { fontSize: 15, lineHeight: 21, fontWeight: '800' },
  reminderText: { fontSize: 13, lineHeight: 18, flexShrink: 1 },
  itemActions: { flexDirection: 'row', gap: 8 },
  secondaryButton: { minHeight: 56, flex: 1, borderWidth: 1, borderRadius: 14, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  secondaryButtonText: { fontSize: 14, lineHeight: 18, fontWeight: '700' },
  modalScreen: { flex: 1 },
  modalContent: { padding: 18, gap: 14, paddingBottom: 28 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  modalTitle: { flex: 1, fontSize: 23, lineHeight: 31, fontWeight: '800' },
  closeButton: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: 16, lineHeight: 22, fontWeight: '700', marginTop: 2 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { minHeight: 56, borderWidth: 1, borderRadius: 14, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 7 },
  categoryChipText: { fontSize: 14, lineHeight: 19, fontWeight: '600' },
  nameInput: { minHeight: 60, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontSize: 17 },
  stepperRow: { minHeight: 72, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepperLabel: { flex: 1, fontSize: 16, lineHeight: 22, fontWeight: '600' },
  reminderOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reminderChip: { minHeight: 56, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  filterText: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  saveButton: { minHeight: 60, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  saveButtonText: { color: '#FFFFFF', fontSize: 18, lineHeight: 24, fontWeight: '800' },
  backdrop: { flex: 1, backgroundColor: '#00000080', justifyContent: 'center', padding: 18 },
  dialog: { borderRadius: 22, padding: 20, gap: 12 },
  cancelButton: { minHeight: 56, borderWidth: 1, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  storeOption: { minHeight: 60, borderWidth: 1, borderRadius: 15, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  storeOptionText: { flex: 1, fontSize: 16, lineHeight: 22, fontWeight: '700' },
});
