// Progressione delle classi del regolamento base (SRD 5.1, regole 2014) dal 1° al 20° livello:
// privilegi livello per livello, la sottoclasse del regolamento base, le risorse che crescono e le scelte da fare.
// Le spiegazioni sono riassunti in italiano: per il testo completo vale il manuale.

// Livelli 1-3, 4-9 e 10-20
function byTier(a, b, c) {
  return Array.from({ length: 20 }, (_, i) => (i < 3 ? a : i < 9 ? b : c));
}

const CANTRIPS_KNOWN = {
  Bardo: byTier(2, 3, 4), Chierico: byTier(3, 4, 5), Druido: byTier(2, 3, 4),
  Mago: byTier(3, 4, 5), Stregone: byTier(4, 5, 6), Warlock: byTier(2, 3, 4)
};

// Incantesimi conosciuti da chi non prepara (i Segreti magici del Bardo sono già compresi)
const SPELLS_KNOWN = {
  Bardo: [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22],
  Ranger: [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11],
  Stregone: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15],
  Warlock: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15]
};

// Arcanum mistico del Warlock: livello del personaggio → livello dell'incantesimo
const MYSTIC_ARCANUM = { 11: 6, 13: 7, 15: 8, 17: 9 };

function dieByLevel(lv, steps) {
  let out = steps[0][1];
  steps.forEach(([from, value]) => { if (lv >= from) out = value; });
  return out;
}

// ---------------------------------------------------------------------------
// Opzioni da scegliere
// ---------------------------------------------------------------------------

const FIGHTING_STYLES = {
  Tiro: '+2 ai tiri per colpire con le armi a distanza.',
  Difesa: '+1 alla CA quando indossi un\'armatura.',
  Duellare: '+2 ai danni quando impugni un\'arma da mischia in una mano e nessun\'altra arma.',
  'Combattere con armi possenti': 'Con un\'arma da mischia a due mani o versatile impugnata a due mani, ritiri gli 1 e i 2 sui dadi dei danni.',
  Protezione: 'Con uno scudo, usi la reazione per dare svantaggio a chi attacca un alleato entro 1,5 m da te.',
  'Combattere con due armi': 'Quando attacchi con la seconda arma aggiungi il modificatore di caratteristica ai danni.'
};

const METAMAGIC = {
  'Incantesimo accurato': '1 punto: fino a CAR creature superano automaticamente il TS del tuo incantesimo.',
  'Incantesimo distante': '1 punto: raddoppi la gittata (o 9 m per gli incantesimi a contatto).',
  'Incantesimo potenziato': '1 punto: ritiri fino a CAR dadi dei danni (si può unire a un\'altra Metamagia).',
  'Incantesimo esteso': '1 punto: raddoppi la durata, fino a 24 ore.',
  'Incantesimo intensificato': '3 punti: un bersaglio ha svantaggio al primo TS contro l\'incantesimo.',
  'Incantesimo rapido': '2 punti: un incantesimo da 1 azione si lancia con un\'azione bonus.',
  'Incantesimo sottile': '1 punto: niente componenti verbali e somatiche.',
  'Incantesimo gemello': 'Punti pari al livello dell\'incantesimo (1 per i trucchetti): un incantesimo a bersaglio singolo colpisce anche una seconda creatura.'
};

const DRACONIC_ANCESTRY = {
  'Drago blu': 'fulmine', 'Drago bianco': 'freddo', 'Drago di bronzo': 'fulmine', 'Drago d\'argento': 'freddo',
  'Drago nero': 'acido', 'Drago d\'ottone': 'fuoco', 'Drago d\'oro': 'fuoco', 'Drago di rame': 'acido',
  'Drago rosso': 'fuoco', 'Drago verde': 'veleno'
};

const FAVORED_ENEMIES = ['Aberrazioni', 'Bestie', 'Celestiali', 'Costrutti', 'Draghi', 'Elementali', 'Folletti', 'Giganti',
  'Immondi', 'Melme', 'Mostruosità', 'Non morti', 'Vegetali', 'Due razze di umanoidi (es. orchi e gnoll)'];

const TERRAINS = ['Artico', 'Costa', 'Deserto', 'Foresta', 'Montagna', 'Palude', 'Prateria', 'Underdark'];

// Incantesimi del Circolo della Terra, sempre preparati (nomi inglesi del regolamento, per trovarli nei dati)
const LAND_CIRCLE_SPELLS = {
  Artico: { 3: ['Hold Person', 'Spike Growth'], 5: ['Sleet Storm', 'Slow'], 7: ['Freedom of Movement', 'Ice Storm'], 9: ['Commune with Nature', 'Cone of Cold'] },
  Costa: { 3: ['Mirror Image', 'Misty Step'], 5: ['Water Breathing', 'Water Walk'], 7: ['Control Water', 'Freedom of Movement'], 9: ['Conjure Elemental', 'Scrying'] },
  Deserto: { 3: ['Blur', 'Silence'], 5: ['Create Food and Water', 'Protection from Energy'], 7: ['Blight', 'Hallucinatory Terrain'], 9: ['Insect Plague', 'Wall of Stone'] },
  Foresta: { 3: ['Barkskin', 'Spider Climb'], 5: ['Call Lightning', 'Plant Growth'], 7: ['Divination', 'Freedom of Movement'], 9: ['Commune with Nature', 'Tree Stride'] },
  Montagna: { 3: ['Spider Climb', 'Spike Growth'], 5: ['Lightning Bolt', 'Meld into Stone'], 7: ['Stone Shape', 'Stoneskin'], 9: ['Passwall', 'Wall of Stone'] },
  Palude: { 3: ['Darkness', 'Acid Arrow'], 5: ['Water Walk', 'Stinking Cloud'], 7: ['Freedom of Movement', 'Locate Creature'], 9: ['Insect Plague', 'Scrying'] },
  Prateria: { 3: ['Invisibility', 'Pass without Trace'], 5: ['Daylight', 'Haste'], 7: ['Divination', 'Freedom of Movement'], 9: ['Dream', 'Insect Plague'] },
  Underdark: { 3: ['Spider Climb', 'Web'], 5: ['Gaseous Form', 'Stinking Cloud'], 7: ['Greater Invisibility', 'Stone Shape'], 9: ['Cloudkill', 'Insect Plague'] }
};

const PACT_BOONS = {
  'Patto della catena': 'Impari Trova famiglio e lo lanci come rituale; il famiglio può essere anche un imp, un pseudodrago, un quasit o uno spiritello, e può attaccare usando la tua reazione.',
  'Patto della lama': 'Con un\'azione crei un\'arma del patto nella forma che vuoi, in cui sei competente; puoi legare a te anche un\'arma magica.',
  'Patto del tomo': 'Ricevi il Libro delle ombre con tre trucchetti di qualsiasi classe, che consideri da warlock.'
};

// lv: livello da warlock richiesto · pact: dono del patto richiesto · eb: serve Deflagrazione occulta
const INVOCATIONS = {
  'Deflagrazione agonizzante': { d: 'Aggiungi CAR ai danni di Deflagrazione occulta.', eb: true },
  'Armatura delle ombre': { d: 'Lanci Armatura magica su di te a volontà, senza slot né componenti materiali.' },
  'Passo ascendente': { d: 'Lanci Levitazione su di te a volontà, senza slot.', lv: 9 },
  'Parlare con le bestie': { d: 'Lanci Parlare con gli animali a volontà, senza slot.' },
  'Influenza ammaliante': { d: 'Competenza in Inganno e Persuasione.' },
  'Sussurri ammalianti': { d: 'Lanci Costrizione una volta per riposo lungo con uno slot del patto.', lv: 7 },
  'Libro dei segreti antichi': { d: 'Scrivi nel Libro delle ombre due rituali di 1° livello di qualsiasi classe e li lanci come rituali; puoi copiarne altri.', pact: 'Patto del tomo' },
  'Catene di Carceri': { d: 'Lanci Blocca mostri a volontà su un celestiale, immondo o elementale (una volta per riposo lungo per ciascuno).', lv: 15, pact: 'Patto della catena' },
  'Vista del diavolo': { d: 'Vedi normalmente al buio, anche magico, fino a 36 m.' },
  'Parola terribile': { d: 'Lanci Confusione una volta per riposo lungo con uno slot del patto.', lv: 7 },
  'Vista occulta': { d: 'Lanci Individuazione del magico a volontà, senza slot.' },
  'Lancia occulta': { d: 'Deflagrazione occulta arriva a 90 m.', eb: true },
  'Occhi del custode delle rune': { d: 'Leggi qualsiasi scrittura.' },
  'Vigore immondo': { d: 'Lanci Vita falsata su di te a volontà come incantesimo di 1° livello, senza slot.' },
  'Sguardo delle due menti': { d: 'Con un\'azione tocchi un umanoide consenziente e percepisci con i suoi sensi fino al tuo prossimo turno.' },
  'Bevitore di vita': { d: 'L\'arma del patto fa CAR danni necrotici in più (minimo 1).', lv: 12, pact: 'Patto della lama' },
  'Maschera dai molti volti': { d: 'Lanci Camuffare se stessi a volontà, senza slot.' },
  'Maestro delle forme infinite': { d: 'Lanci Alterare se stesso a volontà, senza slot.', lv: 15 },
  'Servitori del caos': { d: 'Lanci Evocare elementale una volta per riposo lungo con uno slot del patto.', lv: 9 },
  'Impantanare la mente': { d: 'Lanci Lentezza una volta per riposo lungo con uno slot del patto.', lv: 5 },
  'Visioni nebbiose': { d: 'Lanci Immagine silenziosa a volontà, senza slot.' },
  'Tutt\'uno con le ombre': { d: 'Nella penombra o al buio, con un\'azione diventi invisibile finché non ti muovi o agisci.', lv: 5 },
  'Balzo ultraterreno': { d: 'Lanci Saltare su di te a volontà, senza slot.', lv: 9 },
  'Deflagrazione respingente': { d: 'Ogni raggio di Deflagrazione occulta che colpisce spinge il bersaglio di 3 m.', eb: true },
  'Scultore della carne': { d: 'Lanci Metamorfosi una volta per riposo lungo con uno slot del patto.', lv: 7 },
  'Segno di cattivo presagio': { d: 'Lanci Scagliare maledizione una volta per riposo lungo con uno slot del patto.', lv: 5 },
  'Ladro dei cinque fati': { d: 'Lanci Anatema una volta per riposo lungo con uno slot del patto.' },
  'Lama assetata': { d: 'Attacchi due volte con l\'arma del patto quando usi l\'azione Attacco.', lv: 5, pact: 'Patto della lama' },
  'Visioni di reami lontani': { d: 'Lanci Occhio arcano a volontà, senza slot.', lv: 15 },
  'Voce del padrone della catena': { d: 'Comunichi con il famiglio col pensiero a qualsiasi distanza, percepisci con i suoi sensi e parli con la sua voce.', pact: 'Patto della catena' },
  'Sussurri della tomba': { d: 'Lanci Parlare con i morti a volontà, senza slot.', lv: 9 },
  'Vista stregata': { d: 'Vedi la vera forma di mutaforma e creature trasformate o illusorie entro 9 m.', lv: 15 }
};

const HUNTER_CHOICES = {
  huntersPrey: {
    level: 3, title: 'Preda del cacciatore', options: {
      'Uccisore di colossi': 'Una volta per turno, +1d8 danni a una creatura che ha già perso PF.',
      'Uccisore di giganti': 'Quando una creatura Grande o più grande entro 1,5 m ti attacca, con la reazione la attacchi subito dopo.',
      'Distruttore di orde': 'Una volta per turno, quando attacchi con un\'arma, fai un altro attacco contro una creatura diversa entro 1,5 m dal primo bersaglio.'
    }
  },
  defensiveTactics: {
    level: 7, title: 'Tattiche difensive', options: {
      'Sfuggire all\'orda': 'Gli attacchi di opportunità contro di te hanno svantaggio.',
      'Difesa dagli attacchi multipli': 'Dopo che una creatura ti colpisce, +4 alla CA contro i suoi attacchi successivi in quel turno.',
      'Volontà d\'acciaio': 'Vantaggio ai TS per non essere spaventato.'
    }
  },
  multiattack: {
    level: 11, title: 'Attacco multiplo', options: {
      Raffica: 'Con un\'azione fai un attacco a distanza contro ogni creatura entro 3 m da un punto che vedi.',
      'Attacco turbinante': 'Con un\'azione fai un attacco in mischia contro ogni creatura entro 1,5 m da te.'
    }
  },
  superiorDefense: {
    level: 15, title: 'Difesa superiore del cacciatore', options: {
      Elusione: 'Nei TS di Destrezza per dimezzare: niente danni se riesci, metà se fallisci.',
      'Resistere alla marea': 'Quando una creatura ti manca in mischia, con la reazione le fai ripetere l\'attacco contro un\'altra creatura.',
      'Schivata prodigiosa': 'Con la reazione dimezzi i danni di un attacco di una creatura che vedi.'
    }
  }
};

// ---------------------------------------------------------------------------
// Le classi
// ---------------------------------------------------------------------------
// features: { livello: [[nome, spiegazione], …] } · res(lv): risorse che crescono · sub: la sottoclasse

const CLASS_PROGRESSION = {
  Barbaro: {
    sub: { level: 3, title: 'Cammino primordiale', levels: [3, 6, 10, 14] },
    features: {
      1: [['Ira', 'Con un\'azione bonus entri in ira per 1 minuto: vantaggio alle prove e ai TS di Forza, danni in più in mischia con la Forza e resistenza ai danni contundenti, perforanti e taglienti. Niente incantesimi né concentrazione.'],
        ['Difesa senza armatura', 'Senza armatura la tua CA è 10 + DES + COS (lo scudo vale).']],
      2: [['Attacco irruento', 'Al primo attacco del turno puoi attaccare con vantaggio usando la Forza in mischia; fino al tuo prossimo turno chi ti attacca ha vantaggio.'],
        ['Percepire il pericolo', 'Vantaggio ai TS di Destrezza contro gli effetti che vedi, come trappole e incantesimi.']],
      3: [['Cammino primordiale', 'Scegli il tuo cammino: dà privilegi al 3°, 6°, 10° e 14° livello.']],
      5: [['Attacco extra', 'Quando usi l\'azione Attacco attacchi due volte.'], ['Movimento veloce', '+3 m di velocità se non indossi un\'armatura pesante.']],
      7: [['Istinto ferino', 'Vantaggio all\'iniziativa; se sei sorpreso puoi agire nel primo turno entrando subito in ira.']],
      9: [['Critico brutale', 'Con un critico in mischia tiri un dado dell\'arma in più per i danni.']],
      11: [['Ira implacabile', 'In ira, se scendi a 0 PF senza morire, con un TS Costituzione CD 10 resti a 1 PF; la CD sale di 5 a ogni uso fino al riposo.']],
      13: [['Critico brutale', 'Ora i dadi in più sul critico sono 2.']],
      15: [['Ira persistente', 'L\'ira finisce prima del minuto solo se perdi i sensi o se lo decidi tu.']],
      17: [['Critico brutale', 'Ora i dadi in più sul critico sono 3.']],
      18: [['Potenza indomabile', 'Se una prova di Forza dà meno del tuo punteggio di Forza, vale il punteggio.']],
      20: [['Campione primordiale', 'Forza e Costituzione +4, fino a un massimo di 24 (applicato in automatico).']]
    },
    res: lv => [['Ire per riposo lungo', lv >= 20 ? 'illimitate' : dieByLevel(lv, [[1, 2], [3, 3], [6, 4], [12, 5], [17, 6]])],
      ['Danni in più con l\'ira', dieByLevel(lv, [[1, '+2'], [9, '+3'], [16, '+4']])]],
    subclasses: {
      'Cammino del Berserker': {
        d: 'Furia pura: in ira puoi attaccare ancora, a costo della fatica.',
        features: {
          3: [['Frenesia', 'Quando entri in ira puoi andare in frenesia: finché dura puoi fare un attacco in mischia con un\'azione bonus a ogni turno; alla fine subisci un livello di indebolimento.']],
          6: [['Ira incontenibile', 'In ira non puoi essere affascinato né spaventato; se lo eri, l\'effetto si sospende finché dura l\'ira.']],
          10: [['Presenza intimidatoria', 'Con un\'azione spaventi una creatura entro 9 m (TS Saggezza, CD 8 + competenza + CAR) fino alla fine del tuo prossimo turno; puoi prolungare con altre azioni.']],
          14: [['Ritorsione', 'Quando una creatura entro 1,5 m ti fa danni, con la reazione la attacchi in mischia.']]
        }
      }
    }
  },

  Bardo: {
    sub: { level: 3, title: 'Collegio bardico', levels: [3, 6, 14] },
    features: {
      1: [['Incantesimi', 'Lanci incantesimi con il Carisma e li conosci (ne cambi uno a ogni livello); puoi lanciare i rituali che conosci.'],
        ['Ispirazione bardica', 'Con un\'azione bonus dai un dado a una creatura entro 18 m: lo aggiunge a una prova, un attacco o un TS entro 10 minuti. Usi pari a CAR (minimo 1) per riposo lungo.']],
      2: [['Factotum', 'Aggiungi metà competenza (per difetto) alle prove di caratteristica in cui non sei competente.'],
        ['Canto di riposo', 'Durante un riposo breve, chi spende Dadi Vita recupera anche il dado del canto in PF.']],
      3: [['Collegio bardico', 'Scegli il collegio: dà privilegi al 3°, 6° e 14° livello.'], ['Maestria', 'Raddoppi la competenza in due abilità in cui sei competente.']],
      5: [['Fonte di ispirazione', 'Recuperi le Ispirazioni bardiche anche con il riposo breve.']],
      6: [['Controfascino', 'Con un\'azione, fino alla fine del tuo prossimo turno tu e gli alleati entro 9 m avete vantaggio ai TS contro spaventato e affascinato.']],
      10: [['Maestria', 'Raddoppi la competenza in altre due abilità.'], ['Segreti magici', 'Impari due incantesimi di qualsiasi classe, che contano come incantesimi da bardo.']],
      14: [['Segreti magici', 'Altri due incantesimi di qualsiasi classe.']],
      18: [['Segreti magici', 'Altri due incantesimi di qualsiasi classe.']],
      20: [['Ispirazione superiore', 'Se tiri l\'iniziativa senza Ispirazioni rimaste, ne recuperi una.']]
    },
    res: lv => [['Dado di Ispirazione bardica', dieByLevel(lv, [[1, 'd6'], [5, 'd8'], [10, 'd10'], [15, 'd12']])],
      ['Canto di riposo', lv < 2 ? '—' : dieByLevel(lv, [[2, 'd6'], [9, 'd8'], [13, 'd10'], [17, 'd12']])]],
    subclasses: {
      'Collegio della Sapienza': {
        d: 'Il bardo che sa un po\' di tutto: più abilità, parole che sbilanciano i nemici e magia da ogni tradizione.',
        features: {
          3: [['Competenze bonus', 'Diventi competente in tre abilità a scelta.'],
            ['Parole taglienti', 'Con la reazione spendi un\'Ispirazione e sottrai il dado al tiro per colpire, alla prova o ai danni di una creatura entro 18 m.']],
          6: [['Segreti magici aggiuntivi', 'Impari due incantesimi di qualsiasi classe, che contano come incantesimi da bardo.']],
          14: [['Abilità impareggiabile', 'Quando fai una prova di caratteristica puoi spendere un\'Ispirazione e aggiungerne il dado.']]
        }
      }
    }
  },

  Chierico: {
    sub: { level: 1, title: 'Dominio divino', levels: [1, 2, 6, 8, 17] },
    features: {
      1: [['Incantesimi', 'Lanci incantesimi con la Saggezza; ogni giorno prepari SAG + livello incantesimi da tutta la lista del chierico. Puoi lanciare come rituali quelli preparati.'],
        ['Dominio divino', 'Scegli il dominio: dà incantesimi sempre preparati e privilegi al 1°, 2°, 6°, 8° e 17° livello.']],
      2: [['Incanalare divinità', 'Un uso per riposo breve o lungo. Scacciare non morti: con un\'azione i non morti entro 9 m fanno un TS Saggezza o fuggono per 1 minuto.']],
      5: [['Distruggere non morti', 'I non morti di GS 1/2 o meno che falliscono il TS contro Scacciare vengono distrutti.']],
      6: [['Incanalare divinità', 'Ora 2 usi per riposo.']],
      8: [['Distruggere non morti', 'Ora fino a GS 1.']],
      10: [['Intervento divino', 'Con un\'azione chiedi aiuto alla divinità: tira d100, se esce un numero non superiore al tuo livello interviene. Se funziona aspetti 7 giorni, altrimenti riprovi dopo un riposo lungo.']],
      11: [['Distruggere non morti', 'Ora fino a GS 2.']],
      14: [['Distruggere non morti', 'Ora fino a GS 3.']],
      17: [['Distruggere non morti', 'Ora fino a GS 4.']],
      18: [['Incanalare divinità', 'Ora 3 usi per riposo.']],
      20: [['Intervento divino migliorato', 'L\'Intervento divino riesce sempre.']]
    },
    res: lv => [['Usi di Incanalare divinità', lv < 2 ? '—' : dieByLevel(lv, [[2, 1], [6, 2], [18, 3]])],
      ['Distruggere non morti', lv < 5 ? '—' : `fino a GS ${dieByLevel(lv, [[5, '1/2'], [8, '1'], [11, '2'], [14, '3'], [17, '4']])}`]],
    subclasses: {
      'Dominio della Vita': {
        d: 'Il guaritore: cure più forti, armatura pesante e un colpo divino.',
        spells: { 1: ['Bless', 'Cure Wounds'], 3: ['Lesser Restoration', 'Spiritual Weapon'], 5: ['Beacon of Hope', 'Revivify'], 7: ['Death Ward', 'Guardian of Faith'], 9: ['Mass Cure Wounds', 'Raise Dead'] },
        features: {
          1: [['Competenza bonus', 'Diventi competente nelle armature pesanti.'],
            ['Discepolo della vita', 'Gli incantesimi di cura di 1° livello o superiore curano anche 2 + il livello dell\'incantesimo.']],
          2: [['Incanalare divinità: Preservare la vita', 'Con un\'azione distribuisci 5 × il tuo livello in PF tra le creature entro 9 m, fino a metà del loro massimo (non non morti né costrutti).']],
          6: [['Guaritore benedetto', 'Quando curi un altro con un incantesimo di 1° livello o superiore, recuperi anche tu 2 + il livello dell\'incantesimo.']],
          8: [['Colpo divino', 'Una volta per turno, quando colpisci con un\'arma, +1d8 danni radiosi.']],
          14: [['Colpo divino', 'Ora +2d8 danni radiosi.']],
          17: [['Guarigione suprema', 'Quando tiri i dadi di un incantesimo di cura usi il massimo.']]
        }
      }
    }
  },

  Druido: {
    sub: { level: 2, title: 'Circolo druidico', levels: [2, 6, 10, 14] },
    features: {
      1: [['Druidico', 'Conosci la lingua segreta dei druidi.'],
        ['Incantesimi', 'Lanci incantesimi con la Saggezza; ogni giorno prepari SAG + livello incantesimi da tutta la lista del druido. Puoi lanciare come rituali quelli preparati.']],
      2: [['Forma selvatica', 'Con un\'azione ti trasformi in una bestia che hai già visto, 2 volte per riposo breve o lungo, per un numero di ore pari a metà livello.'],
        ['Circolo druidico', 'Scegli il circolo: dà privilegi al 2°, 6°, 10° e 14° livello.']],
      4: [['Forma selvatica migliorata', 'Ora bestie fino a GS 1/2, anche quelle che nuotano.']],
      8: [['Forma selvatica migliorata', 'Ora bestie fino a GS 1, anche quelle che volano.']],
      18: [['Corpo senza tempo', 'Invecchi di un anno ogni dieci.'], ['Incantesimi bestiali', 'Puoi lanciare incantesimi in forma selvatica (componenti verbali e somatiche).']],
      20: [['Arcidruido', 'Forma selvatica senza limiti di usi; ignori le componenti verbali, somatiche e materiali senza costo.']]
    },
    res: lv => [['Forma selvatica', lv < 2 ? '—' : dieByLevel(lv, [[2, 'GS 1/4, niente nuoto né volo'], [4, 'GS 1/2, niente volo'], [8, 'GS 1']])]],
    subclasses: {
      'Circolo della Terra': {
        d: 'Il custode di un territorio: più magia, incantesimi del proprio terreno e recupero degli slot.',
        features: {
          2: [['Trucchetto bonus', 'Impari un trucchetto da druido in più.'],
            ['Recupero naturale', 'Una volta per riposo lungo, con un riposo breve recuperi slot per un totale di livelli pari a metà livello da druido (per eccesso), nessuno di 6° o superiore.']],
          3: [['Incantesimi del circolo', 'Gli incantesimi del tuo terreno sono sempre preparati e non contano nel numero (al 3°, 5°, 7° e 9° livello).']],
          6: [['Andatura sul territorio', 'Il terreno difficile non magico non ti rallenta; vantaggio ai TS contro le piante magiche che ostacolano.']],
          10: [['Protezione della natura', 'Non puoi essere affascinato né spaventato da elementali e folletti; sei immune a veleno e malattie.']],
          14: [['Santuario della natura', 'Bestie e piante che vogliono attaccarti fanno un TS Saggezza o devono scegliere un altro bersaglio.']]
        }
      }
    }
  },

  Guerriero: {
    sub: { level: 3, title: 'Archetipo marziale', levels: [3, 7, 10, 15, 18] },
    features: {
      1: [['Stile di combattimento', 'Scegli uno stile di combattimento.'],
        ['Recuperare energie', 'Con un\'azione bonus recuperi 1d10 + livello PF, una volta per riposo breve o lungo.']],
      2: [['Azione impetuosa', 'Una volta per riposo breve o lungo, nel tuo turno fai un\'azione in più.']],
      3: [['Archetipo marziale', 'Scegli l\'archetipo: dà privilegi al 3°, 7°, 10°, 15° e 18° livello.']],
      5: [['Attacco extra', 'Quando usi l\'azione Attacco attacchi due volte.']],
      9: [['Indomito', 'Ripeti un TS fallito, una volta per riposo lungo.']],
      11: [['Attacco extra', 'Ora attacchi tre volte.']],
      13: [['Indomito', 'Ora 2 usi per riposo lungo.']],
      17: [['Azione impetuosa', 'Ora 2 usi per riposo (una sola per turno).'], ['Indomito', 'Ora 3 usi per riposo lungo.']],
      20: [['Attacco extra', 'Ora attacchi quattro volte.']]
    },
    res: lv => [['Attacchi con l\'azione Attacco', dieByLevel(lv, [[1, 1], [5, 2], [11, 3], [20, 4]])],
      ['Azione impetuosa', lv < 2 ? '—' : dieByLevel(lv, [[2, 1], [17, 2]])], ['Indomito', lv < 9 ? '—' : dieByLevel(lv, [[9, 1], [13, 2], [17, 3]])]],
    subclasses: {
      Campione: {
        d: 'La forza pura: critici più frequenti, atletismo e resistenza.',
        features: {
          3: [['Critico migliorato', 'Fai un colpo critico con 19 o 20.']],
          7: [['Atleta straordinario', 'Metà competenza (per eccesso) alle prove di FOR, DES e COS in cui non sei competente; il salto in lungo con rincorsa aumenta di 30 cm per punto di modificatore di FOR.']],
          10: [['Stile di combattimento aggiuntivo', 'Scegli un secondo stile di combattimento.']],
          15: [['Critico superiore', 'Fai un colpo critico con 18, 19 o 20.']],
          18: [['Sopravvissuto', 'All\'inizio di ogni tuo turno recuperi 5 + COS PF se hai metà dei PF o meno (e almeno 1).']]
        }
      }
    }
  },

  Ladro: {
    sub: { level: 3, title: 'Archetipo ladresco', levels: [3, 9, 13, 17] },
    features: {
      1: [['Maestria', 'Raddoppi la competenza in due abilità (o in un\'abilità e negli arnesi da scasso).'],
        ['Attacco furtivo', 'Una volta per turno, danni in più con un\'arma accurata o a distanza se hai vantaggio o se un alleato è entro 1,5 m dal bersaglio.'],
        ['Gergo ladresco', 'Conosci il linguaggio segreto dei ladri.']],
      2: [['Azione scaltra', 'Con un\'azione bonus puoi Scattare, Disimpegnarti o Nasconderti.']],
      3: [['Archetipo ladresco', 'Scegli l\'archetipo: dà privilegi al 3°, 9°, 13° e 17° livello.']],
      5: [['Schivata prodigiosa', 'Con la reazione dimezzi i danni di un attacco di una creatura che vedi.']],
      6: [['Maestria', 'Raddoppi la competenza in altre due abilità.']],
      7: [['Elusione', 'Nei TS di Destrezza per dimezzare: niente danni se riesci, metà se fallisci.']],
      11: [['Talento affidabile', 'Nelle prove in cui sei competente, un 9 o meno sul d20 conta come 10.']],
      14: [['Percezione cieca', 'Sai dove sono le creature nascoste o invisibili entro 3 m, se puoi sentire.']],
      15: [['Mente sfuggente', 'Diventi competente nei TS di Saggezza (applicato in automatico).']],
      18: [['Inafferrabile', 'Nessun attacco contro di te ha vantaggio, se non sei incapacitato.']],
      20: [['Colpo di fortuna', 'Un attacco mancato diventa un colpo, o una prova fallita un 20; una volta per riposo breve o lungo.']]
    },
    res: lv => [['Attacco furtivo', `${Math.ceil(lv / 2)}d6`]],
    subclasses: {
      Furfante: {
        d: 'Il ladro classico: mani veloci, arrampicate e oggetti magici.',
        features: {
          3: [['Mani veloci', 'Con l\'azione bonus di Azione scaltra fai prove di Rapidità di Mano, usi gli arnesi da scasso o l\'azione Usare un oggetto.'],
            ['Lavoro al secondo piano', 'Arrampicarti non costa movimento in più; il salto in lungo con rincorsa aumenta di 30 cm per punto di modificatore di DES.']],
          9: [['Furtività suprema', 'Vantaggio alle prove di Furtività se in quel turno ti muovi al massimo di metà velocità.']],
          13: [['Usare oggetti magici', 'Ignori i requisiti di classe, razza e livello degli oggetti magici.']],
          17: [['Riflessi da ladro', 'Nel primo round di combattimento fai due turni (il secondo all\'iniziativa −10), se non sei sorpreso.']]
        }
      }
    }
  },

  Mago: {
    sub: { level: 2, title: 'Tradizione arcana', fem: true, levels: [2, 6, 10, 14] },
    features: {
      1: [['Incantesimi', 'Lanci incantesimi con l\'Intelligenza dal tuo libro; ogni giorno ne prepari INT + livello. I rituali del libro li lanci anche senza prepararli. A ogni livello scrivi due incantesimi nuovi nel libro.'],
        ['Recupero arcano', 'Una volta al giorno, dopo un riposo breve recuperi slot per un totale di livelli pari a metà livello (per eccesso), nessuno di 6° o superiore.']],
      2: [['Tradizione arcana', 'Scegli la scuola: dà privilegi al 2°, 6°, 10° e 14° livello.']],
      18: [['Padronanza degli incantesimi', 'Scegli un incantesimo di 1° e uno di 2° del libro: se preparati, li lanci al loro livello senza spendere slot.']],
      20: [['Incantesimi distintivi', 'Scegli due incantesimi di 3° livello: sempre preparati, non contano nel numero, e ognuno si lancia una volta senza slot per riposo breve o lungo.']]
    },
    subclasses: {
      'Scuola di Invocazione': {
        d: 'Il mago da battaglia: palle di fuoco che risparmiano gli alleati e danni più alti.',
        features: {
          2: [['Esperto di invocazione', 'Copiare un\'invocazione nel libro costa metà oro e metà tempo.'],
            ['Scolpire incantesimi', 'Quando lanci un\'invocazione, 1 + livello dell\'incantesimo creature a scelta superano automaticamente il TS e non subiscono danni se avrebbero dimezzato.']],
          6: [['Trucchetto potente', 'Chi supera il TS contro un tuo trucchetto subisce comunque metà danni.']],
          10: [['Invocazione potenziata', 'Aggiungi INT a un tiro di danni delle invocazioni da mago.']],
          14: [['Sovraccarico', 'Un incantesimo da mago di 1°-5° livello che fa danni li fa al massimo; se lo rifai prima di un riposo lungo subisci danni necrotici che crescono a ogni uso.']]
        }
      }
    }
  },

  Monaco: {
    sub: { level: 3, title: 'Tradizione monastica', fem: true, levels: [3, 6, 11, 17] },
    features: {
      1: [['Difesa senza armatura', 'Senza armatura né scudo la tua CA è 10 + DES + SAG.'],
        ['Arti marziali', 'Con colpi senz\'armi e armi da monaco usi la Destrezza e il dado delle arti marziali; dopo l\'azione Attacco fai un colpo senz\'armi con un\'azione bonus.']],
      2: [['Ki', 'Punti ki pari al livello, si recuperano col riposo breve. Raffica di colpi (2 colpi senz\'armi con azione bonus), Difesa paziente (Schivare con azione bonus), Passo del vento (Disimpegno o Scatto con azione bonus e salto doppio): 1 ki ciascuno.'],
        ['Movimento senza armatura', 'Velocità in più senza armatura né scudo.']],
      3: [['Tradizione monastica', 'Scegli la tradizione: dà privilegi al 3°, 6°, 11° e 17° livello.'],
        ['Deviare proiettili', 'Con la reazione riduci i danni di un attacco a distanza di 1d10 + DES + livello; se arrivano a 0 puoi prenderlo e, con 1 ki, rilanciarlo.']],
      4: [['Caduta lenta', 'Con la reazione riduci i danni da caduta di 5 × il tuo livello.']],
      5: [['Attacco extra', 'Quando usi l\'azione Attacco attacchi due volte.'],
        ['Colpo stordente', 'Quando colpisci in mischia, con 1 ki il bersaglio fa un TS Costituzione o resta stordito fino alla fine del tuo prossimo turno.']],
      6: [['Colpi potenziati dal ki', 'I colpi senz\'armi contano come magici.']],
      7: [['Elusione', 'Nei TS di Destrezza per dimezzare: niente danni se riesci, metà se fallisci.'],
        ['Quiete della mente', 'Con un\'azione termini su di te un effetto che ti affascina o ti spaventa.']],
      9: [['Movimento senza armatura migliorato', 'Nel tuo turno puoi muoverti su pareti verticali e sui liquidi.']],
      10: [['Purezza del corpo', 'Sei immune a malattie e veleno.']],
      13: [['Lingua del sole e della luna', 'Capisci tutte le lingue parlate e chiunque capisce te.']],
      14: [['Anima adamantina', 'Diventi competente in tutti i TS (applicato in automatico); con 1 ki ripeti un TS fallito.']],
      15: [['Corpo senza tempo', 'Non soffri la vecchiaia e non ti servono cibo né acqua.']],
      18: [['Corpo vuoto', 'Con 4 ki diventi invisibile per 1 minuto con resistenza a tutti i danni tranne forza; con 8 ki lanci Proiezione astrale su di te.']],
      20: [['Perfezione interiore', 'Se tiri l\'iniziativa senza ki, ne recuperi 4.']]
    },
    res: lv => [['Dado delle arti marziali', dieByLevel(lv, [[1, 'd4'], [5, 'd6'], [11, 'd8'], [17, 'd10']])],
      ['Punti ki', lv < 2 ? '—' : lv], ['Movimento senza armatura', lv < 2 ? '—' : dieByLevel(lv, [[2, '+3 m'], [6, '+4,5 m'], [10, '+6 m'], [14, '+7,5 m'], [18, '+9 m']])]],
    subclasses: {
      'Via della Mano Aperta': {
        d: 'Il maestro delle arti marziali: colpi che atterrano e spingono, cure e un colpo letale.',
        features: {
          3: [['Tecnica della mano aperta', 'Quando colpisci con la Raffica di colpi: TS Destrezza o prono, TS Forza o spinto di 4,5 m, oppure niente reazioni fino alla fine del tuo prossimo turno.']],
          6: [['Integrità del corpo', 'Con un\'azione recuperi 3 × il tuo livello in PF, una volta per riposo lungo.']],
          11: [['Tranquillità', 'Alla fine di un riposo lungo hai l\'effetto di Santuario fino al riposo successivo.']],
          17: [['Palmo tremante', 'Con 3 ki imprimi vibrazioni letali in chi colpisci; poi con un\'azione fa un TS Costituzione: se fallisce va a 0 PF, se riesce subisce 10d10 danni necrotici.']]
        }
      }
    }
  },

  Paladino: {
    sub: { level: 3, title: 'Giuramento sacro', levels: [3, 7, 15, 20] },
    features: {
      1: [['Percezione del divino', 'Con un\'azione senti celestiali, immondi e non morti entro 18 m; usi pari a 1 + CAR per riposo lungo.'],
        ['Imposizione delle mani', 'Hai una riserva di 5 × il tuo livello in PF da curare col tocco; con 5 PF della riserva curi una malattia o un veleno.']],
      2: [['Stile di combattimento', 'Scegli uno stile di combattimento.'],
        ['Incantesimi', 'Lanci incantesimi con il Carisma; ogni giorno prepari CAR + metà livello incantesimi dalla lista del paladino.'],
        ['Punizione divina', 'Quando colpisci in mischia spendi uno slot: +2d8 danni radiosi, +1d8 per ogni livello di slot oltre il 1° (massimo 5d8), +1d8 contro non morti e immondi.']],
      3: [['Salute divina', 'Sei immune alle malattie.'], ['Giuramento sacro', 'Scegli il giuramento: dà incantesimi sempre preparati e privilegi al 3°, 7°, 15° e 20° livello.']],
      5: [['Attacco extra', 'Quando usi l\'azione Attacco attacchi due volte.']],
      6: [['Aura di protezione', 'Tu e gli alleati entro 3 m aggiungete il tuo CAR (minimo +1) ai TS, se sei cosciente.']],
      10: [['Aura di coraggio', 'Tu e gli alleati entro 3 m non potete essere spaventati.']],
      11: [['Punizione divina migliorata', 'Ogni colpo in mischia fa +1d8 danni radiosi.']],
      14: [['Tocco purificatore', 'Con un\'azione termini un incantesimo su di te o su una creatura consenziente; usi pari a CAR (minimo 1) per riposo lungo.']],
      18: [['Aure migliorate', 'Le tue aure arrivano a 9 m.']]
    },
    res: lv => [['Riserva di Imposizione delle mani', `${5 * lv} PF`]],
    subclasses: {
      'Giuramento di Devozione': {
        d: 'Il cavaliere ideale: onestà, coraggio e protezione degli innocenti.',
        spells: { 3: ['Protection from Evil and Good', 'Sanctuary'], 5: ['Lesser Restoration', 'Zone of Truth'], 9: ['Beacon of Hope', 'Dispel Magic'], 13: ['Freedom of Movement', 'Guardian of Faith'], 17: ['Commune', 'Flame Strike'] },
        features: {
          3: [['Incantesimi del giuramento', 'Gli incantesimi del giuramento sono sempre preparati e non contano nel numero.'],
            ['Incanalare divinità', 'Un uso per riposo breve o lungo. Arma sacra: per 1 minuto aggiungi CAR ai tiri per colpire con un\'arma, che fa luce. Scacciare gli empi: immondi e non morti entro 9 m fanno un TS Saggezza o fuggono.']],
          7: [['Aura di devozione', 'Tu e gli alleati entro 3 m (9 m dal 18°) non potete essere affascinati.']],
          15: [['Purezza dello spirito', 'Sei sempre sotto l\'effetto di Protezione dal bene e dal male.']],
          20: [['Nimbo sacro', 'Con un\'azione per 1 minuto emani luce: i nemici che iniziano il turno vicino a te subiscono 10 danni radiosi; vantaggio ai TS contro incantesimi di immondi e non morti. Una volta per riposo lungo.']]
        }
      }
    }
  },

  Ranger: {
    sub: { level: 3, title: 'Archetipo ranger', levels: [3, 7, 11, 15] },
    features: {
      1: [['Nemico prescelto', 'Vantaggio alle prove di Sopravvivenza per seguire le tracce dei tuoi nemici prescelti e di Intelligenza per ricordare cosa sai di loro; impari una lingua che parlano.'],
        ['Esploratore nato', 'Nel tuo terreno prescelto raddoppi la competenza nelle prove di INT e SAG che lo riguardano; in viaggio non rallenti per il terreno difficile e non ti perdi.']],
      2: [['Stile di combattimento', 'Scegli uno stile di combattimento.'],
        ['Incantesimi', 'Lanci incantesimi con la Saggezza e li conosci (ne cambi uno a ogni livello).']],
      3: [['Archetipo ranger', 'Scegli l\'archetipo: dà privilegi al 3°, 7°, 11° e 15° livello.'],
        ['Consapevolezza primordiale', 'Spendi uno slot: per 1 minuto a livello dello slot senti se ci sono aberrazioni, celestiali, draghi, elementali, folletti, immondi o non morti entro 1,5 km (9 km nel tuo terreno).']],
      5: [['Attacco extra', 'Quando usi l\'azione Attacco attacchi due volte.']],
      6: [['Nemico prescelto e Esploratore nato', 'Scegli un altro nemico prescelto e un altro terreno prescelto.']],
      8: [['Andatura sul territorio', 'Il terreno difficile non magico non ti rallenta; vantaggio ai TS contro le piante magiche.']],
      10: [['Esploratore nato', 'Scegli un altro terreno prescelto.'],
        ['Nascondersi in piena vista', 'Con 1 minuto per camuffarti hai +10 alle prove di Furtività finché resti fermo.']],
      14: [['Nemico prescelto', 'Scegli un altro nemico prescelto.'],
        ['Svanire', 'Puoi Nasconderti con un\'azione bonus e non puoi essere seguito con mezzi non magici.']],
      18: [['Sensi ferini', 'Nessuno svantaggio ad attaccare creature che non vedi; sai dove sono le creature invisibili entro 9 m.']],
      20: [['Sterminatore di nemici', 'Una volta per turno aggiungi SAG al tiro per colpire o ai danni contro un nemico prescelto.']]
    },
    subclasses: {
      Cacciatore: {
        d: 'Il cacciatore di mostri: tecniche contro i giganti, le orde e i colpi difficili.',
        features: {
          3: [['Preda del cacciatore', 'Scegli una tecnica di caccia.']],
          7: [['Tattiche difensive', 'Scegli una tattica difensiva.']],
          11: [['Attacco multiplo', 'Scegli un attacco multiplo.']],
          15: [['Difesa superiore del cacciatore', 'Scegli una difesa.']]
        }
      }
    }
  },

  Stregone: {
    sub: { level: 1, title: 'Origine stregonesca', fem: true, levels: [1, 6, 14, 18] },
    features: {
      1: [['Incantesimi', 'Lanci incantesimi con il Carisma e li conosci (ne cambi uno a ogni livello).'],
        ['Origine stregonesca', 'Scegli l\'origine della tua magia: dà privilegi al 1°, 6°, 14° e 18° livello.']],
      2: [['Fonte di magia', 'Punti stregoneria pari al livello (si recuperano col riposo lungo). Con un\'azione bonus trasformi slot in punti o punti in slot (2 punti = 1°, 3 = 2°, 5 = 3°, 6 = 4°, 7 = 5°).']],
      3: [['Metamagia', 'Scegli due opzioni di Metamagia per modificare gli incantesimi con i punti stregoneria.']],
      10: [['Metamagia', 'Scegli un\'altra opzione di Metamagia.']],
      17: [['Metamagia', 'Scegli un\'altra opzione di Metamagia.']],
      20: [['Recupero stregonesco', 'Con un riposo breve recuperi 4 punti stregoneria.']]
    },
    res: lv => [['Punti stregoneria', lv < 2 ? '—' : lv]],
    subclasses: {
      'Discendenza draconica': {
        d: 'Sangue di drago: più PF, scaglie che fanno da armatura, danni elementali e ali.',
        hpPerLevel: 1,
        features: {
          1: [['Antenato draconico', 'Parli il draconico e raddoppi la competenza nelle prove di CAR con i draghi.'],
            ['Resilienza draconica', '+1 PF per livello da stregone (applicato in automatico); senza armatura la CA è 13 + DES.']],
          6: [['Affinità elementale', 'Con un incantesimo del tipo di danno del tuo drago aggiungi CAR a un tiro di danni; con 1 punto stregoneria hai resistenza a quel danno per 1 ora.']],
          14: [['Ali di drago', 'Con un\'azione bonus fai spuntare ali: velocità di volo pari alla tua velocità.']],
          18: [['Presenza draconica', 'Con un\'azione e 5 punti stregoneria, per 1 minuto le creature entro 18 m fanno un TS Saggezza o sono affascinate o spaventate (a tua scelta).']]
        }
      }
    }
  },

  Warlock: {
    sub: { level: 1, title: 'Patrono ultraterreno', levels: [1, 6, 10, 14] },
    features: {
      1: [['Patrono ultraterreno', 'Scegli il patrono: dà privilegi al 1°, 6°, 10° e 14° livello e altri incantesimi tra cui scegliere.'],
        ['Magia del patto', 'Lanci incantesimi con il Carisma e li conosci (ne cambi uno a ogni livello); gli slot sono tutti dello stesso livello e si recuperano col riposo breve.']],
      2: [['Suppliche occulte', 'Scegli due suppliche: poteri magici permanenti. Ne impari altre salendo di livello.']],
      3: [['Dono del patto', 'Scegli il dono del tuo patrono.']],
      11: [['Arcanum mistico (6°)', 'Scegli un incantesimo da warlock di 6° livello: lo lanci una volta per riposo lungo senza slot del patto.']],
      13: [['Arcanum mistico (7°)', 'Scegli un incantesimo da warlock di 7° livello, una volta per riposo lungo.']],
      15: [['Arcanum mistico (8°)', 'Scegli un incantesimo da warlock di 8° livello, una volta per riposo lungo.']],
      17: [['Arcanum mistico (9°)', 'Scegli un incantesimo da warlock di 9° livello, una volta per riposo lungo.']],
      20: [['Maestro dell\'occulto', 'Una volta per riposo lungo, con 1 minuto di preghiera al patrono recuperi tutti gli slot del patto.']]
    },
    res: lv => [['Suppliche occulte conosciute', dieByLevel(lv, [[1, 0], [2, 2], [5, 3], [7, 4], [9, 5], [12, 6], [15, 7], [18, 8]])]],
    subclasses: {
      Immondo: {
        d: 'Un patto con un signore degli inferi: forza dalle vittime, fortuna oscura e incantesimi di fuoco.',
        extraSpells: ['Burning Hands', 'Command', 'Blindness/Deafness', 'Scorching Ray', 'Fireball', 'Stinking Cloud', 'Fire Shield', 'Wall of Fire', 'Flame Strike', 'Hallow'],
        features: {
          1: [['Benedizione dell\'oscuro', 'Quando porti un nemico a 0 PF ottieni PF temporanei pari a CAR + livello da warlock (minimo 1).'],
            ['Lista ampliata', 'Puoi scegliere anche Mani brucianti, Comando, Cecità/Sordità, Raggio rovente, Palla di fuoco, Nube maleodorante, Scudo di fuoco, Muro di fuoco, Colpo infuocato e Consacrare.']],
          6: [['Fortuna dell\'oscuro', 'Aggiungi un d10 a una prova di caratteristica o a un TS, una volta per riposo breve o lungo.']],
          10: [['Resilienza immonda', 'Dopo ogni riposo scegli un tipo di danno: ne hai resistenza fino al riposo successivo (non contro armi magiche o d\'argento).']],
          14: [['Scagliare all\'inferno', 'Quando colpisci una creatura la mandi all\'inferno fino alla fine del tuo prossimo turno: torna con 10d10 danni psichici se non è un immondo. Una volta per riposo lungo.']]
        }
      }
    }
  }
};

// Razze del regolamento base con qualcosa che cambia salendo di livello
const RACE_PROGRESSION = [
  { re: /dragonid/i, levels: { 6: 'Arma a soffio: ora 3d6 danni.', 11: 'Arma a soffio: ora 4d6 danni.', 16: 'Arma a soffio: ora 5d6 danni.' } },
  { re: /tiefling/i, levels: { 3: 'Eredità infernale: lanci Rimprovero infernale come incantesimo di 2° livello, una volta per riposo lungo (CAR).', 5: 'Eredità infernale: lanci Oscurità una volta per riposo lungo (CAR).' } },
  { re: /nano/i, levels: {}, every: 'Robustezza nanica: +1 PF (già compreso).' }
];
