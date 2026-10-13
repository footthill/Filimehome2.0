import type { ExpoConfig } from 'expo/config';
import { withGradleProperties, type ConfigPlugin } from 'expo/config-plugins';

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
  android: { package: 'com.footthill.filimehome', versionCode: 4 },
  plugins: [
    ['expo-video', { supportsBackgroundPlayback: false, supportsPictureInPicture: true }],
    'expo-screen-orientation',
    './plugins/with-fixture-trust.cjs',
  ],
  extra: process.env.EAS_PROJECT_ID ? { eas: { projectId: process.env.EAS_PROJECT_ID } } : {},
};
export default withAndroidCompatibility(config);
