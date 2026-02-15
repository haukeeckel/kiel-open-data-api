export function postalCodePopulationCsvWithHeaderAliasFixture(): string {
  return (
    [
      'Land;Stadt;Kategorie;"PLZ-\nBereich";Merkmal;2000;2023',
      'de-sh;Kiel;Bevoelkerung;24103;Jahr;10.141;12333',
      'de-sh;Kiel;Bevoelkerung;24105;Jahr;19.466;20815',
      'de-sh;Kiel;Bevoelkerung;24103;Nicht relevant;1;2',
    ].join('\n') + '\n'
  );
}
