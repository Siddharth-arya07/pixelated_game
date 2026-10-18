/**
 * The book on the coffee table: an original, plain-language introduction to
 * quantum mechanics (written for this game). One entry per page; the reader
 * shows two at a time. A little HTML is allowed (em, b, .eq, .fig).
 */
export const BOOK = {
  title: 'Small Things',
  subtitle: 'A Night Reader’s Guide to Quantum Mechanics',
  author: 'for anyone awake at 3 a.m.',
  pages: [
    // ---- front matter --------------------------------------------------------
    `<div class="bk-title"><div class="bk-t1">SMALL THINGS</div><div class="bk-t2">A Night Reader’s Guide<br>to Quantum Mechanics</div><div class="bk-orn">&#10087;</div><div class="bk-t3">for anyone awake at 3 a.m.</div></div>`,
    `<h3>Contents</h3>
<ol class="bk-toc">
<li>The Trouble with Light</li>
<li>Atoms That Shouldn’t Exist</li>
<li>Matter Is a Wave, Too</li>
<li>The Double Slit</li>
<li>The Wavefunction</li>
<li>Schrödinger’s Equation</li>
<li>Uncertainty</li>
<li>Spin</li>
<li>Measurement, and a Cat</li>
<li>Entanglement</li>
<li>Walking Through Walls</li>
<li>What Is Really Going On?</li>
<li>Everything It Built</li>
</ol>
<p class="bk-note">Use ← → (or A / D, or click a page) to turn. E or Esc closes the book.</p>`,

    // ---- 1 --------------------------------------------------------------------
    `<h2><span>I</span>The Trouble with Light</h2>
<p>By 1900 physics looked nearly finished. Newton handled motion, Maxwell handled light, and the remaining puzzles seemed like loose threads. One of those threads was the colour of hot things.</p>
<p>Heat a poker and it glows dull red, then orange, then white. Classical physics tried to predict how much light of each colour a hot object gives off, and got an absurd answer: infinitely much at short wavelengths. A warm stove should have been blasting out ultraviolet. Physicists called it the <em>ultraviolet catastrophe</em>.</p>
<p>In 1900 Max Planck found a fix he did not believe in. He assumed that energy could only be handed out in fixed lumps, or <em>quanta</em>, whose size depends on frequency:</p>
<div class="eq">E = h f</div>
<p>Here <em>f</em> is the frequency and <em>h</em> is a new, tiny constant, about 6.6 × 10<sup>−34</sup> joule-seconds. High-frequency lumps are expensive, so a hot object can’t afford many of them, and the catastrophe disappears. The formula matched experiment perfectly.</p>`,
    `<p>Planck thought of the lumps as a mathematical trick. In 1905 Albert Einstein took them literally.</p>
<p>Shine light on a metal and electrons can be knocked out of it: the <em>photoelectric effect</em>. The strange part is what controls it. Bright red light, however intense, frees no electrons from many metals. Dim violet light frees them immediately. Brightness changes <em>how many</em> electrons come out; colour decides <em>whether</em> they come out at all.</p>
<p>Einstein’s explanation: light itself travels in packets, later called <b>photons</b>, each carrying energy <span class="eq-inline">hf</span>. One photon hits one electron. If a single red photon doesn’t carry enough energy to pull an electron free, then a billion red photons won’t either, because they don’t team up. A violet photon has enough on its own.</p>
<p>This won Einstein his Nobel Prize, not relativity. It also left physics with a problem it still lives with: light behaves like a wave when it spreads and interferes, and like a stream of particles when it lands.</p>
<div class="fig">wave when it travels · particle when it arrives</div>`,

    // ---- 2 --------------------------------------------------------------------
    `<h2><span>II</span>Atoms That Shouldn’t Exist</h2>
<p>In 1911 Ernest Rutherford fired alpha particles at thin gold foil. Most passed straight through; a few bounced almost straight back. Atoms, he concluded, are mostly empty space, with nearly all their mass packed into a tiny positive <em>nucleus</em> and electrons somewhere around it.</p>
<p>If the atom were a stadium, the nucleus would be a marble on the centre spot.</p>
<p>But this picture was a disaster. An electron circling a nucleus is accelerating, and Maxwell’s theory says accelerating charges radiate light and lose energy. The electron should spiral inward and crash into the nucleus in about a hundred-billionth of a second. Every atom in the universe should have collapsed before you finished reading this sentence.</p>
<p>There was a second clue. Heat a gas of hydrogen and it doesn’t glow with a smooth rainbow. It glows at a few sharp, specific colours, the same ones every time: a <em>spectral fingerprint</em>.</p>`,
    `<p>In 1913 Niels Bohr made a bold rule: electrons can only occupy certain allowed orbits, each with a definite energy. In those orbits they simply don’t radiate. Why not? Bohr didn’t say. He just insisted.</p>
<p>When an electron drops from a higher orbit to a lower one, it emits a single photon whose energy equals the gap:</p>
<div class="eq">h f = E<sub>upper</sub> − E<sub>lower</sub></div>
<p>Only a few gaps exist, so only a few colours come out. Bohr’s rule reproduced hydrogen’s lines to remarkable accuracy.</p>
<p>The model was wrong in its details. Electrons do not run on little circular tracks. But its central idea survived everything that came after: <b>bound systems have discrete energy levels</b>, and light is emitted or absorbed in jumps between them. That is why neon signs are red, why sodium streetlights are orange, and why astronomers can tell what a star is made of from its light alone.</p>`,

    // ---- 3 --------------------------------------------------------------------
    `<h2><span>III</span>Matter Is a Wave, Too</h2>
<p>In 1924 a young French prince, Louis de Broglie, turned the photon idea around. If light, a wave, can act like particles, perhaps particles can act like waves.</p>
<p>He proposed that anything with momentum <em>p</em> has a wavelength:</p>
<div class="eq">λ = h / p</div>
<p>For a thrown baseball the wavelength is around 10<sup>−34</sup> metres, absurdly smaller than an atom, so you will never see a baseball diffract. For an electron, whose mass is tiny, the wavelength comes out comparable to the spacing between atoms in a crystal.</p>
<p>That made a prediction you could test. Fire electrons at a crystal and they should scatter into patterns of bright and dark spots, the way light does through a grating. In 1927 Davisson and Germer, and independently G. P. Thomson, saw exactly that.</p>
<p>And Bohr’s mysterious orbits suddenly made sense. An electron’s wave has to fit around the nucleus a whole number of times, like a guitar string that can only vibrate at certain notes. Allowed orbits are just the ones where the wave closes on itself.</p>`,

    // ---- 4 --------------------------------------------------------------------
    `<h2><span>IV</span>The Double Slit</h2>
<p>Richard Feynman said this experiment contains “the only mystery” of quantum mechanics. Here it is.</p>
<p>Put a barrier with two narrow slits in front of a screen. Send waves through, water or light, and they spread from each slit and overlap. Where crest meets crest they reinforce; where crest meets trough they cancel. The screen shows <em>interference fringes</em>: bright, dark, bright, dark.</p>
<p>Now send electrons, <b>one at a time</b>. Each one lands at a single point, a tiny dot, like a particle. But let thousands land, and the dots build up into the same striped interference pattern.</p>
<p>Each electron, alone, somehow interfered with itself. It behaved as if it went through both slits.</p>
<div class="fig">· ·:·  ·:::·  ·:::::·  ·:::·  ·:·· ·<br><small>one dot at a time, a wave pattern overall</small></div>`,
    `<p>So put a detector at the slits to see which one each electron really uses.</p>
<p>You can do it. Every electron is found going through exactly one slit, never half through each. But the moment you collect that information, the stripes vanish. The screen shows two plain bands, the pattern you’d expect from tiny bullets.</p>
<p>It doesn’t matter whether a person looks at the detector’s readout. What matters is whether the which-slit information exists anywhere in the universe, even in a stray air molecule that bumped the electron. If the paths can be told apart, they don’t interfere.</p>
<p>This has been done with electrons, neutrons, atoms, and molecules of more than two thousand atoms. The rule always holds:</p>
<p class="bk-pull">When nature can’t tell which way something went, the possibilities interfere. When it can, they don’t.</p>`,

    // ---- 5 --------------------------------------------------------------------
    `<h2><span>V</span>The Wavefunction</h2>
<p>Quantum mechanics describes a particle not with a position and speed, but with a <b>wavefunction</b>, written ψ (psi). It assigns a number, called an <em>amplitude</em>, to every place the particle could be found.</p>
<p>Amplitudes are odd numbers. They can be positive, negative, or complex, which is what lets them cancel each other out. That cancellation is interference.</p>
<p>In 1926 Max Born explained what ψ has to do with experiments. The probability of finding the particle at a spot is the square of the amplitude’s size there:</p>
<div class="eq">P = |ψ|<sup>2</sup></div>
<p>This is the <em>Born rule</em>, and it is where chance enters physics. Quantum mechanics generally does not say where the electron <em>will</em> land. It gives the odds, exactly, and the odds have been confirmed in countless experiments.</p>`,
    `<p>Two features make the wavefunction strange.</p>
<p><b>Superposition.</b> If a particle could be in state A or state B, it can also be in a combination of both, “some of A plus some of B”. This isn’t ignorance, as if it were secretly in one of them. The combination is a genuinely different state, and it can do things that neither A nor B can do alone, like produce interference.</p>
<p><b>It isn’t in ordinary space.</b> For one particle, ψ looks like a wave spread through the room. For two particles it is a function of both positions at once, living in a six-dimensional space. For a hundred particles, three hundred dimensions. The wavefunction is less like a ripple on a pond and more like a vast ledger of every possible arrangement, each with its own amplitude.</p>
<p>Whether ψ is a real physical thing, or only a record of what we can predict, is still argued about. Chapter XII returns to this.</p>`,

    // ---- 6 --------------------------------------------------------------------
    `<h2><span>VI</span>Schrödinger’s Equation</h2>
<p>Newton’s laws tell you how a ball moves. For quantum systems, the rule for how ψ changes in time was written down by Erwin Schrödinger in 1926, reportedly during a ski holiday:</p>
<div class="eq">iħ <span class="frac"><span>∂ψ</span><span>∂t</span></span> = Ĥ ψ</div>
<p>Here ħ (“h-bar”) is Planck’s constant divided by 2π, and Ĥ, the <em>Hamiltonian</em>, encodes the system’s energy: how the particle moves, and what forces act on it.</p>
<p>The equation is smooth and completely deterministic. Give it ψ now and it tells you ψ at every later moment, with no randomness at all. The randomness only appears when you measure, through the Born rule.</p>
<p>Solve it for an electron bound to a proton and, without any of Bohr’s ad hoc rules, the discrete energy levels of hydrogen fall straight out, along with the shapes of the electron clouds, the <em>orbitals</em>, that every chemistry student draws.</p>`,
    `<p>Those orbitals are the reason chemistry works the way it does.</p>
<p>Electrons fill the levels from the bottom up, and (thanks to a rule we will meet in Chapter VIII) no two can share exactly the same state. The pattern of filled and half-filled shells explains the periodic table: why helium and neon are aloof, why sodium is desperate to lose an electron, why carbon forms four bonds and can build the long chains of life.</p>
<p>A chemical bond is two atoms sharing electron waves in a way that lowers the total energy. The angle of a water molecule, the hardness of diamond, the colour of copper: all of it is Schrödinger’s equation, solved, with patience, for many electrons at once.</p>
<p>Paul Dirac wrote in 1929 that the underlying laws for “the whole of chemistry” were now completely known. The only difficulty, he added, is that the equations are much too complicated to solve. It is still the difficulty.</p>`,

    // ---- 7 --------------------------------------------------------------------
    `<h2><span>VII</span>Uncertainty</h2>
<p>A wave with a single, precise wavelength must go on forever: it has no particular location. To make a wave that is bunched up in one place, you have to add many wavelengths together. And since wavelength is momentum (λ = h/p), a particle with a sharp position necessarily has a spread-out momentum.</p>
<p>Werner Heisenberg made this exact in 1927:</p>
<div class="eq">Δx · Δp ≥ ħ / 2</div>
<p>The more precisely position is defined, the less precisely momentum is, and the reverse.</p>
<p>This is often explained as “measuring disturbs the particle”, but that misses the point. The limit isn’t about clumsy instruments. A particle simply <em>does not have</em> a perfectly sharp position and momentum at the same time, any more than a musical note can have a perfectly sharp pitch while lasting only an instant.</p>`,
    `<p>Uncertainty has visible consequences.</p>
<p>It is why atoms have a size at all. Squeeze an electron closer to the nucleus and its momentum must spread out, raising its kinetic energy. The atom settles at the radius where that cost balances the electric pull, and a hydrogen atom comes out about a tenth of a nanometre across, exactly as measured.</p>
<p>It is also why nothing is ever perfectly still. Even at absolute zero, a quantum system keeps a minimum jiggle called <em>zero-point energy</em>. It is the reason liquid helium never freezes at normal pressure, however cold you make it.</p>
<p>A similar trade-off links energy and time. Very short-lived states have blurry energies. Particle physicists use this every day: the width of a bump in their data tells them how long an unstable particle lived.</p>`,

    // ---- 8 --------------------------------------------------------------------
    `<h2><span>VIII</span>Spin</h2>
<p>In 1922 Otto Stern and Walther Gerlach sent a beam of silver atoms through a magnetic field that pushes on tiny magnets. If the atoms were little compass needles pointing in random directions, the beam should have smeared into a continuous line.</p>
<p>It split into exactly <b>two</b> spots.</p>
<p>Electrons carry an intrinsic magnetism called <em>spin</em>. Despite the name, nothing is spinning. When measured along any axis you choose, an electron’s spin comes out either “up” or “down”, never anything in between.</p>
<p>Spin is the simplest quantum system there is, a <em>qubit</em>. Measure up/down and you get one of two answers. Turn the magnet sideways and measure left/right instead, and an electron that was definitely “up” now gives left or right at random, fifty-fifty. Then measure up/down again and it’s random again: the sideways measurement wiped out what was known before.</p>`,
    `<p>Spin also explains why matter is solid.</p>
<p>Particles come in two families. <b>Fermions</b>, such as electrons, protons and neutrons, obey Wolfgang Pauli’s <em>exclusion principle</em>: no two identical fermions can occupy the same quantum state. <b>Bosons</b>, such as photons, are the opposite: they are happy, even eager, to pile into the same state.</p>
<p>Because electrons refuse to share, they stack into shells, giving atoms their structure and size. When you push your hand on a table, the resistance you feel is largely electrons declining to be squeezed into states already taken. Without exclusion, all matter would collapse.</p>
<p>Bosons piling up give us the opposite marvels: lasers, in which countless photons march in the same state; superfluids, which climb out of their containers; and superconductors, which carry current with zero resistance.</p>`,

    // ---- 9 --------------------------------------------------------------------
    `<h2><span>IX</span>Measurement, and a Cat</h2>
<p>Schrödinger’s equation evolves superpositions smoothly. Yet every measurement gives one definite result. Something seems to switch over: before, a blend of possibilities; after, one outcome. In the textbooks this is called the <em>collapse</em> of the wavefunction, and nobody agrees what it is.</p>
<p>In 1935 Schrödinger tried to show how absurd this was. Seal a cat in a box with a radioactive atom, a Geiger counter and a vial of poison. If the atom decays, the counter trips, the vial breaks, the cat dies. After an hour the atom is in a superposition of decayed and not decayed. So, if the equation applies to everything, is the cat a superposition of dead and alive until someone opens the lid?</p>
<p>Schrödinger meant it as a joke against the theory. It became its most famous image.</p>`,
    `<p>Part of the answer is a process called <b>decoherence</b>.</p>
<p>A large object is never truly isolated. Air molecules, light and heat constantly bounce off it, and each collision carries away a little information about its state. Within a tiny fraction of a second the environment effectively “knows” whether the cat is alive, just as a stray molecule knowing which slit an electron used destroys the fringes.</p>
<p>Once that information is out, the alive and dead branches can no longer interfere, and from inside, each branch looks like an ordinary, definite world. This is why everyday objects never seem to be in two places at once, and why building a quantum computer, which must keep its qubits in superposition, is so hard: everything in the universe is trying to measure them.</p>
<p>Decoherence explains why we never <em>see</em> superpositions of cats. Whether it fully explains why we get <em>one particular</em> outcome is exactly where the interpretations of Chapter XII part ways.</p>`,

    // ---- 10 -------------------------------------------------------------------
    `<h2><span>X</span>Entanglement</h2>
<p>Two particles can share a single wavefunction, so that neither has a state of its own, only the pair does. This is <b>entanglement</b>.</p>
<p>Prepare two electrons so their spins are guaranteed to be opposite, then send them miles apart. Measure one: up, at random. The other, measured along the same axis, will be down. Every time.</p>
<p>In 1935 Einstein, Podolsky and Rosen argued that this means quantum mechanics is incomplete. Surely the particles carried hidden instructions from the start, like a pair of gloves split between two boxes: open one and find the left glove, and you instantly know the other is the right. No spooky action required.</p>
<p>For thirty years this seemed like a question of taste. Then, in 1964, John Bell showed it could be settled by experiment.</p>`,
    `<p>Bell proved that any “hidden instructions” theory, in which results are fixed in advance and nothing travels faster than light, puts a strict limit on how strongly measurements at different angles can agree. Quantum mechanics predicts that entangled particles break that limit.</p>
<p>Experiments by John Clauser, Alain Aspect and Anton Zeilinger, and many since, checked. The limit is broken. Nature is not like gloves in boxes. They shared the 2022 Nobel Prize for it.</p>
<p>Entanglement can’t be used to send a message faster than light. Each person sees only random results; the pattern appears only when they compare notes, by ordinary means. But it is real, and useful. Entanglement is the resource behind quantum cryptography, quantum teleportation of states, and the power of quantum computers.</p>
<p class="bk-pull">Two particles, light-years apart, can be one thing.</p>`,

    // ---- 11 -------------------------------------------------------------------
    `<h2><span>XI</span>Walking Through Walls</h2>
<p>Roll a ball at a hill too high for it and it rolls back. Always. A quantum particle facing an energy barrier it can’t climb behaves differently: its wavefunction doesn’t stop dead at the wall but fades inside it, and if the wall is thin enough, a little of the wave comes out the other side.</p>
<p>So there is a small but real chance the particle simply appears beyond the barrier. This is <b>quantum tunnelling</b>.</p>
<p>The Sun depends on it. Protons in its core repel each other strongly, and at the core’s temperature they almost never have enough energy to get close enough to fuse. They tunnel through instead, slowly enough that the Sun has burned steadily for four and a half billion years.</p>
<p>Tunnelling also explains why some radioactive nuclei decay, and it is built into your phone: flash memory stores your photos by making electrons tunnel through a thin insulating layer.</p>`,

    // ---- 12 -------------------------------------------------------------------
    `<h2><span>XII</span>What Is Really Going On?</h2>
<p>The mathematics of quantum mechanics is not in dispute. It is the most precisely tested theory in science; one of its predictions for the electron’s magnetism agrees with experiment to about one part in a trillion. What is disputed is what it <em>means</em>. The main readings:</p>
<p><b>Copenhagen.</b> The wavefunction is a tool for predicting results, not a picture of reality. Asking what the electron “really” did between measurements is asking a question with no answer.</p>
<p><b>Many-Worlds.</b> The wavefunction is real and never collapses. Every measurement splits the world into branches, one for each outcome, and there is a version of you in each.</p>
<p><b>Pilot waves.</b> Particles always have definite positions, guided along by a real wave. The randomness comes from not knowing where they started. The price: an influence that acts instantly across space.</p>`,
    `<p><b>Collapse theories.</b> Schrödinger’s equation is slightly wrong. Wavefunctions collapse spontaneously, so rarely that a single particle could stay in superposition for ages, but so quickly for anything large that cats are never in doubt. Unlike the others, this one makes different predictions, and experiments are hunting for them.</p>
<p><b>QBism and relational views.</b> The wavefunction describes an agent’s information or the relations between systems, not a thing in itself.</p>
<p>Each is consistent with every experiment done so far. Choosing between them is partly physics and partly philosophy, and some of the best physicists alive disagree completely.</p>
<p>Feynman said that nobody understands quantum mechanics. He didn’t mean that nobody can use it. Millions of engineers use it every day. He meant that it still refuses to fit into the pictures our minds evolved for rocks, rivers and thrown spears. Maybe it never will.</p>`,

    // ---- 13 -------------------------------------------------------------------
    `<h2><span>XIII</span>Everything It Built</h2>
<p>For a theory nobody understands, it has been remarkably productive. A rough estimate often quoted is that a third of the world economy depends on technologies that would be impossible without it.</p>
<p><b>The transistor</b> (1947) exists because quantum mechanics explains how electrons move in semiconductors. There are tens of billions in the laptop on the desk.</p>
<p><b>The laser</b> is bosons in lockstep. It reads barcodes, carries the internet through glass fibre, and cuts steel.</p>
<p><b>MRI scanners</b> flip the spins of hydrogen nuclei in your body and listen to them flip back.</p>
<p><b>Atomic clocks</b> count the oscillations of a precise quantum transition. GPS needs them, and corrects them for relativity too.</p>
<p><b>LEDs</b>, solar panels, the CCD in a camera: electrons jumping between energy levels, one photon at a time.</p>`,
    `<p>And there is the newer generation: quantum computers, which compute with superpositions and entanglement directly; quantum sensors sensitive enough to feel the gravity of a person walking past; quantum key distribution, whose security rests on the fact that measuring a quantum state changes it.</p>
<p>It all started with a stove that refused to glow ultraviolet.</p>
<p>If you go outside tonight and look up, the starlight reaching your eye has crossed hundreds of light-years as a spreading wave, and then, at the back of your eye, landed as single photons, each one absorbed by a single molecule. You are, every time you see a star, doing a quantum experiment.</p>
<p class="bk-pull">Close the book. Go look.</p>`,

    // ---- further reading -------------------------------------------------------
    `<h3>Further Reading</h3>
<p class="bk-read"><b>Richard Feynman — <em>QED: The Strange Theory of Light and Matter</em></b><br>Four lectures for a general audience. The clearest explanation of amplitudes ever written.</p>
<p class="bk-read"><b>Leonard Susskind &amp; Art Friedman — <em>Quantum Mechanics: The Theoretical Minimum</em></b><br>The real mathematics, gently. Start here if you want to calculate.</p>
<p class="bk-read"><b>David J. Griffiths — <em>Introduction to Quantum Mechanics</em></b><br>The standard undergraduate textbook, famous for being readable.</p>
<p class="bk-read"><b>The Feynman Lectures on Physics, Volume III</b><br>Free to read online from Caltech. Chapter 1 is the double slit.</p>
<p class="bk-read"><b>Adam Becker — <em>What Is Real?</em></b><br>The history of the arguments over Chapter XII.</p>
<p class="bk-read"><b>Sean Carroll — <em>Something Deeply Hidden</em></b><br>An argument for Many-Worlds, by a physicist who believes it.</p>`,
    `<div class="bk-title"><div class="bk-orn">&#10087;</div><div class="bk-t3">The end.<br><br>It’s still 3 a.m.</div></div>`,
  ],
};
