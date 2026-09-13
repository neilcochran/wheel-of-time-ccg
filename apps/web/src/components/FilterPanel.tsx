import type { ReactElement } from 'react';

import {
  ALLEGIANCES,
  CARD_SETS,
  CARD_SET_IDS,
  CARD_TYPES,
  RARITY_CLASSES,
  TRAITS,
} from '@wot/cards';

import { EMPTY_FILTER, isEmptyFilter, parseCardSort } from '../cards/filter.ts';
import type { CardFilter } from '../cards/filter.ts';

import { CheckboxGroup } from './CheckboxGroup.tsx';

/** Props for {@link FilterPanel}. */
interface FilterPanelProps {
  /** The filter currently applied. */
  readonly filter: CardFilter;
  /** Called with the whole new filter on any change. */
  readonly onChange: (filter: CardFilter) => void;
  /** How many cards the filter matches. */
  readonly matchCount: number;
  /** How many cards there are in all. */
  readonly totalCount: number;
}

/** Set names by id, for the set checkboxes. */
const SET_NAMES: ReadonlyMap<string, string> = new Map(CARD_SETS.map((set) => [set.id, set.name]));

/**
 * The browser's search box, sort order and facet controls.
 *
 * @param props - The filter, its change handler and the match counts.
 * @returns The panel element.
 */
export function FilterPanel({
  filter,
  onChange,
  matchCount,
  totalCount,
}: FilterPanelProps): ReactElement {
  const selectedTrait = filter.traits[0] ?? '';

  return (
    <aside className="filter-panel" aria-label="Card filters">
      <label className="filter-search">
        <span className="visually-hidden">Search</span>
        <input
          type="search"
          placeholder="Search names and text"
          value={filter.query}
          onChange={(event) => onChange({ ...filter, query: event.target.value })}
        />
      </label>

      <p className="filter-summary" role="status">
        <span>
          {matchCount === totalCount
            ? `${totalCount} cards`
            : `${matchCount} of ${totalCount} cards`}
        </span>
        {isEmptyFilter(filter) ? null : (
          <button type="button" onClick={() => onChange({ ...EMPTY_FILTER, sort: filter.sort })}>
            Clear
          </button>
        )}
      </p>

      <label className="filter-select">
        Sort
        <select
          value={filter.sort}
          onChange={(event) => onChange({ ...filter, sort: parseCardSort(event.target.value) })}
        >
          <option value="collector">Set and number</option>
          <option value="name">Name</option>
        </select>
      </label>

      <CheckboxGroup
        legend="Set"
        options={CARD_SET_IDS}
        selected={filter.sets}
        onChange={(sets) => onChange({ ...filter, sets })}
        labelFor={(id) => SET_NAMES.get(id) ?? id}
      />
      <CheckboxGroup
        legend="Type"
        options={CARD_TYPES}
        selected={filter.types}
        onChange={(types) => onChange({ ...filter, types })}
      />
      <CheckboxGroup
        legend="Rarity"
        options={RARITY_CLASSES}
        selected={filter.rarities}
        onChange={(rarities) => onChange({ ...filter, rarities })}
      />
      <CheckboxGroup
        legend="Allegiance"
        options={ALLEGIANCES}
        selected={filter.allegiances}
        onChange={(allegiances) => onChange({ ...filter, allegiances })}
      />

      <label className="filter-select">
        Trait
        <select
          value={selectedTrait}
          onChange={(event) => {
            const trait = TRAITS.find((candidate) => candidate === event.target.value);
            onChange({ ...filter, traits: trait === undefined ? [] : [trait] });
          }}
        >
          <option value="">Any</option>
          {TRAITS.map((trait) => (
            <option key={trait} value={trait}>
              {trait}
            </option>
          ))}
        </select>
      </label>
    </aside>
  );
}
