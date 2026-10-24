// Inventario: gli oggetti del personaggio in una tabella con quantità, peso, costo e note.
// Gli oggetti del manuale (SRD 5.1) arrivano già con peso, costo e regole in breve; gli altri si scrivono a mano.
// Pesi in kg come nel manuale italiano (1 libbra = 0,5 kg), costi in monete di rame (1 mo = 100 mr).

const ITEM_RARITIES = ['comune', 'non comune', 'rara', 'molto rara', 'leggendaria', 'artefatto'];
const MAX_ATTUNED = 3;

// ---------------------------------------------------------------------------
// Oggetti del manuale
// ---------------------------------------------------------------------------

// Righe: [chiave, nome, nome inglese, costo in mr, peso in kg, regole in breve, altri nomi]
const SRD_GEAR_ROWS = {
  Equipaggiamento: [
    ['abacus', 'Abaco', 'Abacus', 200, 1],
    ['acid', 'Acido (fiala)', 'Acid (vial)', 2500, 0.5, 'Azione: lo spruzzi su una creatura entro 1,5 m o lanci la fiala fino a 6 m (attacco a distanza, arma improvvisata): 2d6 danni da acido.'],
    ['alchemistfire', 'Fuoco dell\'alchimista (ampolla)', 'Alchemist\'s fire (flask)', 5000, 0.5, 'Azione: lo lanci fino a 6 m (attacco a distanza, arma improvvisata): 1d4 danni da fuoco all\'inizio di ogni turno del bersaglio, finché non lo spegne con un\'azione e una prova di Destrezza CD 10.'],
    ['antitoxin', 'Antitossina (fiala)', 'Antitoxin (vial)', 5000, 0, 'Chi la beve ha vantaggio ai tiri salvezza contro il veleno per 1 ora. Non serve a non morti e costrutti.'],
    ['backpack', 'Zaino', 'Backpack', 200, 2.5, 'Contiene fino a 15 kg di equipaggiamento.'],
    ['ballbearings', 'Biglie (sacchetto da 1.000)', 'Ball bearings (bag of 1,000)', 100, 1, 'Azione: coprono un quadrato di 3 m. Chi lo attraversa: Destrezza CD 10 o cade prono (non chi si muove a metà velocità).'],
    ['barrel', 'Barile', 'Barrel', 200, 35, 'Contiene 160 litri di liquido.'],
    ['basket', 'Cesto', 'Basket', 40, 1],
    ['bedroll', 'Giaciglio', 'Bedroll', 100, 3.5, '', ['sacco a pelo']],
    ['bell', 'Campanella', 'Bell', 100, 0],
    ['blanket', 'Coperta', 'Blanket', 50, 1.5],
    ['blocktackle', 'Paranco', 'Block and tackle', 100, 2.5, 'Sollevi fino a quattro volte il peso che solleveresti da solo.', ['carrucola']],
    ['book', 'Libro', 'Book', 2500, 2.5],
    ['bottle', 'Bottiglia di vetro', 'Bottle, glass', 200, 1],
    ['bucket', 'Secchio', 'Bucket', 5, 1],
    ['caltrops', 'Triboli (sacchetto da 20)', 'Caltrops (bag of 20)', 100, 1, 'Azione: coprono un quadrato di 1,5 m. Chi ci entra: Destrezza CD 15 o si ferma e subisce 1 danno perforante; velocità −3 m finché non recupera almeno 1 PF.'],
    ['candle', 'Candela', 'Candle', 1, 0, 'Per 1 ora: luce intensa in un raggio di 1,5 m e fioca per altri 1,5 m.'],
    ['boltcase', 'Custodia per quadrelli', 'Case, crossbow bolt', 100, 0.5, 'Contiene fino a 20 quadrelli.'],
    ['mapcase', 'Custodia per mappe e pergamene', 'Case, map or scroll', 100, 0.5, 'Contiene fino a 10 fogli di carta o 5 di pergamena arrotolati.'],
    ['chain', 'Catena (3 m)', 'Chain (10 feet)', 500, 5, '10 PF. Si spezza con una prova di Forza CD 20.'],
    ['chalk', 'Gesso (1 pezzo)', 'Chalk (1 piece)', 1, 0],
    ['chest', 'Forziere', 'Chest', 500, 12.5],
    ['climberskit', 'Kit da scalatore', 'Climber\'s kit', 2500, 6, 'Azione: ti ancori. Non puoi cadere per più di 7,5 m dal punto d\'ancoraggio, né allontanarti di più senza staccarti.'],
    ['clothescommon', 'Abiti comuni', 'Clothes, common', 50, 1.5],
    ['costume', 'Costume', 'Clothes, costume', 500, 2],
    ['clothesfine', 'Abiti pregiati', 'Clothes, fine', 1500, 3],
    ['clothestraveler', 'Abiti da viaggiatore', 'Clothes, traveler\'s', 200, 2],
    ['crowbar', 'Piede di porco', 'Crowbar', 200, 2.5, 'Vantaggio alle prove di Forza in cui fare leva aiuta.'],
    ['fishingtackle', 'Attrezzatura da pesca', 'Fishing tackle', 100, 2, 'Canna, lenza, ami, galleggianti ed esche.'],
    ['flask', 'Fiasca o boccale', 'Flask or tankard', 2, 0.5],
    ['grapplinghook', 'Rampino', 'Grappling hook', 200, 2],
    ['hammer', 'Martello', 'Hammer', 100, 1.5],
    ['sledgehammer', 'Mazza da fabbro', 'Hammer, sledge', 200, 5],
    ['healerskit', 'Borsa del guaritore', 'Healer\'s kit', 500, 1.5, '10 usi. Azione: stabilizzi una creatura a 0 PF senza la prova di Saggezza (Medicina).', ['kit da guaritore', 'kit del guaritore']],
    ['holywater', 'Acqua santa (ampolla)', 'Holy water (flask)', 2500, 0.5, 'Azione: la spruzzi su una creatura entro 1,5 m o la lanci fino a 6 m (attacco a distanza, arma improvvisata): 2d6 danni radiosi a immondi e non morti.'],
    ['hourglass', 'Clessidra', 'Hourglass', 2500, 0.5],
    ['huntingtrap', 'Tagliola', 'Hunting trap', 500, 12.5, 'Chi ci mette il piede: Destrezza CD 13 o 1d4 danni perforanti e si ferma. Liberarsi: azione e Forza CD 13 (1 danno perforante a ogni prova fallita).'],
    ['ink', 'Inchiostro (boccetta)', 'Ink (1 ounce bottle)', 1000, 0],
    ['inkpen', 'Pennino', 'Ink pen', 2, 0],
    ['jug', 'Brocca o caraffa', 'Jug or pitcher', 2, 2],
    ['ladder', 'Scala a pioli (3 m)', 'Ladder (10-foot)', 10, 12.5],
    ['lamp', 'Lampada', 'Lamp', 50, 0.5, 'Luce intensa in un raggio di 4,5 m e fioca per altri 9 m; 6 ore con un\'ampolla d\'olio.'],
    ['bullseyelantern', 'Lanterna a lente sporgente', 'Lantern, bullseye', 1000, 1, 'Luce intensa in un cono di 18 m e fioca per altri 18 m; 6 ore con un\'ampolla d\'olio.', ['lanterna a occhio di bue']],
    ['hoodedlantern', 'Lanterna schermabile', 'Lantern, hooded', 500, 1, 'Luce intensa in un raggio di 9 m e fioca per altri 9 m; 6 ore con un\'ampolla d\'olio. Azione: abbassi lo schermo e resta luce fioca per 1,5 m.', ['lanterna']],
    ['lock', 'Lucchetto', 'Lock', 1000, 0.5, 'Con la chiave. Senza: Destrezza CD 15 con gli arnesi da scasso.', ['serratura']],
    ['magnifyingglass', 'Lente d\'ingrandimento', 'Magnifying glass', 10000, 0, 'Vantaggio alle prove per valutare o esaminare oggetti piccoli o molto dettagliati. Al sole accende un fuoco in 5 minuti.'],
    ['manacles', 'Manette', 'Manacles', 200, 3, 'Per creature Piccole o Medie. Liberarsi: Destrezza CD 20; spezzarle: Forza CD 20; 15 PF.'],
    ['messkit', 'Gavetta', 'Mess kit', 20, 0.5],
    ['mirror', 'Specchio d\'acciaio', 'Mirror, steel', 500, 0.25],
    ['oil', 'Olio (ampolla)', 'Oil (flask)', 10, 0.5, 'Azione: lo lanci fino a 6 m (attacco a distanza, arma improvvisata); se entro 1 minuto il bersaglio subisce danni da fuoco, ne subisce 5 in più. Versato a terra (1,5 m) e acceso brucia 2 round: 5 danni da fuoco.'],
    ['paper', 'Carta (un foglio)', 'Paper (one sheet)', 20, 0],
    ['parchment', 'Pergamena (un foglio)', 'Parchment (one sheet)', 10, 0],
    ['perfume', 'Profumo (fiala)', 'Perfume (vial)', 500, 0],
    ['minerspick', 'Piccone da minatore', 'Pick, miner\'s', 200, 5],
    ['piton', 'Chiodo da rocciatore', 'Piton', 5, 0.125],
    ['poison', 'Veleno base (fiala)', 'Poison, basic (vial)', 10000, 0, 'Azione: ricopri un\'arma tagliente o perforante o fino a 3 munizioni, per 1 minuto. Chi è colpito: Costituzione CD 10 o 1d4 danni da veleno.'],
    ['pole', 'Pertica (3 m)', 'Pole (10-foot)', 5, 3.5],
    ['ironpot', 'Pentola di ferro', 'Pot, iron', 200, 5],
    ['pouch', 'Borsa', 'Pouch', 50, 0.5, '', ['borsello', 'sacchetto']],
    ['quiver', 'Faretra', 'Quiver', 100, 0.5, 'Contiene fino a 20 frecce.'],
    ['ram', 'Ariete portatile', 'Ram, portable', 400, 17.5, '+4 alle prove di Forza per sfondare le porte; vantaggio se qualcuno ti aiuta.'],
    ['rations', 'Razioni (1 giorno)', 'Rations (1 day)', 50, 1, 'Cibo secco per un giorno.', ['razione']],
    ['robes', 'Vesti', 'Robes', 100, 2],
    ['ropehemp', 'Corda di canapa (15 m)', 'Rope, hempen (50 feet)', 100, 5, '2 PF. Si spezza con una prova di Forza CD 17.', ['corda']],
    ['ropesilk', 'Corda di seta (15 m)', 'Rope, silk (50 feet)', 1000, 2.5, '2 PF. Si spezza con una prova di Forza CD 17.'],
    ['sack', 'Sacco', 'Sack', 1, 0.25],
    ['scale', 'Bilancia da mercante', 'Scale, merchant\'s', 500, 1.5],
    ['sealingwax', 'Ceralacca', 'Sealing wax', 50, 0],
    ['shovel', 'Pala', 'Shovel', 200, 2.5],
    ['whistle', 'Fischietto', 'Signal whistle', 5, 0],
    ['signetring', 'Anello con sigillo', 'Signet ring', 500, 0],
    ['soap', 'Sapone', 'Soap', 2, 0],
    ['spellbook', 'Libro degli incantesimi', 'Spellbook', 5000, 1.5, '100 pagine di pergamena per gli incantesimi del mago.'],
    ['ironspikes', 'Chiodi di ferro (10)', 'Spikes, iron (10)', 100, 2.5],
    ['spyglass', 'Cannocchiale', 'Spyglass', 100000, 0.5, 'Gli oggetti sembrano grandi il doppio.'],
    ['tent', 'Tenda per due persone', 'Tent, two-person', 200, 10],
    ['tinderbox', 'Acciarino', 'Tinderbox', 50, 0.5, 'Azione: accendi una torcia o qualcosa con il combustibile esposto; altri fuochi in 1 minuto.', ['pietra focaia']],
    ['torch', 'Torcia', 'Torch', 1, 0.5, 'Brucia 1 ora: luce intensa in un raggio di 6 m e fioca per altri 6 m. Come arma: 1 danno da fuoco.', ['fiaccola']],
    ['vial', 'Fiala', 'Vial', 100, 0],
    ['waterskin', 'Otre', 'Waterskin', 20, 2.5, 'Contiene 2 litri d\'acqua (peso da pieno).', ['borraccia']],
    ['whetstone', 'Cote', 'Whetstone', 1, 0.5, '', ['pietra per affilare']]
  ],
  Munizioni: [
    ['arrows', 'Frecce (20)', 'Arrows (20)', 100, 0.5, '', ['freccia']],
    ['needles', 'Aghi da cerbottana (50)', 'Blowgun needles (50)', 100, 0.5],
    ['bolts', 'Quadrelli da balestra (20)', 'Crossbow bolts (20)', 100, 0.75, '', ['quadrello', 'dardi da balestra']],
    ['bullets', 'Proiettili da fionda (20)', 'Sling bullets (20)', 4, 0.75]
  ],
  'Focus da incantatore': [
    ['crystal', 'Focus arcano: cristallo', 'Arcane focus: crystal', 1000, 0.5, 'Sostituisce le componenti materiali senza costo indicato.'],
    ['orb', 'Focus arcano: globo', 'Arcane focus: orb', 2000, 1.5, 'Sostituisce le componenti materiali senza costo indicato.'],
    ['rod', 'Focus arcano: verga', 'Arcane focus: rod', 1000, 1, 'Sostituisce le componenti materiali senza costo indicato.'],
    ['arcanestaff', 'Focus arcano: bastone', 'Arcane focus: staff', 500, 2, 'Sostituisce le componenti materiali senza costo indicato. Si può usare come bastone ferrato.'],
    ['wand', 'Focus arcano: bacchetta', 'Arcane focus: wand', 1000, 0.5, 'Sostituisce le componenti materiali senza costo indicato.'],
    ['componentpouch', 'Borsa per componenti', 'Component pouch', 2500, 1, 'Contiene le componenti materiali senza costo indicato.'],
    ['mistletoe', 'Focus druidico: rametto di vischio', 'Druidic focus: sprig of mistletoe', 100, 0, 'Sostituisce le componenti materiali senza costo indicato.'],
    ['totem', 'Focus druidico: totem', 'Druidic focus: totem', 100, 0, 'Sostituisce le componenti materiali senza costo indicato.'],
    ['woodenstaff', 'Focus druidico: bastone di legno', 'Druidic focus: wooden staff', 500, 2, 'Sostituisce le componenti materiali senza costo indicato.'],
    ['yewwand', 'Focus druidico: bacchetta di tasso', 'Druidic focus: yew wand', 1000, 0.5, 'Sostituisce le componenti materiali senza costo indicato.'],
    ['amulet', 'Simbolo sacro: amuleto', 'Holy symbol: amulet', 500, 0.5, 'Si porta in vista o in mano: sostituisce le componenti materiali senza costo indicato.'],
    ['emblem', 'Simbolo sacro: emblema', 'Holy symbol: emblem', 500, 0, 'Inciso sullo scudo o sugli abiti: sostituisce le componenti materiali senza costo indicato.'],
    ['reliquary', 'Simbolo sacro: reliquiario', 'Holy symbol: reliquary', 500, 1, 'Sostituisce le componenti materiali senza costo indicato.']
  ],
  Strumenti: [
    ['thievestools', 'Arnesi da scasso', 'Thieves\' tools', 2500, 0.5, 'Con la competenza: la aggiungi alle prove per scassinare serrature e disattivare trappole.', ['attrezzi da scasso', 'strumenti da scasso', 'grimaldelli']],
    ['herbalismkit', 'Borsa da erborista', 'Herbalism kit', 500, 1.5, 'Con la competenza: identifichi le piante e prepari antitossine e pozioni di guarigione.', ['kit da erborista']],
    ['disguisekit', 'Trucchi per il camuffamento', 'Disguise kit', 2500, 1.5, 'Con la competenza: crei travestimenti.', ['kit per il camuffamento', 'kit da travestimento']],
    ['forgerykit', 'Kit da falsario', 'Forgery kit', 1500, 2.5, 'Con la competenza: falsifichi documenti.'],
    ['poisonerskit', 'Kit da avvelenatore', 'Poisoner\'s kit', 5000, 1, 'Con la competenza: prepari e usi i veleni.'],
    ['navigator', 'Strumenti da navigatore', 'Navigator\'s tools', 2500, 1, 'Con la competenza: tracci la rotta e ti orienti in mare.'],
    ['dice', 'Set di dadi', 'Dice set', 10, 0],
    ['cards', 'Mazzo di carte', 'Playing card set', 50, 0],
    ['alchemist', 'Scorte da alchimista', 'Alchemist\'s supplies', 5000, 4],
    ['brewer', 'Scorte da birraio', 'Brewer\'s supplies', 2000, 4.5],
    ['calligrapher', 'Scorte da calligrafo', 'Calligrapher\'s supplies', 1000, 2.5],
    ['carpenter', 'Strumenti da falegname', 'Carpenter\'s tools', 800, 3],
    ['cartographer', 'Strumenti da cartografo', 'Cartographer\'s tools', 1500, 3],
    ['cobbler', 'Strumenti da calzolaio', 'Cobbler\'s tools', 500, 2.5],
    ['cook', 'Utensili da cuoco', 'Cook\'s utensils', 100, 4],
    ['glassblower', 'Strumenti da soffiatore', 'Glassblower\'s tools', 3000, 2.5],
    ['jeweler', 'Strumenti da gioielliere', 'Jeweler\'s tools', 2500, 1],
    ['leatherworker', 'Strumenti da conciatore', 'Leatherworker\'s tools', 500, 2.5],
    ['mason', 'Strumenti da muratore', 'Mason\'s tools', 1000, 4],
    ['painter', 'Scorte da pittore', 'Painter\'s supplies', 1000, 2.5],
    ['potter', 'Strumenti da vasaio', 'Potter\'s tools', 1000, 1.5],
    ['smith', 'Strumenti da fabbro', 'Smith\'s tools', 2000, 4],
    ['tinker', 'Strumenti da inventore', 'Tinker\'s tools', 5000, 5],
    ['weaver', 'Strumenti da tessitore', 'Weaver\'s tools', 100, 2.5],
    ['woodcarver', 'Strumenti da intagliatore', 'Woodcarver\'s tools', 100, 2.5]
  ],
  'Strumenti musicali': [
    ['bagpipes', 'Cornamusa', 'Bagpipes', 3000, 3],
    ['drum', 'Tamburo', 'Drum', 600, 1.5],
    ['dulcimer', 'Salterio', 'Dulcimer', 2500, 5],
    ['flute', 'Flauto', 'Flute', 200, 0.5],
    ['lute', 'Liuto', 'Lute', 3500, 1],
    ['lyre', 'Lira', 'Lyre', 3000, 1],
    ['horn', 'Corno', 'Horn', 300, 1],
    ['panflute', 'Flauto di Pan', 'Pan flute', 1200, 1],
    ['shawm', 'Ciaramella', 'Shawm', 200, 0.5],
    ['viol', 'Viola', 'Viol', 3000, 0.5]
  ]
};

// Armature: [chiave, nome, nome inglese, costo in mr, peso in kg, tipo, CA, Forza richiesta, svantaggio a Furtività]
const SRD_ARMOR_ROWS = [
  ['padded', 'Armatura imbottita', 'Padded armor', 500, 4, 'light', 11, 0, true],
  ['leather', 'Armatura di cuoio', 'Leather armor', 1000, 5, 'light', 11, 0, false],
  ['studded', 'Armatura di cuoio borchiato', 'Studded leather armor', 4500, 6.5, 'light', 12, 0, false],
  ['hide', 'Armatura di pelle', 'Hide armor', 1000, 6, 'medium', 12, 0, false],
  ['chainshirt', 'Giaco di maglia', 'Chain shirt', 5000, 10, 'medium', 13, 0, false],
  ['scalemail', 'Corazza di scaglie', 'Scale mail', 5000, 22.5, 'medium', 14, 0, true],
  ['breastplate', 'Corazza di piastre', 'Breastplate', 40000, 10, 'medium', 14, 0, false],
  ['halfplate', 'Mezza armatura', 'Half plate', 75000, 20, 'medium', 15, 0, true],
  ['ringmail', 'Corazza ad anelli', 'Ring mail', 3000, 20, 'heavy', 14, 0, true],
  ['chainmail', 'Cotta di maglia', 'Chain mail', 7500, 27.5, 'heavy', 16, 13, true],
  ['splint', 'Corazza a strisce', 'Splint armor', 20000, 30, 'heavy', 17, 15, true],
  ['plate', 'Armatura completa', 'Plate armor', 150000, 32.5, 'heavy', 18, 15, true],
  ['shield', 'Scudo', 'Shield', 1000, 3, 'shield', 2, 0, false]
];

// Costo in mr e peso in kg delle armi del regolamento (vedi SRD_WEAPONS in srd.js)
const SRD_WEAPON_COST_WEIGHT = {
  club: [10, 1], dagger: [200, 0.5], greatclub: [20, 5], handaxe: [500, 1], javelin: [50, 1], lighthammer: [200, 1], mace: [500, 2],
  quarterstaff: [20, 2], sickle: [100, 1], spear: [100, 1.5], lightcrossbow: [2500, 2.5], dart: [5, 0.125], shortbow: [2500, 1], sling: [10, 0],
  battleaxe: [1000, 2], flail: [1000, 1], glaive: [2000, 3], greataxe: [3000, 3.5], greatsword: [5000, 3], halberd: [2000, 3], lance: [1000, 3],
  longsword: [1500, 1.5], maul: [1000, 5], morningstar: [1500, 2], pike: [500, 9], rapier: [2500, 1], scimitar: [2500, 1.5], shortsword: [1000, 1],
  trident: [500, 2], warpick: [500, 1], warhammer: [1500, 1], whip: [200, 1.5], blowgun: [1000, 0.5], handcrossbow: [7500, 1.5],
  heavycrossbow: [5000, 9], longbow: [5000, 1], net: [100, 1.5]
};

// Pozioni di guarigione (le altre pozioni e gli oggetti magici si scrivono a mano)
const SRD_POTION_ROWS = [
  ['healing', 'Pozione di guarigione', 'Potion of healing', 5000, 0.25, 'comune', '2d4+2'],
  ['greaterhealing', 'Pozione di guarigione superiore', 'Potion of greater healing', null, 0.25, 'non comune', '4d4+4'],
  ['superiorhealing', 'Pozione di guarigione suprema', 'Potion of superior healing', null, 0.25, 'rara', '8d4+8'],
  ['supremehealing', 'Pozione di guarigione massima', 'Potion of supreme healing', null, 0.25, 'molto rara', '10d4+20']
];

// Dotazioni: si aggiungono come oggetti separati. Contenuto: [chiave o nome, quantità]
const SRD_PACK_ROWS = [
  ['burglar', 'Dotazione da scassinatore', 'Burglar\'s pack', 1600, [['backpack', 1], ['ballbearings', 1], ['Spago (3 m)', 1], ['bell', 1], ['candle', 5], ['crowbar', 1], ['hammer', 1], ['piton', 10], ['hoodedlantern', 1], ['oil', 2], ['rations', 5], ['tinderbox', 1], ['waterskin', 1], ['ropehemp', 1]]],
  ['diplomat', 'Dotazione da diplomatico', 'Diplomat\'s pack', 3900, [['chest', 1], ['mapcase', 2], ['clothesfine', 1], ['ink', 1], ['inkpen', 1], ['lamp', 1], ['oil', 2], ['paper', 5], ['perfume', 1], ['sealingwax', 1], ['soap', 1]]],
  ['dungeoneer', 'Dotazione da esploratore di dungeon', 'Dungeoneer\'s pack', 1200, [['backpack', 1], ['crowbar', 1], ['hammer', 1], ['piton', 10], ['torch', 10], ['tinderbox', 1], ['rations', 10], ['waterskin', 1], ['ropehemp', 1]]],
  ['entertainer', 'Dotazione da intrattenitore', 'Entertainer\'s pack', 4000, [['backpack', 1], ['bedroll', 1], ['costume', 2], ['candle', 5], ['rations', 5], ['waterskin', 1], ['disguisekit', 1]]],
  ['explorer', 'Dotazione da esploratore', 'Explorer\'s pack', 1000, [['backpack', 1], ['bedroll', 1], ['messkit', 1], ['tinderbox', 1], ['torch', 10], ['rations', 10], ['waterskin', 1], ['ropehemp', 1]]],
  ['priest', 'Dotazione da sacerdote', 'Priest\'s pack', 1900, [['backpack', 1], ['blanket', 1], ['candle', 10], ['tinderbox', 1], ['Cassetta per le elemosine', 1], ['Blocchetto d\'incenso', 2], ['Incensiere', 1], ['Paramenti', 1], ['rations', 2], ['waterskin', 1]]],
  ['scholar', 'Dotazione da studioso', 'Scholar\'s pack', 4000, [['backpack', 1], ['Libro di sapienza', 1], ['ink', 1], ['inkpen', 1], ['parchment', 10], ['Sacchetto di sabbia', 1], ['Coltellino', 1]]]
];

const ARMOR_TYPE_LABELS = { light: 'Armatura leggera', medium: 'Armatura media', heavy: 'Armatura pesante', shield: 'Scudo' };

function armorInfo([, , , , , type, ac, str, stealth]) {
  if (type === 'shield') return 'CA +2. Occupa una mano.';
  const parts = [`CA ${ac}${type === 'light' ? ' + Des' : type === 'medium' ? ' + Des (max +2)' : ''}`];
  if (str) parts.push(`richiede Forza ${str} (altrimenti velocità −3 m)`);
  if (stealth) parts.push('svantaggio a Furtività');
  return `${parts.join(', ')}.`.replace(/^./, c => c.toUpperCase());
}

function weaponGearInfo(w) {
  const parts = [w.d ? `${w.d} ${w.t}` : 'Nessun danno'];
  w.p.filter(p => p !== 'thrown' && p !== 'versatile').forEach(p => parts.push(WEAPON_PROPERTY_LABELS[p]));
  if (w.v) parts.push(`versatile (${w.v})`);
  if (w.r) parts.push(`${w.ranged ? 'gittata' : 'da lancio'} ${w.r} m`);
  return `${parts.join(', ')}.`.replace(/^./, c => c.toUpperCase());
}

// k chiave · n nome · e nome inglese · g gruppo · c costo in mr (null se il manuale non lo dice) · w peso in kg
// i regole in breve · a altri nomi · r rarità · weapon chiave dell'arma in SRD_WEAPONS · pack contenuto della dotazione
const SRD_GEAR = [
  ...Object.entries(SRD_GEAR_ROWS).flatMap(([g, rows]) => rows.map(([k, n, e, c, w, i, a]) => ({ k, n, e, g, c, w, i: i || '', a: a || [] }))),
  ...SRD_WEAPONS.filter(w => SRD_WEAPON_COST_WEIGHT[w.k]).map(w => ({
    k: `w-${w.k}`, n: w.n, e: w.e, g: w.c === 'martial' ? 'Armi da guerra' : 'Armi semplici',
    c: SRD_WEAPON_COST_WEIGHT[w.k][0], w: SRD_WEAPON_COST_WEIGHT[w.k][1], i: weaponGearInfo(w), a: [], weapon: w.k
  })),
  ...SRD_ARMOR_ROWS.map(row => ({
    k: `a-${row[0]}`, n: row[1], e: row[2], g: ARMOR_TYPE_LABELS[row[5]], c: row[3], w: row[4], i: armorInfo(row),
    a: /^Armatura (di )?/.test(row[1]) ? [row[1].replace(/^Armatura (di )?/, '')] : []
  })),
  ...SRD_POTION_ROWS.map(([k, n, e, c, w, r, dice]) => ({ k, n, e, g: 'Pozioni', c, w, r, i: `Azione per berla (o per farla bere): recuperi ${dice} PF.`, a: k === 'healing' ? ['pozione curativa'] : [] })),
  ...SRD_PACK_ROWS.map(([k, n, e, c, pack]) => ({ k: `p-${k}`, n, e, g: 'Dotazioni', c, w: 0, i: '', a: [], pack }))
];
const SRD_GEAR_BY_KEY = new Map(SRD_GEAR.map(g => [g.k, g]));

function gearEntry(k) {
  return (k && SRD_GEAR_BY_KEY.get(k)) || null;
}

function packContents(g) {
  return g.pack.map(([k, qty]) => ({ g: gearEntry(k), name: gearEntry(k)?.n || k, qty }));
}

// Parole senza accenti e senza le ultime vocali (al massimo due, restano almeno tre lettere),
// così "torce" trova "torcia", "pozioni" trova "pozione" e "cuoio" resta "cuo"
function gearWords(text) {
  return normalizeSearchText(text).split(/[^a-z0-9]+/).filter(Boolean).map(w => w.replace(/^(.{3,}?)[aeiou]{0,2}$/, '$1'));
}

function gearNames(g) {
  return [g.n, g.e, ...g.a];
}

// Nome dell'oggetto riconosciuto per intero, anche al plurale e senza la parte tra parentesi ("2 torce", "Corda (15 m)")
let gearExactIndex = null;
function gearMatchKey(text) {
  return gearWords(String(text || '').replace(/\(.*?\)/g, ' ').replace(/[+-]\d+\b/g, ' ')).join(' ');
}

function findGear(name) {
  if (!gearExactIndex) {
    gearExactIndex = new Map();
    SRD_GEAR.filter(g => !g.pack).forEach(g => gearNames(g).forEach(x => {
      [gearMatchKey(x), gearWords(x).join(' ')].forEach(key => { if (key && !gearExactIndex.has(key)) gearExactIndex.set(key, g); });
    }));
  }
  // Anche i nomi inglesi con la virgola di D&D Beyond: "Clothes, Common", "Crossbow, Light"
  const flipped = name.includes(',') ? name.split(',').reverse().join(' ') : '';
  return gearExactIndex.get(gearWords(name).join(' ')) || gearExactIndex.get(gearMatchKey(name))
    || (flipped && gearExactIndex.get(gearMatchKey(flipped))) || null;
}

function searchGear(query, limit = 6) {
  const q = gearWords(query);
  if (!q.length) return [];
  const scored = [];
  SRD_GEAR.forEach(g => {
    let best = -1;
    gearNames(g).forEach((name, idx) => {
      const words = gearWords(name);
      if (!q.every(qw => words.some(w => w.startsWith(qw)))) return;
      let score = words[0].startsWith(q[0]) ? 2 : 1;
      if (words.join(' ') === q.join(' ')) score = 3;
      if (idx === 0) score += 0.5;
      best = Math.max(best, score);
    });
    if (best >= 0) scored.push({ g, best });
  });
  return scored.sort((a, b) => b.best - a.best || a.g.n.localeCompare(b.g.n, 'it')).slice(0, limit).map(s => s.g);
}

// ---------------------------------------------------------------------------
// Numeri: pesi in kg, costi in monete
// ---------------------------------------------------------------------------

const COST_UNITS = { mp: 1000, pp: 1000, mo: 100, gp: 100, me: 50, ep: 50, ma: 10, sp: 10, mr: 1, cp: 1 };

// "1.000" è mille, "0,5" e "0.5" sono mezzo
function parseItNumber(text) {
  let s = String(text ?? '').trim().replace(/\s/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  return /^\d*\.?\d+$/.test(s) ? Number(s) : NaN;
}

// null = campo vuoto, undefined = non si capisce
function parseItemWeight(text) {
  const s = String(text ?? '').trim().toLowerCase();
  if (!s || s === '—' || s === '-') return null;
  const m = s.match(/^([\d.,]+)\s*(kg|chili|chilogrammi|g|grammi|lb|lbs|libbre?)?\.?$/);
  const n = m ? parseItNumber(m[1]) : NaN;
  if (isNaN(n)) return undefined;
  const kg = /^(g|grammi)$/.test(m[2] || '') ? n / 1000 : /^l/.test(m[2] || '') ? n * 0.5 : n;
  return Math.min(9999, Math.round(kg * 1000) / 1000);
}

function parseItemCost(text) {
  const s = String(text ?? '').trim().toLowerCase();
  if (!s || s === '—' || s === '-') return null;
  const m = s.match(/^([\d.,]+)\s*(mp|mo|me|ma|mr|pp|gp|ep|sp|cp)?\.?$/);
  const n = m ? parseItNumber(m[1]) : NaN;
  if (isNaN(n)) return undefined;
  return Math.min(1e9, Math.round(n * COST_UNITS[m[2] || 'mo']));
}

function formatKg(kg, digits = 2) {
  return `${(Math.round(kg * 1000) / 1000).toLocaleString('it-IT', { maximumFractionDigits: digits })} kg`;
}

// I prezzi si scrivono nella moneta più grande che li divide, come nel manuale (1.000 mo, non 100 mp)
function formatItemCost(mr) {
  if (!mr) return '—';
  if (mr % 100 === 0) return `${(mr / 100).toLocaleString('it-IT')} mo`;
  if (mr % 10 === 0) return `${mr / 10} ma`;
  return `${mr} mr`;
}

function formatMoTotal(mr) {
  return `${(mr / 100).toLocaleString('it-IT', { maximumFractionDigits: 2 })} mo`;
}

// ---------------------------------------------------------------------------
// Oggetti del personaggio
// ---------------------------------------------------------------------------

// { id, k (oggetto del manuale o ''), name, qty, wt (kg l'uno, null se non si sa), cost (mr l'uno), note, rarity, attune }
// Quello che manca a un oggetto del manuale (nome, peso, costo, rarità) si prende dal manuale.
function normalizeItem(it) {
  const g = gearEntry(it.k);
  const num = (v, max) => (v === null || v === '' || isNaN(Number(v)) ? null : Math.max(0, Math.min(max, Number(v))));
  return {
    id: typeof it.id === 'string' && it.id ? it.id.slice(0, 40) : uid('it'),
    k: g && !g.pack ? g.k : '',
    name: String(it.name || g?.n || 'Oggetto').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Oggetto',
    qty: clampInt(it.qty, 0, 99999, 1),
    wt: it.wt === undefined ? (g ? g.w : null) : num(it.wt, 9999),
    cost: it.cost === undefined ? (g ? g.c : null) : (num(it.cost, 1e9) === null ? null : Math.round(num(it.cost, 1e9))),
    note: String(it.note || '').slice(0, 500),
    rarity: ITEM_RARITIES.includes(it.rarity) ? it.rarity : (it.rarity === undefined && g?.r) || '',
    attune: Boolean(it.attune)
  };
}

// Le schede di prima avevano l'equipaggiamento scritto in un testo: diventa una riga per oggetto
function normalizeCharItems(char) {
  const items = Array.isArray(char.items) ? char.items : itemsFromText(char.equipmentText).map((it, i) => Object.assign(it, { id: `it_old${i}` }));
  delete char.equipmentText;
  return items.filter(it => it && typeof it === 'object').slice(0, 500).map(normalizeItem);
}

// "2 torce", "torce x2", "Pugnale (×3)" → quantità e nome; "15 m di corda" resta com'è
const QTY_UNIT_RE = /^(m|metri|cm|km|kg|g|grammi|l|litri|ml|piedi|ft|lb|libbre|mo|ma|mr|mp|me|giorni|ore|dosi)\b/i;
function splitItemQty(text) {
  let name = String(text || '').trim().replace(/^[-•*·–—]\s*/, '').replace(/[.;:]+$/, '').trim();
  let qty = 1;
  let m = name.match(/^(\d{1,5})\s*[x×]?\s+(.+)$/i) || name.match(/^(\d{1,5})\s*[x×]\s*(.+)$/i);
  if (m && !QTY_UNIT_RE.test(m[2])) { qty = parseInt(m[1], 10); name = m[2]; }
  else if ((m = name.match(/^(.+?)\s*[([]?\s*[x×]\s*(\d{1,5})\s*[)\]]?$/i))) { name = m[1]; qty = parseInt(m[2], 10); }
  return { qty: Math.max(1, Math.min(99999, qty)), name: name.trim() };
}

// Separa gli oggetti a capo, con le virgole e con i punti e virgola (non dentro le parentesi né in "1,5")
function splitEquipmentText(text) {
  const out = [];
  String(text || '').split(/\r?\n/).forEach(line => {
    let depth = 0;
    let cur = '';
    [...line].forEach((c, i) => {
      if (c === '(' || c === '[') depth++;
      if (c === ')' || c === ']') depth = Math.max(0, depth - 1);
      const numberComma = c === ',' && /\d/.test(line[i - 1] || '') && /\d/.test(line[i + 1] || '');
      if ((c === ',' || c === ';') && !depth && !numberComma) { out.push(cur); cur = ''; } else cur += c;
    });
    out.push(cur);
  });
  return out.map(s => s.trim()).filter(s => s && /[a-zà-ÿ]/i.test(s));
}

function capitalizeFirst(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

// Un oggetto letto da un testo: quelli del manuale prendono nome, peso e costo dal manuale
function itemFromText(text, extra = {}) {
  const { qty, name } = splitItemQty(text);
  if (name.length > 60) {
    const short = name.slice(0, 50).replace(/\s+\S*$/, '');
    return Object.assign({ name: `${short}…`, qty, note: name.slice(0, 500) }, extra);
  }
  const g = findGear(name);
  const plus = (name.match(/\+\d\b/) || [])[0];
  if (g) return Object.assign({ k: g.k, name: plus ? `${g.n} ${plus}` : g.n, qty }, extra);
  return Object.assign({ name: capitalizeFirst(name), qty }, extra);
}

// Due pezzi separati da una virgola tornano insieme se insieme sono un oggetto del manuale ("Rope, Hempen (50 feet)")
function itemsFromText(text) {
  const parts = splitEquipmentText(text).slice(0, 300);
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    const joined = i + 1 < parts.length ? `${parts[i]}, ${parts[i + 1]}` : '';
    if (joined && !findGear(splitItemQty(parts[i]).name) && findGear(splitItemQty(joined).name)) {
      out.push(itemFromText(joined));
      i++;
    } else out.push(itemFromText(parts[i]));
  }
  return out;
}

function sameItem(a, b) {
  return a.k === b.k && normalizeSearchText(a.name) === normalizeSearchText(b.name);
}

// Lo stesso oggetto si somma a quello che c'è già
function stackItem(ch, raw) {
  const it = normalizeItem(raw);
  const same = ch.items.find(x => sameItem(x, it));
  if (same) {
    same.qty = Math.min(99999, same.qty + it.qty);
    return same;
  }
  ch.items.push(it);
  return it;
}

function inventoryWeight(ch) {
  const items = ch.items.reduce((n, it) => n + (it.wt || 0) * it.qty, 0);
  // 50 monete pesano mezzo chilo
  const coins = COIN_KEYS.reduce((n, k) => n + (ch.coins[k] || 0), 0) / 100;
  return { items, coins, total: items + coins };
}

// Capacità di trasporto: Forza × 7,5 kg; si spinge, trascina o solleva fino al doppio
function carryingCapacity(ch) {
  return ch.abilities.FOR * 7.5;
}

// Una riga per oggetto, per il PDF della scheda
function inventoryPlainText(ch) {
  if (!ch.items.length) return '';
  const lines = ch.items.map(it => `${it.qty !== 1 ? `${it.qty} x ` : ''}${it.name}${it.attune ? ' (in sintonia)' : ''}${it.note ? ` - ${it.note.replace(/\s*\n\s*/g, ' ')}` : ''}`);
  const w = inventoryWeight(ch);
  if (w.total) lines.push('', `Peso: ${formatKg(w.total)} su ${formatKg(carryingCapacity(ch))}`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Disegno
// ---------------------------------------------------------------------------

function itemInfoText(it) {
  const g = gearEntry(it.k);
  return g ? g.i : '';
}

function inventoryRowHtml(ch, it, editable) {
  const open = App.itemOpenId === it.id;
  const info = itemInfoText(it);
  const tags = [it.attune ? '<span class="inv-tag" title="In sintonia">🔗 sintonia</span>' : '', it.rarity ? `<span class="inv-tag">✨ ${escapeHtml(it.rarity)}</span>` : ''].join('');
  const qty = editable ? `
    <div class="flex items-center justify-center gap-0.5">
      <button type="button" class="inv-step" data-step="-1" aria-label="Uno in meno" ${it.qty <= 0 ? 'data-off' : ''}>−</button>
      <input type="number" min="0" max="99999" inputmode="numeric" class="input-field inv-qty-input" data-f="qty" value="${it.qty}" aria-label="Quantità di ${escapeHtml(it.name)}" />
      <button type="button" class="inv-step" data-step="1" aria-label="Uno in più">+</button>
    </div>` : `<strong>${it.qty}</strong>`;
  const weight = it.wt === null ? '—' : `${formatKg(it.wt, 3)}${it.qty > 1 && it.wt ? `<div class="inv-sub">tot. ${formatKg(it.wt * it.qty)}</div>` : ''}`;
  return `
    <tr class="inv-row ${it.qty <= 0 ? 'is-empty' : ''} ${open ? 'is-open' : ''}" data-item-id="${escapeHtml(it.id)}">
      <td>
        <div class="inv-open" role="button" tabindex="0" aria-expanded="${open}" title="Tocca per note e dettagli">
          <span class="inv-name">${escapeHtml(it.name)}</span>${tags}
          ${info ? `<div class="inv-info">${escapeHtml(info)}</div>` : ''}
          ${it.note ? `<div class="inv-note">📝 ${escapeHtml(it.note)}</div>` : ''}
        </div>
      </td>
      <td class="inv-num-c">${qty}</td>
      <td class="inv-num">${weight}</td>
      <td class="inv-num">${formatItemCost(it.cost)}</td>
    </tr>
    ${open ? `<tr class="inv-edit-row" data-item-id="${escapeHtml(it.id)}"><td colspan="4">${inventoryDetailHtml(ch, it, editable)}</td></tr>` : ''}`;
}

function inventoryDetailHtml(ch, it, editable) {
  const g = gearEntry(it.k);
  const manual = g ? `<div class="leading-relaxed"><span class="font-bold text-[var(--muted)]">📖 Dal manuale</span> · ${escapeHtml(g.g)}${g.i ? `: ${escapeHtml(g.i)}` : ''}</div>` : '';
  if (!editable) {
    return `<div class="card-surface2 p-2 flex flex-col gap-1.5 text-[11px]">${manual}
      ${it.note ? `<div class="whitespace-pre-wrap">📝 ${escapeHtml(it.note)}</div>` : ''}
      ${!manual && !it.note ? '<div class="text-[var(--muted)] italic">Nessuna nota.</div>' : ''}</div>`;
  }
  const weaponKey = g?.weapon;
  const inAttacks = weaponKey && ch.weapons.some(w => w.k === weaponKey);
  const field = (label, f, value, attrs) => `<label class="flex flex-col gap-0.5 font-bold text-[var(--muted)]">${label}
    <input type="text" class="input-field text-xs py-0.5" data-f="${f}" value="${escapeHtml(value)}" ${attrs} /></label>`;
  return `
    <div class="card-surface2 p-2 flex flex-col gap-2 text-[11px]">
      ${manual}
      <label class="flex flex-col gap-0.5 font-bold text-[var(--muted)]">📝 Nota
        <textarea rows="2" maxlength="500" class="input-field w-full text-xs font-normal" data-f="note" placeholder="Cariche rimaste, chi te l'ha dato, dove l'hai trovato…">${escapeHtml(it.note)}</textarea></label>
      <div class="flex flex-wrap items-end gap-2">
        ${field('Nome', 'name', it.name, 'maxlength="80" style="width: 11rem"')}
        ${field('Peso (kg, l\'uno)', 'wt', it.wt === null ? '' : String(it.wt).replace('.', ','), 'inputmode="decimal" placeholder="—" style="width: 6rem"')}
        ${field('Costo (l\'uno)', 'cost', it.cost ? formatItemCost(it.cost) : '', 'placeholder="es. 5 ma" style="width: 6rem"')}
        <label class="flex flex-col gap-0.5 font-bold text-[var(--muted)]">Rarità
          <select class="input-field text-xs py-0.5" data-f="rarity"><option value="">non magico</option>${ITEM_RARITIES.map(r => `<option value="${r}" ${it.rarity === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
        <label class="flex items-center gap-1.5 font-bold cursor-pointer pb-1" title="Al massimo ${MAX_ATTUNED} oggetti magici in sintonia"><input type="checkbox" class="w-4 h-4 accent-[var(--felt)]" data-f="attune" ${it.attune ? 'checked' : ''} /> 🔗 In sintonia</label>
      </div>
      <div class="flex flex-wrap items-center gap-1.5">
        ${weaponKey && !inAttacks ? '<button type="button" class="btn text-xs py-0.5 px-2 inv-to-attacks">⚔️ Mettila in Armi e attacchi</button>' : ''}
        <button type="button" class="btn text-xs py-0.5 px-2 text-[var(--danger)] inv-remove">✕ Togli dall'inventario</button>
        <button type="button" class="btn text-xs py-0.5 px-2 inv-close">Chiudi</button>
      </div>
    </div>`;
}

function inventoryTableHtml(ch, editable) {
  if (!ch.items.length) {
    return `<div class="text-xs text-[var(--muted)] italic">${editable
      ? 'Nessun oggetto. Cerca qui sopra nel manuale (zaino, corda, torcia, dotazione da esploratore…) o scrivi quello che vuoi.'
      : 'Nessun oggetto.'}</div>`;
  }
  return `
    <table class="inv-table w-full text-xs">
      <thead><tr><th scope="col">Oggetto</th><th scope="col" class="inv-num-c">Q.tà</th><th scope="col">Peso</th><th scope="col">Costo</th></tr></thead>
      <tbody>${ch.items.map(it => inventoryRowHtml(ch, it, editable)).join('')}</tbody>
    </table>
    <div class="text-[10px] text-[var(--muted)] mt-1">Peso e costo sono di un oggetto solo. Tocca un oggetto per ${editable ? 'aggiungere una nota o cambiarlo' : 'leggere tutto'}.</div>`;
}

function renderInventoryTotals(ch) {
  const w = inventoryWeight(ch);
  const cap = carryingCapacity(ch);
  const pct = cap > 0 ? Math.min(100, Math.round((w.total / cap) * 100)) : 0;
  const fill = $('sheetInvWeightFill');
  fill.style.width = `${pct}%`;
  fill.style.background = w.total > cap ? 'var(--danger)' : w.total > ch.abilities.FOR * 5 ? 'var(--brass)' : 'var(--ok)';
  setText('sheetInvWeightText', `${formatKg(w.total)} su ${formatKg(cap)}`);
  setText('sheetInvWeightHint', `Capacità di trasporto: Forza ${ch.abilities.FOR} × 7,5 kg${w.coins >= 0.05 ? ` · monete comprese (${formatKg(w.coins)})` : ''}`);
  const warn = $('sheetInvWeightWarn');
  let text = '';
  if (w.total > cap) text = `⚠️ Oltre la capacità di trasporto: puoi solo spingere, trascinare o sollevare fino a ${formatKg(cap * 2)}, e intanto ti muovi al massimo di 1,5 m.`;
  else if (w.total > ch.abilities.FOR * 5) text = 'Con la regola facoltativa dell\'ingombro saresti pesantemente ingombrato: velocità −6 m e svantaggio a prove, tiri per colpire e tiri salvezza di FOR, DES e COS.';
  else if (w.total > ch.abilities.FOR * 2.5) text = 'Con la regola facoltativa dell\'ingombro saresti ingombrato: velocità −3 m.';
  setText(warn, text);
  showEl(warn, Boolean(text), '');
  warn.classList.toggle('text-[var(--danger)]', w.total > cap);
  warn.classList.toggle('font-bold', w.total > cap);
  const value = ch.items.reduce((n, it) => n + (it.cost || 0) * it.qty, 0);
  const attuned = ch.items.filter(it => it.attune && it.qty > 0).length;
  const parts = [`${ch.items.length} ${ch.items.length === 1 ? 'oggetto' : 'oggetti'}`];
  if (value) parts.push(`valore ${formatMoTotal(value)}`);
  if (attuned) parts.push(`sintonia ${attuned}/${MAX_ATTUNED}`);
  setText('sheetInvSummary', ch.items.length ? parts.join(' · ') : '');
  $('sheetInvSummary').classList.toggle('text-[var(--danger)]', attuned > MAX_ATTUNED);
}

function renderInventory(ch, editable) {
  const box = $('sheetInvTable');
  // Non ridisegnare mentre si scrive in un campo della tabella: lo si fa quando si esce
  const active = document.activeElement;
  if (box.contains(active) && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) && box.dataset.charId === ch.id) {
    box.dataset.stale = '1';
  } else {
    box.dataset.stale = '';
    box.dataset.charId = ch.id;
    box.innerHTML = inventoryTableHtml(ch, editable);
  }
  showEl('sheetInvAddWrap', editable);
  const undo = editable && App.itemUndo?.charId === ch.id ? App.itemUndo : null;
  const undoBox = $('sheetInvUndo');
  showEl(undoBox, Boolean(undo));
  if (undo) undoBox.innerHTML = `<span class="text-[var(--muted)]">Tolto: <strong>${escapeHtml(undo.item.name)}</strong></span><button type="button" class="btn text-[11px] py-0 px-2 inv-undo-btn">↩︎ Rimetti</button>`;
  renderInventoryTotals(ch);
}

// ---------------------------------------------------------------------------
// Aggiunta: ricerca nel manuale oppure oggetto scritto a mano
// ---------------------------------------------------------------------------

function inventorySuggestions(text) {
  const { qty, name } = splitItemQty(text);
  if (!name) return [];
  const found = searchGear(name, 6).map(g => ({ g, qty }));
  if (!found.some(s => normalizeSearchText(s.g.n) === normalizeSearchText(name))) found.push({ name: capitalizeFirst(name), qty });
  return found;
}

function renderInventorySuggestions() {
  const box = $('sheetInvSuggest');
  const list = App.invSuggest?.list || [];
  showEl(box, list.length > 0);
  box.innerHTML = list.map((s, i) => {
    const active = i === App.invSuggest.idx ? 'active' : '';
    if (!s.g) {
      return `<button type="button" class="btn text-xs justify-start w-full inv-pick ${active}" data-i="${i}">
        <span class="truncate">✍️ Aggiungi “${escapeHtml(`${s.qty > 1 ? `${s.qty} × ` : ''}${s.name}`)}” scritto da te</span></button>`;
    }
    const g = s.g;
    const detail = g.pack ? `${formatItemCost(g.c)} · ${g.pack.length} oggetti` : [formatItemCost(g.c), g.w ? formatKg(g.w, 3) : ''].filter(x => x && x !== '—').join(' · ');
    return `<button type="button" class="btn text-xs justify-between w-full inv-pick ${active}" data-i="${i}">
      <span class="truncate text-left">${s.qty > 1 ? `${s.qty} × ` : ''}${escapeHtml(g.n)} <span class="text-[var(--muted)]">· ${escapeHtml(g.g)}</span></span>
      <span class="text-[10px] text-[var(--muted)] whitespace-nowrap">${escapeHtml(detail)}</span></button>`;
  }).join('');
}

function updateInventorySuggestions() {
  const text = $('sheetInvAddInput').value;
  App.invSuggest = { text, list: inventorySuggestions(text), idx: 0 };
  renderInventorySuggestions();
}

function clearInventorySuggestions() {
  App.invSuggest = null;
  renderInventorySuggestions();
}

function addInventoryPick(ch, s) {
  if (s.g?.pack) {
    const contents = packContents(s.g);
    contents.forEach(c => stackItem(ch, c.g ? { k: c.g.k, qty: c.qty * s.qty } : { name: c.name, qty: c.qty * s.qty }));
    showToast(`🎒 ${s.g.n}: ${contents.length} oggetti nell'inventario`);
  } else {
    const raw = s.g ? { k: s.g.k, qty: s.qty } : { name: s.name, qty: s.qty };
    const probe = normalizeItem(raw);
    const before = ch.items.some(x => sameItem(x, probe));
    const it = stackItem(ch, raw);
    showToast(before ? `🎒 ${it.name}: ora sono ${it.qty}` : `🎒 Aggiunto: ${s.qty > 1 ? `${s.qty} × ` : ''}${it.name}`);
    if (!s.g) App.itemOpenId = it.id;
  }
  App.itemUndo = null;
  touchEnt(`char:${ch.id}`);
  $('sheetInvAddInput').value = '';
  clearInventorySuggestions();
  scheduleRender();
}

// ---------------------------------------------------------------------------
// Eventi
// ---------------------------------------------------------------------------

function inventoryItem(ch, el) {
  const id = el.closest('[data-item-id]')?.dataset.itemId;
  return id ? ch.items.find(it => it.id === id) : null;
}

function onInventoryFieldChange(e) {
  const f = e.target.dataset.f;
  const ch = currentSheetChar();
  const it = f && ch && canEditChar(ch) && inventoryItem(ch, e.target);
  if (!it) return;
  const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  if (f === 'qty') it.qty = clampInt(v, 0, 99999, it.qty);
  if (f === 'name') it.name = String(v).replace(/\s+/g, ' ').trim().slice(0, 80) || it.name;
  if (f === 'note') it.note = String(v).trim().slice(0, 500);
  if (f === 'rarity') it.rarity = ITEM_RARITIES.includes(v) ? v : '';
  if (f === 'attune') {
    it.attune = Boolean(v);
    const n = ch.items.filter(x => x.attune && x.qty > 0).length;
    if (it.attune && n > MAX_ATTUNED) showToast(`🔗 Sei in sintonia con ${n} oggetti: il massimo è ${MAX_ATTUNED}`, 3500);
  }
  if (f === 'wt' || f === 'cost') {
    const parsed = f === 'wt' ? parseItemWeight(v) : parseItemCost(v);
    if (parsed === undefined) showToast(f === 'wt' ? 'Scrivi il peso in kg, per esempio 0,5' : 'Scrivi il costo con la moneta, per esempio 5 ma o 2 mo', 3500);
    else it[f] = parsed;
  }
  touchEnt(`char:${ch.id}`);
  if (e.target.type !== 'checkbox' && e.target.tagName !== 'SELECT') e.target.blur();
  scheduleRender();
}

function onInventoryClick(e) {
  const ch = currentSheetChar();
  if (!ch) return;
  const t = e.target;
  const opener = t.closest('.inv-open');
  if (opener) {
    const it = inventoryItem(ch, opener);
    App.itemOpenId = it && App.itemOpenId !== it.id ? it.id : null;
    scheduleRender();
    return;
  }
  if (t.closest('.inv-close')) { App.itemOpenId = null; scheduleRender(); return; }
  if (!canEditChar(ch)) return;
  const it = inventoryItem(ch, t);
  if (!it) return;
  const step = t.closest('.inv-step');
  if (step) {
    it.qty = Math.max(0, Math.min(99999, it.qty + parseInt(step.dataset.step, 10)));
    if (it.qty === 0) showToast(`${it.name}: finiti. La riga resta finché non la togli (tocca il nome)`, 3500);
  } else if (t.closest('.inv-remove')) {
    App.itemUndo = { charId: ch.id, item: it, index: ch.items.indexOf(it) };
    ch.items = ch.items.filter(x => x !== it);
    App.itemOpenId = null;
    showToast(`🗑️ ${it.name} tolto dall'inventario`);
  } else if (t.closest('.inv-to-attacks')) {
    const key = gearEntry(it.k)?.weapon;
    if (!key || ch.weapons.some(w => w.k === key)) return;
    ch.weapons.push({ id: uid('w'), k: key, magic: clampInt((it.name.match(/\+([1-3])\b/) || [])[1], 0, 3, 0), prof: null, name: '' });
    showToast(`⚔️ ${it.name} è in Armi e attacchi: tiro per colpire e danni li calcola la scheda`, 3500);
  } else return;
  touchEnt(`char:${ch.id}`);
  scheduleRender();
}

function onInventoryAddKey(e) {
  const s = App.invSuggest;
  if (e.key === 'Escape') { clearInventorySuggestions(); return; }
  if (!s?.list.length || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
  e.preventDefault();
  s.idx = (s.idx + (e.key === 'ArrowDown' ? 1 : -1) + s.list.length) % s.list.length;
  renderInventorySuggestions();
}

function initInventoryEvents() {
  const box = $('sheetInvTable');
  box.addEventListener('change', onInventoryFieldChange);
  box.addEventListener('click', onInventoryClick);
  box.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('inv-open')) { e.preventDefault(); e.target.click(); }
  });
  box.addEventListener('focusout', () => setTimeout(() => {
    if (box.dataset.stale === '1' && !box.contains(document.activeElement)) scheduleRender();
  }, 0));
  const input = $('sheetInvAddInput');
  input.addEventListener('input', debounce(updateInventorySuggestions, 120));
  input.addEventListener('keydown', onInventoryAddKey);
  $('sheetInvAddForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const ch = currentSheetChar();
    if (!ch || !canEditChar(ch)) return;
    if (!input.value.trim()) { input.focus(); return; }
    // Con Invio vale il suggerimento evidenziato, anche se l'elenco non ha ancora seguito l'ultima lettera
    const s = App.invSuggest?.text === input.value ? App.invSuggest : { list: inventorySuggestions(input.value), idx: 0 };
    const pick = s.list[s.idx] || s.list[0];
    if (pick) addInventoryPick(ch, pick);
    input.focus();
  });
  $('sheetInvUndo').addEventListener('click', (e) => {
    const ch = currentSheetChar();
    const undo = App.itemUndo;
    if (!e.target.closest('.inv-undo-btn') || !ch || !canEditChar(ch) || undo?.charId !== ch.id) return;
    ch.items.splice(Math.min(undo.index, ch.items.length), 0, undo.item);
    App.itemUndo = null;
    touchEnt(`char:${ch.id}`);
    scheduleRender();
  });
  $('sheetInvSuggest').addEventListener('click', (e) => {
    const b = e.target.closest('.inv-pick');
    const ch = currentSheetChar();
    const pick = b && App.invSuggest?.list[Number(b.dataset.i)];
    if (pick && ch && canEditChar(ch)) addInventoryPick(ch, pick);
  });
}
