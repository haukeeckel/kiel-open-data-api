function csv(lines: readonly string[]): string {
  return `${lines.join('\n')}\n`;
}

export function districtsPopulationCsvFixture(): string {
  return csv([
    'Merkmal;Stadtteil;2022;2023',
    'Einwohner insgesamt;Altstadt;1213;1220',
    'Einwohner insgesamt;Gaarden-Ost;17900;18000',
    'Irgendwas anderes;Altstadt;1;2',
  ]);
}

export function districtsPopulationSingleAreaCsvFixture(): string {
  return csv(['Merkmal;Stadtteil;2022;2023', 'Einwohner insgesamt;Altstadt;1213;1220']);
}

export function districtsPopulationSingleYearCsvFixture(): string {
  return csv(['Merkmal;Stadtteil;2022', 'Einwohner insgesamt;Altstadt;1213']);
}

export function districtsPopulationSpacedHeadersCsvFixture(): string {
  return csv([' Merkmal ; Stadtteil ;2022', 'Einwohner insgesamt;Altstadt;1213']);
}

export function districtsMissingRequiredColumnsCsvFixture(): string {
  return csv(['Name;2022;2023', 'Altstadt;1213;1220']);
}

export function districtsNoYearColumnsCsvFixture(): string {
  return csv(['Merkmal;Stadtteil;foo;bar', 'Einwohner insgesamt;Altstadt;1213;1220']);
}

export function districtsPopulationCommaDelimitedCsvFixture(): string {
  return csv([
    'Merkmal,Stadtteil,2022,2023',
    'Einwohner insgesamt,Altstadt,1213,1220',
    'Einwohner insgesamt,Gaarden-Ost,17900,18000',
  ]);
}

export function districtsUnemployedDateColumnsCsvFixture(): string {
  return csv([
    'Land;Stadt;Kategorie;Merkmal;Stadtteilnummer;Stadtteil;31.12.2023;31.12.2022',
    'de-sh;Kiel;wirtschaft_arbeit;Arbeitslose;1;Altstadt;16;14',
  ]);
}

export function districtsGenderSingleRowCsvFixture(): string {
  return csv([
    'Land;Stadt;Kategorie;Merkmal;Datum;Stadtteilnummer;Stadtteil;insgesamt;maennlich;weiblich',
    'de-sh;Kiel;Bevoelkerung;Einwohner insgesamt;2023_12_31;1;Altstadt;1220;638;582',
  ]);
}

export function districtsHouseholdsCsvFixture(): string {
  return csv([
    'Land;Stadt;Kategorie;Jahr;Stadtteile;Merkmal;Einpersonen;Paar ohne Kind;Paar mit Kindern;Paar mit Nachkommen;Alleinerziehende;Sonst. Mehrpersonenhaushalte',
    'de-sh;Kiel;Bevoelkerung;31.12.2022;Altstadt;Haushalte;500;180;32;7;11;30',
    'de-sh;Kiel;Bevoelkerung;31.12.2023;Altstadt;Haushalte;505;181;31;8;12;31',
    'de-sh;Kiel;Bevoelkerung;31.12.2022;Gaarden-Ost;Haushalte;3200;1500;720;165;170;280',
    'de-sh;Kiel;Bevoelkerung;31.12.2023;Gaarden-Ost;Haushalte;3220;1510;730;170;183;290',
  ]);
}

export function districtsMaritalStatusCsvFixture(): string {
  return csv([
    'Land;Stadt;Kategorie;Stadtteil;Jahr;ledig;verheiratet;verwitwet;geschieden',
    'de-sh;Kiel;Bevoelkerung;Altstadt;31_12_2022;690;332;90;83',
    'de-sh;Kiel;Bevoelkerung;Altstadt;31_12_2023;702;339;94;85',
    'de-sh;Kiel;Bevoelkerung;Vorstadt;31_12_2022;1014;365;97;127',
    'de-sh;Kiel;Bevoelkerung;Vorstadt;31_12_2023;1038;377;102;131',
  ]);
}

export function districtsGenderCsvFixture(): string {
  return csv([
    'Land;Stadt;Kategorie;Merkmal;Datum;Stadtteilnummer;Stadtteil;insgesamt;maennlich;weiblich',
    'de-sh;Kiel;Bevoelkerung;Einwohner insgesamt;2022_12_31;1;Altstadt;1213;631;582',
    'de-sh;Kiel;Bevoelkerung;Einwohner insgesamt;2023_12_31;1;Altstadt;1220;638;582',
    'de-sh;Kiel;Bevoelkerung;Einwohner insgesamt;2022_12_31;2;Vorstadt;1600;800;800',
    'de-sh;Kiel;Bevoelkerung;Einwohner insgesamt;2023_12_31;2;Vorstadt;1648;829;819',
    'de-sh;Kiel;Bevoelkerung;Nicht relevant;2023_12_31;2;Vorstadt;9999;1;1',
  ]);
}

export function districtsForeignGenderCsvFixture(): string {
  return csv([
    'Land;Stadt;Kategorie;Merkmal;Datum;Stadtteilnummer;Stadtteil;insgesamt;maennlich;weiblich',
    'de-sh;Kiel;Bevoelkerung;Auslaender;2022_12_31;1;Altstadt   ;200;120;80',
    'de-sh;Kiel;Bevoelkerung;Auslaender;2023_12_31;1;Altstadt   ;210;125;85',
    'de-sh;Kiel;Bevoelkerung;Auslaender;2023_12_31;1;Altstadt   ;212;127;85',
    'de-sh;Kiel;Bevoelkerung;Auslaender;2022_12_31;2;Vorstadt;320;158;162',
    'de-sh;Kiel;Bevoelkerung;Auslaender;2023_12_31;2;Vorstadt;324;160;164',
    'de-sh;Kiel;Bevoelkerung;Nicht relevant;2023_12_31;2;Vorstadt;9999;1;1',
  ]);
}

export function districtsForeignGenderDedupeCsvFixture(): string {
  return csv([
    'Land;Stadt;Kategorie;Merkmal;Datum;Stadtteilnummer;Stadtteil;insgesamt;maennlich;weiblich',
    'de-sh;Kiel;Bevoelkerung;Auslaender;2023_12_31;1;Altstadt;100;10;90',
    'de-sh;Kiel;Bevoelkerung;Auslaender;2023_12_31;1;Altstadt;200;20;180',
    'de-sh;Kiel;Bevoelkerung;Auslaender;2023_12_31;1;Altstadt;300;30;270',
  ]);
}

export function districtsMigrantGenderCsvFixture(): string {
  return csv([
    'Land;Stadt;Kategorie;Merkmal;Datum;Stadtteilnummer;Stadtteil;insgesamt;m\u00e4nnlich;weiblich',
    'de-sh;Kiel;Bev\u00f6lkerung;Einwohner mit Migrationshintergrund;2022_12_31;1;Altstadt   ;350;190;160',
    'de-sh;Kiel;Bev\u00f6lkerung;Einwohner mit Migrationshintergrund;2023_12_31;1;Altstadt   ;360;195;165',
    'de-sh;Kiel;Bev\u00f6lkerung;Einwohner mit Migrationshintergrund;2023_12_31;1;Altstadt   ;364;199;165',
    'de-sh;Kiel;Bev\u00f6lkerung;Einwohner mit Migrationshintergrund;2022_12_31;2;Vorstadt;500;245;255',
    'de-sh;Kiel;Bev\u00f6lkerung;Einwohner mit Migrationshintergrund;2023_12_31;2;Vorstadt;518;253;265',
    'de-sh;Kiel;Bev\u00f6lkerung;Nicht relevant;2023_12_31;2;Vorstadt;9999;1;1',
  ]);
}

export function districtsForeignCountCsvFixture(): string {
  return csv([
    'Kategorie;Merkmal;Stadtteilnummer;Stadtteil;2022;2023',
    'Bevoelkerung;Auslaender;1;Altstadt   ;214;212',
    'Bevoelkerung;Auslaender;2;Vorstadt      ;288;324',
    'Bevoelkerung;Nicht relevant;2;Vorstadt;999;999',
  ]);
}

export function districtsAgeGroupsCsvFixture(): string {
  return csv([
    'Land;Stadt;Kategorie;Datum;Stadtteilnummer;Merkmal;Stadtteil;0 bis unter 3;3 bis unter 6;6 bis unter 10;10 bis unter 12;12 bis unter 15;15 bis unter 18;18 bis unter 21;21 bis unter 25;25 bis unter 30;30 bis unter 35;35 bis unter 40;40 bis unter 45;45 bis unter 50;50 bis unter 55;55 bis unter 60;60 bis unter 65;65 bis unter 70;70 bis unter 75;75 bis unter 80;80 und aelter',
    'de-sh;Kiel;Bevoelkerung;2022_12_31;1;Einwohner nach Altersgruppen;Altstadt;18;13;12;7;2;9;35;130;150;135;82;70;48;52;60;53;42;46;47;140',
    'de-sh;Kiel;Bevoelkerung;2023_12_31;1;Einwohner nach Altersgruppen;Altstadt;19;14;14;8;1;10;39;143;158;141;85;74;49;54;63;55;43;48;49;153',
    'de-sh;Kiel;Bevoelkerung;2022_12_31;2;Einwohner nach Altersgruppen;Vorstadt;31;33;28;7;16;13;44;154;298;231;90;74;72;67;81;63;57;47;62;111',
    'de-sh;Kiel;Bevoelkerung;2023_12_31;2;Einwohner nach Altersgruppen;Vorstadt;33;35;30;7;18;14;46;162;309;239;94;77;74;70;84;66;60;49;66;115',
  ]);
}

export function districtsAreaHectaresCsvFixture(): string {
  return csv([
    'Land;Stadt;Kategorie;Merkmal;Jahr;Stadtteilnummer;Stadtteil;Hektar',
    'de-sh;Kiel;geo;Flaechen in Hektar;2019;1;Altstadt;35,0987',
    'de-sh;Kiel;geo;Flaechen in Hektar;2020;1;Altstadt;35,0987',
    'de-sh;Kiel;geo;Flaechen in Hektar;2019;2;Vorstadt;45,8515',
    'de-sh;Kiel;geo;Flaechen in Hektar;2020;2;Vorstadt;45,8515',
  ]);
}

export function districtsUnemployedCountCsvFixture(): string {
  return csv([
    'Land;Stadt;Kategorie;Merkmal;Stadtteilnummer;Stadtteil;31.12.2023;31.12.2022',
    'de-sh;Kiel;wirtschaft_arbeit;Arbeitslose;1;Altstadt;16;14',
    'de-sh;Kiel;wirtschaft_arbeit;Arbeitslose;2;Vorstadt;43;43',
  ]);
}

export function districtsUnemployedRateCsvFixture(): string {
  return csv([
    'Land;Stadt;Kategorie;Merkmal;Stadtteilnummer;Stadtteil;31.12.2019;31.12.2018',
    'de-sh;Kiel;wirtschaft_arbeit;Betroffenheitsquote;1;Altstadt;1,6;2,3',
    'de-sh;Kiel;wirtschaft_arbeit;Betroffenheitsquote;2;Vorstadt;4,2;3,8',
  ]);
}

export function districtsReligionCsvFixture(): string {
  return csv([
    'Land;Stadt;Kategorie;Jahr;Stadtteil;evangelisch;katholisch;sonstige/ohne',
    'de-sh;Kiel;Bevoelkerung;2022;Altstadt;340;90;770',
    'de-sh;Kiel;Bevoelkerung;2023;Altstadt;344;89;787',
    'de-sh;Kiel;Bevoelkerung;2022;Vorstadt;410;94;1096',
    'de-sh;Kiel;Bevoelkerung;2023;Vorstadt;414;95;1139',
  ]);
}

export function districtsForeignNationalitiesSelectedCsvFixture(): string {
  return csv([
    'Land;Stadt;Kategorie;Jahr;Stadtteil;Tuerkei;Polen;Irak;Russland;Ukraine;Syrien;Bulgarien',
    'de-sh;Kiel;Bevoelkerung;2022;Altstadt   ;7;3;8;15;20;6;5',
    'de-sh;Kiel;Bevoelkerung;2023;Altstadt        ;8;4;9;16;21;7;6',
    'de-sh;Kiel;Bevoelkerung;2022;Vorstadt      ;10;7;4;20;14;10;',
    'de-sh;Kiel;Bevoelkerung;2023;Vorstadt      ;11;8;5;22;16;12;1',
  ]);
}

export function districtsForeignAgeGroupsCsvFixture(): string {
  return csv([
    'Land;Stadt;Kategorie;Datum;Stadtteilnummer;Merkmal;Stadtteil;0 bis unter 3;3 bis unter 6; 6 bis unter 10;10 bis unter 12;12 bis unter 15;15 bis unter 18;18 bis unter 21;21 bis unter 25;25 bis unter 30;30 bis unter 35;35 bis unter 40;40 bis unter 45;45 bis unter 50;50 bis unter 55;55 bis unter 60;60 bis unter 65;65 bis unter 70;70 bis unter 75;75 bis unter 80;80 und aelter',
    'de-sh;Kiel;Bevoelkerung;2022_12_31;1;Einwohner nach Altersgruppen;Altstadt   ;4;2;4;3;;5;6;27;32;30;23;17;15;13;10;5;7;4;2;3',
    'de-sh;Kiel;Bevoelkerung;2023_12_31;1;Einwohner nach Altersgruppen;Altstadt        ;4;2;4;3;;5;6;27;32;30;23;17;15;13;10;5;7;4;2;3',
    'de-sh;Kiel;Bevoelkerung;2022_12_31;2;Einwohner nach Altersgruppen;Vorstadt      ;10;15;16;2;8;7;6;22;67;56;28;17;16;16;13;7;4;5;2;7',
    'de-sh;Kiel;Bevoelkerung;2023_12_31;2;Einwohner nach Altersgruppen;Vorstadt      ;10;15;16;2;8;7;6;22;67;56;28;17;16;16;13;7;4;5;2;7',
  ]);
}

export function subdistrictPopulationCsvFixture(): string {
  return csv([
    'Land;Stadt;Kategorie;Merkmal;Ortsteilnummer;Ortsteil;2022;2022;2023',
    'de-sh;Kiel;Bevoelkerung;Einwohner insgesamt;1;Schilksee   ;4880;4857;4900',
    'de-sh;Kiel;Bevoelkerung;Einwohner insgesamt;2;Pries/Friedrichsort;9641;9743;9800',
    'de-sh;Kiel;Bevoelkerung;Nicht relevant;1;Schilksee;1;2;3',
  ]);
}

export function subdistrictAgeGroupsCsvFixture(): string {
  return csv([
    'Land;Stadt;Kategorie;Merkmal;Datum;Ortsteilnummer;Ortsteil;0-<5;5-<10;10-<15;15-<20;20-<25;25-<30;30-<35;35-<40;40-<45;45-<50;50-<55;55-<60;60-<65;65-<70;70-<75;75-<80;80-<85;85 und Aelter',
    'de-sh;Kiel;Bevoelkerung;Einwohner nach Altersgruppen;2022_12_31;1;Schilksee   ;140;145;140;150;120;110;160;180;220;200;240;370;400;390;450;455;500;350',
    'de-sh;Kiel;Bevoelkerung;Einwohner nach Altersgruppen;2023_12_31;1;Schilksee   ;144;148;143;157;121;119;167;188;223;208;251;381;412;395;461;463;519;357',
    'de-sh;Kiel;Bevoelkerung;Einwohner nach Altersgruppen;2022_12_31;2;Pries/Friedrichsort;420;460;480;440;480;530;600;600;590;560;660;850;720;570;470;390;400;360',
    'de-sh;Kiel;Bevoelkerung;Einwohner nach Altersgruppen;2023_12_31;2;Pries/Friedrichsort;423;470;494;452;487;537;612;607;599;574;676;863;733;577;478;393;405;363',
    'de-sh;Kiel;Bevoelkerung;Nicht relevant;2023_12_31;1;Schilksee;1;1;1;1;1;1;1;1;1;1;1;1;1;1;1;1;1;1',
  ]);
}

export function subdistrictGenderCsvFixture(): string {
  return csv([
    'Land;Stadt;Kategorie;Merkmal;Datum;Ortsteilnummer;Ortsteil;insgesamt;maennlich;weiblich',
    'de-sh;Kiel;Bevoelkerung;Einwohner insgesamt;2022_12_31;1;Schilksee   ;4880;2262;2618',
    'de-sh;Kiel;Bevoelkerung;Einwohner insgesamt;2023_12_31;1;Schilksee   ;4857;2249;2608',
    'de-sh;Kiel;Bevoelkerung;Einwohner insgesamt;2023_12_31;1;Schilksee   ;4858;2250;2608',
    'de-sh;Kiel;Bevoelkerung;Einwohner insgesamt;2022_12_31;2;Pries/Friedrichsort;9641;4720;4921',
    'de-sh;Kiel;Bevoelkerung;Einwohner insgesamt;2023_12_31;2;Pries/Friedrichsort;9743;4776;4967',
    'de-sh;Kiel;Bevoelkerung;Nicht relevant;2023_12_31;1;Schilksee;9999;1;1',
  ]);
}

export function subdistrictForeignGenderCsvFixture(): string {
  return csv([
    'Kategorie;Merkmal;Datum;Ortsteilnummer;Ortsteil;insgesamt;maennlich;weiblich',
    'Bevoelkerung;Auslaender;2022_12_31;1;Schilksee   ;193;88;105',
    'Bevoelkerung;Auslaender;2023_12_31;1;Schilksee   ;201;103;98',
    'Bevoelkerung;Auslaender;2023_12_31;1;Schilksee   ;202;104;98',
    'Bevoelkerung;Auslaender;2022_12_31;2;Pries/Friedrichsort;1138;564;574',
    'Bevoelkerung;Auslaender;2023_12_31;2;Pries/Friedrichsort;1214;601;613',
    'Bevoelkerung;Nicht relevant;2023_12_31;1;Schilksee;9999;1;1',
  ]);
}

export function subdistrictMigrantGenderCsvFixture(): string {
  return csv([
    'Land;Stadt;Kategorie;Merkmal;Datum;Ortsteilnummer;Ortsteil;insgesamt;m\u00e4nnlich;weiblich',
    'de-sh;Kiel;Bev\u00f6lkerung;Einwohner mit Migrationshintergrund;2022_12_31;1;Schilksee   ;914;407;507',
    'de-sh;Kiel;Bev\u00f6lkerung;Einwohner mit Migrationshintergrund;2023_12_31;1;Schilksee   ;901;410;491',
    'de-sh;Kiel;Bev\u00f6lkerung;Einwohner mit Migrationshintergrund;2023_12_31;1;Schilksee   ;902;411;491',
    'de-sh;Kiel;Bev\u00f6lkerung;Einwohner mit Migrationshintergrund;2022_12_31;2;Pries/Friedrichsort;2349;1147;1202',
    'de-sh;Kiel;Bev\u00f6lkerung;Einwohner mit Migrationshintergrund;2023_12_31;2;Pries/Friedrichsort;2434;1193;1241',
    'de-sh;Kiel;Bev\u00f6lkerung;Nicht relevant;2023_12_31;1;Schilksee;9999;1;1',
  ]);
}

export function postalCodePopulationCsvWithHeaderAliasFixture(): string {
  return csv([
    'Land;Stadt;Kategorie;"PLZ-\nBereich";Merkmal;2000;2023',
    'de-sh;Kiel;Bevoelkerung;24103;Jahr;10.141;12333',
    'de-sh;Kiel;Bevoelkerung;24105;Jahr;19.466;20815',
    'de-sh;Kiel;Bevoelkerung;24103;Nicht relevant;1;2',
  ]);
}
