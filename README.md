# 🎲 Il Tavolo — D&D 5e

Un tavolo virtuale per giocare a Dungeons & Dragons 5e online con gli amici, tutto in italiano.
Il Master crea l'avventura e manda un link; ognuno entra dal proprio telefono o computer.

- **Lobby delle avventure**: si entra come Master (con password) o come Giocatore, scegliendo o creando il proprio personaggio.
- **Mappa tattica**: griglia regolabile, nebbia di guerra da scoprire col pennello, pedine da trascinare con la misura in metri, mappe caricate dal Master.
- **Più mappe per avventura**: il Master prepara la prossima mappa di nascosto e con **📣 Mostra ai giocatori** ci porta tutti.
- **Iniziativa** con turno attivo evidenziato sulla mappa e avviso “Tocca a te!”.
- **Lancia-dadi** con vantaggio/svantaggio, tiri contro CA, critici, tiri segreti del Master e formule libere (`2d6+1d4+3`).
- **Dadi 3D** con la fisica: ogni tiro rotola sullo schermo di tutti e si ferma sugli stessi numeri. Ogni giocatore sceglie
  il colore dei suoi dadi; il 20 naturale si illumina d'oro, l'1 di rosso; suono facoltativo. Sui dispositivi che non
  reggono il 3D (o se si sceglie così) si usano i dadi semplici; l'animazione si può anche spegnere.
- **Mostri del regolamento base**: cerchi “goblin” o “drago”, aggiungi uno o più mostri con PF, CA e iniziativa già pronti;
  il Master vede la scheda del mostro e tira attacchi e danni con un tocco. I 44 mostri più comuni delle prime avventure
  sono in una galleria con la loro icona pronta.
- **Immagini** per personaggi e pedine: ritagliate e compresse sul telefono (circa 10 KB l'una), salvate una volta sola
  anche se usate da più pedine; un'immagine può valere per tutti i mostri dello stesso tipo.
- **Condizioni con durata** in round, che finiscono da sole al momento giusto del turno.
- **Scheda personaggio** semplice o completa: PF e PF temporanei, riposi, tiri salvezza contro morte, abilità con competenza e maestria, attacchi, condizioni.
- **Incantesimi**: si scelgono dall'elenco del regolamento base, si lanciano spendendo gli slot (anche a livello superiore),
  con tiri d'attacco, danni, cure, CD e concentrazione (con il tiro salvezza quando si subiscono danni).
  Chierico, Druido, Mago e Paladino **preparano** gli incantesimi (caratteristica + livello, metà livello per il Paladino):
  si spuntano nella scheda, si lanciano solo quelli preparati e quelli del dominio o del giuramento si segnano “sempre
  preparati”. I **rituali** si lanciano senza slot con 10 minuti in più: il Mago anche quelli non preparati del suo libro,
  Chierico e Druido quelli preparati, il Bardo quelli che conosce.
- **Creazione guidata del personaggio** (razza, classe, caratteristiche con serie standard, acquisto a punti o 4d6, abilità)
  e **passaggio di livello guidato** fino al 20°, per tutte le 12 classi del regolamento base. Passo per passo dice
  cosa si ottiene (privilegi di classe, sottoclasse e razza, risorse che crescono) e propone le scelte spiegando ogni
  opzione: sottoclasse, aumento o talento, stili di combattimento, maestrie, Metamagia, suppliche e dono del patto,
  nemici e terreni del ranger, trucchetti e incantesimi nuovi, Segreti magici, Arcanum mistico, incantesimi del libro.
  Poi aggiorna la scheda: PF (anche i PF in più quando sale la Costituzione), slot (anche quelli del patto del Warlock,
  che si recuperano col riposo breve), incantesimi sempre preparati del dominio, del giuramento o del circolo, e scrive
  i privilegi nuovi nella scheda. Le scelte saltate dai personaggi già esistenti si recuperano al primo passaggio.
  Negli attacchi si può scrivere FOR o DES al posto dei numeri (“Spada lunga | FOR | 1d8+FOR”): bonus e danni si
  aggiornano da soli.
- **Messaggi privati** tra Master e giocatori e **dispense** (testo e immagini) per tutti o per un solo giocatore.
- **Diario condiviso** (missioni, PNG, luoghi, bottino, domande per il DM con risposta): ogni voce si può correggere o
  eliminare da chi l'ha scritta e dal Master. **Note personali** che legge solo chi le scrive (nemmeno il Master),
  protette da un PIN personale.
- **Collegamenti nel Diario**: i nomi di personaggi, PNG, luoghi, missioni, bottino e mappe diventano link da soli
  (maiuscole, minuscole e accenti non contano: “citta bianca” trova “Città Bianca”);
  scrivendo “@” si sceglie un nome dall'elenco (o si crea una voce nuova). Ogni voce mostra dove viene citata.
- **Schede personalizzate** per giocare con altre regole (Daggerheart, D&D 2024, homebrew…): il Master prepara un
  modello con valori, risorse, testi e tiri; i giocatori lo scelgono quando creano il personaggio e possono aggiungere
  campi loro. Senza modelli resta solo la scheda D&D 5e, identica a prima.
- **Storia del personaggio** (storia, aspetto, tratti, ideali, legami, difetti), visibile a tutti oppure solo al giocatore e al Master.
- **Password delle avventure**: sullo stesso sito possono giocare gruppi diversi; le avventure degli altri si vedono
  solo come titolo con il lucchetto.
- **Gestione dalla Home**: il Master elimina le avventure e toglie i personaggi che non giocano più; chiunque può
  nascondere dalla propria Home le avventure che non gli interessano.
- **Regole & PDF**: carichi i tuoi manuali, ci cerchi dentro e l'assistente li usa per rispondere.
- **Schermo del Master**: note segrete, appunti di sessione trasformati in voci del diario (poi gli appunti si svuotano,
  così la volta dopo non si ricreano le stesse voci), bilanciamento degli scontri (DMG 2014).

- **Schermo intero** (pulsante con i quattro angoli in alto): sparisce la barra in alto e le schede (Tavolo, Scheda,
  Diario, Regole, Master) si cambiano da una barra in fondo, toccandole o facendo scorrere il dito. Dove il browser lo
  permette spariscono anche le sue barre; sull'iPhone resta comunque la barra in fondo.
- **Caselle di testo che crescono** con quello che c'è scritto, fino a metà schermo; oltre compare “Mostra tutto”.

Tutto si sincronizza da solo tra i dispositivi. Se la connessione cade si continua a giocare: le modifiche partono appena torna.

---

## Messa online (una volta sola)

### 1. Database Supabase

1. Apri il progetto su [supabase.com](https://supabase.com) → **SQL Editor** → **New query**.
2. Incolla tutto il contenuto di [`supabase/setup.sql`](supabase/setup.sql) e premi **Run**.

Lo script crea le tabelle nuove e copia lì le campagne della vecchia tabella `campaigns`. Si può rieseguire senza problemi:
**rieseguilo ogni volta che aggiorni il sito**, così il database ha sempre le funzioni nuove (per esempio i messaggi privati).

> La vecchia tabella resta nel database come backup, ma il sito non può più leggerla: conteneva le password del Master in chiaro.
> Finché lo script non è stato eseguito il sito funziona solo in locale e lo dice nel pulsante ☁️ in alto.

### 2. Accessi anonimi (servono per codice del gruppo e password delle avventure)

Supabase → **Authentication → Sign In / Providers** → attiva **Allow anonymous sign-ins** e salva.
Non crea account visibili ai giocatori: serve solo a ricordare, su ogni dispositivo, chi ha già inserito un codice o una password.

Le **password delle avventure** si impostano dall'app (creazione dell'avventura o schermo del Master): non serve altro.

### 2b. Codice del gruppo (facoltativo)

Senza codice chiunque abbia il link del sito può entrare. Per riservare il tavolo ai tuoi amici:

Con gli accessi anonimi attivi (punto 2), da Supabase → **SQL Editor** esegui (con il codice che vuoi tu):

   ```sql
   select tavolo_set_group_code('il-vostro-codice');
   ```

Ogni dispositivo chiede il codice una volta sola (maiuscole e minuscole non contano). Se cambi il codice, tutti dovranno
inserire quello nuovo. Per riaprire il tavolo a chiunque: `select tavolo_set_group_code(null);`

### 3. Assistente IA (facoltativo)

Su Vercel → progetto → **Settings → Environment Variables** aggiungi:

| Nome | Valore |
| --- | --- |
| `GEMINI_API_KEY` | la chiave presa da [Google AI Studio](https://aistudio.google.com/apikey) |
| `GEMINI_MODEL` | facoltativo, predefinito `gemini-flash-latest` |

Poi rifai il deploy (Deployments → ⋯ → Redeploy). La chiave resta sul server: i giocatori usano l'assistente senza vederla.
Senza chiave l'assistente funziona lo stesso, ma risponde solo con il glossario e la ricerca nei PDF.

### 4. Pubblicazione

Vercel pubblica in automatico ogni push su GitHub: i branch diversi da `main` diventano un'**anteprima** con un indirizzo suo,
`main` diventa il sito vero. Non serve nessun passaggio di build: sono file statici più la funzione in `api/`.

---

## Come si gioca

1. Il Master apre il sito, preme **👑 Crea Nuova Avventura**, sceglie nome e password.
2. Dal Tavolo preme **🏠 Home → 🔗 Invita Giocatori** e manda il link agli amici.
3. Ogni giocatore apre il link, sceglie **Sono un Giocatore** e crea (o sceglie) il suo personaggio.
4. Il Master prepara la mappa: carica un'immagine, copre tutto con la nebbia e scopre le zone col pennello man mano.

Il Master può premere **👁️ Vista** per vedere la mappa esattamente come la vedono i giocatori.

## Cosa è protetto e cosa no

- **Protetto dalla password del Master**: note segrete, appunti di sessione, nemici preparati. Stanno in una “cassaforte” nel database che si apre solo con la password giusta.
- **Tiri segreti del Master**: restano solo sul suo dispositivo.
- **PDF dei manuali**: restano nel browser di chi li carica, non vengono mai inviati online.
- **Messaggi e dispense per un solo giocatore**: sono cifrati con una chiave che esiste solo sul dispositivo di quel giocatore.
  Se il giocatore cambia telefono, i messaggi vecchi su quello nuovo non si leggono (quelli nuovi sì).
  I messaggi dei giocatori al Master si leggono solo con la password del Master.
- **Note personali e storia privata**: cifrate con il PIN del giocatore (la storia privata anche con la chiave del Master,
  che sta nella sua cassaforte). Se il PIN si dimentica, quei testi non si recuperano.
- **Avventure con password**: chi non la conosce non può leggere né modificare niente, il controllo è nel database.
  Cambiando la password, chi era già entrato deve inserire quella nuova.
- **Con il codice del gruppo**: solo i dispositivi che hanno inserito il codice possono vedere e modificare le avventure.
- **Senza codice del gruppo**: chi ha il link può vedere e modificare la campagna (mappa, schede, diario). Va bene tra amici; non pubblicare il link in giro.
- In ogni caso le pedine nascoste e la mappa sotto la nebbia non si vedono sullo schermo dei giocatori, ma un giocatore
  molto curioso potrebbe trovarle negli strumenti per sviluppatori del browser.

## Struttura del progetto

```
index.html          pagina dell'app
style.css           colori, tema chiaro/scuro, componenti
css/                Tailwind precompilato (vedi sotto)
js/config.js        indirizzo Supabase e impostazioni
js/rules.js         regole 5e: condizioni, abilità, tabelle PE, dadi
js/store.js         modello dati, valori di default, conversione dal vecchio formato, salvataggio locale
js/sync.js          sincronizzazione con Supabase (tempo reale + controllo periodico), cassaforte del Master, codice del gruppo
js/core.js          stato dell'interfaccia e permessi (chi può modificare cosa), condizioni, mappe
js/srd.js           mostri, incantesimi, classi e razze del regolamento base
js/classes.js       privilegi, sottoclassi, risorse e scelte di ogni classe dal 1° al 20° livello
js/map.js           mappe, griglia, nebbia, pedine, schede dei mostri
js/diceanim.js      animazione dei dadi sul tavolo
js/table.js         iniziativa, dadi, assistente, barra del personaggio
js/sheet.js         scheda personaggio
js/spells.js        incantesimi, slot e concentrazione
js/wizard.js        creazione guidata del personaggio
js/levelup.js       passaggio di livello guidato
js/journal.js       diario
js/books.js         PDF, ricerca, assistente
js/dm.js            schermo del Master, esporta/importa/duplica/elimina
js/messages.js      messaggi privati e dispense
js/images.js        immagini di personaggi e pedine (ritaglio, compressione, pulizia)
js/private.js       PIN personale, note personali, storia del personaggio
js/links.js         collegamenti nel Diario e menu "@"
js/customsheet.js   modelli e schede personalizzate
js/bestiary.js      i mostri comuni con le loro icone (generato da tools/build-bestiary.py)
vendor/             libreria dei dadi 3D (scaricata solo al primo tiro) e i suoi suoni
js/app.js           avvio, lobby, ingresso nelle avventure
data/               dati del regolamento base (SRD 5.1), caricati solo quando servono
api/gemini.js       funzione Vercel che parla con Gemini
supabase/setup.sql  tabelle e funzioni del database
tools/build-srd.py  rigenera i file in data/
tools/build-bestiary.py  rigenera js/bestiary.js dalle icone di game-icons.net
```

Lo stile usa Tailwind già compilato in `css/`, così il sito non dipende dal CDN di Tailwind.
Se aggiungi classi nuove in `index.html` o in `js/`, rigenera i due file:

```
npx tailwindcss@3.4.17 -i tailwind/base.css -o css/tailwind-base.css --minify
npx tailwindcss@3.4.17 -i tailwind/utilities.css -o css/tailwind.css --minify
```

Per provarlo sul computer basta aprire `index.html` nel browser (l'assistente IA lì non c'è, il resto sì).
Le campagne salvate con la prima versione (file `.json`) si possono caricare con **Carica (.json)**.

## Idee per il futuro

- **Messaggi “nella notte”**: il Master programma un sogno, una lettera o un evento da consegnare ai giocatori a un'ora
  precisa tra una sessione e l'altra, magari con una notifica sul telefono.

## Crediti

Mostri, incantesimi, classi e razze vengono dal System Reference Document 5.1 di Wizards of the Coast LLC,
distribuito con licenza [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/legalcode),
con i nomi tradotti in italiano per questa app. I dati sono ricavati da [5e-database](https://github.com/soryy708/5e-database) (MIT).
Dettagli in [`data/LICENZE.md`](data/LICENZE.md). Il Tavolo non è affiliato a Wizards of the Coast.

Icone dei mostri di [game-icons.net](https://game-icons.net), licenza [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/):
Lorc, Delapouite, Carl Olsen, Caro Asercion, DarkZaitzev, Skoll, Sparker (l'autore di ogni icona è indicato in `js/bestiary.js`).

Dadi 3D: [dice-box-threejs](https://github.com/3d-dice/dice-box-threejs) (MIT, © 3D Dice), che include
[three.js](https://threejs.org) (MIT) e [cannon-es](https://github.com/pmndrs/cannon-es) (MIT); vedi `vendor/dice-box-threejs/`.
