async function run() {
  const url = `https://developer.digiflazz.com/api/buyer/transaksi/`;
  const res = await fetch(url);
  const text = await res.text();
  const match = text.match(/<article class="md-content__inner md-typeset">([\s\S]*?)<\/article>/);
  if (match) {
    console.log(match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
  }
}
run();
