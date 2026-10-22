// Hidden eggs: things found by poking at the app or the office, then
// reported through "Report a discovery".
//
// Digital eggs reveal a code generated for each player (a colleague's code
// won't work for you). `revealedBy` names what the frontend does to ask for
// it; eggs without it are revealed some other way (the console whisper and
// the response header are handled by the server directly).
//
// Physical eggs carry a fixed `code`: print it, hide it somewhere in the
// office, and change these example codes before you do.

export default [
  {
    id: "console-whisper",
    title: "ARCHIE's whisper",
    points: 40,
    whisper: "ARCHIE talks to people who open the developer console.",
    note: "You listened where most people never look.",
  },
  {
    id: "header-signal",
    title: "A signal in the headers",
    points: 50,
    whisper: "Every reply from ARCHIE carries something extra. Look at the response, not the page.",
    note: "ARCHIE has been signing every reply. Nobody reads the envelope.",
  },
  {
    id: "basement",
    title: "The basement",
    points: 60,
    revealedBy: "/basement",
    whisper: "Search engines are politely asked to stay out of somewhere.",
    revealMessage: "Someone left a light on down here.",
    note: "robots.txt was never a lock. It was a sign on a door.",
  },
  {
    id: "konami",
    title: "Thirty lives",
    points: 40,
    revealedBy: "konami",
    whisper: "Up, up, down, down…",
    revealMessage: "ARCHIE was built in an era that respected the classics.",
    note: "Some codes never stop working.",
  },
  {
    id: "impatient-logo",
    title: "Impatience",
    points: 30,
    revealedBy: "logo",
    whisper: "The logo doesn't like being poked. Poke it anyway.",
    revealMessage: "Fine. FINE. Here.",
    note: "Seven clicks. ARCHIE counted.",
  },
  {
    id: "lost-page",
    title: "Lost on purpose",
    points: 30,
    revealedBy: "404",
    whisper: "Go somewhere that doesn't exist.",
    revealMessage: "You found a page that isn't here. ARCHIE files those too.",
    note: "Every 404 is a door someone forgot to build.",
  },
  {
    id: "night-shift",
    title: "Lights off",
    points: 80,
    revealedBy: "night",
    window: { from: 19, to: 6 },
    whisper: "Something only exists when the lights are off.",
    revealMessage: "The night shift has started. ARCHIE is more talkative now.",
    closedMessage: "It's too bright. Come back after 19:00.",
    note: "You were here after hours. So was m.",
  },
  {
    id: "fine-print",
    title: "The fine print",
    points: 30,
    revealedBy: "fineprint",
    whisper: "Not everything on the page is meant to be seen. Select carefully.",
    revealMessage: "Nobody reads the fine print. You did.",
    note: "Hidden in plain sight, in the footer.",
  },

  // ---- physical eggs: print these and hide them ----
  {
    id: "pantry-kettle",
    title: "Under the kettle",
    points: 70,
    physical: true,
    code: "KETTLE-NOCT-42",
    whisper: "The pantry knows something. Check where the water boils.",
    note: "The kettle has seen every night shift.",
  },
  {
    id: "printer-tray",
    title: "Tray 3",
    points: 70,
    physical: true,
    code: "TRAY3-M-WAS-HERE",
    whisper: "The printer has a tray nobody opens.",
    note: "m. printed one page every night. Nobody knows what it said.",
  },
  {
    id: "fire-map",
    title: "Behind the evacuation map",
    points: 70,
    physical: true,
    code: "EXIT-404-NORTH",
    whisper: "In case of mystery, follow the exit signs.",
    note: "Always know the way out. m. didn't take it.",
  },
];
