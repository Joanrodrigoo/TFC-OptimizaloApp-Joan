const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'index.js');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split(/\r?\n/);

console.log(`Original lines: ${lines.length}`);

// Block 2: 6925 to 7007 (1-based) -> Index 6924 to 7006
const start2 = 6924;
const end2 = 7006;
const count2 = end2 - start2 + 1;

// Verify content looks correct roughly
if (!lines[start2].trim().startsWith('/**') || !lines[end2].trim().startsWith('}')) {
    console.error(`Block 2 mismatch! Start: ${lines[start2]}, End: ${lines[end2]}`);
    process.exit(1);
}

console.log(`Removing block 2: Line ${start2 + 1} to ${end2 + 1} (${count2} lines)`);
lines.splice(start2, count2);

// Block 1: 123 to 898 (1-based) -> Index 122 to 897
const start1 = 122;
const end1 = 897;
const count1 = end1 - start1 + 1;

// Verify content looks correct roughly
// Line 123 (index 122) should be comment or similar
// Line 898 (index 897) should be '}'
if (!lines[end1].trim().startsWith('}')) {
    console.error(`Block 1 mismatch! End: ${lines[end1]}`);
    process.exit(1);
}

console.log(`Removing block 1: Line ${start1 + 1} to ${end1 + 1} (${count1} lines)`);
lines.splice(start1, count1);

fs.writeFileSync(filePath, lines.join('\n'));
console.log(`New lines: ${lines.length}`);
