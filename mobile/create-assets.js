const fs = require('fs');
const path = require('path');

// 1x1 transparent PNG as base64
const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
const pngBuffer = Buffer.from(pngBase64, 'base64');

const files = ['icon.png', 'splash.png', 'adaptive-icon.png', 'favicon.png'];

files.forEach(f => {
  const filePath = path.join(__dirname, 'assets', f);
  fs.writeFileSync(filePath, pngBuffer);
  console.log('Created ' + filePath);
});
