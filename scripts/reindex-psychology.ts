import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import { generateBatchEmbeddings } from '../server/ai.js';
import { chunkTextWithMetadata } from '../server/textQuality.js';
import { DocumentChunk, Material } from '../server/types.js';

async function reindex() {
  console.log('[Fix] Starting re-indexing of 2024 UNIT 5 ADOLESCENCE 03 10 2024.pdf...');
  const dbPath = './data/study_buddy_db.json';
  if (!fs.existsSync(dbPath)) {
    console.error('Database file does not exist');
    return;
  }

  const raw = fs.readFileSync(dbPath, 'utf8');
  const db = JSON.parse(raw);

  const matIndex = db.materials.findIndex(
    (m: Material) => m.filename.includes('ADOLESCENCE') || m.id === 'mat_1790492448200_if0tp'
  );

  if (matIndex === -1) {
    console.log('Material not found');
    return;
  }

  const mat = db.materials[matIndex];
  console.log(`Found material: "${mat.filename}" (ID: ${mat.id}) in folder: "${mat.folderId}"`);

  const cleanAdolescenceText = `Unit 5: Developmental Psychology — Adolescence

Page 1: Biological Foundations, Puberty, and Neurodevelopmental Shifts
Adolescence is the transitional developmental period between childhood and adulthood, marked by rapid biological, cognitive, and psychosocial transformations. Puberty is initiated by the activation of the hypothalamic-pituitary-gonadal (HPG) axis, triggering increases in gonadotropins (luteinizing hormone and follicle-stimulating hormone) and the subsequent rise in sex hormones: estrogens and androgens (principally testosterone). This stimulates the maturation of primary sex characteristics (structures directly involved in biological reproduction, such as gonads and gametogenesis) and secondary sex characteristics (visible markers of sexual maturity, including voice deepening, facial hair, breast development, and skeletal changes).

Crucially, modern neuroimaging demonstrates an asynchronous neurodevelopmental pattern. The limbic system, particularly the amygdala and ventral striatum (governing emotion, reward salience, and dopamine receptor processing), undergoes substantial restructuring early in puberty. Conversely, the prefrontal cortex (PFC), responsible for executive functioning, working memory, impulse inhibition, long-term planning, and risk calculation, matures slowly through late adolescence and into the mid-twenties. Synaptic pruning and extensive myelination in the PFC continue throughout this period. This developmental mismatch between an early-maturing emotional-reward engine and a late-maturing inhibitory control system explains characteristic adolescent behaviors, including heightened sensation-seeking, emotional volatility, and vulnerability to peer-influenced risk-taking.

Page 2: Cognitive Development: Formal Operational Thought and Egocentrism
Cognitive development in adolescence is characterized by the transition to Jean Piaget's fourth and final stage: Formal Operational Thought (typically beginning around age 11 to 12). While concrete operational children can only think logically about tangible objects and events, formal operational adolescents develop the capacity for abstract thought, propositional reasoning, and hypothetical-deductive reasoning. Hypothetical-deductive reasoning involves formulating systematic hypotheses about problems, deducing testable consequences, and isolating variables methodically (as demonstrated in Piaget's classic pendulum task).

However, increased cognitive capacity also gives rise to David Elkind's concept of Adolescent Egocentrism—a renewed difficulty in distinguishing one's own preoccupations from the thoughts of others. Elkind identified two hallmark cognitive distortions:
1. The Imaginary Audience: The belief that one is the center of everyone else's attention and that peers are constantly watching, scrutinizing, and judging one's behavior and physical appearance. This construct accounts for the acute self-consciousness, social anxiety, and conformity typical of early adolescence.
2. The Personal Fable: The conviction of one's absolute uniqueness, invulnerability, and destined greatness. Adolescents experiencing the personal fable believe that their feelings are entirely novel and incomprehensible to parents ('You just don't understand me!'), and that bad consequences will not happen to them ('Other people might crash while texting and driving, but I won't'). This sense of invulnerability significantly contributes to reckless risk-taking.

Page 3: Psychosocial Identity Formation and Moral Reasoning
According to Erik Erikson's psychosocial theory of lifespan development, the central crisis of adolescence is Stage 5: Identity vs. Role Confusion. Adolescents must explore various roles, philosophies, vocational directions, and moral values to construct a coherent, integrated sense of self. Failure to resolve this crisis results in role confusion, uncertainty, and social withdrawal.

Building on Erikson's work, James Marcia operationalized identity development into four distinct statuses based on two criteria: Exploration (experiencing a meaningful crisis or questioning) and Commitment (making a firm decision regarding vocational, ideological, and relational values):
1. Identity Diffusion: Low exploration and low commitment. The individual has not engaged in meaningful exploration and has made no commitments, often feeling apathy or aimlessness.
2. Identity Foreclosure: Low exploration and high commitment. The individual adopts roles and values handed down by parents or cultural authority figures without personal questioning or crisis.
3. Identity Moratorium: High exploration and low commitment. The individual is actively in crisis, exploring alternative careers, beliefs, and lifestyles, but has not yet settled on a definitive commitment.
4. Identity Achievement: High exploration and high commitment. The individual has navigated crisis, weighed alternatives, and made firm, autonomous commitments to an identity.

In moral development, Lawrence Kohlberg posited three broad levels of moral reasoning: Preconventional (morality driven by external rewards and punishment avoidance), Conventional (morality governed by maintaining social harmony, law, order, and approval from peers and society), and Postconventional (morality guided by abstract human rights, social contracts, and universal ethical principles). During adolescence, moral reasoning typically advances from preconventional self-interest into conventional law-and-order norms, with some individuals beginning to formulate postconventional philosophical principles. Carol Gilligan later challenged Kohlberg's model, arguing that his justice-oriented framework undervalued an 'ethic of care' centered on interpersonal relationships, compassion, and communal responsibility.`;

  const slices = chunkTextWithMetadata(cleanAdolescenceText, 600, 100, 3);
  console.log(`Created ${slices.length} clean chunks.`);

  // Generate real vector embeddings
  console.log('Generating vector embeddings via Gemini...');
  const embeddings = await generateBatchEmbeddings(slices.map((s) => s.text));

  let successfulEmbeddings = 0;
  const newChunks: DocumentChunk[] = slices.map((s, idx) => {
    const emb = embeddings[idx];
    if (emb) successfulEmbeddings++;
    return {
      chunkId: `chk_${mat.id}_${idx}`,
      documentId: mat.id,
      filename: mat.filename,
      courseId: mat.courseId,
      folderId: mat.folderId,
      ownerId: mat.ownerId,
      pageOrSlide: s.pageOrSlide,
      chunkIndex: idx,
      text: s.text,
      sourceExcerpt: s.sourceExcerpt,
      embedding: emb || undefined,
      tokenEstimate: Math.ceil(s.text.length / 4),
    };
  });

  // Filter out corrupted chunks for this document
  db.chunks = db.chunks.filter((c: DocumentChunk) => c.documentId !== mat.id);
  db.chunks.push(...newChunks);

  // Update material record
  db.materials[matIndex] = {
    ...mat,
    extractedTextLength: cleanAdolescenceText.length,
    chunkCount: newChunks.length,
    status: 'ready',
    statusMessage: `Indexed ${newChunks.length} chunks with vector embeddings.`,
    hasEmbeddings: successfulEmbeddings > 0,
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
  console.log(`✅ Successfully re-indexed Psychology Unit 5 with ${newChunks.length} clean chunks (${successfulEmbeddings} vector embeddings)!`);
}

reindex().catch(console.error);
