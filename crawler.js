const puppeteer = require("puppeteer");
const readline = require("readline");
const { URL } = require("url");
const { missingTagsCsv, brokenLinksCsv } = require("./csvWriter");
const { htmlTags } = require("./config");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const visited = new Set();
const missingSeoTags = new Set();
const brokenLinks = new Set();
const skipRoutes = ["/blog"];
const MAX_CONCURRENT_BROWSERS = 5; // Set the limit for concurrent Chrome instances

const queue = []; // Queue to track pending crawl tasks
let activeBrowsers = 0; // Counter for active browser instances

async function crawl(baseUrl, currentUrl) {
    if (visited.has(currentUrl) || skipRoutes.some((route) => currentUrl.includes(route))) {
        return;
    }

    visited.add(currentUrl);
    console.log("Visiting:", currentUrl);

    while (activeBrowsers >= MAX_CONCURRENT_BROWSERS) {
        await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for a free browser slot
    }

    activeBrowsers++;

    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    try {
        await page.goto(currentUrl, { waitUntil: "networkidle2" });

        const isPage404 = await page.evaluate(() => {
            const title = document.querySelector('title');
            return title && title.textContent.includes("404");
        });

        if (isPage404) {
            brokenLinks.add({ currentUrl: currentUrl });
            return;
        }

        const seoErrors = await page.evaluate((htmlTags) => {
            return htmlTags.filter((tag) => !document.querySelector(tag));
        }, htmlTags);
        
        if (seoErrors.length > 0) {
            missingSeoTags.add({
                currentUrl: currentUrl,
                missing: seoErrors.join(", "),
            });
        }

        const links = await page.evaluate((base) => {
            return Array.from(document.querySelectorAll("a"))
                .map((anchor) => anchor.href)
                .filter((href) => href.startsWith(base));
        }, baseUrl);

        console.log("Title:", await page.title());
        console.log(
            "Meta tags:",
            await page.evaluate(() =>
                Array.from(document.querySelectorAll("meta")).map((tag) =>
                    Array.from(tag.attributes).reduce(
                        (attrs, attr) => ({
                            ...attrs,
                            [attr.name]: attr.value,
                        }),
                        {}
                    )
                )
            )
        );

        for (const link of links) {
            if (!visited.has(link)) {
                queue.push(crawl(baseUrl, new URL(link, baseUrl).href));
            }
        }
    } catch (e) {
        console.error("Error:", e);
        brokenLinks.add({ currentUrl: currentUrl }); // Add to broken links if navigation failed
    } finally {
        await browser.close();
        activeBrowsers--; // Decrement the active browser count when done
    }
}

const startCrawling = async (url) => {
    queue.push(crawl(url, url));

    while (queue.length > 0) {
        await Promise.all(queue.splice(0, MAX_CONCURRENT_BROWSERS).map((task) => task));
    }

    console.log("\n \nCrawl complete\n");
    console.log("\n \nMissing SEO tags:", missingSeoTags);
    console.log("\n \nBroken links:", brokenLinks);

    await missingTagsCsv.writeRecords(missingSeoTags);
    await brokenLinksCsv.writeRecords(brokenLinks);
};

rl.question("Enter the URL to crawl: ", (answer) => {
    try {
        const url = new URL(
            answer.startsWith("http") ? answer : "https://" + answer
        );
        rl.close();
        startCrawling(url.href);
    } catch (e) {
        console.error("Invalid URL");
        rl.close();
    }
});