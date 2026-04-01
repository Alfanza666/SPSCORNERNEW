async function run() {
  const pages = [
    'deposit',
    'cek-tagihan',
    'cek-status'
  ];
  
  for (const page of pages) {
    const url = `https://developer.digiflazz.com/api/buyer/${page}/`;
    const res = await fetch(url);
    const text = await res.text();
    const match = text.match(/<article class="md-content__inner md-typeset">([\s\S]*?)<\/article>/);
    if (match) {
      console.log(`\n\n--- PAGE: ${page} ---`);
      console.log(match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
    }
  }
}
run();
