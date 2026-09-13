// ============================================================
// ARENA PREMIER LEAGUE — scheduled-poller.js
// Netlify Scheduled Function — cron ogni minuto; shouldPoll guard gestisce la frequenza
// Chiama RapidAPI (SofaScore) per partite attive e scrive voti su Firebase
// ============================================================

const https = require("https");
const admin = require("firebase-admin");

// ── MATCHES ────────────────────────────────────────────────
// Formato kickoff: ISO 8601 UTC
// eventId: trovalo su sofascore.com → URL della partita → ultimo numero
// Gli eventId UCL 2026/27 saranno disponibili con il calendario ufficiale (agosto 2026)
// Premier League: 38 giornate, nessun knockout.
// TODO: incollare qui lo stesso calendario di matches.js (con home/away/kickoff/eventId)
// quando gli eventId SofaScore sono disponibili. Finché gli array restano vuoti il poller è inerte.
const MATCHES = {
  "1": [
    { eventId: "16363633", home: "Arsenal", away: "Coventry City", kickoff: "2026-08-21T19:00:00Z" },
    { eventId: "16363634", home: "Hull City", away: "Manchester United", kickoff: "2026-08-22T11:30:00Z" },
    { eventId: "16363636", home: "Ipswich Town", away: "Sunderland", kickoff: "2026-08-22T14:00:00Z" },
    { eventId: "16363238", home: "Nottingham Forest", away: "Leeds United", kickoff: "2026-08-22T14:00:00Z" },
    { eventId: "16363635", home: "Everton", away: "Crystal Palace", kickoff: "2026-08-22T14:00:00Z" },
    { eventId: "16363242", home: "Brentford", away: "Tottenham Hotspur", kickoff: "2026-08-22T16:30:00Z" },
    { eventId: "16363236", home: "Brighton & Hove Albion", away: "Aston Villa", kickoff: "2026-08-23T13:00:00Z" },
    { eventId: "16363243", home: "Manchester City", away: "Bournemouth", kickoff: "2026-08-23T13:00:00Z" },
    { eventId: "16363246", home: "Newcastle United", away: "Liverpool FC", kickoff: "2026-08-23T15:30:00Z" },
    { eventId: "16363244", home: "Fulham", away: "Chelsea", kickoff: "2026-08-24T19:00:00Z" }
  ],
  "2": [
    { eventId: "16363252", home: "Crystal Palace", away: "Manchester City", kickoff: "2026-08-28T19:00:00Z" },
    { eventId: "16363254", home: "Liverpool FC", away: "Nottingham Forest", kickoff: "2026-08-29T11:30:00Z" },
    { eventId: "16363250", home: "Coventry City", away: "Hull City", kickoff: "2026-08-29T14:00:00Z" },
    { eventId: "16363247", home: "Bournemouth", away: "Everton", kickoff: "2026-08-29T14:00:00Z" },
    { eventId: "16363256", home: "Tottenham Hotspur", away: "Newcastle United", kickoff: "2026-08-29T16:30:00Z" },
    { eventId: "16363266", home: "Leeds United", away: "Brentford", kickoff: "2026-08-30T13:00:00Z" },
    { eventId: "16363255", home: "Sunderland", away: "Fulham", kickoff: "2026-08-30T13:00:00Z" },
    { eventId: "16363249", home: "Chelsea", away: "Brighton & Hove Albion", kickoff: "2026-08-30T13:00:00Z" },
    { eventId: "16363253", home: "Manchester United", away: "Ipswich Town", kickoff: "2026-08-30T15:30:00Z" },
    { eventId: "16363245", home: "Aston Villa", away: "Arsenal", kickoff: "2026-08-31T19:00:00Z" }
  ],
  "3": [
    { eventId: "16363261", home: "Ipswich Town", away: "Liverpool FC", kickoff: "2026-09-04T19:00:00Z" },
    { eventId: "16363637", home: "Newcastle United", away: "Bournemouth", kickoff: "2026-09-05T11:30:00Z" },
    { eventId: "16363263", home: "Manchester City", away: "Coventry City", kickoff: "2026-09-05T14:00:00Z" },
    { eventId: "16363638", home: "Nottingham Forest", away: "Tottenham Hotspur", kickoff: "2026-09-05T14:00:00Z" },
    { eventId: "16363269", home: "Fulham", away: "Crystal Palace", kickoff: "2026-09-05T14:00:00Z" },
    { eventId: "16363258", home: "Brighton & Hove Albion", away: "Leeds United", kickoff: "2026-09-05T14:00:00Z" },
    { eventId: "16363260", home: "Brentford", away: "Sunderland", kickoff: "2026-09-05T14:00:00Z" },
    { eventId: "16363262", home: "Hull City", away: "Aston Villa", kickoff: "2026-09-05T16:30:00Z" },
    { eventId: "16363259", home: "Everton", away: "Manchester United", kickoff: "2026-09-06T13:00:00Z" },
    { eventId: "16363257", home: "Arsenal", away: "Chelsea", kickoff: "2026-09-06T15:30:00Z" }
  ],
  "4": [
    { eventId: "16363264", home: "Liverpool FC", away: "Fulham", kickoff: "2026-09-12T14:00:00Z" },
    { eventId: "16363641", home: "Chelsea", away: "Hull City", kickoff: "2026-09-12T14:00:00Z" },
    { eventId: "16363639", home: "Aston Villa", away: "Nottingham Forest", kickoff: "2026-09-12T14:00:00Z" },
    { eventId: "16363643", home: "Crystal Palace", away: "Ipswich Town", kickoff: "2026-09-12T14:00:00Z" },
    { eventId: "16363640", home: "Bournemouth", away: "Brentford", kickoff: "2026-09-12T14:00:00Z" },
    { eventId: "16363647", home: "Tottenham Hotspur", away: "Everton", kickoff: "2026-09-12T16:30:00Z" },
    { eventId: "16363646", home: "Sunderland", away: "Arsenal", kickoff: "2026-09-12T19:00:00Z" },
    { eventId: "16363642", home: "Coventry City", away: "Brighton & Hove Albion", kickoff: "2026-09-13T13:00:00Z" },
    { eventId: "16363645", home: "Manchester United", away: "Manchester City", kickoff: "2026-09-13T15:30:00Z" },
    { eventId: "16363644", home: "Leeds United", away: "Newcastle United", kickoff: "2026-09-14T19:00:00Z" }
  ],
  "5": [
    { eventId: "16363649", home: "Brentford", away: "Chelsea", kickoff: "2026-09-18T19:00:00Z" },
    { eventId: "16363870", home: "Tottenham Hotspur", away: "Aston Villa", kickoff: "2026-09-19T11:30:00Z" },
    { eventId: "16363650", home: "Brighton & Hove Albion", away: "Arsenal", kickoff: "2026-09-19T14:00:00Z" },
    { eventId: "16363868", home: "Newcastle United", away: "Hull City", kickoff: "2026-09-19T14:00:00Z" },
    { eventId: "16363651", home: "Everton", away: "Ipswich Town", kickoff: "2026-09-19T14:00:00Z" },
    { eventId: "16363869", home: "Nottingham Forest", away: "Coventry City", kickoff: "2026-09-19T16:30:00Z" },
    { eventId: "16363867", home: "Manchester City", away: "Sunderland", kickoff: "2026-09-20T13:00:00Z" },
    { eventId: "16363648", home: "Bournemouth", away: "Liverpool FC", kickoff: "2026-09-20T13:00:00Z" },
    { eventId: "16363866", home: "Leeds United", away: "Crystal Palace", kickoff: "2026-09-20T13:00:00Z" },
    { eventId: "16363652", home: "Fulham", away: "Manchester United", kickoff: "2026-09-20T15:30:00Z" }
  ],
  "6": [
    { eventId: "16363871", home: "Arsenal", away: "Leeds United", kickoff: "2026-10-10T11:30:00Z" },
    { eventId: "16363873", home: "Chelsea", away: "Bournemouth", kickoff: "2026-10-10T14:00:00Z" },
    { eventId: "16363872", home: "Aston Villa", away: "Brentford", kickoff: "2026-10-10T14:00:00Z" },
    { eventId: "16363880", home: "Sunderland", away: "Brighton & Hove Albion", kickoff: "2026-10-10T14:00:00Z" },
    { eventId: "16363877", home: "Ipswich Town", away: "Fulham", kickoff: "2026-10-10T14:00:00Z" },
    { eventId: "16363879", home: "Manchester United", away: "Tottenham Hotspur", kickoff: "2026-10-10T16:30:00Z" },
    { eventId: "16363875", home: "Crystal Palace", away: "Nottingham Forest", kickoff: "2026-10-11T13:00:00Z" },
    { eventId: "16363876", home: "Hull City", away: "Everton", kickoff: "2026-10-11T13:00:00Z" },
    { eventId: "16363878", home: "Liverpool FC", away: "Manchester City", kickoff: "2026-10-11T15:30:00Z" },
    { eventId: "16363874", home: "Coventry City", away: "Newcastle United", kickoff: "2026-10-12T19:00:00Z" }
  ],
  "7": [
    { eventId: "16363884", home: "Everton", away: "Chelsea", kickoff: "2026-10-17T11:30:00Z" },
    { eventId: "16363887", home: "Manchester City", away: "Ipswich Town", kickoff: "2026-10-17T14:00:00Z" },
    { eventId: "16363882", home: "Brentford", away: "Liverpool FC", kickoff: "2026-10-17T14:00:00Z" },
    { eventId: "16363890", home: "Tottenham Hotspur", away: "Coventry City", kickoff: "2026-10-17T14:00:00Z" },
    { eventId: "16363885", home: "Fulham", away: "Hull City", kickoff: "2026-10-17T14:00:00Z" },
    { eventId: "16363888", home: "Newcastle United", away: "Aston Villa", kickoff: "2026-10-17T16:30:00Z" },
    { eventId: "16363886", home: "Leeds United", away: "Manchester United", kickoff: "2026-10-18T13:00:00Z" },
    { eventId: "16363883", home: "Brighton & Hove Albion", away: "Crystal Palace", kickoff: "2026-10-18T13:00:00Z" },
    { eventId: "16363881", home: "Bournemouth", away: "Sunderland", kickoff: "2026-10-18T13:00:00Z" },
    { eventId: "16363889", home: "Nottingham Forest", away: "Arsenal", kickoff: "2026-10-18T15:30:00Z" }
  ],
  "8": [
    { eventId: "16363897", home: "Ipswich Town", away: "Nottingham Forest", kickoff: "2026-10-23T19:00:00Z" },
    { eventId: "16363892", home: "Aston Villa", away: "Manchester City", kickoff: "2026-10-24T11:30:00Z" },
    { eventId: "16363891", home: "Arsenal", away: "Everton", kickoff: "2026-10-24T14:00:00Z" },
    { eventId: "16363894", home: "Coventry City", away: "Fulham", kickoff: "2026-10-24T14:00:00Z" },
    { eventId: "16363893", home: "Chelsea", away: "Tottenham Hotspur", kickoff: "2026-10-24T16:30:00Z" },
    { eventId: "16363898", home: "Liverpool FC", away: "Brighton & Hove Albion", kickoff: "2026-10-25T14:00:00Z" },
    { eventId: "16363899", home: "Manchester United", away: "Bournemouth", kickoff: "2026-10-25T14:00:00Z" },
    { eventId: "16363895", home: "Crystal Palace", away: "Newcastle United", kickoff: "2026-10-25T14:00:00Z" },
    { eventId: "16363896", home: "Hull City", away: "Brentford", kickoff: "2026-10-25T14:00:00Z" },
    { eventId: "16363900", home: "Sunderland", away: "Leeds United", kickoff: "2026-10-25T16:30:00Z" }
  ],
  "9": [
    { eventId: "16363904", home: "Chelsea", away: "Manchester United", kickoff: "2026-10-31T12:30:00Z" },
    { eventId: "16363908", home: "Manchester City", away: "Brighton & Hove Albion", kickoff: "2026-10-31T15:00:00Z" },
    { eventId: "16363909", home: "Newcastle United", away: "Everton", kickoff: "2026-10-31T15:00:00Z" },
    { eventId: "16363903", home: "Brentford", away: "Nottingham Forest", kickoff: "2026-10-31T15:00:00Z" },
    { eventId: "16363902", home: "Bournemouth", away: "Leeds United", kickoff: "2026-10-31T15:00:00Z" },
    { eventId: "16363905", home: "Coventry City", away: "Sunderland", kickoff: "2026-10-31T15:00:00Z" },
    { eventId: "16363906", home: "Hull City", away: "Ipswich Town", kickoff: "2026-10-31T15:00:00Z" },
    { eventId: "16363910", home: "Tottenham Hotspur", away: "Crystal Palace", kickoff: "2026-10-31T17:30:00Z" },
    { eventId: "16363901", home: "Aston Villa", away: "Fulham", kickoff: "2026-10-31T20:00:00Z" },
    { eventId: "16363907", home: "Liverpool FC", away: "Arsenal", kickoff: "2026-11-01T16:30:00Z" }
  ],
  "10": [
    { eventId: "16363919", home: "Nottingham Forest", away: "Manchester City", kickoff: "2026-11-07T15:00:00Z" },
    { eventId: "16363918", home: "Manchester United", away: "Aston Villa", kickoff: "2026-11-07T15:00:00Z" },
    { eventId: "16363913", home: "Crystal Palace", away: "Liverpool FC", kickoff: "2026-11-07T15:00:00Z" },
    { eventId: "16363911", home: "Arsenal", away: "Hull City", kickoff: "2026-11-07T15:00:00Z" },
    { eventId: "16363920", home: "Sunderland", away: "Chelsea", kickoff: "2026-11-07T15:00:00Z" },
    { eventId: "16363917", home: "Leeds United", away: "Tottenham Hotspur", kickoff: "2026-11-07T15:00:00Z" },
    { eventId: "16363915", home: "Fulham", away: "Newcastle United", kickoff: "2026-11-07T15:00:00Z" },
    { eventId: "16363912", home: "Brighton & Hove Albion", away: "Brentford", kickoff: "2026-11-07T15:00:00Z" },
    { eventId: "16363914", home: "Everton", away: "Coventry City", kickoff: "2026-11-07T15:00:00Z" },
    { eventId: "16363916", home: "Ipswich Town", away: "Bournemouth", kickoff: "2026-11-07T15:00:00Z" }
  ],
  "11": [
    { eventId: "16363660", home: "Liverpool FC", away: "Manchester United", kickoff: "2026-11-21T15:00:00Z" },
    { eventId: "16363661", home: "Manchester City", away: "Fulham", kickoff: "2026-11-21T15:00:00Z" },
    { eventId: "16363662", home: "Newcastle United", away: "Arsenal", kickoff: "2026-11-21T15:00:00Z" },
    { eventId: "16363657", home: "Chelsea", away: "Leeds United", kickoff: "2026-11-21T15:00:00Z" },
    { eventId: "16363663", home: "Tottenham Hotspur", away: "Ipswich Town", kickoff: "2026-11-21T15:00:00Z" },
    { eventId: "16363654", home: "Aston Villa", away: "Sunderland", kickoff: "2026-11-21T15:00:00Z" },
    { eventId: "16363655", home: "Bournemouth", away: "Nottingham Forest", kickoff: "2026-11-21T15:00:00Z" },
    { eventId: "16363656", home: "Brentford", away: "Everton", kickoff: "2026-11-21T15:00:00Z" },
    { eventId: "16363658", home: "Coventry City", away: "Crystal Palace", kickoff: "2026-11-21T15:00:00Z" },
    { eventId: "16363659", home: "Hull City", away: "Brighton & Hove Albion", kickoff: "2026-11-21T15:00:00Z" }
  ],
  "12": [
    { eventId: "16363664", home: "Arsenal", away: "Manchester City", kickoff: "2026-11-28T15:00:00Z" },
    { eventId: "16363668", home: "Everton", away: "Liverpool FC", kickoff: "2026-11-28T15:00:00Z" },
    { eventId: "16363672", home: "Manchester United", away: "Brentford", kickoff: "2026-11-28T15:00:00Z" },
    { eventId: "16363673", home: "Nottingham Forest", away: "Chelsea", kickoff: "2026-11-28T15:00:00Z" },
    { eventId: "16363675", home: "Sunderland", away: "Tottenham Hotspur", kickoff: "2026-11-28T15:00:00Z" },
    { eventId: "16363666", home: "Brighton & Hove Albion", away: "Newcastle United", kickoff: "2026-11-28T15:00:00Z" },
    { eventId: "16363670", home: "Ipswich Town", away: "Aston Villa", kickoff: "2026-11-28T15:00:00Z" },
    { eventId: "16363669", home: "Fulham", away: "Bournemouth", kickoff: "2026-11-28T15:00:00Z" },
    { eventId: "16363667", home: "Crystal Palace", away: "Hull City", kickoff: "2026-11-28T15:00:00Z" },
    { eventId: "16363671", home: "Leeds United", away: "Coventry City", kickoff: "2026-11-28T15:00:00Z" }
  ],
  "13": [
    { eventId: "16363691", home: "Newcastle United", away: "Manchester United", kickoff: "2026-12-02T20:00:00Z" },
    { eventId: "16363689", home: "Manchester City", away: "Leeds United", kickoff: "2026-12-02T20:00:00Z" },
    { eventId: "16363687", home: "Liverpool FC", away: "Sunderland", kickoff: "2026-12-02T20:00:00Z" },
    { eventId: "16363679", home: "Brentford", away: "Arsenal", kickoff: "2026-12-02T20:00:00Z" },
    { eventId: "16363680", home: "Chelsea", away: "Crystal Palace", kickoff: "2026-12-02T20:00:00Z" },
    { eventId: "16363693", home: "Tottenham Hotspur", away: "Fulham", kickoff: "2026-12-02T20:00:00Z" },
    { eventId: "16363676", home: "Aston Villa", away: "Everton", kickoff: "2026-12-02T20:00:00Z" },
    { eventId: "16363678", home: "Bournemouth", away: "Brighton & Hove Albion", kickoff: "2026-12-02T20:00:00Z" },
    { eventId: "16363685", home: "Hull City", away: "Nottingham Forest", kickoff: "2026-12-02T20:00:00Z" },
    { eventId: "16363682", home: "Coventry City", away: "Ipswich Town", kickoff: "2026-12-02T20:00:00Z" }
  ],
  "14": [
    { eventId: "16363701", home: "Chelsea", away: "Liverpool FC", kickoff: "2026-12-05T15:00:00Z" },
    { eventId: "16363708", home: "Tottenham Hotspur", away: "Arsenal", kickoff: "2026-12-05T15:00:00Z" },
    { eventId: "16363700", home: "Brentford", away: "Manchester City", kickoff: "2026-12-05T15:00:00Z" },
    { eventId: "16363705", home: "Manchester United", away: "Coventry City", kickoff: "2026-12-05T15:00:00Z" },
    { eventId: "16363695", home: "Aston Villa", away: "Crystal Palace", kickoff: "2026-12-05T15:00:00Z" },
    { eventId: "16363706", home: "Newcastle United", away: "Sunderland", kickoff: "2026-12-05T15:00:00Z" },
    { eventId: "16363707", home: "Nottingham Forest", away: "Brighton & Hove Albion", kickoff: "2026-12-05T15:00:00Z" },
    { eventId: "16363702", home: "Everton", away: "Fulham", kickoff: "2026-12-05T15:00:00Z" },
    { eventId: "16363698", home: "Bournemouth", away: "Hull City", kickoff: "2026-12-05T15:00:00Z" },
    { eventId: "16363703", home: "Leeds United", away: "Ipswich Town", kickoff: "2026-12-05T15:00:00Z" }
  ],
  "15": [
    { eventId: "16363719", home: "Manchester City", away: "Chelsea", kickoff: "2026-12-12T15:00:00Z" },
    { eventId: "16363713", home: "Crystal Palace", away: "Manchester United", kickoff: "2026-12-12T15:00:00Z" },
    { eventId: "16363717", home: "Liverpool FC", away: "Leeds United", kickoff: "2026-12-12T15:00:00Z" },
    { eventId: "16363709", home: "Arsenal", away: "Bournemouth", kickoff: "2026-12-12T15:00:00Z" },
    { eventId: "16363715", home: "Hull City", away: "Tottenham Hotspur", kickoff: "2026-12-12T15:00:00Z" },
    { eventId: "16363712", home: "Coventry City", away: "Aston Villa", kickoff: "2026-12-12T15:00:00Z" },
    { eventId: "16363716", home: "Ipswich Town", away: "Newcastle United", kickoff: "2026-12-12T15:00:00Z" },
    { eventId: "16363710", home: "Brighton & Hove Albion", away: "Everton", kickoff: "2026-12-12T15:00:00Z" },
    { eventId: "16363720", home: "Sunderland", away: "Nottingham Forest", kickoff: "2026-12-12T15:00:00Z" },
    { eventId: "16363714", home: "Fulham", away: "Brentford", kickoff: "2026-12-12T15:00:00Z" }
  ],
  "16": [
    { eventId: "16363721", home: "Arsenal", away: "Manchester United", kickoff: "2026-12-19T15:00:00Z" },
    { eventId: "16363728", home: "Liverpool FC", away: "Tottenham Hotspur", kickoff: "2026-12-19T15:00:00Z" },
    { eventId: "16363729", home: "Manchester City", away: "Hull City", kickoff: "2026-12-19T15:00:00Z" },
    { eventId: "16363726", home: "Chelsea", away: "Aston Villa", kickoff: "2026-12-19T15:00:00Z" },
    { eventId: "16363723", home: "Brentford", away: "Newcastle United", kickoff: "2026-12-19T15:00:00Z" },
    { eventId: "16363730", home: "Nottingham Forest", away: "Everton", kickoff: "2026-12-19T15:00:00Z" },
    { eventId: "16363731", home: "Sunderland", away: "Crystal Palace", kickoff: "2026-12-19T15:00:00Z" },
    { eventId: "16363727", home: "Leeds United", away: "Fulham", kickoff: "2026-12-19T15:00:00Z" },
    { eventId: "16363724", home: "Brighton & Hove Albion", away: "Ipswich Town", kickoff: "2026-12-19T15:00:00Z" },
    { eventId: "16363722", home: "Bournemouth", away: "Coventry City", kickoff: "2026-12-19T15:00:00Z" }
  ],
  "17": [
    { eventId: "16363742", home: "Newcastle United", away: "Manchester City", kickoff: "2026-12-26T15:00:00Z" },
    { eventId: "16363741", home: "Manchester United", away: "Nottingham Forest", kickoff: "2026-12-26T15:00:00Z" },
    { eventId: "16363735", home: "Crystal Palace", away: "Arsenal", kickoff: "2026-12-26T15:00:00Z" },
    { eventId: "16363738", home: "Hull City", away: "Liverpool FC", kickoff: "2026-12-26T15:00:00Z" },
    { eventId: "16363734", home: "Coventry City", away: "Chelsea", kickoff: "2026-12-26T15:00:00Z" },
    { eventId: "16363743", home: "Tottenham Hotspur", away: "Bournemouth", kickoff: "2026-12-26T15:00:00Z" },
    { eventId: "16363733", home: "Aston Villa", away: "Leeds United", kickoff: "2026-12-26T15:00:00Z" },
    { eventId: "16363737", home: "Fulham", away: "Brighton & Hove Albion", kickoff: "2026-12-26T15:00:00Z" },
    { eventId: "16363736", home: "Everton", away: "Sunderland", kickoff: "2026-12-26T15:00:00Z" },
    { eventId: "16363740", home: "Ipswich Town", away: "Brentford", kickoff: "2026-12-26T15:00:00Z" }
  ],
  "18": [
    { eventId: "16363744", home: "Aston Villa", away: "Liverpool FC", kickoff: "2026-12-30T20:00:00Z" },
    { eventId: "16363748", home: "Everton", away: "Manchester City", kickoff: "2026-12-30T20:00:00Z" },
    { eventId: "16363749", home: "Fulham", away: "Arsenal", kickoff: "2026-12-30T20:00:00Z" },
    { eventId: "16363753", home: "Manchester United", away: "Sunderland", kickoff: "2026-12-30T20:00:00Z" },
    { eventId: "16363752", home: "Ipswich Town", away: "Chelsea", kickoff: "2026-12-30T20:00:00Z" },
    { eventId: "16363755", home: "Tottenham Hotspur", away: "Brighton & Hove Albion", kickoff: "2026-12-30T20:00:00Z" },
    { eventId: "16363754", home: "Newcastle United", away: "Nottingham Forest", kickoff: "2026-12-30T20:00:00Z" },
    { eventId: "16363747", home: "Crystal Palace", away: "Bournemouth", kickoff: "2026-12-30T20:00:00Z" },
    { eventId: "16363745", home: "Coventry City", away: "Brentford", kickoff: "2026-12-30T20:00:00Z" },
    { eventId: "16363750", home: "Hull City", away: "Leeds United", kickoff: "2026-12-30T20:00:00Z" }
  ],
  "19": [
    { eventId: "16363765", home: "Manchester City", away: "Tottenham Hotspur", kickoff: "2027-01-02T15:00:00Z" },
    { eventId: "16363760", home: "Brighton & Hove Albion", away: "Manchester United", kickoff: "2027-01-02T15:00:00Z" },
    { eventId: "16363761", home: "Chelsea", away: "Newcastle United", kickoff: "2027-01-02T15:00:00Z" },
    { eventId: "16363764", home: "Liverpool FC", away: "Coventry City", kickoff: "2027-01-02T15:00:00Z" },
    { eventId: "16363756", home: "Arsenal", away: "Ipswich Town", kickoff: "2027-01-02T15:00:00Z" },
    { eventId: "16363758", home: "Bournemouth", away: "Aston Villa", kickoff: "2027-01-02T15:00:00Z" },
    { eventId: "16363766", home: "Nottingham Forest", away: "Fulham", kickoff: "2027-01-02T15:00:00Z" },
    { eventId: "16363759", home: "Brentford", away: "Crystal Palace", kickoff: "2027-01-02T15:00:00Z" },
    { eventId: "16363763", home: "Leeds United", away: "Everton", kickoff: "2027-01-02T15:00:00Z" },
    { eventId: "16363768", home: "Sunderland", away: "Hull City", kickoff: "2027-01-02T15:00:00Z" }
  ],
  "20": [
    { eventId: "16363777", home: "Manchester United", away: "Newcastle United", kickoff: "2027-01-06T20:00:00Z" },
    { eventId: "16363776", home: "Leeds United", away: "Manchester City", kickoff: "2027-01-06T20:00:00Z" },
    { eventId: "16363780", home: "Sunderland", away: "Liverpool FC", kickoff: "2027-01-06T20:00:00Z" },
    { eventId: "16363769", home: "Arsenal", away: "Brentford", kickoff: "2027-01-06T20:00:00Z" },
    { eventId: "16363771", home: "Crystal Palace", away: "Chelsea", kickoff: "2027-01-06T20:00:00Z" },
    { eventId: "16363774", home: "Fulham", away: "Tottenham Hotspur", kickoff: "2027-01-06T20:00:00Z" },
    { eventId: "16363772", home: "Everton", away: "Aston Villa", kickoff: "2027-01-06T20:00:00Z" },
    { eventId: "16363770", home: "Brighton & Hove Albion", away: "Bournemouth", kickoff: "2027-01-06T20:00:00Z" },
    { eventId: "16363778", home: "Nottingham Forest", away: "Hull City", kickoff: "2027-01-06T20:00:00Z" },
    { eventId: "16363775", home: "Ipswich Town", away: "Coventry City", kickoff: "2027-01-06T20:00:00Z" }
  ],
  "21": [
    { eventId: "16363725", home: "Manchester City", away: "Nottingham Forest", kickoff: "2027-01-16T15:00:00Z" },
    { eventId: "16363665", home: "Aston Villa", away: "Manchester United", kickoff: "2027-01-16T15:00:00Z" },
    { eventId: "16363718", home: "Liverpool FC", away: "Crystal Palace", kickoff: "2027-01-16T15:00:00Z" },
    { eventId: "16363711", home: "Hull City", away: "Arsenal", kickoff: "2027-01-16T15:00:00Z" },
    { eventId: "16363697", home: "Chelsea", away: "Sunderland", kickoff: "2027-01-16T15:00:00Z" },
    { eventId: "16363739", home: "Tottenham Hotspur", away: "Leeds United", kickoff: "2027-01-16T15:00:00Z" },
    { eventId: "16363732", home: "Newcastle United", away: "Fulham", kickoff: "2027-01-16T15:00:00Z" },
    { eventId: "16363684", home: "Brentford", away: "Brighton & Hove Albion", kickoff: "2027-01-16T15:00:00Z" },
    { eventId: "16363704", home: "Coventry City", away: "Everton", kickoff: "2027-01-16T15:00:00Z" },
    { eventId: "16363674", home: "Bournemouth", away: "Ipswich Town", kickoff: "2027-01-16T15:00:00Z" }
  ],
  "22": [
    { eventId: "16363781", home: "Manchester United", away: "Liverpool FC", kickoff: "2027-01-23T15:00:00Z" },
    { eventId: "16363751", home: "Brighton & Hove Albion", away: "Manchester City", kickoff: "2027-01-23T15:00:00Z" },
    { eventId: "16363746", home: "Arsenal", away: "Newcastle United", kickoff: "2027-01-23T15:00:00Z" },
    { eventId: "16363779", home: "Leeds United", away: "Chelsea", kickoff: "2027-01-23T15:00:00Z" },
    { eventId: "16363757", home: "Crystal Palace", away: "Tottenham Hotspur", kickoff: "2027-01-23T15:00:00Z" },
    { eventId: "16363767", home: "Fulham", away: "Aston Villa", kickoff: "2027-01-23T15:00:00Z" },
    { eventId: "16363782", home: "Nottingham Forest", away: "Bournemouth", kickoff: "2027-01-23T15:00:00Z" },
    { eventId: "16363762", home: "Everton", away: "Brentford", kickoff: "2027-01-23T15:00:00Z" },
    { eventId: "16363783", home: "Sunderland", away: "Coventry City", kickoff: "2027-01-23T15:00:00Z" },
    { eventId: "16363773", home: "Ipswich Town", away: "Hull City", kickoff: "2027-01-23T15:00:00Z" }
  ],
  "23": [
    { eventId: "16363791", home: "Manchester City", away: "Arsenal", kickoff: "2027-01-30T15:00:00Z" },
    { eventId: "16363790", home: "Liverpool FC", away: "Everton", kickoff: "2027-01-30T15:00:00Z" },
    { eventId: "16363786", home: "Brentford", away: "Manchester United", kickoff: "2027-01-30T15:00:00Z" },
    { eventId: "16363787", home: "Chelsea", away: "Nottingham Forest", kickoff: "2027-01-30T15:00:00Z" },
    { eventId: "16363793", home: "Tottenham Hotspur", away: "Sunderland", kickoff: "2027-01-30T15:00:00Z" },
    { eventId: "16363792", home: "Newcastle United", away: "Brighton & Hove Albion", kickoff: "2027-01-30T15:00:00Z" },
    { eventId: "16363784", home: "Aston Villa", away: "Ipswich Town", kickoff: "2027-01-30T15:00:00Z" },
    { eventId: "16363785", home: "Bournemouth", away: "Fulham", kickoff: "2027-01-30T15:00:00Z" },
    { eventId: "16363789", home: "Hull City", away: "Crystal Palace", kickoff: "2027-01-30T15:00:00Z" },
    { eventId: "16363788", home: "Coventry City", away: "Leeds United", kickoff: "2027-01-30T15:00:00Z" }
  ],
  "24": [
    { eventId: "16363794", home: "Arsenal", away: "Liverpool FC", kickoff: "2027-02-06T15:00:00Z" },
    { eventId: "16363801", home: "Manchester United", away: "Chelsea", kickoff: "2027-02-06T15:00:00Z" },
    { eventId: "16363798", home: "Fulham", away: "Manchester City", kickoff: "2027-02-06T15:00:00Z" },
    { eventId: "16363799", home: "Ipswich Town", away: "Tottenham Hotspur", kickoff: "2027-02-06T15:00:00Z" },
    { eventId: "16363797", home: "Everton", away: "Newcastle United", kickoff: "2027-02-06T15:00:00Z" },
    { eventId: "16363803", home: "Sunderland", away: "Aston Villa", kickoff: "2027-02-06T15:00:00Z" },
    { eventId: "16363802", home: "Nottingham Forest", away: "Brentford", kickoff: "2027-02-06T15:00:00Z" },
    { eventId: "16363800", home: "Leeds United", away: "Bournemouth", kickoff: "2027-02-06T15:00:00Z" },
    { eventId: "16363796", home: "Crystal Palace", away: "Coventry City", kickoff: "2027-02-06T15:00:00Z" },
    { eventId: "16363795", home: "Brighton & Hove Albion", away: "Hull City", kickoff: "2027-02-06T15:00:00Z" }
  ],
  "25": [
    { eventId: "16363813", home: "Tottenham Hotspur", away: "Manchester City", kickoff: "2027-02-10T20:00:00Z" },
    { eventId: "16363811", home: "Manchester United", away: "Brighton & Hove Albion", kickoff: "2027-02-10T20:00:00Z" },
    { eventId: "16363812", home: "Newcastle United", away: "Chelsea", kickoff: "2027-02-10T20:00:00Z" },
    { eventId: "16363805", home: "Coventry City", away: "Liverpool FC", kickoff: "2027-02-10T20:00:00Z" },
    { eventId: "16363810", home: "Ipswich Town", away: "Arsenal", kickoff: "2027-02-10T20:00:00Z" },
    { eventId: "16363804", home: "Aston Villa", away: "Bournemouth", kickoff: "2027-02-10T20:00:00Z" },
    { eventId: "16363808", home: "Fulham", away: "Nottingham Forest", kickoff: "2027-02-10T20:00:00Z" },
    { eventId: "16363806", home: "Crystal Palace", away: "Brentford", kickoff: "2027-02-10T20:00:00Z" },
    { eventId: "16363807", home: "Everton", away: "Leeds United", kickoff: "2027-02-10T20:00:00Z" },
    { eventId: "16363809", home: "Hull City", away: "Sunderland", kickoff: "2027-02-10T20:00:00Z" }
  ],
  "26": [
    { eventId: "16363821", home: "Manchester City", away: "Newcastle United", kickoff: "2027-02-20T15:00:00Z" },
    { eventId: "16363822", home: "Nottingham Forest", away: "Manchester United", kickoff: "2027-02-20T15:00:00Z" },
    { eventId: "16363814", home: "Arsenal", away: "Fulham", kickoff: "2027-02-20T15:00:00Z" },
    { eventId: "16363820", home: "Liverpool FC", away: "Hull City", kickoff: "2027-02-20T15:00:00Z" },
    { eventId: "16363818", home: "Chelsea", away: "Ipswich Town", kickoff: "2027-02-20T15:00:00Z" },
    { eventId: "16363817", home: "Brighton & Hove Albion", away: "Tottenham Hotspur", kickoff: "2027-02-20T15:00:00Z" },
    { eventId: "16363819", home: "Leeds United", away: "Aston Villa", kickoff: "2027-02-20T15:00:00Z" },
    { eventId: "16363815", home: "Bournemouth", away: "Crystal Palace", kickoff: "2027-02-20T15:00:00Z" },
    { eventId: "16363823", home: "Sunderland", away: "Everton", kickoff: "2027-02-20T15:00:00Z" },
    { eventId: "16363816", home: "Brentford", away: "Coventry City", kickoff: "2027-02-20T15:00:00Z" }
  ],
  "27": [
    { eventId: "16363831", home: "Manchester United", away: "Arsenal", kickoff: "2027-02-27T15:00:00Z" },
    { eventId: "16363833", home: "Tottenham Hotspur", away: "Liverpool FC", kickoff: "2027-02-27T15:00:00Z" },
    { eventId: "16363829", home: "Hull City", away: "Manchester City", kickoff: "2027-02-27T15:00:00Z" },
    { eventId: "16363824", home: "Aston Villa", away: "Chelsea", kickoff: "2027-02-27T15:00:00Z" },
    { eventId: "16363832", home: "Newcastle United", away: "Brentford", kickoff: "2027-02-27T15:00:00Z" },
    { eventId: "16363827", home: "Everton", away: "Nottingham Forest", kickoff: "2027-02-27T15:00:00Z" },
    { eventId: "16363826", home: "Crystal Palace", away: "Sunderland", kickoff: "2027-02-27T15:00:00Z" },
    { eventId: "16363828", home: "Fulham", away: "Leeds United", kickoff: "2027-02-27T15:00:00Z" },
    { eventId: "16363830", home: "Ipswich Town", away: "Brighton & Hove Albion", kickoff: "2027-02-27T15:00:00Z" },
    { eventId: "16363825", home: "Coventry City", away: "Bournemouth", kickoff: "2027-02-27T15:00:00Z" }
  ],
  "28": [
    { eventId: "16363840", home: "Liverpool FC", away: "Aston Villa", kickoff: "2027-03-03T20:00:00Z" },
    { eventId: "16363841", home: "Manchester City", away: "Everton", kickoff: "2027-03-03T20:00:00Z" },
    { eventId: "16363834", home: "Arsenal", away: "Crystal Palace", kickoff: "2027-03-03T20:00:00Z" },
    { eventId: "16363843", home: "Sunderland", away: "Manchester United", kickoff: "2027-03-03T20:00:00Z" },
    { eventId: "16363838", home: "Chelsea", away: "Coventry City", kickoff: "2027-03-03T20:00:00Z" },
    { eventId: "16363835", home: "Bournemouth", away: "Tottenham Hotspur", kickoff: "2027-03-03T20:00:00Z" },
    { eventId: "16363842", home: "Nottingham Forest", away: "Newcastle United", kickoff: "2027-03-03T20:00:00Z" },
    { eventId: "16363837", home: "Brighton & Hove Albion", away: "Fulham", kickoff: "2027-03-03T20:00:00Z" },
    { eventId: "16363836", home: "Brentford", away: "Ipswich Town", kickoff: "2027-03-03T20:00:00Z" },
    { eventId: "16363839", home: "Leeds United", away: "Hull City", kickoff: "2027-03-03T20:00:00Z" }
  ],
  "29": [
    { eventId: "16363846", home: "Chelsea", away: "Arsenal", kickoff: "2027-03-13T15:00:00Z" },
    { eventId: "16363847", home: "Coventry City", away: "Manchester City", kickoff: "2027-03-13T15:00:00Z" },
    { eventId: "16363851", home: "Manchester United", away: "Everton", kickoff: "2027-03-13T15:00:00Z" },
    { eventId: "16363850", home: "Liverpool FC", away: "Ipswich Town", kickoff: "2027-03-13T15:00:00Z" },
    { eventId: "16363853", home: "Tottenham Hotspur", away: "Nottingham Forest", kickoff: "2027-03-13T15:00:00Z" },
    { eventId: "16363845", home: "Bournemouth", away: "Newcastle United", kickoff: "2027-03-13T15:00:00Z" },
    { eventId: "16363844", home: "Aston Villa", away: "Hull City", kickoff: "2027-03-13T15:00:00Z" },
    { eventId: "16363848", home: "Crystal Palace", away: "Fulham", kickoff: "2027-03-13T15:00:00Z" },
    { eventId: "16363849", home: "Leeds United", away: "Brighton & Hove Albion", kickoff: "2027-03-13T15:00:00Z" },
    { eventId: "16363852", home: "Sunderland", away: "Brentford", kickoff: "2027-03-13T15:00:00Z" }
  ],
  "30": [
    { eventId: "16363861", home: "Manchester City", away: "Manchester United", kickoff: "2027-03-20T15:00:00Z" },
    { eventId: "16363858", home: "Fulham", away: "Liverpool FC", kickoff: "2027-03-20T15:00:00Z" },
    { eventId: "16363854", home: "Arsenal", away: "Sunderland", kickoff: "2027-03-20T15:00:00Z" },
    { eventId: "16363859", home: "Hull City", away: "Chelsea", kickoff: "2027-03-20T15:00:00Z" },
    { eventId: "16363857", home: "Everton", away: "Tottenham Hotspur", kickoff: "2027-03-20T15:00:00Z" },
    { eventId: "16363863", home: "Nottingham Forest", away: "Aston Villa", kickoff: "2027-03-20T15:00:00Z" },
    { eventId: "16363862", home: "Newcastle United", away: "Leeds United", kickoff: "2027-03-20T15:00:00Z" },
    { eventId: "16363855", home: "Brentford", away: "Bournemouth", kickoff: "2027-03-20T15:00:00Z" },
    { eventId: "16363860", home: "Ipswich Town", away: "Crystal Palace", kickoff: "2027-03-20T15:00:00Z" },
    { eventId: "16363856", home: "Brighton & Hove Albion", away: "Coventry City", kickoff: "2027-03-20T15:00:00Z" }
  ],
  "31": [
    { eventId: "16363692", home: "Liverpool FC", away: "Newcastle United", kickoff: "2027-04-10T14:00:00Z" },
    { eventId: "16363681", home: "Bournemouth", away: "Manchester City", kickoff: "2027-04-10T14:00:00Z" },
    { eventId: "16363686", home: "Coventry City", away: "Arsenal", kickoff: "2027-04-10T14:00:00Z" },
    { eventId: "16363694", home: "Manchester United", away: "Hull City", kickoff: "2027-04-10T14:00:00Z" },
    { eventId: "16363683", home: "Chelsea", away: "Fulham", kickoff: "2027-04-10T14:00:00Z" },
    { eventId: "16363699", home: "Tottenham Hotspur", away: "Brentford", kickoff: "2027-04-10T14:00:00Z" },
    { eventId: "16363677", home: "Aston Villa", away: "Brighton & Hove Albion", kickoff: "2027-04-10T14:00:00Z" },
    { eventId: "16363688", home: "Crystal Palace", away: "Everton", kickoff: "2027-04-10T14:00:00Z" },
    { eventId: "16363690", home: "Leeds United", away: "Nottingham Forest", kickoff: "2027-04-10T14:00:00Z" },
    { eventId: "16363696", home: "Sunderland", away: "Ipswich Town", kickoff: "2027-04-10T14:00:00Z" }
  ],
  "32": [
    { eventId: "16363271", home: "Manchester City", away: "Crystal Palace", kickoff: "2027-04-17T14:00:00Z" },
    { eventId: "16363219", home: "Arsenal", away: "Aston Villa", kickoff: "2027-04-17T14:00:00Z" },
    { eventId: "16363192", home: "Nottingham Forest", away: "Liverpool FC", kickoff: "2027-04-17T14:00:00Z" },
    { eventId: "16363185", home: "Ipswich Town", away: "Manchester United", kickoff: "2027-04-17T14:00:00Z" },
    { eventId: "16363183", home: "Brighton & Hove Albion", away: "Chelsea", kickoff: "2027-04-17T14:00:00Z" },
    { eventId: "16363177", home: "Newcastle United", away: "Tottenham Hotspur", kickoff: "2027-04-17T14:00:00Z" },
    { eventId: "16363180", home: "Everton", away: "Bournemouth", kickoff: "2027-04-17T14:00:00Z" },
    { eventId: "16363270", home: "Brentford", away: "Leeds United", kickoff: "2027-04-17T14:00:00Z" },
    { eventId: "16363182", home: "Fulham", away: "Sunderland", kickoff: "2027-04-17T14:00:00Z" },
    { eventId: "16363187", home: "Hull City", away: "Coventry City", kickoff: "2027-04-17T14:00:00Z" }
  ],
  "33": [
    { eventId: "16363184", home: "Chelsea", away: "Manchester City", kickoff: "2027-04-24T14:00:00Z" },
    { eventId: "16363198", home: "Manchester United", away: "Crystal Palace", kickoff: "2027-04-24T14:00:00Z" },
    { eventId: "16363191", home: "Leeds United", away: "Liverpool FC", kickoff: "2027-04-24T14:00:00Z" },
    { eventId: "16363181", home: "Bournemouth", away: "Arsenal", kickoff: "2027-04-24T14:00:00Z" },
    { eventId: "16363193", home: "Tottenham Hotspur", away: "Hull City", kickoff: "2027-04-24T14:00:00Z" },
    { eventId: "16363179", home: "Aston Villa", away: "Coventry City", kickoff: "2027-04-24T14:00:00Z" },
    { eventId: "16363190", home: "Newcastle United", away: "Ipswich Town", kickoff: "2027-04-24T14:00:00Z" },
    { eventId: "16363178", home: "Everton", away: "Brighton & Hove Albion", kickoff: "2027-04-24T14:00:00Z" },
    { eventId: "16363186", home: "Nottingham Forest", away: "Sunderland", kickoff: "2027-04-24T14:00:00Z" },
    { eventId: "16363194", home: "Brentford", away: "Fulham", kickoff: "2027-04-24T14:00:00Z" }
  ],
  "34": [
    { eventId: "16363201", home: "Liverpool FC", away: "Chelsea", kickoff: "2027-05-01T14:00:00Z" },
    { eventId: "16363189", home: "Arsenal", away: "Tottenham Hotspur", kickoff: "2027-05-01T14:00:00Z" },
    { eventId: "16363202", home: "Manchester City", away: "Brentford", kickoff: "2027-05-01T14:00:00Z" },
    { eventId: "16363195", home: "Coventry City", away: "Manchester United", kickoff: "2027-05-01T14:00:00Z" },
    { eventId: "16363188", home: "Crystal Palace", away: "Aston Villa", kickoff: "2027-05-01T14:00:00Z" },
    { eventId: "16363204", home: "Sunderland", away: "Newcastle United", kickoff: "2027-05-01T14:00:00Z" },
    { eventId: "16363200", home: "Brighton & Hove Albion", away: "Nottingham Forest", kickoff: "2027-05-01T14:00:00Z" },
    { eventId: "16363197", home: "Fulham", away: "Everton", kickoff: "2027-05-01T14:00:00Z" },
    { eventId: "16363196", home: "Hull City", away: "Bournemouth", kickoff: "2027-05-01T14:00:00Z" },
    { eventId: "16363199", home: "Ipswich Town", away: "Leeds United", kickoff: "2027-05-01T14:00:00Z" }
  ],
  "35": [
    { eventId: "16363211", home: "Manchester City", away: "Liverpool FC", kickoff: "2027-05-08T14:00:00Z" },
    { eventId: "16363214", home: "Tottenham Hotspur", away: "Chelsea", kickoff: "2027-05-08T14:00:00Z" },
    { eventId: "16363203", home: "Bournemouth", away: "Manchester United", kickoff: "2027-05-08T14:00:00Z" },
    { eventId: "16363209", home: "Leeds United", away: "Arsenal", kickoff: "2027-05-08T14:00:00Z" },
    { eventId: "16363205", home: "Brentford", away: "Aston Villa", kickoff: "2027-05-08T14:00:00Z" },
    { eventId: "16363210", home: "Newcastle United", away: "Coventry City", kickoff: "2027-05-08T14:00:00Z" },
    { eventId: "16363212", home: "Nottingham Forest", away: "Crystal Palace", kickoff: "2027-05-08T14:00:00Z" },
    { eventId: "16363206", home: "Brighton & Hove Albion", away: "Sunderland", kickoff: "2027-05-08T14:00:00Z" },
    { eventId: "16363207", home: "Fulham", away: "Ipswich Town", kickoff: "2027-05-08T14:00:00Z" },
    { eventId: "16363208", home: "Everton", away: "Hull City", kickoff: "2027-05-08T14:00:00Z" }
  ],
  "36": [
    { eventId: "16363251", home: "Ipswich Town", away: "Manchester City", kickoff: "2027-05-15T14:00:00Z" },
    { eventId: "16363221", home: "Liverpool FC", away: "Brentford", kickoff: "2027-05-15T14:00:00Z" },
    { eventId: "16363213", home: "Arsenal", away: "Nottingham Forest", kickoff: "2027-05-15T14:00:00Z" },
    { eventId: "16363248", home: "Manchester United", away: "Leeds United", kickoff: "2027-05-15T14:00:00Z" },
    { eventId: "16363215", home: "Chelsea", away: "Everton", kickoff: "2027-05-15T14:00:00Z" },
    { eventId: "16363218", home: "Aston Villa", away: "Newcastle United", kickoff: "2027-05-15T14:00:00Z" },
    { eventId: "16363216", home: "Coventry City", away: "Tottenham Hotspur", kickoff: "2027-05-15T14:00:00Z" },
    { eventId: "16363217", home: "Crystal Palace", away: "Brighton & Hove Albion", kickoff: "2027-05-15T14:00:00Z" },
    { eventId: "16363223", home: "Sunderland", away: "Bournemouth", kickoff: "2027-05-15T14:00:00Z" },
    { eventId: "16363220", home: "Hull City", away: "Fulham", kickoff: "2027-05-15T14:00:00Z" }
  ],
  "37": [
    { eventId: "16363267", home: "Manchester City", away: "Aston Villa", kickoff: "2027-05-23T14:00:00Z" },
    { eventId: "16363229", home: "Tottenham Hotspur", away: "Manchester United", kickoff: "2027-05-23T14:00:00Z" },
    { eventId: "16363227", home: "Brighton & Hove Albion", away: "Liverpool FC", kickoff: "2027-05-23T14:00:00Z" },
    { eventId: "16363225", home: "Everton", away: "Arsenal", kickoff: "2027-05-23T14:00:00Z" },
    { eventId: "16363224", home: "Bournemouth", away: "Chelsea", kickoff: "2027-05-23T14:00:00Z" },
    { eventId: "16363231", home: "Newcastle United", away: "Crystal Palace", kickoff: "2027-05-23T14:00:00Z" },
    { eventId: "16363228", home: "Nottingham Forest", away: "Ipswich Town", kickoff: "2027-05-23T14:00:00Z" },
    { eventId: "16363230", home: "Leeds United", away: "Sunderland", kickoff: "2027-05-23T14:00:00Z" },
    { eventId: "16363226", home: "Fulham", away: "Coventry City", kickoff: "2027-05-23T14:00:00Z" },
    { eventId: "16363222", home: "Brentford", away: "Hull City", kickoff: "2027-05-23T14:00:00Z" }
  ],
  "38": [
    { eventId: "16363240", home: "Sunderland", away: "Manchester City", kickoff: "2027-05-30T15:00:00Z" },
    { eventId: "16363268", home: "Liverpool FC", away: "Bournemouth", kickoff: "2027-05-30T15:00:00Z" },
    { eventId: "16363232", home: "Arsenal", away: "Brighton & Hove Albion", kickoff: "2027-05-30T15:00:00Z" },
    { eventId: "16363239", home: "Manchester United", away: "Fulham", kickoff: "2027-05-30T15:00:00Z" },
    { eventId: "16363233", home: "Chelsea", away: "Brentford", kickoff: "2027-05-30T15:00:00Z" },
    { eventId: "16363237", home: "Aston Villa", away: "Tottenham Hotspur", kickoff: "2027-05-30T15:00:00Z" },
    { eventId: "16363241", home: "Hull City", away: "Newcastle United", kickoff: "2027-05-30T15:00:00Z" },
    { eventId: "16363235", home: "Crystal Palace", away: "Leeds United", kickoff: "2027-05-30T15:00:00Z" },
    { eventId: "16363265", home: "Coventry City", away: "Nottingham Forest", kickoff: "2027-05-30T15:00:00Z" },
    { eventId: "16363234", home: "Ipswich Town", away: "Everton", kickoff: "2027-05-30T15:00:00Z" }
  ]
};

// Premier League: campionato senza fasi eliminatorie → nessuna giornata "elim" (niente ET/rigori)
const GIORNATE_ELIMINATORIE = new Set();
const FINESTRA_LEAGUE_MS    = 135 * 60 * 1000; // 2h15m — finestra attiva League Phase
const FINESTRA_ELIM_MS      = 180 * 60 * 1000; // 3h — finestra attiva eliminatorie (copre ET + rigori)
const FINESTRA_EXTENDED_MS  =   7 * 60 * 60 * 1000; // 7h extra dopo fine finestra attiva

const POLLING_LIVE_MS       =  15 * 60 * 1000; // 15 min — live normale
const POLLING_ET_MS         =   1 * 60 * 1000; // 1 min  — supplementari rilevati (cron */1)
const POLLING_EXTENDED_MS   =  60 * 60 * 1000; // 60 min — fase estesa post-partita

// ── NUOVA CADENZA CAMPIONATO/GIRONI: due poll per partita ──
// 1a chiamata a KO+50min, 2a chiamata a KO+2h30 (150min).
const POLL_OFFSETS_MS = [50 * 60 * 1000, 150 * 60 * 1000];
// La partita di campionato/gironi resta "attiva" fino a KO + ultimo offset + margine
// ampio (recupero se la function e' stata giu').
const LEAGUE_ACTIVE_MS = POLL_OFFSETS_MS[POLL_OFFSETS_MS.length - 1] + 6 * 60 * 60 * 1000;

// Campionato/gironi: al piu' un poll per run, al raggiungimento del prossimo offset da fare.
async function shouldPollOffset(db, eventId, nowMs, kickoffMs) {
  const ref  = db.ref(`pollerState/${eventId}/lastOffsetDone`);
  const snap = await ref.once("value");
  const raw  = snap.val();
  const lastDone = (raw === null || raw === undefined) ? -1 : raw;
  let dueIdx = -1;
  for (let i = 0; i < POLL_OFFSETS_MS.length; i++) {
    if (nowMs >= kickoffMs + POLL_OFFSETS_MS[i]) dueIdx = i;
  }
  if (dueIdx > lastDone) {
    await ref.set(dueIdx);
    return { poll: true, offsetIndex: dueIdx };
  }
  return { poll: false, offsetIndex: lastDone };
}

// ── FIREBASE ADMIN INIT ────────────────────────────────────
let firebaseApp;
function getFirebase() {
  if (!firebaseApp) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
  }
  return admin.database();
}

// ── HELPERS ────────────────────────────────────────────────

function getActiveMatches(nowMs) {
  const active = [];
  for (const [gId, matches] of Object.entries(MATCHES)) {
    const isElim = GIORNATE_ELIMINATORIE.has(gId);
    for (const match of matches) {
      if (!match.eventId || !match.kickoff) continue;
      const ko = new Date(match.kickoff).getTime();
      if (!isElim) {
        // Campionato/gironi: due poll a offset fissi dal kickoff (KO+50min, KO+2h30).
        if (nowMs >= ko && nowMs <= ko + LEAGUE_ACTIVE_MS) {
          active.push({ ...match, giornata: gId, phase: "league" });
        }
        continue;
      }
      // Eliminatorie: logica a finestre (live/extended) invariata.
      const endLive     = ko + FINESTRA_ELIM_MS;
      const endExtended = endLive + FINESTRA_EXTENDED_MS;
      if (nowMs >= ko && nowMs <= endLive) {
        active.push({ ...match, giornata: gId, phase: "live" });
      } else if (nowMs > endLive && nowMs <= endExtended) {
        active.push({ ...match, giornata: gId, phase: "extended" });
      }
    }
  }
  return active;
}

async function shouldPoll(db, eventId, nowMs, intervalMs, kickoffMs) {
  const ref  = db.ref(`pollerState/${eventId}/lastPolled`);
  const snap = await ref.once("value");
  // Se non ancora mai pollata, usa kickoff come baseline: primo poll dopo 1 intervallo dal kickoff
  const lastPolled = snap.val() || kickoffMs;
  if (nowMs - lastPolled >= intervalMs) {
    await ref.set(nowMs);
    return true;
  }
  return false;
}

// Verifica se la partita è già stata congelata (rigori rilevati)
async function isMatchFrozen(db, eventId) {
  const snap = await db.ref(`pollerState/${eventId}/frozen`).once("value");
  return snap.val() === true;
}

// Congela la partita: nessun ulteriore aggiornamento dei voti
async function freezeMatch(db, eventId) {
  await db.ref(`pollerState/${eventId}/frozen`).set(true);
  console.log(`[poller] 🔒 Partita ${eventId} congelata — rigori rilevati`);
}

// Rileva se i supplementari sono iniziati dagli incident di SofaScore
function detectExtraTime(incidents) {
  const incList = incidents?.incidents || [];
  return incList.some(inc => {
    const period = (inc.period || "").toLowerCase();
    return period === "extra1" || period === "extra2" ||
           period === "et1"    || period === "et2"    ||
           period.includes("extra");
  });
}

// Rileva se la lotteria dei rigori è iniziata dagli incident di SofaScore
function detectShootout(incidents) {
  const incList = incidents?.incidents || [];
  for (const inc of incList) {
    // SofaScore usa incidentClass "shootout" o period "penalties"/"shootout" per i tiri
    if (inc.incidentClass === "shootout")       return true;
    if (inc.incidentClass === "penaltyShootout") return true;
    if (inc.period === "shootout")              return true;
    if (inc.period === "penalties")             return true;
    // Fallback: incidentType "penaltyShootout"
    if (inc.incidentType === "penaltyShootout") return true;
  }
  return false;
}

// Rimuove dagli incidents tutti gli eventi appartenenti alla lotteria dei rigori,
// così i voti scritti al momento del freeze riflettono solo i 120' di gioco.
function filterPreShootoutIncidents(incidents) {
  const shootoutPeriods = new Set(["shootout", "penalties"]);
  const filtered = (incidents?.incidents || []).filter(inc => {
    const period = (inc.period || "").toLowerCase();
    if (shootoutPeriods.has(period)) return false;
    if (inc.incidentClass === "shootout" || inc.incidentClass === "penaltyShootout") return false;
    if (inc.incidentType === "penaltyShootout") return false;
    return true;
  });
  return { ...incidents, incidents: filtered };
}

// ── NAME NORMALISATION ─────────────────────────────────────
// Normalizza rimuovendo accenti e punteggiatura ma mantenendo gli spazi.
// Es. "A. González" → "a gonzalez",  "Armando González" → "armando gonzalez"
function normalizeName(name) {
  return String(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Ritorna l'ultima parola significativa (>1 char) come proxy del cognome.
// "a gonzalez" → "gonzalez",  "armando gonzalez" → "gonzalez",  "chavez" → "chavez"
function lastName(normalized) {
  const words = normalized.split(" ").filter(w => w.length > 1);
  return words[words.length - 1] || normalized;
}

// Costruisce un indice { nazione: { normalizedName → dbName } } da giocatoriSquadra
async function loadPlayerIndex(db) {
  const snap = await db.ref("global/giocatoriSquadra").once("value");
  const squadre = snap.val() || {};
  const index = {};
  for (const [nazione, players] of Object.entries(squadre)) {
    index[nazione] = {};
    const arr = Array.isArray(players) ? players : Object.values(players);
    for (const p of arr) {
      if (p?.nome) index[nazione][normalizeName(p.nome)] = p.nome;
    }
  }
  return index;
}

// Carica la mappa manuale: { nazione: { nomeSofaScore → nomeDB } }
// Editabile dal superadmin su Firebase: global/playerAliases/{nazione}/{nomeSofaScore}
async function loadPlayerAliases(db) {
  const snap = await db.ref("global/playerAliases").once("value");
  return snap.val() || {};
}

// Risolve un nome SofaScore nel corrispondente nome nel nostro DB.
// Strategia (in ordine di priorità):
//   0) Alias manuale in Firebase (global/playerAliases) — priorità assoluta
//   1) Match esatto normalizzato
//   2) Match su cognome — ultima parola significativa (gestisce "A. Gonzalez" ↔ "Armando González")
//   3) Word-set match — stesse parole in ordine diverso (gestisce "Son Heung-min" ↔ "Heung-min Son")
//   4) Contenimento senza spazi come fallback
function resolvePlayerName(sofaName, nationIndex, nationAliases) {
  // 0) Alias (chiave = safeKey del nome SofaScore, per compatibilità Firebase)
  if (nationAliases?.[safeKey(sofaName)]) return nationAliases[safeKey(sofaName)];

  if (!nationIndex) return sofaName;
  const norm     = normalizeName(sofaName);
  const sofaLast = lastName(norm);
  const sofaWords = norm.split(" ").filter(w => w.length > 1);

  // 1) Exact normalized match
  if (nationIndex[norm]) return nationIndex[norm];

  // 2) Last-name match — disambigua per prefisso del primo token
  //    Gestisce: "D. Gomez"→"Diego Gomez", "Li."↔"Lisandro", "La."↔"Lautaro",
  //    "Lautaro Martinez"→"La. Martinez" (prefix), "L. Martinez" ambiguo→alias manuale
  {
    const lnMatches = [];
    for (const [normDb, dbName] of Object.entries(nationIndex)) {
      if (lastName(normDb) === sofaLast && sofaLast.length >= 3) {
        lnMatches.push({ normDb, dbName });
      }
    }
    if (lnMatches.length === 1) return lnMatches[0].dbName;
    if (lnMatches.length > 1) {
      const sofaFirst = norm.split(" ")[0]; // "d", "li", "lautaro", ecc.
      if (sofaFirst) {
        // 2a) Exact first-word match ("li" === "li")
        const exact = lnMatches.find(({ normDb }) => normDb.split(" ")[0] === sofaFirst);
        if (exact) return exact.dbName;
        // 2b) Prefix match: uno è prefisso dell'altro ("d"⊂"diego", "lautaro"⊃"la")
        const prefixed = lnMatches.filter(({ normDb }) => {
          const dbFirst = normDb.split(" ")[0];
          return dbFirst.startsWith(sofaFirst) || sofaFirst.startsWith(dbFirst);
        });
        if (prefixed.length === 1) return prefixed[0].dbName;
      }
      return lnMatches[0].dbName;
    }
  }

  // 3) Word-set match (gestisce nomi con ordine invertito, es. "Son Heung-min" ↔ "Heung-min Son")
  if (sofaWords.length >= 2) {
    const sofaSet = new Set(sofaWords);
    for (const [normDb, dbName] of Object.entries(nationIndex)) {
      const dbWords = normDb.split(" ").filter(w => w.length > 1);
      if (dbWords.length === sofaWords.length && dbWords.every(w => sofaSet.has(w))) return dbName;
    }
  }

  // 4) Containment fallback
  const normFlat = norm.replace(/ /g, "");
  for (const [normDb, dbName] of Object.entries(nationIndex)) {
    const dbFlat = normDb.replace(/ /g, "");
    if (dbFlat.length >= 4 && (normFlat.includes(dbFlat) || dbFlat.includes(normFlat))) return dbName;
  }

  return sofaName;
}

function mapPosition(pos) {
  if (!pos) return "C";
  const p = pos.toUpperCase();
  if (["G","GK","GOALKEEPER"].includes(p)) return "P";
  if (["D","DEFENDER","DC","DL","DR","WB"].includes(p)) return "D";
  if (["M","MIDFIELDER","MC","ML","MR","AM","DM"].includes(p)) return "C";
  if (["F","FORWARD","ATTACKER","ST","SS","LW","RW"].includes(p)) return "A";
  return "C";
}

function fetchRapidAPI(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "sofascore.p.rapidapi.com",
      path,
      method: "GET",
      headers: {
        "x-rapidapi-host": "sofascore.p.rapidapi.com",
        "x-rapidapi-key":  process.env.RAPIDAPI_KEY,
      },
    };
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf-8");
        if (res.statusCode !== 200) {
          const err = new Error(`RapidAPI status ${res.statusCode}`);
          err.status = res.statusCode;
          reject(err);
          return;
        }
        try { resolve(JSON.parse(raw)); }
        catch { reject(new Error("Risposta non JSON")); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function parseCardsFromIncidents(incidents) {
  const cards = {};
  const penaltyScored = {};
  const incList = incidents.incidents || [];
  console.log(`[poller] incidents totali: ${incList.length}`);
  for (const inc of incList) {
    if (inc.incidentType === "card" && inc.player) {
      const name = inc.player.name;
      console.log(`[poller] cartellino: ${name} → ${inc.incidentClass}`);
      if (!cards[name]) cards[name] = { amm: false, esp: false };
      if (inc.incidentClass === "yellow") {
        cards[name].amm = true;
      } else if (inc.incidentClass === "red" || inc.incidentClass === "yellowRed") {
        cards[name].esp = true;
        cards[name].amm = false;
      }
    }
    if (inc.incidentType === "goal" && inc.incidentClass === "penalty" && inc.player) {
      penaltyScored[inc.player.name] = (penaltyScored[inc.player.name] || 0) + 1;
    }
  }
  return { cards, penaltyScored };
}

function extractFlags(stats, ruolo, goalsAgainst, goalsAgainstPenalty, cardInfo) {
  const flags = {};

  // Gol — Sofascore può usare "goals" o "goalNormal"
  const gol = (stats?.goals || 0) + (stats?.goalNormal || 0);
  if (gol > 0) flags.gol = gol;

  // Assist
  if ((stats?.goalAssist || 0) > 0) flags.assist = stats.goalAssist;

  // Autogol
  if ((stats?.ownGoals || 0) > 0) flags.aut = stats.ownGoals;

  // Rigore sbagliato
  if ((stats?.penaltyMiss || 0) > 0) flags.rig = true;

  // Cartellini (da incidents — più affidabili delle stats)
  if (cardInfo?.amm) flags.amm = true;
  if (cardInfo?.esp) flags.esp = true;

  // Solo portiere
  if (ruolo === "P") {
    const minPlayed = stats?.minutesPlayed || 0;
    const hasPlayed = minPlayed > 0;

    if (hasPlayed) {
      // Rigore parato: penaltyFaced - rigori segnati contro
      const faced  = stats?.penaltyFaced || 0;
      const rigPar = Math.max(0, faced - (goalsAgainstPenalty || 0));
      if (rigPar > 0) flags.rigpar = rigPar;

      // Gol subiti: usa il dato individuale Sofascore se disponibile
      // (corretto per portieri sostituiti — ciascuno vede solo i gol presi durante il suo turno)
      const gs = stats?.goalsConceded !== undefined ? stats.goalsConceded : goalsAgainst;
      if (gs === 0) flags.pi = 1;
      if (gs > 0)   flags.gs = gs;
    }
  }

  return flags;
}

async function parseLineups(lineups, incidents, match, playerIndex, playerAliases) {
  const result = {};
  const { cards, penaltyScored } = parseCardsFromIncidents(incidents);

  // Gol totali per squadra (inclusi autogol avversari)
  const goalsHome = (lineups.home?.players || [])
    .reduce((s, e) => s + (e.statistics?.goals    || 0), 0)
    + (lineups.away?.players || []).reduce((s, e) => s + (e.statistics?.ownGoals || 0), 0);
  const goalsAway = (lineups.away?.players || [])
    .reduce((s, e) => s + (e.statistics?.goals    || 0), 0)
    + (lineups.home?.players || []).reduce((s, e) => s + (e.statistics?.ownGoals || 0), 0);

  // Rigori segnati contro ciascuna squadra
  const penaltyAgainstHome = Object.entries(penaltyScored)
    .filter(([name]) => (lineups.away?.players || []).some(e => e.player.name === name))
    .reduce((s, [,v]) => s + v, 0);
  const penaltyAgainstAway = Object.entries(penaltyScored)
    .filter(([name]) => (lineups.home?.players || []).some(e => e.player.name === name))
    .reduce((s, [,v]) => s + v, 0);

  for (const [side, nazione] of [["home", match.home], ["away", match.away]]) {
    result[nazione] = {};
    const goalsAgainst   = side === "home" ? goalsAway  : goalsHome;
    const penaltyAgainst = side === "home" ? penaltyAgainstHome : penaltyAgainstAway;
    const players = lineups[side]?.players || [];
    console.log(`[poller] ${nazione} — goals against: ${goalsAgainst}, players: ${players.length}`);

    if (players[0]) {
      console.log(`[poller] sample stats ${players[0].player.name}: ${JSON.stringify(players[0].statistics)}`);
    }

    for (const entry of players) {
      const p            = entry.player;
      const stats        = entry.statistics;
      const ruolo        = mapPosition(entry.position || p.position);
      const rating       = stats?.rating ? Math.round(parseFloat(stats.rating) * 100) / 100 : null;
      const sv           = entry.substitute === true && !(stats?.minutesPlayed > 0);
      const flags        = extractFlags(stats, ruolo, goalsAgainst, penaltyAgainst, cards[p.name]);
      const resolvedName = resolvePlayerName(p.name, playerIndex?.[nazione], playerAliases?.[nazione]);

      if (resolvedName !== p.name) {
        console.log(`[poller] 🔤 nome risolto: "${p.name}" → "${resolvedName}"`);
      } else if (!playerIndex?.[nazione]?.[normalizeName(p.name)]) {
        console.log(`[poller] ⚠️ nome non trovato nel DB: "${p.name}" (${nazione})`);
      }

      if (Object.keys(flags).length > 0) {
        console.log(`[poller] flags ${resolvedName} (${ruolo}): ${JSON.stringify(flags)}`);
      }

      if (sv) {
        result[nazione][resolvedName] = { sv: true, flags, source: "sofascore" };
      } else if (rating !== null) {
        result[nazione][resolvedName] = { v: rating, sv: false, flags, source: "sofascore" };
      }
    }

    // Giocatori assenti dalla convocazione (infortuni, squalifiche) → SV automatico
    if (players.length > 0 && playerIndex?.[nazione]) {
      for (const dbName of Object.values(playerIndex[nazione])) {
        if (result[nazione][dbName] === undefined) {
          result[nazione][dbName] = { sv: true, source: "sofascore-absent" };
          console.log(`[poller] 🏥 assente dalla conv.: "${dbName}" (${nazione}) → SV`);
        }
      }
    }
  }
  return result;
}

function safeKey(s) { return String(s).replace(/[.#$[\]]/g, "_"); }

async function writeVoti(db, giornata, votiNuovi) {
  const writes = [];
  for (const [nazione, giocatori] of Object.entries(votiNuovi)) {
    for (const [nome, dati] of Object.entries(giocatori)) {
      const ref  = db.ref(`global/voti/${nazione}/${giornata}/${safeKey(nome)}`);
      const snap = await ref.once("value");
      const existing = snap.val() || {};
      // Assenti: non sovrascrivere se esiste già un voto o SV (manuale o da import precedente)
      if (dati.source === "sofascore-absent" && (existing.v !== undefined || existing.sv !== undefined)) {
        continue;
      }
      // Preserva flags solo se modificati manualmente dal superadmin
      const useExistingFlags = existing.flags &&
        Object.keys(existing.flags).length > 0 &&
        existing.source !== "sofascore";
      writes.push(ref.set({
        ...dati,
        flags: useExistingFlags ? existing.flags : (dati.flags || {}),
      }));
    }
  }
  await Promise.all(writes);
  await db.ref("global/_updatedAt").set(Date.now());
}

// ── HANDLER PRINCIPALE ─────────────────────────────────────
exports.handler = async function () {
  const now = Date.now();
  const activeMatches = getActiveMatches(now);

  if (!activeMatches.length) {
    console.log(`[poller] Nessuna partita attiva alle ${new Date(now).toISOString()}`);
    return { statusCode: 200, body: "Nessuna partita attiva" };
  }

  console.log(`[poller] ${activeMatches.length} partite attive: ${activeMatches.map(m => `${m.home}-${m.away}`).join(", ")}`);

  let db;
  try {
    db = getFirebase();
  } catch (err) {
    console.error("[poller] Errore init Firebase:", err.message);
    return { statusCode: 500, body: "Errore Firebase" };
  }

  // Indice nomi + alias manuali: usati per normalizzare i nomi SofaScore
  let playerIndex = {}, playerAliases = {};
  try {
    [playerIndex, playerAliases] = await Promise.all([loadPlayerIndex(db), loadPlayerAliases(db)]);
  } catch (err) {
    console.warn("[poller] Impossibile caricare playerIndex/aliases:", err.message);
  }

  const results = [];
  for (const match of activeMatches) {
    const isElim = GIORNATE_ELIMINATORIE.has(match.giornata);

    // ── Campionato/gironi: cadenza a due poll (KO+50min, KO+2h30) ──
    if (match.phase === "league") {
      const kickoffMs = new Date(match.kickoff).getTime();
      const { poll, offsetIndex } = await shouldPollOffset(db, match.eventId, now, kickoffMs);
      if (!poll) {
        results.push(`\u23ed ${match.home}-${match.away}: in attesa prossimo poll`);
        continue;
      }
      try {
        const [lineups, incidents] = await Promise.all([
          fetchRapidAPI(`/matches/get-lineups?matchId=${match.eventId}`),
          fetchRapidAPI(`/matches/get-incidents?matchId=${match.eventId}`),
        ]);
        const voti = await parseLineups(lineups, incidents, match, playerIndex, playerAliases);
        await writeVoti(db, match.giornata, voti);
        const nHome = Object.keys(voti[match.home] || {}).length;
        const nAway = Object.keys(voti[match.away] || {}).length;
        const label = offsetIndex === 0 ? "KO+50m" : "KO+2h30";
        results.push(`\u2713 ${match.home}(${nHome}) - ${match.away}(${nAway}) [${label}]`);
        console.log(`[poller] \u2713 ${match.home}-${match.away}: ${nHome}+${nAway} voti (${label})`);
      } catch (err) {
        results.push(`\u2717 ${match.home}-${match.away}: ${err.message}`);
        console.error(`[poller] \u2717 ${match.home}-${match.away}:`, err.message);
      }
      continue;
    }

    // Salta se la partita è già stata congelata (rigori rilevati in precedenza)
    const frozen = await isMatchFrozen(db, match.eventId);
    if (frozen) {
      console.log(`[poller] 🔒 ${match.home}-${match.away}: congelato (rigori)`);
      results.push(`🔒 ${match.home}-${match.away}: congelato`);
      continue;
    }

    // Eliminatorie in fase extended: salta se la partita è andata ai supplementari.
    // La finestra live (150 min) copre già tutto l'ET; l'extended serve solo
    // per partite finite nei 90' dove Sofascore finalizza i rating dopo il fischio.
    if (isElim && match.phase === "extended") {
      const etSnap = await db.ref(`pollerState/${match.eventId}/etDetected`).once("value");
      if (etSnap.val()) {
        console.log(`[poller] ⏭ ${match.home}-${match.away}: ET rilevato → skip extended`);
        results.push(`⏭ ${match.home}-${match.away}: ET → no extended`);
        continue;
      }
    }

    // Determina intervallo di polling in base alla fase e all'eventuale ET rilevato
    let intervalMs = POLLING_LIVE_MS;
    if (match.phase === "extended") {
      intervalMs = POLLING_EXTENDED_MS;
    } else if (isElim) {
      const etSnap = await db.ref(`pollerState/${match.eventId}/etDetected`).once("value");
      if (etSnap.val()) intervalMs = POLLING_ET_MS;
    }

    const kickoffMs = new Date(match.kickoff).getTime();
    const doPoll = await shouldPoll(db, match.eventId, now, intervalMs, kickoffMs);
    if (!doPoll) {
      console.log(`[poller] ⏭ Skip ${match.home}-${match.away} (< ${intervalMs / 60000} min fa)`);
      results.push(`⏭ ${match.home}-${match.away}: skipped`);
      continue;
    }

    try {
      const [lineups, incidents] = await Promise.all([
        fetchRapidAPI(`/matches/get-lineups?matchId=${match.eventId}`),
        fetchRapidAPI(`/matches/get-incidents?matchId=${match.eventId}`),
      ]);

      // Eliminatorie: rigori rilevati → congela senza scrivere.
      // I rating Sofascore si aggiornano in tempo reale durante la lotteria,
      // quindi l'ultimo poll pre-rigori è il dato più pulito da preservare.
      if (isElim && detectShootout(incidents)) {
        await freezeMatch(db, match.eventId);
        results.push(`⚠️ ${match.home}-${match.away}: rigori rilevati → congelato`);
        console.log(`[poller] ⚠️ ${match.home}-${match.away}: shootout rilevato, voti NON aggiornati`);
        continue;
      }

      // Eliminatorie live: rileva inizio supplementari → passa a polling 5 min
      if (isElim && match.phase === "live" && detectExtraTime(incidents)) {
        await db.ref(`pollerState/${match.eventId}/etDetected`).set(true);
        console.log(`[poller] ⚡ ${match.home}-${match.away}: supplementari rilevati → polling 5 min`);
      }

      const voti = await parseLineups(lineups, incidents, match, playerIndex, playerAliases);
      await writeVoti(db, match.giornata, voti);
      const nHome = Object.keys(voti[match.home] || {}).length;
      const nAway = Object.keys(voti[match.away] || {}).length;
      const phaseLabel = match.phase === "extended" ? " [ext]" : "";
      results.push(`✓ ${match.home}(${nHome}) - ${match.away}(${nAway})${phaseLabel}`);
      console.log(`[poller] ✓ ${match.home}-${match.away}: ${nHome}+${nAway} voti (${match.phase})`);
    } catch (err) {
      results.push(`✗ ${match.home}-${match.away}: ${err.message}`);
      console.error(`[poller] ✗ ${match.home}-${match.away}:`, err.message);
    }
  }

  return { statusCode: 200, body: results.join("\n") };
};
