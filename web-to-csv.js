const puppeteer = require('puppeteer');
const fs = require('fs');
const csv = require('csv-writer');
const path = require('path');
const { group, groupCollapsed } = require('console');

(async () => {

    try {
        const wsChromeEndpointUrl = 'ws://127.0.0.1:9222/devtools/browser/99ea9a40-94fd-48bd-9ba3-c1721d40d8fb';
        const browser = await puppeteer.connect({
            browserWSEndpoint: wsChromeEndpointUrl,
            args: ['--window-size=1920,1080'],
            defaultViewport: null
        });

        const page = await browser.newPage();
        const pageUrl = 'https://manage.hllucky99.com/management/group';

        await page.goto(pageUrl, {
            waitUntil: 'networkidle0',
        });

        // Confirmation prompt
        const group_name = await confirmPrompt('Enter group name: ');
        if (!group_name) {
            console.log('Automation cancelled.');
            await browser.disconnect();
            return;
        }

        const csvWriter = csv.createObjectCsvWriter({
            path: `Generated-CSV/${group_name}-exported-permission.csv`,
            encoding: 'utf8',
            header: [
                { id: 'permission', title: 'Permission' },
                { id: 'admin', title: group_name }
            ]
        });

        const validatedCheckboxes = await validateCheckboxes(page);

        // Sanitize data
        const sanitizedData = validatedCheckboxes.map((checkbox) => ({
            permission: checkbox.permission.replace(/[^a-zA-Z0-9\s]/g, ''),
            admin: checkbox.admin,
        }));

        await csvWriter.writeRecords(sanitizedData);

        console.log('CSV file generated successfully!');
        extractAgain(page);
        //await browser.disconnect();
    } catch (error) {
        console.error('Error occurred:', error);
    }
})();


async function extractAgain(page) {

    // Confirmation prompt
    const group_name = await confirmPrompt('Enter group name: ');
    if (!group_name) {
        console.log('Automation cancelled.');
        await browser.disconnect();
        return;
    }

    const csvWriter = csv.createObjectCsvWriter({
        path: `Generated-CSV/${group_name}-exported-permission.csv`,
        encoding: 'utf8',
        header: [
            { id: 'permission', title: 'Permission' },
            { id: 'admin', title: group_name }
        ]
    });

    const validatedCheckboxes = await validateCheckboxes(page);

    // Sanitize data
    const sanitizedData = validatedCheckboxes.map((checkbox) => ({
        permission: checkbox.permission.replace(/[^a-zA-Z0-9\s]/g, ''),
        admin: checkbox.admin,
    }));

    await csvWriter.writeRecords(sanitizedData);

    console.log('CSV file generated successfully!');
    extractAgain(page);
}

async function confirmPrompt(question) {
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        readline.question(question, (answer) => {
            readline.close();
            resolve(answer);
        });
    });
}

async function validateCheckboxes(page) {
    try {
        const validatedCheckboxes = [];

        // Get all table rows
        const rows = await page.$$eval('tr', (rows) =>
            rows.map((row) => {
                const menuTd = row.querySelector('td.pl-3');
                const menu = menuTd ? menuTd.textContent.trim() : '';
                const permissionTd = row.querySelector('td.pl-5');
                const permission = permissionTd ? permissionTd.textContent.trim() : '';
                const checkbox = row.querySelector('input[type="checkbox"]');
                const checked = checkbox ? checkbox.checked : false;

                return { menu, permission, checked };
            }),
        );

        // Filter checked checkboxes
        const checkedCheckboxes = rows.filter((row) => row.checked);

        // Process checked checkboxes
        for (const checkbox of checkedCheckboxes) {
            const text = checkbox.menu || checkbox.permission;
            const admin = 'TRUE'; // Assuming admin is always TRUE for checked checkboxes

            validatedCheckboxes.push({ permission: text, admin });
        }

        return validatedCheckboxes;
    } catch (error) {
        console.error('Error validating checkboxes:', error);
        return [];
    }
}