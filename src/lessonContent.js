export const LESSON_CONTENT = {
  'find-home': {
    practiceRounds: [
      {
        title: 'Find home', keys: 'A S D F J K L',
        instruction: 'Find the bumps on F and J with your index fingers. Rest your other left fingers on A S D and your other right fingers on K L and semicolon. Use either thumb for spaces.',
        fingers: ['F · left index', 'J · right index', 'Space · either thumb'],
        passages: ['a lad asks', 'dad adds a salad', 'a flask falls', 'a sad lad'],
      },
      {
        title: 'Add E, R and T', keys: 'E R T + home row',
        instruction: 'Reach up to E with your left middle finger. Use your left index for R and T, then return to F. These three letters let you type more everyday words.',
        fingers: ['E · left middle', 'R T · left index', 'Return to home after a reach'],
        passages: ['take a seat', 'read a letter', 'tea tastes tart', 'start after tea'],
      },
      {
        title: 'Add I, O and N', keys: 'I O N + familiar keys',
        instruction: 'Use your right middle finger for I and right ring for O. Your right index reaches down to N. Return to home between reaches.',
        fingers: ['I · right middle', 'O · right ring', 'N · right index'],
        passages: ['read a note', 'rain falls on slate', 'take a train east', 'listen for a train'],
      },
    ],
    testVariants: [
      'read a note and take a seat',
      'rain falls on a red roof',
      'listen for a train at nine',
      'start a fire and toast a roll',
      'add oil and salt to a salad',
      'sit on a seat and rest a little',
      'take a red kite to a field',
      'sort letters at a desk after tea',
    ],
  },
  'home-row': {
    practiceRounds: [
      {
        title: 'At the table', keys: 'Home row + E R T I O N',
        passages: ['toast and tea for one', 'add a little oil', 'salt for a salad', 'a tin of oats for tea'],
      },
      {
        title: 'Step outside', keys: 'Home row + E R T I O N',
        passages: ['rain rattles on a roof', 'a red leaf floats', 'a tree stands near a lake', 'stars rise after dark'],
      },
      {
        title: 'Everyday tasks', keys: 'Home row + E R T I O N',
        passages: ['send a letter to a friend', 'a tailor ties a silk tie', 'a tired artist takes a rest', 'listen to a radio at noon'],
      },
    ],
    testVariants: [
      'an artist rests near a lake as rain falls',
      'a little rain falls as a train rolls east',
      'set a tin of oats on a red stool',
      'a tailor folds a red silk dress',
      'an old radio still rattles after a fall',
      'a friend sends a letter and a list of ideas',
      'take a little rest after a late train ride',
      'a red kite floats near a tall tree',
    ],
  },
  'center-reach': {
    practiceRounds: [
      {
        title: 'Reach for G', keys: 'G + familiar keys',
        passages: ['a dog rests on a log', 'green grass after rain', 'a frog sits near a log', 'a singer learns a song'],
      },
      {
        title: 'Reach for H', keys: 'G H + familiar keys',
        passages: ['hang a hat in the hall', 'share the last roll', 'a light shines in the fog', 'the fish hides near a stone'],
      },
      {
        title: 'Short scenes', keys: 'G H + familiar keys',
        passages: ['the gardener digs in the soil', 'three friends gather at the gate', 'the dog hears a distant horn', 'she gathers shells at the shore'],
      },
    ],
    testVariants: [
      'the gardener hangs a hat on the garden gate',
      'a little frog hides in the grass near the lake',
      'the dog digs a hole and then rests in the shade',
      'three friends share hot tea after a long ride',
      'a light shines on the road as the fog rolls in',
      'she hears a song on the radio and sings along',
      'the tide rises as a heron stands on the shore',
      'gather the red roses and set the glass on the shelf',
    ],
  },
  'top-row': {
    practiceRounds: [
      {
        title: 'W, Y and U', keys: 'W Y U + familiar keys',
        passages: ['your tea is ready', 'we walk through the tall grass', 'the yellow kite flies high', 'a gull rests under a tree'],
      },
      {
        title: 'Q and P', keys: 'Q P + familiar keys',
        passages: ['please keep the hall quiet', 'quiet water fills the pool', 'we share a plate of pasta', 'put the paper on the desk'],
      },
      {
        title: 'Put the top row to work', keys: 'Q W E R T Y U I O P',
        passages: ['the early train waits at the station', 'a photographer waits for the right light', 'we follow a narrow path through the trees', 'your sister writes a story for us'],
      },
    ],
    testVariants: [
      'we take a quiet walk through the park after dinner',
      'your yellow kite floats high while the wind stays steady',
      'please set the paper and the pen on the little desk',
      'the waiter pours hot tea while we study the route',
      'a squirrel hides its food under the roots of a tree',
      'she writes a short story while the rest of us sleep',
      'the photographer waits patiently for the first light',
      'we sit together and listen to the rain on the roof',
    ],
  },
  'bottom-row': {
    practiceRounds: [
      {
        title: 'C, V and B', keys: 'C V B + familiar keys',
        passages: ['the bus arrives at five', 'carry a basket of vegetables', 'a bicycle bell rings twice', 'the blue cover fits the chair'],
      },
      {
        title: 'M, Z and X', keys: 'M Z X + familiar keys',
        passages: ['mix the cake in a big bowl', 'a lazy cat naps by the box', 'my favorite puzzle is missing a piece', 'six zebras graze in the morning'],
      },
      {
        title: 'Use the whole alphabet', keys: 'A to Z',
        passages: ['pack a sandwich for the mountain walk', 'the next bus stops beside the museum', 'a small breeze moves the kitchen curtains', 'my neighbor grows tomatoes in a wooden box'],
      },
    ],
    testVariants: [
      'the next bus arrives in six minutes near the museum',
      'we mix flour and milk before adding a small spoon of sugar',
      'my bicycle has a blue basket and a bright silver bell',
      'a sleepy fox curls up beside a box in the warm barn',
      'pack some fruit and a sandwich before we climb the hill',
      'the musicians carry their instruments across the busy square',
      'our neighbor brings a basket of tomatoes from her garden',
      'leave the puzzle on the table and find the missing corner',
    ],
  },
  capitals: {
    practiceRounds: [
      {
        title: 'Names', keys: 'Shift + names',
        passages: ['Mia and Ben visit Lake Park', 'Ravi lends Ana a book', 'June meets Oliver after work', 'Zoe and Kim paint the fence'],
      },
      {
        title: 'Places and days', keys: 'Shift + places and days',
        passages: ['Take the Blue Line on Friday', 'We leave for Manila in June', 'Visit Oak Street on Saturday', 'Our train reaches York on Monday'],
      },
      {
        title: 'Start a sentence', keys: 'Shift + sentence starts',
        passages: ['After lunch we walk along the river', 'Every morning the bakery opens early', 'Please leave your shoes beside the door', 'Tomorrow we will finish the garden path'],
      },
    ],
    testVariants: [
      'On Monday Mia and Ben take the Blue Line to West Park',
      'Ravi meets Ana at the library before their trip to Manila',
      'June and Oliver bring fresh bread to the picnic on Saturday',
      'Zoe calls Kim after her train reaches York on Friday',
      'Every August our family visits Lake Park for a long walk',
      'Please give this note to Sam before the shop closes',
      'The Oak Street bakery sells warm rolls every Sunday',
      'Tomorrow I will help Maya plant beans in her new garden',
    ],
  },
  numbers: {
    practiceRounds: [
      {
        title: 'Small quantities', keys: '1 2 3 4 5',
        passages: ['Buy 4 apples and 5 pears', 'Set 3 cups beside 2 plates', 'Room 12 is ready for guests', 'Plant 15 seeds in the soil'],
      },
      {
        title: 'Longer reaches', keys: '6 7 8 9 0',
        passages: ['Bus 78 leaves at 9', 'The box holds 60 pencils', 'Meet us at gate 7', 'We walked 800 steps before breakfast'],
      },
      {
        title: 'Numbers in daily life', keys: '1 2 3 4 5 6 7 8 9 0',
        passages: ['Order 204 has 6 items', 'Read pages 18 to 29 tonight', 'The train takes 35 minutes', 'We need 10 chairs for 8 guests'],
      },
    ],
    testVariants: [
      'Order 12345 has 6 items and costs 78 dollars plus 90 cents',
      'Room 204 has 3 chairs and 5 cups for our guests',
      'Take bus 89 to gate 10 and meet 2 friends at 7',
      'Read pages 36 to 48 and bring 1 question to class',
      'The garden has 12 rows with 9 plants in each row',
      'We walked 2500 steps and stopped for 15 minutes',
      'Buy 4 tickets for the 6 oclock train on platform 8',
      'Box 507 contains 23 books and weighs 19 kilos',
    ],
  },
  punctuation: {
    practiceRounds: [
      {
        title: 'Stops and lists', keys: ', .',
        passages: ['Pack a coat, a hat, and a book.', 'The rain stopped. We went outside.', 'Tea, toast, and jam are ready.', 'Turn left, cross the bridge, and stop.'],
      },
      {
        title: 'Questions and voices', keys: '? ! " \'',
        passages: ['"Ready?" she asks. "Let\'s go!"', 'Where\'s my bag? I left it here!', '"Watch out!" Ben calls from the gate.', 'It\'s warm today. Shall we eat outside?'],
      },
      {
        title: 'Connect your thoughts', keys: '; : + familiar punctuation',
        passages: ['A note: "I\'m outside; bring a coat."', 'Bring three things: water, lunch, and a map.', 'The shop is closed; we can return tomorrow.', 'Mia asks: "Tea or coffee?" I\'ll have tea.'],
      },
    ],
    testVariants: [
      '"Ready?" she asks. Yes, let\'s go! Bring a coat; it might rain.',
      'Mia asks, "What\'s for lunch?" Ben smiles: "Soup!"',
      '"Wait!" Jo calls. "Is this yours?" Yes, that\'s my bag; thanks.',
      'Here\'s the plan: buy bread, find a bench, and eat by the river.',
      'The train is late; we have time for tea. Shall I buy a cup?',
      '"It\'s beautiful!" Ana says. The garden is full of red, yellow, and pink flowers.',
      'Please bring these tools: a hammer, a brush, and some tape. Don\'t forget the gloves!',
      'I\'ve packed lunch; you can bring the drinks. "Great!" Sam says. "See you soon."',
    ],
  },
  'word-flow': {
    practiceRounds: [
      {
        title: 'Common word pairs', keys: 'Letters + spaces',
        passages: ['Turn off the light.', 'Put away your shoes.', 'Take care of the plants.', 'Come back after lunch.'],
      },
      {
        title: 'Join your ideas', keys: 'Letters + punctuation',
        passages: ['The sky is clear, so we can walk.', 'I made tea while the bread cooled.', 'We left early because the road was busy.', 'Bring a jacket if the wind picks up.'],
      },
      {
        title: 'Keep a steady rhythm', keys: 'Complete sentences',
        passages: ['By the time we arrived, the little shop had closed.', 'There is enough room for everyone at the big table.', 'After a long day at work, I like to read for a while.', 'The best part of the walk was the view from the bridge.'],
      },
    ],
    testVariants: [
      'Take your time with the recipe, and put away each ingredient when you finish.',
      'We had a little time before the train arrived, so we bought some breakfast.',
      'Turn off the kitchen light when you leave, but keep the porch light on.',
      'I will take care of the plants while you are away for the weekend.',
      'As soon as the rain stopped, everyone went outside to stretch their legs.',
      'There is a small bookshop next to the cafe at the end of the street.',
      'At first I could not find the trail, but then I noticed the wooden sign.',
      'By the time dinner was ready, the whole family had gathered around the table.',
    ],
  },
  contractions: {
    practiceRounds: [
      {
        title: 'Short everyday forms', keys: "' + letters",
        passages: ["I'm ready when you are.", "It's warmer than I expected.", "We don't need another bag.", "She's waiting by the door."],
      },
      {
        title: 'Plans and possibilities', keys: "' + complete sentences",
        passages: ["I'll call when the train arrives.", "We've already bought the tickets.", "You'd like the little cafe near work.", "They haven't finished the garden yet."],
      },
      {
        title: 'Natural conversation', keys: "' ? !",
        passages: ["Couldn't we take the quieter road?", "That's the best soup I've had all week!", "There's a spare key under the flowerpot.", "Don't worry; we'll get there before dark."],
      },
    ],
    testVariants: [
      "I'm heading to the market. Is there anything you'd like me to bring back?",
      "We've got enough bread for lunch, but we haven't bought any fruit yet.",
      "She'll meet us outside the library when she's finished returning her books.",
      "It's getting cold, so don't forget the jacket you left beside the door.",
      "They couldn't find the address, but they're on the right street now.",
      "I'd love to stay for dinner, but I've promised to help my neighbor tonight.",
      "You won't need a map; there's a clear sign at every turn along the trail.",
      "That's a lovely photo! I didn't know you'd visited the coast last summer.",
    ],
  },
  messages: {
    practiceRounds: [
      {
        title: 'Quick check-ins', keys: 'Letters + punctuation',
        passages: ["I'm outside. Take your time!", 'Could you save me a seat?', 'Thanks for the lift this morning.', "Running a little late. I'll be there soon."],
      },
      {
        title: 'Times and details', keys: 'Numbers + punctuation',
        passages: ['Meet me at 6:30 by the main entrance.', 'Your order will arrive between 2 and 4.', 'The meeting moved to room 305.', 'Please bring 12 copies for the group.'],
      },
      {
        title: 'Useful updates', keys: 'Complete messages',
        passages: ['The parcel is with our neighbor. You can collect it after work.', "I've left dinner in the fridge. Heat it for 3 minutes.", 'The shop closes at 8 tonight, so we still have time.', 'Could we move our call to Thursday? Wednesday is full.'],
      },
    ],
    testVariants: [
      "Hi, Ana! The train is 10 minutes late. I'll meet you by the ticket office.",
      'Thanks for lending me the book. I finished it last night and can return it tomorrow.',
      'The table is booked for 7:30 on Friday. Please tell me if you need a different time.',
      "I've sent the photos from our walk. The one by the bridge is my favorite!",
      'Please collect the parcel from room 204 before 5. Bring your order number.',
      "We're picking up lunch at noon. Would you like soup, a sandwich, or both?",
      'The repair is finished. You can collect your bicycle any time after 3 today.',
      "Sorry I missed your call. I'm free after 6 if you'd still like to talk.",
    ],
  },
  'mixed-text': {
    practiceRounds: [
      {
        title: 'Notes and instructions', keys: 'Letters, digits, and punctuation',
        passages: ['Bake for 25 minutes, then leave the tray to cool.', 'Bus 16 stops here every 20 minutes.', 'Shopping list: rice, eggs, tea, and 4 apples.', 'Keep the door closed; the cat knows how to escape.'],
      },
      {
        title: 'Short dialogue', keys: 'Quotes + questions',
        passages: ['"Did you lock the door?" "Yes, I checked twice."', '"How far is the beach?" "About 15 minutes on foot."', '"Tea or coffee?" "Tea, please. No sugar."', '"Found your glasses?" "Yes. I was wearing them."'],
      },
      {
        title: 'A little of everything', keys: 'All familiar keys',
        passages: ['At 8:15, Maya caught the last bus home. Her umbrella stayed at the cafe.', 'Our garden has 6 tomato plants. The smallest one produced the biggest tomato.', 'The note said, "Back in 5 minutes." We waited for 10, then went for lunch.', "I packed 3 books for a weekend trip. Somehow, I came home with 7."],
      },
    ],
    testVariants: [
      'The recipe says to bake for 30 minutes at 180 degrees. Set a timer; the last batch was a little too crisp.',
      '"Where did you park?" Sam asked. "Level 3, near the blue door." They found 4 blue doors.',
      "Our train leaves at 9:45 on Saturday. I've packed the tickets, a book, and enough snacks for a much longer trip.",
      'Please water the plants every 2 days. The little one by the window needs less water than the others.',
      'The notice read: "Library closed at 6 today." I arrived at 5:58 and suddenly became a very quick reader.',
      "We bought 12 rolls for the picnic. By the time we reached the park, there were 9. Nobody could explain it.",
      '"Is that the right bus?" Ana asked. Ravi checked the sign: 42. "Yes! And this time, it is going the right way."',
      'At 7:30, the kitchen was finally clean. Then someone asked, "Shall we make pancakes?" We found the flour again.',
    ],
  },
};
