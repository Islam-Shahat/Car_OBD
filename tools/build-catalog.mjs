/**
 * Builds src/data/vehicle-catalog.json.
 *
 * Appendix C is not present in this repository or its history, so this is the
 * documented knowledge-based fallback: 33 makes / ~245 models for the Arab
 * market, every row `verified = 0` and `sourceTier = "knowledge"`. No year
 * ranges are invented; they stay null until a person checks them.
 *
 * Ids are derived from make_slug + model, so rebuilding the catalog never
 * orphans a vehicles.catalog_id.
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outputPath = join(here, '..', 'src', 'data', 'vehicle-catalog.json');
const VERSION = '2026-11-14.1';
const DOWNLOADED_AT = '2026-11-14';

/** make | makeSlug | model | Arabic aliases (comma separated) | English aliases | body */
const TABLE = `
Toyota|toyota|Corolla|كورولا||sedan
Toyota|toyota|Camry|كامري||sedan
Toyota|toyota|Yaris|ياريس||hatchback
Toyota|toyota|Hilux|هايلكس||pickup
Toyota|toyota|Fortuner|فورتشنر||suv
Toyota|toyota|Land Cruiser|لاند كروزر,لاندكروزر|LandCruiser|suv
Toyota|toyota|Land Cruiser Prado|برادو,لاند كروزر برادو|Prado|suv
Toyota|toyota|RAV4|راف فور,راف4|RAV-4|suv
Toyota|toyota|Avalon|أفالون||sedan
Toyota|toyota|Hiace|هايس,هايس فان||van
Nissan|nissan|Sunny|صني||sedan
Nissan|nissan|Sentra|سنترا||sedan
Nissan|nissan|Altima|التيما||sedan
Nissan|nissan|Tiida|تيدا||hatchback
Nissan|nissan|X-Trail|إكس تريل,اكس تريل|XTrail|suv
Nissan|nissan|Patrol|باترول||suv
Nissan|nissan|Kicks|كيكس||suv
Nissan|nissan|Pathfinder|باثفايندر||suv
Nissan|nissan|Urvan|أورفان,اورفان||van
Nissan|nissan|Navara|نافارا||pickup
Hyundai|hyundai|Elantra|إلنترا,النترا||sedan
Hyundai|hyundai|Accent|أكسنت,اكسنت||sedan
Hyundai|hyundai|Verna|فيرنا||sedan
Hyundai|hyundai|Sonata|سوناتا||sedan
Hyundai|hyundai|Tucson|توسان||suv
Hyundai|hyundai|Creta|كريتا||suv
Hyundai|hyundai|Santa Fe|سانتافي,سانتا في|SantaFe|suv
Hyundai|hyundai|i10|آي 10,اي 10|i-10|hatchback
Hyundai|hyundai|H1|إتش 1,اتش 1|H-1|van
Hyundai|hyundai|Azera|أزيرا,ازيرا||sedan
Kia|kia|Cerato|سيراتو||sedan
Kia|kia|Rio|ريو||hatchback
Kia|kia|Sportage|سبورتاج||suv
Kia|kia|Sorento|سورينتو||suv
Kia|kia|Picanto|بيكانتو||hatchback
Kia|kia|Optima|أوبتيما,اوبتيما||sedan
Kia|kia|Carens|كارينز||van
Kia|kia|Seltos|سيلتوس||suv
Kia|kia|Carnival|كارنفال||van
Kia|kia|Pegas|بيجاس||sedan
Chevrolet|chevrolet|Optra|أوبترا,اوبترا||sedan
Chevrolet|chevrolet|Aveo|أفيو,افيو||sedan
Chevrolet|chevrolet|Cruze|كروز||sedan
Chevrolet|chevrolet|Captiva|كابتيفا||suv
Chevrolet|chevrolet|Tahoe|تاهو||suv
Chevrolet|chevrolet|Malibu|ماليبو||sedan
Chevrolet|chevrolet|Spark|سبارك||hatchback
Chevrolet|chevrolet|Silverado|سيلفرادو||pickup
Chevrolet|chevrolet|Trax|تراكس||suv
Chevrolet|chevrolet|Trailblazer|تريل بليزر|TrailBlazer|suv
Ford|ford|Focus|فوكس||sedan
Ford|ford|Fiesta|فييستا||hatchback
Ford|ford|Escape|إسكيب,اسكيب||suv
Ford|ford|Explorer|إكسبلورر,اكسبلورر||suv
Ford|ford|F-150|إف 150,اف 150|F150|pickup
Ford|ford|Edge|إيدج,ايدج||suv
Ford|ford|Taurus|تورس||sedan
Ford|ford|Ranger|رينجر||pickup
Ford|ford|Transit|ترانزيت||van
Ford|ford|Territory|تيريتوري||suv
Honda|honda|Civic|سيفيك||sedan
Honda|honda|Accord|أكورد,اكورد||sedan
Honda|honda|City|سيتي||sedan
Honda|honda|CR-V|سي آر في|CRV|suv
Honda|honda|HR-V|إتش آر في,اتش ار في|HRV|suv
Honda|honda|Pilot|بايلوت||suv
Honda|honda|Jazz|جاز||hatchback
Honda|honda|Odyssey|أوديسي,اوديسي||van
Honda|honda|BR-V|بي آر في|BRV|suv
Honda|honda|ZR-V|زد آر في|ZRV|suv
Mitsubishi|mitsubishi|Lancer|لانسر||sedan
Mitsubishi|mitsubishi|Pajero|باجيرو||suv
Mitsubishi|mitsubishi|Pajero Sport|باجيرو سبورت|PajeroSport|suv
Mitsubishi|mitsubishi|Outlander|أوتلاندر,اوتلاندر||suv
Mitsubishi|mitsubishi|Attrage|أتراج,اتراج||sedan
Mitsubishi|mitsubishi|ASX|إيه إس إكس,اي اس اكس||suv
Mitsubishi|mitsubishi|Eclipse Cross|إكليبس كروس,اكليبس كروس|EclipseCross|suv
Mitsubishi|mitsubishi|L200|إل 200,ال 200|L-200|pickup
Mitsubishi|mitsubishi|Montero Sport|مونتيرو سبورت|MonteroSport|suv
Mitsubishi|mitsubishi|Xpander|إكسباندر,اكسباندر||suv
Mazda|mazda|Mazda 2|مازدا 2|Mazda2|hatchback
Mazda|mazda|Mazda 3|مازدا 3|Mazda3|sedan
Mazda|mazda|Mazda 6|مازدا 6|Mazda6|sedan
Mazda|mazda|CX-3|سي إكس 3|CX3|suv
Mazda|mazda|CX-5|سي إكس 5|CX5|suv
Mazda|mazda|CX-9|سي إكس 9|CX9|suv
Mazda|mazda|CX-30|سي إكس 30|CX30|suv
Mazda|mazda|BT-50|بي تي 50|BT50|pickup
Mazda|mazda|MX-5|إم إكس 5|MX5|convertible
Suzuki|suzuki|Swift|سويفت||hatchback
Suzuki|suzuki|Dzire|دزاير||sedan
Suzuki|suzuki|Vitara|فيتارا||suv
Suzuki|suzuki|Jimny|جيمني||suv
Suzuki|suzuki|SX4|إس إكس 4|SX-4|sedan
Suzuki|suzuki|Ertiga|إرتيجا,ارتيجا||van
Suzuki|suzuki|Ciaz|سياز||sedan
Suzuki|suzuki|Baleno|بالينو||hatchback
Suzuki|suzuki|Celerio|سيليريو||hatchback
Renault|renault|Logan|لوجان||sedan
Renault|renault|Duster|داستر||suv
Renault|renault|Megane|ميجان||sedan
Renault|renault|Symbol|سيمبول||sedan
Renault|renault|Captur|كابتور||suv
Renault|renault|Koleos|كوليوس||suv
Renault|renault|Sandero|سانديرو||hatchback
Renault|renault|Trafic|ترافيك||van
Renault|renault|Arkana|أركانا,اركانا||suv
Peugeot|peugeot|301|301||sedan
Peugeot|peugeot|308|308||hatchback
Peugeot|peugeot|3008|3008||suv
Peugeot|peugeot|508|508||sedan
Peugeot|peugeot|2008|2008||suv
Peugeot|peugeot|5008|5008||suv
Peugeot|peugeot|208|208||hatchback
Peugeot|peugeot|Partner|بارتنر||van
Peugeot|peugeot|Traveller|ترافيلر||van
Fiat|fiat|Tipo|تيبو||sedan
Fiat|fiat|Punto|بونتو||hatchback
Fiat|fiat|500|500||hatchback
Fiat|fiat|Doblo|دوبلو||van
Fiat|fiat|Panda|باندا||hatchback
Fiat|fiat|Bravo|برافو||hatchback
Fiat|fiat|Linea|لينيا||sedan
Fiat|fiat|Scudo|سكودو||van
Fiat|fiat|Ducato|دوكاتو||van
Opel|opel|Astra|أسترا,استرا||hatchback
Opel|opel|Corsa|كورسا||hatchback
Opel|opel|Insignia|إنسيجنيا,انسيجنيا||sedan
Opel|opel|Mokka|موكا||suv
Opel|opel|Vectra|فيكترا||sedan
Opel|opel|Zafira|زافيرا||van
Opel|opel|Crossland|كروسلاند||suv
Opel|opel|Movano|موفانو||van
Opel|opel|Grandland|جراندلاند||suv
Volkswagen|volkswagen|Golf|جولف||hatchback
Volkswagen|volkswagen|Passat|باسات||sedan
Volkswagen|volkswagen|Jetta|جيتا||sedan
Volkswagen|volkswagen|Tiguan|تيجوان||suv
Volkswagen|volkswagen|Touareg|طوارق||suv
Volkswagen|volkswagen|Polo|بولو||hatchback
Volkswagen|volkswagen|Teramont|تيرامونت||suv
Volkswagen|volkswagen|Caddy|كادي||van
Volkswagen|volkswagen|ID.4|آي دي 4,اي دي 4|ID4|suv
Skoda|skoda|Octavia|أوكتافيا,اوكتافيا||sedan
Skoda|skoda|Superb|سوبيرب||sedan
Skoda|skoda|Kodiaq|كودياك||suv
Skoda|skoda|Fabia|فابيا||hatchback
Skoda|skoda|Karoq|كاروك||suv
Skoda|skoda|Rapid|رابيد||sedan
Skoda|skoda|Scala|سكالا||hatchback
Skoda|skoda|Kamiq|كاميك||suv
BMW|bmw|3 Series|الفئة الثالثة|3Series|sedan
BMW|bmw|5 Series|الفئة الخامسة|5Series|sedan
BMW|bmw|7 Series|الفئة السابعة|7Series|sedan
BMW|bmw|X1|إكس 1,اكس 1|X-1|suv
BMW|bmw|X2|إكس 2,اكس 2|X-2|suv
BMW|bmw|X3|إكس 3,اكس 3|X-3|suv
BMW|bmw|X5|إكس 5,اكس 5|X-5|suv
BMW|bmw|X6|إكس 6,اكس 6|X-6|suv
BMW|bmw|iX|آي إكس,اي اكس||suv
Mercedes-Benz|mercedes-benz|C-Class|الفئة C,سي كلاس|CClass|sedan
Mercedes-Benz|mercedes-benz|E-Class|الفئة E,إي كلاس|EClass|sedan
Mercedes-Benz|mercedes-benz|S-Class|الفئة S,إس كلاس|SClass|sedan
Mercedes-Benz|mercedes-benz|GLA|جي إل إيه|GLA-Class|suv
Mercedes-Benz|mercedes-benz|GLC|جي إل سي|GLC-Class|suv
Mercedes-Benz|mercedes-benz|GLE|جي إل إي|GLE-Class|suv
Mercedes-Benz|mercedes-benz|GLS|جي إل إس|GLS-Class|suv
Mercedes-Benz|mercedes-benz|Sprinter|سبرينتر||van
Mercedes-Benz|mercedes-benz|V-Class|الفئة V|VClass|van
Audi|audi|A3|إيه 3,اي 3|A-3|hatchback
Audi|audi|A4|إيه 4,اي 4|A-4|sedan
Audi|audi|A6|إيه 6,اي 6|A-6|sedan
Audi|audi|A8|إيه 8,اي 8|A-8|sedan
Audi|audi|Q3|كيو 3|Q-3|suv
Audi|audi|Q5|كيو 5|Q-5|suv
Audi|audi|Q7|كيو 7|Q-7|suv
Chery|chery|Tiggo 2|تيجو 2|Tiggo2|suv
Chery|chery|Tiggo 3|تيجو 3|Tiggo3|suv
Chery|chery|Tiggo 4|تيجو 4|Tiggo4|suv
Chery|chery|Tiggo 7|تيجو 7|Tiggo7|suv
Chery|chery|Tiggo 8|تيجو 8|Tiggo8|suv
Chery|chery|Arrizo 5|أريزو 5,اريزو 5|Arrizo5|sedan
Chery|chery|Arrizo 6|أريزو 6,اريزو 6|Arrizo6|sedan
Chery|chery|QQ|كيو كيو||hatchback
Geely|geely|Emgrand 7|إمجراند 7,امجراند 7|Emgrand7|sedan
Geely|geely|Emgrand 8|إمجراند 8,امجراند 8|Emgrand8|sedan
Geely|geely|Emgrand X7|إمجراند إكس 7,امجراند اكس 7|EmgrandX7|suv
Geely|geely|Coolray|كولراي||suv
Geely|geely|Tugella|توجيلا||suv
Geely|geely|Atlas|أطلس,اطلس||suv
Geely|geely|GS|جي إس,جي اس||hatchback
MG|mg|MG3|إم جي 3,ام جي 3|MG-3|hatchback
MG|mg|MG5|إم جي 5,ام جي 5|MG-5|sedan
MG|mg|MG6|إم جي 6,ام جي 6|MG-6|sedan
MG|mg|ZS|زد إس,زد اس||suv
MG|mg|HS|إتش إس,اتش اس||suv
MG|mg|RX5|آر إكس 5,ار اكس 5|RX-5|suv
MG|mg|GT|جي تي||sedan
BYD|byd|F3|إف 3,اف 3|F-3|sedan
BYD|byd|S6|إس 6,اس 6|S-6|suv
BYD|byd|Song Plus|سونج بلس|SongPlus|suv
BYD|byd|Qin Plus|تشين بلس|QinPlus|sedan
BYD|byd|Tang|تانج||suv
BYD|byd|Dolphin|دولفين||hatchback
BYD|byd|Atto 3|أتو 3,اتو 3|Atto3|suv
Changan|changan|Eado|إيدو,ايدو||sedan
Changan|changan|Alsvin|ألسفين,السفين||sedan
Changan|changan|CS15|سي إس 15|CS-15|suv
Changan|changan|CS35|سي إس 35|CS-35|suv
Changan|changan|CS75|سي إس 75|CS-75|suv
Changan|changan|CS95|سي إس 95|CS-95|suv
Changan|changan|Hunter|هانتر||pickup
Great Wall|great-wall|Wingle 5|وينجل 5|Wingle5|pickup
Great Wall|great-wall|Wingle 7|وينجل 7|Wingle7|pickup
Great Wall|great-wall|Poer|بور||pickup
Great Wall|great-wall|C30|سي 30|C-30|sedan
Great Wall|great-wall|Steed|ستيد||pickup
Great Wall|great-wall|Tank 300|تانك 300|Tank300|suv
Haval|haval|H2|إتش 2,اتش 2|H-2|suv
Haval|haval|H5|إتش 5,اتش 5|H-5|suv
Haval|haval|H6|إتش 6,اتش 6|H-6|suv
Haval|haval|H9|إتش 9,اتش 9|H-9|suv
Haval|haval|Jolion|جوليان||suv
Haval|haval|Dargo|دارجو||suv
Daewoo|daewoo|Lanos|لانوس||sedan
Daewoo|daewoo|Nubira|نوبيرا||sedan
Daewoo|daewoo|Leganza|ليجانزا||sedan
Daewoo|daewoo|Matiz|ماتيز||hatchback
Daewoo|daewoo|Espero|إسبيرو,اسبيرو||sedan
Lada|lada|Niva|نيفا||suv
Lada|lada|Granta|جرانتا||sedan
Lada|lada|Vesta|فيستا||sedan
Lada|lada|Priora|بريورا||sedan
Lada|lada|Kalina|كالينا||hatchback
Dacia|dacia|Logan|لوجان||sedan
Dacia|dacia|Sandero|سانديرو||hatchback
Dacia|dacia|Duster|داستر||suv
Dacia|dacia|Dokker|دوكر||van
Dacia|dacia|Lodgy|لودجي||van
Citroen|citroen|C1|سي 1|C-1|hatchback
Citroen|citroen|C3|سي 3|C-3|hatchback
Citroen|citroen|C4|سي 4|C-4|sedan
Citroen|citroen|C5|سي 5|C-5|sedan
Citroen|citroen|Berlingo|بيرلينجو||van
Citroen|citroen|C-Elysee|سي إليسي|CElysee|sedan
Jeep|jeep|Cherokee|شيروكي||suv
Jeep|jeep|Grand Cherokee|جراند شيروكي|GrandCherokee|suv
Jeep|jeep|Wrangler|رانجلر||suv
Jeep|jeep|Compass|كومباس||suv
Jeep|jeep|Renegade|رينيجيد||suv
Jeep|jeep|Liberty|ليبرتي||suv
Dodge|dodge|Charger|تشارجر||sedan
Dodge|dodge|Challenger|تشالنجر||coupe
Dodge|dodge|Durango|دورانجو||suv
Dodge|dodge|Journey|جورني||suv
Chrysler|chrysler|300|300||sedan
Chrysler|chrysler|Sebring|سبرينج||sedan
Chrysler|chrysler|PT Cruiser|بي تي كروزر|PTCruiser|wagon
Chrysler|chrysler|Town & Country|تاون اند كونتري|TownCountry|van
`.trim();

function uuidFor(key) {
  const hex = createHash('sha256').update(key).digest('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join('-');
}

const entries = TABLE.split('\n').map((line) => {
  const [make, makeSlug, model, aliasesAr, aliasesEn, bodyType] = line.split('|');
  const id = uuidFor(`${makeSlug}:${model}`);
  return {
    id,
    make,
    makeSlug,
    model,
    aliasesAr: aliasesAr ? aliasesAr.split(',') : [],
    aliasesEn: aliasesEn ? aliasesEn.split(',') : [],
    yearFrom: null,
    yearTo: null,
    bodyType: bodyType || null,
    sourceTier: 'knowledge',
    verified: false,
  };
});

const makes = new Set(entries.map((entry) => entry.makeSlug));
if (makes.size !== 33) throw new Error(`Expected 33 makes, built ${makes.size}`);
if (new Set(entries.map((entry) => entry.id)).size !== entries.length) {
  throw new Error('Duplicate catalog ids');
}

writeFileSync(
  outputPath,
  `${JSON.stringify({ version: VERSION, downloadedAt: DOWNLOADED_AT, entries }, null, 2)}\n`,
  'utf8',
);
console.log(`Wrote ${outputPath}`);
console.log(`${entries.length} models across ${makes.size} makes`);
