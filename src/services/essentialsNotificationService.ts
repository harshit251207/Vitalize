import { Platform } from 'react-native';

export interface ScheduledRefillReminder {
  id: string | null;
  permissionGranted: boolean;
  nativeModuleAvailable: boolean;
}

type NotificationsModule = typeof import('expo-notifications');

function isMissingNativeModule(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('ExpoPushTokenManager') ||
    message.includes('Cannot find native module') ||
    message.includes('native module is not available');
}

async function loadNotifications(): Promise<NotificationsModule | null> {
  try {
    const notifications = await import('expo-notifications');
    notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    return notifications;
  } catch (error) {
    if (isMissingNativeModule(error)) return null;
    throw error;
  }
}

export async function scheduleRefillReminder(
  name: string,
  runOutDate: Date,
  remindDaysBefore: number,
): Promise<ScheduledRefillReminder> {
  if (Platform.OS === 'web' || runOutDate.getTime() <= Date.now()) {
    return {
      id: null,
      permissionGranted: runOutDate.getTime() <= Date.now(),
      nativeModuleAvailable: Platform.OS !== 'web',
    };
  }

  const Notifications = await loadNotifications();
  if (!Notifications) {
    return { id: null, permissionGranted: false, nativeModuleAvailable: false };
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('refill-reminders', {
      name: 'Refill reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0284C7',
    });
  }

  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) {
    return { id: null, permissionGranted: false, nativeModuleAvailable: true };
  }

  const scheduledDate = new Date(runOutDate);
  scheduledDate.setDate(scheduledDate.getDate() - remindDaysBefore);
  scheduledDate.setHours(9, 0, 0, 0);

  if (scheduledDate.getTime() <= Date.now()) {
    scheduledDate.setTime(Date.now());
    scheduledDate.setHours(9, 0, 0, 0);
    if (scheduledDate.getTime() <= Date.now()) scheduledDate.setDate(scheduledDate.getDate() + 1);
  }

  return {
    id: await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Refill reminder',
        body: `${name} may run out in about ${remindDaysBefore} days. Time to reorder.`,
        data: { channelId: 'refill-reminders' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: scheduledDate,
        ...(Platform.OS === 'android' ? { channelId: 'refill-reminders' } : {}),
      },
    }),
    permissionGranted: true,
    nativeModuleAvailable: true,
  };
}

export async function cancelRefillReminder(notificationId: string | null | undefined): Promise<void> {
  if (!notificationId) return;
  const Notifications = await loadNotifications();
  if (!Notifications) {
    console.warn('Refill reminder could not be cancelled because the installed app needs a notifications-enabled rebuild.');
    return;
  }
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}
