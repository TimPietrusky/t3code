// Open tickets in the Linear project "After the conference", read on 2 Nov 2026, for Tim to close or keep.
export const AFTER_CONF_READ = "2 Nov, 17:21";

export const AFTER_CONF_TICKETS: readonly {
  readonly id: string;
  readonly title: string;
  readonly state: string;
  readonly who: string;
}[] = [
  {
    id: "KAL-63",
    title: "Rotate the dev-updates feed token out of source",
    state: "Backlog",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-100",
    title: "Move gateway-key-protected Convex functions to internal functions behind HTTP actions",
    state: "Backlog",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-213",
    title: "Device errors show a unique support code that maps to exactly one cause",
    state: "Backlog",
    who: "",
  },
  {
    id: "KAL-286",
    title: "Keep the Draw canvas partially visible at all zoom and pan extremes",
    state: "Backlog",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-438",
    title: "Undo history doesn't survive reopening a drawing",
    state: "Backlog",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-466",
    title: "Remove dead AutoDraw sketch recognizer from daso-ink",
    state: "In Progress",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-508",
    title: "Ask says 'already saved' when confirming a brand-new memory",
    state: "Todo",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-552",
    title: "Screen time limits the grown-up sets in the grown-up app, global and per app, opt-in",
    state: "Todo",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-579",
    title: "Rename Daso to Kale everywhere: zero-downtime migration to kale.computer (umbrella)",
    state: "In Progress",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-610",
    title: "Head: parent in the loop in the grown-up app: do-together ideas, how it went",
    state: "Todo",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-611",
    title:
      "Family memory in the grown-up app: consent switch, city, past do-together ideas, plain disclosure",
    state: "Todo",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-613",
    title: "Ask the grown-up in the app how a recommended activity went, store the answer",
    state: "Todo",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-618",
    title: "Ship Kale to the 30 founding families in one batch after NewKid",
    state: "Todo",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-620",
    title: "Head: Math Academy integrated as a tool in the loop",
    state: "Backlog",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-657",
    title:
      "Recording flow leaves zero-byte recording-*.m4a files in files/Audio after every voice take",
    state: "Todo",
    who: "",
  },
  {
    id: "KAL-678",
    title:
      "Unreadable profile row plus persisted done mounts the child shell on device-wide storage without a recovery gate",
    state: "Backlog",
    who: "",
  },
  {
    id: "KAL-714",
    title:
      "Kale-managed Math Academy student accounts and progress sync on the current Beta 10 API",
    state: "Backlog",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-725",
    title: "Math Academy WebView on the physical device with the S Pen and a real lesson",
    state: "Backlog",
    who: "",
  },
  {
    id: "KAL-861",
    title:
      "Beta scorecard readout: week-three return, parent action per household, W4 retention, deposits; what has to be logged to compute it",
    state: "Todo",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-942",
    title:
      "Spike: Math Academy as an app on the device, with the new organization, Kale-created students and the login handshake",
    state: "Backlog",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-945",
    title:
      "A stroke that crosses the session time-up is lost after the kid continues with reset minutes",
    state: "Backlog",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-948",
    title: "Rename stage A and B: remaining account renames, email and auth providers",
    state: "Backlog",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-949",
    title: "Rename stage C and D: Kale env names, Twilio webhook, backups bucket",
    state: "Backlog",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-951",
    title: "Rename stage G: retire Daso resources",
    state: "Backlog",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-972",
    title: "Draw input and latency on the device",
    state: "Todo",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1021",
    title:
      "Scary-story ceiling for 6-8, no escalation on request and nothing placed in the child's real room",
    state: "Backlog",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1022",
    title: "Homework help is hint-first, no worksheet answers or submission-ready rewrites",
    state: "Backlog",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1023",
    title: 'No invented numbers or "wow facts" in answers, say when unsure',
    state: "Backlog",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1030",
    title: "Recover creations from a continuity row past the read ceiling (grown-up repair path)",
    state: "Backlog",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1048",
    title: "ADR 0045 update for Kale-managed Math Academy student accounts",
    state: "Backlog",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1049",
    title: "Cloud signed client and student lifecycle for Math Academy",
    state: "Backlog",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1050",
    title: "Sync Math Academy activity and knowledge into the learning state and digest",
    state: "Backlog",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1062",
    title: "New profiles: child-led avatar setup and direct session start",
    state: "In Progress",
    who: "",
  },
  {
    id: "KAL-1075",
    title: "A grown-up answers a kid's more-time request in the grown-up app",
    state: "Backlog",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1085",
    title: "Color by Numbers QA: fix rendering and erasing, remove completion flow",
    state: "Backlog",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1090",
    title: "Enlarge the resting Ask Anything pill without blocking activity controls",
    state: "Backlog",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1091",
    title: "Keep ordinary Ask available in the avatar editor",
    state: "Backlog",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1094",
    title: "Ask: require grown-up supervision for risky real-world activities",
    state: "Backlog",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1095",
    title: "Ask and onboarding: require parent agreement before outdoor activities",
    state: "Backlog",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1096",
    title: "Draw: make imported stickers easy to move with two fingers",
    state: "Backlog",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1098",
    title: "Ask: move its box predictably to keep essential controls reachable",
    state: "Backlog",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1099",
    title: "Make a sad expression selectable in the avatar creator",
    state: "Backlog",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1105",
    title: "Profiles & Settings: edit profiles directly with each card's pencil",
    state: "Todo",
    who: "",
  },
  {
    id: "KAL-1107",
    title: "Onboarding: keep Done reachable after using Ask",
    state: "Todo",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1108",
    title: "Onboarding: show and speak every repeated name error",
    state: "Todo",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1109",
    title: "Desk to Draw: import drawings at canvas resolution",
    state: "Todo",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1112",
    title: "Ask: show the requested image for explicit picture requests",
    state: "Todo",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1197",
    title:
      "Set up push credentials for the grown-up app: EAS project, APNs key, FCM and Expo access token",
    state: "In Progress",
    who: "Karel Vuong",
  },
  {
    id: "KAL-1204",
    title: "Revisit replay retention offset once Convex confirms deleted-data retention",
    state: "Todo",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1535",
    title: 'Location permission is re-requested after "Don\'t allow" during Wi-Fi setup',
    state: "Backlog",
    who: "",
  },
  {
    id: "KAL-1538",
    title:
      "Ask dock exposes ~10 overlapping controls at one point; hide inactive ones from the accessibility tree",
    state: "Backlog",
    who: "",
  },
  {
    id: "KAL-1539",
    title:
      "Add testIDs to primary navigation and onboarding actions so flows do not depend on copy or locale",
    state: "Backlog",
    who: "",
  },
  {
    id: "KAL-1588",
    title: "SMS revoke confirm goes once in-app withdrawal is live",
    state: "Todo",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1613",
    title: "Drop the magicLooksAllowed compatibility shims once all tablets are updated",
    state: "Todo",
    who: "Karel Vuong",
  },
  {
    id: "KAL-1618",
    title: "The secret guard checks bash -lc commands too and refuses when it crashes",
    state: "Todo",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1635",
    title: "Grown-up app has a Session replay switch",
    state: "Todo",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1642",
    title: "Play Console: grown-up app listing basics, data safety form and internal test track",
    state: "Todo",
    who: "Karel Vuong",
  },
  {
    id: "KAL-1673",
    title: "Remove the last Worlds leftovers from the tablet app",
    state: "Todo",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1678",
    title:
      "Confirm Kale SMS reaches Canadian parent numbers; route Canada to Twilio if Surge drops them",
    state: "Todo",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1738",
    title: "Team decision: what the Explore grid does when a kid has eight unfinished cards",
    state: "Todo",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1740",
    title: "Sonnet 5.5 Ask replies keep to the two-sentence limit",
    state: "Todo",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1749",
    title:
      "Designs for the Your data form and the hidden consent and deletion screens (app and tablet)",
    state: "Todo",
    who: "Gabe",
  },
  {
    id: "KAL-1750",
    title:
      "Legal check for consent withdrawal and account deletion: retention, wording, website form",
    state: "Todo",
    who: "Karel Vuong",
  },
  {
    id: "KAL-1769",
    title:
      "Make it from the card: color it, color by number, mosaic, step by step, finish the picture, draw it",
    state: "Backlog",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1790",
    title:
      "Beta tester's Kale computer sets itself up through the normal family setup with his own phone, with no help from the team",
    state: "In Progress",
    who: "Karel Vuong",
  },
  {
    id: "KAL-1795",
    title: "Sounds for activities: licence check for anything Scott buys",
    state: "Todo",
    who: "Karel Vuong",
  },
  {
    id: "KAL-1800",
    title: "Sounds for guess the sound and make the sound (about 100, list inside)",
    state: "Todo",
    who: "Scott Forsey",
  },
  {
    id: "KAL-1805",
    title: "Decide whether Surge becomes the only SMS vendor or Twilio stays as backup",
    state: "Backlog",
    who: "Karel Vuong",
  },
  {
    id: "KAL-1809",
    title:
      "Ask-in-chat reports: an AI chat in the admin app that builds ad-hoc reports from the reporting queries",
    state: "Backlog",
    who: "Karel Vuong",
  },
  {
    id: "KAL-1810",
    title:
      "familyMemory consent sentence: approve the rewording now that the tablet downloads suggested topics",
    state: "Todo",
    who: "Karel Vuong",
  },
  {
    id: "KAL-1834",
    title: "Offline search screen: how a kid finds a card without wifi (needs Gabe's design)",
    state: "Todo",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1842",
    title:
      "Activity retention: 12-month rolling sweep with family-less aggregation before roll-off (DPIA Q15/Q16)",
    state: "Backlog",
    who: "",
  },
  {
    id: "KAL-1850",
    title:
      "Account deletion keeps only the consent proof and a hardware-id device row, aggregates activity first (DPIA Q18)",
    state: "Backlog",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1851",
    title: "Independent privacy review of the replay Ask scrubber for ADR 0059 gate G4",
    state: "Todo",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1852",
    title: "Max signs replay DPIA input revision 2",
    state: "Todo",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1856",
    title: "Play Integrity on staging (after the beta)",
    state: "Todo",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1861",
    title: "iPad on a real device: signing, TestFlight and physical qualification",
    state: "Todo",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1871",
    title: "This or that in made-on-the-fly packs: make it reliable and bring it back",
    state: "Backlog",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1873",
    title: "Upgrade Reanimated to 4.5.3 on the computer (after the beta)",
    state: "Todo",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1883",
    title:
      "After beta: team decision on the moral questions of Ask safety (alerts, disclosures, help for the kid)",
    state: "Backlog",
    who: "",
  },
  {
    id: "KAL-1892",
    title: "★ Web signup that creates a family with consent (no app install, works on iPhone)",
    state: "Backlog",
    who: "Karel Vuong",
  },
  {
    id: "KAL-1893",
    title: "Lend a booth computer to a guest family and take it back (owner-pin exception)",
    state: "Backlog",
    who: "Karel Vuong",
  },
  {
    id: "KAL-1894",
    title: '★ Computer: automatic default kid profile with an "onboarding or demo" choice',
    state: "Backlog",
    who: "Karel Vuong",
  },
  {
    id: "KAL-1895",
    title: "Turn on kid activity for a guest family at signup",
    state: "Backlog",
    who: "Karel Vuong",
  },
  {
    id: "KAL-1896",
    title: "Faster sync of a kid's work while the session runs",
    state: "Backlog",
    who: "Karel Vuong",
  },
  {
    id: "KAL-1897",
    title: '★ Staff "return to booth" action (admin + computer)',
    state: "Backlog",
    who: "Karel Vuong",
  },
  {
    id: "KAL-1898",
    title: "★ Consent page: main points in large type at the top, full text below",
    state: "Backlog",
    who: "Karel Vuong",
  },
  {
    id: "KAL-1899",
    title: "★ Web view of a kid's artifacts and progress for parents without the app",
    state: "Backlog",
    who: "Karel Vuong",
  },
  {
    id: "KAL-1908",
    title:
      "Infisical is the one place env values are typed; syncs fill Vercel, GitHub, Devin and Cloudflare",
    state: "Backlog",
    who: "Karel Vuong",
  },
  {
    id: "KAL-1973",
    title: "Improve speech recognition for young children",
    state: "Backlog",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1975",
    title: "Stop interrupted Explore and Make introductions repeating on tab switches",
    state: "Backlog",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1978",
    title: "Proposal: CloudTrail trail for the prod AWS account (Bedrock audit, metadata only)",
    state: "Backlog",
    who: "Tim Pietrusky",
  },
  {
    id: "KAL-1985",
    title: "Activity screen: a refused block drops only its own games, not the whole pack",
    state: "Triage",
    who: "",
  },
  {
    id: "KAL-1993",
    title:
      "Anonymous activity counts for founding families (Explore, Make tools, Photo hunt), after NewKid",
    state: "Backlog",
    who: "Karel Vuong",
  },
  {
    id: "KAL-1997",
    title:
      "Activity screen: a game refused alone still ships when its pack passes together (37 live packs, 45 games)",
    state: "Triage",
    who: "",
  },
  {
    id: "KAL-2001",
    title: "Replays show drawings as drawn, without the on-device writing check",
    state: "Backlog",
    who: "Karel Vuong",
  },
  {
    id: "KAL-2011",
    title: "Shared notifications package owns every email, SMS and push template",
    state: "Backlog",
    who: "Karel Vuong",
  },
  {
    id: "KAL-2013",
    title: "How big: slider can't reach small answers when a comparison is much bigger",
    state: "Todo",
    who: "",
  },
  {
    id: "KAL-2020",
    title: "Booth parent-copy email footer: switch mailing address to the Stable address",
    state: "In Progress",
    who: "Karel Vuong",
  },
  {
    id: "KAL-2037",
    title: "Explore age filter: provider-level test that a 9+ kid still sees a listed card",
    state: "Triage",
    who: "",
  },
  {
    id: "KAL-2039",
    title: "Parent-visible tablet name to tell same-model tablets apart in caregiver alerts",
    state: "Triage",
    who: "",
  },
  {
    id: "KAL-2040",
    title: "Caregiver texts: newest kid-name row everywhere + no single-letter names",
    state: "Triage",
    who: "",
  },
  {
    id: "KAL-2043",
    title: "Withdrawn cards reach devices within minutes, not 6 h",
    state: "Triage",
    who: "",
  },
  {
    id: "KAL-2108",
    title: 'Accepted founding families get one "you\'re in" message, sent as a batch from Admin',
    state: "Backlog",
    who: "Karel Vuong",
  },
  { id: "KAL-2142", title: "Upgrade @anthropic-ai/sdk to 1.x in cloud", state: "Triage", who: "" },
  { id: "KAL-2143", title: "Upgrade sharp to 0.35 in cloud", state: "Triage", who: "" },
  { id: "KAL-2144", title: "Upgrade convex-test to 0.0.64 in cloud", state: "Triage", who: "" },
  {
    id: "KAL-2145",
    title: "Upgrade @workos-inc/authkit-nextjs to 4.5.0 in website",
    state: "Triage",
    who: "",
  },
  {
    id: "KAL-2146",
    title: "Upgrade the computer to Expo 58 / React Native 0.88",
    state: "Triage",
    who: "",
  },
  {
    id: "KAL-2147",
    title: "Upgrade the grown-up app to Expo 58 / React Native 0.88",
    state: "Triage",
    who: "",
  },
  {
    id: "KAL-2159",
    title: "Ask-back reply can be silent on a cold maple (after beta)",
    state: "Triage",
    who: "",
  },
  {
    id: "KAL-2165",
    title: "tts-drama3 qa: negation keys by stem, curated in-/im-/il-/ir- list",
    state: "Triage",
    who: "",
  },
  {
    id: "KAL-2197",
    title: "Grown-up dev app that prompts to update itself",
    state: "Triage",
    who: "",
  },
  {
    id: "KAL-2198",
    title: "Maple speaks a bit faster: speed up her reference clip",
    state: "Triage",
    who: "",
  },
];
