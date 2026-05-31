// countries.js — complete world country list
// Format: "3-letter-code": ["iso2", "name"]
const C = {
  // Europe
  alb:["al","Albania"], and:["ad","Andorra"], arm:["am","Armenia"],
  aut:["at","Austria"], aze:["az","Azerbaijan"], bel:["be","Belgium"],
  bgr:["bg","Bulgaria"], bih:["ba","Bosnia & Herzegovina"], blr:["by","Belarus"],
  che:["ch","Switzerland"], swi:["ch","Switzerland"], cyp:["cy","Cyprus"],
  cze:["cz","Czech Republic"], dnk:["dk","Denmark"], est:["ee","Estonia"],
  fin:["fi","Finland"], fra:["fr","France"], fro:["fo","Faroe Islands"],
  gbr:["gb","United Kingdom"], geo:["ge","Georgia"], ger:["de","Germany"],
  deu:["de","Germany"], gib:["gi","Gibraltar"], grc:["gr","Greece"],
  hrv:["hr","Croatia"], hun:["hu","Hungary"], isl:["is","Iceland"],
  irl:["ie","Ireland"], ita:["it","Italy"], kos:["xk","Kosovo"],
  lie:["li","Liechtenstein"], ltu:["lt","Lithuania"], lux:["lu","Luxembourg"],
  lva:["lv","Latvia"], mco:["mc","Monaco"], mda:["md","Moldova"],
  mkd:["mk","North Macedonia"], mlt:["mt","Malta"], mne:["me","Montenegro"],
  nld:["nl","Netherlands"], nor:["no","Norway"], pol:["pl","Poland"],
  prt:["pt","Portugal"], rou:["ro","Romania"], rus:["ru","Russia"],
  smr:["sm","San Marino"], srb:["rs","Serbia"], svk:["sk","Slovakia"],
  svn:["si","Slovenia"], swe:["se","Sweden"], tur:["tr","Turkey"],
  ukr:["ua","Ukraine"], vat:["va","Vatican"],
  // Americas
  arg:["ar","Argentina"], bol:["bo","Bolivia"], bra:["br","Brazil"],
  can:["ca","Canada"], chl:["cl","Chile"], col:["co","Colombia"],
  cri:["cr","Costa Rica"], cub:["cu","Cuba"], dom:["do","Dominican Republic"],
  ecu:["ec","Ecuador"], gtm:["gt","Guatemala"], hnd:["hn","Honduras"],
  jam:["jm","Jamaica"], mex:["mx","Mexico"], nic:["ni","Nicaragua"],
  pan:["pa","Panama"], per:["pe","Peru"], pri:["pr","Puerto Rico"],
  pry:["py","Paraguay"], slv:["sv","El Salvador"], tto:["tt","Trinidad & Tobago"],
  usa:["us","USA"], ury:["uy","Uruguay"], ven:["ve","Venezuela"],
  // Asia
  afg:["af","Afghanistan"], are:["ae","UAE"], bgd:["bd","Bangladesh"],
  bhr:["bh","Bahrain"], brn:["bn","Brunei"], chn:["cn","China"],
  hkg:["hk","Hong Kong"], idn:["id","Indonesia"], ind:["in","India"],
  irn:["ir","Iran"], irq:["iq","Iraq"], isr:["il","Israel"],
  jor:["jo","Jordan"], jpn:["jp","Japan"], kaz:["kz","Kazakhstan"],
  khm:["kh","Cambodia"], kor:["kr","South Korea"], kwt:["kw","Kuwait"],
  kgz:["kg","Kyrgyzstan"], lao:["la","Laos"], lbn:["lb","Lebanon"],
  lka:["lk","Sri Lanka"], mac:["mo","Macau"], mmr:["mm","Myanmar"],
  mng:["mn","Mongolia"], mys:["my","Malaysia"], npl:["np","Nepal"],
  omn:["om","Oman"], pak:["pk","Pakistan"], phl:["ph","Philippines"],
  prk:["kp","North Korea"], qat:["qa","Qatar"], sau:["sa","Saudi Arabia"],
  sgp:["sg","Singapore"], syr:["sy","Syria"], tha:["th","Thailand"],
  tjk:["tj","Tajikistan"], tkm:["tm","Turkmenistan"], twn:["tw","Taiwan"],
  uzb:["uz","Uzbekistan"], vnm:["vn","Vietnam"], yem:["ye","Yemen"],
  // Africa
  ago:["ao","Angola"], bfa:["bf","Burkina Faso"], bdi:["bi","Burundi"],
  ben:["bj","Benin"], bwa:["bw","Botswana"], caf:["cf","Central African Republic"],
  civ:["ci","Ivory Coast"], cmr:["cm","Cameroon"], cod:["cd","DR Congo"],
  cog:["cg","Congo"], com:["km","Comoros"], cpv:["cv","Cape Verde"],
  dji:["dj","Djibouti"], dza:["dz","Algeria"], egy:["eg","Egypt"],
  eri:["er","Eritrea"], eth:["et","Ethiopia"], gab:["ga","Gabon"],
  gha:["gh","Ghana"], gin:["gn","Guinea"], gmb:["gm","Gambia"],
  gnb:["gw","Guinea-Bissau"], gnq:["gq","Equatorial Guinea"],
  ken:["ke","Kenya"], lbr:["lr","Liberia"], lby:["ly","Libya"],
  lso:["ls","Lesotho"], mar:["ma","Morocco"], mdg:["mg","Madagascar"],
  mli:["ml","Mali"], moz:["mz","Mozambique"], mrt:["mr","Mauritania"],
  mus:["mu","Mauritius"], mwi:["mw","Malawi"], nam:["na","Namibia"],
  ner:["ne","Niger"], nga:["ng","Nigeria"], rwa:["rw","Rwanda"],
  sdn:["sd","Sudan"], sen:["sn","Senegal"], sle:["sl","Sierra Leone"],
  som:["so","Somalia"], ssd:["ss","South Sudan"], stp:["st","São Tomé"],
  swz:["sz","Eswatini"], syc:["sc","Seychelles"], tcd:["td","Chad"],
  tgo:["tg","Togo"], tun:["tn","Tunisia"], tza:["tz","Tanzania"],
  uga:["ug","Uganda"], zaf:["za","South Africa"], zmb:["zm","Zambia"],
  zwe:["zw","Zimbabwe"],
  // Oceania
  aus:["au","Australia"], fji:["fj","Fiji"], nzl:["nz","New Zealand"],
  png:["pg","Papua New Guinea"], slb:["sb","Solomon Islands"],
  ton:["to","Tonga"], vut:["vu","Vanuatu"], wsm:["ws","Samoa"],
};

export const ALL_COUNTRIES = C;

export function resolveCountry(raw) {
  if (!raw?.trim()) return null;
  const stripped = raw.trim();
  // 1. Exact 3-letter code match (most reliable)
  const exactKey = stripped.toLowerCase().replace(/[^a-z]/g, "");
  if (exactKey.length === 3 && C[exactKey]) {
    return { iso2: C[exactKey][0], name: C[exactKey][1] };
  }
  // 2. Match by full name (case-insensitive) — must come before truncation
  const byName = Object.values(C).find(v => v[1].toLowerCase() === stripped.toLowerCase());
  if (byName) return { iso2: byName[0], name: byName[1] };
  // 3. Partial match only if input is short (1-3 chars typed as code)
  if (exactKey.length <= 3) {
    const partial = C[exactKey.slice(0, 3)];
    if (partial) return { iso2: partial[0], name: partial[1] };
  }
  return { iso2: null, name: stripped };
}

export function flagUrl(iso2) {
  return `https://flagcdn.com/20x15/${iso2.toLowerCase()}.png`;
}

// All unique countries as [{iso2, name}] sorted by name, for autocomplete
export const COUNTRY_LIST = [...new Map(
  Object.values(C).map(v => [v[1], { iso2: v[0], name: v[1] }])
).values()].sort((a, b) => a.name.localeCompare(b.name));
