// CI-only trust for locally generated media. Never applied to the delivered APK.
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');
module.exports = config => {
  if (process.env.EXPO_PUBLIC_FIXTURE_QA !== '1') return config;
  if (!process.env.FILIMEHOME_FIXTURE_CA) throw new Error('Fixture QA requires its generated test CA.');
  config = withAndroidManifest(config, mod => {
    mod.modResults.manifest.application[0].$['android:networkSecurityConfig'] = '@xml/fixture_network_security';
    return mod;
  });
  return withDangerousMod(config, ['android', async mod => {
    const res = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res');
    fs.mkdirSync(path.join(res, 'raw'), { recursive: true });
    fs.mkdirSync(path.join(res, 'xml'), { recursive: true });
    fs.copyFileSync(process.env.FILIMEHOME_FIXTURE_CA, path.join(res, 'raw/fixture_ca.pem'));
    fs.writeFileSync(path.join(res, 'xml/fixture_network_security.xml'), '<network-security-config><base-config cleartextTrafficPermitted="false"><trust-anchors><certificates src="system" /></trust-anchors></base-config><domain-config cleartextTrafficPermitted="false"><domain includeSubdomains="false">127.0.0.1</domain><trust-anchors><certificates src="@raw/fixture_ca" /></trust-anchors></domain-config></network-security-config>');
    return mod;
  }]);
};
