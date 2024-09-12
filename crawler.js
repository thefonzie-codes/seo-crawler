const puppeteer = require('puppeteer');
const readline = require('readline');
const process = require('process');
const { URL } = require('url');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let url = '';

const visited = new Set();
const missingSeoTags = [];
const brokenLinks = [];

async function crawl(baseUrl, currentUrl) {
    if (visited.has(currentUrl)) {
        return;
    }

    visited.add(currentUrl);

    console.log('Visiting:', currentUrl);

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    const seoErrors = await page.evaluate(() => {
        const tags = ['title', 'meta[name="description"]', 'meta[name="keywords"]', 'h1'];
        const missingTag = tags.filter(tag => !document.querySelector(tag));
    });

    const pageNotFound = await page.evaluate(() => {
        return document.querySelector('h1').textContent === 'Page Not Found';
    })

    if (pageNotFound) {
        brokenLinks.push(currentUrl);
    }
    
    missingSeoTags.push({ url, missing: seoErrors });

    const links = await page.evaluate((base) => {
        const anchors = Array.from(document.querySelectorAll('a'));
        return anchors
        .map(anchor => anchor.href)
        .filter(href => href.startsWith(base));
    }, url);

    console.log(`Crawling ${currentUrl}...`);

    const title = await page.title();
    console.log('Title:', title);

    const h1 = await page.evaluate(() => {
        return document.querySelector('h1').textContent;
    });
    console.log('H1:', h1);

    const metaTags = await page.evaluate(() => {
        const tags = document.querySelectorAll('meta');
        return Array.from(tags).map(tag => {
            //return all the contents of the tags
            const attributes = {}   
            Array.from(tag.attributes).forEach(attr => {
                attributes[attr.name] = attr.value
            });
            return attributes;
        })
    });

    console.log('Meta tags:', metaTags);

    for (const link of links) {
        const resolvedURL = new URL(link, baseUrl).href;
        await crawl(baseUrl, resolvedURL);
        console.log(`Crawling of ${currentUrl} complete`);
    }

    await browser.close();
}

const startCrawling = async (url) => {
    await crawl(url, url);
    console.log('Full crawl complete');
    console.log('Missing SEO tags:', missingSeoTags);
};

rl.question('Enter the URL you want to crawl: ', (answer) => {
    // Validate and format the URL
    try {
        const formattedUrl = new URL(answer.startsWith('http') ? answer : 'https://' + answer);
        url = formattedUrl.href;
        console.log(formattedUrl);
    } catch (e) {
        console.error('Invalid URL');
        rl.close();
        process.exit(1);
    }
    rl.close();
    startCrawling(url); // Call the function after the URL is set
});
