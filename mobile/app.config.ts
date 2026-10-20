import type { ExpoConfig } from 'expo/config';
import { withGradleProperties, type ConfigPlugin } from 'expo/config-plugins';
import { validatePublicConfig } from '../shared/public-config.mjs';

// Metro embeds EXPO_PUBLIC_* at compilation; refuse a production APK with no backend.
if (process.env.EXPO_PUBLIC_FIXTURE_QA !== '1') {
  validatePublicConfig(process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
}

// Keep the Expo 54 SDK defaults explicit and include Samsung's ARM architectures.
// Android 15 can run target 36 applications: minimum SDK controls installation.
const withAndroidCompatibility: ConfigPlugin = config => withGradleProperties(config, mod => {
  const values: Record<string, string> = {
    'android.minSdkVersion': '24',
    'android.compileSdkVersion': '36',
    'android.targetSdkVersion': '36',
    reactNativeArchitectures: 'armeabi-v7a,arm64-v8a,x86,x86_64',
  };
  mod.modResults = mod.modResults.filter(item => item.type !== 'property' || !(item.key in values));
  for (const [key, value] of Object.entries(values)) {
    mod.modResults.push({ type: 'property', key, value });
  }
  return mod;
});

const config: ExpoConfig = {
  name: 'FilimeHome 2.0', slug: 'filimehome-2', version: '2.0.0',
  orientation: 'default', userInterfaceStyle: 'dark',
  // The repository has no app icon asset. Do not invent existing branding.
  android: { package: 'com.footthill.filimehome', versionCode: 7 },
  plugins: [
    ['expo-video', { supportsBackgroundPlayback: false, supportsPictureInPicture: true }],
    'expo-screen-orientation',
    './plugins/with-fixture-trust.cjs',
    './plugins/with-media-export.cjs',
  ],
  extra: process.env.EAS_PROJECT_ID ? { eas: { projectId: process.env.EAS_PROJECT_ID } } : {},
};
export default withAndroidCompatibility(config);
