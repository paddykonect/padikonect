export interface Country {
  name: string;
  // ISO 3166-1 alpha-2, lowercase — used to fetch the flag image.
  code: string;
}

// Nigeria is pinned first since Paddykonect is a Lagos-based app, then the
// countries Figma's picker (node 48:50343) lists up top, then the rest
// alphabetically, using standard country short names.
const REST_OF_WORLD: Country[] = [
  { name: "Afghanistan", code: "af" },
  { name: "Albania", code: "al" },
  { name: "Algeria", code: "dz" },
  { name: "Argentina", code: "ar" },
  { name: "Australia", code: "au" },
  { name: "Austria", code: "at" },
  { name: "Bangladesh", code: "bd" },
  { name: "Belgium", code: "be" },
  { name: "Benin", code: "bj" },
  { name: "Brazil", code: "br" },
  { name: "Cameroon", code: "cm" },
  { name: "Canada", code: "ca" },
  { name: "Chad", code: "td" },
  { name: "Chile", code: "cl" },
  { name: "China", code: "cn" },
  { name: "Colombia", code: "co" },
  { name: "Congo (DRC)", code: "cd" },
  { name: "Cote d'Ivoire", code: "ci" },
  { name: "Egypt", code: "eg" },
  { name: "Ethiopia", code: "et" },
  { name: "Finland", code: "fi" },
  { name: "France", code: "fr" },
  { name: "Gabon", code: "ga" },
  { name: "Gambia", code: "gm" },
  { name: "Germany", code: "de" },
  { name: "Ghana", code: "gh" },
  { name: "Greece", code: "gr" },
  { name: "Guinea", code: "gn" },
  { name: "India", code: "in" },
  { name: "Indonesia", code: "id" },
  { name: "Ireland", code: "ie" },
  { name: "Italy", code: "it" },
  { name: "Jamaica", code: "jm" },
  { name: "Japan", code: "jp" },
  { name: "Kenya", code: "ke" },
  { name: "Lebanon", code: "lb" },
  { name: "Liberia", code: "lr" },
  { name: "Libya", code: "ly" },
  { name: "Malaysia", code: "my" },
  { name: "Mali", code: "ml" },
  { name: "Mexico", code: "mx" },
  { name: "Morocco", code: "ma" },
  { name: "Mozambique", code: "mz" },
  { name: "Namibia", code: "na" },
  { name: "Netherlands", code: "nl" },
  { name: "New Zealand", code: "nz" },
  { name: "Niger", code: "ne" },
  { name: "Norway", code: "no" },
  { name: "Pakistan", code: "pk" },
  { name: "Philippines", code: "ph" },
  { name: "Poland", code: "pl" },
  { name: "Portugal", code: "pt" },
  { name: "Qatar", code: "qa" },
  { name: "Rwanda", code: "rw" },
  { name: "Saudi Arabia", code: "sa" },
  { name: "Senegal", code: "sn" },
  { name: "Sierra Leone", code: "sl" },
  { name: "Singapore", code: "sg" },
  { name: "South Africa", code: "za" },
  { name: "South Korea", code: "kr" },
  { name: "Spain", code: "es" },
  { name: "Sudan", code: "sd" },
  { name: "Sweden", code: "se" },
  { name: "Switzerland", code: "ch" },
  { name: "Tanzania", code: "tz" },
  { name: "Togo", code: "tg" },
  { name: "Turkey", code: "tr" },
  { name: "Uganda", code: "ug" },
  { name: "Ukraine", code: "ua" },
  { name: "United Arab Emirates", code: "ae" },
  { name: "United Kingdom", code: "gb" },
  { name: "United States", code: "us" },
  { name: "Zambia", code: "zm" },
  { name: "Zimbabwe", code: "zw" },
];

export const NIGERIA: Country = { name: "Nigeria", code: "ng" };

const FEATURED_CODES = ["us", "sg", "mx", "br", "gb", "de", "fr"];

const FEATURED = FEATURED_CODES.map((code) => REST_OF_WORLD.find((c) => c.code === code)!);

export const COUNTRIES: Country[] = [
  NIGERIA,
  ...FEATURED,
  ...REST_OF_WORLD.filter((c) => !FEATURED_CODES.includes(c.code)),
];

export function flagUrl(code: string): string {
  return `https://flagcdn.com/w80/${code}.png`;
}
