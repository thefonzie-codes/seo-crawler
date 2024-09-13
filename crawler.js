// const puppeteer = require('puppeteer');
// const readline = require('readline');
// const process = require('process');
// const { URL } = require('url');
// const { missingTagsCsv, brokenLinksCsv } = require('./csvWriter');
// const { htmlTags } = require('./config');

// const rl = readline.createInterface({
//     input: process.stdin,
//     output: process.stdout
// });

// let url = '';

// const visited = new Set();
// const missingSeoTags = new Set();
// const brokenLinks = new Set();
// const skipRoutes = ['/blog']; // Add any other routes you want to skip here

// async function crawl(baseUrl, currentUrl) {
//     // Skip routes that match any of the entries in skipRoutes
//     if (visited.has(currentUrl) || skipRoutes.some(route => currentUrl.includes(route))) {
//         return;
//     }

//     visited.add(currentUrl);

//     console.log('Visiting:', currentUrl);

//     const browser = await puppeteer.launch();
//     const page = await browser.newPage();
//     await page.goto(currentUrl, { waitUntil: 'networkidle2' });

//     const seoErrors = await page.evaluate(() => {
//         const missingTags = htmlTags.filter(tag => !document.querySelector(tag));
//         return missingTags;
//     });

//     missingSeoTags.add({ currentUrl, missing: (seoErrors ? seoErrors.join(', ') : 'None') });

//     const links = await page.evaluate((base) => {
//         const anchors = Array.from(document.querySelectorAll('a'));
//         return anchors
//             .map(anchor => anchor.href)
//             .filter(href => href.startsWith(base));
//     }, url);

//     console.log(`Crawling ${currentUrl}...`);

//     const title = await page.title();
//     console.log('Title:', title);

//     const metaTags = await page.evaluate(() => {
//         const tags = document.querySelectorAll('meta');
//         return Array.from(tags).map(tag => {
//             const attributes = {};
//             Array.from(tag.attributes).forEach(attr => {
//                 attributes[attr.name] = attr.value;
//             });
//             return attributes;
//         });
//     });

//     console.log('Meta tags:', metaTags);

//     for (const link of links) {
//         const resolvedURL = new URL(link, baseUrl).href;
//         await crawl(baseUrl, resolvedURL);
//     }

//     await browser.close();
// }

// const startCrawling = async (url) => {
//     await crawl(url, url);
//     console.log('Full crawl complete');
//     console.log('Missing SEO tags:', missingSeoTags);
//     console.log('Broken links:', brokenLinks);
// };

// rl.question('Enter the URL you want to crawl: ', (answer) => {
//     try {
//         const formattedUrl = new URL(answer.startsWith('http') ? answer : 'https://' + answer);
//         url = formattedUrl.href;
//         console.log(formattedUrl);
//     } catch (e) {
//         console.error('Invalid URL');
//         rl.close();
//         process.exit(1);
//     }
//     rl.close();
//     startCrawling(url); // Call the function after the URL is set

//     missingTagsCsv.writeRecords(missingSeoTags)
//         .then(() => {
//             console.log('Missing SEO tags CSV file written');
//         });
//     brokenLinksCsv.writeRecords(brokenLinks)
//         .then(() => {
//             console.log('Broken links CSV file written');
//         });
// });


const puppeteer = require('puppeteer');
const readline = require('readline');
const { URL } = require('url');
const { missingTagsCsv, brokenLinksCsv } = require('./csvWriter');
const { htmlTags } = require('./config');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const visited = new Set();
const missingSeoTags = new Set();
const brokenLinks = new Set();
const skipRoutes = ['/blog'];

async function crawl(baseUrl, currentUrl) {
    if (visited.has(currentUrl) || skipRoutes.some(route => currentUrl.includes(route))) return;
    
    visited.add(currentUrl);
    console.log('Visiting:', currentUrl);

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(currentUrl, { waitUntil: 'networkidle2' });

    const seoErrors = await page.evaluate((htmlTags) => {
        return htmlTags.filter(tag => !document.querySelector(tag));
    }, htmlTags);

    missingSeoTags.add({ currentUrl, missing: seoErrors.join(', ') || 'None' });

    const links = await page.evaluate((base) => {
        return Array.from(document.querySelectorAll('a'))
            .map(anchor => anchor.href)
            .filter(href => href.startsWith(base));
    }, baseUrl);

    console.log('Title:', await page.title());
    console.log('Meta tags:', await page.evaluate(() => 
        Array.from(document.querySelectorAll('meta')).map(tag => 
            Array.from(tag.attributes).reduce((attrs, attr) => ({
                ...attrs, [attr.name]: attr.value
            }), {}))
    ));

    for (const link of links) {
        await crawl(baseUrl, new URL(link, baseUrl).href);
    }

    await browser.close();
}

const startCrawling = async (url) => {
    await crawl(url, url);
    console.log('Crawl complete');
    console.log('Missing SEO tags:', missingSeoTags);
    console.log('Broken links:', brokenLinks);

    await missingTagsCsv.writeRecords(missingSeoTags);
    await brokenLinksCsv.writeRecords(brokenLinks);
};

rl.question('Enter the URL to crawl: ', (answer) => {
    try {
        const url = new URL(answer.startsWith('http') ? answer : 'https://' + answer);
        rl.close();
        startCrawling(url.href);
    } catch (e) {
        console.error('Invalid URL');
        rl.close();
    }
});

