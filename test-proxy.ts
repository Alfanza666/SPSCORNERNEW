import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

const proxyUrl = 'http://fixie:aSlWuYmYcIk2nlc@criterium.usefixie.com:80';
const agent = new HttpsProxyAgent(proxyUrl);

axios.get('https://my.ipaymu.com', { httpsAgent: agent, proxy: false })
  .then(res => console.log('Success, Status:', res.status))
  .catch(err => {
    if (err.response) {
       console.log('Error Status:', err.response.status);
       console.log('Error Data:', err.response.data);
    } else {
       console.log('Error:', err.message);
    }
  });
