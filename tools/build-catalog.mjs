/**
 * Builds src/data/vehicle-catalog.json.
 *
 * Reconciled with Appendix C: initial vehicle catalog (about 245 models, 33 makes),
 * plus models preserved from general market knowledge and WMI coverage (46 makes total).
 *
 * Source tier:
 * - 'cited' for models found in Egyptian sales / used-market reports (column 2 of Appendix C)
 * - 'knowledge' for models from general market knowledge (column 3 of Appendix C, plus WMI makes)
 *
 * Every row keeps verified = 0. No year ranges are invented (they stay null).
 * Every make that src/data/wmi.json can decode has at least one model here.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outputPath = join(here, '..', 'src', 'data', 'vehicle-catalog.json');
const VERSION = '2026-11-15.appendix-c';
const DOWNLOADED_AT = '2026-11-15';

/**
 * Additional Arabic make spellings, keyed by make slug.
 */
const MAKE_ALIASES_AR = {
  toyota: ['تويوتا', 'تيوتا'],
  hyundai: ['هيونداي', 'هونداي', 'هيوندي'],
  nissan: ['نيسان', 'نسان'],
  chevrolet: ['شيفروليه', 'شيفرولية', 'شيفرولت', 'دايو'],
  kia: ['كيا'],
  daihatsu: ['دايهاتسو'],
  isuzu: ['إيسوزو', 'ايسوزو'],
  porsche: ['بورش'],
  ssangyong: ['سانج يونج', 'سانغ يونغ'],
  subaru: ['سوبارو'],
  tesla: ['تسلا'],
  volvo: ['فولفو'],
  seat: ['سيات'],
  proton: ['بروتون'],
  jetour: ['جيتور'],
  baic: ['بايك'],
  chery: ['شيري'],
  mg: ['إم جي', 'ام جي'],
  changan: ['شانجان'],
  haval: ['هافال'],
  byd: ['بي واي دي'],
  geely: ['جيلي'],
  soueast: ['ساوايست', 'سويست'],
  zeekr: ['زيكر'],
};

/** make | makeSlug | model | Arabic aliases | English aliases | body | sourceTier */
const TABLE = `
Toyota|toyota|Corolla|كورولا||sedan|cited
Toyota|toyota|Camry|كامري||sedan|knowledge
Toyota|toyota|Yaris|ياريس||hatchback|cited
Toyota|toyota|Hilux|هايلكس||pickup|knowledge
Toyota|toyota|Fortuner|فورتشنر||suv|knowledge
Toyota|toyota|Land Cruiser|لاند كروزر,لاندكروزر|LandCruiser|suv|knowledge
Toyota|toyota|Land Cruiser Prado|برادو,لاند كروزر برادو|Prado|suv|knowledge
Toyota|toyota|RAV4|راف فور,راف4|RAV-4|suv|knowledge
Toyota|toyota|Avalon|أفالون||sedan|knowledge
Toyota|toyota|Hiace|هايس,هايس فان||van|knowledge
Nissan|nissan|Sunny|صني,صنى||sedan|cited
Nissan|nissan|Sentra|سنترا||sedan|cited
Nissan|nissan|Altima|التيما||sedan|knowledge
Nissan|nissan|Tiida|تيدا||hatchback|knowledge
Nissan|nissan|X-Trail|إكس تريل,اكس تريل|XTrail|suv|knowledge
Nissan|nissan|Patrol|باترول||suv|cited
Nissan|nissan|Kicks|كيكس||suv|knowledge
Nissan|nissan|Pathfinder|باثفايندر||suv|knowledge
Nissan|nissan|Urvan|أورفان,اورفان||van|knowledge
Nissan|nissan|Navara|نافارا||pickup|knowledge
Hyundai|hyundai|Elantra|إلنترا,النترا||sedan|cited
Hyundai|hyundai|Accent|أكسنت,اكسنت||sedan|cited
Hyundai|hyundai|Verna|فيرنا||sedan|cited
Hyundai|hyundai|Sonata|سوناتا||sedan|knowledge
Hyundai|hyundai|Tucson|توسان||suv|cited
Hyundai|hyundai|Creta|كريتا||suv|knowledge
Hyundai|hyundai|Santa Fe|سانتافي,سانتا في|SantaFe|suv|knowledge
Hyundai|hyundai|i10|آي 10,اي 10|i-10|hatchback|cited
Hyundai|hyundai|H1|إتش 1,اتش 1|H-1|van|knowledge
Hyundai|hyundai|Azera|أزيرا,ازيرا||sedan|knowledge
Kia|kia|Cerato|سيراتو||sedan|cited
Kia|kia|Rio|ريو||hatchback|cited
Kia|kia|Sportage|سبورتاج||suv|cited
Kia|kia|Sorento|سورينتو||suv|knowledge
Kia|kia|Picanto|بيكانتو||hatchback|cited
Kia|kia|Optima|أوبتيما,اوبتيما||sedan|knowledge
Kia|kia|Carens|كارينز||van|knowledge
Kia|kia|Seltos|سيلتوس||suv|knowledge
Kia|kia|Carnival|كارنفال||van|knowledge
Kia|kia|Pegas|بيجاس||sedan|knowledge
Chevrolet|chevrolet|Optra|أوبترا,اوبترا||sedan|cited
Chevrolet|chevrolet|Aveo|أفيو,افيو||sedan|cited
Chevrolet|chevrolet|Cruze|كروز||sedan|knowledge
Chevrolet|chevrolet|Captiva|كابتيفا||suv|knowledge
Chevrolet|chevrolet|Tahoe|تاهو||suv|knowledge
Chevrolet|chevrolet|Malibu|ماليبو||sedan|knowledge
Chevrolet|chevrolet|Spark|سبارك||hatchback|knowledge
Chevrolet|chevrolet|Silverado|سيلفرادو||pickup|knowledge
Chevrolet|chevrolet|Trax|تراكس||suv|knowledge
Chevrolet|chevrolet|Trailblazer|تريل بليزر|TrailBlazer|suv|knowledge
Ford|ford|Focus|فوكس||sedan|cited
Ford|ford|Fiesta|فييستا||hatchback|knowledge
Ford|ford|Escape|إسكيب,اسكيب||suv|knowledge
Ford|ford|Explorer|إكسبلورر,اكسبلورر||suv|knowledge
Ford|ford|F-150|إف 150,اف 150|F150|pickup|knowledge
Ford|ford|Edge|إيدج,ايدج||suv|knowledge
Ford|ford|Taurus|تورس||sedan|knowledge
Ford|ford|Ranger|رينجر||pickup|knowledge
Ford|ford|Transit|ترانزيت||van|knowledge
Ford|ford|Territory|تيريتوري||suv|knowledge
Honda|honda|Civic|سيفيك||sedan|knowledge
Honda|honda|Accord|أكورد,اكورد||sedan|knowledge
Honda|honda|City|سيتي||sedan|knowledge
Honda|honda|CR-V|سي آر في|CRV|suv|knowledge
Honda|honda|HR-V|إتش آر في,اتش ار في|HRV|suv|knowledge
Honda|honda|Pilot|بايلوت||suv|knowledge
Honda|honda|Jazz|جاز||hatchback|knowledge
Honda|honda|Odyssey|أوديسي,اوديسي||van|knowledge
Honda|honda|BR-V|بي آر في|BRV|suv|knowledge
Honda|honda|ZR-V|زد آر في|ZRV|suv|knowledge
Mitsubishi|mitsubishi|Lancer|لانسر||sedan|cited
Mitsubishi|mitsubishi|Pajero|باجيرو||suv|knowledge
Mitsubishi|mitsubishi|Pajero Sport|باجيرو سبورت|PajeroSport|suv|knowledge
Mitsubishi|mitsubishi|Outlander|أوتلاندر,اوتلاندر||suv|knowledge
Mitsubishi|mitsubishi|Attrage|أتراج,اتراج||sedan|knowledge
Mitsubishi|mitsubishi|ASX|إيه إس إكس,اي اس اكس||suv|knowledge
Mitsubishi|mitsubishi|Eclipse Cross|إكليبس كروس,اكليبس كروس|EclipseCross|suv|knowledge
Mitsubishi|mitsubishi|L200|إل 200,ال 200|L-200|pickup|knowledge
Mitsubishi|mitsubishi|Montero Sport|مونتيرو سبورت|MonteroSport|suv|knowledge
Mitsubishi|mitsubishi|Xpander|إكسباندر,اكسباندر||suv|knowledge
Mazda|mazda|Mazda 2|مازدا 2|Mazda2|hatchback|knowledge
Mazda|mazda|Mazda 3|مازدا 3|Mazda3|sedan|knowledge
Mazda|mazda|Mazda 6|مازدا 6|Mazda6|sedan|knowledge
Mazda|mazda|CX-3|سي إكس 3|CX3|suv|knowledge
Mazda|mazda|CX-5|سي إكس 5|CX5|suv|knowledge
Mazda|mazda|CX-9|سي إكس 9|CX9|suv|knowledge
Mazda|mazda|CX-30|سي إكس 30|CX30|suv|knowledge
Mazda|mazda|BT-50|بي تي 50|BT50|pickup|knowledge
Mazda|mazda|MX-5|إم إكس 5|MX5|convertible|knowledge
Suzuki|suzuki|Swift|سويفت||hatchback|knowledge
Suzuki|suzuki|Dzire|دزاير||sedan|knowledge
Suzuki|suzuki|Vitara|فيتارا||suv|knowledge
Suzuki|suzuki|Jimny|جيمني||suv|knowledge
Suzuki|suzuki|SX4|إس إكس 4|SX-4|sedan|knowledge
Suzuki|suzuki|Ertiga|إرتيجا,ارتيجا||van|knowledge
Suzuki|suzuki|Ciaz|سياز||sedan|knowledge
Suzuki|suzuki|Baleno|بالينو||hatchback|knowledge
Suzuki|suzuki|Celerio|سيليريو||hatchback|knowledge
Renault|renault|Logan|لوجان||sedan|cited
Renault|renault|Duster|داستر||suv|cited
Renault|renault|Megane|ميجان||sedan|knowledge
Renault|renault|Symbol|سيمبول||sedan|knowledge
Renault|renault|Captur|كابتور||suv|knowledge
Renault|renault|Koleos|كوليوس||suv|knowledge
Renault|renault|Sandero|سانديرو||hatchback|cited
Renault|renault|Trafic|ترافيك||van|knowledge
Renault|renault|Arkana|أركانا,اركانا||suv|knowledge
Peugeot|peugeot|301|301||sedan|knowledge
Peugeot|peugeot|308|308||hatchback|knowledge
Peugeot|peugeot|3008|3008||suv|knowledge
Peugeot|peugeot|508|508||sedan|knowledge
Peugeot|peugeot|2008|2008||suv|knowledge
Peugeot|peugeot|5008|5008||suv|knowledge
Peugeot|peugeot|208|208||hatchback|knowledge
Peugeot|peugeot|Partner|بارتنر||van|knowledge
Peugeot|peugeot|Traveller|ترافيلر||van|knowledge
Fiat|fiat|Tipo|تيبو||sedan|cited
Fiat|fiat|Punto|بونتو||hatchback|knowledge
Fiat|fiat|500|500||hatchback|knowledge
Fiat|fiat|Doblo|دوبلو||van|knowledge
Fiat|fiat|Panda|باندا||hatchback|knowledge
Fiat|fiat|Bravo|برافو||hatchback|knowledge
Fiat|fiat|Linea|لينيا||sedan|knowledge
Fiat|fiat|Scudo|سكودو||van|knowledge
Fiat|fiat|Ducato|دوكاتو||van|knowledge
Opel|opel|Astra|أسترا,استرا||hatchback|cited
Opel|opel|Corsa|كورسا||hatchback|knowledge
Opel|opel|Insignia|إنسيجنيا,انسيجنيا||sedan|knowledge
Opel|opel|Mokka|موكا||suv|knowledge
Opel|opel|Vectra|فيكترا||sedan|knowledge
Opel|opel|Zafira|زافيرا||van|knowledge
Opel|opel|Crossland|كروسلاند||suv|knowledge
Opel|opel|Movano|موفانو||van|knowledge
Opel|opel|Grandland|جراندلاند||suv|knowledge
Volkswagen|volkswagen|Golf|جولف||hatchback|knowledge
Volkswagen|volkswagen|Passat|باسات||sedan|knowledge
Volkswagen|volkswagen|Jetta|جيتا||sedan|knowledge
Volkswagen|volkswagen|Tiguan|تيجوان||suv|knowledge
Volkswagen|volkswagen|Touareg|طوارق||suv|knowledge
Volkswagen|volkswagen|Polo|بولو||hatchback|knowledge
Volkswagen|volkswagen|Teramont|تيرامونت||suv|knowledge
Volkswagen|volkswagen|Caddy|كادي||van|knowledge
Volkswagen|volkswagen|ID.4|آي دي 4,اي دي 4|ID4|suv|knowledge
Skoda|skoda|Octavia|أوكتافيا,اوكتافيا||sedan|cited
Skoda|skoda|Superb|سوبيرب||sedan|knowledge
Skoda|skoda|Kodiaq|كودياك||suv|cited
Skoda|skoda|Fabia|فابيا||hatchback|knowledge
Skoda|skoda|Karoq|كاروك||suv|knowledge
Skoda|skoda|Rapid|رابيد||sedan|knowledge
Skoda|skoda|Scala|سكالا||hatchback|knowledge
Skoda|skoda|Kamiq|كاميك||suv|knowledge
BMW|bmw|3 Series|الفئة الثالثة|3Series|sedan|cited
BMW|bmw|5 Series|الفئة الخامسة|5Series|sedan|knowledge
BMW|bmw|7 Series|الفئة السابعة|7Series|sedan|knowledge
BMW|bmw|X1|إكس 1,اكس 1|X-1|suv|knowledge
BMW|bmw|X2|إكس 2,اكس 2|X-2|suv|knowledge
BMW|bmw|X3|إكس 3,اكس 3|X-3|suv|knowledge
BMW|bmw|X5|إكس 5,اكس 5|X-5|suv|knowledge
BMW|bmw|X6|إكس 6,اكس 6|X-6|suv|knowledge
BMW|bmw|iX|آي إكس,اي اكس||suv|knowledge
Mercedes-Benz|mercedes-benz|C-Class|الفئة C,سي كلاس|CClass|sedan|knowledge
Mercedes-Benz|mercedes-benz|E-Class|الفئة E,إي كلاس|EClass|sedan|knowledge
Mercedes-Benz|mercedes-benz|S-Class|الفئة S,إس كلاس|SClass|sedan|knowledge
Mercedes-Benz|mercedes-benz|GLA|جي إل إيه|GLA-Class|suv|knowledge
Mercedes-Benz|mercedes-benz|GLC|جي إل سي|GLC-Class|suv|knowledge
Mercedes-Benz|mercedes-benz|GLE|جي إل إي|GLE-Class|suv|knowledge
Mercedes-Benz|mercedes-benz|GLS|جي إل إس|GLS-Class|suv|knowledge
Mercedes-Benz|mercedes-benz|Sprinter|سبرينتر||van|knowledge
Mercedes-Benz|mercedes-benz|V-Class|الفئة V|VClass|van|knowledge
Audi|audi|A3|إيه 3,اي 3|A-3|hatchback|knowledge
Audi|audi|A4|إيه 4,اي 4|A-4|sedan|knowledge
Audi|audi|A6|إيه 6,اي 6|A-6|sedan|knowledge
Audi|audi|A8|إيه 8,اي 8|A-8|sedan|knowledge
Audi|audi|Q3|كيو 3|Q-3|suv|knowledge
Audi|audi|Q5|كيو 5|Q-5|suv|knowledge
Audi|audi|Q7|كيو 7|Q-7|suv|knowledge
Chery|chery|Tiggo 2|تيجو 2|Tiggo2|suv|knowledge
Chery|chery|Tiggo 3|تيجو 3|Tiggo3|suv|cited
Chery|chery|Tiggo 4|تيجو 4|Tiggo4|suv|knowledge
Chery|chery|Tiggo 7|تيجو 7|Tiggo7|suv|cited
Chery|chery|Tiggo 8|تيجو 8|Tiggo8|suv|knowledge
Chery|chery|Arrizo 5|أريزو 5,اريزو 5|Arrizo5|sedan|cited
Chery|chery|Arrizo 6|أريزو 6,اريزو 6|Arrizo6|sedan|cited
Chery|chery|QQ|كيو كيو||hatchback|knowledge
Geely|geely|Emgrand 7|إمجراند 7,امجراند 7|Emgrand7|sedan|knowledge
Geely|geely|Emgrand 8|إمجراند 8,امجراند 8|Emgrand8|sedan|knowledge
Geely|geely|Emgrand X7|إمجراند إكس 7,امجراند اكس 7|EmgrandX7|suv|knowledge
Geely|geely|Coolray|كولراي||suv|knowledge
Geely|geely|Tugella|توجيلا||suv|knowledge
Geely|geely|Atlas|أطلس,اطلس||suv|knowledge
Geely|geely|GS|جي إس,جي اس||hatchback|knowledge
MG|mg|MG3|إم جي 3,ام جي 3|MG-3|hatchback|knowledge
MG|mg|MG5|إم جي 5,ام جي 5|MG-5|sedan|knowledge
MG|mg|MG6|إم جي 6,ام جي 6|MG-6|sedan|knowledge
MG|mg|ZS|زد إس,زد اس||suv|cited
MG|mg|HS|إتش إس,اتش اس||suv|knowledge
MG|mg|RX5|آر إكس 5,ار اكس 5|RX-5|suv|knowledge
MG|mg|GT|جي تي||sedan|cited
BYD|byd|F3|إف 3,اف 3|F-3|sedan|cited
BYD|byd|S6|إس 6,اس 6|S-6|suv|knowledge
BYD|byd|Song Plus|سونج بلس|SongPlus|suv|knowledge
BYD|byd|Qin Plus|تشين بلس|QinPlus|sedan|knowledge
BYD|byd|Tang|تانج||suv|knowledge
BYD|byd|Dolphin|دولفين||hatchback|knowledge
BYD|byd|Atto 3|أتو 3,اتو 3|Atto3|suv|knowledge
Changan|changan|Eado|إيدو,ايدو||sedan|knowledge
Changan|changan|Alsvin|ألسفين,السفين||sedan|knowledge
Changan|changan|CS15|سي إس 15|CS-15|suv|knowledge
Changan|changan|CS35|سي إس 35|CS-35|suv|knowledge
Changan|changan|CS75|سي إس 75|CS-75|suv|knowledge
Changan|changan|CS95|سي إس 95|CS-95|suv|knowledge
Changan|changan|Hunter|هانتر||pickup|knowledge
Great Wall|great-wall|Wingle 5|وينجل 5|Wingle5|pickup|knowledge
Great Wall|great-wall|Wingle 7|وينجل 7|Wingle7|pickup|knowledge
Great Wall|great-wall|Poer|بور||pickup|knowledge
Great Wall|great-wall|C30|سي 30|C-30|sedan|knowledge
Great Wall|great-wall|Steed|ستيد||pickup|knowledge
Great Wall|great-wall|Tank 300|تانك 300|Tank300|suv|knowledge
Haval|haval|H2|إتش 2,اتش 2|H-2|suv|knowledge
Haval|haval|H5|إتش 5,اتش 5|H-5|suv|knowledge
Haval|haval|H6|إتش 6,اتش 6|H-6|suv|knowledge
Haval|haval|H9|إتش 9,اتش 9|H-9|suv|knowledge
Haval|haval|Jolion|جوليان||suv|knowledge
Haval|haval|Dargo|دارجو||suv|knowledge
Daewoo|daewoo|Leganza|ليجانزا||sedan|knowledge
Daewoo|daewoo|Espero|إسبيرو,اسبيرو||sedan|knowledge
Lada|lada|Niva|نيفا||suv|knowledge
Lada|lada|Granta|جرانتا||sedan|knowledge
Lada|lada|Vesta|فيستا||sedan|knowledge
Lada|lada|Priora|بريورا||sedan|knowledge
Lada|lada|Kalina|كالينا||hatchback|knowledge
Dacia|dacia|Logan|لوجان||sedan|knowledge
Dacia|dacia|Sandero|سانديرو||hatchback|knowledge
Dacia|dacia|Duster|داستر||suv|knowledge
Dacia|dacia|Dokker|دوكر||van|knowledge
Dacia|dacia|Lodgy|لودجي||van|knowledge
Citroen|citroen|C1|سي 1|C-1|hatchback|knowledge
Citroen|citroen|C3|سي 3|C-3|hatchback|knowledge
Citroen|citroen|C4|سي 4|C-4|sedan|knowledge
Citroen|citroen|C5|سي 5|C-5|sedan|knowledge
Citroen|citroen|Berlingo|بيرلينجو||van|knowledge
Citroen|citroen|C-Elysee|سي إليسي|CElysee|sedan|knowledge
Jeep|jeep|Cherokee|شيروكي||suv|cited
Jeep|jeep|Grand Cherokee|جراند شيروكي|GrandCherokee|suv|knowledge
Jeep|jeep|Wrangler|رانجلر||suv|knowledge
Jeep|jeep|Compass|كومباس||suv|knowledge
Jeep|jeep|Renegade|رينيجيد||suv|knowledge
Jeep|jeep|Liberty|ليبرتي||suv|knowledge
Dodge|dodge|Charger|تشارجر||sedan|knowledge
Dodge|dodge|Challenger|تشالنجر||coupe|knowledge
Dodge|dodge|Durango|دورانجو||suv|knowledge
Dodge|dodge|Journey|جورني||suv|knowledge
Chrysler|chrysler|300|300||sedan|knowledge
Chrysler|chrysler|Sebring|سبرينج||sedan|knowledge
Chrysler|chrysler|PT Cruiser|بي تي كروزر|PTCruiser|wagon|knowledge
Chrysler|chrysler|Town & Country|تاون اند كونتري|TownCountry|van|knowledge
Daihatsu|daihatsu|Terios|تيريوس||suv|knowledge
Daihatsu|daihatsu|Sirion|سيريون||hatchback|knowledge
Daihatsu|daihatsu|Gran Max|جران ماكس||van|knowledge
Isuzu|isuzu|D-Max|ديماكس|DMax|pickup|knowledge
Isuzu|isuzu|MU-X|مو إكس|MUX|suv|knowledge
Porsche|porsche|Cayenne|كايين||suv|knowledge
Porsche|porsche|Macan|ماكان||suv|knowledge
Porsche|porsche|Panamera|باناميرا||sedan|knowledge
Porsche|porsche|911|911||coupe|knowledge
SsangYong|ssangyong|Tivoli|تيفولي||suv|knowledge
SsangYong|ssangyong|Korando|كوراندو||suv|knowledge
SsangYong|ssangyong|Rexton|ريكستون||suv|knowledge
SsangYong|ssangyong|Musso|موسو||pickup|knowledge
Subaru|subaru|Impreza|إمبريزا,امبريزا|Impreza|sedan|knowledge
Subaru|subaru|Forester|فورستر||suv|knowledge
Subaru|subaru|Outback|أوتباك,اوتباك|Outback|wagon|knowledge
Subaru|subaru|XV|إكس في,اكس في|XV|suv|knowledge
Tesla|tesla|Model 3|موديل 3|Model3|sedan|knowledge
Tesla|tesla|Model Y|موديل واي|ModelY|suv|knowledge
Tesla|tesla|Model S|موديل إس|ModelS|sedan|knowledge
Tesla|tesla|Model X|موديل إكس|ModelX|suv|knowledge
Volvo|volvo|XC40|إكس سي 40|XC-40|suv|knowledge
Volvo|volvo|XC60|إكس سي 60|XC-60|suv|knowledge
Volvo|volvo|XC90|إكس سي 90|XC-90|suv|knowledge
Volvo|volvo|S60|إس 60|S-60|sedan|knowledge
Nissan|nissan|Qashqai|قشقاي||suv|cited
Nissan|nissan|Juke|جوك||suv|knowledge
Nissan|nissan|Micra|ميكرا||hatchback|knowledge
Nissan|nissan|Maxima|مكسيما,ماكسيما||sedan|knowledge
Hyundai|hyundai|Matrix|ماتريكس||hatchback|cited
Hyundai|hyundai|ix35|آي إكس 35,اي اكس 35|ix-35|suv|cited
Hyundai|hyundai|Grand i10|جراند آي 10,جراند اي 10|Grandi10|hatchback|knowledge
Hyundai|hyundai|i20|آي 20,اي 20|i-20|hatchback|knowledge
Hyundai|hyundai|i30|آي 30,اي 30|i-30|hatchback|knowledge
Hyundai|hyundai|Kona|كونا||suv|knowledge
Hyundai|hyundai|Excel|إكسيل,اكسيل||sedan|knowledge
Kia|kia|Shuma|شوما||sedan|cited
Kia|kia|Soul|سول||hatchback|knowledge
Kia|kia|Sonet|سونيت||suv|knowledge
Chevrolet|chevrolet|Lanos|لانوس||sedan|cited
Chevrolet|chevrolet|T-Series pickup|دبابة,تي سيريز|TSeries,DMAX|pickup|cited
Chevrolet|chevrolet|Cobalt|كوبالت||sedan|knowledge
Chevrolet|chevrolet|Tracker|تراكر||suv|knowledge
Chevrolet|chevrolet|Epica|إبيكا,ابيكا||sedan|knowledge
Chevrolet|chevrolet|Matiz|ماتيز||hatchback|knowledge
Chevrolet|chevrolet|Nubira|نوبيرا||sedan|knowledge
Chevrolet|chevrolet|Cielo|سيلو||sedan|knowledge
Toyota|toyota|Rush|راش||suv|knowledge
Toyota|toyota|Avensis|أفينسيس,افينسيس||sedan|knowledge
Fiat|fiat|Uno|أونو,اونو||hatchback|knowledge
Fiat|fiat|128|128||sedan|knowledge
Fiat|fiat|131|131,شاهين|Shahin|sedan|knowledge
Fiat|fiat|Albea|ألبيا,البيا||sedan|knowledge
Renault|renault|Fluence|فلوانس||sedan|knowledge
Renault|renault|Clio|كليو||hatchback|knowledge
Renault|renault|Kadjar|قادجار,كادجار||suv|knowledge
Renault|renault|19|19||sedan|knowledge
Renault|renault|Kwid|كويد||hatchback|knowledge
Skoda|skoda|Yeti|يتي||suv|knowledge
Volkswagen|volkswagen|Bora|بورا||sedan|knowledge
Volkswagen|volkswagen|Beetle|بيتل,خنفساء||hatchback|knowledge
Volkswagen|volkswagen|T-Roc|تي روك|TRoc|suv|knowledge
Volkswagen|volkswagen|Touran|توران||van|knowledge
Peugeot|peugeot|206|206||hatchback|knowledge
Peugeot|peugeot|207|207||hatchback|knowledge
Peugeot|peugeot|307|307||hatchback|knowledge
Peugeot|peugeot|405|405||sedan|knowledge
Peugeot|peugeot|504|504||sedan|knowledge
Mitsubishi|mitsubishi|Mirage|ميراج||hatchback|knowledge
Suzuki|suzuki|Alto|ألتو,التو||hatchback|cited
Suzuki|suzuki|S-Presso|إس بريسو,اس بريسو|SPresso|hatchback|cited
Suzuki|suzuki|Grand Vitara|جراند فيتارا|GrandVitara|suv|knowledge
Suzuki|suzuki|Fronx|فرونكس||suv|knowledge
Ford|ford|Fusion|فيوجن||sedan|knowledge
Ford|ford|EcoSport|إيكوسبورت,ايكوسبورت||suv|knowledge
Ford|ford|Kuga|كوجا||suv|knowledge
Ford|ford|Mondeo|مونديو||sedan|knowledge
Opel|opel|Omega|أوميجا,اوميجا||sedan|knowledge
Citroen|citroen|C4 Picasso|سي 4 بيكاسو|C4Picasso|van|knowledge
Seat|seat|Leon|ليون||hatchback|knowledge
Seat|seat|Ibiza|إبيزا,ابيزا||hatchback|knowledge
Seat|seat|Toledo|توليدو||sedan|knowledge
Seat|seat|Ateca|أتيكا,اتيكا||suv|knowledge
Mercedes-Benz|mercedes-benz|A-Class|الفئة A,إيه كلاس|AClass|hatchback|knowledge
Mercedes-Benz|mercedes-benz|CLA|سي إل إيه,سي ال ايه|CLA-Class|sedan|knowledge
BMW|bmw|1 Series|الفئة الأولى,الفئة الاولى|1Series|hatchback|knowledge
Lada|lada|2107|2107,1500||sedan|knowledge
Lada|lada|Samara|سمارة,سماره||sedan|knowledge
Proton|proton|Saga|ساجا||sedan|cited
Proton|proton|Persona|بيرسونا||sedan|knowledge
Chery|chery|Tiggo 4 Pro|تيجو 4 برو|Tiggo4Pro|suv|cited
Chery|chery|Tiggo 8 Pro|تيجو 8 برو|Tiggo8Pro|suv|knowledge
Chery|chery|Arrizo 8|أريزو 8,اريزو 8|Arrizo8|sedan|knowledge
Chery|chery|Tiggo 2 Pro|تيجو 2 برو|Tiggo2Pro|suv|knowledge
MG|mg|3|إم جي 3,ام جي 3|MG3|hatchback|knowledge
MG|mg|5|إم جي 5,ام جي 5|MG5|sedan|knowledge
MG|mg|6|إم جي 6,ام جي 6|MG6|sedan|knowledge
MG|mg|4 EV|إم جي 4,ام جي 4|MG4,4EV|hatchback|knowledge
MG|mg|7|إم جي 7,ام جي 7|MG7|sedan|knowledge
Jetour|jetour|T2|تي 2|T-2|suv|cited
Jetour|jetour|X70 Plus|إكس 70 بلس,اكس 70 بلس|X70Plus|suv|cited
Jetour|jetour|X70|إكس 70,اكس 70|X-70|suv|knowledge
Jetour|jetour|X90 Plus|إكس 90 بلس,اكس 90 بلس|X90Plus|suv|knowledge
Jetour|jetour|Dashing|داشينج||suv|knowledge
BAIC|baic|U5 Plus|يو 5 بلس|U5Plus|sedan|cited
BAIC|baic|X35|إكس 35,اكس 35|X-35|suv|knowledge
BAIC|baic|X55|إكس 55,اكس 55|X-55|suv|knowledge
BAIC|baic|BJ40 Plus|بي جي 40 بلس|BJ40Plus|suv|knowledge
Changan|changan|CS55 Plus|سي إس 55 بلس,سي اس 55 بلس|CS55Plus|suv|cited
Changan|changan|CS35 Plus|سي إس 35 بلس,سي اس 35 بلس|CS35Plus|suv|knowledge
Changan|changan|CS75 Plus|سي إس 75 بلس,سي اس 75 بلس|CS75Plus|suv|knowledge
Changan|changan|UNI-T|يوني تي|UNIT|suv|knowledge
BYD|byd|Seal|سيل||sedan|knowledge
BYD|byd|Han|هان||sedan|knowledge
Geely|geely|Emgrand|إمجراند,امجراند|EC7,Emgrand 7|sedan|cited
Geely|geely|Azkarra|أزكارا,ازكارا||suv|knowledge
Geely|geely|Okavango|أوكافانجو,اوكافانجو||suv|knowledge
Geely|geely|Monjaro|مونجارو||suv|knowledge
Soueast|soueast|S06|إس 06,اس 06|S-06|suv|knowledge
Zeekr|zeekr|X|إكس,اكس||suv|cited
Zeekr|zeekr|001|001||sedan|cited
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
  const [make, makeSlug, model, aliasesAr, aliasesEn, bodyType, sourceTier = 'knowledge'] =
    line.split('|');
  const id = uuidFor(`${makeSlug}:${model}`);
  return {
    id,
    make,
    makeSlug,
    model,
    makeAliasesAr: MAKE_ALIASES_AR[makeSlug] ?? [],
    aliasesAr: aliasesAr ? aliasesAr.split(',') : [],
    aliasesEn: aliasesEn ? aliasesEn.split(',') : [],
    yearFrom: null,
    yearTo: null,
    bodyType,
    sourceTier: sourceTier || 'knowledge',
    verified: false,
  };
});

const makes = new Set(entries.map((entry) => entry.makeSlug));
if (makes.size !== 46) throw new Error(`Expected 46 makes, built ${makes.size}`);
if (new Set(entries.map((entry) => entry.id)).size !== entries.length) {
  throw new Error('Duplicate catalog ids');
}

// Every WMI-decoded make must have at least one model
const wmiSlugs = new Set(
  Object.values(
    JSON.parse(readFileSync(join(here, '..', 'src', 'data', 'wmi.json'), 'utf8')).entries,
  )
    .map((entry) => entry.makeSlug)
    .filter(Boolean),
);
const missing = [...wmiSlugs].filter((slug) => !makes.has(slug));
if (missing.length > 0) {
  throw new Error(`Catalog has no models for WMI makes: ${missing.join(', ')}`);
}

writeFileSync(
  outputPath,
  `${JSON.stringify({ version: VERSION, downloadedAt: DOWNLOADED_AT, entries }, null, 2)}\n`,
  'utf8',
);

console.log(`Built vehicle catalog: ${entries.length} models across ${makes.size} makes`);
const citedCount = entries.filter((e) => e.sourceTier === 'cited').length;
const knowledgeCount = entries.filter((e) => e.sourceTier === 'knowledge').length;
console.log(`Source tiers: ${citedCount} cited, ${knowledgeCount} knowledge, 0 verified`);
