const fs = require('fs');
const path = 'src/pages/dashboard/DashboardLayout.tsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

// Find the line that starts with "import React" after line 0
let duplicateIndex = -1;
for (let i = 1; i < lines.length; i++) {
  if (lines[i].startsWith("import React, { useState, useEffect, Fragment } from 'react';")) {
    duplicateIndex = i;
    break;
  }
}

if (duplicateIndex !== -1) {
  lines = lines.slice(duplicateIndex);
  fs.writeFileSync(path, lines.join('\n'));
  console.log('Fixed DashboardLayout.tsx');
} else {
  console.log('Could not find duplicate import');
}
