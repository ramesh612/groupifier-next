import { parseActivityCode, activityCodeToName, activityById } from './activities';
import { sortBy, sortByArray } from './utils';

export const best = (person, eventId, type) => {
  if (!['single', 'average'].includes(type)) {
    throw new Error(`Personal best type must be either 'single' or 'average'. Received '${type}'.`);
  }
  const personalBest = person.personalBests.find(pb => pb.eventId === eventId && pb.type === type);
  return personalBest ? personalBest.best : Infinity;
};

export const bestAverageAndSingle = (competitor, eventId) =>
  [best(competitor, eventId, 'average'), best(competitor, eventId, 'single')];

const competitorsExpectedToAdvance = (sortedCompetitors, advancementCondition, eventId) => {
  switch (advancementCondition.type) {
    case 'ranking':
      return sortedCompetitors.slice(0, advancementCondition.level);
    case 'percent':
      return sortedCompetitors.slice(0, Math.floor(sortedCompetitors.length * advancementCondition.level * 0.01));
    case 'attemptResult':
      /* Assume that competitors having personal best better than the advancement condition will make it to the next round. */
      return sortedCompetitors.filter(person => best(person, eventId, 'single') < advancementCondition.level);
    default:
      throw new Error(`Unrecognised AdvancementCondition type: '${advancementCondition.type}'`);
  }
};

export const getExpectedCompetitorsByRound = wcif =>
  wcif.events.reduce((expectedCompetitorsByRound, event) => {
    const [firstRound, ...nextRounds] = event.rounds;
    expectedCompetitorsByRound[firstRound.id] = sortByArray(
      acceptedPeopleRegisteredForEvent(wcif, event.id),
      competitor => bestAverageAndSingle(competitor, event.id)
    );
    nextRounds.reduce(([round, competitors], nextRound) => {
      const advancementCondition = round.advancementCondition;
      if (!advancementCondition) throw new Error(`Mising advancement condition for ${activityCodeToName(round.id)}.`);
      const nextRoundCompetitors = competitorsExpectedToAdvance(competitors, advancementCondition, event.id);
      expectedCompetitorsByRound[nextRound.id] = nextRoundCompetitors;
      return [nextRound, nextRoundCompetitors];
    }, [firstRound, expectedCompetitorsByRound[firstRound.id]]);
    return expectedCompetitorsByRound;
  }, {});

const satisfiesAdvancementCondition = (result, advancementCondition, resultCount) => {
  const { type, level } = advancementCondition;
  if (type === 'ranking') return result.ranking <= level;
  if (type === 'percent') return result.ranking <= Math.floor(resultCount * level * 0.01);
  if (type === 'attemptResult') return result.attempts.some(attempt => attempt.result > 0 && attempt.result < level);
  throw new Error(`Unrecognised AdvancementCondition type: '${type}'`);
};

export const advancingResults = (results, advancementCondition) => {
  const sortedResults = sortBy(
    results.filter(result => result.attempts.length > 0),
    result => result.ranking
  );
  const maxAdvanceable = Math.floor(sortedResults.length * 0.75); /* See: https://www.worldcubeassociation.org/regulations/#9p1 */
  const firstNonAdvancingRank = sortedResults[maxAdvanceable].ranking;
  /* Note: this ensures that people who tied either advance altogether or not. */
  return sortedResults
    .filter(result => result.ranking < firstNonAdvancingRank)
    .filter(result => satisfiesAdvancementCondition(result, advancementCondition, sortedResults.length));
};

export const competitorsForRound = (wcif, roundId) => {
  const { eventId, roundNumber } = parseActivityCode(roundId);
  if (roundNumber === 1) {
    return sortByArray(
      acceptedPeopleRegisteredForEvent(wcif, eventId),
      competitor => bestAverageAndSingle(competitor, eventId).map(result => -result)
    );
  } else {
    const previousRound = wcif.events
      .find(event => event.id === eventId).rounds
      .find(round => parseActivityCode(round.id).roundNumber === roundNumber - 1);
    const { results, advancementCondition } = previousRound;
    if (results.length === 0) return null;
    return sortBy(advancingResults(results, advancementCondition), result => -result.ranking)
      .map(result => wcif.persons.find(person => person.registrantId === result.personId));
  }
};

export const age = person => {
  const diffMs = Date.now() - new Date(person.birthdate).getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.2425));
}

export const staffAssignments = person =>
  person.assignments.filter(({ assignmentCode }) => assignmentCode.startsWith('staff-'));

export const staffAssignmentsForEvent = (wcif, person, eventId) =>
  staffAssignments(person).filter(({ activityId }) =>
    parseActivityCode(activityById(wcif, activityId).activityCode).eventId === eventId
  );

export const acceptedPeople = wcif =>
  wcif.persons.filter(person => person.registration && person.registration.status === 'accepted');

const acceptedPeopleRegisteredForEvent = (wcif, eventId) =>
  acceptedPeople(wcif).filter(({ registration }) => registration.eventIds.includes(eventId));

export const hasAssignment = (person, activityId, assignmentCode) =>
  person.assignments.some(assignment =>
    assignment.activityId === activityId && assignment.assignmentCode === assignmentCode
  );
