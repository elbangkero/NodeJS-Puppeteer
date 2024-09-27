const puppeteer = require('puppeteer');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

(async () => {
    const wsChromeEndpointurl = 'ws://127.0.0.1:9222/devtools/browser/9139de66-d626-438a-bbca-aeb0d13caa84';
    const browser = await puppeteer.connect({
        browserWSEndpoint: wsChromeEndpointurl,
        args: ['--window-size=1920,1080'],
        defaultViewport: null
    });

    const page = await browser.newPage();
    let pageUrl = 'https://manage.lchvietnam.com/management/group/add-group';

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
            .on('end', () => {
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

                // Process menu items
                validMenus.forEach((item, index) => {
                    setTimeout(async () => {
                        await clickMenuItem(page, item);
                    }, index * interval);
                });

                // Process access levels and count checkbox clicks
                validAccessLevels.forEach((item, index) => {
                    setTimeout(async () => {
                        await clickAccessLevel(page, item);
                    }, (index + validMenus.length) * interval);
                });

                // After all processes finish, log the total counts
                setTimeout(() => {
                    const total_counts = menuClickCount + checkboxClickCount; 
                    console.log(`Total checkbox clicks: ${total_counts}`);
                }, (validMenus.length + validAccessLevels.length) * interval + 1000);
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
            const element = await page.evaluateHandle((text) => {
                return Array.from(document.querySelectorAll('tr')).find(tr =>
                    tr.querySelector('td') && tr.querySelector('td').textContent.includes(text)
                );
            }, accessText);

            if (element) {
                await element.hover();
                const checkbox = await element.$('input[type="checkbox"]');
                if (checkbox) {
                    const isChecked = await page.evaluate((checkbox) => checkbox.checked, checkbox);
                    if (!isChecked) {
                        await checkbox.click(); // Click the checkbox if not checked
                        checkboxClickCount++; // Increment click counter
                        console.log(`Clicked on access level: ${accessText}`);
                    } else {
                        console.log(`Access level "${accessText}" is already checked, skipping.`);
                    }
                    // Mark this access level as checked in the Map
                    checkedAccessLevels.set(accessText, isChecked || true); // Set to true if already checked
                } else {
                    console.log(`Checkbox not found for access level "${accessText}".`);
                }
            } else {
                console.log(`Access level "${accessText}" not found.`);
            }
        } catch (error) {
            const errorMSG = `Access level '${accessText}' not found`;
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
