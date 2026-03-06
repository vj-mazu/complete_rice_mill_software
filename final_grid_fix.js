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

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');

    // 1. Rename columns to "Sample Collected By"
    content = content.replace(/Reported By/g, 'Sample Collected By');
    content = content.replace(/Collected By/g, 'Sample Collected By');
    // Avoid double renaming
    content = content.replace(/Sample Sample Collected By/g, 'Sample Collected By');

    // 2. Ensure every th and td has border: '1px solid #000'
    // and padding / textAlign if missing
    content = content.replace(/<(th|td) style=\{\{([^}]+)\}\}/g, (match, tag, p1) => {
        let style = p1;
        if (!style.includes('border:')) {
            style = `border: '1px solid #000', ${style}`;
        } else {
            style = style.replace(/border: '[^']+'/, "border: '1px solid #000'");
        }
        return `<${tag} style={{${style}}}`;
    });

    // 3. Fix the specific logic for AdminSampleBook2 to use creator.username || sampleCollectedBy
    if (file === 'client/src/pages/AdminSampleBook2.tsx') {
        content = content.replace(/\{qp\?\.reportedBy \? \([\s\S]+?\) : entry\.creator\?\.username \? \([\s\S]+?\) : '-'\}/g,
            "{entry.creator?.username ? (\n                                                                        <span style={{ fontWeight: '600', color: '#1565c0' }}>{toTitleCase(entry.creator.username)}</span>\n                                                                    ) : entry.sampleCollectedBy ? (\n                                                                        <span style={{ color: '#666' }}>{toTitleCase(entry.sampleCollectedBy)}</span>\n                                                                    ) : '-'} ");
    }

    // 4. Ensure table itself has outer border
    content = content.replace(/<table style=\{\{([^}]+)\}\}/g, (match, p1) => {
        let style = p1;
        if (!style.includes('border:')) style += ", border: '1px solid #000'";
        if (!style.includes('borderCollapse:')) style += ", borderCollapse: 'collapse'";
        return `<table style={{${style}}}`;
    });

    fs.writeFileSync(file, content);
    console.log(`Final refinement applied to ${file}`);
});
