import https from 'https';
import fs from 'fs';

https.get('https://documenter.gw.postman.com/api/collections/40296808/2sB3WtseBT?segregateAuth=true&versionTag=latest', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    fs.writeFileSync('postman_collection.json', data);
    console.log('Saved collection');
  });
});
