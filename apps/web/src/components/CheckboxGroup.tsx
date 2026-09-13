import type { ReactElement } from 'react';

/** Props for {@link CheckboxGroup}. */
interface CheckboxGroupProps<T extends string> {
  /** Heading for the group. */
  readonly legend: string;
  /** Every option, in display order. */
  readonly options: readonly T[];
  /** The options currently checked. */
  readonly selected: readonly T[];
  /** Called with the full new selection whenever a box is toggled. */
  readonly onChange: (selected: T[]) => void;
  /** Display text for an option. Defaults to the option itself. */
  readonly labelFor?: (option: T) => string;
}

/**
 * A fieldset of checkboxes over a closed vocabulary.
 *
 * @param props - The options, selection and change handler.
 * @returns The fieldset element.
 */
export function CheckboxGroup<T extends string>({
  legend,
  options,
  selected,
  onChange,
  labelFor,
}: CheckboxGroupProps<T>): ReactElement {
  function toggle(option: T, checked: boolean): void {
    onChange(checked ? [...selected, option] : selected.filter((value) => value !== option));
  }

  return (
    <fieldset className="filter-group">
      <legend>{legend}</legend>
      {options.map((option) => (
        <label key={option} className="filter-option">
          <input
            type="checkbox"
            checked={selected.includes(option)}
            onChange={(event) => toggle(option, event.target.checked)}
          />
          {labelFor === undefined ? option : labelFor(option)}
        </label>
      ))}
    </fieldset>
  );
}
