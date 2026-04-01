async function run() {
  const res = await fetch('https://developer.digiflazz.com/api/buyer/persiapan/');
  const text = await res.text();
  const match = text.match(/<article class="md-content__inner md-typeset">([\s\S]*?)<\/article>/);
  if (match) {
    console.log(match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
  } else {
    console.log('Article not found');
  }
}
run();
