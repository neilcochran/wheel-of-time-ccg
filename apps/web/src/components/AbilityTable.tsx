import type { ReactElement } from 'react';

import { ABILITY_TRACKS } from '@wot/cards';
import type { AbilityRating, AbilityTrack } from '@wot/cards';

import { ABILITY_TRACK_LABELS } from '../cards/labels.ts';

/** Props for {@link AbilityTable}. */
interface AbilityTableProps {
  /** A card's ratings, one per track. */
  readonly abilities: Readonly<Record<AbilityTrack, AbilityRating>>;
}

/**
 * A card's ability and recruit cost in each of the four tracks.
 *
 * @param props - The ratings.
 * @returns The table element.
 */
export function AbilityTable({ abilities }: AbilityTableProps): ReactElement {
  return (
    <table className="ability-table">
      <caption>Abilities</caption>
      <thead>
        <tr>
          <th scope="col">Track</th>
          <th scope="col">Ability</th>
          <th scope="col">Recruit cost</th>
        </tr>
      </thead>
      <tbody>
        {ABILITY_TRACKS.map((track) => {
          const rating = abilities[track];
          return (
            <tr key={track}>
              <th scope="row">
                <span className={`track-dot track-dot--${track}`} aria-hidden="true" />
                {ABILITY_TRACK_LABELS[track]}
              </th>
              <td>{rating.ability ?? '-'}</td>
              <td>{rating.cost ?? '-'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
