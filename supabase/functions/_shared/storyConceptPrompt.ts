import { STORY_LENGTH } from "./prompts.ts";

export type SummaryFrameworkId =
  | "curiosity_journey"
  | "bedtime_wind_down"
  | "brave_choice"
  | "generous_heart"
  | "silly_escalation";

export type SummaryPatternId =
  | "discovery_trail"
  | "softening_ritual"
  | "hard_but_safe_test"
  | "need_noticed"
  | "escalating_absurd_rule";

export type TitlePatternId =
  | "wonder_object_place"
  | "soft_ritual_goodnight_object"
  | "hard_thing_brave_object"
  | "shared_thing_room_making"
  | "absurd_rule_funny_problem";

export interface StoryConceptPromptCtx {
  childName: string;
  ageBand: string;
  gender?: string;
  language?: string;
  genre?: string;
  mood?: string;
  lesson?: string;
  interestsLine?: string;
  personalityLine?: string;
  heroBehaviorNotes?: string;
  supportingLine?: string;
  supportingBehaviorNotes?: string;
  forbiddenTraitWords?: string;
  specialThing?: string;
  heroQuirk?: string;
  thingsAlreadyGoodAt?: string;
  thingsCurrentlyTricky?: string;
  recentMeaningfulMoment?: string;
  buyerRelationship?: string;
  occasion?: string;
  previousSummary?: string;
  frameworkId?: SummaryFrameworkId;
}

export const STORY_CONCEPT_SYSTEM_PROMPT =
  "You are a senior children's picture book concept editor. Create polished customer-facing picture book concepts from private wizard context. Always call the provided tool to return structured output — never reply in plain text.";

export const SUMMARY_FRAMEWORKS: Record<SummaryFrameworkId, { label: string; shape: string; bestFor: string; avoid: string }> = {
  curiosity_journey: {
    label: "Curiosity Journey",
    shape: "A wonder/discovery story where the child follows one clue into linked discoveries, briefly feels overwhelmed, then returns with a larger sense of the world.",
    bestFor: "curiosity, discovery, nature, animals, learning, exploring, wonder",
    avoid: "real danger, fear, heavy conflict, moral lectures",
  },
  bedtime_wind_down: {
    label: "Bedtime Wind-Down",
    shape: "A soft ritual story where the child's world slowly quiets around familiar beloved things before ending in rest and love.",
    bestFor: "bedtime, comfort, belonging, calm, parent keepsake, rest",
    avoid: "conflict, fast pacing, cliffhangers, high-energy stakes",
  },
  brave_choice: {
    label: "Brave Choice",
    shape: "A courage story where the child faces a hard-but-safe problem and must choose a different kind of bravery.",
    bestFor: "confidence, resilience, trying something hard, anxiety, self-belief, asking for help",
    avoid: "making the challenge something the child has already mastered; adult rescues that remove the child's agency",
  },
  generous_heart: {
    label: "Generous Heart",
    shape: "A connection story where the child notices a need and makes room for someone else in a personally meaningful way.",
    bestFor: "kindness, friendship, empathy, sharing, family love, service",
    avoid: "adult lectures, shame, material rewards for generosity",
  },
  silly_escalation: {
    label: "Silly Escalation",
    shape: "A comedy story where one tiny absurd premise escalates until a simple reversal or snap ending.",
    bestFor: "funny books, animals, vehicles, dinosaurs, chaotic interests, read-aloud silliness",
    avoid: "moralizing, big emotional lessons, slow reflective pacing",
  },
};

export const SUMMARY_PATTERNS: Record<SummaryFrameworkId, { id: SummaryPatternId; name: string; internalShape: string; rules: string[] }> = {
  curiosity_journey: {
    id: "discovery_trail",
    name: "The Discovery Trail",
    internalShape: "Private structure: one clue or possibility opens into a larger discovery; the discovery becomes too much or reveals a need; the child responds by noticing, understanding, or acting differently.",
    rules: ["Use one discovery object, place, or clue.", "Do not list all interests.", "Do not say 'goes on a magical journey.'", "The visible summary should imply wonder, overwhelm, and deeper understanding without naming the arc."],
  },
  bedtime_wind_down: {
    id: "softening_ritual",
    name: "The Softening Ritual",
    internalShape: "Private structure: the day or world quiets through familiar sensory details; one worry or unfinished feeling remains; each step brings the child closer to comfort, belonging, or rest.",
    rules: ["No big conflict.", "No fast chase.", "No 'must save the day.'", "Use light, sound, softness, warmth, or breath.", "Do not over-explain the feeling."],
  },
  brave_choice: {
    id: "hard_but_safe_test",
    name: "The Hard-But-Safe Test",
    internalShape: "Private structure: something important goes wrong; the child first uses what feels familiar; that is not enough; the child must choose a different kind of courage through action.",
    rules: ["Use one challenge.", "The challenge must not be something the child is already good at.", "Do not say 'learns to be brave.'", "Show the brave choice through the situation."],
  },
  generous_heart: {
    id: "need_noticed",
    name: "The Need Noticed",
    internalShape: "Private structure: the child wants or holds something personally important; someone else has a need; helping costs attention, control, spotlight, comfort, or time; the choice opens room for belonging.",
    rules: ["Do not moralize.", "Do not say 'learns kindness.'", "The child should give, make room, help, invite, listen, or include.", "Keep it specific and concrete."],
  },
  silly_escalation: {
    id: "escalating_absurd_rule",
    name: "The Escalating Absurd Rule",
    internalShape: "Private structure: one funny plan, object, or rule goes wrong; one or two attempted fixes make it worse; the ending comes from a simple reversal or unexpected practical choice.",
    rules: ["Use one absurd premise.", "No moral explanation in the summary.", "No interest pileup.", "Do not reveal every gag.", "Include at most two escalation beats in the visible summary."],
  },
};

export const TITLE_PATTERNS: Record<SummaryFrameworkId, { id: TitlePatternId; name: string; shapes: string[]; examples: string[]; avoid: string[] }> = {
  curiosity_journey: {
    id: "wonder_object_place",
    name: "The Wonder Object / Wonder Place",
    shapes: ["The [Mysterious/Quiet/Hidden] [Object]", "Where the [Strange Thing] [Does Something]", "The [Place] Beyond the [Place/Object]", "The [Object] That [Unexpected Action]"],
    examples: ["The Lantern in the Grass", "Where the Hoofprints Glowed", "The Door Beneath the Willow", "The Map That Hummed"],
    avoid: ["Aria’s Magical Forest Adventure", "A Curious Journey with Horses and Flowers"],
  },
  bedtime_wind_down: {
    id: "soft_ritual_goodnight_object",
    name: "The Soft Ritual / Goodnight Object",
    shapes: ["Goodnight, [Specific Object/Place]", "The [Soft/Quiet/Little] [Object]", "When the [Place] Went Quiet", "The Last [Sound/Light/Step]"],
    examples: ["Goodnight, Skateboard", "The Last Little Bounce", "When the Room Grew Quiet", "The Guitar’s Sleepy Song"],
    avoid: ["Corey’s Cozy Bedtime Adventure", "The Calm and Wonderful Night"],
  },
  brave_choice: {
    id: "hard_thing_brave_object",
    name: "The Hard Thing / Brave Object",
    shapes: ["The [Object] Beyond the [Barrier]", "The [Thing] That Wouldn’t [Action]", "One [Small/Big] [Choice]", "The [Object] at the Edge"],
    examples: ["The Sketchbook Beyond the Fence", "The Bridge That Wobbled", "One More Step Back", "The Hill Aria Couldn’t Climb Alone"],
    avoid: ["Aria Learns to Be Brave", "A Story About Confidence"],
  },
  generous_heart: {
    id: "shared_thing_room_making",
    name: "The Shared Thing / The Room-Making Title",
    shapes: ["Room for [Someone/Something]", "The [Object] We Shared", "The [Gift/Seat/Spot] for [Someone]", "One [Object] for Two"],
    examples: ["Room on the Rocket", "The Last Seat on the Sled", "One Goal for Two", "The Hat We Found"],
    avoid: ["Corey Learns Friendship", "The Warm Creative Friend", "A Kindness Adventure"],
  },
  silly_escalation: {
    id: "absurd_rule_funny_problem",
    name: "The Absurd Rule / Funny Problem",
    shapes: ["Don’t Let the [Character/Object] [Action]", "If You Give a [Character] a [Object]", "The [Object] That Wouldn’t [Action]", "[Funny Creature/Object] Love [Unexpected Thing]"],
    examples: ["Don’t Let the Robot Fish", "The Ball That Wouldn’t Score", "If You Give a Machine a Mission", "The Day the Goal Ran Away"],
    avoid: ["Strum, Skate, and a Silly Goal", "Corey’s Funny Soccer Skateboard Guitar Day", "The Skatepark Fishing Machine"],
  },
};

export const SUMMARY_EXAMPLES_BY_FRAMEWORK: Record<SummaryFrameworkId, { good: Array<{ title: string; summary: string }>; badPhrases: string[] }> = {
  curiosity_journey: {
    good: [
      { title: "The Lantern in the Grass", summary: "When Nora finds a tiny lantern blinking in the tall grass, every glow leads to another question. The trail slips under roots, past sleeping beetles, and toward a place no one in the garden has noticed before. But when the light begins to fade, Nora has to stop chasing answers long enough to see who has been trying to guide her home." },
      { title: "Where the Hoofprints Glowed", summary: "A line of silver hoofprints appears beside Mateo’s fence just after sunset. He follows them from the muddy path to the quiet edge of the woods, where each print reveals something stranger than the last. When the trail suddenly splits, Mateo must choose whether to rush ahead or listen to the clues already under his feet." },
    ],
    badPhrases: ["magical journey", "adventure of discovery", "learns the power of curiosity"],
  },
  bedtime_wind_down: {
    good: [
      { title: "The Last Little Bounce", summary: "As the house grows quiet, Lila’s ball still has one bounce left. It bumps past the slippers, taps the blanket chest, and rolls under the moonlit chair while Lila follows in smaller and smaller steps. By the time the ball settles beside her bed, the room has remembered how to be still." },
      { title: "Goodnight, Little Train", summary: "At bedtime, Jonah’s toy train makes one last trip around the rug. It says goodnight to the blocks, the bear, the blue socks by the door, and the shadow on the wall. Each slow circle carries the day a little farther away, until the train is ready for its station and Jonah is ready for sleep." },
    ],
    badPhrases: ["learns to calm down", "cozy bedtime adventure", "discovers rest"],
  },
  brave_choice: {
    good: [
      { title: "The Bridge That Wobbled", summary: "Maya can race across logs, climb the tall rocks, and jump farther than anyone in the yard. But the little bridge behind the barn wobbles in a way that makes her feet forget what to do. When her kite lands on the far side, Maya has to try a braver thing than running fast: telling someone she is stuck." },
      { title: "One More Step Back", summary: "Eli knows exactly how to build the tower taller, until the blocks begin to lean toward his baby sister’s favorite bear. He wants to grab, stack, and fix it before anyone notices. Instead, Eli has to step back, breathe, and ask for the one kind of help that might save both the tower and the bear." },
    ],
    badPhrases: ["learns to be brave", "a story about confidence", "discovers his courage"],
  },
  generous_heart: {
    good: [
      { title: "Room on the Rocket", summary: "Sam builds a rocket with one perfect seat and one perfect countdown. Then Ava arrives with a moon map, a snack bag, and a problem: her own rocket has no wings. Making room means changing the buttons, sharing the captain’s spot, and letting the mission look different than planned." },
      { title: "One Goal for Two", summary: "Tessa has saved the best kick for the last minute of the game. But when Max’s shoe comes untied and the ball rolls his way, she sees a chance that is not just hers anymore. Passing might cost her big moment, but it could make space for a better one." },
    ],
    badPhrases: ["learns kindness", "friendship is the best", "discovers the joy of sharing"],
  },
  silly_escalation: {
    good: [
      { title: "The Robot That Wouldn’t Stop", summary: "When Milo builds a tiny robot to carry one cookie across the kitchen, it decides every cookie in the house needs delivering. Soon crackers, carrots, and couch pillows are riding along too. Milo tries buttons, baskets, and bargaining, but the parade only grows — until he notices the robot has been waiting for someone to say please." },
      { title: "Don’t Let the Goat Paint", summary: "Nora gives the goat one little brush, just to help with the fence. But the goat has bigger ideas. First the fence turns purple, then the porch gets stripes, and soon the chickens are wearing dots. Nora races to clean it up before Grandma sees, but the mess might be the thing that makes the yard feel finished." },
    ],
    badPhrases: ["bigger, stranger, or funnier", "final unexpected choice", "twist or reversal", "the only way out", "works for about three seconds"],
  },
};

export function summaryPatternForFramework(id: SummaryFrameworkId) { return SUMMARY_PATTERNS[id]; }
export function titlePatternForFramework(id: SummaryFrameworkId) { return TITLE_PATTERNS[id]; }

function includesAny(haystack: string, needles: string[]): boolean {
  const h = haystack.toLowerCase();
  return needles.some((n) => h.includes(n));
}

export function selectSummaryFramework(ctx: StoryConceptPromptCtx): SummaryFrameworkId {
  const combined = [ctx.genre, ctx.mood, ctx.lesson, ctx.interestsLine, ctx.personalityLine, ctx.thingsCurrentlyTricky]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (includesAny(combined, ["bedtime", "sleep", "calm", "wind down", "rest"])) return "bedtime_wind_down";
  if (includesAny(combined, ["funny", "silly", "goofy", "playful", "humor", "comedy", "joke", "chaos", "ridiculous", "robot", "robots", "machine", "dinosaur", "vehicle"])) return "silly_escalation";
  if (includesAny(combined, ["confidence", "self-confidence", "brave", "courage", "resilience", "anxiety", "trying", "hard", "ask for help", "asking for help", "apologizing", "apologize"])) return "brave_choice";
  if (includesAny(combined, ["kind", "kindness", "share", "sharing", "generous", "empathy", "friendship", "making friends", "helping others", "belonging"])) return "generous_heart";
  return "curiosity_journey";
}

export function STORY_CONCEPT_USER_TEMPLATE(ctx: StoryConceptPromptCtx): string {
  const frameworkId = ctx.frameworkId || selectSummaryFramework(ctx);
  const fw = SUMMARY_FRAMEWORKS[frameworkId];
  const summaryPattern = summaryPatternForFramework(frameworkId);
  const titlePattern = titlePatternForFramework(frameworkId);
  const examples = SUMMARY_EXAMPLES_BY_FRAMEWORK[frameworkId];
  const langLabel = (ctx.language || "").trim().toLowerCase();
  const langLine = langLabel && langLabel !== "english"
    ? `Write the title and user_visible_summary in ${ctx.language}. Keep internal planning fields in English unless impossible.`
    : "";

  return [
    `Create ONE personalized children's picture book concept from the inputs below.`,
    ``,
    `# Editorial style guide`,
    `This is a complete plot synopsis of the picture book from beginning to end. Describe the setup, the inciting moment, the main attempts or escalations, the climactic choice, and how the story resolves emotionally. Do not withhold the ending. It should read like a full plot summary, not a back-cover teaser.`,
    `Aim for 4–7 concrete story beats woven into flowing prose (not a bulleted list).`,
    `Do not prove every input was used. Most inputs are private background context.`,
    `The framework and pattern are invisible scaffolding. Never copy, quote, paraphrase, or expose the pattern wording in user_visible_summary.`,
    ``,
    `# Selected framework`,
    `Framework ID: ${frameworkId}`,
    `Framework name: ${fw.label}`,
    `Hidden shape: ${fw.shape}`,
    `Best for: ${fw.bestFor}`,
    `Avoid: ${fw.avoid}`,
    ``,
    `# Selected summary pattern`,
    `summary_pattern: ${summaryPattern.id}`,
    `Pattern name: ${summaryPattern.name}`,
    `Invisible structure only: ${summaryPattern.internalShape}`,
    `Rules:\n- ${summaryPattern.rules.join("\n- ")}`,
    ``,
    `# Selected title pattern`,
    `title_pattern: ${titlePattern.id}`,
    `Use one of these exact title shapes, adapted naturally to the story:`,
    ...titlePattern.shapes.map((shape) => `- ${shape}`),
    `Good title direction: ${titlePattern.examples.join("; ")}`,
    `Avoid this kind of title: ${titlePattern.avoid.join("; ")}`,
    ``,
    `# Examples for this selected framework only`,
    `Treat the example summaries below as TONE and VOICE references only. Your output should be longer than these examples and must cover the full arc including the ending — the examples are intentionally short teasers and yours should not be.`,
    ...examples.good.flatMap((ex, i) => [`Example ${i + 1} title: ${ex.title}`, `Example ${i + 1} summary (tone reference only, not length reference): ${ex.summary}`]),
    `Do NOT use these phrases or close paraphrases: ${examples.badPhrases.join("; ")}.`,
    ``,
    `# Private wizard context`,
    `Child name: ${ctx.childName}`,
    `Age band: ${ctx.ageBand}`,
    ctx.gender ? `Gender/pronouns: ${ctx.gender}` : "",
    ctx.heroQuirk ? `Appearance/signature detail: ${ctx.heroQuirk}` : "",
    ctx.genre ? `Genre: ${ctx.genre}` : "",
    ctx.mood ? `Mood: ${ctx.mood}` : "",
    ctx.lesson ? `Lesson/theme: ${ctx.lesson}` : "",
    ctx.interestsLine ? `Interests available as optional texture. Pick ONE primary interest/object/problem. A second may appear only as light background texture, never in the title: ${ctx.interestsLine}` : "",
    ctx.thingsAlreadyGoodAt ? `Things already good at, do not make this the weakness: ${ctx.thingsAlreadyGoodAt}` : "",
    ctx.thingsCurrentlyTricky ? `Things currently tricky, good source for the emotional choice: ${ctx.thingsCurrentlyTricky}` : "",
    ctx.recentMeaningfulMoment ? `Recent meaningful moment: ${ctx.recentMeaningfulMoment}` : "",
    ctx.supportingLine ? `Supporting characters available if they strengthen the premise. Do not repeat their adjectives in visible text: ${ctx.supportingLine}` : "Supporting characters: none provided",
    ctx.specialThing ? `Companion/object/pet/toy available if it strengthens the premise: ${ctx.specialThing}` : "",
    ctx.heroBehaviorNotes || ctx.personalityLine
      ? (ctx.heroBehaviorNotes || `Hero behavior notes:\nUse these only to decide actions. Do not repeat these words in the visible summary: ${ctx.personalityLine}`)
      : "Hero behavior notes: none provided",
    ctx.supportingBehaviorNotes || "Supporting character behavior notes: none provided",
    ctx.forbiddenTraitWords ? `Forbidden visible trait words: ${ctx.forbiddenTraitWords}.` : "",
    ctx.buyerRelationship ? `Buyer relationship: ${ctx.buyerRelationship}` : "",
    ctx.occasion ? `Occasion: ${ctx.occasion}` : "",
    langLine,
    ``,
    `# Title rules`,
    `Use 2–7 words unless the exact comedy shape needs a few more words.`,
    `Do not use the child's name (${ctx.childName}).`,
    `Do not use personality traits.`,
    `Do not list multiple hobbies/interests.`,
    `Use at most one personalized object, place, creature, or problem.`,
    `Prefer concrete nouns over abstract values.`,
    `Avoid words like adventure, journey, magical, wonderful, special, brave, confidence, friendship, kindness unless explicitly provided by the user and unavoidable.`,
    ``,
    `# Visible summary rules`,
    `Write one flowing paragraph, ${STORY_LENGTH.min}–${STORY_LENGTH.max} words, target ~${STORY_LENGTH.target}.`,
    `Use ${ctx.childName}'s name in the summary.`,
    `Pick ONE clear story engine and follow it from start to finish.`,
    `Use ONE user-provided interest as the main concrete story element. Use a second only if it is background texture.`,
    `Cover the full arc: include the ending and the emotional resolution. Do not stop on a cliffhanger or rhetorical question.`,
    `Include 4–7 concrete story beats so the reader knows what actually happens.`,
    `Do not directly list personality adjectives from the wizard or obvious synonyms like unstoppable, joyful, warm, gentle, creative, goofy, or silly.`,
    `Do not describe supporting characters with adjectives. Give them a story job.`,
    `Do not open with '${ctx.childName} is a...' or '${ctx.childName} was a...'.`,
    `Do not use a list title or list summary.`,
    `You may describe what changes for ${ctx.childName} by the end, but show it through the events rather than a stated moral or lecture.`,
    `Do not include text that would need to appear inside illustrations, such as labels, signs, button text, all-caps words, or written commands.`,
    `Never use these formula-leak phrases: invisible structure; works for about three seconds.`,
    ``,
    `# Recurring verbal motif`,
    `Plan a recurring verbal motif for the full book. This may be a repeated phrase, repeated question, recurring sound, sensory image, or sentence pattern. Store it in story_seed.recurring_motif, not necessarily in the visible summary.`,
    ``,
    `# Structured output requirements`,
    `- framework_id must be exactly ${frameworkId}.`,
    `- summary_pattern must be exactly ${summaryPattern.id}.`,
    `- title_pattern must be exactly ${titlePattern.id}.`,
    `- title must follow one of the exact title shapes listed above.`,
    `- user_visible_summary must be polished customer-facing copy and must not leak pattern language.`,
    `- story_seed: give the full book engine a clear core_conflict, emotional_arc, visual_world, recurring_motif, ending_feeling, and 5–8 image_opportunities.`,
    `- personalization_notes: explain how personality becomes action, which single interest was used in the visible summary, which details were intentionally saved for the full book, and what NOT to make the obstacle if it would feel inauthentic.`,
    `- full_book_instruction: 2–4 sentences telling the later full-book engine how to expand this concept into a 30-page picture book, including tone, pacing, emotional direction, summary pattern, title pattern, and motif usage guidance.`,
    ``,
    ctx.previousSummary
      ? `# Previous attempt to avoid\nWrite something distinctly different. Do not repeat the setting, twist, title pattern, or opening line.\nPrevious summary:\n${ctx.previousSummary}`
      : "",
  ].filter(Boolean).join("\n");
}
