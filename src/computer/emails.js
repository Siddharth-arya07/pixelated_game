/**
 * The inbox. Plain data so it's easy to add more.
 * `attachment` opens that video in the Videos app.
 */
export const EMAILS = [
  {
    id: 'mom',
    from: 'Mom',
    subject: 'are you sleeping??',
    date: 'Tue 2:47 AM',
    body: `Saw your light on again. It's almost 3. Eat something that isn't from the Quik Mart.

Your father's old rod is still by the front door. He'd like it if you took it out to Mirror Lake sometime.

Love you.
Mom

P.S. the truck needs gas. don't take it up the mountain road, it barely made it last time.`,
  },
  {
    id: 'ray',
    from: 'Ray (lighthouse)',
    subject: 'fog is thick tonight',
    date: 'Tue 1:15 AM',
    body: `If you're up, come by the lighthouse. Radio's playing, kettle's on, door's unlocked. Grab the good chair.

Take the coast road past the harbor, then the gravel up the cliff. DON'T walk along the cliff edge in this fog.

Foghorn goes off every half minute or so. You get used to it.

- Ray`,
  },
  {
    id: 'unknown',
    from: 'unknown sender',
    subject: 'tape',
    date: 'Mon 3:33 AM',
    body: `found this in the lantern room. it was in the recorder.

don't watch it alone.`,
    attachment: 'lost',
  },
  {
    id: 'dee',
    from: 'Dee',
    subject: 'remember summer 96?!',
    date: 'Mon 11:02 PM',
    body: `I finally got my dad's camcorder tapes digitized!! Attached the beach one. Look how young we were.

Miss those summers. Call me sometime when you're not nocturnal.

- D`,
    attachment: 'vacation',
  },
  {
    id: 'anglers',
    from: 'Mirror Lake Anglers',
    subject: 'Night bite report',
    date: 'Mon 9:30 PM',
    body: `NIGHT BITE REPORT
- Perch + trout near the dock, short casts.
- Bass and catfish: cast longer.
- Pike in the deep water. Max power cast.
- Bait (nightcrawlers) makes them bite faster. Quik Mart has it, aisle 3.

Tight lines!`,
  },
  {
    id: 'harbor',
    from: 'Harbor Master',
    subject: 're: jet ski',
    date: 'Mon 6:12 PM',
    body: `Keys are in the jet ski and the trawler like you asked. Bring them back to the pier when you're done, you can only climb out at the dock.

Swell's up tonight. The ski catches air off the big ones. Don't be stupid.`,
  },
  {
    id: 'dot',
    from: 'ROUTE 9 DOT',
    subject: 'ADVISORY: Summit Road',
    date: 'Mon 4:00 PM',
    body: `ADVISORY - SUMMIT ROAD (to Quik Mart #44)
- Pavement ends above the second hairpin. Loose gravel.
- Grades up to 20%. Heavy vehicles: keep momentum, low gear.
- Guardrails missing on upper curves.
- Dense fog expected nightly.`,
  },
  {
    id: 'spam',
    from: 'HOT SINGLES',
    subject: 'Hot singles in your area!!!',
    date: 'Sun 3:01 AM',
    body: `1 single found within 5 miles of you:

  - The Quik Mart clerk (awake)

Click here to say hi! (don't)`,
  },
  {
    id: 'quikmart',
    from: 'Quik Mart Rewards',
    subject: 'You have 0 points!',
    date: 'Sun 12:00 AM',
    body: `Thanks for being a Quik Mart Rewards member!

Current balance: 0 points.
Spend $5 or more on the summit to earn 1 point.

We're open 24 hours. We are always open.`,
  },
];
