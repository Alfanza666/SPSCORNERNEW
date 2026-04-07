import https from 'https';
import fs from 'fs';

https.get('https://documenter.getpostman.com/view/40296808/2sB3WtseBT?version=latest', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    fs.writeFileSync('postman_html.txt', data);
    console.log('Saved HTML');
  });
});
