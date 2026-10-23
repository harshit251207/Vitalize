 Vitalize — project log
Vitalize is a react based mobile application where authentication is done from firebase and data is stored on firestore 


 What this project is

Vitalize is a mobile health and wellness app built with Expo, React Native, and
TypeScript. It uses Expo Router for file-based navigation 
Firebase for
cloud-backed features. The app includes health tracking and history, exercise
and rep counting, emergency contacts, community features, and wellness
essentials.
This app is not a medical device. Its content and community posts are not a
substitute for advice from a qualified health professional.
though we have used 


 Ai agents and llm used to create our app 

copilot - for building ui and setting up screens layout
cursor/antigravity - to set up ai agent 
claude- to improvise promts 


 Getting started
for setting up our app 
- npx create-expo-app@latest Vitalize


Install the project dependencies and start Expo:
npm install
npx expo start
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


 React and React Native libraries

The following are the direct app dependencies declared in `package.json` that
make up or extend the React/React Native app. The manifest is the source of
truth for exact versions. Some native modules are used through Expo
configuration or platform code rather than being imported directly by a
screen.


 Core framework and app interface

- `react` — React components, hooks, and application rendering.
- `react-native` — native application UI and platform APIs.
- `react-dom` — React rendering support for the web target.
- `react-native-web` — React Native-compatible UI on the web.
- `expo` — Expo runtime and APIs used by the app.
- `expo-router` — file-based navigation and route handling.
- `@expo/ui` — Expo's native UI components.
- `@expo/vector-icons` and `expo-symbols` — icon and symbol components.
- `react-native-safe-area-context` — safe-area insets for screens and controls.
- `react-native-screens` — native screen containers integrated with navigation.
- `react-native-gesture-handler` — touch and gesture handling.
- `react-native-reanimated` and `react-native-worklets` — animations and the
  worklet runtime used by animation features.
- `react-native-svg` — SVG rendering used by vector graphics and charting.
- `expo-font` — loading custom fonts.
- `expo-linear-gradient` and `expo-glass-effect` — visual effects and
  backgrounds.
- `expo-image` — image rendering.
- `expo-status-bar` and `expo-system-ui` — status bar and system appearance.


 Charts, storage, and native features

- `react-native-chart-kit` and `react-native-gifted-charts` — chart components
  for health and activity data.
- `@react-native-async-storage/async-storage` — persistent on-device key-value
  storage.
- `expo-secure-store` — secure device storage for sensitive values.
- `expo-camera` and `expo-image-picker` — camera and image selection.
- `expo-image-manipulator` — image resizing and transformation.
- `expo-audio` and `expo-video` — audio and video playback or capture.
- `expo-mediapipe-pose` — pose detection support for exercise features.
- `react-native-health-connect` — Android Health Connect integration.
- `expo-notifications` — local and push notification APIs.
- `expo-sms` — opening SMS functionality.
- `expo-haptics` — haptic feedback.
- `expo-device` and `expo-constants` — device and app configuration details.
- `expo-file-system` — local file access.
- `expo-linking` and `expo-web-browser` — opening links and browser pages.
- `expo-splash-screen` — splash screen control.
- `expo-dev-client` — custom development builds for native modules.

 Supporting packages and development tools

- `firebase` — authentication and Firestore services used by app features; it
  is an app integration rather than a React UI library.
- `effect` — supporting TypeScript/JavaScript utilities; it is not a React
  rendering library.
- `@types/react` — TypeScript definitions for React.
- `typescript`, `eslint`, and `eslint-config-expo` — type checking and code
  quality tools.
- `expo-build-properties` — Expo config plugin for native build settings.
- `@expo/ngrok` — optional tunneling support for the Expo development server.

 Where to look

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


 Firebase and online features

Community and Essentials features depend on Firebase configuration and
deployed Firestore rules. If those screens report permission or index errors,
check that the rules and indexes were deployed to the same Firebase project
the app is configured to use. See `README.md` for the project's deployment
notes and `docs/health-connect.md` for the Health Connect data rules.
Keep Firebase credentials and other secrets out of source control. Do not
loosen Firestore rules just to make a permission error disappear; confirm the
intended access and validate any rules before deploying.

 Health Connect notes
The Android blood pressure import reads records from Health Connect; it does
not connect directly to an Omron monitor over Bluetooth. The documented flow
is:

`Omron monitor → Omron Connect → Health Connect → Vitalize`

 Follow the dedicated
[`docs/health-connect.md`](docs/health-connect.md) instructions for build
commands, Firestore rules, and a manual end-to-end check.



## all the prompts we have used -- 

## PROMT 1
PROJECT CONTEXT
I'm building "Vitalize", a health companion app for people with physical disabilities
(hemiplegia, paraplegia, quadriplegia, monoplegia, diplegia). Users include wheelchair
users, people with limited hand dexterity, and caregivers.
Stack: React Native + Expo (EAS development build, Android first), TypeScript,
Firebase Auth, Cloud Firestore. The app already detects the user's condition category
from a medical report and has vitals tracking and an AI agent.

HOW TO WORK
1. FIRST read the existing code: package.json, app.json, the Firebase init file (exports
   db and auth), the tab layout (src/components/app-tabs.tsx), and the existing
   theme/colors/components. Follow the existing conventions. Do not refactor unrelated code.
2. Accessibility first: touch targets at least 56dp, high contrast, large readable text
   (respect system font scale), minimal typing (prefer big buttons, chips, steppers),
   accessibilityLabel/accessibilityRole on every control. Don't use color as the only
   signal; add text or an icon too.
3. Use useSafeAreaInsets so nothing is hidden behind Android system navigation buttons.
4. Do NOT add native dependencies without telling me first. List every required native
   package up front so I can do ONE EAS build. Use JS-only solutions where possible.
5. Handle loading, empty, error and offline states. Wrap Firestore calls in try/catch
   and show friendly messages.
6. Never hardcode secrets. Never log personal or health data.
7. Provide Firestore security rules for every collection you add, and explain them.
8. This is NOT a medical device. Never give diagnosis, dosing, or product-size advice.
   Show the disclaimers I specify.
9. Output format: (a) short plan, (b) list of files created/changed, (c) full code,
   (d) how to test, (e) anything I must do manually (indexes, rules, build).
10. Ask me at most ONE clarifying question, and only if truly blocked. Otherwise state
    your assumptions and proceed.

Prompt 2: Community
FEATURE: Community feed (user-to-user posts)

GOAL
Reduce isolation: users post tips, questions and motivation, and everyone signed in sees
posts in a live community feed.

USER STORIES
- I see a live feed (newest first) with category filter chips: All, Tips, Questions,
  Motivation, Exercise, and "My condition" (filters by my detected condition category).
- I can create a post: big text box (max 500 chars with counter), category chips, an
  "Post anonymously" toggle, and a big Post button. Don't build speech-to-text; the
  keyboard's microphone covers it.
- I can like a post (once per user), comment, delete my own post/comment, and report
  other people's posts.
- A "Not medical advice" banner is visible above the feed and on the create screen:
  "Posts here are personal experiences, not medical advice. Please ask your doctor
  before changing medicines, exercises or diet."

DATA MODEL (Firestore)
- posts/{postId}: { text, authorId, authorName, isAnonymous, category, conditionCategory,
  createdAt, likeCount, commentCount, reportCount, hidden }
  * For anonymous posts, do NOT store the real name (authorName = "Anonymous").
  * authorName for normal posts = first name only. Never store email or phone in posts.
- posts/{postId}/comments/{commentId}: { text (max 300), authorId, authorName, isAnonymous, createdAt }
- posts/{postId}/likes/{uid}: { createdAt }   (doc id = uid prevents double likes)
- posts/{postId}/reports/{uid}: { reason, createdAt }

BEHAVIOR
- Feed uses onSnapshot with limit(30) plus "Load more" pagination (startAfter).
- Like/unlike and comment counters update inside a transaction or batch together with
  the subcollection write.
- Report: one per user per post; when reportCount reaches 3, set hidden = true and
  exclude hidden posts from the feed query. Note in a comment that a real app should
  do this with a Cloud Function.
- Empty state ("Be the first to share something") and offline/error states.
- If Firestore asks for a composite index, tell me exactly which fields and that the
  error message contains a one-click creation link.

SECURITY RULES (write them out)
- Read: any signed-in user.
- Create post: authorId == request.auth.uid, text length 1-500, category in the allowed
  list, counters start at 0.
- Update post: only the counter fields (likeCount, commentCount, reportCount, hidden)
  may change, by signed-in users, via diff().affectedKeys().hasOnly([...]).
- Delete post/comment: only the author.
- likes/reports: the doc id must equal request.auth.uid.
Mention clearly that client-side counters are acceptable for a hackathon but can be
spoofed, and that Cloud Functions would be the production fix.

ACCEPTANCE CRITERIA
- A post from user A appears live on user B's device without refresh.
- Anonymous posts show no real name anywhere in the UI or database.
- A user can't like twice or delete someone else's post.

Prompt 4: Shopping essentials
FEATURE: Shopping essentials list with refill reminders

GOAL
Users track essentials (medicines, catheters, diapers, vitamins, etc.), see how many days
are left, get a reminder before items run out, and open a store search with one tap.
The app does NOT sell anything and has no checkout.

USER STORIES
- Essentials screen: list of items, each showing name, category icon, units left, days
  left, and a status that uses BOTH text and icon plus color: OK (more than 14 days),
  Soon (reminder window to 14 days), Reorder now (within remindDaysBefore or out).
- Add item: category chips (Medicine, Catheter, Diapers, Vitamins/Supplements, Gloves,
  Skin care, Wipes, Other), name (prefilled from category, editable), units left
  (+/- stepper), units per day (stepper, default 1), remind days before (3/5/7/10,
  default 5).
- On each card: +/- stepper for units left, and an "I restocked" button that opens a
  stepper to set the new count.
- Starter suggestions on the empty state, based on the user's detected condition
  category (find where the app stores it): for paraplegia/quadriplegia suggest
  Catheter, Diapers, Skin care, Wipes, Gloves; for others suggest Medicine and
  Vitamins/Supplements. These are tappable chips only, with no brands, sizes or doses.
- Buy button opens a bottom sheet with store options (Amazon India, Flipkart, Google
  search). Keep the stores in ONE config object (name + URL builder) so I can add more
  later. Use Linking.openURL with encodeURIComponent. Search URLs: amazon.in/s?k=,
  flipkart.com/search?q=, and for the Google option google.com/search?q= with
  "buy online india" appended. I have not verified pharmacy-site URL formats, so don't
  include 1mg or PharmEasy.

LOGIC
- runOutDate = now + (unitsLeft / unitsPerDay) days; store it. Compute daysLeft from
  runOutDate when rendering (don't write daily updates).
- Schedule one local notification at (runOutDate minus remindDaysBefore) at 09:00 local
  time. If that moment already passed but the item hasn't run out, schedule for the next
  09:00. Store the notification id on the item; cancel and replace it on every edit,
  restock or delete. Use expo-notifications (same package as the timer) with a separate
  "Refill reminders" Android channel. No other native packages.
- Notification text: "{name} may run out in about {n} days. Time to reorder."

DATA MODEL (Firestore)
- users/{uid}/essentials/{itemId}: { name, category, unitsLeft, unitsPerDay, runOutDate,
  remindDaysBefore, notificationId, updatedAt }
- Rules: only the signed-in owner can read/write; validate numbers are non-negative and
  unitsPerDay is greater than 0.

SAFETY TEXT (show on the screen, short and visible)
- "Vitalize doesn't sell medicines. Prescription medicines need a prescription."
- "Ask your doctor which type and size of catheter or other medical items is right for
  you."
- "Talk to your doctor before starting any vitamin or supplement."

ACCEPTANCE CRITERIA
- Changing units or usage updates days left and reschedules exactly one notification.
- Deleting an item cancels its notification.
- The list works offline, and all controls are at least 56dp and screen-reader labeled.


## promt 2 - to fix the voice assistant bug 
Bug: In Vitalize's voice input, recording works, but after stopping I get "unsupported FormDataPart implementation" when sending the audio for transcription.

First find the voice recording + transcription code and tell me what you found before editing.

Fix:
- Don't append a Blob/File/base64 to FormData. React Native requires: formData.append('file', { uri: recordingUri, name: 'audio.m4a', type: 'audio/m4a' } as any).
- Do NOT set the Content-Type header manually on the fetch call; let RN set the multipart boundary.
- Send to Groq: POST https://api.groq.com/openai/v1/audio/transcriptions with Authorization Bearer header, fields: model "whisper-large-v3-turbo", language "hi". Reuse the existing Groq API key already in the app.
- Make sure the recording is fully stopped and unloaded (await recording.stopAndUnloadAsync()) before reading getURI().
- Put the returned data.text into the chat input and send it through the existing chat pipeline.
- Add try/catch with console.log of the response status and body so errors are visible, and show a small toast if transcription fails.

Don't touch the chat agent, JSON parser, or other screens.



