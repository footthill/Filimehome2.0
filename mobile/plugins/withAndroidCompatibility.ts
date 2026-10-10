import { withGradleProperties, type ConfigPlugin } from 'expo/config-plugins';

// Android 15 can run target 36 applications: minimum SDK controls installation.
// Keep the Expo 54 SDK defaults explicit and include Samsung's ARM architectures.
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

export default withAndroidCompatibility;
