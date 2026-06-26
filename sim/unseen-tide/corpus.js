/**
 * Unseen Tide experiment corpus.
 *
 * Domain: urban beekeeping. Chosen for clean, bounded vocabulary and
 * easily generated stylistic variants / adjacent topics.
 *
 * Each chunk is ~400-700 characters — one context-inspector chunk at
 * the default 500-char chunk size.
 *
 * Every phase has 10 chunks. The runner cycles through them in order;
 * results are deterministic.
 */

const reference = `Urban beekeeping is the practice of keeping honey bee colonies in city and suburban environments. A healthy hive contains a queen bee, thousands of worker bees, and a smaller number of drones. The queen lays eggs while the workers forage for nectar and pollen, tend brood, and defend the hive. Nectar is processed into honey and stored in the wax comb. Urban beekeepers must monitor their apiary for mites, disease, and swarm behaviour, especially during spring when colonies expand rapidly.

Well-managed rooftop hives in cities often outproduce rural hives because of the diversity of nearby flowering plants, from parks to street trees to balcony gardens. Workers forage across an area of several square miles, returning with nectar and pollen loads that feed the colony and enable honey storage. The beekeeper inspects frames, rotates supers, and harvests honey seasonally. Responsible urban apiary management requires awareness of local ordinances, neighbour relations, and the bees' water sources.

A colony inspection examines each frame for evidence of a laying queen: eggs in cell centres, larvae of progressively larger sizes, capped brood in concentric rings, and bands of stored pollen and honey around the edges of the brood nest. A spotty brood pattern, missing eggs, or the sudden appearance of many drone cells can signal queen failure. A beekeeper who notices these signs can requeen the colony before it loses population irrecoverably.

Varroa destructor is the single most damaging parasite of honey bee colonies worldwide. Urban beekeepers use an integrated pest management approach that combines regular mite counts via sugar roll or alcohol wash, drone-brood removal during spring buildup, screened bottom boards, and targeted seasonal treatments when mite thresholds are exceeded. Keeping mite loads low through summer is essential for producing healthy winter bees.

Swarming is the natural reproduction of a honey bee colony. When space, food, and pheromones align, a colony raises new queen cells and the existing queen departs with a portion of the workers to establish a new hive. Urban beekeepers manage swarm impulse by adding space, performing controlled splits, and monitoring for queen cells during the spring peak. A swarm that leaves the apiary is both a colony loss and a community concern.

Honey harvests in temperate urban climates track the local flowering calendar. Spring produces a primary flow from fruit trees and early shrubs; early summer adds flow from clover, basswood, and the blooms of ornamental trees; a secondary autumn flow arrives from late-blooming plants such as goldenrod and asters. The beekeeper extracts capped honey from supers and leaves enough winter stores in the brood chamber for the colony to survive until the next spring.

Wax comb is secreted by young worker bees from glands on their abdomens. Fresh comb is pale and elastic; it darkens and becomes brittle as brood is reared and pollen is stored within it. Periodic rotation of old comb out of the brood chamber helps prevent the buildup of pesticide residues and disease organisms that can accumulate over time in heavily used wax.

Autumn preparation for winter is the most consequential management period of the beekeeping year. The beekeeper ensures adequate honey stores, performs late-season mite treatments, reduces the hive entrance against mice and robbers, and situates hives where they will receive winter sun. A colony that enters winter with a young queen, low mites, and ample stores has the best chance of emerging strong in spring.`;

// ── Phase 1: Calibration (pure reference content) ──────────────────
const phase1 = [
  `A strong colony in spring will have a laying queen, fresh brood in a tight pattern, and several frames of stored honey and pollen. Workers gather nectar from nearby flowering plants and return to the hive to process it into honey. The beekeeper watches for capped brood and healthy emergence patterns.`,

  `Urban apiaries benefit from the floral diversity of city parks, street trees, and balcony gardens. Workers travel up to three miles to forage, returning with nectar and pollen that feed the colony and the developing brood in the comb. Honey production often exceeds rural hives.`,

  `Inspections are performed on warm days, working frame by frame. The beekeeper looks for eggs, larvae, capped brood, honey stores, and pollen bands. A missing queen or spotty brood pattern signals trouble that must be addressed before the colony weakens further.`,

  `Varroa mites are the most common threat to honey bee colonies. Routine mite counts, drone-brood removal, and seasonal treatments form the core of integrated pest management in urban apiaries. Beekeepers combine monitoring with targeted interventions to keep parasite loads low through summer.`,

  `Swarming occurs when a colony outgrows its hive. The old queen leaves with roughly half the workers to find a new home, while the parent hive raises a new queen. Urban beekeepers manage swarm impulse through space, splits, and queen cell checks during peak spring.`,

  `Honey harvests are timed to flowering cycles. In temperate urban climates the main flows are spring and early summer, with secondary autumn flows from late-blooming plants. Beekeepers extract capped honey from supers, leaving enough stores for the colony to overwinter safely.`,

  `A queen's laying pattern is the single most informative indicator of colony health. Tight circular brood frames with eggs, larvae, and capped cells in concentric rings signal a productive queen. Scattered or drone-heavy patterns suggest queen failure that may require replacement.`,

  `Neighbour relations matter in urban beekeeping. Beekeepers provide water sources on the hive roof to prevent bees from visiting neighbouring pools. Hive placement, flight paths, and seasonal management all affect how bees interact with the surrounding city environment.`,

  `Wax comb is built by young worker bees from glands on their abdomens. Fresh comb starts white and darkens with use as brood is raised and pollen is stored. Beekeepers rotate old comb out of the brood chamber every few years to prevent disease buildup.`,

  `Autumn management prepares colonies for winter. The beekeeper ensures adequate honey stores, controls mites with late-season treatments, reduces hive entrances against mice and robbers, and positions hives where they will receive winter sun in the apiary.`,
];

// ── Phase 2: Stylistic drift (same topic, different register) ──────
const phase2 = [
  // Legal contract style
  `WHEREAS the apiarist ("Beekeeper") maintains one or more colonies of Apis mellifera ("the Bees") in an urban setting, and WHEREAS said colonies produce honey, wax, propolis, and pollen as byproducts of forage activity, the Beekeeper shall be responsible for inspection, pest management, and colony sustenance in accordance with municipal apiary ordinances and industry practice.`,

  // Academic
  `Empirical studies of Apis mellifera colonies in urbanized environments demonstrate a positive correlation between floral richness and net colony biomass accumulation during the primary nectar flow. Data collected across 42 rooftop apiaries over three foraging seasons suggest that urban configurations can meet or exceed rural honey yields under standardized management protocols.`,

  // Tweet thread
  `🧵 ok so urban beekeeping — real quick. your queen is the only one laying. workers are everyone else. they fly out, grab nectar and pollen, bring it home, honey happens. mites are the enemy. check your hive every week-ish in spring. swarms = colony split. that's the whole vibe basically.`,

  // Marketing copy
  `Discover the golden revolution happening on city rooftops! Our premium urban honey is crafted by thousands of dedicated worker bees foraging on the wildflowers, park blooms, and garden treasures of the city. Every jar tells the story of a neighbourhood — in every drop of liquid gold.`,

  // Pirate
  `Arr, me urban bee-keeper! Ye tend yer hive with more care than ye tend yer own quarters. The queen be the captain, the workers be the crew, and the nectar be the booty they haul back to port. Mites be the scurvy of the colony — scrub 'em off or lose the whole crew by winter.`,

  // Cookbook recipe style
  `Ingredients: 1 queen bee, approximately 50,000 workers, 1 wooden hive body, 8 frames of foundation, 1 honey super. Method: Install queen and workers in the hive body in late spring. Allow colony to build comb and forage for nectar and pollen for 90 days. Harvest honey when 80% of frames are capped.`,

  // Haiku-adjacent flowery prose
  `The rooftop hive hums before dawn, a low and patient chord drawn from ten thousand wings. A queen at the centre lays the silent work of the season. Workers return with the day's light on them, nectar trembling in their honey crops, the comb slowly gilding.`,

  // Legal again
  `The Beekeeper represents and warrants that the Apiary is managed in accordance with applicable pest control standards, including but not limited to quarterly monitoring for Varroa destructor and treatment threshold observance. The Beekeeper shall maintain records of hive inspections for the duration of the covered period.`,

  // Technical manual style
  `Section 4.2: Colony Inspection Protocol. Procedure: (a) Don protective equipment. (b) Apply smoke to entrance for 30 seconds. (c) Remove outer cover and crown board. (d) Inspect each frame from outermost to innermost, noting presence of eggs, larvae, capped brood, honey stores, and pollen bands. Replace frames in original order and orientation.`,

  // Children's book
  `Bea the Bee lives in a hive on top of a tall building! Every day Bea flies to find pretty flowers. She sips the sweet nectar and gathers yellow pollen. Then she flies back to her hive where her queen mother is busy laying eggs. The workers make all the nectar into delicious honey!`,
];

// ── Phase 3: Adjacent-domain creep ─────────────────────────────────
const phase3 = [
  // General pollinator gardening
  `A pollinator-friendly garden provides overlapping blooms from early spring through late autumn. Native wildflowers, flowering herbs, and cottage-garden perennials supply nectar and pollen for butterflies, moths, solitary bees, and hummingbirds. Avoiding broad-spectrum pesticides is essential to sustaining visiting insects.`,

  // Butterfly conservation
  `Monarch butterfly populations have declined sharply over the past three decades, driven largely by the loss of milkweed habitat along their North American migration corridor. Home gardeners can contribute by planting native milkweed species and by providing nectar sources for adults along migration routes.`,

  // Wasps / related hymenoptera
  `Paper wasps build open-celled papery nests from chewed wood fibre, typically under eaves, in sheds, or within untended shrubbery. Unlike honey bees, paper wasps are predatory rather than nectarivorous for much of their life cycle, hunting caterpillars and other soft-bodied insects to feed their developing brood.`,

  // Gardening / composting
  `A balanced compost pile requires a mix of carbon-rich and nitrogen-rich organic materials, adequate moisture, and periodic turning to aerate the interior. Temperatures inside an active pile can exceed sixty degrees Celsius during peak decomposition, sufficient to destroy most weed seeds and pathogens.`,

  // Agricultural pesticide policy
  `Neonicotinoid pesticides are systemic insecticides taken up by treated plants into nectar and pollen tissues. Regulatory bodies in several jurisdictions have restricted their outdoor use following evidence of adverse effects on non-target pollinator species. Alternative integrated pest strategies are now widely promoted.`,

  // Birdwatching
  `Backyard birdwatchers can attract a wide range of species by providing feeders stocked with sunflower seed, suet, and nectar. Water features such as shallow birdbaths supplement food and are particularly important during hot, dry summer weeks when natural sources may be scarce across urbanized areas.`,

  // Chicken keeping
  `Backyard poultry flocks are increasingly common in suburban settings. A small flock of three to six laying hens can supply a household with eggs year-round given adequate housing, fresh water, a balanced feed ration, and protection from predators such as raccoons, foxes, and neighbourhood dogs.`,

  // General insect decline
  `Long-term monitoring studies in western Europe and North America have documented substantial declines in flying-insect biomass over the past several decades. Drivers include habitat loss, agricultural intensification, pesticide exposure, light pollution, and climate change acting in combination across landscapes.`,

  // Native plants
  `Native plant species support far more specialist insect species than equivalent non-native ornamentals. Selecting species with documented ecological value for regional pollinators and birds creates durable backyard habitat that supports food webs from the soil through the canopy across seasons.`,

  // Aquaponics
  `Aquaponic systems integrate aquaculture and hydroponics into a single closed loop. Fish waste provides nutrients for plants grown on a recirculating water bed, while the plants filter the water returning to the fish tank. Scale ranges from small home systems to commercial greenhouse installations.`,
];

// ── Phase 4: Hard contamination (unrelated topics) ─────────────────
const phase4 = [
  `The Treaty of Westphalia, signed in 1648, concluded the Thirty Years' War and established the foundational principles of state sovereignty that shaped the modern European political order. Its provisions included territorial adjustments, recognition of religious pluralism within the Holy Roman Empire, and practical recognition of the independence of the Netherlands.`,

  `Volcanic eruptions are classified along the Volcanic Explosivity Index, a logarithmic scale from zero to eight based on ejected tephra volume, plume height, and qualitative observations. The 1815 Mount Tambora eruption rated a seven and produced the so-called Year Without a Summer across much of the Northern Hemisphere during 1816.`,

  `Modern aviation safety relies on layered defences across airframe design, flight-crew training, air-traffic control, and regulatory oversight. Commercial transport aircraft accident rates have fallen by more than two orders of magnitude since the dawn of the jet era, making air travel the safest long-distance transport mode on a per-passenger-mile basis.`,

  `Distributed consensus protocols such as Paxos and Raft allow a cluster of machines to agree on a sequence of values despite partial network failures and individual node crashes. Both protocols elect a leader, replicate a log of operations, and commit entries once a majority of participants have acknowledged receipt.`,

  `The soufflé is a baked dish of egg-white foam folded into a savoury or sweet base. Its rise depends on the mechanical stability of the beaten whites and the rapid expansion of entrained air as the dish is baked at high heat. Careful oven discipline and prompt service prevent collapse.`,

  `Basketball was invented in 1891 by James Naismith at a YMCA training school in Springfield, Massachusetts. The original thirteen rules were posted on the gymnasium bulletin board alongside a pair of peach baskets nailed to the balcony. The game has since evolved into one of the most popular sports in the world.`,

  `Stellar nucleosynthesis is the process by which lighter elements fuse into heavier ones inside stars. Hydrogen fuses into helium via the proton-proton chain in main-sequence stars such as the Sun. Later fusion stages produce carbon, oxygen, and heavier elements up to iron in increasingly massive stellar cores.`,

  `Cryptographic hash functions map inputs of arbitrary length to outputs of fixed length in a way that is efficient to compute but difficult to invert. Secure hash functions resist pre-image attacks, second-preimage attacks, and collision attacks. SHA-256 is widely deployed across systems as of the current decade.`,

  `The Silk Road was a network of overland trade routes connecting East Asia with the Mediterranean world from roughly the second century BCE onward. Goods exchanged included silk, spices, precious metals, glass, and ideas. The network functioned in phases across centuries as regional powers waxed and waned.`,

  `Photovoltaic solar panels convert incident sunlight into direct-current electricity through the photoelectric effect in semiconductor materials. Commercial silicon modules today achieve conversion efficiencies between eighteen and twenty-two percent. System costs have fallen by more than an order of magnitude since the year 2010.`,
];

module.exports = { reference, phase1, phase2, phase3, phase4 };
