/**
 * Enlarges the Meropaw app icon logo within its frame by zooming into the center.
 * Run: node scripts/enlarge-app-icon.js
 * Backup of original is saved as meropaw Logo.backup.png
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ASSETS = path.join(__dirname, '..', 'assets');
const ICON = path.join(ASSETS, 'meropaw Logo.png');
const BACKUP = path.join(ASSETS, 'meropaw Logo.backup.png');
const TMP = path.join(ASSETS, 'meropaw Logo.tmp.png');

async function main() {
  if (!fs.existsSync(ICON)) {
    console.error('Icon not found:', ICON);
    process.exit(1);
  }

  // Backup original
  fs.copyFileSync(ICON, BACKUP);
  console.log('Backup saved to meropaw Logo.backup.png');

  const meta = await sharp(ICON).metadata();
  const w = meta.width || 600;
  const h = meta.height || 600;

  // Zoom into center: use center 55% of image then scale back to full size
  // so the logo fills more of the frame (about 1.8x larger appearance)
  const cropSize = Math.round(Math.min(w, h) * 0.55);
  const left = Math.round((w - cropSize) / 2);
  const top = Math.round((h - cropSize) / 2);

  await sharp(ICON)
    .extract({ left, top, width: cropSize, height: cropSize })
    .resize(w, h)
    .png()
    .toFile(TMP);

  fs.renameSync(TMP, ICON);

  console.log('New icon written. Logo should appear larger in the frame.');
  console.log('Rebuild the app to see the updated icon on device.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
