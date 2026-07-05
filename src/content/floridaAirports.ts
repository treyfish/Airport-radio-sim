// Florida GA airport directory for the Scanner. Frequencies are practice
// references compiled from public sources — they change! The UI shows a
// "verify with the current Chart Supplement" disclaimer, and the simulated
// UNICOM works the same regardless of the exact frequency.

export interface FloridaAirport {
  icao: string;
  name: string;
  city: string;
  ctaf: string;
  runways: string[]; // usable runway idents for simulated pattern calls
}

export const FLORIDA_AIRPORTS: FloridaAirport[] = [
  { icao: "KDED", name: "DeLand Municipal", city: "DeLand", ctaf: "123.000", runways: ["5", "23", "12", "30"] },
  { icao: "KOMN", name: "Ormond Beach Municipal", city: "Ormond Beach", ctaf: "123.050", runways: ["9", "27", "17", "35"] },
  { icao: "KEVB", name: "New Smyrna Beach Municipal", city: "New Smyrna Beach", ctaf: "118.400", runways: ["7", "25", "11", "29"] },
  { icao: "X21", name: "Arthur Dunn Airpark", city: "Titusville", ctaf: "122.725", runways: ["15", "33"] },
  { icao: "KVNC", name: "Venice Municipal", city: "Venice", ctaf: "122.725", runways: ["5", "23", "13", "31"] },
  { icao: "KGIF", name: "Winter Haven Regional", city: "Winter Haven", ctaf: "122.800", runways: ["5", "23", "11", "29"] },
  { icao: "KZPH", name: "Zephyrhills Municipal", city: "Zephyrhills", ctaf: "123.075", runways: ["1", "19", "5", "23"] },
  { icao: "KCLW", name: "Clearwater Air Park", city: "Clearwater", ctaf: "122.800", runways: ["16", "34"] },
  { icao: "KTPF", name: "Peter O. Knight", city: "Tampa", ctaf: "122.725", runways: ["4", "22", "18", "36"] },
  { icao: "X39", name: "Tampa North Aero Park", city: "Tampa", ctaf: "122.900", runways: ["14", "32"] },
  { icao: "KPCM", name: "Plant City", city: "Plant City", ctaf: "122.900", runways: ["10", "28"] },
  { icao: "KSEF", name: "Sebring Regional", city: "Sebring", ctaf: "122.700", runways: ["1", "19", "14", "32"] },
  { icao: "KAVO", name: "Avon Park Executive", city: "Avon Park", ctaf: "122.900", runways: ["5", "23", "10", "28"] },
  { icao: "KOKE", name: "Okeechobee County", city: "Okeechobee", ctaf: "122.800", runways: ["5", "23", "14", "32"] },
  { icao: "KSUA", name: "Witham Field", city: "Stuart", ctaf: "119.025", runways: ["12", "30", "7", "25"] },
  { icao: "KPHK", name: "Palm Beach County Glades", city: "Pahokee", ctaf: "122.700", runways: ["17", "35"] },
  { icao: "X26", name: "Sebastian Municipal", city: "Sebastian", ctaf: "122.900", runways: ["5", "23", "10", "28"] },
  { icao: "KIMM", name: "Immokalee Regional", city: "Immokalee", ctaf: "122.800", runways: ["18", "36", "9", "27"] },
  { icao: "KMKY", name: "Marco Island Executive", city: "Marco Island", ctaf: "122.900", runways: ["17", "35"] },
  { icao: "KLBV", name: "La Belle Municipal", city: "La Belle", ctaf: "122.800", runways: ["14", "32"] },
  { icao: "KCTY", name: "Cross City", city: "Cross City", ctaf: "122.800", runways: ["4", "22", "13", "31"] },
  { icao: "X60", name: "Williston Municipal", city: "Williston", ctaf: "122.800", runways: ["5", "23", "14", "32"] },
  { icao: "KCDK", name: "George T. Lewis (Cedar Key)", city: "Cedar Key", ctaf: "122.900", runways: ["5", "23"] },
  { icao: "KMTH", name: "Florida Keys Marathon", city: "Marathon", ctaf: "122.800", runways: ["7", "25"] },
  { icao: "X01", name: "Everglades Airpark", city: "Everglades City", ctaf: "122.900", runways: ["15", "33"] },
];
