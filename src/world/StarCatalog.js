/**
 * StarCatalog
 * -----------
 * The real sky: ~150 of the brightest stars (J2000 positions), constellation
 * stick figures, and low-precision ephemerides for the Sun, Moon and the
 * five naked-eye planets (JPL "approximate positions of the planets"
 * Keplerian elements, valid 1800–2050; Moon after the Astronomical Almanac's
 * low-precision series). Good to well under a degree, plenty for a PS1 sky.
 *
 * Star: [name, raHours, decDeg, mag, distanceLy, spectral, constellation, note?]
 */
export const STARS = [
  ['Sirius', 6.752, -16.716, -1.46, 8.6, 'A1V', 'Canis Major', 'The brightest star in the night sky. Its white dwarf companion, Sirius B, was the first ever found.'],
  ['Canopus', 6.399, -52.696, -0.74, 310, 'A9II', 'Carina', 'Second brightest star; spacecraft use it to orient themselves.'],
  ['Rigil Kentaurus', 14.66, -60.835, -0.27, 4.37, 'G2V', 'Centaurus', 'Alpha Centauri: the nearest star system to the Sun.'],
  ['Arcturus', 14.261, 19.182, -0.05, 36.7, 'K1.5III', 'Boötes', 'An orange giant racing through the galaxy’s disc; follow the arc of the Big Dipper’s handle to find it.'],
  ['Vega', 18.616, 38.784, 0.03, 25, 'A0V', 'Lyra', 'Once the north star (12,000 BC) and will be again around AD 13,700.'],
  ['Capella', 5.278, 45.998, 0.08, 42.9, 'G8III', 'Auriga', 'Actually four stars: two yellow giants orbiting each other, plus a pair of red dwarfs.'],
  ['Rigel', 5.242, -8.202, 0.13, 860, 'B8Ia', 'Orion', 'A blue supergiant about 120,000 times as luminous as the Sun.'],
  ['Procyon', 7.655, 5.225, 0.34, 11.5, 'F5IV', 'Canis Minor', '“Before the dog”: it rises just before Sirius.'],
  ['Achernar', 1.629, -57.237, 0.46, 139, 'B6V', 'Eridanus', 'Spins so fast it is squashed into an egg shape.'],
  ['Betelgeuse', 5.919, 7.407, 0.5, 548, 'M1Ia', 'Orion', 'A red supergiant near the end of its life. It will go supernova — sometime in the next 100,000 years.'],
  ['Hadar', 14.064, -60.373, 0.61, 390, 'B1III', 'Centaurus'],
  ['Altair', 19.846, 8.868, 0.76, 16.7, 'A7V', 'Aquila', 'Spins once every 9 hours. One corner of the Summer Triangle.'],
  ['Acrux', 12.443, -63.099, 0.76, 320, 'B0.5IV', 'Crux', 'The foot of the Southern Cross.'],
  ['Aldebaran', 4.599, 16.509, 0.86, 65, 'K5III', 'Taurus', 'The bull’s red eye. Pioneer 10 is drifting its way; it arrives in about two million years.'],
  ['Antares', 16.49, -26.432, 0.96, 550, 'M1.5Iab', 'Scorpius', '“Rival of Mars” — red enough to be mistaken for it. If it sat where the Sun is, it would swallow Mars’s orbit.'],
  ['Spica', 13.42, -11.161, 0.97, 250, 'B1V', 'Virgo', 'Two hot blue stars so close they are pulled into egg shapes.'],
  ['Pollux', 7.755, 28.026, 1.14, 34, 'K0III', 'Gemini', 'Has a planet, Thestias, about twice Jupiter’s mass.'],
  ['Fomalhaut', 22.961, -29.622, 1.16, 25, 'A3V', 'Piscis Austrinus', 'The “lonely star of autumn”, ringed by a dusty debris disc.'],
  ['Deneb', 20.69, 45.28, 1.25, 2600, 'A2Ia', 'Cygnus', 'One of the most luminous stars you can see; the light you see left it around the fall of Rome.'],
  ['Mimosa', 12.795, -59.689, 1.25, 280, 'B0.5III', 'Crux'],
  ['Regulus', 10.139, 11.967, 1.35, 79, 'B8IV', 'Leo', 'The heart of the lion, spinning near its breaking point.'],
  ['Adhara', 6.977, -28.972, 1.5, 430, 'B2II', 'Canis Major'],
  ['Castor', 7.577, 31.888, 1.58, 51, 'A1V', 'Gemini', 'Six stars pretending to be one.'],
  ['Shaula', 17.56, -37.104, 1.62, 570, 'B2IV', 'Scorpius', 'The scorpion’s stinger.'],
  ['Gacrux', 12.519, -57.113, 1.64, 89, 'M3.5III', 'Crux'],
  ['Bellatrix', 5.419, 6.35, 1.64, 250, 'B2III', 'Orion', 'The “female warrior”: Orion’s left shoulder.'],
  ['Elnath', 5.438, 28.608, 1.65, 134, 'B7III', 'Taurus', 'Tip of the bull’s northern horn.'],
  ['Miaplacidus', 9.22, -69.717, 1.67, 113, 'A1III', 'Carina'],
  ['Alnilam', 5.604, -1.202, 1.69, 2000, 'B0Ia', 'Orion', 'The middle star of Orion’s Belt.'],
  ['Alnair', 22.137, -46.961, 1.74, 101, 'B6V', 'Grus'],
  ['Alnitak', 5.679, -1.943, 1.77, 1260, 'O9.5Ib', 'Orion', 'The eastern belt star; the Horsehead Nebula sits just below it.'],
  ['Alioth', 12.9, 55.96, 1.77, 83, 'A1III', 'Ursa Major', 'Brightest star of the Big Dipper.'],
  ['Mirfak', 3.405, 49.861, 1.79, 510, 'F5Ib', 'Perseus'],
  ['Dubhe', 11.062, 61.751, 1.79, 123, 'K0III', 'Ursa Major', 'One of the two “pointer” stars: follow Merak → Dubhe to Polaris.'],
  ['Wezen', 7.14, -26.393, 1.84, 1600, 'F8Ia', 'Canis Major'],
  ['Kaus Australis', 18.403, -34.385, 1.85, 143, 'B9.5III', 'Sagittarius', 'Bottom of the Teapot.'],
  ['Alkaid', 13.792, 49.313, 1.86, 104, 'B3V', 'Ursa Major', 'End of the Big Dipper’s handle.'],
  ['Sargas', 17.622, -42.998, 1.87, 300, 'F1II', 'Scorpius'],
  ['Avior', 8.375, -59.51, 1.86, 630, 'K3III', 'Carina'],
  ['Menkalinan', 5.992, 44.947, 1.9, 81, 'A1IV', 'Auriga'],
  ['Atria', 16.811, -69.028, 1.91, 391, 'K2II', 'Triangulum Australe'],
  ['Alhena', 6.629, 16.399, 1.92, 109, 'A1IV', 'Gemini'],
  ['Peacock', 20.427, -56.735, 1.94, 179, 'B2IV', 'Pavo'],
  ['Polaris', 2.53, 89.264, 1.98, 433, 'F7Ib', 'Ursa Minor', 'The North Star. It barely moves all night while everything else wheels around it.'],
  ['Mirzam', 6.378, -17.956, 1.98, 500, 'B1II', 'Canis Major', '“The announcer”: it rises just before Sirius.'],
  ['Alphard', 9.46, -8.659, 1.98, 177, 'K3II', 'Hydra', '“The solitary one” — no bright stars near it.'],
  ['Algieba', 10.333, 19.842, 2.08, 130, 'K0III', 'Leo'],
  ['Hamal', 2.12, 23.462, 2.0, 66, 'K2III', 'Aries'],
  ['Diphda', 0.727, -17.987, 2.02, 96, 'K0III', 'Cetus'],
  ['Nunki', 18.921, -26.297, 2.05, 228, 'B2V', 'Sagittarius'],
  ['Menkent', 14.111, -36.37, 2.06, 59, 'K0III', 'Centaurus'],
  ['Alpheratz', 0.14, 29.09, 2.06, 97, 'B8IV', 'Andromeda', 'Shared corner of Andromeda and the Great Square of Pegasus.'],
  ['Mirach', 1.162, 35.621, 2.05, 197, 'M0III', 'Andromeda', 'Hop two stars up from Mirach to find the Andromeda Galaxy, 2.5 million light-years away.'],
  ['Saiph', 5.796, -9.67, 2.09, 650, 'B0.5Ia', 'Orion'],
  ['Kochab', 14.845, 74.156, 2.08, 131, 'K4III', 'Ursa Minor', 'A guardian of the pole; it was the north star around 1000 BC.'],
  ['Rasalhague', 17.582, 12.56, 2.08, 49, 'A5III', 'Ophiuchus'],
  ['Algol', 3.136, 40.956, 2.12, 90, 'B8V', 'Perseus', 'The “Demon Star”: it dims every 2.87 days when its companion passes in front.'],
  ['Almach', 2.065, 42.33, 2.1, 350, 'K3II', 'Andromeda', 'A gold and blue double in a small telescope.'],
  ['Denebola', 11.818, 14.572, 2.14, 36, 'A3V', 'Leo', 'The lion’s tail.'],
  ['Navi', 0.945, 60.717, 2.15, 550, 'B0IV', 'Cassiopeia', 'Named by astronaut Gus Grissom after his own middle name, spelled backwards.'],
  ['Alphecca', 15.578, 26.715, 2.23, 75, 'A0V', 'Corona Borealis', 'The jewel of the northern crown.'],
  ['Mizar', 13.399, 54.925, 2.23, 83, 'A2V', 'Ursa Major', 'With faint Alcor beside it: an old eyesight test.'],
  ['Sadr', 20.37, 40.257, 2.23, 1800, 'F8Ib', 'Cygnus', 'The centre of the Northern Cross.'],
  ['Schedar', 0.675, 56.537, 2.24, 228, 'K0III', 'Cassiopeia'],
  ['Eltanin', 17.943, 51.489, 2.24, 154, 'K5III', 'Draco', 'The dragon’s eye.'],
  ['Mintaka', 5.533, -0.299, 2.25, 1200, 'O9.5II', 'Orion', 'The western belt star, sitting almost exactly on the celestial equator.'],
  ['Caph', 0.153, 59.15, 2.28, 55, 'F2III', 'Cassiopeia'],
  ['Dschubba', 16.006, -22.622, 2.29, 440, 'B0.3IV', 'Scorpius'],
  ['Larawag', 16.836, -34.293, 2.29, 64, 'K1III', 'Scorpius'],
  ['Merak', 11.031, 56.382, 2.37, 79, 'A1V', 'Ursa Major'],
  ['Izar', 14.75, 27.074, 2.37, 202, 'K0II', 'Boötes', '“Pulcherrima” — the most beautiful: an orange and blue-green double.'],
  ['Kappa Scorpii', 17.708, -39.03, 2.39, 480, 'B1.5III', 'Scorpius'],
  ['Enif', 21.736, 9.875, 2.39, 690, 'K2Ib', 'Pegasus', 'The horse’s nose.'],
  ['Scheat', 23.063, 28.083, 2.42, 196, 'M2.5II', 'Pegasus'],
  ['Sabik', 17.173, -15.725, 2.43, 88, 'A2V', 'Ophiuchus'],
  ['Phecda', 11.897, 53.695, 2.44, 84, 'A0V', 'Ursa Major'],
  ['Aludra', 7.401, -29.303, 2.45, 2000, 'B5Ia', 'Canis Major'],
  ['Alderamin', 21.31, 62.585, 2.45, 49, 'A8V', 'Cepheus', 'Will be the pole star around AD 7500.'],
  ['Markab', 23.079, 15.205, 2.48, 133, 'B9III', 'Pegasus'],
  ['Gienah Cygni', 20.77, 33.97, 2.48, 72, 'K0III', 'Cygnus'],
  ['Menkar', 3.038, 4.09, 2.53, 250, 'M1.5III', 'Cetus'],
  ['Zosma', 11.235, 20.524, 2.56, 58, 'A4V', 'Leo'],
  ['Arneb', 5.546, -17.822, 2.58, 2200, 'F0Ib', 'Lepus'],
  ['Gienah', 12.263, -17.542, 2.59, 154, 'B8III', 'Corvus'],
  ['Ascella', 19.043, -29.88, 2.6, 88, 'A2III', 'Sagittarius'],
  ['Graffias', 16.091, -19.806, 2.62, 400, 'B1V', 'Scorpius'],
  ['Mahasim', 5.995, 37.213, 2.62, 166, 'A0III', 'Auriga'],
  ['Unukalhai', 15.738, 6.426, 2.63, 74, 'K2III', 'Serpens'],
  ['Sheratan', 1.911, 20.808, 2.64, 60, 'A5V', 'Aries'],
  ['Kraz', 12.573, -23.397, 2.65, 140, 'G5II', 'Corvus'],
  ['Muphrid', 13.911, 18.398, 2.68, 37, 'G0IV', 'Boötes'],
  ['Ruchbah', 1.43, 60.235, 2.68, 99, 'A5III', 'Cassiopeia'],
  ['Hassaleh', 4.95, 33.166, 2.69, 490, 'K3II', 'Auriga'],
  ['Lesath', 17.513, -37.296, 2.7, 580, 'B2IV', 'Scorpius'],
  ['Kaus Media', 18.35, -29.828, 2.7, 350, 'K3III', 'Sagittarius'],
  ['Tarazed', 19.771, 10.613, 2.72, 395, 'K3II', 'Aquila'],
  ['Porrima', 12.694, -1.449, 2.74, 38, 'F0V', 'Virgo', 'Two near-identical stars in a 169-year orbit.'],
  ['Rastaban', 17.507, 52.301, 2.79, 380, 'G2Ib', 'Draco'],
  ['Kornephoros', 16.504, 21.49, 2.78, 139, 'G7III', 'Hercules'],
  ['Kaus Borealis', 18.466, -25.422, 2.81, 78, 'K0IV', 'Sagittarius'],
  ['Zeta Herculis', 16.688, 31.603, 2.81, 35, 'F9IV', 'Hercules'],
  ['Vindemiatrix', 13.036, 10.959, 2.83, 110, 'G8III', 'Virgo', '“The grape gatherer” — it rose at dawn at harvest time.'],
  ['Algenib', 0.221, 15.184, 2.83, 390, 'B2IV', 'Pegasus'],
  ['Alcyone', 3.791, 24.105, 2.87, 440, 'B7III', 'Taurus', 'Brightest of the Pleiades, the Seven Sisters — most people can only see six.'],
  ['Tejat', 6.383, 22.514, 2.87, 230, 'M3III', 'Gemini'],
  ['Tau Scorpii', 16.598, -28.216, 2.82, 470, 'B0V', 'Scorpius'],
  ['Pi Scorpii', 15.981, -26.114, 2.89, 590, 'B1V', 'Scorpius'],
  ['Sigma Scorpii', 16.353, -25.593, 2.89, 700, 'B1III', 'Scorpius'],
  ['Epsilon Persei', 3.964, 40.01, 2.89, 640, 'B0.5V', 'Perseus'],
  ['Algorab', 12.498, -16.515, 2.95, 87, 'A0IV', 'Corvus'],
  ['Gamma Persei', 3.08, 53.506, 2.93, 240, 'G8III', 'Perseus'],
  ['Ras Elased', 9.764, 23.774, 2.98, 250, 'G1II', 'Leo'],
  ['Alnasl', 18.097, -30.424, 2.98, 97, 'K1III', 'Sagittarius', 'The spout of the Teapot — the centre of the Milky Way lies just past it.'],
  ['Pherkad', 15.346, 71.834, 3.0, 487, 'A3II', 'Ursa Minor'],
  ['Zeta Tauri', 5.627, 21.143, 3.0, 440, 'B2IV', 'Taurus', 'The Crab Nebula — a supernova seen in AD 1054 — is just beside it.'],
  ['Delta Persei', 3.715, 47.788, 3.0, 520, 'B5III', 'Perseus'],
  ['Mu Scorpii', 16.864, -38.047, 3.0, 500, 'B1.5IV', 'Scorpius'],
  ['Iota Scorpii', 17.793, -40.127, 3.0, 1800, 'F2Ia', 'Scorpius'],
  ['Minkar', 12.169, -22.62, 3.0, 300, 'K2III', 'Corvus'],
  ['Almaaz', 5.032, 43.823, 3.0, 2000, 'A9Ia', 'Auriga', 'Every 27 years a huge dark disc eclipses it for almost two years.'],
  ['Seginus', 14.535, 38.308, 3.03, 85, 'A7III', 'Boötes'],
  ['Mebsuta', 6.732, 25.131, 3.06, 840, 'G8Ib', 'Gemini'],
  ['Albireo', 19.512, 27.96, 3.08, 430, 'K3II', 'Cygnus', 'In a telescope: a golden star and a sapphire one side by side.'],
  ['Phi Sagittarii', 18.761, -26.991, 3.17, 230, 'B8III', 'Sagittarius'],
  ['Pi Herculis', 17.251, 36.809, 3.16, 380, 'K3II', 'Hercules'],
  ['Sulafat', 18.982, 32.69, 3.25, 620, 'B9III', 'Lyra', 'The Ring Nebula sits between Sulafat and Sheliak.'],
  ['Megrez', 12.257, 57.033, 3.31, 58, 'A3V', 'Ursa Major', 'The faintest Big Dipper star.'],
  ['Tau Sagittarii', 19.115, -27.671, 3.32, 120, 'K1III', 'Sagittarius'],
  ['Chertan', 11.237, 15.43, 3.33, 165, 'A2V', 'Leo'],
  ['Eta Scorpii', 17.202, -43.239, 3.33, 72, 'F2V', 'Scorpius'],
  ['Propus', 6.248, 22.507, 3.3, 700, 'M3III', 'Gemini'],
  ['Segin', 1.907, 63.67, 3.37, 410, 'B3III', 'Cassiopeia'],
  ['Meissa', 5.585, 9.934, 3.39, 1100, 'O8III', 'Orion', 'Orion’s head.'],
  ['Adhafera', 10.278, 23.417, 3.44, 260, 'F0III', 'Leo'],
  ['Delta Boötis', 15.258, 33.315, 3.47, 120, 'G8III', 'Boötes'],
  ['Eta Herculis', 16.715, 38.922, 3.48, 110, 'G7III', 'Hercules'],
  ['Eta Leonis', 10.122, 16.763, 3.48, 1300, 'A0Ib', 'Leo'],
  ['Nekkar', 15.032, 40.391, 3.5, 225, 'G8III', 'Boötes'],
  ['Sheliak', 18.835, 33.363, 3.52, 960, 'B7II', 'Lyra', 'An eclipsing binary that brightens and fades every 13 days.'],
  ['Wasat', 7.335, 21.982, 3.53, 60, 'F0IV', 'Gemini', 'Pluto was discovered just next to it in 1930.'],
  ['Ain', 4.477, 19.18, 3.53, 145, 'K0III', 'Taurus'],
  ['Thuban', 14.073, 64.376, 3.65, 300, 'A0III', 'Draco', 'The pole star when the pyramids were built.'],
  ['Hyadum I', 4.33, 15.628, 3.65, 154, 'G9III', 'Taurus', 'Part of the Hyades, the nearest open star cluster.'],
  ['Alshain', 19.922, 6.407, 3.71, 45, 'G8IV', 'Aquila'],
  ['Secunda Hyadum', 4.382, 17.543, 3.76, 153, 'G8III', 'Taurus'],
  ['Mu Leonis', 9.879, 26.007, 3.88, 124, 'K2III', 'Leo'],
  ['Delta Cygni', 19.75, 45.131, 2.87, 165, 'B9.5III', 'Cygnus'],
  ['Epsilon Herculis', 17.005, 30.926, 3.92, 155, 'A0V', 'Hercules'],
  ['Epsilon Ursae Minoris', 16.766, 82.037, 4.2, 350, 'G5III', 'Ursa Minor'],
  ['Zeta Lyrae', 18.746, 37.605, 4.3, 150, 'A4m', 'Lyra'],
  ['Delta Lyrae', 18.908, 36.899, 4.3, 900, 'M4II', 'Lyra'],
  ['Zeta Ursae Minoris', 15.734, 77.795, 4.3, 370, 'A3V', 'Ursa Minor'],
  ['Yildun', 17.537, 86.586, 4.35, 172, 'A1V', 'Ursa Minor'],
  ['Eta Ursae Minoris', 16.292, 75.755, 4.95, 97, 'F5V', 'Ursa Minor'],
];

/** Constellation stick figures (pairs of star names). */
export const LINES = [
  // Orion
  ['Betelgeuse', 'Meissa'], ['Meissa', 'Bellatrix'], ['Betelgeuse', 'Alnitak'], ['Bellatrix', 'Mintaka'],
  ['Mintaka', 'Alnilam'], ['Alnilam', 'Alnitak'], ['Alnitak', 'Saiph'], ['Mintaka', 'Rigel'],
  // Ursa Major (Big Dipper)
  ['Dubhe', 'Merak'], ['Merak', 'Phecda'], ['Phecda', 'Megrez'], ['Megrez', 'Dubhe'],
  ['Megrez', 'Alioth'], ['Alioth', 'Mizar'], ['Mizar', 'Alkaid'],
  // Ursa Minor (Little Dipper)
  ['Polaris', 'Yildun'], ['Yildun', 'Epsilon Ursae Minoris'], ['Epsilon Ursae Minoris', 'Zeta Ursae Minoris'],
  ['Zeta Ursae Minoris', 'Kochab'], ['Kochab', 'Pherkad'], ['Pherkad', 'Eta Ursae Minoris'], ['Eta Ursae Minoris', 'Zeta Ursae Minoris'],
  // Cassiopeia
  ['Caph', 'Schedar'], ['Schedar', 'Navi'], ['Navi', 'Ruchbah'], ['Ruchbah', 'Segin'],
  // Cygnus
  ['Deneb', 'Sadr'], ['Sadr', 'Albireo'], ['Gienah Cygni', 'Sadr'], ['Sadr', 'Delta Cygni'],
  // Lyra
  ['Vega', 'Zeta Lyrae'], ['Zeta Lyrae', 'Sheliak'], ['Sheliak', 'Sulafat'], ['Sulafat', 'Delta Lyrae'], ['Delta Lyrae', 'Zeta Lyrae'],
  // Aquila
  ['Tarazed', 'Altair'], ['Altair', 'Alshain'],
  // Scorpius
  ['Graffias', 'Dschubba'], ['Dschubba', 'Pi Scorpii'], ['Dschubba', 'Sigma Scorpii'], ['Sigma Scorpii', 'Antares'],
  ['Antares', 'Tau Scorpii'], ['Tau Scorpii', 'Larawag'], ['Larawag', 'Mu Scorpii'], ['Mu Scorpii', 'Eta Scorpii'],
  ['Eta Scorpii', 'Sargas'], ['Sargas', 'Iota Scorpii'], ['Iota Scorpii', 'Kappa Scorpii'], ['Kappa Scorpii', 'Shaula'], ['Shaula', 'Lesath'],
  // Sagittarius (the Teapot)
  ['Kaus Australis', 'Kaus Media'], ['Kaus Media', 'Kaus Borealis'], ['Kaus Borealis', 'Phi Sagittarii'], ['Phi Sagittarii', 'Nunki'],
  ['Nunki', 'Tau Sagittarii'], ['Tau Sagittarii', 'Ascella'], ['Ascella', 'Kaus Australis'], ['Alnasl', 'Kaus Media'],
  ['Alnasl', 'Kaus Australis'], ['Phi Sagittarii', 'Ascella'],
  // Leo
  ['Regulus', 'Eta Leonis'], ['Eta Leonis', 'Algieba'], ['Algieba', 'Adhafera'], ['Adhafera', 'Ras Elased'], ['Ras Elased', 'Mu Leonis'],
  ['Algieba', 'Zosma'], ['Zosma', 'Denebola'], ['Denebola', 'Chertan'], ['Chertan', 'Regulus'], ['Zosma', 'Chertan'],
  // Gemini
  ['Castor', 'Mebsuta'], ['Mebsuta', 'Tejat'], ['Tejat', 'Propus'], ['Pollux', 'Wasat'], ['Wasat', 'Alhena'], ['Castor', 'Pollux'],
  // Taurus
  ['Aldebaran', 'Hyadum I'], ['Hyadum I', 'Secunda Hyadum'], ['Secunda Hyadum', 'Ain'], ['Ain', 'Elnath'], ['Aldebaran', 'Zeta Tauri'],
  // Boötes
  ['Arcturus', 'Izar'], ['Izar', 'Delta Boötis'], ['Delta Boötis', 'Nekkar'], ['Nekkar', 'Seginus'], ['Seginus', 'Arcturus'], ['Arcturus', 'Muphrid'],
  // Pegasus + Andromeda
  ['Alpheratz', 'Scheat'], ['Scheat', 'Markab'], ['Markab', 'Algenib'], ['Algenib', 'Alpheratz'], ['Markab', 'Enif'],
  ['Alpheratz', 'Mirach'], ['Mirach', 'Almach'],
  // Canis Major
  ['Sirius', 'Mirzam'], ['Sirius', 'Wezen'], ['Wezen', 'Adhara'], ['Wezen', 'Aludra'],
  // Perseus
  ['Mirfak', 'Gamma Persei'], ['Mirfak', 'Delta Persei'], ['Delta Persei', 'Epsilon Persei'], ['Mirfak', 'Algol'],
  // Auriga
  ['Capella', 'Menkalinan'], ['Menkalinan', 'Mahasim'], ['Mahasim', 'Elnath'], ['Elnath', 'Hassaleh'], ['Hassaleh', 'Almaaz'], ['Almaaz', 'Capella'],
  // Corvus
  ['Gienah', 'Algorab'], ['Algorab', 'Kraz'], ['Kraz', 'Minkar'], ['Minkar', 'Gienah'],
  // Hercules (the Keystone)
  ['Zeta Herculis', 'Eta Herculis'], ['Eta Herculis', 'Pi Herculis'], ['Pi Herculis', 'Epsilon Herculis'], ['Epsilon Herculis', 'Zeta Herculis'],
  ['Zeta Herculis', 'Kornephoros'],
  // Crux
  ['Acrux', 'Gacrux'],
  // Draco (part)
  ['Eltanin', 'Rastaban'],
];

const D2R = Math.PI / 180;
const OBLIQ = 23.43928 * D2R;

/** Days since J2000.0 (2000-01-01 12:00 UT) for a JS Date. */
export function daysJ2000(date) {
  return date.getTime() / 86400000 + 2440587.5 - 2451545.0;
}

/** Local sidereal time in hours. */
export function lst(date, lonDeg) {
  const d = daysJ2000(date);
  const gmst = 18.697374558 + 24.06570982441908 * d;
  return (((gmst + lonDeg / 15) % 24) + 24) % 24;
}

/** Equatorial (ra h, dec °) -> horizontal {alt, az} in radians, az from north through east. */
export function toHorizontal(raH, decDeg, lstH, latDeg) {
  const ha = (lstH - raH) * 15 * D2R;
  const dec = decDeg * D2R;
  const lat = latDeg * D2R;
  const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(ha);
  const alt = Math.asin(sinAlt);
  const cosAz = (Math.sin(dec) - sinAlt * Math.sin(lat)) / (Math.cos(alt) * Math.cos(lat));
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz)));
  if (Math.sin(ha) > 0) az = Math.PI * 2 - az;
  return { alt, az };
}

/** Ecliptic (lon, lat rad) -> equatorial {ra h, dec °}. */
function eclToEq(lon, lat) {
  const x = Math.cos(lat) * Math.cos(lon);
  const y = Math.cos(lat) * Math.sin(lon) * Math.cos(OBLIQ) - Math.sin(lat) * Math.sin(OBLIQ);
  const z = Math.cos(lat) * Math.sin(lon) * Math.sin(OBLIQ) + Math.sin(lat) * Math.cos(OBLIQ);
  const ra = (Math.atan2(y, x) / D2R / 15 + 24) % 24;
  return { ra, dec: Math.asin(z) / D2R };
}

// JPL approximate Keplerian elements (J2000 + rates per century):
// a (AU), e, I, L, long. perihelion, long. ascending node (degrees)
const ELEMENTS = {
  Mercury: [[0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593], [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081], -0.4, 'The smallest planet, always hugging the Sun.'],
  Venus: [[0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255], [0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418], -4.2, 'Clouds of sulphuric acid, 465 °C at the surface. It spins backwards.'],
  Earth: [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0], [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0], 0, ''],
  Mars: [[1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891], [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343], 0.6, 'Rust-red from iron oxide dust. Home of Olympus Mons, three times the height of Everest.'],
  Jupiter: [[5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106], -2.4, 'Twice the mass of every other planet combined. In binoculars you can see four of its moons.'],
  Saturn: [[9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], [-0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794], 0.6, 'Its rings are mostly water ice, hundreds of thousands of km wide but only tens of metres thick.'],
};

function helio(name, T) {
  const [e0, r] = ELEMENTS[name];
  const el = e0.map((v, i) => v + r[i] * T);
  const [a, e, I, L, wbar, node] = el;
  const w = wbar - node;
  let M = (((L - wbar) % 360) + 360) % 360;
  if (M > 180) M -= 360;
  const Mr = M * D2R;
  let E = Mr + e * Math.sin(Mr);
  for (let k = 0; k < 6; k++) E -= (E - e * Math.sin(E) - Mr) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(w * D2R);
  const sw = Math.sin(w * D2R);
  const cO = Math.cos(node * D2R);
  const sO = Math.sin(node * D2R);
  const cI = Math.cos(I * D2R);
  const sI = Math.sin(I * D2R);
  return [
    (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
    (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
    sw * sI * xp + cw * sI * yp,
  ];
}

/** Planets: [{name, ra, dec, mag, distAU, note}] */
export function planets(date) {
  const T = daysJ2000(date) / 36525;
  const earth = helio('Earth', T);
  const out = [];
  for (const name of ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']) {
    const p = helio(name, T);
    const g = [p[0] - earth[0], p[1] - earth[1], p[2] - earth[2]];
    const dist = Math.hypot(...g);
    const lon = Math.atan2(g[1], g[0]);
    const lat = Math.asin(g[2] / dist);
    const { ra, dec } = eclToEq(lon, lat);
    out.push({ name, ra, dec, mag: ELEMENTS[name][2], distAU: dist, note: ELEMENTS[name][3] });
  }
  return out;
}

/** Sun ecliptic longitude (rad) — for the Moon's phase. */
function sunLon(d) {
  const L = 280.46 + 0.9856474 * d;
  const g = (357.528 + 0.9856003 * d) * D2R;
  return (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * D2R;
}

/** Moon: {ra, dec, illum 0..1, waxing, distKm} */
export function moon(date) {
  const d = daysJ2000(date);
  const L = (218.316 + 13.176396 * d) * D2R;
  const M = (134.963 + 13.064993 * d) * D2R;
  const F = (93.272 + 13.22935 * d) * D2R;
  const lon = L + 6.289 * D2R * Math.sin(M);
  const lat = 5.128 * D2R * Math.sin(F);
  const distKm = 385001 - 20905 * Math.cos(M);
  const { ra, dec } = eclToEq(lon, lat);
  let elong = (lon - sunLon(d)) % (Math.PI * 2);
  if (elong < 0) elong += Math.PI * 2;
  return { ra, dec, illum: (1 - Math.cos(elong)) / 2, waxing: elong < Math.PI, distKm };
}

/** Rough spectral class → colour + words. */
export function spectral(sp) {
  const c = sp[0];
  const table = {
    O: [[155, 176, 255], 'blue'],
    B: [[170, 191, 255], 'blue-white'],
    A: [[220, 228, 255], 'white'],
    F: [[248, 247, 255], 'yellow-white'],
    G: [[255, 240, 200], 'yellow'],
    K: [[255, 205, 140], 'orange'],
    M: [[255, 170, 110], 'red-orange'],
  };
  const [rgb, word] = table[c] ?? table.A;
  const lum = sp.includes('Ia') || sp.includes('Ib') ? 'supergiant' : sp.includes('III') || sp.includes('II') ? 'giant' : sp.includes('IV') ? 'subgiant' : 'main-sequence star';
  return { rgb, words: `${word} ${lum}` };
}

/** Galactic plane points (for the Milky Way band): galactic l → equatorial. */
export function galacticToEq(lDeg, bDeg) {
  // North galactic pole and the galactic centre's node, J2000.
  const raNGP = 192.85948 * D2R;
  const decNGP = 27.12825 * D2R;
  const lNCP = 122.93192 * D2R;
  const l = lDeg * D2R;
  const b = bDeg * D2R;
  const sinDec = Math.sin(b) * Math.sin(decNGP) + Math.cos(b) * Math.cos(decNGP) * Math.cos(lNCP - l);
  const dec = Math.asin(sinDec);
  const y = Math.cos(b) * Math.sin(lNCP - l);
  const x = Math.sin(b) * Math.cos(decNGP) - Math.cos(b) * Math.sin(decNGP) * Math.cos(lNCP - l);
  const ra = (((raNGP + Math.atan2(y, x)) / D2R / 15) % 24 + 24) % 24;
  return { ra, dec: dec / D2R };
}
