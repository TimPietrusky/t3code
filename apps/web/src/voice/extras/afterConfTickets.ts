// Open tickets in the Linear project "After the conference", read on 2 Nov 2026, for Tim to close or keep.
// rec, about and why are recommendations from reading each ticket and develop on 2 Nov; Tim decides.
export const AFTER_CONF_READ = "2 Nov, 17:21";

export type TicketRec = "close" | "keep" | "ask";

export const AFTER_CONF_TICKETS: readonly {
  readonly id: string;
  readonly title: string;
  readonly state: string;
  readonly who: string;
  readonly rec: TicketRec;
  readonly about: string;
  readonly why: string;
}[] = [
  {
    id: "KAL-63",
    title: "Rotate the dev-updates feed token out of source",
    state: "Backlog",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "The read token for the dev-updates build feed is hardcoded in the computer app's config and in committed install QR codes, so it can't be rotated without a new build. A copy also leaked into a GitHub PR comment.",
    why: "Still hardcoded in apps/computer/app.config.js on develop; the leaked token was never rotated.",
  },
  {
    id: "KAL-100",
    title: "Move gateway-key-protected Convex functions to internal functions behind HTTP actions",
    state: "Backlog",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "Some Cloud functions are public and only protected by a shared secret passed as an argument. Move them to internal functions behind HTTP actions with header auth.",
    why: "Still the secret-as-argument pattern on develop; security hardening, not urgent.",
  },
  {
    id: "KAL-213",
    title: "Device errors show a unique support code that maps to exactly one cause",
    state: "Backlog",
    who: "",
    rec: "keep",
    about:
      "Every error a family sees on the computer gets a short unique code that maps to exactly one cause, so support can tell what went wrong. Started from a Wi-Fi message that was really a cloud 403.",
    why: "Real support gap once families are on their own; KAL-214 was merged into it on 1 Nov.",
  },
  {
    id: "KAL-286",
    title: "Keep the Draw canvas partially visible at all zoom and pan extremes",
    state: "Backlog",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "Kids can zoom or pan the Draw canvas until it disappears and think their drawing is gone. Keep part of the paper on screen at every zoom and pan.",
    why: "Zoom is clamped on develop, pan isn't; draw polish.",
  },
  {
    id: "KAL-438",
    title: "Undo history doesn't survive reopening a drawing",
    state: "Backlog",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "After leaving a drawing and reopening it, Undo and Redo are disabled. Rebuild the undo stack from the saved strokes.",
    why: "Not built; draw polish.",
  },
  {
    id: "KAL-466",
    title: "Remove dead AutoDraw sketch recognizer from daso-ink",
    state: "In Progress",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "Remove the unused AutoDraw sketch recognizer (a 30 MB model pack) and its bridge from the ink module. Nothing calls it since Solve It was replaced.",
    why: "DasoSketchRecognizer.kt is still on develop; small cleanup.",
  },
  {
    id: "KAL-508",
    title: "Ask says 'already saved' when confirming a brand-new memory",
    state: "Todo",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "When a kid asks Kale to remember something new, Ask says 'already saved'. Tell new notes and duplicates apart.",
    why: "Tim kept it on 23 Oct; memory context still can't tell new from duplicate.",
  },
  {
    id: "KAL-552",
    title: "Screen time limits the grown-up sets in the grown-up app, global and per app, opt-in",
    state: "Todo",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "Opt-in screen time limits a grown-up sets in the grown-up app, for the whole computer and per app. No limit by default.",
    why: "Cloud side shipped in Sep (cloud#85); the app screen isn't built and needs a Gabe design.",
  },
  {
    id: "KAL-579",
    title: "Rename Daso to Kale everywhere: zero-downtime migration to kale.computer (umbrella)",
    state: "In Progress",
    who: "Tim Pietrusky",
    rec: "close",
    about:
      "Umbrella for renaming Daso to Kale everywhere without downtime, moving to kale.computer. The remaining stages have their own tickets.",
    why: "Umbrella only; the open work lives in KAL-948, KAL-949 and KAL-951.",
  },
  {
    id: "KAL-610",
    title: "Head: parent in the loop in the grown-up app: do-together ideas, how it went",
    state: "Todo",
    who: "Tim Pietrusky",
    rec: "close",
    about:
      "Head ticket for keeping the parent in the loop: do-together ideas and how they went. Its acceptance still talks about the retired dashboard and session-end texts.",
    why: "Dashboard and SMS are gone (KAL-1386); the work lives in KAL-611, KAL-613 and Try together cards (KAL-1333).",
  },
  {
    id: "KAL-611",
    title:
      "Family memory in the grown-up app: consent switch, city, past do-together ideas, plain disclosure",
    state: "Todo",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "Family memory in the grown-up app: the consent switch, the family's city and past do-together ideas, with a plain explanation. Asking for the city by text is gone.",
    why: "The switch already ships on the app's Privacy screen (KAL-1414); city and past ideas need a rewrite for the app.",
  },
  {
    id: "KAL-613",
    title: "Ask the grown-up in the app how a recommended activity went, store the answer",
    state: "Todo",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "After Kale suggests something to do together, the grown-up can say in the app how it went, and the answer is stored. The SMS path was dropped.",
    why: "Not built; fits the done step on Try together cards (KAL-1333). Rewrite for the app first.",
  },
  {
    id: "KAL-618",
    title: "Ship Kale to the 30 founding families in one batch after NewKid",
    state: "Todo",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "Ship Kale to the 30 founding families in one batch, about two weeks after the conference: devices via Knox, handover, support path and onboarding.",
    why: "This is the beta itself; Tim said 'later' on 2 Nov (item 28).",
  },
  {
    id: "KAL-620",
    title: "Head: Math Academy integrated as a tool in the loop",
    state: "Backlog",
    who: "Tim Pietrusky",
    rec: "ask",
    about:
      "Head ticket for Math Academy as a full tool inside Kale by 21 Nov: Kale-made students, a login handshake and its own app on the Desk.",
    why: "Still doing Math Academy? Karel's Math v1 (KAL-2208) is a separate Kale-made track, and the 21 Nov goal is close.",
  },
  {
    id: "KAL-657",
    title:
      "Recording flow leaves zero-byte recording-*.m4a files in files/Audio after every voice take",
    state: "Todo",
    who: "",
    rec: "keep",
    about:
      "Every voice take leaves an empty recording file behind on the computer because the recorder is prepared twice. No audio is kept, it's a cleanup gap.",
    why: "Main part fixed in computer#746; unused prepared files still pile up.",
  },
  {
    id: "KAL-678",
    title:
      "Unreadable profile row plus persisted done mounts the child shell on device-wide storage without a recovery gate",
    state: "Backlog",
    who: "",
    rec: "keep",
    about:
      "If the stored profile list can't be read, the computer treats it as having no profiles and shows the kid shell on shared storage, so work can land on the wrong kid later.",
    why: "Not fixed on develop; rare, but it can mix kids' data.",
  },
  {
    id: "KAL-714",
    title:
      "Kale-managed Math Academy student accounts and progress sync on the current Beta 10 API",
    state: "Backlog",
    who: "Tim Pietrusky",
    rec: "close",
    about:
      "Kale manages each kid's Math Academy student account and syncs progress. Split into three sub-tickets.",
    why: "Umbrella, split into KAL-1048, KAL-1049 and KAL-1050 on 30 Sep.",
  },
  {
    id: "KAL-725",
    title: "Math Academy WebView on the physical device with the S Pen and a real lesson",
    state: "Backlog",
    who: "",
    rec: "close",
    about:
      "Try the Math Academy WebView on the real tablet with the S Pen and a signed-in test student. The earlier spike only ran on the emulator.",
    why: "Replaced by the KAL-942 spike; the trial code left main on 21 Sep (computer#595).",
  },
  {
    id: "KAL-861",
    title:
      "Beta scorecard readout: week-three return, parent action per household, W4 retention, deposits; what has to be logged to compute it",
    state: "Todo",
    who: "Tim Pietrusky",
    rec: "ask",
    about:
      "Define and log the numbers that show the beta works: week-three return, parent action per household, W4 retention, deposits.",
    why: "Tim paused it on 2 Oct until 'the beta works' is defined; a weekly report already exists in Admin (KAL-1807).",
  },
  {
    id: "KAL-942",
    title:
      "Spike: Math Academy as an app on the device, with the new organization, Kale-created students and the login handshake",
    state: "Backlog",
    who: "Tim Pietrusky",
    rec: "ask",
    about:
      "Spike: Math Academy as its own app on the computer, signed in as a Kale-created student with no login screen, end to end on a real device.",
    why: "Goes with KAL-620; blocked on Math Academy's org setup since 29 Sep.",
  },
  {
    id: "KAL-945",
    title:
      "A stroke that crosses the session time-up is lost after the kid continues with reset minutes",
    state: "Backlog",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "A stroke that crosses the moment time runs out is lost: after the kid continues with extra minutes the canvas is blank and the drawing isn't saved.",
    why: "Not fixed; a kid loses a drawing.",
  },
  {
    id: "KAL-948",
    title: "Rename stage A and B: remaining account renames, email and auth providers",
    state: "Backlog",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "Finish the rename's account steps: display names in Vercel, Cloudflare, Convex and others, mail on kale.computer, and OAuth accepting both console URLs.",
    why: "Mail moved (Sep), the rest isn't confirmed done.",
  },
  {
    id: "KAL-949",
    title: "Rename stage C and D: Kale env names, Twilio webhook, backups bucket",
    state: "Backlog",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "Rename stage C and D: KALE_* twins for every DASO_* env var, the new signature header, Twilio and Surge webhooks on api.kale.computer, and a kale-backups bucket.",
    why: "Not confirmed done; old DASO names still in use.",
  },
  {
    id: "KAL-951",
    title: "Rename stage G: retire Daso resources",
    state: "Backlog",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "Delete the old Daso resources: getdaso.com domains, old env names, OAuth URIs, buckets and the old AWS user. Only after 30 days of zero traffic on api.getdaso.com.",
    why: "Waits for the 30-day zero-traffic gate.",
  },
  {
    id: "KAL-972",
    title: "Draw input and latency on the device",
    state: "Todo",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "Check Draw on the real tablet: S Pen, palm rejection, hover and opening latency on a release build. The emulator can't prove these.",
    why: "Never checked on the device; KAL-763 was merged into it.",
  },
  {
    id: "KAL-1021",
    title:
      "Scary-story ceiling for 6-8, no escalation on request and nothing placed in the child's real room",
    state: "Backlog",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "When a young kid asks for a scarier story, Ask escalates each time and once put the scare in the kid's own room. Add a ceiling for scary content.",
    why: "Tim kept it on 23 Oct; the Ask prompt on develop still has no escalation rule.",
  },
  {
    id: "KAL-1022",
    title: "Homework help is hint-first, no worksheet answers or submission-ready rewrites",
    state: "Backlog",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "Ask gives the homework answer or a hand-in-ready rewrite first. Make it give a hint or first step and wait for the kid to try.",
    why: "Tim kept it on 23 Oct; no homework rule in the Ask prompt on develop.",
  },
  {
    id: "KAL-1023",
    title: 'No invented numbers or "wow facts" in answers, say when unsure',
    state: "Backlog",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "Ask adds a 'wow fact' to answers and once invented a statistic. No made-up numbers; say when unsure.",
    why: "Only a general 'be truthful' line on develop; prompts still invite a fun fact.",
  },
  {
    id: "KAL-1030",
    title: "Recover creations from a continuity row past the read ceiling (grown-up repair path)",
    state: "Backlog",
    who: "Tim Pietrusky",
    rec: "close",
    about:
      "A grown-up repair path for a kid profile whose saved creations grew past Android's 2 MB row limit and became unreadable.",
    why: "Only hits rows that grew too big before computer#753 (Sep); beta computers started after it.",
  },
  {
    id: "KAL-1048",
    title: "ADR 0045 update for Kale-managed Math Academy student accounts",
    state: "Backlog",
    who: "Tim Pietrusky",
    rec: "ask",
    about:
      "Update the Math Academy ADR with the account model: one Kale-managed student per kid, keys only in Kale Cloud, and the under-13 data terms.",
    why: "Goes with KAL-620: is Math Academy still on?",
  },
  {
    id: "KAL-1049",
    title: "Cloud signed client and student lifecycle for Math Academy",
    state: "Backlog",
    who: "Tim Pietrusky",
    rec: "ask",
    about:
      "A Math Academy API client in Cloud that creates, pauses and resumes a student per kid, with consent gates and an audit row.",
    why: "Goes with KAL-620: is Math Academy still on?",
  },
  {
    id: "KAL-1050",
    title: "Sync Math Academy activity and knowledge into the learning state and digest",
    state: "Backlog",
    who: "Tim Pietrusky",
    rec: "ask",
    about:
      "A Cloud job that pulls each student's Math Academy activity into the learning map and the parent digest.",
    why: "Goes with KAL-620: is Math Academy still on?",
  },
  {
    id: "KAL-1062",
    title: "New profiles: child-led avatar setup and direct session start",
    state: "In Progress",
    who: "",
    rec: "keep",
    about:
      "New-profile setup is always child-led with only working avatar choices, then goes straight into the kid's session.",
    why: "Develop still offers the grown-up-led choice; its PRs were on the retired computer repo.",
  },
  {
    id: "KAL-1075",
    title: "A grown-up answers a kid's more-time request in the grown-up app",
    state: "Backlog",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "When a kid runs out of time, they can ask for more and a grown-up answers in the grown-up app.",
    why: "The SMS reply is gone, so the app is the only way; needs a Gabe design first.",
  },
  {
    id: "KAL-1085",
    title: "Color by Numbers QA: fix rendering and erasing, remove completion flow",
    state: "Backlog",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "Fix six findings from Scott's Color by Numbers QA (numbers under translucent tools, erasing, pixelated outlines) and remove the completion step.",
    why: "Make polish; not confirmed fixed.",
  },
  {
    id: "KAL-1090",
    title: "Enlarge the resting Ask Anything pill without blocking activity controls",
    state: "Backlog",
    who: "Tim Pietrusky",
    rec: "keep",
    about: "Make the resting Ask pill bigger and easier to tap without covering other controls.",
    why: "Pill is still 56dp on develop (ticket asks 64dp).",
  },
  {
    id: "KAL-1091",
    title: "Keep ordinary Ask available in the avatar editor",
    state: "Backlog",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "Ask in the avatar editor turns every question into an avatar edit. Let ordinary questions get ordinary answers.",
    why: "Still routes every avatar-editor question to editing (23 Oct check).",
  },
  {
    id: "KAL-1094",
    title: "Ask: require grown-up supervision for risky real-world activities",
    state: "Backlog",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "Ask suggested smelling bread straight out of a hot oven. Risky activities (heat, sharp tools, traffic) need a grown-up present.",
    why: "No heat, tools or traffic rule in the Ask prompt on develop.",
  },
  {
    id: "KAL-1095",
    title: "Ask and onboarding: require parent agreement before outdoor activities",
    state: "Backlog",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "Ask and onboarding suggest going outside without asking a parent. Outdoor ideas should say 'ask your grown-up first' and offer an indoor option.",
    why: "No parent-agreement rule in the Ask prompt on develop.",
  },
  {
    id: "KAL-1096",
    title: "Draw: make imported stickers easy to move with two fingers",
    state: "Backlog",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "Kids don't discover that imported stickers in Draw move, resize and rotate with two fingers. Show that when the sticker is added.",
    why: "The gesture works, the hint isn't built; draw polish.",
  },
  {
    id: "KAL-1098",
    title: "Ask: move its box predictably to keep essential controls reachable",
    state: "Backlog",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "Ask's box should move itself out of the way of essential controls and keep the composer visible with the keyboard open.",
    why: "No automatic safe placement on develop.",
  },
  {
    id: "KAL-1099",
    title: "Make a sad expression selectable in the avatar creator",
    state: "Backlog",
    who: "Tim Pietrusky",
    rec: "keep",
    about: "Add a sad expression to the avatar creator; the artwork already exists.",
    why: "Tim kept it on 23 Oct; small.",
  },
  {
    id: "KAL-1105",
    title: "Profiles & Settings: edit profiles directly with each card's pencil",
    state: "Todo",
    who: "",
    rec: "keep",
    about:
      "In Profiles & Settings, each profile card's pencil opens that kid's editor directly, without the extra Edit profiles button.",
    why: "Its PR was on the retired computer repo; develop still has Edit profiles.",
  },
  {
    id: "KAL-1107",
    title: "Onboarding: keep Done reachable after using Ask",
    state: "Todo",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "Using Ask during avatar onboarding can hide the final Done button, so setup can't finish.",
    why: "Tim kept it on 23 Oct; no fix on develop.",
  },
  {
    id: "KAL-1108",
    title: "Onboarding: show and speak every repeated name error",
    state: "Todo",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "A second wrong handwritten name in onboarding gives no feedback. Every failed try should say what's wrong.",
    why: "Tim kept it on 23 Oct; no fix on develop.",
  },
  {
    id: "KAL-1109",
    title: "Desk to Draw: import drawings at canvas resolution",
    state: "Todo",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "Drawings imported from the Desk into Draw come in blurry because they use a 320-pixel thumbnail.",
    why: "Not fixed; draw polish.",
  },
  {
    id: "KAL-1112",
    title: "Ask: show the requested image for explicit picture requests",
    state: "Todo",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "'Show me a dinosaur' only gets a drawing suggestion. Explicit picture requests should show the picture.",
    why: "Tim kept it on 23 Oct; no show-me routing on develop.",
  },
  {
    id: "KAL-1197",
    title:
      "Set up push credentials for the grown-up app: EAS project, APNs key, FCM and Expo access token",
    state: "In Progress",
    who: "Karel Vuong",
    rec: "keep",
    about:
      "Push credentials for the grown-up app: EAS project, Apple push key, Firebase and an Expo token, so urgent alerts reach parents' phones.",
    why: "Android works; the iPhone key is unblocked now that Apple enrolment is done (2 Nov).",
  },
  {
    id: "KAL-1204",
    title: "Revisit replay retention offset once Convex confirms deleted-data retention",
    state: "Todo",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "Set the replay purge day from Convex's written answer on how long deleted data survives. The purge runs at day 15 for now.",
    why: "Still waiting on Convex; replay stays off for families.",
  },
  {
    id: "KAL-1535",
    title: 'Location permission is re-requested after "Don\'t allow" during Wi-Fi setup',
    state: "Backlog",
    who: "",
    rec: "keep",
    about:
      "If a parent taps 'Don't allow' for location during Wi-Fi setup, the dialog comes back, so they see three dialogs. Ask once and move on.",
    why: "Onboarding polish families will hit.",
  },
  {
    id: "KAL-1538",
    title:
      "Ask dock exposes ~10 overlapping controls at one point; hide inactive ones from the accessibility tree",
    state: "Backlog",
    who: "",
    rec: "keep",
    about:
      "The Ask dock exposes about ten overlapping controls at one point to screen readers and test tools. Hide the inactive ones.",
    why: "Accessibility, and it makes agent UI tests ambiguous.",
  },
  {
    id: "KAL-1539",
    title:
      "Add testIDs to primary navigation and onboarding actions so flows do not depend on copy or locale",
    state: "Backlog",
    who: "",
    rec: "keep",
    about:
      "Add stable test IDs to onboarding and main navigation so test flows don't break on a copy change or in German.",
    why: "Welcome, Wi-Fi and Avatar screens still have none on develop.",
  },
  {
    id: "KAL-1588",
    title: "SMS revoke confirm goes once in-app withdrawal is live",
    state: "Todo",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "Once parents can withdraw consent in the app, remove the last two-way SMS paths: the revoke confirm and STOP MEMORY.",
    why: "Both still on develop; they go when in-app withdrawal is live (KAL-1750).",
  },
  {
    id: "KAL-1613",
    title: "Drop the magicLooksAllowed compatibility shims once all tablets are updated",
    state: "Todo",
    who: "Karel Vuong",
    rec: "keep",
    about:
      "Remove the magicLooksAllowed shims in Cloud once every beta computer runs a build without magic looks.",
    why: "Shims still on develop; likely unblocked now the beta computers run v1.0.13x.",
  },
  {
    id: "KAL-1618",
    title: "The secret guard checks bash -lc commands too and refuses when it crashes",
    state: "Todo",
    who: "Tim Pietrusky",
    rec: "ask",
    about:
      "The agents' secret guard doesn't check commands wrapped in bash -lc, and lets a command through when it crashes.",
    why: "The guard lives in agent-tooling, which Tim agreed to archive (item 31). Move it or drop it?",
  },
  {
    id: "KAL-1635",
    title: "Grown-up app has a Session replay switch",
    state: "Todo",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "A Session replay on/off switch in the grown-up app's settings, needed before any real family is offered replay.",
    why: "Needed before replay goes to families; blocked on design.",
  },
  {
    id: "KAL-1642",
    title: "Play Console: grown-up app listing basics, data safety form and internal test track",
    state: "Todo",
    who: "Karel Vuong",
    rec: "keep",
    about:
      "Karel's Play Console steps for the grown-up app: listing basics and the internal test track for beta parents.",
    why: "A draft is on the internal track since 30 Oct; rollout is Karel's call.",
  },
  {
    id: "KAL-1673",
    title: "Remove the last Worlds leftovers from the tablet app",
    state: "Todo",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "Remove the last leftovers of the deleted Worlds feature: 3.6 MB of unused art, a voice word and a telemetry branch.",
    why: "assets/illustrated/worlds and startMovie are still on develop.",
  },
  {
    id: "KAL-1678",
    title:
      "Confirm Kale SMS reaches Canadian parent numbers; route Canada to Twilio if Surge drops them",
    state: "Todo",
    who: "Tim Pietrusky",
    rec: "ask",
    about: "Check that Kale's texts reach Canadian numbers; if not, send Canada through Twilio.",
    why: "Only matters if Canadian families join the beta (KAL-1422).",
  },
  {
    id: "KAL-1738",
    title: "Team decision: what the Explore grid does when a kid has eight unfinished cards",
    state: "Todo",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "Team decision: a kid with eight unfinished cards sees the same eight every day and nothing new. Keep it, reserve slots for fresh cards, or let old ones age out.",
    why: "Matters once families use it for days; not decided.",
  },
  {
    id: "KAL-1740",
    title: "Sonnet 5.5 Ask replies keep to the two-sentence limit",
    state: "Todo",
    who: "Tim Pietrusky",
    rec: "keep",
    about: "Ask replies on Sonnet 5.5 run longer than the two-sentence rule. Tune the prompt.",
    why: "The rule is in the prompt but replies still run long; costs about 2 quality points.",
  },
  {
    id: "KAL-1749",
    title:
      "Designs for the Your data form and the hidden consent and deletion screens (app and tablet)",
    state: "Todo",
    who: "Gabe",
    rec: "keep",
    about:
      "Gabe's designs for the Your data form and the hidden consent withdrawal and deletion screens in the app and on the computer.",
    why: "Those screens stay off until designed.",
  },
  {
    id: "KAL-1750",
    title:
      "Legal check for consent withdrawal and account deletion: retention, wording, website form",
    state: "Todo",
    who: "Karel Vuong",
    rec: "keep",
    about:
      "Karel's legal check for consent withdrawal and account deletion: retention rules, wording and the website form.",
    why: "Wording is still placeholder; gates the deletion switches.",
  },
  {
    id: "KAL-1769",
    title:
      "Make it from the card: color it, color by number, mosaic, step by step, finish the picture, draw it",
    state: "Backlog",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "'Make it' from any card: color it, color by number, mosaic, step by step, finish the picture and draw it, made from the card's own picture.",
    why: "Templates exist behind drawing.cloudTemplates, but most cards have none yet.",
  },
  {
    id: "KAL-1790",
    title:
      "Beta tester's Kale computer sets itself up through the normal family setup with his own phone, with no help from the team",
    state: "In Progress",
    who: "Karel Vuong",
    rec: "keep",
    about:
      "A beta tester sets up his Kale computer through the normal family setup with his own phone, with no help from the team.",
    why: "No sign yet that he has a production family and a paired computer.",
  },
  {
    id: "KAL-1795",
    title: "Sounds for activities: licence check for anything Scott buys",
    state: "Todo",
    who: "Karel Vuong",
    rec: "keep",
    about: "Karel checks the licence of every sound pack Scott buys for the sound activities.",
    why: "Waits on Scott's packs.",
  },
  {
    id: "KAL-1800",
    title: "Sounds for guess the sound and make the sound (about 100, list inside)",
    state: "Todo",
    who: "Scott Forsey",
    rec: "keep",
    about: "Scott makes about 100 sounds for 'guess the sound' and 'make the sound'.",
    why: "No sounds delivered yet.",
  },
  {
    id: "KAL-1805",
    title: "Decide whether Surge becomes the only SMS vendor or Twilio stays as backup",
    state: "Backlog",
    who: "Karel Vuong",
    rec: "keep",
    about: "Decide whether Surge becomes the only SMS vendor or Twilio stays as backup.",
    why: "Direction is Twilio stays as backup; it still needs recording and the docs rewritten.",
  },
  {
    id: "KAL-1809",
    title:
      "Ask-in-chat reports: an AI chat in the admin app that builds ad-hoc reports from the reporting queries",
    state: "Backlog",
    who: "Karel Vuong",
    rec: "close",
    about:
      "An AI chat in Admin that answers staff questions with numbers from the fixed reporting queries.",
    why: "Nice-to-have, nothing in the beta needs it; reopen when reports grow.",
  },
  {
    id: "KAL-1810",
    title:
      "familyMemory consent sentence: approve the rewording now that the tablet downloads suggested topics",
    state: "Todo",
    who: "Karel Vuong",
    rec: "keep",
    about:
      "Karel approves the reworded family memory consent sentence, since the computer now downloads suggested topics from Kale Cloud.",
    why: "The live sentence is no longer exactly true.",
  },
  {
    id: "KAL-1834",
    title: "Offline search screen: how a kid finds a card without wifi (needs Gabe's design)",
    state: "Todo",
    who: "Tim Pietrusky",
    rec: "keep",
    about: "The screen where a kid finds a card without Wi-Fi. The search logic is built.",
    why: "Logic merged (#1114); needs Gabe's design.",
  },
  {
    id: "KAL-1842",
    title:
      "Activity retention: 12-month rolling sweep with family-less aggregation before roll-off (DPIA Q15/Q16)",
    state: "Backlog",
    who: "",
    rec: "keep",
    about:
      "A daily sweep keeps per-kid activity for 12 months and folds it into anonymous totals before deleting it.",
    why: "DPIA decision; due before the first roll-off in Oct 2027.",
  },
  {
    id: "KAL-1850",
    title:
      "Account deletion keeps only the consent proof and a hardware-id device row, aggregates activity first (DPIA Q18)",
    state: "Backlog",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "Account deletion keeps only the consent proof and a bare device row, and folds activity into anonymous totals first.",
    why: "DPIA decision; not started.",
  },
  {
    id: "KAL-1851",
    title: "Independent privacy review of the replay Ask scrubber for ADR 0059 gate G4",
    state: "Todo",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "An independent person reviews the replay Ask scrubber before any real child's replay is kept.",
    why: "Replay stays off for families until it's done.",
  },
  {
    id: "KAL-1852",
    title: "Max signs replay DPIA input revision 2",
    state: "Todo",
    who: "Tim Pietrusky",
    rec: "keep",
    about: "Max signs the replay DPIA input revision 2.",
    why: "Needs Max's signature.",
  },
  {
    id: "KAL-1856",
    title: "Play Integrity on staging (after the beta)",
    state: "Todo",
    who: "Tim Pietrusky",
    rec: "close",
    about: "Decide whether staging gets Play Integrity, or record that it stays off.",
    why: "Record 'stays off'; nothing on staging needs it.",
  },
  {
    id: "KAL-1861",
    title: "iPad on a real device: signing, TestFlight and physical qualification",
    state: "Todo",
    who: "Tim Pietrusky",
    rec: "close",
    about: "iPad on a real device: signing, TestFlight and physical checks.",
    why: "No iPad build any more, Android only (Tim, 2 Nov).",
  },
  {
    id: "KAL-1871",
    title: "This or that in made-on-the-fly packs: make it reliable and bring it back",
    state: "Backlog",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "This-or-that is left out of packs made on the fly because the model invents the sorting. Fix it and bring it back.",
    why: "Activities thread; eval and fix not done.",
  },
  {
    id: "KAL-1873",
    title: "Upgrade Reanimated to 4.5.3 on the computer (after the beta)",
    state: "Todo",
    who: "Tim Pietrusky",
    rec: "close",
    about: "Upgrade Reanimated from 4.5.1 to 4.5.3 to fix a frozen first frame on animations.",
    why: "Superseded by KAL-2146: Expo 58 brings Reanimated 4.7.1.",
  },
  {
    id: "KAL-1883",
    title:
      "After beta: team decision on the moral questions of Ask safety (alerts, disclosures, help for the kid)",
    state: "Backlog",
    who: "",
    rec: "keep",
    about:
      "After the beta, the whole team decides the hard Ask safety questions: when to alert caregivers, how to handle disclosures, how to help the kid.",
    why: "Tim: 'super important'; the first after-conference team topic.",
  },
  {
    id: "KAL-1892",
    title: "★ Web signup that creates a family with consent (no app install, works on iPhone)",
    state: "Backlog",
    who: "Karel Vuong",
    rec: "ask",
    about:
      "Part of Tim's booth sign-up-and-pair idea: a parent signs up and consents on the web, no app needed, works on iPhone.",
    why: "Is the sign-up-and-pair idea still on? One answer covers 81 to 88 (KAL-1892 to KAL-1899).",
  },
  {
    id: "KAL-1893",
    title: "Lend a booth computer to a guest family and take it back (owner-pin exception)",
    state: "Backlog",
    who: "Karel Vuong",
    rec: "ask",
    about:
      "Part of the sign-up-and-pair idea: lend a booth computer to a guest family and take it back, which needs an exception to the owner pin.",
    why: "Same call as 81.",
  },
  {
    id: "KAL-1894",
    title: '★ Computer: automatic default kid profile with an "onboarding or demo" choice',
    state: "Backlog",
    who: "Karel Vuong",
    rec: "ask",
    about:
      "Part of the sign-up-and-pair idea: the computer makes a default kid profile on pairing and offers onboarding or a demo.",
    why: "Same call as 81.",
  },
  {
    id: "KAL-1895",
    title: "Turn on kid activity for a guest family at signup",
    state: "Backlog",
    who: "Karel Vuong",
    rec: "ask",
    about:
      "Part of the sign-up-and-pair idea: turn on kid activity for a guest family at signup so the parent sees the session.",
    why: "Same call as 81.",
  },
  {
    id: "KAL-1896",
    title: "Faster sync of a kid's work while the session runs",
    state: "Backlog",
    who: "Karel Vuong",
    rec: "ask",
    about:
      "Part of the sign-up-and-pair idea: sync a kid's work within seconds instead of every 5 minutes.",
    why: "Same call as 81.",
  },
  {
    id: "KAL-1897",
    title: '★ Staff "return to booth" action (admin + computer)',
    state: "Backlog",
    who: "Karel Vuong",
    rec: "ask",
    about:
      "Part of the sign-up-and-pair idea: one staff action that ends a guest lease, clears the kid's data and returns the computer to the booth family.",
    why: "Same call as 81.",
  },
  {
    id: "KAL-1898",
    title: "★ Consent page: main points in large type at the top, full text below",
    state: "Backlog",
    who: "Karel Vuong",
    rec: "ask",
    about:
      "Part of the sign-up-and-pair idea: the consent page shows the main points in large type at the top and the full text below.",
    why: "Same call as 81.",
  },
  {
    id: "KAL-1899",
    title: "★ Web view of a kid's artifacts and progress for parents without the app",
    state: "Backlog",
    who: "Karel Vuong",
    rec: "ask",
    about:
      "Part of the sign-up-and-pair idea: a web view of a kid's drawings and progress for parents without the app.",
    why: "Same call as 81.",
  },
  {
    id: "KAL-1908",
    title:
      "Infisical is the one place env values are typed; syncs fill Vercel, GitHub, Devin and Cloudflare",
    state: "Backlog",
    who: "Karel Vuong",
    rec: "keep",
    about:
      "Infisical becomes the one place env values are typed, and its syncs fill Vercel, GitHub, Devin and Cloudflare.",
    why: "Syncs not set up; Tim said yes to agents writing staging secrets (item 5).",
  },
  {
    id: "KAL-1973",
    title: "Improve speech recognition for young children",
    state: "Backlog",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "Better speech recognition for young kids who mumble, lisp or mispronounce, starting with names in onboarding.",
    why: "Reported in beta feedback; matters for the name step.",
  },
  {
    id: "KAL-1975",
    title: "Stop interrupted Explore and Make introductions repeating on tab switches",
    state: "Backlog",
    who: "Tim Pietrusky",
    rec: "keep",
    about:
      "Switching between Explore and Make before an intro finishes restarts the intro again and again.",
    why: "Not fixed; onboarding is now in scope for families.",
  },
  {
    id: "KAL-1978",
    title: "Proposal: CloudTrail trail for the prod AWS account (Bedrock audit, metadata only)",
    state: "Backlog",
    who: "Tim Pietrusky",
    rec: "ask",
    about:
      "Proposal: a CloudTrail trail on the prod AWS account so Bedrock calls are audited beyond 90 days, metadata only.",
    why: "Proposal only; needs Tim's yes.",
  },
  {
    id: "KAL-1985",
    title: "Activity screen: a refused block drops only its own games, not the whole pack",
    state: "Triage",
    who: "",
    rec: "keep",
    about:
      "When a block of games is refused together but each passes alone, the whole pack is dropped. Drop only the refused games.",
    why: "Not built; good packs get dropped.",
  },
  {
    id: "KAL-1993",
    title:
      "Anonymous activity counts for founding families (Explore, Make tools, Photo hunt), after NewKid",
    state: "Backlog",
    who: "Karel Vuong",
    rec: "keep",
    about: "Anonymous counts of how kids use Explore, each Make tool and Photo hunt, for the team.",
    why: "Karel; only booth counts exist.",
  },
  {
    id: "KAL-1997",
    title:
      "Activity screen: a game refused alone still ships when its pack passes together (37 live packs, 45 games)",
    state: "Triage",
    who: "",
    rec: "keep",
    about:
      "A game the safety screen refuses on its own still ships when its pack passes together; 45 games in 37 live packs.",
    why: "Research done, fix not built.",
  },
  {
    id: "KAL-2001",
    title: "Replays show drawings as drawn, without the on-device writing check",
    state: "Backlog",
    who: "Karel Vuong",
    rec: "keep",
    about:
      "Replays show drawings as drawn instead of blanking them with the on-device writing check, after a notice change.",
    why: "Not built.",
  },
  {
    id: "KAL-2011",
    title: "Shared notifications package owns every email, SMS and push template",
    state: "Backlog",
    who: "Karel Vuong",
    rec: "keep",
    about:
      "One shared package owns every email, SMS and push template, so Cloud, the website and Studio use the same copy.",
    why: "Copy is still duplicated with a drift test.",
  },
  {
    id: "KAL-2013",
    title: "How big: slider can't reach small answers when a comparison is much bigger",
    state: "Todo",
    who: "",
    rec: "close",
    about:
      "In How big, when a comparison is much bigger than the answer, the slider can't reach small answers.",
    why: "How big is never offered since #2139 (25 Oct); half was fixed in #1869.",
  },
  {
    id: "KAL-2020",
    title: "Booth parent-copy email footer: switch mailing address to the Stable address",
    state: "In Progress",
    who: "Karel Vuong",
    rec: "keep",
    about:
      "Change the mailing address in the email footer from 731 Sansome to the new Stable address.",
    why: "731 Sansome is still in branded.ts; we leave it on 11 Dec.",
  },
  {
    id: "KAL-2037",
    title: "Explore age filter: provider-level test that a 9+ kid still sees a listed card",
    state: "Triage",
    who: "",
    rec: "keep",
    about: "Add a test that a kid aged 9+ still sees cards on the under-9 skip list.",
    why: "Small test-only gap.",
  },
  {
    id: "KAL-2039",
    title: "Parent-visible tablet name to tell same-model tablets apart in caregiver alerts",
    state: "Triage",
    who: "",
    rec: "ask",
    about:
      "A tablet name parents can see, so a caregiver alert says which computer raised it when a family has two of the same model.",
    why: "Only matters for a family with two same-model computers; needs a design.",
  },
  {
    id: "KAL-2040",
    title: "Caregiver texts: newest kid-name row everywhere + no single-letter names",
    state: "Triage",
    who: "",
    rec: "keep",
    about:
      "Caregiver texts and the alert list use the newest kid name everywhere and never show a one-letter name like 'i'.",
    why: "grownupJar.ts still takes the first name row on develop.",
  },
  {
    id: "KAL-2043",
    title: "Withdrawn cards reach devices within minutes, not 6 h",
    state: "Triage",
    who: "",
    rec: "keep",
    about: "A card withdrawn for safety reaches computers within minutes instead of up to 6 hours.",
    why: "Safety gap: up to 6 h of a withdrawn card.",
  },
  {
    id: "KAL-2108",
    title: 'Accepted founding families get one "you\'re in" message, sent as a batch from Admin',
    state: "Backlog",
    who: "Karel Vuong",
    rec: "keep",
    about: "Accepted founding families get one 'you're in' message, sent as a batch from Admin.",
    why: "Accept step shipped (#2453), the message isn't built; goes with the batch (KAL-618).",
  },
  {
    id: "KAL-2142",
    title: "Upgrade @anthropic-ai/sdk to 1.x in cloud",
    state: "Triage",
    who: "",
    rec: "keep",
    about:
      "Upgrade the Anthropic SDK to 1.x in Cloud and pin the two eval clients so temperature 0 keeps working.",
    why: "Still on 0.133.0 on develop.",
  },
  {
    id: "KAL-2143",
    title: "Upgrade sharp to 0.35 in cloud",
    state: "Triage",
    who: "",
    rec: "keep",
    about: "Upgrade sharp to 0.35 in Cloud after checking the picture-check images stay the same.",
    why: "Still on 0.34.5 on develop.",
  },
  {
    id: "KAL-2144",
    title: "Upgrade convex-test to 0.0.64 in cloud",
    state: "Triage",
    who: "",
    rec: "keep",
    about:
      "Upgrade convex-test to 0.0.64 and rewrite the timing assertions in about 80 safety tests.",
    why: "Still on 0.0.55 on develop.",
  },
  {
    id: "KAL-2145",
    title: "Upgrade @workos-inc/authkit-nextjs to 4.5.0 in website",
    state: "Triage",
    who: "",
    rec: "keep",
    about: "Upgrade WorkOS AuthKit to 4.5.0 on the website and check editor sign-in end to end.",
    why: "Still on 4.3.0 on develop.",
  },
  {
    id: "KAL-2146",
    title: "Upgrade the computer to Expo 58 / React Native 0.88",
    state: "Triage",
    who: "",
    rec: "keep",
    about:
      "Upgrade the computer to Expo 58 and React Native 0.88, with several major library migrations and a new native build.",
    why: "Still on Expo 57 on develop; big migration.",
  },
  {
    id: "KAL-2147",
    title: "Upgrade the grown-up app to Expo 58 / React Native 0.88",
    state: "Triage",
    who: "",
    rec: "keep",
    about:
      "Upgrade the grown-up app to Expo 58 and React Native 0.88, which needs a new store build.",
    why: "Still on Expo 57 on develop.",
  },
  {
    id: "KAL-2159",
    title: "Ask-back reply can be silent on a cold maple (after beta)",
    state: "Triage",
    who: "",
    rec: "keep",
    about:
      "After a kid asks for help, the ask-back reply can be silent if Maple is cold, leaving a non-reader with text only.",
    why: "Real gap for kids who can't read yet; wording via Tim and Gabe.",
  },
  {
    id: "KAL-2165",
    title: "tts-drama3 qa: negation keys by stem, curated in-/im-/il-/ir- list",
    state: "Triage",
    who: "",
    rec: "keep",
    about:
      "The voice take check rejects good takes: German inflections count as different negations, and words like 'inside' count as negated.",
    why: "Still the common-word rule in qa.py; false fails cost re-renders before the faster Maple.",
  },
  {
    id: "KAL-2197",
    title: "Grown-up dev app that prompts to update itself",
    state: "Triage",
    who: "",
    rec: "ask",
    about:
      "A team-only dev build of the grown-up app that prompts to update itself when a newer build exists.",
    why: "Asked for on 19 Oct, never started. Still wanted?",
  },
  {
    id: "KAL-2198",
    title: "Maple speaks a bit faster: speed up her reference clip",
    state: "Triage",
    who: "",
    rec: "keep",
    about:
      "Make Maple speak a bit faster by re-making her reference clip, then re-render every cached line (about $125).",
    why: "Tim already accepted one more full re-record for the faster voice (d3, 2 Nov).",
  },
];
