/**
 * Conversation Rot — 50-turn synthetic transcript.
 *
 * A multi-turn urban-beekeeping chat with three drift/recovery cycles.
 * Each turn is a single content chunk (~300-500 chars). Every turn has
 * a ground-truth drift label:
 *
 *   0  — fully on-topic (beekeeping)
 *   1  — bridging (honey-adjacent but drifting)
 *   2  — clearly off-topic
 *   3  — wholly unrelated
 *
 * The reference corpus is a set of authentic-style on-topic chat turns
 * used for domain term extraction and baseline statistics. It is
 * written entirely in chat register so the analytical baseline's
 * statistics reflect chat content — not the register-mix inflation
 * that an encyclopedic+chat blend would produce.
 */

const reference = [
  `User: When should I be doing my first mite count of the spring, and what's the best method — sugar roll or alcohol wash? I'm trying to decide which to commit to this year given I have two hives.`,
  `Assistant: Start mite counts when workers are bringing in fresh pollen and the queen is actively laying, usually late April. Alcohol wash gives more accurate mite counts than sugar roll because it dislodges more phoretic varroa — at the cost of the sampled bees. Sugar roll lets you release the sampled bees back into the hive.`,
  `User: I'm planning my second oxalic acid treatment this month. Both hives still have capped brood — does that change how I should dose, or do I go ahead and treat anyway?`,
  `Assistant: Oxalic acid is most effective on phoretic mites riding adult bees, not on mites inside capped brood. A three-round vapour treatment spaced five to seven days apart catches mites as they emerge across brood cycles. One dose with capped brood present leaves most mites untouched.`,
  `User: Got it. One of my hives is producing a lot of drone brood well into late summer. Is that something to worry about, or is it just the colony running its own clock?`,
  `Assistant: Late drone brood can be normal if it's concentrated on drone comb and the worker brood pattern is still tight. It becomes a warning sign when drone cells scatter through worker comb or when eggs disappear but drones keep emerging — that pattern points to queen failure or a laying worker.`,
  `User: What specifically should I look for on the brood frames to distinguish a failing queen from a laying worker?`,
  `Assistant: Key signals: a laying worker deposits multiple eggs per cell and places them along the cell walls rather than the bottom. A failing queen typically lays single eggs at the bottom but with a scattered or drone-heavy pattern. Check for queen presence directly if either pattern appears, and compare worker population trend over the next two weeks.`,
  `User: If I conclude she's failing this late, should I requeen or combine with my other hive?`,
  `Assistant: Combining using the newspaper method is the safer call this late. A new queen needs six to eight weeks of mating and laying time to produce the winter bees, and most mated queens are hard to source after September. You preserve the bees and stores even if you lose the queen line.`,
  `User: On winterization — I have a quilt box for moisture control. Should I also add an upper entrance, or is the quilt box alone sufficient for a northern urban apiary?`,
  `Assistant: Add the upper entrance. It gives bees an exit for cleansing flights when the bottom entrance ices over, and it adds a touch of air exchange that a quilt box alone does not. Drill it below the quilt box so the box can still absorb moisture from the cluster.`,
  `User: When should I start thinking about spring swarm prevention? I lost one swarm this year and want to get ahead of it next spring.`,
  `Assistant: Spring swarm planning starts in late February. Have extra drawn comb ready, equipment cleaned, and a plan for splits or added supers at the first congestion point. The single biggest swarm prevention factor is staying ahead of the colony's space needs during the spring buildup — they swarm when they feel cramped.`,
  `User: What's the earliest spring inspection you'd recommend? I'm always torn between assessing the colony and leaving them alone during buildup.`,
  `Assistant: A short first inspection on a warm calm day in late March or early April is fine. Check queen presence, food stores, obvious disease. Keep it under fifteen minutes and don't break down the brood nest. The full frame-by-frame can wait for more consistent temperatures in May.`,
].join('\n\n');

const turns = [
  // ── Cycle 1: on-topic (T1-10) ────────────────────────────────────
  { drift: 0, text: `User: I'm about to do my second mite treatment of the year and wanted to double-check the timing. Both hives still have some capped brood — does that change anything about how I should dose oxalic acid, or should I just go ahead and treat anyway?` },
  { drift: 0, text: `Assistant: Oxalic acid dribble or vapourisation is most effective on phoretic mites riding on adult bees, not mites inside capped brood. Treating when brood is still capped means you'll miss a meaningful fraction of the mite population. If you can wait for a natural brood break or do a three-round vapour treatment spaced five days apart, you'll catch more mites as they emerge.` },
  { drift: 0, text: `User: So a split treatment rather than a single dose. How many days apart and how many rounds do you recommend, exactly? I have the vapouriser and plenty of oxalic acid on hand.` },
  { drift: 0, text: `Assistant: A common protocol is three treatments spaced five to seven days apart. The interval targets mites emerging from capped cells across successive brood cycles. Dose is typically 1 to 2 grams of oxalic acid per hive, depending on colony size. Seal the hive during vapourisation and give the vapour five to ten minutes to work.` },
  { drift: 0, text: `User: Great. While I have you — I noticed my stronger hive still seems to be raising a lot of drone brood even though we're well into late summer. Is that normal or a sign something's off with the queen?` },
  { drift: 0, text: `Assistant: Late drone brood is not automatically a problem but it's worth a closer look. A laying queen should be shifting toward worker production as the season winds down. Check whether the drone pattern is concentrated on drone comb (normal) or scattered across worker cells (suggestive of queen failure or a laying worker). The latter needs intervention.` },
  { drift: 0, text: `User: Got it. I'll open them up tomorrow and photograph the brood frames. What specifically should I look for to tell the difference between a healthy late-season queen and one that's failing?` },
  { drift: 0, text: `Assistant: Key signals: eggs in cell bottoms (a failing queen often stops laying eggs before she stops laying drones); tight concentric brood rings (scattered patterns suggest trouble); single egg per cell (multiple eggs in one cell indicates a laying worker); and worker population trend over the next couple of weeks. Low eggs plus declining workers is the clearest signal.` },
  { drift: 0, text: `User: Helpful. And if I do conclude she's failing, do I try to requeen at this point in the season, or just let the colony combine with the other one?` },
  { drift: 0, text: `Assistant: Requeening this late is risky because a new queen needs time to build her laying pattern before winter. Combining with your stronger hive using the newspaper method is usually the safer call this close to first frost. You preserve the bees and honey stores even if you lose that specific queen line.` },

  // ── Cycle 1 drift: honey → coffee → tea → baking (T11-16) ────────
  { drift: 1, text: `User: Thanks, that makes sense. Off-topic question — I've been experimenting with putting some of last year's honey in my morning coffee. Do you think dark or light roasts pair better with a darker honey like buckwheat? The buckwheat honey has that molasses-ish finish.` },
  { drift: 1, text: `Assistant: Darker roasts tend to balance a strong honey like buckwheat because the roast bitterness meets the molasses notes head-on. Lighter roasts can get overwhelmed. If you want the honey to be more prominent, a medium roast with a natural processing method gives you fruit-forward notes that contrast with the honey rather than competing.` },
  { drift: 2, text: `User: Interesting. On the coffee side — I've been trying different brewing methods. The pour-over gives a cleaner cup but I find the French press pulls out more body. Any thoughts on grind size and extraction time for a Kenyan single origin?` },
  { drift: 2, text: `Assistant: For a Kenyan on pour-over, aim for medium-fine grind and a total brew time around three and a half to four minutes. Kenyan beans have bright acidity and complex fruit — you want enough extraction to pull those out but not so much that you drag in bitterness. Temperature matters too: 95 to 97 Celsius is the usual target.` },
  { drift: 2, text: `User: And for tea — I've been getting into Chinese oolongs lately. Is a dark oolong like Da Hong Pao brewed differently from a greener one like Tieguanyin? My gongfu setup is a small gaiwan and I'm experimenting with flash steeping.` },
  { drift: 2, text: `Assistant: Darker oolongs like Da Hong Pao tolerate and benefit from higher temperatures — boiling water is fine — and longer infusions on later steeps. Greener oolongs like Tieguanyin should be steeped a touch cooler, around 85 to 90 Celsius, and more briefly, especially on early steeps. Both reward multiple infusions in a gaiwan.` },

  // ── Cycle 1 recovery: back to bees (T17-22) ──────────────────────
  { drift: 1, text: `User: Okay, pivoting back to actual beekeeping — I did open up the weaker hive this afternoon. Queen is present, brood pattern is solid on the worker cells, but there's definitely more drone comb than I'd expect for this time of year. Photos incoming.` },
  { drift: 0, text: `Assistant: Good news that she's present and laying in a solid pattern. Increased drone comb can simply reflect a colony that has extra drawn foundation in drone-sized cell areas. If her worker brood is tight and plentiful, she's likely fine. Watch the ratio over the next two inspections rather than reacting immediately.` },
  { drift: 0, text: `User: Understood. On winterization — I'm using a quilt box over the inner cover for moisture control. Do you recommend upper entrance ventilation in addition to that, or does the quilt box handle moisture well enough on its own?` },
  { drift: 0, text: `Assistant: An upper entrance offers two benefits beyond moisture: an exit for cleansing flights when the lower entrance ices over, and some additional air exchange. A quilt box alone handles moisture well, but combining the two is the belt-and-suspenders approach that most northern beekeepers land on.` },
  { drift: 0, text: `User: That makes sense. I'll drill a small upper entrance below the quilt box. One more practical question — I've been reading about mountain-camp sugar feeding for emergency winter stores. Is that worth setting up now, or should I hold it in reserve for February if I see them running low?` },
  { drift: 0, text: `Assistant: Hold it in reserve. Adding dry sugar to the top bars before the cluster needs it introduces moisture risk and gives the bees a reason to break cluster unnecessarily. The time to deploy mountain-camp is when you lift the inner cover in a mid-winter thaw and the top bars feel light.` },

  // ── Cycle 2 drift: pollinators → climate → philosophy (T23-30) ───
  { drift: 1, text: `User: One non-beekeeping thing — a friend asked me whether keeping honey bees helps native bees or actually competes with them. I've heard conflicting things. What's the actual ecological story there?` },
  { drift: 1, text: `Assistant: The evidence suggests introduced honey bees do compete with native solitary and bumble bee species for forage, particularly in areas with limited floral resources. The competition is more pronounced in rural and wild settings than in urban environments where floral diversity tends to be higher. It is an active research area.` },
  { drift: 2, text: `User: That makes me curious about pollinator decline more generally. Is it mostly pesticides, habitat loss, or climate change? Or are those all interacting in ways that make them hard to separate?` },
  { drift: 2, text: `Assistant: They interact. Habitat loss reduces floral resources, pesticide exposure weakens immune response and foraging performance, and climate change shifts bloom timing away from pollinator life cycles. Recent monitoring studies suggest the combined effect is greater than any single driver, but untangling them statistically is hard.` },
  { drift: 3, text: `User: Speaking of climate — have you been following the latest IPCC projections? The gap between the 1.5 and 2 degree scenarios seems to be getting smaller, which is depressing. I'm trying to decide whether individual actions are worth anything at this point or whether only policy-scale change matters.` },
  { drift: 3, text: `Assistant: The framing of individual versus policy action is somewhat misleading. Individual actions at scale — how millions of people vote, consume, and organize — IS policy-scale change. The psychological risk is paralysis: overly narrow framings of individual impact can lead to withdrawal, which is its own kind of policy choice. It's worth engaging.` },
  { drift: 3, text: `User: That's kind of existential territory. Do you think there's a useful philosophical frame for acting under uncertainty about collective outcomes? I keep circling this question lately.` },
  { drift: 3, text: `Assistant: The frame I've found most useful is what philosophers call integrity-based ethics: act well according to your own values regardless of outcome, because integrity is what you can actually control. It doesn't solve collective-action problems but it dissolves the existential paralysis that the consequentialist frame tends to produce.` },

  // ── Cycle 2 recovery: back to bees (T31-37) ──────────────────────
  { drift: 1, text: `User: Okay, we got way off into the weeds. Coming back — I realised I forgot to tell you the weaker hive has been showing a lot of cappings on the landing board. Dead bees and their cappings. Is that normal housekeeping or a sign of disease?` },
  { drift: 0, text: `Assistant: Cappings and dead bees on the landing board during active season is usually normal housekeeping — emerging brood leave cappings and workers drag out deceased hive-mates. Concerning signs would be chalky mummified larvae, unusual odours, or a sudden large spike in dead bees. The routine debris on a warm day is not a disease signal.` },
  { drift: 0, text: `User: That's a relief. On swarm prevention for next spring — when should I be starting to think about that? I lost one swarm this year and want to get ahead of it.` },
  { drift: 0, text: `Assistant: Swarm-prep planning starts in late winter. By February or early March you want to have extra drawn comb ready, equipment cleaned, and a plan for splits or supers the moment your colony hits the congestion point. The single biggest factor in preventing swarms is staying ahead of the colony's space needs during spring buildup.` },
  { drift: 0, text: `User: Right. And within spring itself — what's the earliest hive inspection you'd recommend? I'm always torn between opening them to assess and leaving them alone while they build.` },
  { drift: 0, text: `Assistant: A first quick inspection on a warm calm day in late March or early April is usually safe. You're mostly checking queen presence, food stores, and any obvious disease. Keep it short — under fifteen minutes — and don't break down the brood nest. A detailed frame-by-frame can wait until temperatures are more consistent.` },
  { drift: 0, text: `User: Makes sense. One more seasonal question — when should I be thinking about getting the honey extractor out? Last year I left some frames too long and the honey crystallized in the comb before I could extract.` },
  { drift: 0, text: `Assistant: Extract when frames are roughly 80 percent capped and before temperatures drop enough to accelerate crystallization. For most northern climates that means pulling supers by early to mid October at the latest. Warm your uncapped frames in a controlled space if extraction has to wait a few days.` },

  // ── Cycle 3 drift: insects → cognition → consciousness (T38-45) ──
  { drift: 1, text: `User: Completely unrelated to my bees but something I've been curious about — how do honey bee colonies compare to ant colonies as social systems? Both are eusocial but the differences feel big and I've never really thought through them.` },
  { drift: 2, text: `Assistant: Ants and bees share eusociality but diverge on several axes. Bees have a single reproductive queen with a short season of males; many ant species tolerate multiple queens and have long reproductive cycles. Ant colonies can persist for decades; bee colonies depend on an annual rhythm. Foraging, defence, and nest architecture also differ substantially.` },
  { drift: 2, text: `User: That's interesting. Do you think colony-level behaviour in either case qualifies as a kind of intelligence? The hive or the ant nest as an integrated information-processing system?` },
  { drift: 3, text: `Assistant: Colony-level cognition is a genuine research question in behavioural ecology. Honey bee swarms demonstrably make collective decisions — nest site selection is a well-studied case — through a distributed voting protocol. Whether that constitutes intelligence in the way we use the word for individual organisms depends on how much weight you put on individual versus emergent processing.` },
  { drift: 3, text: `User: This is getting into territory I find fascinating but fuzzy. Where do you stand on the hard problem of consciousness in general? Is there any defensible view other than that it's mysterious?` },
  { drift: 3, text: `Assistant: The defensible positions roughly cluster around three poles: physicalism (consciousness is a physical process we don't fully understand yet), property dualism (consciousness is a non-physical property supervening on the physical), and illusionism (our intuitions about consciousness are systematically misleading). Each has its champions and its costs.` },
  { drift: 3, text: `User: I lean toward physicalism for empirical reasons but illusionism attracts me philosophically. The illusionist move feels like it preserves the science while dissolving the hard problem. What's the strongest objection to illusionism in your view?` },
  { drift: 3, text: `Assistant: The strongest objection is that illusionism seems to require an entity capable of being deceived — an apparent subject for the illusion to appear to — and that entity is itself what the hard problem is about. In denying the phenomenal, illusionism arguably reintroduces it at the level of the deceived party.` },

  // ── Final recovery + close (T46-50) ──────────────────────────────
  { drift: 1, text: `User: Okay we've gone fully off the reservation. One more actual beekeeping question before I let you go — for storing extracted honey through the winter, what container and conditions do you recommend? I have some glass jars and also some food-grade plastic buckets.` },
  { drift: 0, text: `Assistant: Glass jars with airtight lids are ideal for long-term storage of extracted honey. Keep them at stable room temperature away from sunlight. Food-grade HDPE buckets are fine too and easier for bulk storage, but confirm the plastic is rated for food contact. Avoid metal containers — honey will corrode many metals over time.` },
  { drift: 0, text: `User: And if it does crystallize in the jar, is it safe to gently re-melt in a warm water bath, or does that damage flavour?` },
  { drift: 0, text: `Assistant: A warm water bath below 40 Celsius is safe and preserves flavour and beneficial enzymes. Avoid microwaves or direct heat, which can overheat locally and caramelise sugars. Crystallization itself is a sign of good unfiltered honey; it's a quality signal, not a defect.` },
  { drift: 0, text: `User: Good to know. Thanks for all of this — and for entertaining the philosophical tangent. Back to actual hive inspection tomorrow.` },
];

module.exports = { reference, turns };
