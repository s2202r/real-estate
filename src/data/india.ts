/**
 * Indian states, union territories and cities.
 *
 * WHY THIS EXISTS
 * ---------------
 * `supportedCities` in `config/app.ts` is the list of cities the platform
 * OPERATES in — the ones the home page promotes and the header scopes to.
 * That is a business decision and stays short.
 *
 * This is a different list: everywhere in India an agent may actually hold
 * inventory, and everywhere a customer may want to buy. Agents used to type
 * their state by hand and pick from ten cities, which meant "Bangalore",
 * "Bengaluru" and "bengaluru" all reached the database as different places.
 * A closed list makes city and state comparable, which is what locality
 * filters, duplicate detection and visit routing all depend on.
 *
 * ON TIERS
 * --------
 * There is no official five-tier classification of Indian cities. The
 * government's classes for house-rent allowance are X, Y and Z; those map to
 * tiers 1, 2 and 3 here. Tiers 4 and 5 are a practical grouping of smaller
 * district towns and emerging markets, used only for ordering suggestions —
 * never for pricing, eligibility or any rule a user is subject to.
 *
 * The list is curated, not a census: about six hundred and sixty cities and
 * towns where property is actually transacted, not every settlement in India.
 * It is plain data with no imports, so server and client can both hold it.
 */

export type CityTier = 1 | 2 | 3 | 4 | 5;

export interface IndianState {
  readonly name: string;
  /** ISO-3166-2 style short code, used as the key of the city table. */
  readonly code: string;
  readonly kind: "state" | "ut";
}

export interface IndianCity {
  readonly name: string;
  /** Unique across India: names that repeat carry their state code. */
  readonly slug: string;
  readonly state: string;
  readonly stateCode: string;
  readonly tier: CityTier;
}

export const indianStates: readonly IndianState[] = [
  { name: "Andhra Pradesh", code: "AP", kind: "state" },
  { name: "Arunachal Pradesh", code: "AR", kind: "state" },
  { name: "Assam", code: "AS", kind: "state" },
  { name: "Bihar", code: "BR", kind: "state" },
  { name: "Chhattisgarh", code: "CG", kind: "state" },
  { name: "Goa", code: "GA", kind: "state" },
  { name: "Gujarat", code: "GJ", kind: "state" },
  { name: "Haryana", code: "HR", kind: "state" },
  { name: "Himachal Pradesh", code: "HP", kind: "state" },
  { name: "Jharkhand", code: "JH", kind: "state" },
  { name: "Karnataka", code: "KA", kind: "state" },
  { name: "Kerala", code: "KL", kind: "state" },
  { name: "Madhya Pradesh", code: "MP", kind: "state" },
  { name: "Maharashtra", code: "MH", kind: "state" },
  { name: "Manipur", code: "MN", kind: "state" },
  { name: "Meghalaya", code: "ML", kind: "state" },
  { name: "Mizoram", code: "MZ", kind: "state" },
  { name: "Nagaland", code: "NL", kind: "state" },
  { name: "Odisha", code: "OD", kind: "state" },
  { name: "Punjab", code: "PB", kind: "state" },
  { name: "Rajasthan", code: "RJ", kind: "state" },
  { name: "Sikkim", code: "SK", kind: "state" },
  { name: "Tamil Nadu", code: "TN", kind: "state" },
  { name: "Telangana", code: "TS", kind: "state" },
  { name: "Tripura", code: "TR", kind: "state" },
  { name: "Uttar Pradesh", code: "UP", kind: "state" },
  { name: "Uttarakhand", code: "UK", kind: "state" },
  { name: "West Bengal", code: "WB", kind: "state" },
  { name: "Andaman and Nicobar Islands", code: "AN", kind: "ut" },
  { name: "Chandigarh", code: "CH", kind: "ut" },
  { name: "Dadra and Nagar Haveli and Daman and Diu", code: "DH", kind: "ut" },
  { name: "Delhi", code: "DL", kind: "ut" },
  { name: "Jammu and Kashmir", code: "JK", kind: "ut" },
  { name: "Ladakh", code: "LA", kind: "ut" },
  { name: "Lakshadweep", code: "LD", kind: "ut" },
  { name: "Puducherry", code: "PY", kind: "ut" },
];

/** state code → [name, tier, slug], ordered by tier then name. */
const CITY_TABLE: Record<string, readonly (readonly [string, CityTier, string])[]> = {
  AP: [
    ["Guntur", 2, "guntur"],
    ["Kurnool", 2, "kurnool"],
    ["Nellore", 2, "nellore"],
    ["Rajahmundry", 2, "rajahmundry"],
    ["Vijayawada", 2, "vijayawada"],
    ["Visakhapatnam", 2, "visakhapatnam"],
    ["Amaravati", 3, "amaravati"],
    ["Anantapur", 3, "anantapur"],
    ["Eluru", 3, "eluru"],
    ["Kadapa", 3, "kadapa"],
    ["Kakinada", 3, "kakinada"],
    ["Machilipatnam", 3, "machilipatnam"],
    ["Nandyal", 3, "nandyal"],
    ["Ongole", 3, "ongole"],
    ["Tirupati", 3, "tirupati"],
    ["Vizianagaram", 3, "vizianagaram"],
    ["Adoni", 4, "adoni"],
    ["Bhimavaram", 4, "bhimavaram"],
    ["Chittoor", 4, "chittoor"],
    ["Dharmavaram", 4, "dharmavaram"],
    ["Gudivada", 4, "gudivada"],
    ["Guntakal", 4, "guntakal"],
    ["Hindupur", 4, "hindupur"],
    ["Madanapalle", 4, "madanapalle"],
    ["Narasaraopet", 4, "narasaraopet"],
    ["Proddatur", 4, "proddatur"],
    ["Srikakulam", 4, "srikakulam"],
    ["Tenali", 4, "tenali"],
    ["Chilakaluripet", 5, "chilakaluripet"],
    ["Markapur", 5, "markapur"],
    ["Palakollu", 5, "palakollu"],
    ["Puttaparthi", 5, "puttaparthi"],
    ["Tadepalligudem", 5, "tadepalligudem"],
    ["Tadipatri", 5, "tadipatri"],
  ],
  AR: [
    ["Itanagar", 3, "itanagar"],
    ["Naharlagun", 4, "naharlagun"],
    ["Pasighat", 4, "pasighat"],
    ["Along", 5, "along"],
    ["Bomdila", 5, "bomdila"],
    ["Namsai", 5, "namsai"],
    ["Roing", 5, "roing"],
    ["Tawang", 5, "tawang"],
    ["Tezu", 5, "tezu"],
    ["Ziro", 5, "ziro"],
  ],
  AS: [
    ["Guwahati", 2, "guwahati"],
    ["Dibrugarh", 3, "dibrugarh"],
    ["Jorhat", 3, "jorhat"],
    ["Nagaon", 3, "nagaon"],
    ["Silchar", 3, "silchar"],
    ["Bongaigaon", 4, "bongaigaon"],
    ["Dhubri", 4, "dhubri"],
    ["Diphu", 4, "diphu"],
    ["Karimganj", 4, "karimganj"],
    ["North Lakhimpur", 4, "north-lakhimpur"],
    ["Sivasagar", 4, "sivasagar"],
    ["Tezpur", 4, "tezpur"],
    ["Tinsukia", 4, "tinsukia"],
    ["Barpeta", 5, "barpeta"],
    ["Goalpara", 5, "goalpara"],
    ["Golaghat", 5, "golaghat"],
    ["Haflong", 5, "haflong"],
    ["Hailakandi", 5, "hailakandi"],
    ["Mangaldoi", 5, "mangaldoi"],
    ["Nalbari", 5, "nalbari"],
  ],
  BR: [
    ["Patna", 2, "patna"],
    ["Bhagalpur", 3, "bhagalpur"],
    ["Bihar Sharif", 3, "bihar-sharif"],
    ["Darbhanga", 3, "darbhanga"],
    ["Gaya", 3, "gaya"],
    ["Muzaffarpur", 3, "muzaffarpur"],
    ["Purnia", 3, "purnia"],
    ["Arrah", 4, "arrah"],
    ["Begusarai", 4, "begusarai"],
    ["Chhapra", 4, "chhapra"],
    ["Danapur", 4, "danapur"],
    ["Dehri", 4, "dehri"],
    ["Hajipur", 4, "hajipur"],
    ["Katihar", 4, "katihar"],
    ["Motihari", 4, "motihari"],
    ["Munger", 4, "munger"],
    ["Saharsa", 4, "saharsa"],
    ["Sasaram", 4, "sasaram"],
    ["Siwan", 4, "siwan"],
    ["Aurangabad", 5, "aurangabad-br"],
    ["Bagaha", 5, "bagaha"],
    ["Bettiah", 5, "bettiah"],
    ["Buxar", 5, "buxar"],
    ["Jamalpur", 5, "jamalpur"],
    ["Jehanabad", 5, "jehanabad"],
    ["Kishanganj", 5, "kishanganj"],
    ["Madhubani", 5, "madhubani"],
    ["Nawada", 5, "nawada"],
    ["Samastipur", 5, "samastipur"],
    ["Sitamarhi", 5, "sitamarhi"],
  ],
  CG: [
    ["Bhilai", 2, "bhilai"],
    ["Bilaspur", 2, "bilaspur-cg"],
    ["Raipur", 2, "raipur"],
    ["Durg", 3, "durg"],
    ["Korba", 3, "korba"],
    ["Ambikapur", 4, "ambikapur"],
    ["Dhamtari", 4, "dhamtari"],
    ["Jagdalpur", 4, "jagdalpur"],
    ["Naya Raipur", 4, "naya-raipur"],
    ["Raigarh", 4, "raigarh"],
    ["Rajnandgaon", 4, "rajnandgaon"],
    ["Chirmiri", 5, "chirmiri"],
    ["Janjgir", 5, "janjgir"],
    ["Kanker", 5, "kanker"],
    ["Mahasamund", 5, "mahasamund"],
  ],
  GA: [
    ["Panaji", 2, "panaji"],
    ["Margao", 3, "margao"],
    ["Vasco da Gama", 3, "vasco-da-gama"],
    ["Calangute", 4, "calangute"],
    ["Mapusa", 4, "mapusa"],
    ["Ponda", 4, "ponda"],
    ["Porvorim", 4, "porvorim"],
    ["Bicholim", 5, "bicholim"],
    ["Canacona", 5, "canacona"],
    ["Curchorem", 5, "curchorem"],
  ],
  GJ: [
    ["Ahmedabad", 1, "ahmedabad"],
    ["Bhavnagar", 2, "bhavnagar"],
    ["Jamnagar", 2, "jamnagar"],
    ["Rajkot", 2, "rajkot"],
    ["Surat", 2, "surat"],
    ["Vadodara", 2, "vadodara"],
    ["Anand", 3, "anand"],
    ["Bharuch", 3, "bharuch"],
    ["Gandhinagar", 3, "gandhinagar"],
    ["Junagadh", 3, "junagadh"],
    ["Mehsana", 3, "mehsana"],
    ["Nadiad", 3, "nadiad"],
    ["Navsari", 3, "navsari"],
    ["Vapi", 3, "vapi"],
    ["Ankleshwar", 4, "ankleshwar"],
    ["Bhuj", 4, "bhuj"],
    ["Gandhidham", 4, "gandhidham"],
    ["Godhra", 4, "godhra"],
    ["Morbi", 4, "morbi"],
    ["Palanpur", 4, "palanpur"],
    ["Porbandar", 4, "porbandar"],
    ["Sanand", 4, "sanand"],
    ["Surendranagar", 4, "surendranagar"],
    ["Valsad", 4, "valsad"],
    ["Veraval", 4, "veraval"],
    ["Amreli", 5, "amreli"],
    ["Botad", 5, "botad"],
    ["Dahod", 5, "dahod"],
    ["Deesa", 5, "deesa"],
    ["Dholera", 5, "dholera"],
    ["Himatnagar", 5, "himatnagar"],
    ["Jetpur", 5, "jetpur"],
    ["Kalol", 5, "kalol"],
    ["Patan", 5, "patan"],
  ],
  HR: [
    ["Faridabad", 2, "faridabad"],
    ["Gurgaon", 2, "gurgaon"],
    ["Karnal", 2, "karnal"],
    ["Ambala", 3, "ambala"],
    ["Bahadurgarh", 3, "bahadurgarh"],
    ["Hisar", 3, "hisar"],
    ["Manesar", 3, "manesar"],
    ["Panchkula", 3, "panchkula"],
    ["Panipat", 3, "panipat"],
    ["Rohtak", 3, "rohtak"],
    ["Sonipat", 3, "sonipat"],
    ["Yamunanagar", 3, "yamunanagar"],
    ["Bhiwani", 4, "bhiwani"],
    ["Jind", 4, "jind"],
    ["Kaithal", 4, "kaithal"],
    ["Kurukshetra", 4, "kurukshetra"],
    ["Palwal", 4, "palwal"],
    ["Rewari", 4, "rewari"],
    ["Sirsa", 4, "sirsa"],
    ["Charkhi Dadri", 5, "charkhi-dadri"],
    ["Fatehabad", 5, "fatehabad"],
    ["Gohana", 5, "gohana"],
    ["Hansi", 5, "hansi"],
    ["Jhajjar", 5, "jhajjar"],
    ["Narnaul", 5, "narnaul"],
    ["Nuh", 5, "nuh"],
    ["Pinjore", 5, "pinjore"],
    ["Thanesar", 5, "thanesar"],
  ],
  HP: [
    ["Hamirpur", 2, "hamirpur"],
    ["Shimla", 2, "shimla"],
    ["Baddi", 3, "baddi"],
    ["Dharamshala", 3, "dharamshala"],
    ["Solan", 3, "solan"],
    ["Bilaspur", 4, "bilaspur-hp"],
    ["Kullu", 4, "kullu"],
    ["Manali", 4, "manali"],
    ["Mandi", 4, "mandi"],
    ["Una", 4, "una"],
    ["Chamba", 5, "chamba"],
    ["Dalhousie", 5, "dalhousie"],
    ["Kangra", 5, "kangra"],
    ["Kasauli", 5, "kasauli"],
    ["Keylong", 5, "keylong"],
    ["Nahan", 5, "nahan"],
    ["Palampur", 5, "palampur"],
    ["Paonta Sahib", 5, "paonta-sahib"],
    ["Reckong Peo", 5, "reckong-peo"],
  ],
  JH: [
    ["Bokaro Steel City", 2, "bokaro-steel-city"],
    ["Dhanbad", 2, "dhanbad"],
    ["Jamshedpur", 2, "jamshedpur"],
    ["Ranchi", 2, "ranchi"],
    ["Deoghar", 3, "deoghar"],
    ["Giridih", 4, "giridih"],
    ["Hazaribagh", 4, "hazaribagh"],
    ["Medininagar", 4, "medininagar"],
    ["Phusro", 4, "phusro"],
    ["Ramgarh", 4, "ramgarh"],
    ["Chaibasa", 5, "chaibasa"],
    ["Chatra", 5, "chatra"],
    ["Dumka", 5, "dumka"],
    ["Godda", 5, "godda"],
    ["Gumla", 5, "gumla"],
    ["Jhumri Telaiya", 5, "jhumri-telaiya"],
    ["Lohardaga", 5, "lohardaga"],
    ["Sahibganj", 5, "sahibganj"],
  ],
  KA: [
    ["Bengaluru", 1, "bengaluru"],
    ["Belagavi", 2, "belagavi"],
    ["Dharwad", 2, "dharwad"],
    ["Hubballi", 2, "hubballi"],
    ["Mangaluru", 2, "mangaluru"],
    ["Mysuru", 2, "mysuru"],
    ["Ballari", 3, "ballari"],
    ["Davanagere", 3, "davanagere"],
    ["Kalaburagi", 3, "kalaburagi"],
    ["Shivamogga", 3, "shivamogga"],
    ["Tumakuru", 3, "tumakuru"],
    ["Udupi", 3, "udupi"],
    ["Vijayapura", 3, "vijayapura"],
    ["Bagalkot", 4, "bagalkot"],
    ["Bidar", 4, "bidar"],
    ["Chikkaballapur", 4, "chikkaballapur"],
    ["Chikkamagaluru", 4, "chikkamagaluru"],
    ["Chitradurga", 4, "chitradurga"],
    ["Devanahalli", 4, "devanahalli"],
    ["Gadag", 4, "gadag"],
    ["Hassan", 4, "hassan"],
    ["Hospet", 4, "hospet"],
    ["Kolar", 4, "kolar"],
    ["Mandya", 4, "mandya"],
    ["Raichur", 4, "raichur"],
    ["Ramanagara", 4, "ramanagara"],
    ["Doddaballapur", 5, "doddaballapur"],
    ["Haveri", 5, "haveri"],
    ["Karwar", 5, "karwar"],
    ["Madikeri", 5, "madikeri"],
    ["Nelamangala", 5, "nelamangala"],
    ["Ranebennur", 5, "ranebennur"],
    ["Robertsonpet", 5, "robertsonpet"],
    ["Yadgir", 5, "yadgir"],
  ],
  KL: [
    ["Kannur", 2, "kannur"],
    ["Kochi", 2, "kochi"],
    ["Kollam", 2, "kollam"],
    ["Kozhikode", 2, "kozhikode"],
    ["Malappuram", 2, "malappuram"],
    ["Thiruvananthapuram", 2, "thiruvananthapuram"],
    ["Thrissur", 2, "thrissur"],
    ["Alappuzha", 3, "alappuzha"],
    ["Aluva", 3, "aluva"],
    ["Kottayam", 3, "kottayam"],
    ["Palakkad", 3, "palakkad"],
    ["Kasaragod", 4, "kasaragod"],
    ["Manjeri", 4, "manjeri"],
    ["Pathanamthitta", 4, "pathanamthitta"],
    ["Thalassery", 4, "thalassery"],
    ["Changanassery", 5, "changanassery"],
    ["Guruvayur", 5, "guruvayur"],
    ["Idukki", 5, "idukki"],
    ["Kochi Infopark", 5, "kochi-infopark"],
    ["Munnar", 5, "munnar"],
    ["Perinthalmanna", 5, "perinthalmanna"],
    ["Ponnani", 5, "ponnani"],
    ["Varkala", 5, "varkala"],
    ["Wayanad", 5, "wayanad"],
  ],
  MP: [
    ["Bhopal", 2, "bhopal"],
    ["Gwalior", 2, "gwalior"],
    ["Indore", 2, "indore"],
    ["Jabalpur", 2, "jabalpur"],
    ["Ujjain", 2, "ujjain"],
    ["Dewas", 3, "dewas"],
    ["Ratlam", 3, "ratlam"],
    ["Rewa", 3, "rewa"],
    ["Sagar", 3, "sagar"],
    ["Satna", 3, "satna"],
    ["Bhind", 4, "bhind"],
    ["Burhanpur", 4, "burhanpur"],
    ["Chhindwara", 4, "chhindwara"],
    ["Guna", 4, "guna"],
    ["Katni", 4, "katni"],
    ["Khandwa", 4, "khandwa"],
    ["Morena", 4, "morena"],
    ["Pithampur", 4, "pithampur"],
    ["Shivpuri", 4, "shivpuri"],
    ["Singrauli", 4, "singrauli"],
    ["Vidisha", 4, "vidisha"],
    ["Betul", 5, "betul"],
    ["Chhatarpur", 5, "chhatarpur"],
    ["Damoh", 5, "damoh"],
    ["Hoshangabad", 5, "hoshangabad"],
    ["Itarsi", 5, "itarsi"],
    ["Khargone", 5, "khargone"],
    ["Mandsaur", 5, "mandsaur"],
    ["Neemuch", 5, "neemuch"],
    ["Sehore", 5, "sehore"],
  ],
  MH: [
    ["Mumbai", 1, "mumbai"],
    ["Pune", 1, "pune"],
    ["Amravati", 2, "amravati"],
    ["Aurangabad", 2, "aurangabad-mh"],
    ["Bhiwandi", 2, "bhiwandi"],
    ["Dombivli", 2, "dombivli"],
    ["Kalyan", 2, "kalyan"],
    ["Kolhapur", 2, "kolhapur"],
    ["Nagpur", 2, "nagpur"],
    ["Nanded", 2, "nanded"],
    ["Nashik", 2, "nashik"],
    ["Navi Mumbai", 2, "navi-mumbai"],
    ["Pimpri-Chinchwad", 2, "pimpri-chinchwad"],
    ["Sangli", 2, "sangli"],
    ["Solapur", 2, "solapur"],
    ["Thane", 2, "thane"],
    ["Vasai-Virar", 2, "vasai-virar"],
    ["Ahmednagar", 3, "ahmednagar"],
    ["Akola", 3, "akola"],
    ["Chandrapur", 3, "chandrapur"],
    ["Dhule", 3, "dhule"],
    ["Jalgaon", 3, "jalgaon"],
    ["Latur", 3, "latur"],
    ["Mira-Bhayandar", 3, "mira-bhayandar"],
    ["Panvel", 3, "panvel"],
    ["Ulhasnagar", 3, "ulhasnagar"],
    ["Ambernath", 4, "ambernath"],
    ["Badlapur", 4, "badlapur"],
    ["Beed", 4, "beed"],
    ["Ichalkaranji", 4, "ichalkaranji"],
    ["Jalna", 4, "jalna"],
    ["Lonavala", 4, "lonavala"],
    ["Palghar", 4, "palghar"],
    ["Parbhani", 4, "parbhani"],
    ["Ratnagiri", 4, "ratnagiri"],
    ["Satara", 4, "satara"],
    ["Wardha", 4, "wardha"],
    ["Yavatmal", 4, "yavatmal"],
    ["Alibag", 5, "alibag"],
    ["Baramati", 5, "baramati"],
    ["Boisar", 5, "boisar"],
    ["Karjat", 5, "karjat"],
    ["Khopoli", 5, "khopoli"],
    ["Nandurbar", 5, "nandurbar"],
    ["Osmanabad", 5, "osmanabad"],
    ["Shirdi", 5, "shirdi"],
    ["Sindhudurg", 5, "sindhudurg"],
    ["Talegaon Dabhade", 5, "talegaon-dabhade"],
  ],
  MN: [
    ["Imphal", 3, "imphal"],
    ["Bishnupur", 5, "bishnupur"],
    ["Churachandpur", 5, "churachandpur"],
    ["Kakching", 5, "kakching"],
    ["Senapati", 5, "senapati"],
    ["Thoubal", 5, "thoubal"],
    ["Ukhrul", 5, "ukhrul"],
  ],
  ML: [
    ["Shillong", 3, "shillong"],
    ["Tura", 4, "tura"],
    ["Baghmara", 5, "baghmara"],
    ["Jowai", 5, "jowai"],
    ["Nongstoin", 5, "nongstoin"],
    ["Williamnagar", 5, "williamnagar"],
  ],
  MZ: [
    ["Aizawl", 3, "aizawl"],
    ["Champhai", 5, "champhai"],
    ["Kolasib", 5, "kolasib"],
    ["Lunglei", 5, "lunglei"],
    ["Saiha", 5, "saiha"],
    ["Serchhip", 5, "serchhip"],
  ],
  NL: [
    ["Dimapur", 3, "dimapur"],
    ["Kohima", 4, "kohima"],
    ["Mokokchung", 5, "mokokchung"],
    ["Tuensang", 5, "tuensang"],
    ["Wokha", 5, "wokha"],
    ["Zunheboto", 5, "zunheboto"],
  ],
  OD: [
    ["Bhubaneswar", 2, "bhubaneswar"],
    ["Cuttack", 2, "cuttack"],
    ["Rourkela", 2, "rourkela"],
    ["Berhampur", 3, "berhampur"],
    ["Puri", 3, "puri"],
    ["Sambalpur", 3, "sambalpur"],
    ["Angul", 4, "angul"],
    ["Balasore", 4, "balasore"],
    ["Baripada", 4, "baripada"],
    ["Bhadrak", 4, "bhadrak"],
    ["Jharsuguda", 4, "jharsuguda"],
    ["Bargarh", 5, "bargarh"],
    ["Dhenkanal", 5, "dhenkanal"],
    ["Jeypore", 5, "jeypore"],
    ["Kendujhar", 5, "kendujhar"],
    ["Koraput", 5, "koraput"],
    ["Paradip", 5, "paradip"],
    ["Rayagada", 5, "rayagada"],
    ["Talcher", 5, "talcher"],
  ],
  PB: [
    ["Amritsar", 2, "amritsar"],
    ["Jalandhar", 2, "jalandhar"],
    ["Ludhiana", 2, "ludhiana"],
    ["Bathinda", 3, "bathinda"],
    ["Mohali", 3, "mohali"],
    ["Patiala", 3, "patiala"],
    ["Zirakpur", 3, "zirakpur"],
    ["Batala", 4, "batala"],
    ["Firozpur", 4, "firozpur"],
    ["Hoshiarpur", 4, "hoshiarpur"],
    ["Moga", 4, "moga"],
    ["Pathankot", 4, "pathankot"],
    ["Phagwara", 4, "phagwara"],
    ["Barnala", 5, "barnala"],
    ["Faridkot", 5, "faridkot"],
    ["Kapurthala", 5, "kapurthala"],
    ["Khanna", 5, "khanna"],
    ["Malerkotla", 5, "malerkotla"],
    ["Muktsar", 5, "muktsar"],
    ["Nangal", 5, "nangal"],
    ["Rajpura", 5, "rajpura"],
    ["Ropar", 5, "ropar"],
    ["Sangrur", 5, "sangrur"],
  ],
  RJ: [
    ["Ajmer", 2, "ajmer"],
    ["Bikaner", 2, "bikaner"],
    ["Jaipur", 2, "jaipur"],
    ["Jodhpur", 2, "jodhpur"],
    ["Kota", 2, "kota"],
    ["Alwar", 3, "alwar"],
    ["Bhilwara", 3, "bhilwara"],
    ["Sikar", 3, "sikar"],
    ["Udaipur", 3, "udaipur-rj"],
    ["Beawar", 4, "beawar"],
    ["Bharatpur", 4, "bharatpur"],
    ["Chittorgarh", 4, "chittorgarh"],
    ["Hanumangarh", 4, "hanumangarh"],
    ["Jaisalmer", 4, "jaisalmer"],
    ["Jhunjhunu", 4, "jhunjhunu"],
    ["Kishangarh", 4, "kishangarh"],
    ["Pali", 4, "pali"],
    ["Sri Ganganagar", 4, "sri-ganganagar"],
    ["Banswara", 5, "banswara"],
    ["Behror", 5, "behror"],
    ["Bundi", 5, "bundi"],
    ["Dausa", 5, "dausa"],
    ["Mount Abu", 5, "mount-abu"],
    ["Nagaur", 5, "nagaur"],
    ["Neemrana", 5, "neemrana"],
    ["Sawai Madhopur", 5, "sawai-madhopur"],
    ["Tonk", 5, "tonk"],
  ],
  SK: [
    ["Gangtok", 4, "gangtok"],
    ["Gyalshing", 5, "gyalshing"],
    ["Mangan", 5, "mangan"],
    ["Namchi", 5, "namchi"],
    ["Rangpo", 5, "rangpo"],
  ],
  TN: [
    ["Chennai", 1, "chennai"],
    ["Coimbatore", 2, "coimbatore"],
    ["Erode", 2, "erode"],
    ["Madurai", 2, "madurai"],
    ["Thanjavur", 2, "thanjavur"],
    ["Tiruchirappalli", 2, "tiruchirappalli"],
    ["Tirunelveli", 2, "tirunelveli"],
    ["Tiruppur", 2, "tiruppur"],
    ["Vellore", 2, "vellore"],
    ["Ambattur", 3, "ambattur"],
    ["Avadi", 3, "avadi"],
    ["Dindigul", 3, "dindigul"],
    ["Hosur", 3, "hosur"],
    ["Kancheepuram", 3, "kancheepuram"],
    ["Nagercoil", 3, "nagercoil"],
    ["Salem", 3, "salem"],
    ["Tambaram", 3, "tambaram"],
    ["Thoothukudi", 3, "thoothukudi"],
    ["Chengalpattu", 4, "chengalpattu"],
    ["Cuddalore", 4, "cuddalore"],
    ["Karur", 4, "karur"],
    ["Krishnagiri", 4, "krishnagiri"],
    ["Namakkal", 4, "namakkal"],
    ["Ooty", 4, "ooty"],
    ["Pudukkottai", 4, "pudukkottai"],
    ["Rajapalayam", 4, "rajapalayam"],
    ["Sivakasi", 4, "sivakasi"],
    ["Sriperumbudur", 4, "sriperumbudur"],
    ["Tiruvannamalai", 4, "tiruvannamalai"],
    ["Villupuram", 4, "villupuram"],
    ["Ariyalur", 5, "ariyalur"],
    ["Kodaikanal", 5, "kodaikanal"],
    ["Mahabalipuram", 5, "mahabalipuram"],
    ["Perambalur", 5, "perambalur"],
    ["Ramanathapuram", 5, "ramanathapuram"],
    ["Virudhunagar", 5, "virudhunagar"],
  ],
  TS: [
    ["Hyderabad", 1, "hyderabad"],
    ["Secunderabad", 2, "secunderabad"],
    ["Warangal", 2, "warangal"],
    ["Karimnagar", 3, "karimnagar"],
    ["Khammam", 3, "khammam"],
    ["Nizamabad", 3, "nizamabad"],
    ["Adilabad", 4, "adilabad"],
    ["Mahbubnagar", 4, "mahbubnagar"],
    ["Nalgonda", 4, "nalgonda"],
    ["Ramagundam", 4, "ramagundam"],
    ["Sangareddy", 4, "sangareddy"],
    ["Shamshabad", 4, "shamshabad"],
    ["Siddipet", 4, "siddipet"],
    ["Suryapet", 4, "suryapet"],
    ["Bhongir", 5, "bhongir"],
    ["Jagtial", 5, "jagtial"],
    ["Kothagudem", 5, "kothagudem"],
    ["Medak", 5, "medak"],
    ["Miryalaguda", 5, "miryalaguda"],
    ["Zaheerabad", 5, "zaheerabad"],
  ],
  TR: [
    ["Agartala", 3, "agartala"],
    ["Ambassa", 5, "ambassa"],
    ["Belonia", 5, "belonia"],
    ["Dharmanagar", 5, "dharmanagar"],
    ["Kailashahar", 5, "kailashahar"],
    ["Udaipur", 5, "udaipur-tr"],
  ],
  UP: [
    ["Agra", 2, "agra"],
    ["Aligarh", 2, "aligarh"],
    ["Bareilly", 2, "bareilly"],
    ["Firozabad", 2, "firozabad"],
    ["Ghaziabad", 2, "ghaziabad"],
    ["Gorakhpur", 2, "gorakhpur"],
    ["Greater Noida", 2, "greater-noida"],
    ["Jhansi", 2, "jhansi"],
    ["Kanpur", 2, "kanpur"],
    ["Lucknow", 2, "lucknow"],
    ["Mathura", 2, "mathura"],
    ["Meerut", 2, "meerut"],
    ["Moradabad", 2, "moradabad"],
    ["Noida", 2, "noida"],
    ["Prayagraj", 2, "prayagraj"],
    ["Varanasi", 2, "varanasi"],
    ["Ayodhya", 3, "ayodhya"],
    ["Bulandshahr", 3, "bulandshahr"],
    ["Hapur", 3, "hapur"],
    ["Muzaffarnagar", 3, "muzaffarnagar"],
    ["Rampur", 3, "rampur"],
    ["Saharanpur", 3, "saharanpur"],
    ["Shahjahanpur", 3, "shahjahanpur"],
    ["Amroha", 4, "amroha"],
    ["Azamgarh", 4, "azamgarh"],
    ["Bahraich", 4, "bahraich"],
    ["Barabanki", 4, "barabanki"],
    ["Etawah", 4, "etawah"],
    ["Farrukhabad", 4, "farrukhabad"],
    ["Fatehpur", 4, "fatehpur"],
    ["Hardoi", 4, "hardoi"],
    ["Hathras", 4, "hathras"],
    ["Jaunpur", 4, "jaunpur"],
    ["Mirzapur", 4, "mirzapur"],
    ["Modinagar", 4, "modinagar"],
    ["Orai", 4, "orai"],
    ["Raebareli", 4, "raebareli"],
    ["Sambhal", 4, "sambhal"],
    ["Sitapur", 4, "sitapur"],
    ["Unnao", 4, "unnao"],
    ["Akbarpur", 5, "akbarpur"],
    ["Ballia", 5, "ballia"],
    ["Banda", 5, "banda"],
    ["Basti", 5, "basti"],
    ["Bijnor", 5, "bijnor"],
    ["Chandausi", 5, "chandausi"],
    ["Dadri", 5, "dadri"],
    ["Deoria", 5, "deoria"],
    ["Ghazipur", 5, "ghazipur"],
    ["Gonda", 5, "gonda"],
    ["Jewar", 5, "jewar"],
    ["Kasganj", 5, "kasganj"],
    ["Khurja", 5, "khurja"],
    ["Lakhimpur", 5, "lakhimpur"],
    ["Lalitpur", 5, "lalitpur"],
    ["Mainpuri", 5, "mainpuri"],
    ["Pilibhit", 5, "pilibhit"],
    ["Sultanpur", 5, "sultanpur"],
    ["Vrindavan", 5, "vrindavan"],
  ],
  UK: [
    ["Dehradun", 2, "dehradun"],
    ["Haldwani", 3, "haldwani"],
    ["Haridwar", 3, "haridwar"],
    ["Rishikesh", 3, "rishikesh"],
    ["Roorkee", 3, "roorkee"],
    ["Rudrapur", 3, "rudrapur"],
    ["Kashipur", 4, "kashipur"],
    ["Mussoorie", 4, "mussoorie"],
    ["Nainital", 4, "nainital"],
    ["Almora", 5, "almora"],
    ["Bageshwar", 5, "bageshwar"],
    ["Chamoli", 5, "chamoli"],
    ["Kotdwar", 5, "kotdwar"],
    ["Pithoragarh", 5, "pithoragarh"],
    ["Ramnagar", 5, "ramnagar"],
    ["Sitarganj", 5, "sitarganj"],
    ["Srinagar", 5, "srinagar-uk"],
    ["Tehri", 5, "tehri"],
  ],
  WB: [
    ["Kolkata", 1, "kolkata"],
    ["Asansol", 2, "asansol"],
    ["Bidhannagar", 2, "bidhannagar"],
    ["Durgapur", 2, "durgapur"],
    ["Howrah", 2, "howrah"],
    ["Purulia", 2, "purulia"],
    ["Siliguri", 2, "siliguri"],
    ["Barasat", 3, "barasat"],
    ["Bardhaman", 3, "bardhaman"],
    ["Barrackpore", 3, "barrackpore"],
    ["Dum Dum", 3, "dum-dum"],
    ["Haldia", 3, "haldia"],
    ["Kharagpur", 3, "kharagpur"],
    ["Malda", 3, "malda"],
    ["Rajarhat", 3, "rajarhat"],
    ["Baharampur", 4, "baharampur"],
    ["Bankura", 4, "bankura"],
    ["Chandannagar", 4, "chandannagar"],
    ["Cooch Behar", 4, "cooch-behar"],
    ["Darjeeling", 4, "darjeeling"],
    ["Habra", 4, "habra"],
    ["Jalpaiguri", 4, "jalpaiguri"],
    ["Krishnanagar", 4, "krishnanagar"],
    ["Medinipur", 4, "medinipur"],
    ["Raiganj", 4, "raiganj"],
    ["Serampore", 4, "serampore"],
    ["Alipurduar", 5, "alipurduar"],
    ["Balurghat", 5, "balurghat"],
    ["Basirhat", 5, "basirhat"],
    ["Bongaon", 5, "bongaon"],
  ],
  AN: [
    ["Port Blair", 4, "port-blair"],
    ["Car Nicobar", 5, "car-nicobar"],
    ["Diglipur", 5, "diglipur"],
    ["Mayabunder", 5, "mayabunder"],
    ["Rangat", 5, "rangat"],
  ],
  CH: [
    ["Chandigarh", 2, "chandigarh"],
  ],
  DH: [
    ["Daman", 4, "daman"],
    ["Silvassa", 4, "silvassa"],
    ["Diu", 5, "diu"],
  ],
  DL: [
    ["Delhi", 1, "delhi"],
    ["New Delhi", 1, "new-delhi"],
    ["Dwarka", 2, "dwarka"],
    ["Rohini", 2, "rohini"],
    ["Saket", 2, "saket"],
    ["Vasant Kunj", 2, "vasant-kunj"],
    ["Karol Bagh", 3, "karol-bagh"],
    ["Najafgarh", 3, "najafgarh"],
    ["Pitampura", 3, "pitampura"],
    ["Narela", 4, "narela"],
  ],
  JK: [
    ["Jammu", 2, "jammu"],
    ["Srinagar", 2, "srinagar-jk"],
    ["Anantnag", 4, "anantnag"],
    ["Baramulla", 4, "baramulla"],
    ["Kathua", 4, "kathua"],
    ["Udhampur", 4, "udhampur"],
    ["Gulmarg", 5, "gulmarg"],
    ["Katra", 5, "katra"],
    ["Pahalgam", 5, "pahalgam"],
    ["Poonch", 5, "poonch"],
    ["Pulwama", 5, "pulwama"],
    ["Rajouri", 5, "rajouri"],
    ["Sopore", 5, "sopore"],
  ],
  LA: [
    ["Leh", 4, "leh"],
    ["Diskit", 5, "diskit"],
    ["Kargil", 5, "kargil"],
  ],
  LD: [
    ["Agatti", 5, "agatti"],
    ["Andrott", 5, "andrott"],
    ["Kavaratti", 5, "kavaratti"],
  ],
  PY: [
    ["Puducherry", 2, "puducherry"],
    ["Karaikal", 4, "karaikal"],
    ["Mahe", 5, "mahe"],
    ["Villianur", 5, "villianur"],
    ["Yanam", 5, "yanam"],
  ],
};

const STATE_NAME_BY_CODE = new Map(indianStates.map((state) => [state.code, state.name]));

export const indianCities: readonly IndianCity[] = Object.entries(CITY_TABLE)
  .flatMap(([stateCode, entries]) =>
    entries.map(([name, tier, slug]) => ({
      name,
      slug,
      state: STATE_NAME_BY_CODE.get(stateCode) ?? stateCode,
      stateCode,
      tier,
    })),
  )
  .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));

export const indianStateNames: readonly string[] = indianStates.map((state) => state.name);

/**
 * Lookups are built once, keyed on a normalised form, so that "New  Delhi",
 * "new delhi" and "New Delhi" all resolve to the same place. Stored values
 * keep their canonical spelling; only the key is normalised.
 */
function key(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

const CITIES_BY_NAME = new Map<string, IndianCity[]>();
for (const city of indianCities) {
  const existing = CITIES_BY_NAME.get(key(city.name));
  if (existing) existing.push(city);
  else CITIES_BY_NAME.set(key(city.name), [city]);
}

const STATES_BY_NAME = new Map(indianStates.map((state) => [key(state.name), state]));
const STATES_BY_CODE = new Map(indianStates.map((state) => [state.code, state]));

/** Every city of that name — a handful repeat across states (Aurangabad, Bilaspur). */
export function citiesNamed(name: string): readonly IndianCity[] {
  return CITIES_BY_NAME.get(key(name)) ?? [];
}

/**
 * One city, disambiguated by state where the name repeats.
 *
 * Without a state a repeated name resolves to the larger city (lowest tier),
 * which is the reading a person typing "Aurangabad" almost always intends —
 * but a caller that knows the state should say so.
 */
export function findCity(name: string, state?: string): IndianCity | null {
  const matches = citiesNamed(name);
  if (matches.length === 0) return null;
  if (!state) return matches.reduce((best, city) => (city.tier < best.tier ? city : best));

  const wanted = key(state);
  return (
    matches.find((city) => key(city.state) === wanted || key(city.stateCode) === wanted) ?? null
  );
}

export function isKnownCity(name: string | undefined | null): boolean {
  return Boolean(name && CITIES_BY_NAME.has(key(name)));
}

export function findState(name: string | undefined | null): IndianState | null {
  if (!name) return null;
  return STATES_BY_NAME.get(key(name)) ?? STATES_BY_CODE.get(name.trim().toUpperCase()) ?? null;
}

export function isKnownState(name: string | undefined | null): boolean {
  return findState(name) !== null;
}

/** Cities of one state, largest first. Accepts the state's name or its code. */
export function citiesInState(state: string): readonly IndianCity[] {
  const resolved = findState(state);
  if (!resolved) return [];
  return indianCities.filter((city) => city.stateCode === resolved.code);
}

/**
 * Type-ahead over the whole list.
 *
 * Ranked so that what someone is most likely to mean appears first: an exact
 * name, then a name that starts with what they typed, then a name that
 * contains it, then a match on the state. Within each band the larger city
 * wins, because a person typing three letters is far more often after Mumbai
 * than after a town that happens to share the prefix.
 *
 * An empty query returns the largest cities, so the control is useful before
 * anything is typed.
 */
export function searchCities(query: string, limit = 8): readonly IndianCity[] {
  const term = key(query);
  if (!term) return indianCities.slice(0, limit);

  const scored: { city: IndianCity; rank: number }[] = [];
  for (const city of indianCities) {
    const name = key(city.name);
    const rank = name === term ? 0
      : name.startsWith(term) ? 1
      : name.includes(term) ? 2
      : key(city.state).startsWith(term) ? 3
      : key(city.state).includes(term) ? 4
      : -1;
    if (rank >= 0) scored.push({ city, rank });
  }

  return scored
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        a.city.tier - b.city.tier ||
        a.city.name.localeCompare(b.city.name),
    )
    .slice(0, limit)
    .map((entry) => entry.city);
}

/** How a city reads in a suggestion list: "Noida, Uttar Pradesh". */
export function describeCity(city: IndianCity): string {
  return `${city.name}, ${city.state}`;
}
