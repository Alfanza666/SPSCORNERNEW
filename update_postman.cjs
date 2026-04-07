const fs = require('fs');

const collectionPath = 'postman_collection.json';
const collection = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));

const scriptLines = [
    "const apikey = pm.variables.get('apiKey') || pm.environment.get('apiKey');",
    "const va = pm.variables.get('va') || pm.environment.get('va');",
    "",
    "const moment = require('moment');",
    "const timestamp = moment().format('YYYYMMDDHHmmss');",
    "pm.request.headers.upsert({ key: 'timestamp', value: timestamp });",
    "",
    "let reqBody = {};",
    "",
    "if (pm.request.body) {",
    "    if (pm.request.body.mode === 'raw') {",
    "        try {",
    "            reqBody = JSON.parse(pm.request.body.raw);",
    "        } catch (e) {",
    "            console.log(\"Error parsing raw JSON body\");",
    "        }",
    "    } else if (pm.request.body.mode === 'formdata') {",
    "        pm.request.body.formdata.each(param => {",
    "            if (!param.disabled) {",
    "                let key = param.key;",
    "                if (key.endsWith('[]')) {",
    "                    key = key.substring(0, key.length - 2);",
    "                    if (!reqBody[key]) reqBody[key] = [];",
    "                    reqBody[key].push(param.value);",
    "                } else {",
    "                    reqBody[key] = param.value;",
    "                }",
    "            }",
    "        });",
    "        ",
    "        pm.request.body.update({",
    "            mode: 'raw',",
    "            raw: JSON.stringify(reqBody)",
    "        });",
    "        pm.request.headers.upsert({ key: 'Content-Type', value: 'application/json' });",
    "    }",
    "}",
    "",
    "const reqJson = JSON.stringify(reqBody);",
    "",
    "const CryptoJS = require('crypto-js');",
    "const bodyEncrypt = CryptoJS.SHA256(reqJson).toString(CryptoJS.enc.Hex).toLowerCase();",
    "const stringtosign = pm.request.method + \":\" + va + \":\" + bodyEncrypt + \":\" + apikey;",
    "const signature = CryptoJS.HmacSHA256(stringtosign, apikey).toString(CryptoJS.enc.Hex);",
    "",
    "pm.request.headers.upsert({ key: 'signature', value: signature });",
    "",
    "console.log(`request: ${reqJson}`);",
    "console.log(`stringToSign: ${stringtosign}`);",
    "console.log(`signature: ${signature}`);"
];

function updateRequest(items) {
    for (let item of items) {
        if (item.name === 'Direct Payment' && item.id === '005ef6ea-96e4-47f7-9282-afd1ce5a2904') {
            if (item.event) {
                for (let event of item.event) {
                    if (event.listen === 'prerequest') {
                        event.script.exec = scriptLines;
                        return true;
                    }
                }
            }
        }
        if (item.item) {
            if (updateRequest(item.item)) return true;
        }
    }
    return false;
}

updateRequest(collection.item);

fs.writeFileSync(collectionPath, JSON.stringify(collection, null, 2));
console.log('Updated postman_collection.json');
