const extract = require('extract-zip');
const path = require('path');
const fs = require('fs');
const { downloadArtifact } = require('@electron/get');

async function main() {
  const version = '30.0.0';
  const platform = 'win32';
  const arch = 'x64';

  console.log(`Downloading Electron ${version} for ${platform}-${arch}...`);
  const zipPath = await downloadArtifact({
    version,
    platform,
    artifactName: 'electron',
    arch,
  });
  console.log('Downloaded:', zipPath);

  const distPath = path.resolve('node_modules/electron/dist');
  console.log('Extracting to:', distPath);
  await extract(zipPath, { dir: distPath });
  console.log('Extraction complete!');

  // Write version file
  fs.writeFileSync(path.join(distPath, 'version'), version);
  // Write path.txt
  fs.writeFileSync(path.resolve('node_modules/electron/path.txt'), 'electron.exe');

  console.log('Electron installed successfully!');
  console.log('Binary:', path.join(distPath, 'electron.exe'), fs.existsSync(path.join(distPath, 'electron.exe')) ? 'EXISTS' : 'MISSING');
}

main().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
