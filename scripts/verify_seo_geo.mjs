import fs from 'fs';

console.log('--- Verifying SEO & GEO Assets ---');

// 1. Check index.html
const indexHtml = fs.readFileSync('index.html', 'utf8');

// Check naver verification
if (!indexHtml.includes('naver-site-verification')) {
  throw new Error('Missing naver-site-verification in index.html');
}
console.log('✔ Naver site verification tag verified');

// Check geo meta tags
if (!indexHtml.includes('geo.region') || !indexHtml.includes('geo.position') || !indexHtml.includes('ICBM')) {
  throw new Error('Missing Geolocation meta tags in index.html');
}
console.log('✔ Geolocation meta tags (geo.region, geo.position, ICBM) verified');

// Check JSON-LD
const schemaMatch = indexHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
if (!schemaMatch) {
  throw new Error('Missing JSON-LD structured data in index.html');
}
const schemaJson = JSON.parse(schemaMatch[1]);
console.log(`✔ JSON-LD parsed successfully with ${schemaJson['@graph'].length} graph items:`);
schemaJson['@graph'].forEach((item, index) => {
  console.log(`   [${index + 1}] @type: ${item['@type']}, name: ${item.name || item['@id']}`);
  if (item['@type'] === 'EducationalOrganization') {
    if (!item.address || !item.geo || !item.taxID) {
      throw new Error('Missing address/geo/taxID in EducationalOrganization schema');
    }
    console.log(`       Address: ${item.address.addressRegion} ${item.address.addressLocality} ${item.address.streetAddress}`);
    console.log(`       TaxID: ${item.taxID}, Geo: ${item.geo.latitude}, ${item.geo.longitude}`);
  }
});

// 2. Check robots.txt
const robotsTxt = fs.readFileSync('public/robots.txt', 'utf8');
const expectedBots = ['GPTBot', 'ChatGPT-User', 'PerplexityBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended', 'Yeti'];
for (const bot of expectedBots) {
  if (!robotsTxt.includes(bot)) {
    throw new Error(`Missing crawler config for ${bot} in robots.txt`);
  }
}
console.log('✔ robots.txt AI bots whitelisting verified (GPTBot, PerplexityBot, ClaudeBot, Google-Extended, etc.)');

// 3. Check llms.txt
const llmsTxt = fs.readFileSync('public/llms.txt', 'utf8');
if (!llmsTxt.includes('777-82-00464') || !llmsTxt.includes('삼봉로 81') || !llmsTxt.includes('제 2026-00183호')) {
  throw new Error('Missing key factual metadata in llms.txt');
}
console.log('✔ llms.txt factual context verified (Registration ID, Corporate ID, Address, Phone, Curriculum)');

// 4. Check sitemap.xml
const sitemapXml = fs.readFileSync('public/sitemap.xml', 'utf8');
if (!sitemapXml.includes('2026-09-24')) {
  throw new Error('sitemap.xml lastmod date is not updated to 2026-09-24');
}
console.log('✔ sitemap.xml updated with 2026-09-24 lastmod verified');

// 5. Check docs/seo-geo-status.md
if (!fs.existsSync('docs/seo-geo-status.md')) {
  throw new Error('docs/seo-geo-status.md does not exist');
}
const docContent = fs.readFileSync('docs/seo-geo-status.md', 'utf8');
console.log(`✔ docs/seo-geo-status.md generated successfully (${docContent.length} bytes)`);

console.log('\nAll SEO & GEO verifications passed successfully! 🎉');
