const https = require('https');

https.get('https://developer.digiflazz.com/api/buyer/persiapan/', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const match = data.match(/<article class="md-content__inner md-typeset">([\s\S]*?)<\/article>/);
    if (match) {
      console.log(match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
    } else {
      console.log('Article not found');
    }
  });
}).on('error', (err) => {
  console.log('Error: ' + err.message);
});
