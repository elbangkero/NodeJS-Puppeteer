const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
 
function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}

async function clickEmojiDiv(page) {
    try { 
        const divSelector = 'div.x9f619.x1n2onr6.x1ja2u2z.x6s0dn4.x78zum5.x1qx5ct2.xl56j7k.x47corl.xw4jnvo';
 
        const emojiDiv = await page.$(divSelector);

        if (emojiDiv) { 
            await page.evaluate(div => {
                div.scrollIntoView();
            }, emojiDiv);
 
            await emojiDiv.hover();
            console.log('Hovered over the emoji div.');
 
            await emojiDiv.click();
            console.log('Clicked on the emoji div.');
 
            await delay(1000); 
        } else {
             
            const logMessage = `Emoji div not found with the specified selector.`;
            console.log(logMessage);
            const logFilePath = path.join(__dirname, 'error_msg.txt');
            fs.appendFile(logFilePath, `${logMessage}\n`, (err) => {
                if (err) console.error('Error writing to file:', err);
            });
        }
    } catch (error) { 
        const errorMSG = `Error processing emoji div: ${error}`;
        const logFilePath = path.join(__dirname, 'error_msg.txt');
        fs.appendFile(logFilePath, `${errorMSG}\n`, (err) => {
            if (err) {
                console.error('Error writing to file:', err);
            } else {
                console.log(`${errorMSG}`);
            }
        });
    }
}
 
(async () => {
    const wsChromeEndpointurl = 'ws://127.0.0.1:9222/devtools/browser/4a5d2de0-5280-465f-9e46-6ce6fee5f89c';
    const browser = await puppeteer.connect({
        browserWSEndpoint: wsChromeEndpointurl,
        args: ['--window-size=1920,1080', '--headless'],  
        defaultViewport: null
    });

    const page = await browser.newPage();
    const pageUrl = 'https://www.messenger.com/e2ee/t/7261735143923072/';
    await page.goto(pageUrl, { waitUntil: 'networkidle0' });

    for (let i = 1; i <= 100; i++) {
        await clickEmojiDiv(page);
    } 
 
    await browser.disconnect();
})();
