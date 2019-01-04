import { flatMap, sortBy, chunk } from './utils';
import { parseActivityCode, roundGroupActivities } from './activities';
import { eventNameById } from './events';
import { cutoffToString, timeLimitToString } from './formatters';
import { competitorsForRound, hasAssignment } from './competitors';
import pdfMake from './pdfmake';
import { pdfName } from './pdf-utils';

/* See: https://github.com/bpampuch/pdfmake/blob/3da11bd8148b190808b06f7bc27883102bf82917/src/standardPageSizes.js#L10 */
const pageWidth = 595.28;
const pageHeight = 841.89;
const scorecardMargin = 20;

const maxAttemptCountByFormat = { '1': 1, '2': 2, '3': 3, 'm': 3, 'a': 5 };

export const downloadScorecards = (wcif, rounds) => {
  const pdfDefinition = scorecardsPdfDefinition(wcif, rounds);
  pdfMake.createPdf(pdfDefinition).download(`${wcif.id}-scorecards.pdf`);
};

const scorecardsPdfDefinition = (wcif, rounds) => ({
  background: [{
    canvas: [
      cutLine({ x1: scorecardMargin, y1: pageHeight / 2, x2: pageWidth - scorecardMargin, y2: pageHeight / 2 }),
      cutLine({ x1: pageWidth / 2, y1: scorecardMargin, x2: pageWidth / 2, y2:  pageHeight - scorecardMargin })
    ]
  }],
  pageMargins: [scorecardMargin, scorecardMargin],
  content: {
    layout: {
      /* Outer margin is done using pageMargins, we use padding for the remaining inner margins. */
      paddingLeft  : i => i % 2 === 0 ? 0 : scorecardMargin,
      paddingRight : i => i % 2 === 0 ? scorecardMargin : 0,
      paddingTop   : i => i % 2 === 0 ? 0 : scorecardMargin,
      paddingBottom: i => i % 2 === 0 ? scorecardMargin : 0,
      /* Get rid of borders. */
      hLineWidth: () => 0,
      vLineWidth: () => 0
    },
    table: {
      widths: ['*', '*'],
      /* A4 page height minus vertical margins, divided into a half. */
      heights: (pageHeight - 4 * scorecardMargin) / 2,
      dontBreakRows: true,
      body: chunk(scorecards(wcif, rounds), 2)
    }
  }
});

const cutLine = properties => ({
  ...properties,
  type: 'line', lineWidth: 0.1, dash: { length: 10 }, lineColor: '#888888'
});

const scorecards = (wcif, rounds) => {
  return flatMap(rounds, round => {
    const sortedGroupActivities = sortBy(roundGroupActivities(wcif, round.id),
      ({ activityCode }) => parseActivityCode(activityCode).groupNumber
    );
    const sortedCompetitors = competitorsForRound(wcif, round.id);
    let scorecardNumber = sortedCompetitors.length;
    return flatMap(sortedGroupActivities, groupActivity => {
      const competitors = sortedCompetitors.filter(competitor =>
        hasAssignment(competitor, groupActivity.id, 'competitor')
      );
      const groupScorecards = competitors.map(competitor =>
        scorecard({
          scorecardNumber: scorecardNumber--,
          competitionName: wcif.shortName,
          activityCode: groupActivity.activityCode,
          round,
          competitor
        })
      );
      const scorecardsOnLastPage = groupScorecards.length % 4;
      return scorecardsOnLastPage === 0
        ? groupScorecards
        : groupScorecards.concat(Array.from({ length: 4 - scorecardsOnLastPage }, () => ({})));
    });
  });
};

const scorecard = ({
  scorecardNumber,
  competitionName,
  activityCode,
  round,
  competitor
}) => {
  const { eventId, roundNumber, groupNumber } = parseActivityCode(activityCode);
  const { cutoff, timeLimit } = round;
  const attemptCount = maxAttemptCountByFormat[round.format];

  return [
    { text: scorecardNumber, fontSize: 10 },
    { text: competitionName, bold: true, fontSize: 15, margin: [0, 0, 0, 10], alignment: 'center' },
    {
      margin: [25, 0, 0, 0],
      table: {
        widths: ['*', 'auto', 'auto'],
        body: [
          columnLabels(['Event', 'Round', 'Group']),
          [eventNameById(eventId), { text: roundNumber, alignment: 'center' }, { text: groupNumber, alignment: 'center' }]
        ]
      }
    },
    {
      margin: [25, 0, 0, 0],
      table: {
        widths: ['auto', '*'],
        body: [
          columnLabels(['ID', 'Name']),
          [{ text: competitor.registrantId, alignment: 'center' }, { text: pdfName(competitor.name), maxHeight: 20 /* See: https://github.com/bpampuch/pdfmake/issues/264#issuecomment-108347567 */ }]
        ]
      }
    },
    {
      margin: [0, 10, 0, 0],
      table: {
        widths: [16, 25, '*', 25, 25], /* Note: 16 (width) + 4 + 4 (defult left and right padding) + 1 (left border) = 25 */
        body: [
          columnLabels(['', 'Scr', 'Result', 'Judge', 'Comp'], { alignment: 'center' }),
          ...attemptRows(cutoff, attemptCount),
          [{ text: 'Extra attempt', ...noBorder, colSpan: 5, margin: [0, 1], fontSize: 10 }],
          attemptRow('_'),
          [{ text: '', ...noBorder, colSpan: 5, margin: [0, 1] }]
        ]
      }
    },
    {
      fontSize: 10,
      columns: [
        cutoff ? { text: `Cutoff: ${cutoffToString(cutoff, eventId)}`, alignment: 'center' } : {},
        timeLimit ? { text: `Time limit: ${timeLimitToString(timeLimit)}`, alignment: 'center' } : {}
      ]
    },
  ];
};

const columnLabels = (labels, style = {}) =>
  labels.map(label => ({
    ...style, ...noBorder, fontSize: 9, text: label
  }));

const attemptRows = (cutoff, attemptCount) =>
  Array.from({ length: attemptCount }, (_, attemptIndex) => attemptRow(attemptIndex + 1))
    .reduce((rows, attemptRow, attemptIndex) =>
      (attemptIndex + 1 === attemptCount)
        ? [...rows, attemptRow]
        : [ ...rows, attemptRow,
            attemptsSeparator(cutoff && (attemptIndex + 1 === cutoff.numberOfAttempts))
          ]
    , []);

const attemptsSeparator = cutoffLine => [{
  ...noBorder, colSpan: 5, margin: [0, 1],
  columns: !cutoffLine ? [] : [{
    canvas: [{
      type: 'line',
      x1: 0, y1: 0,
      x2: (pageWidth - 4 * scorecardMargin) / 2, y2: 0,
      dash: { length: 5 },
    }]
  }]
}];

const attemptRow = attemptNumber =>
  [{ text: attemptNumber, ...noBorder, fontSize: 20, bold: true, alignment: 'center' }, {}, {}, {} ,{}];

const noBorder = { border: [false, false, false, false] };