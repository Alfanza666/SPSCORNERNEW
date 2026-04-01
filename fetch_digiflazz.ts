import axios from 'axios';
import * as cheerio from 'cheerio';

async function fetchDocs(url: string) {
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const links: string[] = [];
    $('.md-nav__link').each((i, el) => {
      links.push($(el).attr('href') || '');
    });
    console.log(links.filter(l => l.includes('/buyer/')).join('\n'));
  } catch (error: any) {
    console.error(error.message);
  }
}

fetchDocs('https://developer.digiflazz.com/api/buyer/persiapan/');
