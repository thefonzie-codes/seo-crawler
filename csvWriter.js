const createCsvWriter = require('csv-writer').createObjectCsvWriter;

export const csvWriter = createCsvWriter({
    path: 'output.csv',
    header: [
        {id: 'URL', title: 'URL'},
        {id: 'Missing', title: 'MISSING'}
    ]
});