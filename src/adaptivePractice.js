const PASSAGES = [
  'Ava put a tiny hat on the office plant. After lunch, someone asked whether it was the new manager.',
  'Ask Alex to bring the cake. Apparently, the last cake arrived on a bicycle with its own helmet.',
  'Ben bought a bell for his bike. Before the first ride, his cat stole it and announced dinner.',
  'Bring Bella a clean cup. Breakfast is delayed because the kettle has become a flower vase.',
  'Call Clara when the train arrives. Clara will be holding a sign that says, "Probably this way."',
  'Cody checked the cupboard for coffee. Clearly, someone had filed the beans under office supplies.',
  'Dina found a duck beside her desk. During the meeting, it voted against every proposal.',
  'Drew opened the wrong lunch box. Dinner was now a very small collection of colored pencils.',
  'Eli wrote a note for the delivery driver. Everyone read it except the driver, who followed the cat.',
  'Emma booked a quiet table by the window. Even the waiter whispered when he brought the menu.',
  'Finn fixed the squeaky gate with a little oil. For the first time, the dog had to announce visitors himself.',
  'Follow Flora through the garden. Flowers are her specialty, but she still calls every bee Steve.',
  'Grace gave the robot a simple job. Getting the toast became a full inspection of the kitchen.',
  'Go with Gus to the market. Grapes are on the list, and so is a hat for his snowman.',
  'Hana heard a tap at the window. Her neighbor wanted to borrow a ladder and return a kite.',
  'Help Hugo find the missing sock. He has already questioned the washing machine twice.',
  'Iris invited us to a picnic. Inside the basket was a pie, a blanket, and a very surprised kitten.',
  'I told the printer to make one copy. It printed a second copy of my complaint instead.',
  'June joined the queue for fresh juice. Just before her turn, the oranges went on a lunch break.',
  'Jasper placed a jar of jelly on the shelf. Joy was brief when he discovered that it was empty.',
  'Kai kept a notebook beside the kettle. Keeping track of tea had become his most successful hobby.',
  'Knock before entering the workshop. Kim is teaching a toy dragon to deliver the mail.',
  'Lena left a letter by the lamp. Later, the dog delivered it to the person who had written it.',
  'Look for Leo near the library. Lost books seem to find him before he finds his glasses.',
  'Maya made a map of the museum. Most visitors followed it straight to the sandwich counter.',
  'Meet Milo at the station. Monday is his day to wave at trains and pretend they remember him.',
  'Nora needed a new umbrella. Nobody expected her to choose one large enough for the whole bus stop.',
  'Next to the bakery, Nico opened a shop. Nothing was for sale until he found the key to the till.',
  'Omar ordered a bowl of soup. One spoonful later, he asked whether the chef could share the recipe.',
  'Open the blue box carefully. Olive has packed a birthday cake and a very enthusiastic spring.',
  'Pia painted a picture of her porch. Proud of the result, she hung it on the actual porch.',
  'Please pass Peter the salt. Putting it beside the sugar was an ambitious choice for breakfast.',
  'Quinn queued for the quiz at the quiet cafe. Quite unexpectedly, the first question was about quails.',
  'Quickly ask Quentin for a spare quilt. Quiet reading is easier when your knees are warm.',
  'Ravi repaired the radio before lunch. Right away, it announced that lunch had been postponed.',
  'Read Rosa the last line of the recipe. Remember to mention that the cake needs to leave the oven.',
  'Sam sent a postcard from the seaside. Somehow, the postcard arrived before Sam reached the beach.',
  'Save a seat for Sara near the stage. She has promised to clap even if the magician loses the rabbit.',
  'Theo took a thermos on the train. The ticket inspector checked it and declared the tea excellent.',
  'Turn the page when Tessa gives the signal. Today, the book club is trying a very slow dramatic reading.',
  'Uma unpacked the picnic basket. Under the sandwiches, she found the invitation to a different picnic.',
  'Use the spare chair by the window. Until the cat moves, it is the only seat available.',
  'Vera visited the village bakery. Very politely, she asked why every loaf was shaped like a duck.',
  'Vik brought a violin to the party. Visitors quickly learned that he had only mastered the doorbell sound.',
  'Wren wrote a welcome sign for the shop. When it blew away, the neighbors welcomed it into their garden.',
  'Wait for Will beside the fountain. With any luck, he will remember that we agreed to meet here.',
  'Xavier examined the extra box by the exit. Xavier expected tools, but it contained six toy foxes.',
  'Xena fixed the xylophone before the concert. Xena then had to explain why it sounded like a bicycle bell.',
  'Yara left yellow yarn beside the sofa. Yesterday, it was a scarf; today, the cat calls it a nest.',
  'You can ask Yuri for directions. Yuri knows every road, especially the ones that lead to lunch.',
  'Zoe zipped her coat and headed for the zoo. Zebras were easy to find; her lost ticket was not.',
  'Zara brought a pizza to the jazz rehearsal. Zara insisted that a slice was the correct size of a musical rest.',
  '"Is this your hat?" asked the waiter. "Yes!" said the duck. "The bread belongs to my accountant."',
  '"Can we start?" asked the chef. "Wait!" replied the spoon. "Nobody has introduced the soup."',
  "Don't worry about the rain. We're bringing umbrellas, and there's enough tea for everyone.",
  "I've packed the sandwiches, but we can't leave yet. Someone's put the picnic map inside the cake tin.",
  'The list was simple: milk, bread, and apples. We bought the milk; the apples required a second trip.',
  'The sign read: please ring the bell. We rang it twice; a sleepy dog came to answer the door.',
  'Our train leaves at 09:45 from platform 6. Tickets for seats 1, 2, 3, 7, and 8 cost $50 in total.',
  'The bakery opens at 07:30 and closes at 18:45. Order 2 cakes and 6 rolls, then collect the $9 change.',
  'The spare key is in the blue box (under the bench). Leave a note saying yes/no so we know you found it.',
  'Bring the red folder (the small one) to the desk. The delivery form needs a name and an arrival/departure time.',
  'The well-dressed duck checked in at noon. It requested a lake-view room and a late checkout.',
  'The map described a five-minute walk. Our guide added a ten-minute stop to greet every dog.',
  'Send the invitation to hello@example.com. Use the subject "Cake & coffee" so we know to bring cups.',
  'Contact tea@cafe.test for a table. The sign outside says "Books & biscuits," which sounds like a good afternoon.',
  'Room #4 has a sign offering 20% off lunch. The chef insists that the discount applies to soup, not spoons.',
  'Ticket #9 won a basket of bread. The winner said he was 100% ready to share it with his neighbors.',
  'The recipe says 2 + 2 = 4 cups of flour. Our cook checked the sum and forgot to buy the flour.',
  'The note said 5 + 1 = 6 guests. We counted the chairs again when a dog arrived with an invitation.',
  'Write [done] beside the finished task. The board still says [waiting] beside the office plant promotion.',
  'Choose [small] or [large] on the order form. The duck selected [large] and asked whether it included a pond.',
  'The sample file contains {name: "Ava"}. Replace the braces and the name only after saving a copy.',
  'Our practice code reads {cups: 2}. The kitchen has {spoons: 0}, which may explain the delay.',
  'Name the draft picnic_notes.txt and save it in plans\\summer. A clear filename makes the next picnic easier.',
  'Keep the list in shop_notes.txt inside notes\\today. The cat has already added a second bag of treats.',
  'The sign says 2 < 3 and 4 > 1. Our class agrees, although the hamster seems to prefer the chalk.',
  'Compare 5 < 8 with 9 > 6 on the board. Even a small example can help explain a new symbol.',
  'The keyboard label shows A | B beside the switch. Choose one option, then press the * key to continue.',
  'Mark each choice with yes | no in your notes. An * beside a name means that guest wants extra cake.',
  'Put a ^ above the missing word in the draft. The editor estimated ~10 minutes to finish the page.',
  'Use ^ to mark the new line on the sketch. The sign should be ~20 inches wide, or the duck will complain.',
  'The example wraps `hello` in backticks. Copy the word carefully, then close the notebook for a short break.',
  'The label on the box reads `spare keys`. Check both backticks before asking the printer for another copy.',
];

export function recommendedKeys(stats = {}, limit = 3) {
  if (!stats || typeof stats !== 'object') return [];
  const count = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 3;
  return Object.entries(stats)
    .filter(([key, value]) => /^[\x21-\x7e]$/.test(key)
      && value && Number.isInteger(value.attempts) && value.attempts >= 4
      && Number.isInteger(value.errors) && value.errors >= 2 && value.errors <= value.attempts
      && value.errors / value.attempts >= 0.1)
    .sort((a, b) => (b[1].errors / b[1].attempts) - (a[1].errors / a[1].attempts)
      || b[1].errors - a[1].errors || a[0].localeCompare(b[0]))
    .slice(0, count)
    .map(([key, value]) => ({ key, attempts: value.attempts, errors: value.errors }));
}

export function getPracticeRecommendation(stats = {}, limit = 3) {
  const keys = recommendedKeys(stats, limit);
  if (!keys.length) return null;
  const labels = keys.map(({ key }) => /^[A-Z]$/.test(key) ? `capital ${key}` : key).join(', ');
  return { keys, title: 'A little focused practice', description: `Practice ${labels} in short passages drawn from your typing results.` };
}

export function generateWeakPractice(stats = {}, random = Math.random, previousText = '') {
  const keys = recommendedKeys(stats).map(({ key }) => key);
  const remaining = new Set(keys);
  const selected = [];
  const pick = options => {
    const value = Number(random());
    const fraction = Number.isFinite(value) ? Math.max(0, Math.min(1 - Number.EPSILON, value)) : 0;
    return options[Math.floor(fraction * options.length)];
  };
  // Each scene stays intact. Add another only when an exact target character is missing.
  do {
    const score = passage => [...remaining].filter(key => passage.includes(key)).length;
    const available = (keys.length ? PASSAGES : PASSAGES.slice(0, 52)).filter(passage => !selected.includes(passage));
    const fresh = available.filter(passage => typeof previousText !== 'string' || !previousText.includes(passage));
    // A new scene may cover fewer targets, but remaining targets can use another scene.
    // Fall back only if every scene for a remaining character was already shown.
    const candidates = fresh.some(passage => score(passage) > 0) || (!keys.length && fresh.length) ? fresh : available;
    const bestScore = Math.max(...candidates.map(score));
    const options = keys.length ? candidates.filter(passage => score(passage) === bestScore) : candidates;
    const passage = pick(options);
    selected.push(passage);
    for (const key of remaining) if (passage.includes(key)) remaining.delete(key);
    if (!bestScore) break;
  } while (remaining.size && selected.length < keys.length);
  return selected.join(' ');
}
