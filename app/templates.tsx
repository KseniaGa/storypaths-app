import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useStoryStore } from '../store/storyStore';



const templates = [
  {
    emoji: '📝',
    title: 'Blank Story',
    level: 'Beginner',
    description: 'Start with one empty scene. Best if you already have an idea.',
    features: 'Empty story',
  },

   {
  emoji: '🪲',
  title: "The Beetle's First Branch",
  level: 'Beginner tutorial',
  description:
    'A tiny tutorial story about a beetle exploring a tree. Good for learning scenes, choices, story traces, and play mode.',
  features: 'Scenes • Choices • Play mode • Story trace',
},
{
  emoji: '🌲',
  title: 'The Door in the Forest',
  level: 'Intermediate example',
  description:
    'A short branching story about a mysterious door in a tree. Good for exploring story traces and conditional choices.',
  features: 'Story traces • Conditional choices • Multiple endings',
},

{
  emoji: '🫐',
  title: 'Berries and the Locked Gate',
  level: 'Concept tutorial',
  description:
    'A tiny tutorial that shows the difference between choices, story traces, story values, and conditional choices.',
  features: 'Choice • Story trace • Story value • Conditional choice',
},

  {
    emoji: '🪞',
    title: 'Personal Reflection',
    level: 'Beginner',
    description: 'A structure for memories, feelings, or lived experiences.',
    features: 'Coming soon',
  },

  {
    emoji: '💬',
    title: 'Dialogue Story',
    level: 'Intermediate',
    description: 'Build a story around conversations and different responses.',
    features: 'Coming soon',
  },

];

export default function TemplatesScreen() {

  const createStory = useStoryStore((state) => state.createStory);
  const importStory = useStoryStore((state) => state.importStory);

  const createBlankStory = () => {
    createStory('Blank story', 'fictional');
    router.push('/story');
  };

  const makeTemplateId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createBeetleTemplate = () => {
  const storyId = makeTemplateId('beetle-template');

  importStory({
    id: storyId,
    title: "The Beetle's First Branch",
    mode: 'fictional',
    showSceneTitlesInPlay: true,
    storyValues: [],
    scenes: [
      {
        id: 'beetle-morning',
        title: 'Morning on the Branch',
        text:
          'A tiny beetle wakes up on a warm green branch.\n\nAhead, the branch splits in two directions. One side glows in the sun. The other disappears under a shadowy leaf.',
        assets: [],
        choices: [
          {
            id: 'choice-sunny-branch',
            label: 'Follow the sunny branch',
            targetSceneId: 'beetle-sunny',
          },
          {
            id: 'choice-shadow-leaf',
            label: 'Crawl under the shadowy leaf',
            targetSceneId: 'beetle-leaf',
          },
        ],
      },
      {
        id: 'beetle-sunny',
        title: 'The Sunny Branch',
        text:
          'The beetle finds a golden berry glowing in the sun.\n\nIt smells sweet, bright, and a little mysterious.',
        assets: [],
        choices: [
          {
            id: 'choice-nibble-berry',
            label: 'Nibble the golden berry',
            targetSceneId: 'beetle-hollow',
            traceLabel: 'found golden berry',
          },
        ],
      },
      {
        id: 'beetle-leaf',
        title: 'Under the Leaf',
        text:
          'Under the leaf, the beetle finds a tiny raindrop hanging like a mirror.\n\nFor a moment, the whole tree seems upside down.',
        assets: [],
        choices: [
          {
            id: 'choice-touch-raindrop',
            label: 'Touch the raindrop',
            targetSceneId: 'beetle-hollow',
            traceLabel: 'touched raindrop',
          },
        ],
      },
      {
        id: 'beetle-hollow',
        title: 'The Nest in the Bark',
        text:
          'The beetle finds a quiet hollow in the tree bark.\n\nIt feels like a safe place to rest. The tree remembers the path the beetle took today.',
        assets: [],
        choices: [
          {
            id: 'choice-rest',
            label: 'Rest in the hollow',
            targetSceneId: 'beetle-ending',
          },
          {
            id: 'choice-look-back',
            label: 'Look back at the branch',
            targetSceneId: 'beetle-morning',
          },
        ],
      },
      {
        id: 'beetle-ending',
        title: 'A Small Ending',
        text:
          'The beetle curls up in the bark hollow.\n\nTomorrow, there will be more branches to explore.',
        assets: [],
        choices: [],
      },
    ],
  });

  router.push('/story');
};

const createForestDoorTemplate = () => {
  const storyId = makeTemplateId('forest-door-template');

  importStory({
    id: storyId,
    title: 'The Door in the Forest',
    mode: 'fictional',
    showSceneTitlesInPlay: true,
    storyValues: [],
    scenes: [
      {
        id: 'forest-path',
        title: 'The Forest Path',
        text:
          'You are walking through a quiet forest when the path divides.\n\nNear the roots of an old tree, something silver catches the light. Above you, birds call from the branches.',
        assets: [],
        choices: [
          {
            id: 'choice-pick-up-key',
            label: 'Pick up the silver key',
            targetSceneId: 'mossy-stone',
            traceLabel: 'silver key',
          },
          {
            id: 'choice-listen-birds',
            label: 'Listen to the birds',
            targetSceneId: 'birdsong',
            traceLabel: 'heard birdsong',
          },
        ],
      },
      {
        id: 'mossy-stone',
        title: 'The Mossy Stone',
        text:
          'A mossy stone stands beside the path.\n\nA symbol is carved into it: a door, a branch, and an eye.',
        assets: [],
        choices: [
          {
            id: 'choice-remember-symbol',
            label: 'Remember the symbol',
            targetSceneId: 'tree-door',
            traceLabel: 'remembered symbol',
          },
          {
            id: 'choice-continue-stone',
            label: 'Continue forward',
            targetSceneId: 'tree-door',
          },
        ],
      },
      {
        id: 'birdsong',
        title: 'The Birdsong',
        text:
          'The birds are not just singing. They seem to be warning you, or maybe guiding you.',
        assets: [],
        choices: [
          {
            id: 'choice-trust-birds',
            label: 'Follow the birdsong',
            targetSceneId: 'tree-door',
            traceLabel: 'trusted birds',
          },
          {
            id: 'choice-ignore-birds',
            label: 'Ignore it and walk on',
            targetSceneId: 'tree-door',
          },
        ],
      },
      {
        id: 'tree-door',
        title: 'The Door in the Tree',
        text:
          'A wooden door appears in the trunk of an old tree.\n\nIt has no handle, only a keyhole and the same symbol carved into the wood.',
        assets: [],
        choices: [
          {
            id: 'choice-use-key',
            label: 'Open the door with the silver key',
            targetSceneId: 'ending-hidden-room',
            requiredTraceLabel: 'silver key',
          },
          {
            id: 'choice-use-symbol',
            label: 'Knock three times using the symbol rhythm',
            targetSceneId: 'ending-memory',
            requiredTraceLabel: 'remembered symbol',
          },
          {
            id: 'choice-follow-birds-away',
            label: 'Follow the birds away from the door',
            targetSceneId: 'ending-safer-path',
            requiredTraceLabel: 'trusted birds',
          },
          {
            id: 'choice-walk-away',
            label: 'Walk away',
            targetSceneId: 'ending-ordinary-forest',
          },
        ],
      },
      {
        id: 'ending-hidden-room',
        title: 'The Hidden Room',
        text:
          'The key turns.\n\nInside the tree is a room full of tiny lights. You realize someone expected you.',
        assets: [],
        choices: [],
      },
      {
        id: 'ending-memory',
        title: 'The Remembered Path',
        text:
          'The symbol glows.\n\nThe tree opens not into a room, but into a memory.',
        assets: [],
        choices: [],
      },
      {
        id: 'ending-safer-path',
        title: 'The Safer Path',
        text:
          'The birds lead you away.\n\nBehind you, the door closes by itself. Maybe not every door needs to be opened.',
        assets: [],
        choices: [],
      },
      {
        id: 'ending-ordinary-forest',
        title: 'The Ordinary Forest',
        text:
          'You walk away.\n\nThe forest becomes ordinary again, but you keep thinking about the door.',
        assets: [],
        choices: [],
      },
    ],
   });

  router.push('/story');
};

  const createBerriesGateTemplate = () => {
  const storyId = makeTemplateId('berries-gate-template');

  importStory({
    id: storyId,
    title: 'Berries and the Locked Gate',
    mode: 'fictional',
    showSceneTitlesInPlay: true,
    storyValues: [
      {
        id: 'berries',
        name: 'Berries',
        initialValue: 0,
        minValue: 0,
        maxValue: 5,
        step: 1,
      },
    ],
    scenes: [
      {
        id: 'berry-path',
        title: 'The Berry Path',
        text:
          'The beetle arrives at a forest path.\n\nAhead, there is a locked gate. Nearby, there are berries, a shiny key, and a small side path.',
        assets: [],
        choices: [
          {
            id: 'choice-side-path',
            label: 'Follow the side path',
            targetSceneId: 'side-path',
          },
          {
            id: 'choice-pick-key',
            label: 'Pick up the shiny key',
            targetSceneId: 'after-key',
            traceLabel: 'shiny key',
          },
          {
            id: 'choice-collect-berry',
            label: 'Collect a berry',
            targetSceneId: 'after-berry',
            valueChange: {
              valueId: 'berries',
              amount: 1,
            },
          },
        ],
      },
      {
        id: 'side-path',
        title: 'A Simple Choice',
        text:
          'This was a normal choice.\n\nIt moved the beetle to another scene, but it did not leave a story trace or change a story value.',
        assets: [],
        choices: [
          {
            id: 'choice-return-from-side-path',
            label: 'Return to the gate',
            targetSceneId: 'locked-gate',
          },
        ],
      },
      {
        id: 'after-key',
        title: 'A Story Trace',
        text:
          'The beetle picked up the shiny key.\n\nThis choice left a story trace. Later, the story can remember that the beetle has the key.',
        assets: [],
        choices: [
          {
            id: 'choice-go-to-gate-with-key',
            label: 'Go to the locked gate',
            targetSceneId: 'locked-gate',
          },
        ],
      },
      {
        id: 'after-berry',
        title: 'A Story Value',
        text:
          'The beetle collected one berry.\n\nThis changed a story value. Story values can go up or down, like berries, coins, trust, or energy.',
        assets: [],
        choices: [
          {
            id: 'choice-collect-another-berry',
            label: 'Collect another berry',
            targetSceneId: 'after-berry',
            valueChange: {
              valueId: 'berries',
              amount: 1,
            },
          },
          {
            id: 'choice-go-to-gate-with-berries',
            label: 'Go to the locked gate',
            targetSceneId: 'locked-gate',
          },
        ],
      },
      {
        id: 'locked-gate',
        title: 'The Locked Gate',
        text:
          'Some paths only appear if the beetle has the right story trace or enough of a story value.',
        assets: [],
        choices: [
          {
            id: 'choice-open-with-key',
            label: 'Open the gate with the shiny key',
            targetSceneId: 'ending-key',
            requiredTraceLabel: 'shiny key',
          },
          {
            id: 'choice-trade-berries',
            label: 'Trade 3 berries for help opening the gate',
            targetSceneId: 'ending-berries',
            requiredValue: {
              valueId: 'berries',
              operator: 'atLeast',
              amount: 3,
            },
          },
          {
            id: 'choice-wait-at-gate',
            label: 'Wait by the gate',
            targetSceneId: 'ending-wait',
          },
        ],
      },
      {
        id: 'ending-key',
        title: 'The Key Ending',
        text:
          'The shiny key fits perfectly.\n\nThis path appeared because the beetle had the right story trace.',
        assets: [],
        choices: [],
      },
      {
        id: 'ending-berries',
        title: 'The Berry Ending',
        text:
          'A friendly forest creature accepts the berries and opens the gate.\n\nThis path appeared because the beetle had enough of a story value.',
        assets: [],
        choices: [],
      },
      {
        id: 'ending-wait',
        title: 'The Waiting Ending',
        text:
          'The beetle waits by the gate.\n\nNothing terrible happens, but the beetle wonders what might have changed if it had picked up something useful first.',
        assets: [],
        choices: [],
      },
    ],
  }); 

  router.push('/story');
};

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Choose a template 📚</Text>

      <Text style={styles.intro}>
        Templates give you a starting point. You can change everything later.
      </Text>

      <View style={styles.templateList}>
        {templates.map((template) => (
          <Pressable
            key={template.title}
            style={styles.templateCard}
            onPress={() => {
  if (template.title === 'Blank Story') {
    createBlankStory();
    return;
  }

  if (template.title === "The Beetle's First Branch") {
    createBeetleTemplate();
    return;
  }

  if (template.title === 'The Door in the Forest') {
    createForestDoorTemplate();
    return;
  }

  if (template.title === 'Berries and the Locked Gate') {
  createBerriesGateTemplate();
  return;
}
}}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.emoji}>{template.emoji}</Text>

              <View style={styles.titleArea}>
                <Text style={styles.templateTitle}>{template.title}</Text>
                <Text style={styles.level}>{template.level}</Text>
              </View>
            </View>

            <Text style={styles.description}>{template.description}</Text>
            <Text style={styles.features}>{template.features}</Text>
            {template.features === 'Coming soon' && (
  <Text style={styles.comingSoon}>Template structure coming next</Text>
)}

          </Pressable>
        ))}
      </View>

      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>Back</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingBottom: 40,
  },
  features: {
  fontSize: 12,
  color: '#4F6F52',
  marginTop: 8,
  fontWeight: '600',
},
  heading: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 12,
  },
  intro: {
    fontSize: 15,
    color: '#555',
    lineHeight: 21,
    marginBottom: 12,
  },
  reassurance: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    backgroundColor: '#F7F2FF',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  templateList: {
    gap: 12,
  },
  templateCard: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#fff',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  emoji: {
    fontSize: 28,
    marginRight: 12,
  },
  titleArea: {
    flex: 1,
  },
  templateTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 3,
  },
  level: {
    fontSize: 13,
    color: '#777',
  },
  description: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  backButton: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#ccc',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
  },
    comingSoon: {
    fontSize: 12,
    color: '#777',
    marginTop: 8,
    fontStyle: 'italic',
  },
});