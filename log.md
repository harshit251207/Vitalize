# Vitalize — project log and handoff notes

This file is a human-readable guide to the project as it currently stands. It
is documentation only: the app does not read `log.md`, and adding or editing
this file does not change how the app starts or runs.

**Last reviewed:** 23 October 2026

## What this project is

Vitalize is a mobile health and wellness app built with Expo, React Native, and
TypeScript. It uses Expo Router for file-based navigation and Firebase for
cloud-backed features. The app includes health tracking and history, exercise
and rep counting, emergency contacts, community features, and wellness
essentials.

This app is not a medical device. Its content and community posts are not a
substitute for advice from a qualified health professional.

## Getting started

Install the project dependencies and start Expo:

```sh
npm install
npx expo start
```

Useful scripts from `package.json`:

- `npm start` — start the Expo development server.
- `npm run android` — build and run the Android app locally.
- `npm run ios` — build and run the iOS app locally (requires macOS and the
  appropriate Apple tooling).
- `npm run web` — start the web version.
- `npm run lint` — run Expo's lint checks.
- `npm run reset-project` — reset the starter project; read the script before
  running because it changes project files.

Some native features need a custom development build and will not work in
Expo Go. In particular, Health Connect requires a custom Android build.

## Where to look

- `src/app/` — application routes and screens. Route files are grouped into
  folders such as `(tabs)` and `(auth)`.
- `src/components/` — reusable interface components.
- `src/services/` — integrations and application services, including Firebase.
- `src/hooks/` — reusable React hooks.
- `src/lib/` — shared storage helpers.
- `src/types/` — TypeScript types.
- `src/data/` — bundled app data such as exercise plans.
- `assets/` — icons, images, and other app assets.
- `docs/health-connect.md` — setup and manual verification notes for importing
  blood pressure readings from Android Health Connect.
- `firestore.rules` and `firestore.indexes.json` — Firebase security rules and
  Firestore index definitions. Local changes to these files do not take effect
  in Firebase until they are deployed.
- `app.json` — Expo app configuration, native permissions, and plugins.

## Firebase and online features

Community and Essentials features depend on Firebase configuration and
deployed Firestore rules. If those screens report permission or index errors,
check that the rules and indexes were deployed to the same Firebase project
the app is configured to use. See `README.md` for the project's deployment
notes and `docs/health-connect.md` for the Health Connect data rules.

Keep Firebase credentials and other secrets out of source control. Do not
loosen Firestore rules just to make a permission error disappear; confirm the
intended access and validate any rules before deploying.

## Health Connect notes

The Android blood pressure import reads records from Health Connect; it does
not connect directly to an Omron monitor over Bluetooth. The documented flow
is:

`Omron monitor → Omron Connect → Health Connect → Vitalize`

After adding or changing native dependencies or permissions, generate and
install a new Android development build. Follow the dedicated
[`docs/health-connect.md`](docs/health-connect.md) instructions for build
commands, Firestore rules, and a manual end-to-end check.

## Before making or releasing changes

1. Read the relevant route, service, and related documentation before changing
   behavior.
2. Keep platform-specific requirements in mind. Native module or permission
   changes may require rebuilding the development client; restarting Metro
   alone is not enough.
3. Run the narrowest relevant check, then `npm run lint` when appropriate.
4. Test important flows on the platform and build type they depend on,
   especially camera, notifications, and Health Connect.
5. Treat health data as sensitive. Check authentication, data access rules,
   and user-facing permission/error states when modifying storage or sync.
6. Update this file or the more specific documentation when setup steps or
   important project behavior changes.

## Change history

- **23 October 2026:** Added this project handoff log. No application code,
  dependencies, Expo configuration, or Firebase settings were changed.
