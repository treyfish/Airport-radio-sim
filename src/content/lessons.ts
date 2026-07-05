// Per-level micro-lessons shown before practicing. Short cards, plain
// language — the "why" behind the phraseology, not just the words.

export interface LessonCard {
  title: string;
  body: string; // plain text; blank-line-separated paragraphs; "- " bullets
}

export interface LessonDeck {
  level: number;
  title: string;
  cards: LessonCard[];
}

export const LESSONS: LessonDeck[] = [
  {
    level: 1,
    title: "Radio basics & the non-towered field",
    cards: [
      {
        title: "The formula behind every call",
        body: "Nearly every radio call is the same four pieces, in the same order:\n\n- WHO you're talking to — \"Cedar Valley traffic\"\n- WHO you are — \"Skyhawk one two three alpha bravo\"\n- WHERE you are — \"left downwind, runway one eight\"\n- WHAT you want or intend — \"full stop\"\n\nAt a non-towered field, close with the airport name again, so someone tuning in mid-sentence still knows which airport you mean.",
      },
      {
        title: "Why we talk funny: the phonetic alphabet",
        body: "Radios are scratchy and letters sound alike — B, C, D, E, G, P, T, V, Z are nearly identical through static. So aviation spells with words:\n\nAlpha Bravo Charlie Delta Echo Foxtrot Golf Hotel India Juliett Kilo Lima Mike November Oscar Papa Quebec Romeo Sierra Tango Uniform Victor Whiskey X-ray Yankee Zulu\n\nNumbers get the same treatment: 3 is \"tree\", 5 is \"fife\", 9 is \"niner\" (so it can't be confused with the German \"nein\" or with \"five\"). Frequencies use \"point\": 122.8 is \"one two two point eight\".",
      },
      {
        title: "What CTAF actually is",
        body: "At an airport with no control tower, nobody is directing traffic. Instead, everyone announces what they're doing on a shared frequency: the Common Traffic Advisory Frequency (CTAF).\n\nKey mindset: you're not asking permission and nobody will answer you. You're painting a picture of yourself for every other pilot nearby. If your calls are clear, other pilots know exactly where to look for you.\n\nUNICOM is often the same frequency — it's a radio station on the field (usually the FBO desk) that can answer questions about fuel or parking, but it is not a control tower.",
      },
      {
        title: "The traffic pattern in 20 seconds",
        body: "The pattern is a rectangle flown around the runway, usually with left turns:\n\n- UPWIND — climbing straight out after takeoff\n- CROSSWIND — first 90° turn\n- DOWNWIND — flying parallel to the runway, opposite the landing direction\n- BASE — the turn toward the runway\n- FINAL — lined up with the runway to land\n\nStandard practice: announce every leg. \"Cedar Valley traffic, Skyhawk one two tree alpha bravo, left downwind runway one eight, Cedar Valley.\"",
      },
      {
        title: "Sounding like a pro (not a passenger)",
        body: "- Think before you key: know all four pieces before you press the button\n- Press, pause a half-second, then talk — clipped first words are the #1 rookie tell\n- Say \"niner\", \"tree\", \"fife\" — and skip \"please\" and \"thanks for the help, uh...\"\n- Keep it short. The frequency is shared; airtime is precious\n- Nobody is grading you in real life — but everyone can hear you. Calm and standard beats fast and fancy",
      },
    ],
  },
  {
    level: 2,
    title: "Towered fields: ATIS, Ground & Tower",
    cards: [
      {
        title: "Who's who at a towered airport",
        body: "A Class D airport splits the work between frequencies:\n\n- ATIS — a recorded loop of weather and airport info, updated about hourly, each version named with a letter (\"information Bravo\")\n- GROUND — controls taxiways. You talk to them from the ramp until you reach the runway\n- TOWER — controls the runway and the air around the airport\n\nThe dance is always: listen to ATIS → call Ground → taxi → call Tower → fly.",
      },
      {
        title: "ATIS: listen first, then say the magic letter",
        body: "Before calling anyone, listen to the ATIS and note: the information letter, the runway in use, the wind, and the altimeter setting.\n\nThen tell the controller you have it: \"...with information Bravo\". That one word saves them reading you the entire weather. If you don't say it, expect: \"verify you have information Bravo\" — mildly embarrassing, easily avoided.",
      },
      {
        title: "Readbacks: the rule that keeps runways safe",
        body: "When a controller gives you an instruction, you read the key parts back. That's how they catch a mis-heard instruction before it becomes a runway conflict.\n\nMUST read back, word for word:\n- Runway assignments — \"runway one tree\"\n- Hold short instructions — \"hold short runway one tree\" (\"Roger\" is NOT acceptable)\n- Clearances — \"cleared for takeoff\", \"cleared to land\", \"line up and wait\"\n\nAlways end a readback with your callsign, so the controller knows WHO confirmed.",
      },
      {
        title: "\"Line up and wait\" is not a takeoff clearance",
        body: "Three different instructions at the hold-short line:\n\n- \"HOLD SHORT runway 13\" — stay off the runway\n- \"LINE UP AND WAIT runway 13\" — taxi onto the runway, stop, do NOT take off\n- \"RUNWAY 13, CLEARED FOR TAKEOFF\" — go\n\nMixing these up is how runway incursions happen, which is why every one of them demands a precise readback. If you're ever unsure which one you got: ASK. \"Confirm cleared for takeoff?\" costs three seconds.",
      },
      {
        title: "The student pilot superpower",
        body: "Say the words \"student pilot\" on first contact and controllers will slow down, simplify, and cut you extra slack. It's in the AIM; they're trained for it.\n\nAnd the all-purpose escape hatches, usable by anyone:\n- \"Say again\" — repeat the whole thing\n- \"Say again slower\" — exactly what it sounds like\n- \"Unable\" — you can't comply with an instruction (say why)\n\nControllers vastly prefer a \"say again\" over a wrong readback.",
      },
    ],
  },
  {
    level: 3,
    title: "Flight following & radar services",
    cards: [
      {
        title: "What flight following is",
        body: "VFR flight following means a radar controller watches your flight and calls out nearby traffic while you cruise. It's free, optional, and one of the best safety habits a VFR pilot can build.\n\nYou're still the pilot in command and still responsible for seeing and avoiding traffic — radar is a second set of eyes, not a chauffeur.",
      },
      {
        title: "The two-step call-up",
        body: "Radar controllers are busy, so don't dump your life story on first contact. Step one is just a knock on the door:\n\n\"Big Sky Approach, Skyhawk one two tree alpha bravo.\"\n\nWait. When they answer \"go ahead\", THEN give the details in one tidy package: what you are, where you are, altitude, and what you want:\n\n\"Skyhawk one two tree alpha bravo is a Cessna one seventy-two, one zero miles east of Cedar Valley at three thousand five hundred, request flight following to Centerville at five thousand five hundred.\"",
      },
      {
        title: "Squawk codes and Mode C",
        body: "The controller assigns you a four-digit transponder code — a \"squawk\" — that makes your blip identifiable on their scope: \"squawk four zero six four\".\n\nRead the digits back, then set them. Digits only run 0–7 (it's octal), and some codes are special: 1200 is generic VFR, 7500 hijack, 7600 radio failure, 7700 emergency. Don't dial through those by accident.\n\nControllers also verify your altitude readout: that's why you state your altitude on every check-in.",
      },
      {
        title: "Handoffs: same conversation, new voice",
        body: "As you fly along, you'll be passed between sectors: \"contact Big Sky Approach on one two four point seven.\"\n\nRead back the frequency (a wrong digit means calling into the void), switch, listen for a gap, then check in with who you are and your altitude: \"Big Sky Approach, Skyhawk one two tree alpha bravo, level five thousand five hundred.\"\n\nWhen it's over: \"radar services terminated, squawk VFR, frequency change approved\" — set 1200, and you're on your own again.",
      },
    ],
  },
  {
    level: 4,
    title: "Class C & B: the big leagues",
    cards: [
      {
        title: "What changes in Class C",
        body: "Two things are different at a Class C airport:\n\n- You must be in two-way radio contact before entering the airspace — and \"contact\" means they've said YOUR callsign back to you\n- Departing VFR, there's an extra stop before Ground: CLEARANCE DELIVERY, who pre-coordinates your departure with the radar room\n\nThe frequency chain becomes: ATIS → Clearance → Ground → Tower → Departure.",
      },
      {
        title: "Copying a clearance: pen first, then key",
        body: "Clearance Delivery talks fast and delivers four or five items in one breath: a heading, an altitude limit, a departure frequency, and a squawk.\n\nWrite it down. The habit is CRAFT: Clearance limit, Route, Altitude, Frequency, Transponder. Then read ALL of it back and end with your callsign.\n\nIf you missed one item, don't guess — \"say again the departure frequency\" is a normal, professional call.",
      },
      {
        title: "Class B: the magic words",
        body: "Class B (the biggest airports) has one iron rule: you may not enter until you hear the literal words \"CLEARED INTO THE CLASS BRAVO AIRSPACE\".\n\nTwo-way contact is NOT enough. \"Radar contact\" is NOT enough. If they say \"remain clear of the Class Bravo\", you stay out and wait.\n\nWhen you do get the clearance, read those words back. It's the one phrase in VFR flying where the exact wording legally matters.",
      },
      {
        title: "Holding your own on a fast frequency",
        body: "Busy frequencies are intimidating, but the rules don't change — the pace does:\n\n- Listen before transmitting; wait for the gap\n- Have your entire call composed before you key up\n- If a rapid-fire instruction comes at you: read back what you caught, \"say again\" the rest\n- They sequence jets around you all day; a Cessna doing it right is not a burden\n\nSpeed comes from preparation, not from talking fast.",
      },
    ],
  },
];

export function lessonForLevel(level: number): LessonDeck | undefined {
  return LESSONS.find((deck) => deck.level === level);
}
