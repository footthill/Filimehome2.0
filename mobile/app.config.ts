import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'FilimeHome 2.0', slug: 'filimehome-2', version: '2.0.0',
  orientation: 'default', userInterfaceStyle: 'dark',
  // The repository has no app icon asset. Do not invent existing branding.
  android: { package: 'com.footthill.filimehome', versionCode: 1 },
  plugins: [
    ['expo-video', { supportsBackgroundPlayback: false, supportsPictureInPicture: true }],
    'expo-screen-orientation',
  ],
  extra: process.env.EAS_PROJECT_ID ? { eas: { projectId: process.env.EAS_PROJECT_ID } } : {},
};
export default config;
