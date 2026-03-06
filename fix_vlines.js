const fs = require('fs');

const files = [
    'client/src/pages/SampleEntry.tsx',
    'client/src/pages/AdminSampleBook.tsx',
    'client/src/pages/AdminSampleBook2.tsx',
    'client/src/pages/LotSelection.tsx',
    'client/src/pages/CookingReport.tsx',
    'client/src/pages/FinalReport.tsx',
    'client/src/pages/LoadingLots.tsx'
];

for (const file of files) {
    let c = fs.readFileSync(file, 'utf8');

    // Add full border (all 4 sides) to table element for left/right vertical edges
    c = c.replaceAll(
        `borderBottom: '1px solid #000' }}`,
        `borderBottom: '1px solid #000', border: '1px solid #000' }}`
    );
    // Deduplicate
    c = c.replaceAll(
        `border: '1px solid #000', border: '1px solid #000'`,
        `border: '1px solid #000'`
    );

    fs.writeFileSync(file, c);
    console.log(`${file} — vertical lines added!`);
}
