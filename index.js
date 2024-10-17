const puppeteer = require('puppeteer');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

(async () => {
    const wsChromeEndpointurl = 'ws://127.0.0.1:9222/devtools/browser/27a68bb2-ac8b-4c75-bef1-4cf64759fb4f';
    const browser = await puppeteer.connect({
        browserWSEndpoint: wsChromeEndpointurl,
        args: ['--window-size=1920,1080'],
        defaultViewport: null
    });

    const page = await browser.newPage();
    let pageUrl = 'https://manage.hllucky99.com/management/group';

    await page.goto(pageUrl, {
        waitUntil: 'networkidle0',
    });

    // Confirmation prompt
    const shouldStart = await new Promise((resolve) => {
        const confirm = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        confirm.question('Do you want to start the automation? (yes/no): ', (answer) => {
            confirm.close();
            resolve(answer.toLowerCase() === 'yes');
        });
    });

    if (!shouldStart) {
        console.log('Automation cancelled.');
        await browser.disconnect();
        return;
    }

    let checkboxClickCount = 0; // Counter for checkbox clicks
    let menuClickCount = 0; // Counter for menu item clicks
    let skippedCount = 0; // Counter for skipped items
    const checkedAccessLevels = new Map(); // Track checked states for access levels

    searchCSV();
    async function searchCSV() {
        console.log('Searching Started');
        const menus = [];
        const accessLevels = [];
        const seenPermissions = new Set();
        const duplicates = new Set();

        function isDuplicate(newPermission, existingPermissions) {
            return Array.from(existingPermissions).some(existingPermission => {
                return existingPermission.includes(newPermission) || newPermission.includes(existingPermission);
            });
        }

        fs.createReadStream('/usr/local/var/www/HV-Puppeteer/Happy Vegas Permission.csv')
            .pipe(csv({ headers: ['Permission', 'Admin'], skipEmptyLines: true }))
            .on('data', (data) => {
                if (data.Admin && data.Admin.trim() === 'TRUE') {
                    const cleanedPermission = data.Permission ? data.Permission.replace(/^- /, '').trim() : '';
                    seenPermissions.add(cleanedPermission);

                    if (cleanedPermission.startsWith('Menu :')) {
                        menus.push(cleanedPermission);
                    } else if (cleanedPermission.startsWith('Access :')) {
                        accessLevels.push(cleanedPermission);
                    }
                }
            })
            .on('end', async () => {
                if (duplicates.size > 0) {
                    const duplicateArray = Array.from(duplicates);
                    console.log('Detected duplicates:', duplicateArray);

                    // Log duplicates to error file
                    duplicateArray.forEach(duplicate => {
                        const errorMSG = `Duplicate permission detected: '${duplicate}'`;
                        const logFilePath = path.join(__dirname, 'error_msg.txt');
                        fs.appendFile(logFilePath, `${errorMSG}\n`, (err) => {
                            if (err) {
                                console.error('Error writing to file:', err);
                            } else {
                                console.log(`${errorMSG}`);
                            }
                        });
                    });
                } else {
                    console.log('No duplicates found.');
                }

                // Filter out duplicates from menus and access levels
                const validMenus = menus.filter(menu => !duplicates.has(menu));
                const validAccessLevels = accessLevels.filter(access => !duplicates.has(access));

                console.log('Final Organized Results:', [...validMenus, ...validAccessLevels]);
                const finalResults = [...validMenus, ...validAccessLevels];
                console.log('Final Organized Results Count:', finalResults.length);
                const interval = 250;

                // Process menu items with await to ensure sequence
                for (let i = 0; i < validMenus.length; i++) {
                    await clickMenuItem(page, validMenus[i]);
                }

                // Process access levels with await to ensure sequence and count all checkbox clicks
                for (let i = 0; i < validAccessLevels.length; i++) {
                    await clickAccessLevel(page, validAccessLevels[i]);
                }

                // After all processes finish, log the total counts
                console.log(`Total checkbox clicks: ${checkboxClickCount + menuClickCount} `);
                console.log(`Final Organized Count: ${validAccessLevels.length + validMenus.length}`);
                console.log(`Skipped access levels: ${skippedCount}`);

                // Disconnect browser when done
                await browser.disconnect();
            })
            .on('error', (err) => {
                console.error('Error reading the CSV file:', err);
            });
    }

    async function clickMenuItem(page, menuText) {
        try {
            const element = await page.evaluateHandle((text) => {
                return Array.from(document.querySelectorAll('td')).find(td => td.textContent.includes(text));
            }, menuText);

            if (element) {
                await element.hover();
                await element.click();
                menuClickCount++; // Increment menu click counter
                console.log(`Clicked on menu item: ${menuText}`);
            } else {
                console.log(`Menu item "${menuText}" not found.`);
            }
        } catch (error) {
            const errorMSG = `Menu level '${menuText}' not found`;
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

    async function clickAccessLevel(page, accessText) {
        try {
            const normalizedAccessText = `- ${accessText.trim()}`;

            const checkboxes = await page.$$eval('tr', (rows, text) =>
                rows.filter(row => {
                    const tdText = row.querySelector('td.pl-5') ? row.querySelector('td.pl-5').textContent.trim() : '';
                    return tdText === text;
                }).map((row, index) => ({
                    index,
                    text: row.querySelector('td.pl-5').textContent.trim(),
                    isChecked: row.querySelector('input[type="checkbox"]').checked,
                    checkboxId: row.querySelector('input[type="checkbox"]').id
                }))
                , normalizedAccessText);

            let dynamicVariables = {};
            if (checkboxes.length > 0) {
                for (let i = 0; i < checkboxes.length; i++) {
                    const checkbox = checkboxes[i];
                    let checkboxId = checkboxes[i].checkboxId;
                    // Count all instances, including already checked ones
                    if (!checkbox.isChecked) {
                        // Click the checkbox using its ID
                        await page.evaluate((checkboxId) => {
                            const checkbox = document.getElementById(checkboxId);
                            if (checkbox && !checkbox.checked) {
                                checkbox.click();
                            }
                        }, checkbox.checkboxId);
                    }
                    dynamicVariables[checkboxId] = checkboxes[i].index;
                    if (!dynamicVariables[checkboxId] && checkboxes[i].index > 0) {
                        dynamicVariables[checkboxId]++;
                    }
                    if (dynamicVariables[checkboxId] > 0) {
                        console.log(`Clicked on access level: "${checkbox.text}" (instance ${checkbox.index + 1})`);
                    } else {
                        checkboxClickCount++;
                        console.log(`Clicked on access level: "${checkbox.text}" (instance ${checkbox.index + 1})`);
                    }


                }

            } else {
                let newAccessText = normalizedAccessText;
                if (newAccessText.includes("Affiliate")) {
                    newAccessText = newAccessText.replace("Affiliate", "Referral");
                    const resendText = newAccessText.replace('- ', '');
                    await clickAccessLevel(page, resendText);
                }
                else {
                    const logMessage = `Access level "${normalizedAccessText}" not found.`;
                    skippedCount++;
                    const logFilePath = path.join(__dirname, 'error_msg.txt');
                    fs.appendFile(logFilePath, `${logMessage}\n`, (err) => {
                        if (err) console.error('Error writing to file:', err);
                    });
                }
            }
        } catch (error) {
            const errorMSG = (`Error processing access level`, error);
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
})();
