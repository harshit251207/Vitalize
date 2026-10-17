# Omron blood pressure import

Vitalize reads blood pressure records from Android Health Connect. It does not
connect to the Omron monitor over Bluetooth. The expected flow is:

`Omron HEM-7141T1 → Omron Connect → Health Connect → Vitalize`

## Native setup

This repository currently uses Expo SDK 57 and React Native 0.86.3. The app
uses `react-native-health-connect` 4.1.3 and the SDK 57-compatible
`expo-build-properties` plugin. `app.json` declares
`android.permission.health.READ_BLOOD_PRESSURE`, configures the Health Connect
permission rationale/delegate plugin, and sets Android min/compile/target SDKs
to 26/36/36.

Health Connect cannot run in Expo Go. After installing or changing native
dependencies, generate and build a custom Android development client:

```sh
npx expo prebuild --platform android
npx expo run:android
```

Or build it with EAS:

```sh
npx eas-cli build --profile development --platform android
```

Install commands (use the legacy peer resolver required by this project):

```sh
npm install react-native-health-connect@4.1.3 --legacy-peer-deps
npm install --save-dev expo-build-properties@~57.0.22 --legacy-peer-deps
```

The library's Expo plugin adds the permission-rationale intent filter and
Android 14+ permission-usage activity alias. The Expo module installs its
permission delegate; a manual `MainActivity` edit is not required.

## Firestore rules

The app stores imports separately at
`users/{uid}/autoBpReadings/{healthConnectRecordId}`. Add the following nested
match under `match /users/{userId}` in `firestore.rules`:

```text
match /autoBpReadings/{readingId} {
  allow read: if request.auth != null
    && request.auth.uid == userId;
  allow create, update: if request.auth != null
    && request.auth.uid == userId
    && request.resource.data.keys().hasOnly([
      'systolic', 'diastolic', 'measuredAt', 'source',
      'deviceSourceApp', 'syncedAt', 'hidden'
    ])
    && request.resource.data.keys().hasAll([
      'systolic', 'diastolic', 'measuredAt', 'source',
      'deviceSourceApp', 'syncedAt'
    ])
    && request.resource.data.systolic is number
    && request.resource.data.systolic >= 40
    && request.resource.data.systolic <= 300
    && request.resource.data.diastolic is number
    && request.resource.data.diastolic >= 20
    && request.resource.data.diastolic <= 200
    && request.resource.data.systolic > request.resource.data.diastolic
    && request.resource.data.measuredAt is timestamp
    && request.resource.data.source == 'health_connect'
    && request.resource.data.deviceSourceApp is string
    && request.resource.data.syncedAt is timestamp
    && (
      !('hidden' in request.resource.data)
      || request.resource.data.hidden is bool
    );
}
```

Deploy the updated rules to the Firebase project used by the app. Hidden
readings are soft-deleted in Vitalize and remain in Health Connect.

## Manual verification

1. Take a blood pressure reading on the Omron monitor.
2. Confirm Omron Connect has received the reading.
3. Confirm the reading is visible in Health Connect.
4. Install and open the Vitalize Android development build; grant read access
   to blood pressure only.
5. Open **Vitals History**, tap **Sync now**, and confirm the reading appears
   with an automatic source badge.
6. Confirm the same reading contributes a point to the BP graph and appears in
   BP Analytics.
7. Tap **Sync now** again and confirm no duplicate history entry is created.
8. Revoke Health Connect access, return to Vitalize, and confirm it reports that
   permission is needed without crashing.
