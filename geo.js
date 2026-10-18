// داده جغرافیایی: کشورها/مناطق، تطبیق متن بازار با کشور، و ماسک خشکی برای نقشه نقطه‌ای
// (بدون وابستگی به فایل‌های مرزی؛ حباب‌ها روی مختصات مرکز کشورها قرار می‌گیرند)

export const CONTINENTS = {
  me: 'خاورمیانه',
  eu: 'اروپا',
  as: 'آسیا',
  af: 'آفریقا',
  na: 'آمریکای شمالی',
  sa: 'آمریکای جنوبی',
  oc: 'اقیانوسیه',
};

// id, نام فارسی, عرض, طول, قاره, الگوهای تطبیق (انگلیسی، حروف کوچک)
const RAW = [
  ['US', 'آمریکا', 39, -98, 'na', 'united states|u\\.s\\.|usa|america|american|trump|biden|vance|harris|fed|fomc|federal reserve|congress|senate|white house|republican|democrat|gop|supreme court|nyc|new york|california|texas|florida|pentagon|powell|warsh|musk|newsom|obama|rubio|hegseth|doge|nfl|nba|mlb|nhl|super bowl|nasdaq|s&p'],
  ['CA', 'کانادا', 58, -105, 'na', 'canada|canadian|trudeau|carney|poilievre|toronto'],
  ['MX', 'مکزیک', 23, -102, 'na', 'mexico|mexican|sheinbaum'],
  ['CU', 'کوبا', 21.5, -79, 'na', 'cuba|cuban|havana'],
  ['VE', 'ونزوئلا', 7, -66, 'sa', 'venezuela|maduro|caracas'],
  ['CO', 'کلمبیا', 4, -73, 'sa', 'colombia|petro'],
  ['BR', 'برزیل', -10, -53, 'sa', 'brazil|brazilian|lula|bolsonaro|brasileir'],
  ['AR', 'آرژانتین', -35, -64, 'sa', 'argentina|milei|messi'],
  ['CL', 'شیلی', -33, -71, 'sa', 'chile|chilean|kast'],
  ['PE', 'پرو', -10, -75, 'sa', 'peru|peruvian'],
  ['GB', 'بریتانیا', 54, -2, 'eu', 'united kingdom|uk |u\\.k\\.|britain|british|england|english|scotland|starmer|reform uk|farage|premier league|arsenal|chelsea|liverpool|manchester|tottenham|newcastle|aston villa|west ham|london'],
  ['IE', 'ایرلند', 53, -8, 'eu', 'ireland|irish'],
  ['FR', 'فرانسه', 46.5, 2.5, 'eu', 'france|french|macron|le pen|bardella|ligue 1|psg|paris|marseille'],
  ['DE', 'آلمان', 51, 10, 'eu', 'germany|german|merz|scholz|afd|bundesliga|bayern|dortmund|berlin'],
  ['ES', 'اسپانیا', 40, -3.5, 'eu', 'spain|spanish|sanchez|la liga|real madrid|barcelona|atletico|madrid'],
  ['PT', 'پرتغال', 39.5, -8, 'eu', 'portugal|portuguese|benfica|sporting cp|porto'],
  ['IT', 'ایتالیا', 42.5, 12.5, 'eu', 'italy|italian|meloni|serie a|juventus|inter milan|ac milan|napoli|roma'],
  ['NL', 'هلند', 52.2, 5.3, 'eu', 'netherlands|dutch|ajax|psv|wilders'],
  ['BE', 'بلژیک', 50.6, 4.6, 'eu', 'belgium|belgian'],
  ['CH', 'سوئیس', 46.8, 8.2, 'eu', 'switzerland|swiss'],
  ['AT', 'اتریش', 47.5, 14.5, 'eu', 'austria|austrian'],
  ['PL', 'لهستان', 52, 19.5, 'eu', 'poland|polish|tusk|nawrocki'],
  ['SE', 'سوئد', 62, 15, 'eu', 'sweden|swedish'],
  ['NO', 'نروژ', 61, 9, 'eu', 'norway|norwegian'],
  ['FI', 'فنلاند', 63.5, 26, 'eu', 'finland|finnish'],
  ['DK', 'دانمارک', 56, 10, 'eu', 'denmark|danish|greenland'],
  ['GR', 'یونان', 39, 22, 'eu', 'greece|greek'],
  ['HU', 'مجارستان', 47.2, 19.5, 'eu', 'hungary|hungarian|orban|magyar'],
  ['RO', 'رومانی', 45.8, 25, 'eu', 'romania|romanian'],
  ['RS', 'صربستان', 44, 21, 'eu', 'serbia|serbian|vucic'],
  ['UA', 'اوکراین', 49, 32, 'eu', 'ukraine|ukrainian|zelensky|kyiv|kiev|donbas|crimea'],
  ['BY', 'بلاروس', 53.7, 28, 'eu', 'belarus|lukashenko'],
  ['RU', 'روسیه', 60, 90, 'eu', 'russia|russian|putin|kremlin|moscow|medvedev|navalny'],
  ['TR', 'ترکیه', 39, 35, 'me', 'turkey|turkish|erdogan|istanbul|galatasaray|fenerbahce|imamoglu'],
  ['IL', 'اسرائیل', 31.2, 35, 'me', 'israel|israeli|netanyahu|idf|tel aviv|jerusalem|knesset|gaza|hamas|west bank|palestin'],
  ['LB', 'لبنان', 33.9, 35.8, 'me', 'lebanon|lebanese|hezbollah|beirut'],
  ['SY', 'سوریه', 35, 38.5, 'me', 'syria|syrian|damascus|assad|jolani|sharaa'],
  ['IQ', 'عراق', 33, 44, 'me', 'iraq|iraqi|baghdad'],
  ['IR', 'ایران', 32.5, 53, 'me', 'iran|iranian|tehran|khamenei|pezeshkian|irgc|persian gulf|strait of hormuz|hormuz|isfahan|natanz|fordow'],
  ['SA', 'عربستان', 24, 45, 'me', 'saudi|riyadh|mbs|bin salman|opec'],
  ['AE', 'امارات', 24, 54, 'me', 'uae|emirates|dubai|abu dhabi'],
  ['QA', 'قطر', 25.3, 51.2, 'me', 'qatar|qatari|doha'],
  ['YE', 'یمن', 15.5, 48, 'me', 'yemen|houthi|red sea'],
  ['JO', 'اردن', 31, 36.5, 'me', 'jordan|amman'],
  ['KW', 'کویت', 29.3, 47.7, 'me', 'kuwait'],
  ['OM', 'عمان', 21, 57, 'me', 'oman|muscat'],
  ['EG', 'مصر', 26.5, 30, 'af', 'egypt|egyptian|cairo|suez|sisi'],
  ['LY', 'لیبی', 27, 17, 'af', 'libya|libyan|haftar'],
  ['DZ', 'الجزایر', 28, 2.5, 'af', 'algeria|algerian'],
  ['MA', 'مراکش', 31.8, -7, 'af', 'morocco|moroccan'],
  ['SD', 'سودان', 15.5, 30, 'af', 'sudan|sudanese|khartoum'],
  ['ET', 'اتیوپی', 9, 39.5, 'af', 'ethiopia|ethiopian'],
  ['NG', 'نیجریه', 9.5, 8, 'af', 'nigeria|nigerian|tinubu'],
  ['ZA', 'آفریقای جنوبی', -29, 24, 'af', 'south africa|ramaphosa|springbok'],
  ['KE', 'کنیا', 0.5, 38, 'af', 'kenya|kenyan|nairobi'],
  ['CD', 'کنگو', -2.5, 23.5, 'af', 'congo|drc|kinshasa|m23'],
  ['PK', 'پاکستان', 30, 69.5, 'as', 'pakistan|pakistani|imran khan|islamabad|sharif|munir'],
  ['AF', 'افغانستان', 34, 66, 'as', 'afghanistan|afghan|taliban|kabul'],
  ['IN', 'هند', 22, 79, 'as', 'india|indian|modi|bjp|delhi|mumbai|ipl|bcci|kohli'],
  ['BD', 'بنگلادش', 23.8, 90.3, 'as', 'bangladesh|dhaka|yunus'],
  ['CN', 'چین', 35, 103, 'as', 'china|chinese|xi jinping|beijing|ccp|pla|shanghai|hong kong|yuan|renminbi|deepseek|alibaba|tencent'],
  ['TW', 'تایوان', 23.7, 121, 'as', 'taiwan|taiwanese|taipei|tsmc'],
  ['KP', 'کره شمالی', 40, 127, 'as', 'north korea|kim jong|pyongyang'],
  ['KR', 'کره جنوبی', 36.5, 127.8, 'as', 'south korea|korean|seoul|yoon|lee jae|kospi|samsung'],
  ['JP', 'ژاپن', 36.5, 138, 'as', 'japan|japanese|tokyo|takaichi|ishiba|nikkei|boj|yen'],
  ['TH', 'تایلند', 15, 101, 'as', 'thailand|thai|bangkok'],
  ['VN', 'ویتنام', 15.5, 107.5, 'as', 'vietnam|vietnamese'],
  ['ID', 'اندونزی', -2, 118, 'as', 'indonesia|indonesian|prabowo|jakarta'],
  ['PH', 'فیلیپین', 12.5, 122.5, 'as', 'philippines|filipino|marcos|manila'],
  ['MY', 'مالزی', 4, 102, 'as', 'malaysia|malaysian|anwar'],
  ['SG', 'سنگاپور', 1.35, 103.8, 'as', 'singapore'],
  ['MM', 'میانمار', 21, 96, 'as', 'myanmar|burma'],
  ['KZ', 'قزاقستان', 48, 67, 'as', 'kazakhstan|kazakh'],
  ['AU', 'استرالیا', -25, 134, 'oc', 'australia|australian|albanese|sydney|melbourne|aussie'],
  ['NZ', 'نیوزیلند', -41, 173, 'oc', 'new zealand|kiwi|luxon'],
];

export const COUNTRIES = RAW.map(([id, fa, lat, lon, cont, kw]) => ({
  id, fa, lat, lon, cont,
  re: new RegExp('(?:^|[^a-z])(?:' + kw + ')(?:$|[^a-z])', 'i'),
}));
export const COUNTRY_BY_ID = Object.fromEntries(COUNTRIES.map((c) => [c.id, c]));

// مناطق (بدون کشور مشخص): روی نقشه به‌صورت حباب جدا نمایش داده می‌شوند
const REG = [
  ['R_ME', 'خاورمیانه', 29, 44, 'me', 'middle east|gulf states|persian gulf|arab '],
  ['R_EU', 'اتحادیه اروپا', 49, 12, 'eu', 'european union|\\beu\\b|europe|european|nato|eurozone|ecb|brussels|von der leyen|euro '],
  ['R_AF', 'آفریقا', 3, 20, 'af', 'africa|african'],
  ['R_LA', 'آمریکای لاتین', -8, -60, 'sa', 'latin america|south america'],
  ['R_AS', 'آسیا', 30, 95, 'as', 'asia |asian|asean|south china sea'],
];
export const REGIONS = REG.map(([id, fa, lat, lon, cont, kw]) => ({
  id, fa, lat, lon, cont, region: true,
  re: new RegExp('(?:^|[^a-z])(?:' + kw + ')(?:$|[^a-z])', 'i'),
}));
export const PLACES = [...COUNTRIES, ...REGIONS];
export const PLACE_BY_ID = Object.fromEntries(PLACES.map((c) => [c.id, c]));

// کشورهای مرتبط با یک متن (عنوان + تگ‌ها)
export function matchPlaces(text) {
  const t = ' ' + String(text || '').toLowerCase() + ' ';
  const out = [];
  for (const c of PLACES) if (c.re.test(t)) out.push(c.id);
  return out;
}

// ----- نقشه نقطه‌ای -----
export const MAP_W = 1000;
const LAT_TOP = 80, LAT_BOT = -58;
export const MAP_H = Math.round((MAP_W * (LAT_TOP - LAT_BOT)) / 360);

export function project(lon, lat) {
  return [((lon + 180) / 360) * MAP_W, ((LAT_TOP - lat) / (LAT_TOP - LAT_BOT)) * MAP_H];
}

// هر ردیف: بازه‌های طولِ خشکی برای باند عرضی ۵ درجه‌ای که با ۷۵..۷۰ شروع می‌شود
const LAND_ROWS = [
  /* 72.5 */ [[-125, -80], [-60, -20], [20, 30], [60, 140]],
  /* 67.5 */ [[-165, -60], [-52, -22], [14, 30], [30, 180], [-180, -170]],
  /* 62.5 */ [[-165, -95], [-78, -65], [-50, -42], [-24, -14], [5, 30], [30, 180], [-180, -170]],
  /* 57.5 */ [[-165, -95], [-78, -56], [-48, -42], [-8, 0], [5, 30], [30, 165]],
  /* 52.5 */ [[-130, -54], [-10, 2], [5, 140], [155, 165]],
  /* 47.5 */ [[-124, -53], [-4, 135]],
  /* 42.5 */ [[-124, -66], [-9, 28], [40, 47], [54, 145]],
  /* 37.5 */ [[-122, -76], [-9, 0], [7, 19], [20, 142]],
  /* 32.5 */ [[-118, -80], [-10, 35], [35, 122], [130, 135]],
  /* 27.5 */ [[-114, -80], [-17, 56], [56, 122]],
  /* 22.5 */ [[-106, -87], [-85, -74], [-17, 59], [68, 115]],
  /* 17.5 */ [[-100, -88], [-74, -68], [-17, 52], [73, 88], [92, 108], [120, 125]],
  /* 12.5 */ [[-92, -84], [-76, -62], [-17, 51], [75, 80], [98, 109], [121, 126]],
  /*  7.5 */ [[-82, -52], [-13, 47], [76, 78], [98, 104], [116, 119], [122, 127]],
  /*  2.5 */ [[-78, -50], [9, 47], [95, 105], [109, 118], [120, 125]],
  /* -2.5 */ [[-80, -45], [10, 42], [100, 105], [110, 116], [120, 123], [132, 150]],
  /* -7.5 */ [[-78, -35], [12, 40], [105, 114], [141, 150]],
  /* -12.5 */ [[-76, -38], [13, 40], [123, 128], [130, 137]],
  /* -17.5 */ [[-75, -40], [12, 50], [123, 146]],
  /* -22.5 */ [[-70, -40], [14, 36], [43, 48], [114, 152]],
  /* -27.5 */ [[-70, -48], [15, 33], [114, 153]],
  /* -32.5 */ [[-71, -52], [17, 30], [116, 152]],
  /* -37.5 */ [[-73, -57], [140, 150], [173, 178]],
  /* -42.5 */ [[-73, -63], [145, 148], [170, 174]],
  /* -47.5 */ [[-74, -66], [166, 170]],
  /* -52.5 */ [[-72, -66]],
];

// یک مسیر SVG واحد از نقطه‌های خشکی (stroke با خط‌پوش گرد → دایره)
export function landDotsPath(step = 3) {
  const parts = [];
  for (let lat = 75; lat >= LAT_BOT + 2; lat -= step) {
    const row = Math.min(LAND_ROWS.length - 1, Math.max(0, Math.floor((75 - lat) / 5)));
    const ranges = LAND_ROWS[row];
    for (let lon = -178; lon <= 178; lon += step) {
      if (ranges.some(([a, b]) => lon >= a && lon <= b)) {
        const [x, y] = project(lon, lat);
        parts.push('M' + x.toFixed(1) + ' ' + y.toFixed(1) + 'h0');
      }
    }
  }
  return parts.join('');
}
