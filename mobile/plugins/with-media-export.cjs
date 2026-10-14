const { withMainApplication, withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');
module.exports = config => {
  config = withMainApplication(config, mod => {
    mod.modResults.contents = mod.modResults.contents.replace('PackageList(this).packages.apply {', 'PackageList(this).packages.apply {\n              add(FilimeHomeExportPackage())');
    return mod;
  });
  return withDangerousMod(config, ['android', async mod => {
    const dir = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/java/com/footthill/filimehome');
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(path.join(__dirname, 'FilimeHomeExport.kt'), path.join(dir, 'FilimeHomeExport.kt'));
    return mod;
  }]);
};
