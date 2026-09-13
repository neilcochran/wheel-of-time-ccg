import type { ReactElement } from 'react';

import type { DeckIssue, DeckReport } from '../decks/checkDeck.ts';
import { DECK_SIDE_LABELS, legalityLabel } from '../decks/labels.ts';

/** Props for {@link DeckReportPanel}. */
interface DeckReportPanelProps {
  /** The deck's legality report. */
  readonly report: DeckReport;
}

/** Props for {@link IssueGroup}. */
interface IssueGroupProps {
  /** Heading for the group. */
  readonly title: string;
  /** The issues to list. */
  readonly issues: readonly DeckIssue[];
  /** Which tier the issues belong to, for styling. */
  readonly tier: 'error' | 'warning' | 'tournament';
}

/**
 * One tier of issues under a heading, or nothing when the tier is empty.
 *
 * @param props - The heading, issues and tier.
 * @returns The group, or null when there are no issues.
 */
function IssueGroup({ title, issues, tier }: IssueGroupProps): ReactElement | null {
  if (issues.length === 0) {
    return null;
  }
  return (
    <div className={`issue-group issue-group--${tier}`}>
      <h3>{title}</h3>
      <ul>
        {issues.map((issue, index) => (
          <li key={`${issue.code}-${index}`}>{issue.message}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A deck's size, side and legality, with every problem the check found.
 *
 * @param props - The report.
 * @returns The panel element.
 */
export function DeckReportPanel({ report }: DeckReportPanelProps): ReactElement {
  return (
    <section className="deck-report" aria-label="Deck status">
      <p className="deck-report__summary">
        <strong>{legalityLabel(report)}</strong>
        <span>
          {report.size} cards
          {report.side === undefined ? '' : `, ${DECK_SIDE_LABELS[report.side]}`}
        </span>
      </p>
      <IssueGroup title="Must fix" issues={report.errors} tier="error" />
      <IssueGroup title="Worth a look" issues={report.warnings} tier="warning" />
      <IssueGroup
        title="For tournament play"
        issues={report.tournamentProblems}
        tier="tournament"
      />
    </section>
  );
}
