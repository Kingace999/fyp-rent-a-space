const fs = require('fs');
const path = require('path');

const TARGET_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx'];
const IGNORE_DIRS = ['node_modules', 'build', 'dist', '.next', '.git', 'coverage'];

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('console.log')) {
      console.log(`[Dry Run] Would remove console.log in: ${filePath} (Line ${index + 1})`);
    }
  });
}

function walkDir(dirPath) {
  fs.readdirSync(dirPath).forEach((file) => {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory() && !IGNORE_DIRS.includes(file)) {
      walkDir(fullPath);
    } else if (
      stat.isFile() &&
      TARGET_EXTENSIONS.includes(path.extname(fullPath))
    ) {
      scanFile(fullPath);
    }
  });
}

// Start scanning from the root of the project
const projectRoot = path.resolve(__dirname);
walkDir(projectRoot);

console.log('✅ Dry run complete.');
