// electron-builder hook: ad-hoc code signature for macOS builds.
// Apple Silicon only runs signed code; without a paid Developer ID we sign
// the app (including the bundled VICE) with an ad-hoc signature.
const { execSync } = require('child_process');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  console.log('  • ad-hoc signing', app);
  execSync(`codesign --force --deep --sign - "${app}"`, { stdio: 'inherit' });
};
