# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## Community and shopping essentials

- Deploy the rules in `firestore.rules` before using the Community or Essentials screens.
- If Community shows a Firestore permission error, deploy these rules to the same Firebase project configured in the app: `npx firebase-tools deploy --only firestore:rules --project vitalize-d5e42`. Community reads are allowed to every signed-in user; a local rules file does not take effect until deployed.
- If Firestore requests a composite index, create `hidden` ascending + `createdAt` descending for All; `hidden` ascending + `category` ascending + `createdAt` descending for category filters; and `hidden` ascending + `conditionCategory` ascending + `createdAt` descending for “My condition”. Firestore's error contains a one-click index-creation link.
- Community likes, comments, and reports update client-side counters in transactions. This is suitable for a hackathon, but a modified client can spoof counts or hide posts; use trusted Cloud Functions for production counter and moderation logic.
- Essentials are cached on-device for offline viewing. Refill reminders use `expo-notifications`; after installing the native package, create a new EAS development build and grant notification permission on the device.
- This app is not a medical device. Community posts are personal experiences, not medical advice; users should ask their doctor before changing medicines, exercises, or diet.
