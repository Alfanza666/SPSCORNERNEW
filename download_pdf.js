import https from 'https';
import fs from 'fs';

https.get('https://storage.googleapis.com/ipaymu-docs/ipaymu-api/iPaymu-signature-documentation-v2.pdf', (res) => {
  const file = fs.createWriteStream('signature.pdf');
  res.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log('Downloaded PDF');
  });
});
