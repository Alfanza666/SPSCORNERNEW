import fs from 'fs';
const html = fs.readFileSync('postman_html.txt', 'utf8');
console.log(html.substring(0, 2000));
const matches = html.match(/https:\/\/documenter\.getpostman\.com\/api\/collections\/[a-zA-Z0-9-]+/g);
console.log('Matches:', matches);
