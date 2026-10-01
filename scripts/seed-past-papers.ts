import fs from 'fs';
import path from 'path';
import { PastPaper } from '../server/types.js';

const dbPath = path.resolve(process.cwd(), 'data', 'study_buddy_db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

if (!Array.isArray(db.pastPapers)) {
  db.pastPapers = [];
}
if (!Array.isArray(db.calendarEvents)) {
  db.calendarEvents = [];
}
if (!Array.isArray(db.studyLogs)) {
  db.studyLogs = [];
}

const samplePapers: PastPaper[] = [
  {
    id: 'pp_unza_2012_test2',
    courseId: 'course_ml_101',
    folderId: 'folder_1790492371115_04dbu',
    ownerId: 'user_alex',
    title: 'UNZA / David Livingstone 2012 Test 2 - Educational Psychology',
    filename: '2012_DDE_Educational_Psychology_Test2.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 85400,
    year: '2012',
    examTerm: 'Internal Test 2',
    institution: 'The University of Zambia & David Livingstone College of Education',
    pageCount: 3,
    extractedTextLength: 3200,
    status: 'ready',
    statusMessage: 'Parsed 15 questions across 3 page(s)',
    extractedQuestions: [
      {
        questionNumber: '1',
        section: 'SECTION A',
        type: 'multiple_choice',
        prompt: 'Some people eventually suffer brain degeneration with age, but few people aged 65 are afflicted with loss of mental functioning condition known as...',
        options: ['A. Andropause', 'B. Dementia', 'C. Alzheimer\'s', 'D. Terminal drop'],
        allocatedMarks: 1,
      },
      {
        questionNumber: '2',
        section: 'SECTION A',
        type: 'multiple_choice',
        prompt: '_______ period includes development of skeletal and muscular systems and lasts from the ninth week of gestation until birth.',
        options: ['A. Fetal', 'B. Pre-natal', 'C. Post-natal', 'D. Germinal'],
        allocatedMarks: 1,
      },
      {
        questionNumber: '3',
        section: 'SECTION A',
        type: 'multiple_choice',
        prompt: 'Age-related memory deficits appear to depend on the particular type of _______ task being used.',
        options: ['A. Social', 'B. Mental', 'C. Memory', 'D. Emotional'],
        allocatedMarks: 1,
      },
      {
        questionNumber: '4',
        section: 'SECTION A',
        type: 'multiple_choice',
        prompt: 'According to Eric Erikson, during middle adulthood period, adults experience a conflict between...',
        options: [
          'A. Intimacy and isolation',
          'B. Integrity and despair',
          'C. Identity vs. role confusion',
          'D. Generativity and stagnation',
        ],
        allocatedMarks: 1,
      },
      {
        questionNumber: '7',
        section: 'SECTION A',
        type: 'multiple_choice',
        prompt: 'The life stage that involves more role changes than any other is...',
        options: ['A. Adolescence', 'B. Early adulthood', 'C. Middle adulthood', 'D. Later adulthood'],
        allocatedMarks: 1,
      },
      {
        questionNumber: '1',
        section: 'SECTION B',
        type: 'fill_in_blank',
        prompt: 'The sequence of development from lifting the head to walking alone is stable and predictable across cultures. Development develops from head down (_______) and from center out (_______).',
        allocatedMarks: 2,
      },
      {
        questionNumber: '2',
        section: 'SECTION B',
        type: 'short_answer',
        prompt: 'Define the following terms: (a) Climacteric (b) Germinal period (c) Teratogens',
        allocatedMarks: 5,
      },
      {
        questionNumber: '12',
        section: 'SECTION C',
        type: 'short_essay',
        prompt: 'Briefly discuss the importance of Educational Psychology to a teacher in understanding learner development and behavior.',
        allocatedMarks: 15,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'pp_unza_2015_makeup',
    courseId: 'course_ml_101',
    folderId: 'folder_1790492371115_04dbu',
    ownerId: 'user_alex',
    title: 'UNZA 2015 Makeup Test - Cognitive & Psychosocial Theories',
    filename: '2015_UNZA_Makeup_Test_Aug_Residential.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 74200,
    year: '2015',
    examTerm: 'August Residential Makeup Test',
    institution: 'The University of Zambia',
    pageCount: 4,
    extractedTextLength: 2950,
    status: 'ready',
    statusMessage: 'Parsed 12 questions across 4 page(s)',
    extractedQuestions: [
      {
        questionNumber: '1',
        section: 'SECTION A',
        type: 'multiple_choice',
        prompt: 'At what stage of Piaget\'s cognitive development does the individual use conditioning reflexes?',
        options: ['A. Formal operational', 'B. Sensory-motor', 'C. Pre-operational', 'D. Concrete operational'],
        allocatedMarks: 1,
      },
      {
        questionNumber: '3',
        section: 'SECTION A',
        type: 'multiple_choice',
        prompt: 'The term \'scaffolding\' in Vygotskian theory refers to...',
        options: [
          'A. Working along with a student to help solve a problem',
          'B. Adjusting help to fit learners\' current level of performance',
          'C. Giving learners hints to help them find the correct answer',
          'D. Older students helping younger ones to learn a new skill',
        ],
        allocatedMarks: 1,
      },
      {
        questionNumber: '6',
        section: 'SECTION A',
        type: 'multiple_choice',
        prompt: 'A child who has learned that whether the box is open or closed, there are balls inside, has attained the concept of...',
        options: ['A. Object permanence', 'B. Assimilation', 'C. Conservation', 'D. Accommodation'],
        allocatedMarks: 1,
      },
      {
        questionNumber: '11',
        section: 'SECTION B',
        type: 'short_answer',
        prompt: 'For each concept, write the theorist who proposed it: (a) Libido (b) Assimilation (c) Heinz Dilemma (d) Trust vs Mistrust (e) Scaffolding',
        allocatedMarks: 5,
      },
      {
        questionNumber: '16',
        section: 'SECTION C',
        type: 'short_essay',
        prompt: 'Explain in three detailed paragraphs, three criticisms of psychosexual theory of human development.',
        allocatedMarks: 15,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'pp_unza_2016_dde_promotion',
    courseId: 'course_ml_101',
    folderId: 'folder_1790492371115_04dbu',
    ownerId: 'user_alex',
    title: 'David Livingstone 2016 Educational Psychology Promotion Exam',
    filename: '2016_DDE_Year2_Educational_Psychology.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 98100,
    year: '2016',
    examTerm: 'Year Two Promotion Examination',
    institution: 'David Livingstone College of Education',
    pageCount: 5,
    extractedTextLength: 4100,
    status: 'ready',
    statusMessage: 'Parsed 14 questions across 5 page(s)',
    extractedQuestions: [
      {
        questionNumber: '2',
        section: 'SECTION A',
        type: 'multiple_choice',
        prompt: 'According to behaviourist school of thought, learning is defined as...',
        options: [
          'A. Practice',
          'B. Change in cognitive structures',
          'C. Acquisition of new schema',
          'D. Change in observable behaviour',
        ],
        allocatedMarks: 1,
      },
      {
        questionNumber: '7',
        section: 'SECTION A',
        type: 'multiple_choice',
        prompt: 'Test reliability refers to...',
        options: [
          'A. Test predictive value',
          'B. Test consistency of assessment',
          'C. Test ability to measure what it claims to measure',
          'D. Test norms',
        ],
        allocatedMarks: 1,
      },
      {
        questionNumber: '12',
        section: 'SECTION B',
        type: 'short_answer',
        prompt: 'Give a brief explanation of each of the following: A. Learning theory (Carl Rogers) B. Classical conditioning (Ivan Pavlov) C. Connectionism (Edward Thorndike)',
        allocatedMarks: 6,
      },
      {
        questionNumber: '14',
        section: 'SECTION C',
        type: 'short_essay',
        prompt: 'Write a short essay explaining the five factors to consider when designing a classroom test.',
        allocatedMarks: 15,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Merge into db
for (const paper of samplePapers) {
  db.pastPapers = db.pastPapers.filter((p: any) => p.id !== paper.id);
  db.pastPapers.push(paper);
}

// Add sample study events and logs
if (db.calendarEvents.length === 0) {
  const tomorrow = new Date(Date.now() + 86400000);
  tomorrow.setHours(15, 0, 0, 0);

  db.calendarEvents.push({
    id: 'evt_sample_1',
    userId: 'user_alex',
    courseId: 'course_ml_101',
    folderId: 'folder_1790492371115_04dbu',
    title: 'Adolescence & Cognitive Stages Exam Review',
    description: 'Review Piaget, Vygotsky, and Erikson past paper questions',
    startTime: tomorrow.toISOString(),
    endTime: new Date(tomorrow.getTime() + 45 * 60000).toISOString(),
    durationMinutes: 45,
    isRecurring: true,
    recurrenceRule: 'weekdays',
    reminderMinutesBefore: 15,
    completed: false,
    createdAt: new Date().toISOString(),
  });
}

if (db.studyLogs.length === 0) {
  db.studyLogs.push({
    id: 'log_seed_1',
    userId: 'user_alex',
    courseId: 'course_ml_101',
    folderId: 'folder_1790492371115_04dbu',
    durationMinutes: 25,
    completedAt: new Date(Date.now() - 3600000).toISOString(),
    notes: 'Completed Pomodoro focus session on Educational Psychology',
  });
}

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
console.log('Seeded past papers, study events, and study logs successfully!');
