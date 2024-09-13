const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const missingTagsCsv = createCsvWriter({
    path: 'missingTags.csv',
    header: [
        { id: 'currentUrl', title: 'URL' },
        { id: 'missing', title: 'MISSING' },
    ]
});

const brokenLinksCsv = createCsvWriter({
    path: 'brokenLinks.csv',
    header: [
        { id: 'currentUrl', title: 'URL' } // Change 'URL' to 'currentUrl' to match your data
    ]
});

module.exports = { missingTagsCsv, brokenLinksCsv };
